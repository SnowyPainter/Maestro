# src/modules/common/enums.py
import enum

class PlatformKind(str, enum.Enum):
    INSTAGRAM = "instagram"
    THREADS = "threads"
    X = "x"
    BLOG = "blog"

"""
    cases
    1) DRAFT -> SCHEDULED -> MONITORING -> finish monitoring -> PUBLISHED
    2) DRAFT -> MONITORING -> finish monitoring -> PUBLISHED
"""
class DraftState(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published" # After Published, Monitoring finished/cancel monitoring
    SCHEDULED = "scheduled" # Scheduled to publish
    DELETED = "deleted" # Soft Delete
    MONITORING = "monitoring" # After Published, Monitoring started

class VariantStatus(str, enum.Enum):
    PENDING = "pending"      # 아직 미지원/대기
    VALID = "valid"          # 제약 충족
    INVALID = "invalid"      # 제약 위반
    RENDERED = "rendered"    # (선택) 최종 페이로드 확정

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