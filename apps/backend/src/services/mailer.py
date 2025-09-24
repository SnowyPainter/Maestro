# apps/backend/src/services/mailer.py
import smtplib, ssl, uuid, re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

class Mailer:
    def __init__(self, host: str, port: int, user: str, password: str, sender_name: str, sender_email: str):
        self.host = host; self.port = port
        self.user = user; self.password = password
        self.sender_name = sender_name; self.sender_email = sender_email

    def send_text(self, to_email: str, subject: str, body: str):
        msg = MIMEText(body, _charset="utf-8")
        msg["Subject"] = subject
        msg["From"] = formataddr((self.sender_name, self.sender_email))
        msg["To"] = to_email
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(self.host, self.port, context=ctx) as server:
            server.login(self.user, self.password)
            server.sendmail(self.sender_email, [to_email], msg.as_string())

    def send_html(self, to_email: str, subject: str, html_body: str):
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formataddr((self.sender_name, self.sender_email))
        msg["To"] = to_email

        # HTML part
        html_part = MIMEText(html_body, "html", _charset="utf-8")
        msg.attach(html_part)

        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(self.host, self.port, context=ctx) as server:
            server.login(self.user, self.password)
            server.sendmail(self.sender_email, [to_email], msg.as_string())

def get_mailer():
    from apps.backend.src.core.config import settings
    return Mailer(
        host=settings.MAIL_HOST,
        port=settings.MAIL_PORT,
        user=settings.MAIL_USER,
        password=settings.MAIL_PASSWORD,
        sender_name=settings.MAIL_SENDER_NAME,
        sender_email=settings.MAIL_SENDER_EMAIL,
    )

def new_pipeline_id() -> str:
    return uuid.uuid4().hex[:12]
