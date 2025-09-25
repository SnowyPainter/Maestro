from apps.backend.src.modules.mail.service import _poll_mailbox_sync
from apps.backend.src.core.config import settings
import logging
logger = logging.getLogger(__name__)

def test_poll_mailbox():
    print(f"settings.MAIL_IMAP_USER: {settings.MAIL_IMAP_USER}")
    print(f"settings.MAIL_IMAP_PASSWORD: {settings.MAIL_IMAP_PASSWORD}")
    print(f"settings.MAIL_IMAP_HOST: {settings.MAIL_IMAP_HOST}")
    print(f"settings.MAIL_IMAP_PORT: {settings.MAIL_IMAP_PORT}")
    print(f"settings.MAIL_IMAP_FOLDER: {settings.MAIL_IMAP_FOLDER}")

    result = _poll_mailbox_sync(1)

    print(result)

    assert result is not None
    assert len(result) > 0
    assert result[0]["pipeline_id"] == "123123fksdflkj"
    assert result[0]["event"]["subject"] == "TESt"
    assert result[0]["event"]["from"] == "snowypainter@gmail.com"
    assert result[0]["event"]["body"] is not None
    assert result[0]["metadata"]["pipeline_id"] == "123123fksdflkj"
    assert result[0]["metadata"]["title"] == "Untitled Email"