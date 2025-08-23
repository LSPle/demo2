from flask import Blueprint, jsonify, request
from ..models import Instance
from ..services.config_optimization_service import config_collector, config_advisor

config_opt_bp = Blueprint('config_opt', __name__)

@config_opt_bp.post('/instances/<int:instance_id>/config/analyze')
def analyze_instance_config(instance_id: int):
    try:
        inst = Instance.query.get(instance_id)
        if not inst:
            return jsonify({'error': '实例不存在'}), 404
        ok, collected, msg = config_collector.collect(inst)
        if not ok:
            return jsonify({'error': msg}), 400
        advised = config_advisor.advise(collected)
        # 组装前端期望结构
        resp = {
            'basicInfo': collected.get('basicInfo', {}),
            'configItems': advised.get('configItems', []),
            'optimizationSummary': advised.get('optimizationSummary', {})
        }
        return jsonify(resp), 200
    except Exception as e:
        return jsonify({'error': f'分析失败: {e}'}), 500