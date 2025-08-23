import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Prometheus configuration
    PROMETHEUS_BASE_URL = os.getenv("PROMETHEUS_BASE_URL", "http://192.168.112.128:9090")

    # Default to SQLite
    DB_TYPE = os.getenv("DB_TYPE", "sqlite")
    SQLITE_DB = os.getenv("SQLITE_DB", os.path.join(os.path.dirname(__file__), "..", "data", "app.db"))

    if DB_TYPE == "mysql":
        MYSQL_USER = os.getenv("MYSQL_USER", "root")
        MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
        MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
        MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
        MYSQL_DB = os.getenv("MYSQL_DB", "flask_app")
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}?charset=utf8mb4"
        )
    else:
        # SQLite URI (normalize path for Windows)
        _abs_path = os.path.abspath(SQLITE_DB)
        # 确保目录存在，避免 SQLite 无法创建数据库文件
        _dir = os.path.dirname(_abs_path)
        try:
            os.makedirs(_dir, exist_ok=True)
        except Exception:
            pass
        if os.name == 'nt':
            _abs_path = _abs_path.replace('\\', '/')
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{_abs_path}"

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    
    # DeepSeek API configuration
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
    DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    DEEPSEEK_TIMEOUT = int(os.getenv("DEEPSEEK_TIMEOUT", "30"))
    LLM_ENABLED = os.getenv("LLM_ENABLED", "true").lower() == "true"