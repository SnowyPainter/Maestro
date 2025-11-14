#!/usr/bin/env python3
"""
Create a one-off Graph RAG node for experimentation.

Example:
    python scripts/insert_graph_rag_node.py \
        --owner-user-id 123 \
        --persona-id 42 \
        --campaign-id 77 \
        --node-type trend \
        --source-table trends \
        --source-id sandbox-001 \
        --title "테스트 트렌드" \
        --summary "AI 캠페인 트렌드 실험" \
        --body-section "상세 설명 본문" \
        --meta theme=trend --meta tags='["experiment"]'
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, Sequence

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from apps.backend.src.services.rag_sidecar.graph_sync import sync_payload
from apps.backend.src.services.rag_sidecar.types import CanonicalPayload
from apps.backend.src.workers.RAG.tasks import SessionLocal


def _parse_meta(pairs: Sequence[str]) -> Dict[str, Any]:
    meta: Dict[str, Any] = {}
    for pair in pairs:
        if "=" not in pair:
            raise argparse.ArgumentTypeError(f"--meta '{pair}' must look like key=value")
        key, raw_value = pair.split("=", 1)
        try:
            meta[key] = json.loads(raw_value)
        except json.JSONDecodeError:
            meta[key] = raw_value
    return meta


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Insert a synthetic Graph RAG node")
    parser.add_argument("--owner-user-id", type=int, required=True)
    parser.add_argument("--persona-id", type=int, required=True)
    parser.add_argument("--campaign-id", type=int, required=True)
    parser.add_argument("--node-type", required=True, help="e.g. trend / draft / playbook")
    parser.add_argument("--source-table", required=True, help="Logical origin, e.g. trends")
    parser.add_argument("--source-id", required=True, help="External identifier (string)")
    parser.add_argument("--title", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument(
        "--body-section",
        action="append",
        default=[],
        help="Repeat for additional body sections",
    )
    parser.add_argument(
        "--meta",
        action="append",
        default=[],
        help="key=value pairs (value parsed as JSON when possible)",
    )
    parser.add_argument(
        "--embedding-provider",
        default="tei",
        help="Override embedding provider label",
    )
    parser.add_argument(
        "--embedding-model",
        default="multilingual-e5-base",
        help="Override embedding model label",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    meta = _parse_meta(args.meta)
    body_sections = args.body_section or []

    payload = CanonicalPayload(
        node_type=args.node_type,
        source_table=args.source_table,
        source_id=args.source_id,
        title=args.title,
        summary=args.summary,
        body_sections=body_sections or [args.summary],
        meta=meta,
        owner_user_id=args.owner_user_id,
        persona_id=args.persona_id,
        campaign_id=args.campaign_id,
        embedding_provider=args.embedding_provider,
        embedding_model=args.embedding_model,
    )

    with SessionLocal() as session:
        result = sync_payload(session, payload)

    status = "skipped (no change)" if result.skipped else "inserted/updated"
    print(
        f"[{status}] node_id={result.node.id} "
        f"chunks={result.chunks_synced} edges={result.edges_synced}"
    )


if __name__ == "__main__":
    main()
