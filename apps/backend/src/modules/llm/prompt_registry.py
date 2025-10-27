from __future__ import annotations
import json
from typing import Optional, Dict, Any, Set
from jinja2 import Environment, DictLoader, select_autoescape
from pydantic import BaseModel
from .schemas import PromptKey, PromptVars, PromptMetadata, PROMPT_METADATA_REGISTRY


def _generate_json_schema(model_cls: type[BaseModel]) -> str:
    """Pydantic 모델을 JSON 스키마 문자열로 변환"""
    schema = model_cls.model_json_schema()
    # 프롬프트에 넣기 좋은 형태로 정리
    return json.dumps(schema, indent=2, ensure_ascii=False)


_INTERNAL_TEMPLATE_VARS: Set[str] = {"json_schema"}


def _validate_template_vars(template_vars: Set[str], provided_vars: Dict[str, Any], metadata: PromptMetadata) -> None:
    """템플릿 변수 검증"""
    all_allowed_vars = metadata.required_vars | metadata.optional_vars | {"extra"} | _INTERNAL_TEMPLATE_VARS

    # 허용되지 않은 변수가 있는지 확인 (None이 아닌 값만 고려)
    provided_keys = set(key for key, value in provided_vars.items() if value is not None)
    provided_keys.update(_INTERNAL_TEMPLATE_VARS)
    extra_vars = provided_keys - all_allowed_vars
    if extra_vars:
        raise ValueError(f"프롬프트 '{metadata.key.value}'에 허용되지 않은 변수들: {extra_vars}")

    # 필수 변수가 모두 제공되었는지 확인
    missing_required = metadata.required_vars - provided_keys
    if missing_required:
        raise ValueError(f"프롬프트 '{metadata.key.value}'에 필수 변수들 누락: {missing_required}")

    # 템플릿에 필요한 변수들이 제공되었는지 확인 (템플릿 변수 검증)
    # None 값 변수들도 템플릿에서 사용할 수 있으므로 모두 포함
    all_provided_keys = set(provided_vars.keys())
    all_provided_keys.update(_INTERNAL_TEMPLATE_VARS)
    template_missing = template_vars - all_provided_keys
    if template_missing:
        raise ValueError(f"템플릿에 필요한 변수들 누락: {template_missing}")


