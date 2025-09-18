import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from jose import JWTError
from .context import set_request_id, set_user_id, set_persona_account_id
from .security import decode_token

class ContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-Id") or str(uuid.uuid4())

        set_request_id(rid)

        request.state.user = None  # lazy 캐시용
        set_user_id(None)
        
        persona_account_id = request.headers.get("X-Persona-Account-Id")
        if persona_account_id:
            set_persona_account_id(persona_account_id)

        auth = request.headers.get("Authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            try:
                payload = decode_token(token)
                uid = str(payload.get("sub")) if payload.get("sub") is not None else None
                set_user_id(uid)
            except JWTError:
                set_user_id(None)

        response = await call_next(request)
        response.headers["X-Request-Id"] = rid
        return response
