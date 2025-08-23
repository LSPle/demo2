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
        min_avg_ms = int(body.get('min_avg_ms', 100))
        tail_kb = int(body.get('tail_kb', 256))

        ok, data, msg = slowlog_service.analyze(inst, top=top, min_avg_ms=min_avg_ms, tail_kb=tail_kb)
        if not ok:
            return jsonify({'error': msg}), 400
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': f'慢日志分析失败: {e}'}), 500