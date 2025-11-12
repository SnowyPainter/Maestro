#!/usr/bin/env python3
"""
Utility to backfill Graph RAG nodes/edges for existing records.

Examples:
  # Re-sync every playbook and draft (including ones that already have graph nodes)
  python scripts/resync_rag.py --entities playbook draft

  # Only re-sync playbooks missing graph_node_id
  python scripts/resync_rag.py --entities playbook --only-missing

  # Re-sync specific IDs
  python scripts/resync_rag.py --entities trend --ids 12 34 56
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from sqlalchemy import select

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from apps.backend.src.modules.playbooks.models import Playbook
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.campaigns.models import Campaign
from apps.backend.src.modules.accounts.models import Persona
from apps.backend.src.modules.trends.models import Trend
from apps.backend.src.modules.insights.models import InsightComment
from apps.backend.src.modules.reactive.models import ReactionRule
from apps.backend.src.services.rag_sidecar.canonicalizers import (
    build_campaign_payload,
    build_draft_payload,
    build_insight_comment_payload,
    build_persona_payload,
    build_playbook_payload,
    build_publication_payload,
    build_reaction_rule_payload,
    build_trend_payload,
    build_variant_payload,
)
from apps.backend.src.services.rag_sidecar.graph_sync import sync_payload
from apps.backend.src.workers.RAG.tasks import SessionLocal

EntityName = str

ENTITY_CONFIG = {
    "persona": (Persona, build_persona_payload),
    "campaign": (Campaign, build_campaign_payload),
    "playbook": (Playbook, build_playbook_payload),
    "draft": (Draft, build_draft_payload),
    "draft_variant": (DraftVariant, build_variant_payload),
    "post_publication": (PostPublication, build_publication_payload),
    "trend": (Trend, build_trend_payload),
    "insight_comment": (InsightComment, build_insight_comment_payload),
    "reaction_rule": (ReactionRule, build_reaction_rule_payload),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill Graph RAG canonical payloads")
    parser.add_argument(
        "--entities",
        nargs="+",
        choices=sorted(ENTITY_CONFIG.keys()),
        default=["playbook", "draft", "trend"],
        help="Which entity types to re-sync (default: playbook draft trend)",
    )
    parser.add_argument(
        "--ids",
        nargs="*",
        type=int,
        help="Explicit IDs to re-sync (applies when a single entity is provided)",
    )
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Only process rows whose graph_node_id is NULL",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit the number of IDs per entity",
    )
    return parser.parse_args()


def fetch_ids(entity: EntityName, ids: Optional[Sequence[int]], only_missing: bool, limit: Optional[int]) -> List[int]:
    model, _ = ENTITY_CONFIG[entity]
    with SessionLocal() as session:
        stmt = select(model.id)
        if ids:
            stmt = stmt.where(model.id.in_(ids))
        if only_missing and hasattr(model, "graph_node_id"):
            stmt = stmt.where(getattr(model, "graph_node_id").is_(None))
        stmt = stmt.order_by(model.id.asc())
        if limit:
            stmt = stmt.limit(limit)
        return [row[0] for row in session.execute(stmt).all()]


def resync_entity(entity: EntityName, ids: Iterable[int]) -> None:
    model, builder = ENTITY_CONFIG[entity]
    processed = 0
    with SessionLocal() as session:
        for ident in ids:
            payload = builder(session, ident)
            if not payload:
                print(f"[skip] {entity} id={ident} has no payload", flush=True)
                continue
            result = sync_payload(session, payload)
            status = "skipped" if result.skipped else "updated"
            print(f"[{status}] {entity} id={ident}", flush=True)
            processed += 1
    print(f"==> {entity}: processed {processed} items")


def main() -> None:
    args = parse_args()
    if args.ids and len(args.entities) != 1:
        raise SystemExit("--ids can only be used with a single entity type")

    for entity in args.entities:
        id_list = args.ids if args.ids else fetch_ids(entity, None, args.only_missing, args.limit)
        if not id_list:
            print(f"[info] {entity}: nothing to process")
            continue
        resync_entity(entity, id_list)


if __name__ == "__main__":
    main()
