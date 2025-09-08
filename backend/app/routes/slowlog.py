from flask import Blueprint, jsonify, request
from ..models import Instance
from ..services.slowlog_service import slowlog_service

slowlog_bp = Blueprint('slowlog', __name__)

@slowlog_bp.post('/instances/<int:instance_id>/slowlog/analyze')
def analyze_slowlog(instance_id: int):
    try:
        inst = Instance.query.get(instance_id)
        if not inst:
            return jsonify({'error': '实例不存在'}), 404
        body = {}
        try:
            body = request.get_json(force=False, silent=True) or {}
        except Exception:
            body = {}
        top = int(body.get('top', 20))
        min_avg_ms = int(body.get('min_avg_ms', 10))
        tail_kb = int(body.get('tail_kb', 256))

        ok, data, msg = slowlog_service.analyze(inst, top=top, min_avg_ms=min_avg_ms, tail_kb=tail_kb)
        if not ok:
            return jsonify({'error': msg}), 400
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': f'慢日志分析失败: {e}'}), 500


# 新增：列表接口（TABLE 输出）
@slowlog_bp.get('/instances/<int:instance_id>/slowlog')
def list_slowlog(instance_id: int):
    try:
        inst = Instance.query.get(instance_id)
        if not inst:
            return jsonify({'error': '实例不存在'}), 404
        # 解析查询参数
        page = request.args.get('page', default='1')
        page_size = request.args.get('page_size', default='10')
        filters = {
            'keyword': request.args.get('keyword', default='') or '',
            'user_host': request.args.get('user_host', default='') or '',
            'db': request.args.get('db', default='') or '',
            'start_time': request.args.get('start_time', default='') or '',
            'end_time': request.args.get('end_time', default='') or '',
        }
        ok, data, msg = slowlog_service.list_from_table(inst, page=page, page_size=page_size, filters=filters)
        if not ok:
            # 若为 log_output 不支持，附带 overview 以便前端提示
            if data:
                return jsonify({'error': msg, **data}), 400
            return jsonify({'error': msg}), 400
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': f'慢日志列表失败: {e}'}), 500