from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Mapping, MutableMapping, Optional

import httpx


@dataclass
class GraphAPIError(Exception):
    """Raised when a graph-style HTTP API returns an error response."""

    message: str
    status_code: Optional[int] = None
    payload: Optional[Dict[str, Any]] = None

    def __str__(self) -> str:  # pragma: no cover - dataclass convenience
        return self.message

    def as_message(self) -> str:
        return self.message


class GraphAPITransport:
    """Shared HTTP transport wrapper for Graph-style APIs."""

    def __init__(
        self,
        *,
        http: httpx.AsyncClient,
        base_url: str,
        default_params: Mapping[str, Any] | None = None,
    ) -> None:
        self._http = http
        self._base_url = base_url.rstrip("/")
        self._default_params: Dict[str, Any] = dict(default_params or {})

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        data: MutableMapping[str, Any] | None = None,
    ) -> httpx.Response:
        url = f"{self._base_url}/{path.lstrip('/')}"
        query: Dict[str, Any] = dict(self._default_params)
        if params:
            query.update({k: v for k, v in params.items() if v is not None})

        try:
            response = await self._http.request(method, url, params=query, data=data)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            payload = safe_json(exc.response)
            message = format_graph_error(exc.response, fallback=str(exc))
            raise GraphAPIError(message, status_code=exc.response.status_code, payload=payload) from exc
        except httpx.HTTPError as exc:
            raise GraphAPIError(f"graph api request failed: {exc}") from exc
        return response


class GraphAPIJSONClient:
    """Utility client that always expects JSON object responses."""

    def __init__(self, transport: GraphAPITransport) -> None:
        self._transport = transport

    async def post_json(
        self,
        path: str,
        *,
        data: MutableMapping[str, Any] | None = None,
        params: Mapping[str, Any] | None = None,
    ) -> Dict[str, Any]:
        response = await self._transport.request("POST", path, params=params, data=data)
        return ensure_json(response)

    async def get_json(
        self,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
    ) -> Dict[str, Any]:
        response = await self._transport.request("GET", path, params=params)
        return ensure_json(response)

    async def delete(self, path: str, *, params: Mapping[str, Any] | None = None) -> None:
        await self._transport.request("DELETE", path, params=params)


def ensure_json(response: httpx.Response) -> Dict[str, Any]:
    try:
        payload = response.json()
    except ValueError as exc:  # pragma: no cover - defensive guard
        raise GraphAPIError(
            "graph api returned invalid json",
            status_code=response.status_code,
        ) from exc
    if isinstance(payload, dict):
        return payload
    raise GraphAPIError(
        "graph api response must be a json object",
        status_code=response.status_code,
    )


def safe_json(response: httpx.Response) -> Dict[str, Any]:
    try:
        payload = response.json()
        if isinstance(payload, dict):
            return payload
    except ValueError:
        pass
    return {"text": response.text[:500]}


def format_graph_error(response: httpx.Response, *, fallback: str) -> str:
    payload = safe_json(response)
    error = payload.get("error")
    if isinstance(error, dict):
        message = error.get("message") or "graph api request failed"
        details = []
        if error.get("type"):
            details.append(f"type={error['type']}")
        if error.get("code") is not None:
            details.append(f"code={error['code']}")
        if error.get("error_subcode") is not None:
            details.append(f"subcode={error['error_subcode']}")
        if error.get("fbtrace_id"):
            details.append(f"trace={error['fbtrace_id']}")
        if details:
            return f"{message} ({', '.join(details)})"
        return message
    snippet = payload.get("text") or ""
    snippet = snippet.replace("\n", " ").strip()
    if snippet:
        return f"graph api request failed with status {response.status_code}: {snippet[:160]}"
    return fallback

