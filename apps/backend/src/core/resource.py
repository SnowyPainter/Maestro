"""Resource utilities for templates and assets."""

from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

# Point to apps/backend/src/resource directory
CURRENT_FILE = Path(__file__).resolve()
SRC_DIR = CURRENT_FILE.parents[2] / "src"
TEMPLATE_DIR = SRC_DIR / "resource"

# Jinja2 environment
env = Environment(
    loader=FileSystemLoader([TEMPLATE_DIR / "email_response", TEMPLATE_DIR]),
    autoescape=select_autoescape(['html', 'xml'])
)


def render_template(template_name: str, **context) -> str:
    template = env.get_template(template_name)
    return template.render(**context)


def render_email_draft_created(draft, pipeline_id: str, user_text: str | None = None) -> str:
    return render_template(
        "email_response/create_draft.html",
        draft=draft,
        pipeline_id=pipeline_id,
        user_text=user_text,
    )


def render_email_trends(draft_ir,  pipeline_id: str, name: str = None) -> str:
    return render_template(
        "email_response/trend_list.html",
        draft_ir=draft_ir,
        name=name,
        pipeline_id=pipeline_id
    )
