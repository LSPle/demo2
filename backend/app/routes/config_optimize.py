from flask import Blueprint, jsonify, request
from ..models import Instance
from ..services.config_optimization_service import config_collector, config_advisor
# 新增：引入慢日志服务以构建简要摘要
from ..services.slowlog_service import slowlog_service

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

        # 新增：尝试构建慢日志摘要，优先使用 mysql.slow_log（TABLE），其次降级到 analyze（P_S + 文件抽样）
        slowlog_summary = None
        try:
            ok_tbl, data_tbl, _ = slowlog_service.list_from_table(inst, page=1, page_size=5, filters={})
            if ok_tbl:
                examples = []
                for it in data_tbl.get('items', [])[:5]:
                    examples.append({
                        'start_time': it.get('start_time'),
                        'db': it.get('db'),
                        'user_host': it.get('user_host'),
                        'query_time': it.get('query_time'),
                        'rows_examined': it.get('rows_examined'),
                        'sql_text': (it.get('sql_text') or '')[:200]
                    })
                slowlog_summary = {
                    'mode': 'TABLE',
                    'overview': data_tbl.get('overview', {}),
                    'total': data_tbl.get('total', 0),
                    'examples': examples
                }
            else:
                ok_ps, data_ps, _ = slowlog_service.analyze(inst, top=5, min_avg_ms=10, tail_kb=128)
                if ok_ps:
                    slowlog_summary = {
                        'mode': 'ANALYZE',
                        'overview': data_ps.get('overview', {}),
                        'ps_top': data_ps.get('ps_top', [])[:5],
                        'file_samples': [
                            {k: v for k, v in s.items() if k in ('time','db','user_host','query_time_ms','rows_examined','sql')}
                            for s in (data_ps.get('file_samples', [])[:3] or [])
                        ],
                        'warnings': data_ps.get('warnings', [])
                    }
        except Exception:
            slowlog_summary = None

        if slowlog_summary:
            collected['slowlogSummary'] = slowlog_summary

        advised = config_advisor.advise(collected)
        # 组装前端期望结构（保持不变）
        resp = {
            'basicInfo': collected.get('basicInfo', {}),
            'configItems': advised.get('configItems', []),
            'optimizationSummary': advised.get('optimizationSummary', {})
        }
        return jsonify(resp), 200
    except Exception as e:
        return jsonify({'error': f'分析失败: {e}'}), 500