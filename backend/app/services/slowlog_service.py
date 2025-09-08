import logging
import re
from typing import Any, Dict, List, Tuple, Optional

try:
    import pymysql
except ImportError:
    pymysql = None


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

    def analyze(self, inst: Instance, top: int = 20, min_avg_ms: int = 10, tail_kb: int = 256) -> Tuple[bool, Dict[str, Any], str]:
        """综合使用 performance_schema 与 慢日志表 抽样（不再使用 LOAD_FILE）。
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
                    has_table_output = any(p.strip() == 'TABLE' for p in log_output_norm.split(',') if p.strip())

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

                    # 2) TABLE 抽样（来自 mysql.slow_log，可选；不再使用 LOAD_FILE）
                    if slow_query_log and has_table_output:
                        try:
                            cur.execute(
                                "SELECT start_time, db, query_time, lock_time, rows_sent, rows_examined, sql_text "
                                "FROM mysql.slow_log ORDER BY start_time DESC LIMIT %s",
                                (10,)  # 抽样最近 10 条
                            )
                            trows = cur.fetchall() or []

                            def _sec(val):
                                try:
                                    return float(val.total_seconds()) if hasattr(val, 'total_seconds') else float(val or 0)
                                except Exception:
                                    return 0.0

                            def _s(val):
                                if val is None:
                                    return ''
                                try:
                                    import datetime as _dt
                                    if isinstance(val, (_dt.datetime,)):
                                        return val.strftime('%Y-%m-%d %H:%M:%S')
                                except Exception:
                                    pass
                                if isinstance(val, (bytes, bytearray)):
                                    try:
                                        return val.decode('utf-8', errors='ignore')
                                    except Exception:
                                        return ''
                                return str(val)

                            file_samples = []
                            for r in trows:
                                file_samples.append({
                                    'time': _s(r.get('start_time')),
                                    'db': _s(r.get('db')),
                                    'query_time_ms': round(_sec(r.get('query_time')) * 1000, 2),
                                    'lock_time_ms': round(_sec(r.get('lock_time')) * 1000, 2),
                                    'rows_sent': int(r.get('rows_sent') or 0),
                                    'rows_examined': int(r.get('rows_examined') or 0),
                                    'sql': _s(r.get('sql_text'))
                                })
                        except Exception as e:
                            logger.info(f"读取慢日志表抽样失败: {e}")
                            warnings.append('无法从 mysql.slow_log 抽样（可能权限不足或该表不可用）')
                    elif slow_query_log and not has_table_output:
                        warnings.append('慢日志未以 TABLE 输出（当前 log_output=%s），跳过表抽样' % log_output_raw)

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
        # 为兼容性，尽量只取通用字段；在SQL侧按“平均耗时”降序排序，并用阈值过滤，避免先按总耗时LIMIT导致全部被后置过滤清空
        sql = (
            "SELECT schema_name, digest, digest_text, count_star, "
            "       sum_timer_wait, sum_rows_examined, sum_rows_sent "
            "  FROM performance_schema.events_statements_summary_by_digest "
            " WHERE (schema_name IS NULL OR schema_name NOT IN ('mysql','sys','performance_schema','information_schema')) "
            "   AND sum_timer_wait >= (%s * 1000000000) * GREATEST(count_star, 1) "
            " ORDER BY (sum_timer_wait / GREATEST(count_star, 1)) DESC LIMIT %s"
        )
        try:
            cur.execute(sql, (int(min_avg_ms), int(top)))
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
            # 保险起见再做一次阈值校验（SQL已过滤）
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


    # 新增：从 mysql.slow_log 按条件分页查询
    def list_from_table(
        self,
        inst: Instance,
        page: int = 1,
        page_size: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, Dict[str, Any], str]:
        if not inst:
            return False, {}, "实例不存在"
        if (inst.db_type or '').strip() != 'MySQL':
            return False, {}, "仅支持MySQL实例"
        try:
            conn = self._connect(inst)
            try:
                with conn.cursor() as cur:
                    # 读取变量，判定 log_output 是否包含 TABLE
                    cur.execute(
                        """
                        SHOW GLOBAL VARIABLES WHERE Variable_name IN ('slow_query_log','log_output')
                        """
                    )
                    vr = cur.fetchall() or []
                    vmap = {r['Variable_name']: r['Value'] for r in vr}
                    log_output = str(vmap.get('log_output') or '').strip().upper()
                    has_table = any(p.strip() == 'TABLE' for p in log_output.split(',') if p.strip())
                    overview = {
                        'slow_query_log': str(vmap.get('slow_query_log') or ''),
                        'log_output': str(vmap.get('log_output') or ''),
                    }
                    if not has_table:
                        return False, {'overview': overview}, "仅支持 log_output 包含 TABLE 的数据库"

                    # 动态构造查询
                    filters = filters or {}
                    where_clauses: List[str] = []
                    params: List[Any] = []

                    keyword = (filters.get('keyword') or '').strip()
                    if keyword:
                        where_clauses.append("sql_text LIKE %s")
                        params.append(f"%{keyword}%")

                    user_host = (filters.get('user_host') or '').strip()
                    if user_host:
                        where_clauses.append("user_host LIKE %s")
                        params.append(f"%{user_host}%")

                    dbname = (filters.get('db') or '').strip()
                    if dbname:
                        where_clauses.append("db = %s")
                        params.append(dbname)

                    start_time = (filters.get('start_time') or '').strip()
                    if start_time:
                        where_clauses.append("start_time >= %s")
                        params.append(start_time)

                    end_time = (filters.get('end_time') or '').strip()
                    if end_time:
                        where_clauses.append("start_time <= %s")
                        params.append(end_time)

                    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

                    # 统计总数
                    count_sql = f"SELECT COUNT(*) AS cnt FROM mysql.slow_log{where_sql}"
                    cur.execute(count_sql, params)
                    count_row = cur.fetchone() or {}
                    total = int(count_row.get('cnt') or 0)

                    # 分页数据
                    try:
                        page = max(1, int(page))
                    except Exception:
                        page = 1
                    try:
                        page_size = max(1, min(100, int(page_size)))
                    except Exception:
                        page_size = 10
                    offset = (page - 1) * page_size

                    data_sql = (
                        "SELECT start_time, user_host, db, query_time, lock_time, rows_sent, rows_examined, sql_text "
                        "FROM mysql.slow_log"
                        f"{where_sql} "
                        "ORDER BY start_time DESC LIMIT %s OFFSET %s"
                    )
                    cur.execute(data_sql, params + [page_size, offset])
                    rows = cur.fetchall() or []

                    # 安全转换时间为秒（兼容 datetime.timedelta/TIME 类型）
                    def _sec(val):
                        try:
                            return float(val.total_seconds()) if hasattr(val, 'total_seconds') else float(val or 0)
                        except Exception:
                            return 0.0

                    # 统一将文本/时间字段转为可 JSON 序列化的字符串
                    def _s(val):
                        if val is None:
                            return ''
                        try:
                            import datetime as _dt
                            if isinstance(val, (_dt.datetime,)):
                                return val.strftime('%Y-%m-%d %H:%M:%S')
                        except Exception:
                            pass
                        if isinstance(val, (bytes, bytearray)):
                            try:
                                return val.decode('utf-8', errors='ignore')
                            except Exception:
                                return ''
                        return str(val)

                    items: List[Dict[str, Any]] = []
                    for r in rows:
                        items.append({
                            'start_time': _s(r.get('start_time')),
                            'user_host': _s(r.get('user_host')),
                            'db': _s(r.get('db')),
                            'query_time': _sec(r.get('query_time')),
                            'lock_time': _sec(r.get('lock_time')),
                            'rows_sent': int(r.get('rows_sent') or 0),
                            'rows_examined': int(r.get('rows_examined') or 0),
                            'sql_text': _s(r.get('sql_text'))
                        })
                    data = {
                        'overview': overview,
                        'items': items,
                        'total': total,
                        'page': page,
                        'page_size': page_size,
                    }
                    return True, data, 'OK'
            finally:
                conn.close()
        except Exception as e:
            logger.error(f"查询慢日志表失败(实例ID={getattr(inst, 'id', None)}): {e}")
            return False, {}, f"连接或查询失败: {e}"


slowlog_service = SlowLogService()