from __future__ import annotations

import json
from datetime import datetime
from typing import Iterable, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session

from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.campaigns.models import Campaign
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.insights.models import InsightComment
from apps.backend.src.modules.playbooks.models import Playbook, PlaybookLog
from apps.backend.src.modules.reactive.models import ReactionRule, ReactionRulePublication
from apps.backend.src.modules.trends.models import NewsItem, Trend

from .types import CanonicalPayload, EdgeReference, NodeReference


def build_persona_payload(session: Session, persona_id: int) -> Optional[CanonicalPayload]:
    persona = session.get(Persona, persona_id)
    if not persona:
        return None

    summary = persona.bio or f"{persona.name} persona profile"
    sections: List[str] = []

    if persona.pillars:
        sections.append(f"Content pillars: {', '.join(persona.pillars)}")
    if persona.style_guide:
        sections.append(f"Style guide: {persona.style_guide}")
    if persona.default_hashtags:
        sections.append(f"Default hashtags: {', '.join(persona.default_hashtags)}")
    if persona.media_prefs:
        sections.append(f"Media preferences: {json.dumps(persona.media_prefs, ensure_ascii=False)}")
    if persona.hashtag_rules:
        sections.append(f"Hashtag rules: {json.dumps(persona.hashtag_rules, ensure_ascii=False)}")

    playbooks = (
        session.query(Playbook.id, Playbook.campaign_id)
        .filter(Playbook.persona_id == persona.id)
        .all()
    )

    edges = [
        EdgeReference(
            src=node_ref("persona", "personas", persona.id),
            dst=node_ref("playbook", "playbooks", pb_id),
            edge_type="owns_playbook",
        )
        for pb_id, _ in playbooks
    ]

    return CanonicalPayload(
        node_type="persona",
        source_table="personas",
        source_id=str(persona.id),
        title=persona.name,
        summary=summary,
        body_sections=sections,
        meta={
            "language": persona.language,
            "tone": persona.tone,
            "pillars": persona.pillars,
            "default_hashtags": persona.default_hashtags,
        },
        owner_user_id=persona.owner_user_id,
        persona_id=persona.id,
        signature_extras={"updated_at": dt_iso(persona.updated_at)},
        edges=tuple(edges),
    )


def build_campaign_payload(session: Session, campaign_id: int) -> Optional[CanonicalPayload]:
    campaign = session.get(Campaign, campaign_id)
    if not campaign:
        return None

    summary = campaign.description or f"Campaign {campaign.name}"
    sections: List[str] = []
    if campaign.start_at or campaign.end_at:
        sections.append(
            f"Timeline: {dt_iso(campaign.start_at) or 'N/A'} → {dt_iso(campaign.end_at) or 'N/A'}"
        )

    playbooks = (
        session.query(Playbook.id, Playbook.persona_id)
        .filter(Playbook.campaign_id == campaign.id)
        .all()
    )

    edges = [
        EdgeReference(
            src=node_ref("campaign", "campaigns", campaign.id),
            dst=node_ref("playbook", "playbooks", pb_id),
            edge_type="has_playbook",
        )
        for pb_id, _ in playbooks
    ]

    return CanonicalPayload(
        node_type="campaign",
        source_table="campaigns",
        source_id=str(campaign.id),
        title=campaign.name,
        summary=summary,
        body_sections=sections,
        meta={"owner_user_id": campaign.owner_user_id},
        owner_user_id=campaign.owner_user_id,
        campaign_id=campaign.id,
        signature_extras={"updated_at": dt_iso(campaign.created_at)},
        edges=tuple(edges),
    )


