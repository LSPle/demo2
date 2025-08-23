import logging
import re
from typing import Any, Dict, List, Tuple, Optional

try:
    import pymysql
except ImportError:
    pymysql = None

from .prometheus_service import prometheus_service  # noqa: F401  # 可能未来扩展用到
from ..models import Instance

logger = logging.getLogger(__name__)


class SlowLogService:
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

    def analyze(self, inst: Instance, top: int = 20, min_avg_ms: int = 100, tail_kb: int = 256) -> Tuple[bool, Dict[str, Any], str]:
        """综合使用 performance_schema 与 慢日志文件 抽样。
        返回 (ok, data, msg)
        """
        if not inst:
            return False, {}, "实例不存在"
        if (inst.db_type or '').strip() != 'MySQL':
            return False, {}, "仅支持MySQL实例"
        try:
            conn = self._connect(inst)
            try:
                overview: Dict[str, Any] = {}
                ps_top: List[Dict[str, Any]] = []
                file_samples: List[Dict[str, Any]] = []
                warnings: List[str] = []

                with conn.cursor() as cur:
                    # 基本变量
                    cur.execute("""
                        SHOW GLOBAL VARIABLES WHERE Variable_name IN (
                          'performance_schema', 'long_query_time', 'slow_query_log', 'log_output', 'slow_query_log_file'
                        )
                    """)
                    rows = cur.fetchall() or []
                    vars_map = {r['Variable_name']: r['Value'] for r in rows}

                    # 规范化与健壮化处理
                    ps_raw = str(vars_map.get('performance_schema', '')).strip().lower()
                    performance_schema_on = ps_raw in ('1', 'on', 'yes', 'true')

                    slow_raw = str(vars_map.get('slow_query_log', '')).strip().lower()
                    slow_query_log = slow_raw in ('1', 'on', 'yes', 'true')

                    long_query_time = vars_map.get('long_query_time')

                    log_output_raw = str(vars_map.get('log_output') or '')
                    log_output_norm = log_output_raw.strip().upper()
                    # 支持 FILE, TABLE 或组合 'FILE,TABLE'
                    has_file_output = any(p.strip() == 'FILE' for p in log_output_norm.split(',') if p.strip())

                    slow_file = str(vars_map.get('slow_query_log_file') or '').strip()

                    overview = {
                        'performance_schema': 'ON' if performance_schema_on else 'OFF',
                        'slow_query_log': 'ON' if slow_query_log else 'OFF',
                        'long_query_time': float(long_query_time) if str(long_query_time).replace('.', '', 1).isdigit() else long_query_time,
                        'log_output': log_output_raw,
                        'slow_query_log_file': slow_file or ''
                    }

                    # 1) P_S Top Digest
                    if performance_schema_on:
                        ps_top = self._collect_ps_top(cur, top=top, min_avg_ms=min_avg_ms)
                    else:
                        warnings.append('performance_schema 未开启，无法生成 Top SQL 指纹统计')

                    # 2) FILE 抽样（可选）
                    if slow_query_log and has_file_output and slow_file:
                        ok, samples, warn = self._sample_slowlog_file(cur, slow_file, tail_kb)
                        if ok:
                            file_samples = samples
                        if warn:
                            warnings.append(warn)
                    elif slow_query_log and not has_file_output:
                        warnings.append('慢日志未以 FILE 输出（当前 log_output=%s），跳过文件抽样' % log_output_raw)
                    elif slow_query_log and has_file_output and not slow_file:
                        warnings.append('slow_query_log_file 未配置或不可见，无法进行文件抽样（当前 log_output=%s）' % log_output_raw)

                data = {
                    'overview': overview,
                    'ps_top': ps_top,
                    'file_samples': file_samples,
                    'warnings': warnings
                }
                return True, data, 'OK'
            finally:
                conn.close()
        except Exception as e:
            logger.error(f"慢日志分析失败(实例ID={getattr(inst, 'id', None)}): {e}")
            return False, {}, f"连接或查询失败: {e}"

    def _collect_ps_top(self, cur, top: int, min_avg_ms: int) -> List[Dict[str, Any]]:
        # 为兼容性，尽量只取通用字段
        sql = (
            "SELECT schema_name, digest, digest_text, count_star, "
            "       sum_timer_wait, sum_rows_examined, sum_rows_sent "
            "  FROM performance_schema.events_statements_summary_by_digest "
            " WHERE schema_name IS NOT NULL AND schema_name NOT IN ('mysql','sys','performance_schema','information_schema') "
            " ORDER BY sum_timer_wait DESC LIMIT %s"
        )
        try:
            cur.execute(sql, (int(top),))
            rows = cur.fetchall() or []
        except Exception:
            # 某些版本字段名不同或表不可用
            return []

        def _ps_to_ms(timer_ps: Any, cnt: int) -> Tuple[float, float]:
            try:
                ps = int(timer_ps)
                total_ms = ps / 1_000_000_000.0  # 1e12 ps = 1s; 1e9 ps = 1ms
            except Exception:
                return 0.0, 0.0
            avg_ms = (total_ms / cnt) if cnt else 0.0
            return avg_ms, total_ms

        top_list: List[Dict[str, Any]] = []
        for r in rows:
            cnt = int(r.get('count_star') or 0)
            avg_ms, total_ms = _ps_to_ms(r.get('sum_timer_wait'), cnt)
            if avg_ms < float(min_avg_ms):
                continue
            rows_examined = int(r.get('sum_rows_examined') or 0)
            rows_sent = int(r.get('sum_rows_sent') or 0)
            re_avg = (rows_examined / cnt) if cnt else 0.0
            rs_avg = (rows_sent / cnt) if cnt else 0.0
            top_list.append({
                'schema': r.get('schema_name') or '',
                'digest': r.get('digest') or '',
                'query': (r.get('digest_text') or '')[:500],
                'count': cnt,
                'avg_latency_ms': round(avg_ms, 2),
                'total_latency_ms': round(total_ms, 2),
                'rows_examined_avg': round(re_avg, 1),
                'rows_sent_avg': round(rs_avg, 1),
            })
        return top_list

    def _sample_slowlog_file(self, cur, slow_file: str, tail_kb: int) -> Tuple[bool, List[Dict[str, Any]], Optional[str]]:
        # 使用 LOAD_FILE 读取文件尾部，依赖 FILE 权限与 secure_file_priv 设置
        try:
            cur.execute("SELECT LOAD_FILE(%s) AS content", (slow_file,))
            row = cur.fetchone()
            blob = row and row.get('content')
            if not blob:
                return False, [], 'LOAD_FILE 未返回内容，可能权限不足或 secure_file_priv 限制'
            if isinstance(blob, memoryview):
                blob = bytes(blob)
            try:
                data = blob[-tail_kb*1024:] if tail_kb > 0 else blob
            except Exception:
                data = blob
            try:
                text = data.decode('utf-8', errors='ignore')
            except Exception:
                text = str(data)
            samples = self._parse_slowlog_tail(text)
            return True, samples, None
        except Exception as e:
            logger.info(f"读取慢日志文件失败: {e}")
            return False, [], '无法通过 LOAD_FILE 读取慢日志文件（需要 FILE 权限，且受 secure_file_priv 影响）'

    def _parse_slowlog_tail(self, tail_text: str) -> List[Dict[str, Any]]:
        # 解析 MySQL 慢日志标准格式的若干条记录（从尾部截取，可能为半条，尽力而为）
        lines = tail_text.splitlines()
        entries: List[Dict[str, Any]] = []
        cur_entry: Dict[str, Any] = {}
        sql_buf: List[str] = []

        # 正则（允许行首与关键字周围存在空白字符，并兼容反引号数据库名）
        re_time = re.compile(r"^\s*#\s*Time:\s*(.+)")
        re_user = re.compile(r"^\s*#\s*User@Host:\s*(.+)")
        re_q = re.compile(r"^\s*#\s*Query_time:\s*([0-9.]+)\s+Lock_time:\s*([0-9.]+)\s+Rows_sent:\s*(\d+)\s+Rows_examined:\s*(\d+)")
        re_db = re.compile(r"^\s*use\s+`?([^`;]+)`?\s*;")
        re_setts = re.compile(r"^\s*SET\s+timestamp\s*=\s*\d+\s*;")

        def _flush_current():
            nonlocal cur_entry, sql_buf
            if cur_entry:
                sql = '\n'.join(sql_buf).strip()
                has_meaning = any([
                    bool(cur_entry.get('time')),
                    bool(cur_entry.get('user_host')),
                    cur_entry.get('query_time_ms') is not None,
                    bool(cur_entry.get('db')),
                ])
                if sql:
                    cur_entry['sql'] = sql[:2000]
                if sql or has_meaning:
                    entries.append(cur_entry)
            cur_entry = {}
            sql_buf = []

        for ln in lines:
            s = ln.lstrip()
            if s.startswith('# Time:') or s.startswith('#\tTime:'):
                _flush_current()
                m = re_time.match(s)
                cur_entry = {'time': m.group(1) if m else ''}
            elif s.startswith('# User@Host:') or s.startswith('#\tUser@Host:'):
                m = re_user.match(s)
                if m:
                    cur_entry['user_host'] = m.group(1)
            elif s.startswith('# Query_time:') or s.startswith('#\tQuery_time:'):
                m = re_q.match(s)
                if m:
                    try:
                        cur_entry['query_time_ms'] = round(float(m.group(1)) * 1000, 2)
                        cur_entry['lock_time_ms'] = round(float(m.group(2)) * 1000, 2)
                        cur_entry['rows_sent'] = int(m.group(3))
                        cur_entry['rows_examined'] = int(m.group(4))
                    except Exception:
                        pass
            elif re_db.match(s):
                cur_entry['db'] = re_db.match(s).group(1)
            elif re_setts.match(s):
                # ignore
                continue
            elif s.startswith('#'):
                # 其它注释行忽略
                continue
            else:
                # SQL 内容（保留原始行，避免丢失缩进和格式）
                if s.strip():
                    sql_buf.append(ln)

        _flush_current()

        # 只返回最后若干条
        if len(entries) > 10:
            entries = entries[-10:]
        return entries


slowlog_service = SlowLogService()