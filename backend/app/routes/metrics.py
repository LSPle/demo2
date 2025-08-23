from flask import Blueprint, Response, current_app, request, stream_with_context, jsonify
import json
import time
from ..services.prometheus_service import prometheus_service

metrics_bp = Blueprint('metrics', __name__)


def sse_format(event: str = None, data: dict = None, id: str = None) -> str:
    """Format message for SSE"""
    parts = []
    if event:
        parts.append(f"event: {event}")
    if id:
        parts.append(f"id: {id}")
    if data is not None:
        parts.append(f"data: {json.dumps(data, ensure_ascii=False)}")
    parts.append("\n")
    return "\n".join(parts)


@metrics_bp.get('/metrics/stream')
def stream_metrics():
    """SSE stream endpoint for real-time metrics"""
    service = request.args.get('service') or 'mysqld'  # default service label
    interval = int(request.args.get('interval', 5))

    # CORS for EventSource
    headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    }

    def generate():
        yield sse_format(event='open', data={'message': 'stream opened', 'service': service})
        while True:
            try:
                metrics = prometheus_service.get_all_metrics(service)
                yield sse_format(event='metrics', data=metrics, id=str(int(time.time())))
            except GeneratorExit:
                break
            except Exception as e:
                yield sse_format(event='error', data={'message': str(e)})
            time.sleep(interval)

    return Response(stream_with_context(generate()), headers=headers)


@metrics_bp.get('/metrics/health')
def metrics_health():
    ok = prometheus_service.health_check()
    return jsonify({'prometheus_ok': ok}), (200 if ok else 500)