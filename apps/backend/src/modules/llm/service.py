from __future__ import annotations
import json
import time
import uuid
from typing import Any, Dict, Optional, Type

from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.runnables import RunnableSequence

from apps.backend.src.core.config import settings  # 환경변수에서 GEMINI 키/모델명 로드 가정
from .prompt_registry import PromptRegistry
from .schemas import (
    PromptKey, PromptVars,
    LlmInvokeContext, LlmResult,
    PROMPT_OUTPUT_SCHEMA
)
from .models import LLMUsage


class LLMService:
    """Gemini + LangChain 기반 LLM 서비스 (JSON only, async ainvoke) — 싱글톤"""

    _instance: Optional["LLMService"] = None

    def __init__(self):
        model_name = settings.LLM_PRIMARY_MODEL
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        # LangChain Chat Model
        self._model = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.4,
            convert_system_message_to_human=True,
        )
        self._model_name = model_name
        self._registry = PromptRegistry()

        # 비용 단가 (필요시 모델별 테이블로 확장)
        self._cost_prompt_per_1k = float(settings.COST_PER_1K_PROMPT)
        self._cost_completion_per_1k = float(settings.COST_PER_1K_COMPLETION)

    @classmethod
    def instance(cls) -> "LLMService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def ainvoke(
        self,
        prompt_key: PromptKey,
        vars: PromptVars,
        *,
        ctx: Optional[LlmInvokeContext] = None,
        version: Optional[str] = None,
        session: Optional[AsyncSession] = None,
    ) -> Dict[str, Any]:
        """
        모든 출력은 JSON. 유효성 검증 후 JSON(dict)만 반환.
        LLM 활동은 LLMUsage로 추적 기록.
        """
        ctx = ctx or LlmInvokeContext()
        usage_id = str(uuid.uuid4())

        # 1) 프롬프트 생성
        prompt_text = self._registry.render(prompt_key, vars, version=version)

        # 2) 모델 체인 구성 (간단: System/Human 메시지 → 텍스트)
        messages = [
            SystemMessage(content="You MUST return STRICT JSON only. No prose."),
            HumanMessage(content=prompt_text),
        ]
        chain: RunnableSequence = self._model  # 메시지 리스트를 바로 전달

        started = time.perf_counter()
        success = True
        err_code = None
        err_msg = None
        tokens_in = None
        tokens_out = None
        latency_ms = None
        cost_usd = None
        raw_text = ""

        try:
            # 3) 호출
            response = await chain.ainvoke(messages)
            raw_text = getattr(response, "content", "") or ""
            latency_ms = int((time.perf_counter() - started) * 1000)

            # 4) JSON 파싱
            data = self._parse_json_strict(raw_text)

            # 5) 스키마 검증 (프롬프트 키별)
            model_cls: Type[BaseModel] = PROMPT_OUTPUT_SCHEMA[prompt_key]
            validated = model_cls.model_validate(data)

            # 6) 토큰/비용 (Gemini는 토큰 집계가 제한적 → 없으면 None)
            # 필요시 provider response에서 usage 추출로 확장
            cost_usd = self._estimate_cost_usd(tokens_in, tokens_out)

            # 7) Usage 저장
            await self._save_usage(
                session=session,
                usage_id=usage_id,
                prompt_key=prompt_key.value,
                version=version,
                ctx=ctx,
                model=self._model_name,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_usd=cost_usd,
                latency_ms=latency_ms,
                success=True,
                error_code=None,
                error_message=None,
                meta={
                    "prompt_preview": prompt_text[:300],
                    "response_preview": raw_text[:300],
                },
            )

            # 8) 서비스 표준 JSON으로 반환
            result = LlmResult(
                data=validated.model_dump(),
                model=self._model_name,
                tokens_prompt=tokens_in,
                tokens_completion=tokens_out,
                cost_usd=cost_usd,
                latency_ms=latency_ms,
                meta={"usage_id": usage_id},
            )
            return result.model_dump()

        except (json.JSONDecodeError, ValidationError) as e:
            success = False
            err_code = "INVALID_JSON"
            err_msg = str(e)
            await self._save_usage(
                session=session,
                usage_id=usage_id,
                prompt_key=prompt_key.value,
                version=version,
                ctx=ctx,
                model=self._model_name,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_usd=cost_usd,
                latency_ms=latency_ms,
                success=False,
                error_code=err_code,
                error_message=err_msg,
                meta={"prompt_preview": prompt_text[:300], "raw_text": raw_text[:300]},
            )
            # JSON만 허용: 파싱 실패 시 에러 JSON
            return {
                "error": {
                    "code": err_code,
                    "message": "Model did not return valid JSON matching the schema.",
                    "detail": err_msg,
                    "usage_id": usage_id,
                }
            }
        except Exception as e:
            success = False
            err_code = "LLM_INVOCATION_ERROR"
            err_msg = str(e)
            await self._save_usage(
                session=session,
                usage_id=usage_id,
                prompt_key=prompt_key.value,
                version=version,
                ctx=ctx,
                model=self._model_name,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_usd=cost_usd,
                latency_ms=latency_ms,
                success=False,
                error_code=err_code,
                error_message=err_msg,
                meta={"prompt_preview": prompt_text[:300]},
            )
            return {
                "error": {
                    "code": err_code,
                    "message": "LLM invocation failed.",
                    "detail": err_msg,
                    "usage_id": usage_id,
                }
            }

    # -------- internals --------

    def _parse_json_strict(self, text: str) -> Dict[str, Any]:
        """모델 응답에서 JSON만 받아들임 (코드펜스/설명 제거 시도 포함)."""
        txt = text.strip()
        if txt.startswith("```"):
            # ```json ... ``` 감싸진 형태 처리
            try:
                fence = "```"
                first = txt.find(fence)
                last = txt.rfind(fence)
                if first != -1 and last != -1 and last > first:
                    inner = txt[first + len(fence):last]
                    # 언어 힌트(json) 제거
                    inner = inner.lstrip("json").strip()
                    return json.loads(inner)
            except Exception:
                pass
        return json.loads(txt)

    def _estimate_cost_usd(self, tokens_in: Optional[int], tokens_out: Optional[int]) -> Optional[float]:
        if tokens_in is None or tokens_out is None:
            return None
        prompt_cost = (tokens_in / 1000.0) * self._cost_prompt_per_1k
        completion_cost = (tokens_out / 1000.0) * self._cost_completion_per_1k
        return round(prompt_cost + completion_cost, 6)

    async def _save_usage(
        self,
        *,
        session: Optional[AsyncSession],
        usage_id: str,
        prompt_key: str,
        version: Optional[str],
        ctx: LlmInvokeContext,
        model: str,
        tokens_in: Optional[int],
        tokens_out: Optional[int],
        cost_usd: Optional[float],
        latency_ms: Optional[int],
        success: bool,
        error_code: Optional[str],
        error_message: Optional[str],
        meta: dict,
    ) -> None:
        if session is None:
            # 세션이 없으면 로깅만 하고 종료(환경에 따라 주입 권장)
            return
        rec = LLMUsage(
            id=usage_id,
            request_id=ctx.request_id,
            user_id=ctx.user_id,
            account_id=ctx.account_id,
            endpoint=ctx.endpoint,
            action=ctx.action,
            trace_parent=ctx.trace_parent,
            idempotency_key=ctx.idempotency_key,
            model=model,
            prompt_key=prompt_key,
            version=version,
            tokens_prompt=tokens_in,
            tokens_completion=tokens_out,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
            success=success,
            error_code=error_code,
            error_message=error_message,
            meta=meta,
        )
        session.add(rec)
        await session.commit()
