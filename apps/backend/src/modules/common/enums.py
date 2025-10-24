# src/modules/common/enums.py
import enum

class PlatformKind(str, enum.Enum):
    INSTAGRAM = "instagram"
    THREADS = "threads"

class DraftState(str, enum.Enum):
    DRAFT = "draft"
    DELETED = "deleted" # Soft Delete

class VariantStatus(str, enum.Enum):
    PENDING = "pending"      # 아직 미지원/대기
    VALID = "valid"          # 제약 충족
    INVALID = "invalid"      # 제약 위반
    RENDERED = "rendered"    # (선택) 최종 페이로드 확정

"""
    cases
    1) DRAFT -> SCHEDULED -> MONITORING -> finish monitoring -> PUBLISHED
    2) DRAFT -> MONITORING -> finish monitoring -> PUBLISHED
"""
class PostStatus(str, enum.Enum):
    PENDING = "pending" # Pending to publish
    SCHEDULED = "scheduled" # Scheduled for future publish
    PUBLISHED = "published" # After Published, Monitoring finished/cancel monitoring
    DELETED = "deleted" # Soft Delete
    FAILED = "failed" # Failed to publish
    CANCELLED = "cancelled" # Cancelled to publish
    MONITORING = "monitoring" # After Published, Monitoring started

class KPIKey(str, enum.Enum):
    REACH = "reach"
    IMPRESSIONS = "impressions"
    LIKES = "likes"
    COMMENTS = "comments"
    SHARES = "shares"          # repost/retweet 포함
    SAVES = "saves"
    FOLLOWS = "follows"
    LINK_CLICKS = "link_clicks"
    PROFILE_VISITS = "profile_visits"
    CTR = "ctr"                # link_clicks / impressions
    ER = "engagement_rate"     # (likes+comments+shares+saves)/impressions

class Aggregation(str, enum.Enum):
    SUM = "sum"
    LAST = "last"
    AVG = "avg"

class Permission(str, enum.Enum):
    READ = "read"
    WRITE = "write"
    PUBLISH = "publish"

class MetricsScope(str, enum.Enum):
    LIFETIME = "lifetime"
    SINCE_PUBLISH = "since_publish"
    INTERVAL = "interval"

class ContentKind(str, enum.Enum):
    POST = "post"          # 정적 이미지/텍스트
    VIDEO = "video"        # 일반 영상
    STORY = "story"
    CAROUSEL = "carousel"
    LIVE = "live"
    UNKNOWN = "unknown"

class InsightSource(str, enum.Enum):
    WEBHOOK = "webhook"
    POLL = "poll"
    MANUAL = "manual"

DO_NOT_RECOMPILE_STATUS = {PostStatus.SCHEDULED, PostStatus.PUBLISHED, PostStatus.MONITORING}
ALREADY_PUBLISHED_STATUS = {PostStatus.PUBLISHED, PostStatus.MONITORING}

class ScheduleStatus(str, enum.Enum):
    PENDING = "pending"
    ENQUEUED = "enqueued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ReactionRuleStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"

class ReactionMatchType(str, enum.Enum):
    EXACT = "exact"
    CONTAINS = "contains"
    REGEX = "regex"

class ReactionActionType(str, enum.Enum):
    DM = "dm"
    REPLY = "reply"
    ALERT = "alert"

class ReactionActionStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"

class ReactionLLMMode(str, enum.Enum):
    TEMPLATE_ONLY = "template_only"
    TEMPLATE_WITH_LLM_AUGMENT = "template_with_llm_augment"
