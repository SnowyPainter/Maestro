from __future__ import annotations

from datetime import timedelta

from celery import Celery
from apps.backend.src.core.config import settings
from apps.backend.src.core import celery_alerts  # noqa: F401 - register alert hooks
from apps.backend.src.core import celery_ctx  # noqa: F401 - ensure signal handlers register

# Celery 인스턴스
celery_app = Celery(
    "maestro",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "apps.backend.src.workers.Sniffer.tasks",
        "apps.backend.src.workers.Synchro.tasks",
        "apps.backend.src.workers.Adapter.tasks",
        "apps.backend.src.workers.CoWorker.execute_due_schedules",
        "apps.backend.src.workers.CoWorker.generate_texts",
        "apps.backend.src.workers.CoWorker.ingest_comments",
        "apps.backend.src.workers.RAG.tasks",
    ],
)

celery_app.conf.timezone = settings.TIMEZONE
celery_app.conf.task_default_queue = "default"
celery_app.conf.task_acks_late = True
celery_app.conf.worker_prefetch_multiplier = 1

# Asyncio 설정 - Celery 5.0+에서 기본 지원
celery_app.conf.worker_enable_asyncio = True
celery_app.conf.worker_disable_rate_limits = False

# 작업자 설정 최적화
celery_app.conf.worker_max_tasks_per_child = 1000  # 메모리 누수 방지
celery_app.conf.worker_max_memory_per_child = 200000  # 200MB 제한

# Beat 스케줄: 국가별 주기 수집 + 주기 캐시 리프레시
_interval = settings.TRENDS_INTERVAL_MINUTES
_countries = [c.strip() for c in settings.TRENDS_COUNTRIES.split(",") if c.strip()]

beat_schedule = {}
for c in _countries:
    beat_schedule[f"sniff_trends_{c}"] = {
        "task": "apps.backend.src.workers.Sniffer.tasks.sniff_google_trends",
        "schedule": timedelta(minutes=_interval),
        "options": {"queue": "sniffer"},
        "args": (c,),
    }

# 외부 소스 스케줄 (예: Hacker News, Reddit)
_external_sources = [
    {
        "key": "hn_frontpage",
        "task": "apps.backend.src.workers.Sniffer.tasks.sniff_hn_frontpage",
    },
    {
        "key": "reddit_all",
        "task": "apps.backend.src.workers.Sniffer.tasks.sniff_reddit_trends",
        "kwargs": {"subreddit": "all"},
    },
]

for src in _external_sources:
    beat_schedule[f"sniff_trends_{src['key']}"] = {
        "task": src["task"],
        "schedule": timedelta(minutes=_interval),
        "options": {"queue": "sniffer"},
        **({"kwargs": src["kwargs"]} if "kwargs" in src else {}),
    }

beat_schedule["refresh_trends_cache"] = {
    "task": "apps.backend.src.workers.Synchro.tasks.refresh_cache",
    "schedule": timedelta(minutes=_interval),
    "options": {"queue": "synchro"},
}

beat_schedule["sniff_mailbox"] = {
    "task": "apps.backend.src.workers.Sniffer.tasks.sniff_mailbox",
    "schedule": timedelta(seconds=60),
    "options": {"queue": "sniffer"},
}

beat_schedule["ensure_coworker_polls"] = {
    "task": "apps.backend.src.workers.coworker.ensure_coworker_polls",
    "schedule": timedelta(seconds=45),
    "options": {"queue": "coworker"},
}

beat_schedule["ingest_reactive_comments"] = {
    "task": "apps.backend.src.workers.CoWorker.ingest_comments.ingest_reactive_comments",
    "schedule": timedelta(seconds=60),
    "options": {"queue": "coworker"},
}

# Graph RAG sidecar schedules
beat_schedule["rag_watch_personas"] = {
    "task": "apps.backend.src.workers.RAG.tasks.watch_personas",
    "schedule": timedelta(seconds=120),
    "options": {"queue": "graph_rag"},
}
beat_schedule["rag_watch_campaigns"] = {
    "task": "apps.backend.src.workers.RAG.tasks.watch_campaigns",
    "schedule": timedelta(seconds=180),
    "options": {"queue": "graph_rag"},
}
beat_schedule["rag_watch_playbooks"] = {
    "task": "apps.backend.src.workers.RAG.tasks.watch_playbooks",
    "schedule": timedelta(seconds=180),
    "options": {"queue": "graph_rag"},
}
beat_schedule["rag_watch_drafts"] = {
    "task": "apps.backend.src.workers.RAG.tasks.watch_drafts",
    "schedule": timedelta(seconds=60),
    "options": {"queue": "graph_rag"},
}
beat_schedule["rag_watch_variants"] = {
    "task": "apps.backend.src.workers.RAG.tasks.watch_draft_variants",
    "schedule": timedelta(seconds=75),
    "options": {"queue": "graph_rag"},
}
beat_schedule["rag_watch_publications"] = {
    "task": "apps.backend.src.workers.RAG.tasks.watch_publications",
    "schedule": timedelta(seconds=120),
    "options": {"queue": "graph_rag"},
}
beat_schedule["rag_watch_trends"] = {
    "task": "apps.backend.src.workers.RAG.tasks.watch_trends",
    "schedule": timedelta(seconds=300),
    "options": {"queue": "graph_rag"},
}
beat_schedule["rag_watch_insights"] = {
    "task": "apps.backend.src.workers.RAG.tasks.watch_insights",
    "schedule": timedelta(seconds=90),
    "options": {"queue": "graph_rag"},
}
beat_schedule["rag_watch_reaction_rules"] = {
    "task": "apps.backend.src.workers.RAG.tasks.watch_reaction_rules",
    "schedule": timedelta(seconds=180),
    "options": {"queue": "graph_rag"},
}

celery_app.conf.beat_schedule = beat_schedule
