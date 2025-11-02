---
title: "Graph RAG: 벡터 검색과 지식 그래프의 융합"
date: "2025-11-02"
stack: ["FastAPI", "PostgreSQL", "pgvector", "Celery", "React", "TypeScript"]
role: "System Architect"
---

## Problem & Condition

### 배경
나의 실험적인 프로젝트는 Persona, Campaign, Draft, Publication, Trend, Comment, Rule 등 **여러 도메인 엔티티**를 다룬다. 기존에는 Trends 테이블에만 벡터 임베딩을 저장하여 단순 유사도 검색을 제공했지만, 다음과 같은 한계가 있었다:

1. **도메인 간 관계 추적 불가능**
   - "Trend X를 기반으로 작성한 Draft는?" → 직접 JOIN 쿼리 필요
   - "Campaign Y의 모든 게시물과 그 댓글" → 복잡한 다단계 쿼리 필요
   - 사용자가 자연어로 질문할 때 관계를 활용한 컨텍스트 제공 불가

2. **검색 컨텍스트의 빈약함**
   - 벡터 검색으로 "유사한 트렌드"는 찾을 수 있지만, 그 트렌드로 만든 **Draft**, 그 Draft에서 발행된 **Publication**, 그 게시물에 달린 **Comment**까지 자동으로 제공하지 못함
   - LLM 프롬프트에 풍부한 맥락을 주입하려면 수동으로 여러 테이블을 조회해야 함

3. **도메인별 임베딩 분산**
   - Trends, Drafts, Personas 등 각 테이블마다 `embedding` 컬럼을 추가하면 중복 로직 증가
   - 임베딩 모델 변경 시 모든 테이블 마이그레이션 필요

### 요구사항
- **통합 지식 그래프**: 모든 도메인 엔티티를 단일 그래프로 표현 (노드 + 간선)
- **벡터 검색 + 그래프 탐색**: 벡터 유사도로 1차 후보를 찾고, 그래프 간선으로 관련 노드를 자동 확장
- **자동 동기화**: domain 테이블 변경 시 그래프 노드/엣지를 자동 갱신 (사이드카 패턴)
- **LLM 호출 없음**: 검색 시 추가 요약 없이 **저장된 요약/메트릭을 그대로 활용** (지연 최소화)
- **프론트엔드 시각화**: 사용자가 그래프를 인터랙티브하게 탐색할 수 있는 UI

### 제약
- **성능**: 벡터 검색은 코사인 유사도 계산으로 비용이 높음 → pgvector 인덱스 필수
- **동기화 지연**: Celery Beat 주기(Draft 30초, Trend 5분)만큼 지연 발생 가능
- **데이터 일관성**: domain 테이블과 그래프 노드 간 정합성 유지 (signature_hash 기반 멱등 처리)
- **프론트엔드 복잡도**: 노드/엣지를 UI로 표현하되 과도한 정보로 사용자를 압도하지 않아야 함

---

## Candidates

### 1. **단순 벡터 검색 유지 (기존 방식)**
- **장점**: 구현 단순, 빠른 검색
- **단점**: 도메인 간 관계 활용 불가, 컨텍스트 빈약
- **Trade-off**: 확장성 낮음, 복잡한 질문("Trend X로 만든 Draft의 성과는?")에 대응 불가

### 2. **Neo4j 등 그래프 DB 도입**
- **장점**: 그래프 전용 DB로 관계 쿼리 최적화, 풍부한 그래프 알고리즘
- **단점**: 인프라 복잡도 증가 (PostgreSQL + Neo4j 동시 운영), 벡터 검색은 별도 처리 필요
- **Trade-off**: 초기 러닝 커브, 운영 비용 증가

### 3. **PostgreSQL + pgvector + 그래프 테이블 (Graph RAG)**
- **장점**:
  - 기존 PostgreSQL 인프라 재사용 (pgvector로 벡터 검색 + 그래프 테이블로 간선 표현)
  - 벡터 검색과 그래프 탐색을 단일 DB에서 처리 (트랜잭션 일관성 보장)
  - Celery 사이드카로 domain 테이블 → 그래프 자동 동기화
- **단점**: 그래프 전용 DB보다 복잡한 쿼리 (JOIN 필요), 대규모 그래프에서 성능 한계 가능
- **Trade-off**: 운영 단순성 vs. 순수 그래프 DB 대비 성능

---

## Decision

**PostgreSQL + pgvector + 그래프 테이블 (Graph RAG)** 선택

### 근거
1. **인프라 단순성**: 기존 PostgreSQL을 그대로 활용, 추가 DB 불필요
2. **통합 쿼리**: 벡터 검색 → 그래프 탐색을 단일 트랜잭션에서 처리 가능
3. **확장성**: 현재 규모(수만~수십만 노드)에서 충분히 빠름, 향후 Neo4j 마이그레이션 가능
4. **자동 동기화**: Celery 사이드카가 domain 테이블 스캔 → `rag_nodes`, `rag_edges`, `rag_chunks` 갱신
5. **LLM 호출 제거**: Canonicalizer가 규칙 기반으로 요약 생성 → 검색 시 추가 LLM 호출 없음

### 설계 원칙
- **3 테이블 구조**:
  - `rag_nodes` — 모든 도메인 엔티티를 통합한 정규화된 노드 (node_type, embedding, title, summary, meta, source_table/source_id)
  - `rag_edges` — 노드 간 방향성 간선 (src_node_id, dst_node_id, edge_type, weight)
  - `rag_chunks` — 긴 본문을 350~400 토큰 단위로 분할 (node_id, chunk_index, body_text, embedding)

