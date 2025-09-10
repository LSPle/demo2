from datetime import datetime
from . import db
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Instance(db.Model):
    __tablename__ = 'instances'

    id = db.Column(db.Integer, primary_key=True)
    instance_name = db.Column(db.String(128), nullable=False)
    host = db.Column(db.String(255), nullable=False)
    port = db.Column(db.Integer, nullable=False, default=3306)
    username = db.Column(db.String(128), nullable=True)
    password = db.Column(db.String(255), nullable=True)  # 注意：仅用于演示，生产请勿明文存储
    db_type = db.Column(db.String(64), nullable=False, default='MySQL')
    status = db.Column(db.String(32), nullable=False, default='running')  # running|error
    cpu_usage = db.Column(db.Integer, nullable=False, default=0)
    memory_usage = db.Column(db.Integer, nullable=False, default=0)
    storage = db.Column(db.String(128), nullable=True)
    last_check_time = db.Column(db.DateTime, default=datetime.utcnow)
    is_monitoring = db.Column(db.Boolean, nullable=False, default=True)
    connection_timeout = db.Column(db.Integer, nullable=False, default=5)  # 连接超时时间（秒）
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        # 返回前端预期的驼峰命名字段
        return {
            'id': self.id,
            'instanceName': self.instance_name,
            'host': self.host,
            'port': self.port,
            'username': self.username,
            'password': self.password,
            'dbType': self.db_type,
            'status': self.status,
            'cpuUsage': self.cpu_usage,
            'memoryUsage': self.memory_usage,
            'storage': self.storage,
            'lastCheckTime': self.last_check_time.strftime('%Y-%m-%d %H:%M:%S') if self.last_check_time else None,
            'isMonitoring': self.is_monitoring,
            'connectionTimeout': self.connection_timeout,
            'createTime': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
        }
    
    def update_status(self, new_status, check_time=None):
        """更新实例状态"""
        self.status = new_status
        self.last_check_time = check_time or datetime.utcnow()
        db.session.commit()
    
    def is_connection_available(self):
        """检查实例连接是否可用（使用真正的数据库连接检测）"""
        from .services.db_validator import db_validator
        try:
            is_ok, msg = db_validator.validate_connection(
                db_type=self.db_type,
                host=self.host,
                port=self.port,
                username=self.username or '',
                password=self.password or ''
            )
            return is_ok
        except Exception as e:
            print(f"检查实例 {self.instance_name} 连接时出错: {e}")
            return False