# 기본 템플릿: "반드시 JSON으로만 응답" 강제
_TEMPLATES = {
    "hashtag.from_trend": """\
SYSTEM:
You are a social media analyst. Respond ONLY with strict JSON matching:
{{ json_schema }}

USER:
Product: {{ product_name or "N/A" }}
Audience: {{ audience or "N/A" }}
DesiredTone: {{ tone or "neutral" }}
Goal: {{ goal or "reach" }}
AdditionalNotes: {{ text or "None" }}

TrendData (JSON):
{{ trend_data | tojson(indent=2) if trend_data else "[]" }}

Instructions:
- Analyse the trend dataset and return hashtags most relevant to the product and audience.
- Focus on recency (higher rank and newer retrieved timestamps).
- Provide 10~15 unique hashtags including mix of broad and niche terms.
- Use lowercase letters, prefix each with #, avoid spaces or special characters.

Return ONLY JSON. No explanations.
""",

    "guidance.from_trend": """\
SYSTEM:
You are a senior social media strategist. Respond ONLY with strict JSON matching:
{{ json_schema }}

USER:
Product: {{ product_name or "N/A" }}
Audience: {{ audience or "N/A" }}
DesiredTone: {{ tone or "neutral" }}
Goal: {{ goal or "engagement" }}
AdditionalNotes: {{ text or "None" }}

TrendData (JSON):
{{ trend_data | tojson(indent=2) if trend_data else "[]" }}

Instructions:
- Summarise why the highlighted trends matter for the product.
- Provide actionable guidelines and 4~7 key points tied to the trends.
- Recommend tone suggestions, supportive hashtags, and at least one concrete example idea.
- Keep guidance concise but specific so it can be executed immediately.

Return ONLY JSON. Do not add commentary.
""",

    "draft.from_trend": """\
SYSTEM:
You are a social media copywriter. Respond ONLY with strict JSON matching:
{{ json_schema }}

USER:
Product: {{ product_name or "N/A" }}
Audience: {{ audience or "N/A" }}
DesiredTone: {{ tone or "neutral" }}
Goal: {{ goal or "engagement" }}
AdditionalNotes: {{ text or "None" }}

PersonaBrief (JSON):
{{ persona_brief | tojson(indent=2) if persona_brief else "{}" }}

TrendData (JSON):
{{ trend_data | tojson(indent=2) if trend_data else "[]" }}

Instructions:
- Study PersonaBrief to align tone, guardrails, and priorities with the persona.
- Focus on the single provided trend; do not introduce additional trends.
- Create a DraftIR with a compelling hook, persona-aligned body, and clear call-to-action.
- Enrich the narrative by relating the trend to the persona's hobbies or lived experiences so the copy feels personal and substantial.
- Suggest supporting hashtags in the DraftIR metadata if appropriate.

Return ONLY JSON. Do not include prose.
""",

    "draft.from_comment": """\
SYSTEM:
You are a social media copywriter specialising in community responses. Respond ONLY with strict JSON matching:
{{ json_schema }}

USER:
Product: {{ product_name or "N/A" }}
Audience: {{ audience or "N/A" }}
DesiredTone: {{ tone or "empathetic" }}
Goal: {{ goal or "conversion" }}
AdditionalNotes: {{ text or "None" }}

PersonaBrief (JSON):
{{ persona_brief | tojson(indent=2) if persona_brief else "{}" }}

CommentDataset (JSON):
{{ comment_data | tojson(indent=2) if comment_data else "[]" }}

Instructions:
- Identify the hottest themes using metrics such as likes/replies.
- Stay faithful to persona tone, guardrails, and bans described in PersonaBrief.
- Create a DraftIR that acknowledges commenters' sentiment and moves the conversation forward.
- Keep structure concise: hook, acknowledgement, value response, CTA.
- Ensure facts stay consistent with the comments and avoid inventing metrics.

Return ONLY JSON. Any non-JSON output is invalid.
""",

    "coworker.contextual.write": """\
SYSTEM:
You are Maestro's brand copywriter CoWorker. Respond ONLY with strict JSON matching:
{{ json_schema }}

USER_INPUT:
{{ text }}

CONTEXT:
PersonaBrief:
{{ persona_brief | tojson(indent=2) if persona_brief else "null" }}

CampaignBrief:
{{ campaign_brief | tojson(indent=2) if campaign_brief else "null" }}

PlaybookSummary:
{{ playbook_summary | tojson(indent=2) if playbook_summary else "null" }}

RecentPublications:
{{ recent_publications | tojson(indent=2) if recent_publications else "[]" }}

Instructions:
- Write a single piece of copy tailored to the persona and campaign (if provided).
- Reflect the persona's tone or `tone` field when available; otherwise infer from PersonaBrief.
- Review RecentPublications to maintain continuity in voice and storyline; call back to them when it strengthens the copy.
- If PlaybookSummary includes insights or checkpoints, weave them naturally into the copy.
- Keep it under 200 words, actionable, and ready to publish as-is.
- Avoid markdown unless the context explicitly requests formatting.

Return ONLY JSON with structure {"text": "..."}. No explanations.
""",

    "reaction.template.from_comment": """\
SYSTEM:
You are Maestro's community response strategist. Respond ONLY with strict JSON matching:
{{ json_schema }}

USER:
Product: {{ product_name or "N/A" }}
Audience: {{ audience or "N/A" }}
DesiredTone: {{ tone or "neutral" }}
Goal: {{ goal or "relationship" }}
AdditionalNotes: {{ text or "None" }}

PersonaBrief (JSON):
{{ persona_brief | tojson(indent=2) if persona_brief else "{}" }}

CommentDataset (JSON):
{{ comment_data | tojson(indent=2) if comment_data else "[]" }}

ExistingHints:
- TemplateTypeHint: {{ template_type_hint or "unspecified" }}
- TagKeyHint: {{ tag_key_hint or "unspecified" }}
- TitleHint: {{ title_hint or "unspecified" }}

Instructions:
- Study PersonaBrief and comments to decide whether a public reply or a private DM best serves the situation when TemplateTypeHint is unspecified.
- Create a concise reaction message body that acknowledges key sentiments and offers a clear next step.
- Suggest an informative title and, if relevant, a short tag key signifying the theme. Leave them null if no strong option exists.
- Keep language natural, friendly, and aligned with the persona guardrails.
- Ensure body is 3-6 sentences, written in English, ready to send without additional editing.
- Return ONLY JSON that matches the schema exactly. No explanations.
""",
}

_env = Environment(
    loader=DictLoader(_TEMPLATES),
    autoescape=select_autoescape(disabled_extensions=("md", "txt", "json"))
)


class PromptRegistry:
    """프롬프트 템플릿 로더/렌더러. 메타데이터와 검증 기능 포함."""

    def get_metadata(self, key: PromptKey) -> PromptMetadata:
        """프롬프트 메타데이터 조회"""
        if key not in PROMPT_METADATA_REGISTRY:
            raise ValueError(f"등록되지 않은 프롬프트 키: {key.value}")
        return PROMPT_METADATA_REGISTRY[key]

    def validate_vars(self, key: PromptKey, vars: PromptVars) -> None:
        """변수 검증 수행"""
        metadata = self.get_metadata(key)
        vars_dict = vars.model_dump(mode="json")

        # 템플릿에서 사용하는 변수들 추출 (간단한 정규식으로 {{ var }} 패턴 찾기)
        template_name = key.value
        template_source = _TEMPLATES[template_name]
        import re
        template_vars = set(re.findall(r'\{\{\s*(\w+)', template_source))

        _validate_template_vars(template_vars, vars_dict, metadata)

    def render(self, key: PromptKey, vars: PromptVars, *, version: Optional[str] = None) -> str:
        """스키마 기반 템플릿 렌더링 with 검증"""
        # 메타데이터 조회 및 검증
        metadata = self.get_metadata(key)
        self.validate_vars(key, vars)

        # JSON 스키마 생성
        json_schema = _generate_json_schema(metadata.output_schema)

        # 템플릿 렌더링
        template_name = key.value
        template = _env.get_template(template_name)

        # 변수에 json_schema 추가
        render_vars = vars.model_dump(mode="json")
        render_vars["json_schema"] = json_schema

        return template.render(**render_vars)

    def list_available_prompts(self) -> Dict[str, str]:
        """사용 가능한 프롬프트 목록 반환"""
        return {
            metadata.key.value: metadata.description or "설명 없음"
            for metadata in PROMPT_METADATA_REGISTRY.values()
        }
