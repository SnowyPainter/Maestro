"""Email processing functions for draft creation and trend notifications."""

import asyncio
import email
import imaplib
import logging
from ast import Tuple
from email.header import decode_header
from email.utils import parseaddr
from typing import Any, Dict

from apps.backend.src.core.config import settings
from apps.backend.src.core.resource import render_email_draft_created
from apps.backend.src.modules.drafts.schemas import DraftIR, DraftSaveRequest, DraftOut
from apps.backend.src.modules.mail.mail_parser import parse_mail_body
from apps.backend.src.modules.mail.schemas import EmailMetadata
from apps.backend.src.orchestrator.dispatch import orchestrate_flow, ExecutionRuntime
from apps.backend.src.orchestrator.registry import FLOWS
from apps.backend.src.services.mailer import get_mailer

from apps.backend.src.core.logging import setup_logging
setup_logging()
logger = logging.getLogger(__name__)

def _safe_get(payload: Dict[str, Any], key: str, default: Any = "") -> Any:
    if payload.get(key, default) is None:
        return default
    return payload.get(key, default)

async def ingest_draft_mail(payload: Dict[str, Any], runtime: ExecutionRuntime | None = None) -> Dict[str, Any]:
    """Process inbound email and create draft.

    Args:
        payload: Naver mail payload

    Returns:
        Processing result with draft information
    """
    # Extract email information
    subject = _safe_get(payload, "subject", "").strip()
    from_email = (
        _safe_get(payload, "from") or
        _safe_get(payload, "sender") or
        _safe_get(payload, "envelope", {}).get("from", "")
    )
    if not from_email:
        raise ValueError("Sender email not found")

    body_text = (
        _safe_get(payload, "text", "") or
        _safe_get(payload, "body", "") or
        _safe_get(payload, "text/plain", "") or
        ""
    ).strip()

    if not body_text:
        raise ValueError("Email body is empty")

    # Parse email content, prefer pipeline_id from subject token
    result: Tuple[DraftIR, EmailMetadata] = parse_mail_body(body_text, subject=subject)
    ir: DraftIR = result[0]
    metadata: EmailMetadata = result[1]
    pipeline_id = metadata.pipeline_id or metadata.settings.get('pipeline_id')

    if not pipeline_id:
        raise ValueError("pipeline_id not found in email settings")

    # Create draft
    draft_request = DraftSaveRequest(
        title=metadata.title,
        tags=metadata.tags,
        ir=ir,
        campaign_id=metadata.settings.get('campaign_id'),
        goal=f"Go for a trend"
    )

    flow = FLOWS.get("drafts.create")
    draft: DraftOut = await orchestrate_flow(flow, draft_request, runtime)

    # Send confirmation email
    await _send_draft_confirmation_email(
        draft=draft,
        from_email=from_email,
        metadata=metadata
    )

    return {
        "ok": True,
        "pipeline_id": metadata.pipeline_id,
        "draft_id": draft.id,
        "title": metadata.title,
        "tags": metadata.tags,
        "settings": metadata.settings
    }


async def _send_draft_confirmation_email(
    draft: DraftOut,
    from_email: str,
    metadata: EmailMetadata
) -> None:
    """Send draft creation confirmation email."""
    mailer = get_mailer()
    done_subject = f"Draft Created - {draft.title or 'Untitled'} [PIPELINE #{metadata.pipeline_id}]"
    done_html = render_email_draft_created(
        draft=draft,
        pipeline_id=metadata.pipeline_id
    )

    try:
        mailer.send_html(to_email=from_email, subject=done_subject, html_body=done_html)
    except Exception as e:
        print(f"Warning: Failed to send completion email: {str(e)}")
        # Don't raise exception for email failures


async def poll_mailbox(limit: int = 50) -> list[Dict[str, Any]]:
    """Poll inbound mailbox for unseen messages.

    Returns a list of payload dictionaries containing the parsed event and
    associated metadata (e.g., pipeline ID) required to resume waiting schedules.
    """

    return await asyncio.to_thread(_poll_mailbox_sync, limit)


