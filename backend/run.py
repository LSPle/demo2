import os
from dotenv import load_dotenv
from app import create_app, socketio

load_dotenv()

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))  # 修改默认端口为5001以匹配前端配置
    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    socketio.run(app, host="0.0.0.0", port=port, debug=debug, allow_unsafe_werkzeug=True)