import threading
import time
from datetime import datetime
from flask_socketio import emit
from .. import db, socketio
from ..models import Instance


class InstanceMonitorService:
    """实例状态监控服务"""
    
    def __init__(self):
        self.monitoring = False
        self.monitor_thread = None
        self.check_interval = 5  # 5秒检查一次
    
    def start_monitoring(self, app=None):
        """启动监控服务"""
        if not self.monitoring:
            self.monitoring = True
            self.app = app  # 保存应用实例
            self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self.monitor_thread.start()
            print("实例监控服务已启动")
    
    def stop_monitoring(self):
        """停止监控服务"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1)
        print("实例监控服务已停止")
    
    def _monitor_loop(self):
        """监控循环"""
        while self.monitoring:
            try:
                # 使用保存的应用实例
                if self.app:
                    with self.app.app_context():
                        self._check_all_instances()
                else:
                    print('无法获取Flask应用实例，跳过本次检查')
                    
                time.sleep(self.check_interval)
            except Exception as e:
                print(f"监控循环出错: {e}")
                time.sleep(self.check_interval)
    
    def _check_all_instances(self):
        """检查所有实例状态"""
        instances = Instance.query.filter_by(is_monitoring=True).all()
        
        for instance in instances:
            old_status = instance.status
            new_status = self._check_instance_status(instance)
            
            if old_status != new_status:
                # 状态发生变化，更新数据库并推送WebSocket事件
                instance.update_status(new_status)
                self._emit_status_change(instance)
                print(f"实例 {instance.instance_name} 状态变化: {old_status} -> {new_status}")
            else:
                # 状态未变化，仅更新检查时间
                instance.last_check_time = datetime.utcnow()
                db.session.commit()
    
    def _check_instance_status(self, instance):
        """检查单个实例状态"""
        try:
            if instance.is_connection_available():
                return 'running'
            else:
                return 'error'
        except Exception as e:
            print(f"检查实例 {instance.instance_name} 状态时出错: {e}")
            return 'error'
    
    def _emit_status_change(self, instance):
        """推送状态变化事件"""
        socketio.emit('status_change', {
            'instanceId': instance.id,
            'instanceName': instance.instance_name,
            'status': instance.status,
            'lastCheckTime': instance.last_check_time.strftime('%Y-%m-%d %H:%M:%S'),
            'timestamp': datetime.utcnow().isoformat()
        }, namespace='/')
    
    def force_check_instance(self, instance_id):
        """强制检查指定实例状态"""
        try:
            from ..models import Instance
            from .. import db
            
            instance = Instance.query.get(instance_id)
            if not instance:
                return None
            
            # 检查连接状态
            is_available = instance.is_connection_available()
            new_status = 'running' if is_available else 'error'
            
            # 更新状态
            old_status = instance.status
            instance.update_status(new_status)
            db.session.commit()
            
            # 如果状态发生变化，推送WebSocket事件
            if old_status != new_status:
                self._emit_status_change(instance)
            
            return instance.to_dict()
            
        except Exception as e:
            print(f'强制检查实例 {instance_id} 时出错: {e}')
            return None


# 全局监控服务实例
monitor_service = InstanceMonitorService()