# Instagram 댓글 API 문제 해결 가이드

## 문제: 메트릭에서는 댓글이 보이지만 Comments API에서는 안 보임

### 증상
- Instagram 게시물 메트릭에서는 `comments_count > 0`으로 표시됨
- 하지만 `/comments` API 호출 시 빈 배열(`[]`)이 반환됨
- 실제 Instagram 앱에서는 댓글이 정상적으로 보임

### 원인
Instagram Graph API의 **개발 모드 vs 라이브 모드** 차이

#### 개발 모드 (Development Mode)
- 제한된 권한으로 테스트 목적
- 댓글 API가 제대로 작동하지 않을 수 있음
- 일부 데이터가 필터링되거나 제한됨

#### 라이브 모드 (Live Mode)
- 승인된 앱에 대해 모든 권한 제공
- 댓글 API가 정상적으로 작동

### 해결 방법

1. **Instagram 앱 리뷰 승인 받기**
   - Instagram 개발자 콘솔에서 앱 리뷰 제출
   - 필요한 권한들 승인받기:
     - `instagram_manage_comments`
     - `pages_read_engagement`
     - 기타 관련 권한들

2. **앱을 라이브 모드로 전환**
   - 개발자 콘솔에서 "Go Live" 버튼 클릭
   - 앱 리뷰 승인이 완료되면 라이브 모드로 자동 전환

3. **권한 재요청**
   - 라이브 모드 전환 후 사용자로부터 권한 재승인 받기
   - 새로운 access token 발급

### 확인 방법

#### 메트릭 확인 (언제나 작동)
```bash
GET https://graph.instagram.com/{media_id}?fields=comments_count,like_count&access_token={token}
```

#### 댓글 확인 (라이브 모드에서만 작동)
```bash
GET https://graph.instagram.com/{media_id}/comments?access_token={token}
```

### 테스트 코드

프로젝트의 `test_instagram_comments.py`를 사용하여 확인 가능:

```bash
# 특정 게시물의 댓글 확인
python test_instagram_comments.py {publication_id}

# 데이터베이스의 모든 게시물 목록 확인
python test_instagram_comments.py list
```

### 참고사항

- **개발 모드에서는 댓글 API가 제한적**으로 작동할 수 있습니다
- **라이브 모드에서는 모든 기능이 정상 작동**합니다
- 앱 리뷰 승인은 Instagram의 정책에 따라 수일에서 수주 소요될 수 있습니다
- Business 계정이어도 라이브 모드 승인이 필요합니다
