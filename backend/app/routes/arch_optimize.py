from flask import Blueprint, jsonify
from ..models import Instance
from ..services.architecture_optimization_service import arch_collector, arch_advisor, llm_advise_architecture

arch_opt_bp = Blueprint('arch_opt', __name__)

@arch_opt_bp.post('/instances/<int:instance_id>/arch/analyze')
def analyze_architecture(instance_id: int):
    try:
        inst = Instance.query.get(instance_id)
        if not inst:
            return jsonify({'error': '实例不存在'}), 404
        ok, data, msg = arch_collector.collect(inst)
        if not ok:
            return jsonify({'error': msg}), 400
        overview = data.get('overview', {})
        replication = data.get('replication', {})
        risks = arch_advisor.advise(overview, replication)
        # LLM 建议（按配置启用，失败降级为 None）
        llm_advice = llm_advise_architecture(overview, replication, risks)
        # 统一响应结构
        resp = {
            'overview': overview,
            'replication': replication,
            'risks': risks,
            'llm_advice': llm_advice,  # 可能为 None
        }
        return jsonify(resp), 200
    except Exception as e:
        return jsonify({'error': f'架构分析失败: {e}'}), 500