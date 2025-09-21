from contextvars import ContextVar
from typing import Dict, Optional, Union

persona_account_id_ctx: ContextVar[Union[str, None]] = ContextVar("persona_account_id", default=None)
request_id_ctx: ContextVar[Union[str, None]] = ContextVar("request_id", default=None)
user_id_ctx: ContextVar[Union[str, None]] = ContextVar("user_id", default=None)
draft_id_ctx: ContextVar[Union[str, None]] = ContextVar("draft_id", default=None)
campaign_id_ctx: ContextVar[Union[str, None]] = ContextVar("campaign_id", default=None)
user_memo_ctx: ContextVar[Union[str, None]] = ContextVar("user_memo", default=None)


def set_persona_account_id(val: Union[str, None]): persona_account_id_ctx.set(val)
def get_persona_account_id() -> Union[str, None]:  return persona_account_id_ctx.get()

def set_request_id(val: Union[str, None]): request_id_ctx.set(val)
def get_request_id() -> Union[str, None]:  return request_id_ctx.get()

def set_user_id(val: Union[str, None]): user_id_ctx.set(val)
def get_user_id() -> Union[str, None]:  return user_id_ctx.get()

def set_draft_id(val: Union[str, None]): draft_id_ctx.set(val)
def get_draft_id() -> Union[str, None]:  return draft_id_ctx.get()

def set_campaign_id(val: Union[str, None]): campaign_id_ctx.set(val)
def get_campaign_id() -> Union[str, None]:  return campaign_id_ctx.get()

def set_user_memo(val: Union[str, None]): user_memo_ctx.set(val)
def get_user_memo() -> Union[str, None]:  return user_memo_ctx.get()


_CONTEXT_GETTERS = {
    "persona_account_id": get_persona_account_id,
    "request_id": get_request_id,
    "user_id": get_user_id,
    "draft_id": get_draft_id,
    "campaign_id": get_campaign_id,
    "user_memo": get_user_memo,
}

_CONTEXT_SETTERS = {
    "persona_account_id": set_persona_account_id,
    "request_id": set_request_id,
    "user_id": set_user_id,
    "draft_id": set_draft_id,
    "campaign_id": set_campaign_id,
    "user_memo": set_user_memo,
}


def capture_context() -> Dict[str, Optional[str]]:
    """Take a point-in-time snapshot of known context variables."""

    return {key: getter() for key, getter in _CONTEXT_GETTERS.items()}


def apply_context(snapshot: Optional[Dict[str, Optional[str]]]) -> None:
    """Restore context variables from a captured snapshot."""

    if not snapshot:
        return

    for key, value in snapshot.items():
        setter = _CONTEXT_SETTERS.get(key)
        if setter is not None:
            setter(value)
