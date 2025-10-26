import asyncio
import os
import httpx
from typing import Dict, Any, Optional


async def fetch_instagram_comments(media_id: str, access_token: str, limit: int = 25) -> Dict[str, Any]:
    """
    Instagram Graph API를 사용하여 특정 미디어의 댓글을 가져옵니다.

    Args:
        media_id: Instagram 미디어 ID
        access_token: Instagram 액세스 토큰
        limit: 가져올 댓글 수 (최대 100)

    Returns:
        API 응답 데이터
    """
    base_url = "https://graph.instagram.com"
    endpoint = f"{base_url}/v24.0/{media_id}/comments"

    params = {
        "access_token": access_token,
        "fields": "id,text,username,timestamp,like_count,replies.limit(10){id,text,username,timestamp,like_count}",
        "limit": min(limit, 100)  # Instagram 최대 100개 제한
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(endpoint, params=params)
            response.raise_for_status()

            data = response.json()
            return {
                "success": True,
                "data": data.get("data", []),
                "paging": data.get("paging", {}),
                "raw_response": data
            }

        except httpx.HTTPStatusError as e:
            return {
                "success": False,
                "error": f"HTTP {e.response.status_code}: {e.response.text}",
                "status_code": e.response.status_code
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


async def get_instagram_account_info(user_id: str, access_token: str) -> Dict[str, Any]:
    """
    Instagram Graph API를 사용하여 계정 정보를 가져옵니다.
    """
    base_url = "https://graph.instagram.com"
    endpoint = f"{base_url}/v24.0/{user_id}"

    params = {
        "access_token": access_token,
        "fields": "id,username,account_type"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(endpoint, params=params)
            response.raise_for_status()
            return {"success": True, "data": response.json()}

        except httpx.HTTPStatusError as e:
            return {
                "success": False,
                "error": f"HTTP {e.response.status_code}: {e.response.text}",
                "status_code": e.response.status_code
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


async def test_instagram_comments():
    """
    Instagram Graph API를 직접 사용하여 댓글을 가져오는 테스트
    """

    # 환경변수에서 설정 가져오기
    access_token = os.getenv("INSTAGRAM_ACCESS_TOKEN")
    media_id = os.getenv("INSTAGRAM_MEDIA_ID")
    user_id = os.getenv("INSTAGRAM_USER_ID")

    if not access_token:
        print("❌ INSTAGRAM_ACCESS_TOKEN 환경변수가 설정되지 않았습니다.")
        print("Instagram Graph API 액세스 토큰을 설정해주세요.")
        print("예: export INSTAGRAM_ACCESS_TOKEN='your_token_here'")
        return

    if not media_id:
        print("❌ INSTAGRAM_MEDIA_ID 환경변수가 설정되지 않았습니다.")
        print("테스트할 Instagram 미디어 ID를 설정해주세요.")
        print("예: export INSTAGRAM_MEDIA_ID='18062980595615254'")
        return

    if not user_id:
        print("⚠️  INSTAGRAM_USER_ID 환경변수가 설정되지 않았습니다.")
        print("계정 정보 확인을 위해서는 유저 ID가 필요합니다.")
        user_id = None

    print("🔍 Instagram Graph API로 댓글 가져오기 테스트")
    print("=" * 60)

    # 1. 계정 정보 확인 (선택사항)
    if user_id:
        print("\n📋 계정 정보 확인 중...")
        account_result = await get_instagram_account_info(user_id, access_token)

        if account_result["success"]:
            account_data = account_result["data"]
            account_type = account_data.get("account_type", "UNKNOWN")
            username = account_data.get("username", "unknown")

            print(f"✅ 계정: @{username}")
            print(f"📊 계정 타입: {account_type}")

            if account_type == "BUSINESS":
                print("✓ Business 계정: 댓글 관리 권한 보유")
            elif account_type == "CREATOR":
                print("✓ Creator 계정: 댓글 관리 권한 보유")
            elif account_type == "PERSONAL":
                print("⚠️  Personal 계정: 댓글 관리가 제한적일 수 있음")
            else:
                print(f"? 알 수 없는 계정 타입: {account_type}")
        else:
            print(f"❌ 계정 정보 확인 실패: {account_result.get('error', 'Unknown error')}")
    else:
        print("\n⚠️  계정 정보 확인 생략 (INSTAGRAM_USER_ID 미설정)")

    # 2. 댓글 가져오기
    print(f"\n💬 미디어 {media_id}의 댓글 가져오는 중...")

    comments_result = await fetch_instagram_comments(media_id, access_token, limit=25)

    if comments_result["success"]:
        comments = comments_result["data"]
        paging = comments_result["paging"]

        print(f"✅ 댓글 가져오기 성공! 총 {len(comments)}개의 댓글을 찾았습니다.")

        # 댓글 상세 정보 출력
        for i, comment in enumerate(comments, 1):
            print(f"\n--- 댓글 {i} ---")
            print(f"📝 ID: {comment.get('id', 'N/A')}")
            print(f"👤 작성자: {comment.get('username', '알 수 없음')}")
            print(f"💬 내용: {comment.get('text', '내용 없음')}")
            print(f"🕒 작성일: {comment.get('timestamp', 'N/A')}")
            print(f"❤️ 좋아요: {comment.get('like_count', 0)}")

            # 답글 정보
            replies = comment.get('replies', {}).get('data', [])
            if replies:
                print(f"↳ 답글 {len(replies)}개")
                for j, reply in enumerate(replies[:3], 1):  # 최대 3개만 표시
                    print(f"   {j}. {reply.get('username', '익명')}: {reply.get('text', '')[:50]}...")
                if len(replies) > 3:
                    print(f"   ... 외 {len(replies) - 3}개")

        # 페이징 정보
        cursors = paging.get("cursors", {})
        if cursors.get("after"):
            print(f"\n📄 다음 페이지 커서: {cursors['after']}")
            print("더 많은 댓글을 보려면 이 커서를 사용하여 추가 요청하세요.")
        else:
            print("\n📄 모든 댓글을 불러왔습니다.")

    else:
        print(f"❌ 댓글 가져오기 실패: {comments_result.get('error', 'Unknown error')}")

if __name__ == "__main__":
    print("Instagram Graph API 댓글 가져오기 테스트")
    print("=" * 60)

    # 기본 테스트 실행
    asyncio.run(test_instagram_comments())
