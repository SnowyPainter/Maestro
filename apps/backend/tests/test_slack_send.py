import pytest
import sys
import os
from unittest.mock import patch, MagicMock

# 프로젝트 경로를 sys.path에 추가
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, project_root)

from apps.backend.src.services.alerts.slack import send_message, notify_failure
from apps.backend.src.core.config import settings


def test_send_message_success():
    """슬랙 메시지 전송 성공 테스트"""
    # 실제 webhook URL이 설정되어 있으면 실제 테스트
    if settings.SLACK_ALERT_WEBHOOK_URL:
        result = send_message(text="테스트 메시지입니다")
        assert result is True
        print("✅ 슬랙 메시지 전송 성공")
    else:
        print("⚠️  SLACK_ALERT_WEBHOOK_URL이 설정되지 않아 실제 전송 테스트를 건너뜁니다")


def test_send_message_no_webhook():
    """웹훅 URL이 없을 때 테스트"""
    with patch.object(settings, 'SLACK_ALERT_WEBHOOK_URL', None):
        result = send_message(text="테스트 메시지")
        assert result is False
        print("✅ 웹훅 URL 없음 시 False 반환 확인")


def test_send_message_with_blocks():
    """블록이 포함된 메시지 전송 테스트"""
    if settings.SLACK_ALERT_WEBHOOK_URL:
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*테스트 제목*"
                }
            }
        ]
        result = send_message(text="블록 테스트", blocks=blocks)
        assert result is True
        print("✅ 블록 메시지 전송 성공")
    else:
        print("⚠️  SLACK_ALERT_WEBHOOK_URL이 설정되지 않아 블록 전송 테스트를 건너뜁니다")


def test_notify_failure():
    """태스크 실패 알림 테스트"""
    if settings.SLACK_ALERT_WEBHOOK_URL:
        result = notify_failure(
            queue="test_queue",
            task_name="test_task",
            task_id="test-123",
            exception=ValueError("테스트 에러"),
            retries=1,
            args=["arg1", "arg2"],
            kwargs={"key": "value"}
        )
        assert result is True
        print("✅ 실패 알림 전송 성공")
    else:
        print("⚠️  SLACK_ALERT_WEBHOOK_URL이 설정되지 않아 실패 알림 테스트를 건너뜁니다")


def test_notify_failure_minimal():
    """최소 정보로 실패 알림 테스트"""
    if settings.SLACK_ALERT_WEBHOOK_URL:
        result = notify_failure(
            queue=None,
            task_name="minimal_test_task",
            task_id=None,
            exception=None,
            retries=None,
            args=None,
            kwargs=None
        )
        assert result is True
        print("✅ 최소 정보 실패 알림 전송 성공")
    else:
        print("⚠️  SLACK_ALERT_WEBHOOK_URL이 설정되지 않아 최소 정보 실패 알림 테스트를 건너뜁니다")


def test_send_message_http_error():
    """HTTP 에러 발생 시 테스트"""
    import httpx
    if settings.SLACK_ALERT_WEBHOOK_URL:
        # HTTP 에러를 시뮬레이션하기 위해 httpx.HTTPError를 발생시키는 mock 사용
        with patch('apps.backend.src.services.http_clients.SLACK_CLIENT.post') as mock_post:
            mock_post.side_effect = httpx.HTTPError("HTTP Error")
            result = send_message(text="에러 테스트 메시지")
            assert result is False
            print("✅ HTTP 에러 시 False 반환 확인")
    else:
        print("⚠️  SLACK_ALERT_WEBHOOK_URL이 설정되지 않아 HTTP 에러 테스트를 건너뜁니다")


if __name__ == "__main__":
    # 직접 실행 시 모든 테스트 실행
    print("슬랙 알림 테스트 시작...")
    print(f"SLACK_ALERT_WEBHOOK_URL 설정 상태: {'설정됨' if settings.SLACK_ALERT_WEBHOOK_URL else '미설정'}")
    print("-" * 50)

    test_send_message_success()
    test_send_message_no_webhook()
    test_send_message_with_blocks()
    test_notify_failure()
    test_notify_failure_minimal()
    test_send_message_http_error()

    print("-" * 50)
    print("슬랙 알림 테스트 완료!")
