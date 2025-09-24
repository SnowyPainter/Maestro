"""Resource utilities for templates and assets."""

from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

BACKEND_DIR = Path(__file__).resolve().parents[2]
TEMPLATE_DIR = BACKEND_DIR / "resource"

# Jinja2 environment
env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(['html', 'xml'])
)


def render_template(template_name: str, **context) -> str:
    """Render a Jinja2 template with the given context."""
    template = env.get_template(template_name)
    return template.render(**context)


def render_email_draft_created(draft, pipeline_id: str) -> str:
    """Render the draft creation confirmation email template.

    Args:
        draft: DraftOut object containing draft information
        pipeline_id: Pipeline ID string
    """
    return render_template(
        "email_response/create_draft.html",
        draft=draft,
        pipeline_id=pipeline_id
    )


def render_email_trends(draft_ir,  pipeline_id: str, name: str = None) -> str:
    """Render the trends email template with DraftIR content.

    Args:
        draft_ir: DraftIR object containing trend content
        name: Optional name for personalization
    """
    return render_template(
        "email_response/trend_list.html",
        draft_ir=draft_ir,
        name=name,
        pipeline_id=pipeline_id
    )
