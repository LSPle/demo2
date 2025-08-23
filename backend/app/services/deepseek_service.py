import os
import json
from typing import Optional
import requests
from flask import current_app


class DeepSeekClient:
    """DeepSeek API 适配器：只输出重写后的 SQL（若可优化），不返回其他建议文本。
    输出：{"rewritten_sql": str | None}
    """

    def __init__(self):
        self.base_url = None
        self.api_key = None
        self.model = None
        self.timeout = 30
        self.enabled = True
        self._load_config()

    def _load_config(self):
        cfg = current_app.config
        self.base_url = cfg.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self.api_key = cfg.get("DEEPSEEK_API_KEY")
        self.model = cfg.get("DEEPSEEK_MODEL", "deepseek-chat")
        self.timeout = cfg.get("DEEPSEEK_TIMEOUT", 30)
        self.enabled = cfg.get("LLM_ENABLED", True)

    def _build_prompt(self, sql: str, meta_summary: str) -> str:
        """构造严格输出约束的系统提示。仅支持 MySQL，仅返回可优化时的重写SQL，否则返回 null。
        meta_summary: 后端提炼的表/索引/执行计划摘要（可为空字符串）。
        """
        return (
            "你是资深MySQL查询优化专家。根据给定SQL与元数据/执行计划摘要，判断是否需要优化。"
            "若需要优化，仅输出重写后的SQL；若无需优化，返回 null。"
            "必须严格输出JSON：{\"rewritten_sql\": string|null}。"
            "要求：1) 不输出解释文字；2) 仅做语义等价或更优的可行改写；3) 禁止使用厂商特性以外的语法。"
            f"\n【SQL】:\n{sql}\n"
            f"\n【摘要】:\n{meta_summary}\n"
        )

    def rewrite_sql(self, sql: str, meta_summary: str = "") -> Optional[str]:
        """返回重写后的 SQL；若不需要优化或出错，返回 None。"""
        if not self.enabled or not self.api_key:
            return None

        prompt = self._build_prompt(sql, meta_summary)

        # DeepSeek 兼容 OpenAI Chat Completions 风格（如不同需按官方API调整）
        url = f"{self.base_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "你是一个只返回JSON的优化器。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 800,
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            # 期望严格的JSON；若模型仍包裹代码块或前后噪声，尽量提取花括号内JSON
            try:
                obj = json.loads(content)
            except Exception:
                # 尝试去掉代码围栏 ```json ... ``` 或提取花括号片段
                start = content.find('{')
                end = content.rfind('}')
                if start != -1 and end != -1 and end > start:
                    try:
                        obj = json.loads(content[start:end+1])
                    except Exception:
                        return None
                else:
                    return None
            rewritten = obj.get("rewritten_sql")
            if isinstance(rewritten, str) and rewritten.strip():
                return rewritten.strip()
            return None
        except Exception:
            # 任何异常都降级为 None
            return None

    # 新增：返回结构化的分析结果与（可选）重写SQL
    def analyze_sql(self, sql: str, context_summary: str = "") -> Optional[dict]:
        """要求模型输出 JSON：{"analysis": string, "rewritten_sql": string|null}
        若未启用或出错，返回 None。"""
        if not self.enabled or not self.api_key:
            return None

        prompt = (
            "你是资深MySQL SQL审核与性能优化专家。给定SQL及相关的表结构/数据样本/上下文摘要，"
            "请完成两件事并严格以JSON返回：\n"
            "1) analysis: 用中文给出要点化的分析（可涉及语义正确性、潜在风险、索引与统计信息、可能的性能瓶颈、基于样本数据的观察等），尽量简洁清晰；\n"
            "2) rewritten_sql: 若存在更优且等价的写法，给出改写后的SQL；否则为null。\n"
            "必须严格输出JSON：{\"analysis\": string, \"rewritten_sql\": string|null}。\n"
            "不要输出任何额外解释文字或代码块围栏。\n"
            f"\n【SQL】:\n{sql}\n"
            f"\n【上下文摘要（表结构与数据样本等）】:\n{context_summary}\n"
        )

        url = f"{self.base_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "你是一个只返回JSON的审核与优化助手。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 1200,
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            try:
                obj = json.loads(content)
            except Exception:
                start = content.find('{')
                end = content.rfind('}')
                if start != -1 and end != -1 and end > start:
                    try:
                        obj = json.loads(content[start:end+1])
                    except Exception:
                        return None
                else:
                    return None
            analysis = obj.get("analysis")
            rewritten = obj.get("rewritten_sql")
            # 规范化
            if not isinstance(analysis, str):
                analysis = None
            if not (isinstance(rewritten, str) and rewritten.strip()):
                rewritten = None
            else:
                rewritten = rewritten.strip()
            return {"analysis": analysis, "rewritten_sql": rewritten}
        except Exception:
            return None


# 全局工厂方法

def get_deepseek_client() -> DeepSeekClient:
    return DeepSeekClient()