- **7단계 검색 파이프라인**:
  1. **쿼리 정규화** — `persona:`, `campaign:` 프리픽스 파싱
  2. **임베딩 생성** — `embed_texts` 호출, Redis 60초 TTL 캐시
  3. **벡터 검색** — pgvector 코사인 유사도로 1차 후보 40개
  4. **그래프 확장** — edge_type 우선순위(produces > published_as > comment_on > related_trend)로 이웃 탐색
  5. **점수 보정** — 최신성, node_type 선호도, 사용자 피드백
  6. **중복 제거** — 동일 source_table/source_id는 최고 점수만
  7. **컨텍스트 조립** — summary + 상위 2개 chunk + meta 번들

- **Celery 사이드카**:
  - Beat 스케줄: Draft/Variant 30초, Trend 5분, 기타 2분
  - Watchers → Canonicalizer → Chunker → Graph Syncer → Edge Builder
  - `signature_hash`로 중복 임베딩 방지 (변경된 내용만 재처리)

- **프론트엔드**:
  - `GraphExplorer` — 노드 카드 목록 + 검색어 필터 + node_type 셀렉터
  - `GraphNodeCard` — title, summary, score, chunks, source_ref
  - `RelatedNodeCard` — edge_type 배지, dst_node 정보
  - 콜백 체인: `onRagExpand`, `onRagNavigate` → 연속 탐색

---

## Effects

### 결과 지표

#### 1. **검색 품질 향상**
- **Before**: Trends 벡터 검색만 지원 → "유사한 트렌드" 목록만 반환
- **After**: Trend → Draft → Publication → Comment 경로 자동 탐색 → 평균 **3~5개 관련 노드** 추가 제공
- **Metric**: 검색 결과 1개당 평균 관련 노드 수 증가 (**0개 → 3.2개**)

#### 2. **LLM 컨텍스트 풍부화**
- **Before**: 사용자 질문에 대해 수동으로 여러 테이블 JOIN → LLM 프롬프트 조립
- **After**: Graph RAG 검색 결과를 `to_prompt_payload()`로 즉시 프롬프트 주입
- **Metric**: LLM 응답 정확도 향상 (내부 평가 기준: **"관련성 없음" 비율 45% → 18%**)

#### 3. **검색 지연 시간**
- **Before**: Trends 벡터 검색 평균 **120ms** (pgvector 인덱스 사용)
- **After**: Graph RAG 검색 (벡터 + 그래프 확장) 평균 **180ms** (+50% 지연, but 3~5배 많은 컨텍스트)
- **Optimization**: Redis 쿼리 캐싱으로 동일 질문 반복 시 **30ms**로 감소

#### 4. **사이드카 동기화 부하**
- **Prometheus 메트릭**:
  - `rag_nodes_processed_total`: 1시간당 평균 **240개 노드** 갱신 (Draft/Variant 변경 많음)
  - `rag_watch_duration_seconds`: watch_drafts 평균 **2.3초**, watch_trends 평균 **0.8초**
  - `rag_embeddings_failures_total`: 0.05% (TEI 서비스 간헐적 타임아웃)

### 보완점

#### 1. **그래프 확장 깊이 제한**
- **문제**: 현재 1-hop만 탐색 (직접 이웃만) → 간접 관계(2-hop) 활용 못함
- **계획**: `max_depth` 파라미터 추가, BFS로 2-hop까지 확장 (성능 테스트 후 적용)

#### 2. **간선 가중치 학습**
- **문제**: edge_type별 가중치가 고정값 (produces=1.0, related_trend=0.5 등)
- **계획**: 사용자 피드백 (`rag_feedback` 테이블)으로 간선 가중치 자동 조정

#### 3. **대규모 그래프 성능**
- **문제**: 노드 100만 개 초과 시 pgvector 인덱스 성능 저하 가능
- **계획**:
  - PostgreSQL 파티셔닝 (owner_user_id 기준)
  - 향후 Neo4j 마이그레이션 옵션 유지 (GraphNode → Neo4j Node 매핑 준비)

#### 4. **실시간 동기화**
- **문제**: Celery Beat 주기(30초~5분)만큼 지연 → 최신 Draft가 즉시 검색되지 않음
- **계획**: CDC (Change Data Capture, PostgreSQL logical replication)로 실시간 동기화 전환

#### 5. **프론트엔드 시각화 개선**
- **문제**: 현재는 카드 목록만 표시 → 그래프 구조 시각적으로 이해 어려움
- **계획**: D3.js 또는 vis.js로 **노드-엣지 네트워크 다이어그램** 추가

---

## 핵심 메시지

> **Graph RAG는 단순 벡터 검색을 넘어, 도메인 간 관계를 그래프로 추적하여 사용자가 "탐험"하는 방식으로 지식을 발견하게 합니다.**

- **"Trend X와 관련된 Draft는?"** → Trend 노드 검색 → `related_trend` 간선으로 Draft 자동 탐색
- **"Campaign Y의 모든 게시물과 댓글"** → Campaign 노드 → `belongs_to` → Publication → `comment_on` → InsightComment
- **"Persona Z가 과거에 어떤 톤으로 작성했나?"** → Persona 노드 → `produces` → Draft → summary 확인

**기억하는 자동화의 핵심** — 과거 판단의 맥락(페르소나, 캠페인, 트렌드, 성과)을 그래프로 기억하고 검색합니다.

