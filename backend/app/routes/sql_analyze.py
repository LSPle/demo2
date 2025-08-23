from flask import Blueprint, request, jsonify
from ..models import Instance
from ..services.deepseek_service import get_deepseek_client
from ..services.table_analyzer_service import table_analyzer_service
import pymysql

sql_analyze_bp = Blueprint('sql_analyze', __name__)

@sql_analyze_bp.post('/sql/analyze')
def analyze_sql():
    """仅支持MySQL；执行轻量的表采样与EXPLAIN，连同SQL提交给LLM，返回分析与可选重写SQL。"""
    try:
        data = request.get_json() or {}
        instance_id = int(data.get('instanceId') or 0)
        sql = (data.get('sql') or '').strip()
        database = (data.get('database') or '').strip()
        # 后端默认策略：不进行数据采样，启用执行计划分析
        enable_sampling = False
        enable_explain = True
        sample_rows = None

        if not instance_id or not sql:
            return jsonify({"error": "缺少必要参数: instanceId, sql"}), 400
        if not database:
            return jsonify({"error": "缺少必要参数: database"}), 400

        inst = Instance.query.get(instance_id)
        if not inst:
            return jsonify({"error": "实例不存在"}), 404
        if (inst.db_type or '').strip() != 'MySQL':
            return jsonify({"error": "仅支持MySQL实例"}), 400

        # 构造上下文：基础元信息 + （可选）表采样 + （可选）执行计划
        context_summary = f"instance={inst.instance_name} ({inst.host}:{inst.port}), db_type={inst.db_type}, database={database}"
        try:
            extra_summary = table_analyzer_service.generate_context_summary(
                sql=sql,
                instance=inst,
                database=database,
                sample_rows=sample_rows,
                enable_sampling=enable_sampling,
                enable_explain=enable_explain,
            )
            if extra_summary:
                context_summary = context_summary + "\n" + extra_summary
        except Exception as e:
            # 采样或EXPLAIN失败不致命，降级为基础元信息
            context_summary = context_summary + f"\n上下文生成失败: {e}"

        client = get_deepseek_client()
        # 使用增强的分析接口，拿到分析文本与可能的重写SQL
        llm_result = client.analyze_sql(sql, context_summary)

        if not llm_result:
            # 降级：维持与旧版兼容，仅尝试重写SQL
            rewritten = client.rewrite_sql(sql, context_summary)
            return jsonify({
                "analysis": None,
                "rewrittenSql": rewritten if rewritten else None
            }), 200

        return jsonify({
            "analysis": llm_result.get("analysis"),
            "rewrittenSql": llm_result.get("rewritten_sql")
        }), 200

    except Exception as e:
        return jsonify({"error": f"服务器错误: {e}"}), 500


@sql_analyze_bp.post('/sql/execute')
def execute_sql():
    """执行 SQL（仅 MySQL）。支持查询类与非查询类，返回结果或受影响行数。"""
    try:
        data = request.get_json() or {}
        instance_id = int(data.get('instanceId') or 0)
        sql = (data.get('sql') or '').strip()
        database = (data.get('database') or '').strip()
        max_rows = int(data.get('maxRows') or 1000)

        if not instance_id or not sql:
            return jsonify({"error": "缺少必要参数: instanceId, sql"}), 400
        if not database:
            return jsonify({"error": "缺少必要参数: database"}), 400

        # 简单防护：仅允许单条语句执行
        statements = [s.strip() for s in sql.split(';') if s.strip()]
        if len(statements) != 1:
            return jsonify({"error": "仅支持单条 SQL 语句执行，请去除多余的分号或多语句"}), 400
        sql = statements[0]

        inst = Instance.query.get(instance_id)
        if not inst:
            return jsonify({"error": "实例不存在"}), 404
        if (inst.db_type or '').strip() != 'MySQL':
            return jsonify({"error": "仅支持MySQL实例"}), 400

        # 连接并执行
        conn = pymysql.connect(
            host=inst.host,
            port=inst.port,
            user=inst.username or '',
            password=inst.password or '',
            database=database,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False
        )
        try:
            with conn.cursor() as cursor:
                sql_lower = sql.lower().lstrip()
                is_query = sql_lower.startswith('select') or sql_lower.startswith('show') \
                    or sql_lower.startswith('desc') or sql_lower.startswith('describe') \
                    or sql_lower.startswith('explain')

                cursor.execute(sql)

                if is_query:
                    rows = cursor.fetchmany(max_rows)
                    columns = []
                    if cursor.description:
                        columns = [desc[0] for desc in cursor.description]
                    result = {
                        'sqlType': 'query',
                        'columns': columns,
                        'rows': rows,
                        'rowCount': len(rows),
                        'limitedTo': max_rows
                    }
                    return jsonify(result), 200
                else:
                    affected = cursor.rowcount
                    conn.commit()
                    result = {
                        'sqlType': 'non_query',
                        'affectedRows': affected
                    }
                    return jsonify(result), 200
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"error": f"执行SQL失败: {e}"}), 500