def build_playbook_payload(session: Session, playbook_id: int) -> Optional[CanonicalPayload]:
    playbook = session.get(Playbook, playbook_id)
    if not playbook:
        return None

    summary = playbook.summary or "Playbook summary not provided."
    sections: List[str] = []
    if playbook.aggregate_kpi:
        sections.append(
            f"KPI snapshot: {json.dumps(playbook.aggregate_kpi, ensure_ascii=False)}"
        )
    if playbook.best_time_window:
        sections.append(f"Best posting window: {playbook.best_time_window}")
    if playbook.best_tone:
        sections.append(f"Best tone: {playbook.best_tone}")
    if playbook.top_hashtags:
        sections.append(f"Top hashtags: {', '.join(playbook.top_hashtags)}")

    latest_logs: Sequence[Tuple[str, Optional[str]]] = (
        session.query(PlaybookLog.event, PlaybookLog.message)
        .filter(PlaybookLog.playbook_id == playbook.id)
        .order_by(PlaybookLog.timestamp.desc())
        .limit(5)
        .all()
    )
    if latest_logs:
        formatted_logs = [f"{event}: {message or ''}".strip() for event, message in latest_logs]
        sections.append("Recent events:\n- " + "\n- ".join(formatted_logs))

    edges = [
        EdgeReference(
            src=node_ref("playbook", "playbooks", playbook.id),
            dst=node_ref("persona", "personas", playbook.persona_id),
            edge_type="for_persona",
        ),
        EdgeReference(
            src=node_ref("playbook", "playbooks", playbook.id),
            dst=node_ref("campaign", "campaigns", playbook.campaign_id),
            edge_type="for_campaign",
        ),
    ]

    return CanonicalPayload(
        node_type="playbook",
        source_table="playbooks",
        source_id=str(playbook.id),
        title=f"Playbook #{playbook.id}",
        summary=summary,
        body_sections=sections,
        meta={
            "best_tone": playbook.best_tone,
            "best_time_window": playbook.best_time_window,
        },
        owner_user_id=playbook.persona.owner_user_id if playbook.persona else None,
        persona_id=playbook.persona_id,
        campaign_id=playbook.campaign_id,
        signature_extras={"last_updated": dt_iso(playbook.last_updated)},
        edges=tuple(edges),
    )


def build_draft_payload(session: Session, draft_id: int) -> Optional[CanonicalPayload]:
    draft = session.get(Draft, draft_id)
    if not draft:
        return None

    summary = draft.title or "Untitled draft"
    sections: List[str] = []

    if draft.goal:
        sections.append(f"Goal: {draft.goal}")
    if draft.tags:
        sections.append(f"Tags: {', '.join(draft.tags)}")

    sections.extend(extract_ir_sections(draft.ir))

    variants = (
        session.query(DraftVariant.id, DraftVariant.platform)
        .filter(DraftVariant.draft_id == draft.id)
        .all()
    )

    edges = [
        EdgeReference(
            src=node_ref("draft", "drafts", draft.id),
            dst=node_ref("draft_variant", "draft_variants", var_id),
            edge_type="produces",
            meta={"platform": str(platform)},
        )
        for var_id, platform in variants
    ]

    return CanonicalPayload(
        node_type="draft",
        source_table="drafts",
        source_id=str(draft.id),
        title=draft.title,
        summary=summary,
        body_sections=sections,
        meta={
            "goal": draft.goal,
            "campaign_id": draft.campaign_id,
            "ir_revision": draft.ir_revision,
        },
        owner_user_id=draft.user_id,
        campaign_id=draft.campaign_id,
        signature_extras={
            "updated_at": dt_iso(draft.updated_at),
            "ir_revision": draft.ir_revision,
        },
        edges=tuple(edges),
    )


