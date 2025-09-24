#apps.backend.src.workers.CoWorker.runners.draft_composer.py

"""
Persona Account Id를 기반으로 해당 Persona와 유사한 Trend를 찾아서 DraftIR로 만들고
해당 DraftIR을 markdown -> HTML로 변경하여 사용자에게 이메일을 보낸다.
"""

from apps.backend.src.modules.accounts.models import Persona
from apps.backend.src.modules.drafts.schemas import DraftIR
from apps.backend.src.modules.scheduler.models import Schedule
from apps.backend.src.orchestrator.flows.bff.bff_trends import TrendsQueryPayload
from apps.backend.src.orchestrator.adapters.draft import trends_to_draft_adapter
from apps.backend.src.services.mailer import get_mailer
from apps.backend.src.core.resource import render_email_trends
from apps.backend.src.workers.Synchro.tasks import find_similar_trends_for_persona

from pydantic import BaseModel

class DraftComposePayload(BaseModel):
    email_to: str
    persona_snapshot: Persona
    country: str
    limit: int

async def run_draft_composer(sch: Schedule):
    payload: DraftComposePayload = DraftComposePayload.model_validate(sch.payload)
    similarity_result = find_similar_trends_for_persona.delay(
        persona_snapshot=payload.persona_snapshot,
        country=payload.country,
        limit=payload.limit
    ).get(timeout=300)

    filtered_trends = similarity_result.get("rows", [])

    if not filtered_trends:
        print(f"No similar trends found for persona {payload.persona_snapshot.name}")
        return []
    
    payload = TrendsQueryPayload(country=payload.country, limit=len(filtered_trends))

    draft_request = trends_to_draft_adapter(filtered_trends, payload)
    draft_ir = draft_request.ir

    try:
        mailer = get_mailer()
        persona_name = similarity_result.get("persona_name", payload.persona_snapshot.name)

        subject = f"Here's new trends for {persona_name}"

        html_body = render_email_trends(draft_ir, pipeline_id=sch.idempotency_key, name=persona_name)
        recipient_email = payload.email_to
        mailer.send_html(
            to_email=recipient_email,
            subject=subject,
            html_body=html_body
        )

        print(f"Trends email sent to {recipient_email} for persona {persona_name}")

    except Exception as e:
        print(f"Failed to send trends email: {str(e)}")
    
    return filtered_trends