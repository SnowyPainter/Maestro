# 핵심 아키텍처 요약

## 주요 디렉토리 구조

### `features/`
생성·수정·연결 등 **"입력/변경(Mutation)"** 담당 폼·툴 카드

### `entities/`
리스트·디테일 등 **"조회(Read/Output)"** 담당 뷰  
필요 시 features 컴포넌트를 콜백으로 호출하거나 직접 삭제(Delete) 실행

#### `entities/messages/`
- **`cardRouter.tsx`**: 서버에서 온 card-hint(카드 타입/props 힌트)에 따라 어떤 카드 컴포넌트를 렌더할지 결정
- **`context/ChatMessagesContext.tsx`**: 채팅 메시지 상태/이벤트 버스
- **`components/*Card.tsx`**: 실제로 화면에 그려지는 카드
  - Chart/Editor/Info/Profile/Table/Generic 등

### `pages/ChatPage/`
ChatInput, ChatStream, ChatSidebar, ChatContextPanel 구성  
`useChatPageEvents`가 카드 라우팅 이벤트를 묶어 cardRouter에 전달

### `widgets/`
채팅 화면의 핵심 위젯들 (`ChatStream.tsx` 등)

### `app/providers/`
i18n, React Query, 테마 등 전역 프로바이더 묶음

## 라이브러리 및 유틸리티

### `lib/`
- **API 자동화**:
  - `api/generated.ts` + `types/api.ts` + `schemas/api.zod.ts`로 OpenAPI 기반 타입/클라이언트/스키마 자동화
  - `api/fetcher.ts` 공통 fetch/에러/토큰 주입
- **상태 관리**:
  - `store/session.ts`: 세션/토큰

### `components/`
- **`ui/`**: shadcn 기반 UI 프리미티브
- **`Auth/ProtectedRoute.tsx`**: 라우팅 가드

## 라우팅 및 레이아웃
- `router.tsx` / `RootLayout.tsx`: 라우팅·전역 레이아웃