def build_variant_payload(session: Session, variant_id: int) -> Optional[CanonicalPayload]:
    variant = session.get(DraftVariant, variant_id)
    if not variant:
        return None

    summary = variant.rendered_caption or f"{variant.platform} variant"
    sections: List[str] = []
    if variant.metrics:
        sections.append(
            f"Metrics: {json.dumps(variant.metrics, ensure_ascii=False)}"
        )
    if variant.rendered_blocks:
        sections.append(
            f"Rendered blocks: {json.dumps(variant.rendered_blocks, ensure_ascii=False)}"
        )

    publications = (
        session.query(PostPublication.id, PostPublication.platform)
        .filter(PostPublication.variant_id == variant.id)
        .all()
    )

    edges = [
        EdgeReference(
            src=node_ref("draft_variant", "draft_variants", variant.id),
            dst=node_ref("draft", "drafts", variant.draft_id),
            edge_type="variant_of",
        )
    ] + [
        EdgeReference(
            src=node_ref("draft_variant", "draft_variants", variant.id),
            dst=node_ref("post_publication", "post_publications", pub_id),
            edge_type="published_as",
            meta={"platform": str(platform)},
        )
        for pub_id, platform in publications
    ]

    return CanonicalPayload(
        node_type="draft_variant",
        source_table="draft_variants",
        source_id=str(variant.id),
        title=f"Variant {variant.platform}",
        summary=summary,
        body_sections=sections,
        meta={
            "platform": str(variant.platform),
            "status": str(variant.status),
        },
        owner_user_id=variant.draft_owner_id if hasattr(variant, "draft_owner_id") else None,
        campaign_id=variant.draft.campaign_id if variant.draft else None,
        signature_extras={
            "updated_at": dt_iso(variant.updated_at),
            "compiler_version": variant.compiler_version,
        },
        edges=tuple(edges),
    )


def build_publication_payload(session: Session, publication_id: int) -> Optional[CanonicalPayload]:
    publication = session.get(PostPublication, publication_id)
    if not publication:
        return None

    summary = publication.permalink or f"Publication {publication.id}"
    sections: List[str] = []

    if publication.status:
        sections.append(f"Status: {publication.status}")
    if publication.published_at:
        sections.append(f"Published at: {dt_iso(publication.published_at)}")
    if publication.last_polled_at:
        sections.append(f"Last polled: {dt_iso(publication.last_polled_at)}")
    if publication.meta:
        sections.append(
            f"Metadata: {json.dumps(publication.meta, ensure_ascii=False)}"
        )

    edges = [
        EdgeReference(
            src=node_ref("post_publication", "post_publications", publication.id),
            dst=node_ref("draft_variant", "draft_variants", publication.variant_id),
            edge_type="publication_of",
            meta={"platform": str(publication.platform)},
        )
    ]

    return CanonicalPayload(
        node_type="post_publication",
        source_table="post_publications",
        source_id=str(publication.id),
        title=f"Publication {publication.external_id or publication.id}",
        summary=summary,
        body_sections=sections,
        meta={
            "platform": str(publication.platform),
            "permalink": publication.permalink,
        },
        owner_user_id=publication.persona_account.persona.owner_user_id
        if publication.persona_account and publication.persona_account.persona
        else None,
        campaign_id=publication.variant.draft.campaign_id
        if publication.variant and publication.variant.draft
        else None,
        signature_extras={"updated_at": dt_iso(publication.updated_at)},
        edges=tuple(edges),
    )


def build_trend_payload(session: Session, trend_id: int) -> Optional[CanonicalPayload]:
    trend = session.get(Trend, trend_id)
    if not trend:
        return None

    summary = trend.title
    sections: List[str] = []
    if trend.approx_traffic:
        sections.append(f"Traffic: {trend.approx_traffic}")
    if trend.link:
        sections.append(f"Primary link: {trend.link}")
    if trend.news_items:
        sections.append(
            "Related news:\n- " + "\n- ".join(_format_news_item(item) for item in trend.news_items)
        )

    return CanonicalPayload(
        node_type="trend",
        source_table="trends",
        source_id=str(trend.id),
        title=f"{trend.country} #{trend.rank}",
        summary=summary,
        body_sections=sections,
        meta={
            "country": trend.country,
            "retrieved": dt_iso(trend.retrieved),
            "rank": trend.rank,
        },
        signature_extras={"retrieved": dt_iso(trend.retrieved)},
    )


