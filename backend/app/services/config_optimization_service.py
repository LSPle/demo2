import json
import logging
import os
from typing import Dict, Any, Optional, Tuple, List

try:
    import pymysql
except ImportError:
    pymysql = None

from flask import current_app, has_app_context
from ..models import Instance
from .prometheus_service import prometheus_service

logger = logging.getLogger(__name__)


def _fmt_seconds(seconds: int) -> str:
    try:
        s = int(seconds)
    except Exception:
        return str(seconds)
    days = s // 86400
    s %= 86400
    hours = s // 3600
    s %= 3600
    minutes = s // 60
    parts = []
    if days:
        parts.append(f"{days}天")
    if hours or (days and (minutes or s)):
        parts.append(f"{hours}小时")
    if minutes:
        parts.append(f"{minutes}分钟")
    if not parts:
        parts.append("0分钟")
    return " ".join(parts)


def _human_bytes(v: Any) -> str:
    try:
        n = int(v)
    except Exception:
        return str(v)
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while n >= 1024 and i < len(units) - 1:
        n /= 1024
        i += 1
    if i >= 2:
        return f"{n:.0f}{units[i]}"
    return f"{n:.1f}{units[i]}".rstrip('0').rstrip('.') + units[i]


def _parse_bool(v: Any) -> str:
    s = str(v).strip().lower()
    if s in ("1", "on", "true", "enabled", "yes"):
        return "ON"
    return "OFF"


