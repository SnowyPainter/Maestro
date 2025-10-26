import asyncio
import os

# 필요한 모듈들을 try-except로 임포트
try:
    from apps.backend.src.modules.adapters.impls.Instagram import InstagramAdapter
    from apps.backend.src.services.http_clients import ASYNC_FETCH
    from apps.backend.src.modules.adapters.http.graph import GraphAPIJSONClient, GraphAPITransport
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    IMPORTS_AVAILABLE = True
except ImportError as e:
    print(f"모듈 임포트 오류: {e}")
    IMPORTS_AVAILABLE = False


def get_database_credentials():
    """데이터베이스 연결 정보를 반환합니다."""
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": os.getenv("DB_PORT", "5432"),
        "database": os.getenv("DB_NAME", "maestro"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", "postgres"),
    }


def create_db_engine():
    """SQLAlchemy 엔진을 생성합니다."""
    creds = get_database_credentials()
    url = f"postgresql://{creds['user']}:{creds['password']}@{creds['host']}:{creds['port']}/{creds['database']}"
    return create_engine(url)


def get_instagram_credentials():
    """데이터베이스에서 Instagram 액세스 토큰을 조회합니다."""
    try:
        engine = create_db_engine()
        with engine.connect() as conn:
            # Instagram 플랫폼의 첫 번째 액세스 토큰을 가져옵니다
            result = conn.execute(text("""
                SELECT access_token, external_id, handle
                FROM platform_accounts
                WHERE platform = 'INSTAGRAM'
                AND access_token IS NOT NULL
                AND is_active = true
                ORDER BY created_at DESC
                LIMIT 1
            """)).fetchone()

            if result:
                return {
                    "access_token": result[0],
                    "user_id": result[1],  # external_id를 user_id로 사용
                    "handle": result[2]
                }
            else:
                print("Instagram 액세스 토큰을 찾을 수 없습니다.")
                return None
    except Exception as e:
        print(f"데이터베이스 연결 오류: {e}")
        return None


def get_instagram_post_id():
    """데이터베이스에서 Instagram 게시물 ID를 조회합니다."""
    try:
        engine = create_db_engine()
        with engine.connect() as conn:
            # 최근 Instagram 게시물을 가져옵니다
            result = conn.execute(text("""
                SELECT pp.external_id, pp.created_at, pla.handle
                FROM post_publications pp
                JOIN persona_accounts pa ON pp.account_persona_id = pa.id
                JOIN platform_accounts pla ON pa.account_id = pla.id
                WHERE pp.platform = 'INSTAGRAM'
                AND pp.external_id IS NOT NULL
                AND pp.status = 'PUBLISHED'
                ORDER BY pp.created_at DESC
                LIMIT 1
            """)).fetchone()

            if result:
                return {
                    "media_id": result[0],
                    "created_at": result[1],
                    "account_handle": result[2]
                }
            else:
                print("Instagram 게시물을 찾을 수 없습니다.")
                return None
    except Exception as e:
        print(f"데이터베이스 연결 오류: {e}")
        return None


async def test_instagram_comments():
    """
    Instagram 댓글 가져오기 테스트 함수
    """

    # 데이터베이스에서 Instagram credentials 조회
    print("데이터베이스에서 Instagram credentials를 조회하는 중...")
    creds_data = get_instagram_credentials()
    if not creds_data:
        print("Instagram credentials를 찾을 수 없습니다.")
        print("환경변수 설정:")
        print("  export INSTAGRAM_ACCESS_TOKEN=\"your_token\"")
        print("  export INSTAGRAM_MEDIA_ID=\"your_media_id\"")
        print("또는 데이터베이스에 Instagram 계정을 연결하세요.")
        return

    print(f"계정 발견: @{creds_data['handle']}")

    # Instagram 어댑터 초기화
    adapter = InstagramAdapter(http_client=ASYNC_FETCH)

    # 계정 타입 확인
    print("Instagram 계정 정보를 확인하는 중...")
    try:
        # Instagram API로 직접 계정 정보 조회
        transport = GraphAPITransport(
            http=ASYNC_FETCH,
            base_url="https://graph.instagram.com/v23.0",
            default_params={"access_token": creds_data["access_token"]},
        )
        client = GraphAPIJSONClient(transport)

        account_info = await client.get_json(f"{creds_data['user_id']}?fields=id,username,account_type")
        account_type = account_info.get("account_type", "UNKNOWN")
        print(f"계정 타입: {account_type}")

        # 계정 타입별 권한 설명
        if account_type == "BUSINESS":
            print("✓ Business 계정: 댓글 관리 권한이 있어야 합니다.")
        elif account_type == "CREATOR":
            print("✓ Creator 계정: 댓글 관리 권한이 있어야 합니다.")
        elif account_type == "PERSONAL":
            print("⚠ Personal 계정: 댓글 관리가 제한적일 수 있습니다.")
        else:
            print(f"? 알 수 없는 계정 타입: {account_type}")

    except Exception as e:
        print(f"계정 정보 확인 실패: {e}")

    # 데이터베이스에서 Instagram 게시물 조회
    print("데이터베이스에서 Instagram 게시물을 조회하는 중...")
    post_data = get_instagram_post_id()
    if not post_data:
        print("Instagram 게시물을 찾을 수 없습니다.")
        print("먼저 Instagram에 게시물을 업로드하세요.")
        return

    print(f"게시물 발견: {post_data['media_id']} (@{post_data['account_handle']}, {post_data['created_at']})")

    # 댓글 가져오기 옵션
    credentials = {
        "access_token": creds_data["access_token"],
        "user_id": creds_data["user_id"]
    }

    media_id = post_data["media_id"]

    options = {
        "limit": 10,
        "after": None
    }

    print(f"Instagram 미디어 {media_id}의 댓글을 가져오는 중...")

    try:
        # 댓글 목록 가져오기
        result = await adapter.list_comments(
            parent_external_id=media_id,
            credentials=credentials,
            options=options
        )

        if result.ok:
            print(f"댓글 가져오기 성공! 총 {len(result.comments)}개의 댓글을 찾았습니다.")

            # 댓글 정보 출력
            for i, comment in enumerate(result.comments, 1):
                print(f"\n--- 댓글 {i} ---")
                print(f"ID: {comment.external_id}")
                print(f"작성자: {comment.author_username or '알 수 없음'}")
                print(f"내용: {comment.text or '내용 없음'}")
                print(f"작성일: {comment.created_at}")
                print(f"좋아요 수: {comment.metrics.get('likes', 0)}")
                print(f"상위 댓글 ID: {comment.parent_external_id}")

            # 페이징 정보
            if result.next_cursor:
                print(f"\n다음 페이지 커서: {result.next_cursor}")
                print("더 많은 댓글을 보려면 이 커서를 after 옵션으로 사용하세요.")
            else:
                print("\n모든 댓글을 불러왔습니다.")

        else:
            print(f"댓글 가져오기 실패: {', '.join(result.errors)}")

        # 경고 메시지 출력
        if result.warnings:
            print(f"\n경고: {', '.join(result.warnings)}")

    except Exception as e:
        print(f"오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()




if __name__ == "__main__":
    print("Instagram 댓글 가져오기 테스트")
    print("=" * 50)

    # 기본 테스트 실행
    asyncio.run(test_instagram_comments())
