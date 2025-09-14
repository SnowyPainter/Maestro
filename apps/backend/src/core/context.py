from contextvars import ContextVar
from typing import Union

request_id_ctx: ContextVar[Union[str, None]] = ContextVar("request_id", default=None)
user_id_ctx: ContextVar[Union[str, None]] = ContextVar("user_id", default=None)

def set_request_id(val: Union[str, None]): request_id_ctx.set(val)
def get_request_id() -> Union[str, None]:  return request_id_ctx.get()

def set_user_id(val: Union[str, None]): user_id_ctx.set(val)
def get_user_id() -> Union[str, None]:  return user_id_ctx.get()