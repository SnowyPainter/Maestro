# apps/backend/src/orchestrator/webhooks/mail.py
from ast import Tuple
from fastapi import APIRouter, Header, HTTPException, Request
from apps.backend.src.services.mailer import get_mailer
from apps.backend.src.modules.scheduler.mail_parser import parse_mail_body
from apps.backend.src.modules.drafts.schemas import DraftIR, DraftSaveRequest, DraftOut
from apps.backend.src.orchestrator.dispatch import orchestrate_flow
from apps.backend.src.core.config import settings
from apps.backend.src.modules.scheduler.schemas import EmailMetadata
from apps.backend.src.core.resource import render_email_draft_created

router = APIRouter(prefix="/mail")

@router.post("/inbound")
async def email_inbound(
    request: Request,
    x_inbound_secret: str | None = Header(default=None),
):
    """Gmail 인바운드 이메일을 처리하여 Draft를 생성합니다."""
    if settings.INBOUND_EMAIL_SECRET and x_inbound_secret != settings.INBOUND_EMAIL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Gmail payload 파싱
    payload = await request.json()

    # Gmail 특성상 다양한 필드에서 이메일 정보를 추출
    subject = payload.get("subject", "").strip()
    from_email = (
        payload.get("from") or
        payload.get("sender") or
        payload.get("envelope", {}).get("from")
    )
    if not from_email:
        raise HTTPException(status_code=400, detail="Sender email not found")

    body_text = (
        payload.get("text") or  # text/plain
        payload.get("body") or  # 일반적인 body
        payload.get("text/plain") or  # 일부 서비스에서
        ""
    ).strip()

    if not body_text:
        raise HTTPException(status_code=400, detail="Email body is empty")

    # 1) 본문에서 메타데이터와 컨텐츠 분리
    result: Tuple[DraftIR, EmailMetadata] = parse_mail_body(body_text)
    ir: DraftIR = result[0]
    metadata: EmailMetadata = result[1]
    pipeline_id = metadata.settings.get('pipeline_id')

    # 4) Draft 생성 요청 객체 생성
    draft_request = DraftSaveRequest(
        title=metadata.title,
        tags=metadata.tags,
        ir=ir,
        campaign_id=metadata.settings.get('campaign_id'),
        goal=f"Email draft from pipeline #{pipeline_id}"
    )

    try:
        draft: DraftOut = await orchestrate_flow("drafts.create", payload=draft_request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create draft: {str(e)}")

    mailer = get_mailer()
    done_subject = f"Draft Created - {draft.title or 'Untitled'}"
    done_html = render_email_draft_created(
        draft=draft,
        pipeline_id=metadata.pipeline_id
    )

    try:
        mailer.send_html(to_email=from_email, subject=done_subject, html_body=done_html)
    except Exception as e:
        print(f"Warning: Failed to send completion email: {str(e)}")

    return {
        "ok": True,
        "pipeline_id": metadata.pipeline_id,
        "draft_id": draft.id,
        "title": metadata.title,
        "tags": metadata.tags,
        "settings": metadata.settings
    }