def build_insight_comment_payload(session: Session, comment_id: int) -> Optional[CanonicalPayload]:
    comment = session.get(InsightComment, comment_id)
    if not comment:
        return None

    summary = (comment.text or "").strip() or f"Comment {comment.comment_external_id}"
    summary = summary[:240]

    sections: List[str] = []
    if comment.metrics:
        sections.append(
            f"Metrics: {json.dumps(comment.metrics, ensure_ascii=False)}"
        )
    if comment.raw:
        sections.append(
            f"Raw payload: {json.dumps(comment.raw, ensure_ascii=False)[:800]}"
        )

    persona_id = None
    if comment.account_persona_id:
        persona_account = session.get(PersonaAccount, comment.account_persona_id)
        if persona_account:
            persona_id = persona_account.persona_id

    edges: List[EdgeReference] = []
    if comment.post_publication_id:
        edges.append(
            EdgeReference(
                src=node_ref("insight_comment", "insight_comments", comment.id),
                dst=node_ref("post_publication", "post_publications", comment.post_publication_id),
                edge_type="comment_on",
            )
        )

    return CanonicalPayload(
        node_type="insight_comment",
        source_table="insight_comments",
        source_id=str(comment.id),
        title=f"Comment by {comment.author_username or 'unknown'}",
        summary=summary,
        body_sections=sections,
        meta={
            "platform": str(comment.platform),
            "permalink": comment.permalink,
            "comment_external_id": comment.comment_external_id,
            "author": comment.author_username,
            "is_owned_by_me": comment.is_owned_by_me,
        },
        owner_user_id=comment.owner_user_id,
        persona_id=persona_id,
        signature_extras={
            "ingested_at": dt_iso(comment.ingested_at),
            "updated_at": dt_iso(comment.comment_created_at),
        },
        edges=tuple(edges),
    )


def build_reaction_rule_payload(session: Session, rule_id: int) -> Optional[CanonicalPayload]:
    rule = session.get(ReactionRule, rule_id)
    if not rule:
        return None

    summary = rule.description or f"Reaction rule {rule.name}"
    sections: List[str] = []

    keywords = [kw.keyword for kw in rule.keywords if kw.is_active]
    if keywords:
        sections.append("Active keywords: " + ", ".join(keywords[:40]))
    actions = [
        f"{action.tag_key}: {json.dumps(action.metadata_json, ensure_ascii=False)}"
        for action in rule.actions
    ]
    if actions:
        sections.append("Actions:\n- " + "\n- ".join(actions[:6]))

    edges: List[EdgeReference] = []
    publications = (
        session.query(ReactionRulePublication)
        .filter(ReactionRulePublication.reaction_rule_id == rule.id)
        .all()
    )
    for publication in publications:
        edges.append(
            EdgeReference(
                src=node_ref("reaction_rule", "reaction_rules", rule.id),
                dst=node_ref("post_publication", "post_publications", publication.post_publication_id),
                edge_type="watches_publication",
                meta={
                    "priority": publication.priority,
                    "active": publication.is_active,
                },
            )
        )

    return CanonicalPayload(
        node_type="reaction_rule",
        source_table="reaction_rules",
        source_id=str(rule.id),
        title=rule.name,
        summary=summary,
        body_sections=sections,
        meta={
            "status": str(rule.status),
            "priority": rule.priority,
            "keywords_count": len(rule.keywords),
        },
        owner_user_id=rule.owner_user_id,
        signature_extras={"updated_at": dt_iso(rule.updated_at)},
        edges=tuple(edges),
    )


# Helper utilities -----------------------------------------------------------------


def node_ref(node_type: str, source_table: str, source_id: int | str) -> NodeReference:
    return NodeReference(node_type=node_type, source_table=source_table, source_id=str(source_id))


def dt_iso(value: Optional[datetime]) -> Optional[str]:
    if not value:
        return None
    return value.isoformat()


def extract_ir_sections(ir: Optional[dict]) -> List[str]:
    if not ir:
        return []

    sections: List[str] = []
    blocks = ir.get("blocks") if isinstance(ir, dict) else None
    if isinstance(blocks, list):
        for block in blocks:
            if not isinstance(block, dict):
                continue
            text = block.get("text") or block.get("raw") or block.get("content")
            if isinstance(text, str):
                sections.append(text)
            elif isinstance(text, list):
                sections.extend(str(item) for item in text if item)
    return sections


def _format_news_item(item: NewsItem) -> str:
    parts: List[str] = []
    if item.title:
        parts.append(item.title)
    if item.source:
        parts.append(f"({item.source})")
    if item.url:
        parts.append(item.url)
    return " ".join(parts)