def _poll_mailbox_sync(limit: int) -> list[Dict[str, Any]]:
    host = settings.MAIL_IMAP_HOST
    user = settings.MAIL_IMAP_USER
    password = settings.MAIL_IMAP_PASSWORD
    folder = settings.MAIL_IMAP_FOLDER

    if not user or not password:
        logger.debug("MAIL_IMAP_USER or MAIL_IMAP_PASSWORD not configured; skipping mailbox poll")
        return []

    messages: list[Dict[str, Any]] = []

    try:
        with imaplib.IMAP4_SSL(host, settings.MAIL_IMAP_PORT) as imap:
            imap.login(user, password)
            imap.select(folder)
    
            status, data = imap.search(None, "UNSEEN")
            if status != "OK" or not data:
                return []

            message_ids = data[0].split()
            for msg_id in reversed(message_ids[-limit:]):
                status, msg_data = imap.fetch(msg_id, "(RFC822)")
                if status != "OK" or not msg_data:
                    continue
                raw_email = msg_data[0][1]
                message = email.message_from_bytes(raw_email)
                subject = _decode_header(message.get("Subject", ""))
                from_email = parseaddr(message.get("From", ""))[1]
                if not from_email:
                    continue

                body_text = _extract_plain_text(message)
                if not body_text.strip():
                    continue

                metadata = None
                pipeline_id: str | None = None
                try:
                    _, metadata = parse_mail_body(body_text)
                    pipeline_id = metadata.pipeline_id
                except Exception as e:
                    logger.debug("Failed to parse pipeline metadata from mail", exc_info=True)

                if not pipeline_id:
                    imap.store(msg_id, "+FLAGS", "\\Seen")
                    continue

                event_payload = {
                    "subject": subject,
                    "from": from_email,
                    "sender": from_email,
                    "envelope": {"from": from_email},
                    "text": body_text,
                    "body": body_text,
                    "text/plain": body_text,
                    "text_plain": body_text,
                }

                messages.append(
                    {
                        "pipeline_id": pipeline_id,
                        "event": event_payload,
                        "metadata": metadata.model_dump() if metadata else None,
                    }
                )

                imap.store(msg_id, "+FLAGS", "\\Seen")

    except imaplib.IMAP4.error as exc:  # pragma: no cover - network/credential errors
        logger.warning("IMAP error while polling mailbox: %s", exc)
    except Exception as exc:  # pragma: no cover - defensive catch
        logger.exception("Unexpected error polling mailbox: %s", exc)

    return messages


def _decode_header(value: str) -> str:
    parts = decode_header(value)
    decoded: list[str] = []
    for part, encoding in parts:
        if isinstance(part, bytes):
            enc = encoding or "utf-8"
            try:
                decoded.append(part.decode(enc, errors="ignore"))
            except LookupError:
                decoded.append(part.decode("utf-8", errors="ignore"))
        elif isinstance(part, str):
            decoded.append(part)
    return " ".join(filter(None, decoded))


def _extract_plain_text(message: email.message.Message) -> str:
    if message.is_multipart():
        for part in message.walk():
            content_type = part.get_content_type()
            disposition = part.get("Content-Disposition", "")
            if content_type == "text/plain" and "attachment" not in disposition.lower():
                payload = part.get_payload(decode=True) or b""
                charset = part.get_content_charset() or "utf-8"
                try:
                    return payload.decode(charset, errors="ignore")
                except LookupError:
                    return payload.decode("utf-8", errors="ignore")
    else:
        payload = message.get_payload(decode=True) or b""
        charset = message.get_content_charset() or "utf-8"
        try:
            return payload.decode(charset, errors="ignore")
        except LookupError:
            return payload.decode("utf-8", errors="ignore")
    return ""
