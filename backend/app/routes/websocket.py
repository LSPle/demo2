from flask_socketio import emit, disconnect
from .. import socketio
from ..services.monitor_service import monitor_service
from ..models import Instance


@socketio.on('connect')
def handle_connect():
    """客户端连接事件"""
    print('客户端已连接')
    emit('connected', {'message': '连接成功', 'status': 'success'})


@socketio.on('disconnect')
def handle_disconnect():
    """客户端断开连接事件"""
    print('客户端已断开连接')


@socketio.on('request_update')
def handle_request_update(data):
    """处理手动请求更新事件"""
    try:
        instance_id = data.get('instanceId')
        
        if instance_id:
            # 强制检查指定实例
            result = monitor_service.force_check_instance(instance_id)
            if result:
                emit('update_response', {
                    'success': True,
                    'instance': result,
                    'message': '实例状态已更新'
                })
            else:
                emit('update_response', {
                    'success': False,
                    'message': '实例不存在'
                })
        else:
            # 获取所有实例的当前状态
            instances = Instance.query.all()
            instances_data = [instance.to_dict() for instance in instances]
            emit('instances_status', {
                'instances': instances_data,
                'timestamp': monitor_service._get_current_timestamp()
            })
            
    except Exception as e:
        print(f'处理更新请求时出错: {e}')
        emit('update_response', {
            'success': False,
            'message': f'更新失败: {str(e)}'
        })


@socketio.on('toggle_monitoring')
def handle_toggle_monitoring(data):
    """切换实例监控状态"""
    try:
        instance_id = data.get('instanceId')
        is_monitoring = data.get('isMonitoring', True)
        
        instance = Instance.query.get(instance_id)
        if instance:
            instance.is_monitoring = is_monitoring
            from .. import db
            db.session.commit()
            
            emit('monitoring_toggled', {
                'success': True,
                'instanceId': instance_id,
                'isMonitoring': is_monitoring,
                'message': f'实例监控已{"启用" if is_monitoring else "禁用"}'
            })
        else:
            emit('monitoring_toggled', {
                'success': False,
                'message': '实例不存在'
            })
            
    except Exception as e:
        print(f'切换监控状态时出错: {e}')
        emit('monitoring_toggled', {
            'success': False,
            'message': f'操作失败: {str(e)}'
        })


@socketio.on('get_instances_status')
def handle_get_instances_status():
    """获取所有实例状态"""
    try:
        instances = Instance.query.all()
        instances_data = [instance.to_dict() for instance in instances]
        
        emit('instances_status', {
            'instances': instances_data,
            'timestamp': monitor_service._get_current_timestamp()
        })
        
    except Exception as e:
        print(f'获取实例状态时出错: {e}')
        emit('error', {
            'message': f'获取状态失败: {str(e)}'
        })


# 为monitor_service添加获取时间戳的方法
def _get_current_timestamp():
    """获取当前时间戳"""
    from datetime import datetime
    return datetime.utcnow().isoformat()


# 将方法添加到monitor_service
monitor_service._get_current_timestamp = _get_current_timestamp