class InstanceConfigCollector:
    """采集MySQL关键配置与状态"""

    def __init__(self, timeout: int = 10):
        self.timeout = timeout

    def _connect(self, inst: Instance):
        if not pymysql:
            raise RuntimeError("MySQL驱动不可用")
        return pymysql.connect(
            host=inst.host,
            port=inst.port,
            user=inst.username or '',
            password=inst.password or '',
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=self.timeout,
            read_timeout=self.timeout,
            write_timeout=self.timeout
        )

    def collect(self, inst: Instance) -> Tuple[bool, Dict[str, Any], str]:
        if not inst:
            return False, {}, "实例不存在"
        if (inst.db_type or '').strip() != 'MySQL':
            return False, {}, "仅支持MySQL实例"
        try:
            conn = self._connect(inst)
            try:
                with conn.cursor() as cur:
                    # 变量
                    cur.execute("SHOW GLOBAL VARIABLES WHERE Variable_name IN ('max_connections','innodb_buffer_pool_size','innodb_buffer_pool_instances','innodb_log_file_size','innodb_log_files_in_group','slow_query_log','wait_timeout','long_query_time')")
                    vars_rows = cur.fetchall()
                    variables = {r['Variable_name']: r['Value'] for r in vars_rows}

                    # 状态
                    cur.execute("SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Innodb_row_lock_time','Innodb_row_lock_waits','Innodb_buffer_pool_reads','Innodb_buffer_pool_read_requests','Uptime')")
                    stat_rows = cur.fetchall()
                    status = {r['Variable_name']: r['Value'] for r in stat_rows}

                    # 版本
                    cur.execute("SELECT VERSION() AS ver")
                    ver_row = cur.fetchone() or {}
                    version = (ver_row.get('ver') or '').strip()

                # 统一整理
                max_conn = int(variables.get('max_connections') or 0)
                threads_conn = int(status.get('Threads_connected') or 0)
                uptime_s = int(status.get('Uptime') or 0)
                ibp_size = variables.get('innodb_buffer_pool_size')
                slow_log = _parse_bool(variables.get('slow_query_log'))
                wait_timeout = variables.get('wait_timeout')
                long_query_time = variables.get('long_query_time')

                # 新增：更多 InnoDB/并发相关指标
                ibp_instances = variables.get('innodb_buffer_pool_instances')
                log_file_size = variables.get('innodb_log_file_size')
                log_files_group = variables.get('innodb_log_files_in_group')
                threads_running = int(status.get('Threads_running') or 0)
                row_lock_time = int(status.get('Innodb_row_lock_time') or 0)
                row_lock_waits = int(status.get('Innodb_row_lock_waits') or 0)
                avg_lock_ms = (row_lock_time / row_lock_waits) if row_lock_waits else 0
                try:
                    lfs_int = int(log_file_size) if str(log_file_size).isdigit() else 0
                except Exception:
                    lfs_int = 0
                try:
                    lfg_int = int(log_files_group) if str(log_files_group).isdigit() else 0
                except Exception:
                    lfg_int = 0
                redo_total = lfs_int * lfg_int

                # 新增：缓冲池命中率与连接池压力计算
                try:
                    bp_reads = int(status.get('Innodb_buffer_pool_reads') or 0)
                except Exception:
                    bp_reads = 0
                try:
                    bp_read_reqs = int(status.get('Innodb_buffer_pool_read_requests') or 0)
                except Exception:
                    bp_read_reqs = 0
                bp_hit_ratio = None
                if bp_read_reqs > 0:
                    try:
                        bp_hit_ratio = max(0.0, 100.0 * (1.0 - (bp_reads / bp_read_reqs)))
                    except Exception:
                        bp_hit_ratio = None

                conn_pressure = None
                if max_conn > 0:
                    try:
                        conn_pressure = max(0.0, min(100.0, (threads_conn / max_conn) * 100.0))
                    except Exception:
                        conn_pressure = None

                # prometheus 指标（可选）
                prom = prometheus_service.get_all_metrics('mysqld') if prometheus_service else {}
                mem_pct = prom.get('memory_usage')
                disk = prom.get('disk_usage') or {}
                disk_pct = disk.get('usage_percent')

                result = {
                    'basicInfo': {
                        'instanceName': inst.instance_name,
                        'type': f"MySQL {version.split('-')[0]}" if version else 'MySQL',
                        'uptime': _fmt_seconds(uptime_s),
                        'connections': f"{threads_conn}/{max_conn if max_conn else '?'}",
                        'memoryUsage': f"{mem_pct:.0f}%" if isinstance(mem_pct, (int, float)) else (str(mem_pct) if mem_pct is not None else 'N/A'),
                        'diskUsage': f"{disk_pct:.0f}%" if isinstance(disk_pct, (int, float)) else (str(disk_pct) if disk_pct is not None else 'N/A'),
                    },
                    'raw': {
                        'max_connections': max_conn,
                        'threads_connected': threads_conn,
                        'innodb_buffer_pool_size': int(ibp_size) if str(ibp_size).isdigit() else ibp_size,
                        'innodb_buffer_pool_size_h': _human_bytes(ibp_size),
                        'innodb_buffer_pool_instances': int(ibp_instances) if str(ibp_instances).isdigit() else ibp_instances,
                        'innodb_log_file_size': int(log_file_size) if str(log_file_size).isdigit() else log_file_size,
                        'innodb_log_file_size_h': _human_bytes(log_file_size),
                        'innodb_log_files_in_group': int(log_files_group) if str(log_files_group).isdigit() else log_files_group,
                        'threads_running': threads_running,
                        'innodb_row_lock_time': row_lock_time,
                        'innodb_row_lock_waits': row_lock_waits,
                        'innodb_row_lock_time_avg_ms': round(avg_lock_ms, 1) if row_lock_waits else 0,
                        'innodb_redo_total_bytes': redo_total,
                        'innodb_redo_total_h': _human_bytes(redo_total),
                        'slow_query_log': slow_log,
                        'wait_timeout': int(wait_timeout) if str(wait_timeout).isdigit() else wait_timeout,
                        'long_query_time': float(long_query_time) if str(long_query_time).replace('.', '', 1).isdigit() else long_query_time,
                        'innodb_buffer_pool_reads': bp_reads,
                        'innodb_buffer_pool_read_requests': bp_read_reqs,
                        'innodb_buffer_pool_hit_ratio': round(bp_hit_ratio, 2) if isinstance(bp_hit_ratio, (int, float)) else None,
                        'connection_pressure_pct': round(conn_pressure, 2) if isinstance(conn_pressure, (int, float)) else None,
                        'version': version,
                        'uptime_seconds': uptime_s,
                        'memory_pct': mem_pct,
                        'disk_pct': disk_pct,
                    }
                }
                return True, result, "OK"
            finally:
                conn.close()
        except Exception as e:
            logger.error(f"采集配置失败(实例ID={getattr(inst, 'id', None)}): {e}")
            return False, {}, f"连接或查询失败: {e}"


