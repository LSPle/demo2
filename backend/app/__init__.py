import os
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from .config import Config

# Initialize extensions

db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO()


def create_app():
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(Config)

    # Initialize extensions with the app
    db.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app, 
                      cors_allowed_origins="*", 
                      async_mode='threading',
                      transports=['polling'],
                      allow_upgrades=False,
                      ping_timeout=60,
                      ping_interval=25,
                      logger=False,
                      engineio_logger=False)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.health import health_bp
    from .routes.instances import instances_bp
    from .routes.metrics import metrics_bp
    from .routes.sql_analyze import sql_analyze_bp
    from .routes.config_optimize import config_opt_bp
    from .routes.arch_optimize import arch_opt_bp
    from .routes.slowlog import slowlog_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(instances_bp, url_prefix='/api')
    app.register_blueprint(metrics_bp, url_prefix='/api')
    app.register_blueprint(sql_analyze_bp, url_prefix='/api')
    app.register_blueprint(config_opt_bp, url_prefix='/api')
    app.register_blueprint(arch_opt_bp, url_prefix='/api')
    app.register_blueprint(slowlog_bp, url_prefix='/api')
    
    # 注册WebSocket事件处理器
    from .routes import websocket

    # Serve React build files
    build_dir = os.path.join(os.path.dirname(os.path.dirname(app.root_path)), 'build')
    # Point Flask default static route to React build dir so /static/* works
    app.static_folder = os.path.join(build_dir, 'static')
    app.static_url_path = '/static'

    @app.route('/')
    def serve_react_app():
        return send_from_directory(build_dir, 'index.html')

    @app.route('/<path:filename>')
    def serve_static_files(filename):
        full_path = os.path.join(build_dir, filename)
        if os.path.exists(full_path):
            return send_from_directory(build_dir, filename)
        # For React Router client-side routes
        return send_from_directory(build_dir, 'index.html')

    # Create database tables if they don't exist
    with app.app_context():
        db.create_all()
        
        # 在应用上下文中启动实例监控服务
        from .services.monitor_service import monitor_service
        monitor_service.start_monitoring(app)

    return app