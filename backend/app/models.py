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
    status = db.Column(db.String(32), nullable=False, default='running')  # running|warning|error
    cpu_usage = db.Column(db.Integer, nullable=False, default=0)
    memory_usage = db.Column(db.Integer, nullable=False, default=0)
    storage = db.Column(db.String(128), nullable=True)
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
            'createTime': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
        }