class DeepSeekConfigAdvisor:
    """调用 DeepSeek 生成配置优化建议；失败则回退到规则建议"""

    def __init__(self):
        # 使用默认值，延迟从 Flask 配置加载，避免无应用上下文时报错
        self.enabled = True
        self.base_url = "https://api.deepseek.com"
        self.api_key = None
        self.model = "deepseek-chat"
        self.timeout = 30
        self._config_loaded = False
        
    def _ensure_config(self):
        if self._config_loaded:
            return
        try:
            if has_app_context():
                cfg = current_app.config
                self.enabled = cfg.get("LLM_ENABLED", self.enabled)
                self.base_url = cfg.get("DEEPSEEK_BASE_URL", self.base_url)
                self.api_key = cfg.get("DEEPSEEK_API_KEY", self.api_key)
                self.model = cfg.get("DEEPSEEK_MODEL", self.model)
                self.timeout = cfg.get("DEEPSEEK_TIMEOUT", self.timeout)
            else:
                # 环境变量兜底
                self.enabled = os.getenv("LLM_ENABLED", "1") != "0"
                self.base_url = os.getenv("DEEPSEEK_BASE_URL", self.base_url)
                self.api_key = os.getenv("DEEPSEEK_API_KEY", self.api_key)
                self.model = os.getenv("DEEPSEEK_MODEL", self.model)
                self.timeout = int(os.getenv("DEEPSEEK_TIMEOUT", str(self.timeout)))
        except Exception:
            pass
        finally:
            self._config_loaded = True

    def _call_llm(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        import requests
        self._ensure_config()
        if not (self.enabled and self.api_key):
            return None
        try:
            url = f"{self.base_url}/v1/chat/completions"
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            content = (data.get('choices', [{}])[0].get('message', {}) or {}).get('content', '').strip()
            try:
                return json.loads(content)
            except Exception:
                start = content.find('{')
                end = content.rfind('}')
                if start != -1 and end != -1 and end > start:
                    try:
                        return json.loads(content[start:end+1])
                    except Exception:
                        return None
                return None
        except Exception:
            return None

    def advise(self, collected: Dict[str, Any]) -> Dict[str, Any]:
        raw = collected.get('raw', {})
        prompt = (
            "你是资深MySQL DBA。根据以下实例配置信息与运行状态，给出配置优化建议列表."\
            "必须严格输出JSON，格式：{"\
            "\"configItems\":[{"\
            "\"parameter\":string,\"category\":string,\"currentValue\":string,\"recommendedValue\":string,\"status\":\"success|warning|error\",\"impact\":\"高|中等|低|无\",\"description\":string,\"reason\":string}]}。"\
            "仅返回JSON，不要任何解释。\n\n"
            f"【实例数据】:\n{json.dumps(raw, ensure_ascii=False)}\n"
        )
        # 新增：融合慢日志摘要（若可用）
        slowlog_summary = collected.get('slowlogSummary')
        if slowlog_summary:
            try:
                import json as _json
                prompt = prompt + f"\n【慢日志摘要】:\n{_json.dumps(slowlog_summary, ensure_ascii=False)}\n"
            except Exception:
                pass
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "你是一个只返回JSON的MySQL配置优化器。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 1000,
        }
        obj = self._call_llm(payload)
        if obj and isinstance(obj, dict) and isinstance(obj.get('configItems'), list):
            items = obj['configItems']
        else:
            items = self._fallback_rules(raw)

        # 统一“慢查询日志”项，使用采集到的真实值覆盖，避免LLM误判导致前端显示错误
        slow = raw.get('slow_query_log') or 'OFF'  # 统一为 'ON'/'OFF'
        updated = False
        for it in items:
            if it.get('parameter') == 'slow_query_log':
                it['currentValue'] = slow
                it['recommendedValue'] = 'ON'
                it['status'] = 'warning' if slow != 'ON' else 'success'
                it['impact'] = '低' if slow != 'ON' else '无'
                it['description'] = it.get('description') or '慢查询日志开关'
                it['reason'] = '建议开启慢查询日志以便持续监控与优化' if slow != 'ON' else '已开启'
                updated = True
                break
        if not updated:
            items.append({
                'parameter': 'slow_query_log',
                'category': '日志配置',
                'currentValue': slow,
                'recommendedValue': 'ON',
                'status': 'warning' if slow != 'ON' else 'success',
                'impact': '低' if slow != 'ON' else '无',
                'description': '慢查询日志开关',
                'reason': '建议开启慢查询日志以便持续监控与优化' if slow != 'ON' else '已开启'
            })

        # 计算汇总
        total = len(items)
        need = len([i for i in items if i.get('status') in ('warning', 'error')])
        high = len([i for i in items if i.get('impact') == '高'])
        medium = len([i for i in items if i.get('impact') == '中等'])
        low = len([i for i in items if i.get('impact') == '低'])
        # 简单打分：100- (error*15 + warning*7)
        score = max(0, 100 - (len([i for i in items if i.get('status') == 'error']) * 15 + len([i for i in items if i.get('status') == 'warning']) * 7))

        # 补充key字段供前端Table使用
        for idx, it in enumerate(items, start=1):
            it['key'] = str(idx)

        return {
            'configItems': items,
            'optimizationSummary': {
                'totalItems': total,
                'needOptimization': need,
                'highImpact': high,
                'mediumImpact': medium,
                'lowImpact': low,
                'score': score
            }
        }

    def _fallback_rules(self, raw: Dict[str, Any]) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        max_conn = int(raw.get('max_connections') or 0)
        threads = int(raw.get('threads_connected') or 0)
        ibp = raw.get('innodb_buffer_pool_size')
        ibp_h = raw.get('innodb_buffer_pool_size_h')
        slow = raw.get('slow_query_log')
        wait_timeout = raw.get('wait_timeout')
        lqt = raw.get('long_query_time')
        try:
            lqt_val = float(lqt)
        except Exception:
            lqt_val = None
        bp_hit = raw.get('innodb_buffer_pool_hit_ratio')
        try:
            bp_hit_val = float(bp_hit) if bp_hit is not None else None
        except Exception:
            bp_hit_val = None
        conn_pressure_pct = raw.get('connection_pressure_pct')
        try:
            conn_pressure_val = float(conn_pressure_pct) if conn_pressure_pct is not None else None
        except Exception:
            conn_pressure_val = None

        # 新增：更多原始值
        ibp_instances = int(raw.get('innodb_buffer_pool_instances') or 0)
        log_file_size = int(raw.get('innodb_log_file_size') or 0)
        log_file_size_h = raw.get('innodb_log_file_size_h') or str(raw.get('innodb_log_file_size') or '')
        log_files_in_group = int(raw.get('innodb_log_files_in_group') or 0)
        redo_total = int(raw.get('innodb_redo_total_bytes') or 0)
        redo_total_h = raw.get('innodb_redo_total_h') or ''
        threads_running = int(raw.get('threads_running') or 0)
        row_lock_time = int(raw.get('innodb_row_lock_time') or 0)
        row_lock_waits = int(raw.get('innodb_row_lock_waits') or 0)
        avg_lock_ms = float(raw.get('innodb_row_lock_time_avg_ms') or 0)

        # 连接数建议
        if max_conn > 0:
            ratio = threads / max_conn if max_conn else 0
            status = 'warning' if ratio >= 0.7 else 'success'
            impact = '中等' if ratio >= 0.7 else '无'
            rec = str(int(max_conn * 1.25)) if ratio >= 0.7 else str(max_conn)
            reason = f"当前连接 {threads}/{max_conn}，使用率 {ratio*100:.1f}%" if max_conn else "无法获取最大连接数"
            items.append({
                'parameter': 'max_connections',
                'category': '连接配置',
                'currentValue': str(max_conn),
                'recommendedValue': rec,
                'status': status,
                'impact': impact,
                'description': '最大连接数',
                'reason': reason
            })

        # 缓冲池建议
        if isinstance(ibp, int) and ibp > 0:
            # 简化策略：如果内存使用率较高且缓冲池 < 12GB，则建议提升到 max(ibp*1.5, 12GB) 的近似
            mem_pct = raw.get('memory_pct') or 0
            status = 'warning' if (isinstance(mem_pct, (int, float)) and mem_pct >= 60) else 'success'
            impact = '高' if status == 'warning' else '无'
            target = max(ibp * 3 // 2, 12 * 1024**3) if status == 'warning' else ibp
            items.append({
                'parameter': 'innodb_buffer_pool_size',
                'category': '缓存配置',
                'currentValue': ibp_h,
                'recommendedValue': _human_bytes(target),
                'status': status,
                'impact': impact,
                'description': 'InnoDB缓冲池大小',
                'reason': f"当前内存使用率偏高({mem_pct}%)，建议适当增大缓冲池以降低磁盘I/O" if status == 'warning' else '当前配置合理'
            })

        # 新增：缓冲池实例数建议
        if isinstance(ibp, int) and ibp > 0:
            # 经验规则：缓冲池 >= 1GB 时建议按每 ~1GB 一个实例，最大 8
            suggested = min(8, max(1, ibp // (1024**3)))
            warn = (ibp >= 1024**3 and (ibp_instances or 1) < max(2, suggested))
            items.append({
                'parameter': 'innodb_buffer_pool_instances',
                'category': '缓存配置',
                'currentValue': str(ibp_instances or 1),
                'recommendedValue': str(max(2, suggested)) if warn else str(ibp_instances or 1),
                'status': 'warning' if warn else 'success',
                'impact': '中等' if warn else '无',
                'description': '缓冲池实例数',
                'reason': '缓冲池 >= 1GB 建议增加实例数以降低并发争用（每~1GB约1个，最多8）' if warn else '当前配置合理'
            })

        # 新增：重做日志大小建议（总容量判断）
        if log_file_size > 0 and log_files_in_group > 0:
            total = redo_total
            recommend_total = 2 * 1024**3  # 2GB 作为保守建议
            warn = total < 1 * 1024**3  # 小于 1GB 认为偏小
            items.append({
                'parameter': 'innodb_log_file_size',
                'category': '日志配置',
                'currentValue': f"{log_file_size_h} x {log_files_in_group} = {redo_total_h}",
                'recommendedValue': '1GB~2GB（总容量）',
                'status': 'warning' if warn else 'success',
                'impact': '中等' if warn else '无',
                'description': '重做日志文件大小',
                'reason': '总重做日志容量偏小，可能导致频繁 checkpoint 与写放大，建议提升到至少 1GB，总计约 2GB' if warn else '当前容量合理'
            })

        # 新增：运行线程过高提示
        if max_conn > 0 and threads_running >= max(64, int(max_conn * 0.5)):
            items.append({
                'parameter': 'Threads_running',
                'category': '连接/并发',
                'currentValue': str(threads_running),
                'recommendedValue': f"<= {max(10, int(max_conn*0.25))}",
                'status': 'warning',
                'impact': '高',
                'description': '活跃运行线程数',
                'reason': '活跃线程占比较高，可能存在慢SQL或资源竞争；建议结合慢日志排查与索引优化，必要时临时上调 max_connections 缓解'
            })

        # 新增：连接池压力
        if conn_pressure_val is not None:
            items.append({
                'parameter': 'connection_pressure',
                'category': '连接/并发',
                'currentValue': f"{threads}/{max_conn if max_conn else '?'} ({conn_pressure_val:.1f}%)",
                'recommendedValue': '<= 80%（通过限流、连接池、复用连接等手段）',
                'status': 'warning' if conn_pressure_val >= 80 else 'success',
                'impact': '中等' if conn_pressure_val >= 80 else '无',
                'description': '连接池压力',
                'reason': '连接占用偏高可能导致队列堆积与响应变慢，建议优化连接池/限流/复用连接'
            })

        # 新增：InnoDB 行锁等待
        if row_lock_waits >= 100 or avg_lock_ms >= 10:
            items.append({
                'parameter': 'InnoDB_row_lock',
                'category': '锁与事务',
                'currentValue': f"等待:{row_lock_waits} 次 / 总时长:{row_lock_time}ms / 均值:{avg_lock_ms:.1f}ms",
                'recommendedValue': '优化索引/缩短事务/分批更新',
                'status': 'warning',
                'impact': '中等',
                'description': '行锁等待情况',
                'reason': '行锁等待较多或耗时较长，建议检查热点表与缺失索引，避免大事务与长事务'
            })

        # 新增：缓冲池命中率
        if bp_hit_val is not None:
            warn = bp_hit_val < 95.0
            items.append({
                'parameter': 'innodb_buffer_pool_hit_ratio',
                'category': '缓存配置',
                'currentValue': f"{bp_hit_val:.2f}%" if bp_hit_val is not None else '未知',
                'recommendedValue': '>= 95%（增加缓冲池/优化索引/减少全表扫描）',
                'status': 'warning' if warn else 'success',
                'impact': '高' if bp_hit_val < 90 else ('中等' if warn else '无'),
                'description': 'InnoDB缓冲池命中率',
                'reason': '命中率偏低意味着更多磁盘I/O，建议适当增大缓冲池、优化SQL与索引以提升命中率' if warn else '命中率良好'
            })

        # 新增：long_query_time（慢SQL阈值）
        if lqt_val is not None:
            warn = lqt_val > 1.0
            items.append({
                'parameter': 'long_query_time',
                'category': '日志配置',
                'currentValue': f"{lqt_val:.2f}s",
                'recommendedValue': '1.0s（OLTP常用阈值，可视业务调优）',
                'status': 'warning' if warn else 'success',
                'impact': '低' if warn else '无',
                'description': '慢查询阈值',
                'reason': '阈值较高可能漏报慢SQL，通常建议设置在约1秒（或更低）以覆盖更多慢请求' if warn else '当前阈值合理'
            })

        # 慢日志
        items.append({
            'parameter': 'slow_query_log',
            'category': '日志配置',
            'currentValue': slow or 'OFF',
            'recommendedValue': 'ON',
            'status': 'warning' if (slow or 'OFF') != 'ON' else 'success',
            'impact': '低' if (slow or 'OFF') != 'ON' else '无',
            'description': '慢查询日志开关',
            'reason': '建议开启慢查询日志以便持续监控与优化' if (slow or 'OFF') != 'ON' else '已开启'
        })

        # wait_timeout
        try:
            wt = int(wait_timeout)
        except Exception:
            wt = 0
        if wt:
            items.append({
                'parameter': 'wait_timeout',
                'category': '连接配置',
                'currentValue': str(wt),
                'recommendedValue': '3600' if wt > 7200 else str(wt),
                'status': 'warning' if wt > 7200 else 'success',
                'impact': '中等' if wt > 7200 else '无',
                'description': '连接空闲超时',
                'reason': '超时时间过长可能导致连接堆积' if wt > 7200 else '当前配置合理'
            })

        return items


# 全局实例
config_collector = InstanceConfigCollector()
config_advisor = DeepSeekConfigAdvisor()