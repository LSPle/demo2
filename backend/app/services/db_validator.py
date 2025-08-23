import socket
import logging
from typing import Tuple

try:
    import pymysql
except ImportError:  # 兜底，即使意外缺失也不影响其他类型的TCP探活
    pymysql = None

logger = logging.getLogger(__name__)


class DatabaseValidator:
    """数据库连通性校验器：优先使用驱动（MySQL），否则进行TCP端口探活"""

    def __init__(self):
        self.timeout = 10  # 秒

    def _tcp_probe(self, host: str, port: int) -> Tuple[bool, str]:
        try:
            with socket.create_connection((host, port), timeout=self.timeout):
                return True, "TCP端口可达"
        except Exception as e:
            return False, f"TCP连接失败: {e}"

    def validate_mysql(self, host: str, port: int, username: str = None, password: str = None) -> Tuple[bool, str]:
        """验证MySQL连接：若驱动不可用则退化为TCP探活"""
        if not pymysql:
            return self._tcp_probe(host, port)
        try:
            conn = pymysql.connect(
                host=host,
                port=port,
                user=username or '',
                password=password or '',
                charset='utf8mb4',
                connect_timeout=self.timeout,
                read_timeout=self.timeout,
                write_timeout=self.timeout
            )
            conn.ping()
            conn.close()
            return True, "MySQL连接成功"
        except Exception as e:
            return False, f"MySQL连接失败: {e}"

    def validate_connection(self, db_type: str, host: str, port: int, username: str = None, password: str = None) -> Tuple[bool, str]:
        """根据数据库类型验证连接：MySQL用驱动，其它类型做通用TCP探活"""
        type_key = (db_type or '').strip()
        if type_key == 'MySQL':
            return self.validate_mysql(host, port, username, password)
        # 其他类型：Redis/PostgreSQL/MongoDB/Oracle 统一TCP探活
        return self._tcp_probe(host, port)


# 全局实例
db_validator = DatabaseValidator()