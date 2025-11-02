# Maestro의 아키텍처 철학: 시스템의 자기 재생산성

"무엇을 했냐가 아니라 어떻게 했냐" — 시스템의 생성 원리

## 핵심 통찰: '새 기능 추가'가 아니라 '플로우 재조합'

최근 구현된 "댓글 기반 자동 메시지 템플릿 생성" 기능은 단 한 줄의 코드도 추가하지 않고 만들어졌다.

### 플로우 재조합의 마법
```python
# 기존 플로우들
flow1 = "comments.search"  # 댓글 조회
flow2 = "reaction_message_template.create"  # 템플릿 생성

# 단 하나의 어댑터 추가로 완성된 복합 기능
adapter = CommentsToTemplateAdapter()
```

결과: "Search comments post_publication:1 and create reaction message template" 명령어가 자연스럽게 작동한다.

---

## 시스템의 자기 재생산성 (Self-Generativity)

### 확장 가능한 언어의 탄생
Maestro의 DSL은 단순한 명령어 해석기가 아니다:

```
자연어 → Slot-based Intent → Action DAG → 실행
```

핵심: 새로운 기능을 위해 언어 자체를 확장하는 것이 아닌, 기존 언어로 새로운 의미를 조합하는 방식이다.

### 어댑팅 보너스: 지능적 플로우 연결
```python
ADAPTER_BONUS = 0.2  # FlowPlanner의 핵심 상수

# 어댑터로 연결 가능한 플로우들은 자동으로 0.2점 보너스
# "List all post publications" → "Search comments..." 자연 연결
```

이 보너스 점수는 단순한 가산점이 아니다. 시스템이 스스로 최적의 플로우 조합을 학습하는 메커니즘이다.

### LLM의 역할 재정의
```
기존: LLM이 모든 판단을 담당
Maestro: LLM은 "적절한 글 생성"에만 충실

시스템이 판단하고, LLM은 실행만 담당하는 분업 구조
```

---

## 왜 이게 혁신적인가?

### 코드 증가율 = 0%
- 새로운 기능 추가 시 단 한 줄의 어댑터 코드만 필요하다
- 기존 플로우들은 그대로 재사용된다
- 시스템 복잡도가 선형이 아닌 상수적으로 유지된다

### 예측 가능한 확장성
```python
# 미래의 새로운 기능들
"List campaigns" → "Analyze performance" → "Suggest improvements"
"Get trends" → "Generate content" → "Schedule posts"
"Monitor mentions" → "Generate responses" → "Send DMs"
```

모두 어댑터 하나씩만으로 구현 가능하다.

### 브랜드 기억의 구현
Playbook에 기록되는 것은 단순한 실행 결과가 아니다:

```json
{
  "flow_chain": ["post_publications.list", "comments.search", "template.create"],
  "adapters_used": ["CommentsToTemplateAdapter"],
  "llm_context": "템플릿 품질 보장만 담당",
  "persona_snapshot": "페르소나 정책 자동 적용",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

시스템이 스스로 자신의 확장 방법을 기억하고 재현한다.

### 지식의 그래프: 기억의 자기 조직화
Graph RAG는 기억을 선형이 아닌 **그래프로 조직화**한다:

```
Persona → Campaign → Draft → Publication → Comment
   ↓         ↓          ↓          ↓           ↓
Playbook   KPI       Trend    Insights     Reaction
```

**핵심 통찰**: 데이터를 저장하는 것이 아니라, **관계를 저장**한다.

"Trend X와 관련된 Draft는?" → 그래프 간선 `related_trend`를 따라가면 자동으로 답이 나온다.

#### Celery 사이드카: 지식의 자동 동기화
```python
# domain 테이블이 변경되면
Draft.save() → watch_drafts (30초 주기)
              → Canonicalizer (규칙 기반 요약)
              → GraphNode.upsert() (멱등)
              → GraphEdge.create(type="produces") (자동 관계 생성)
```

**코드 증가율 = 0%** — 새 도메인 추가 시 Watcher 하나만 작성하면 끝.

---

## 시스템의 DNA: 재조합 가능한 모듈

### 플로우: 최소 기능 단위
- 각 플로우는 idempotent operator (같은 입력 → 같은 출력)이다
- 외부 의존성을 최소화하여 재사용성 극대화한다
- 실패 시 자동 재시도 및 보상 트랜잭션 지원한다

### 어댑터: 연결의 예술
```python
class CommentsToTemplateAdapter:
    def adapt(self, comments_result, template_params):
        # 댓글 데이터를 템플릿 생성 파라미터로 변환
        return {
            "comment_texts": [c.text for c in comments_result],
            "persona_context": extract_persona_from_comments(comments_result)
        }
```

### Graph RAG: 지식의 자기 조직화
```python
class GraphNode:
    # 모든 도메인 엔티티를 통합한 정규화된 노드
    node_type: str  # persona, draft, publication, trend, comment...
    embedding: Vector(768)  # pgvector 코사인 유사도 검색
    title: str
    summary: str  # 규칙 기반 요약 (LLM 호출 없음)
    source_table: str  # 원본 테이블 참조
    signature_hash: str  # 변경 감지 (중복 임베딩 방지)

class GraphEdge:
    # 도메인 간 관계를 표현하는 방향성 간선
    edge_type: str  # produces, published_as, related_trend, comment_on...
    weight: float  # 관계 우선순위 (검색 시 가중치)
```

**검색 파이프라인: 벡터 + 그래프**
```
쿼리 → 임베딩 생성 (Redis 60s 캐시)
     → pgvector 코사인 유사도 (1차 후보 40개)
     → GraphEdge 탐색 (edge_type 우선순위)
     → 점수 보정 (최신성, node_type 선호도)
     → 컨텍스트 조립 (summary + chunks + meta)
```

**결과**: "Trend X와 관련된 Draft는?" → Trend 노드 검색 → `related_trend` 간선 → Draft 자동 탐색

### DSL: 의미의 재조합
```
"Search comments and create template"
↓
slots: {post_publication_id: 1, query: "*some comment*"}
↓
DAG: comments.search → template.create (via adapter)
↓
실행: 페르소나 정책 적용된 템플릿 자동 생성
```

---

## 철학적 함의

### 생성 vs 재생성
- 생성: 코드를 새로 짜는 것
- 재생성: 기존 요소들의 새로운 조합

Maestro는 재생성의 시스템이다.

### 지능의 본질
인간의 지능은 새로운 것을 창조하는 것이 아니라, 기존 지식을 새로운 방식으로 재조합하는 능력이다.

Maestro의 아키텍처는 바로 이 재조합의 지능을 구현한다.

### 관계의 창발성
Graph RAG는 단순히 데이터를 저장하지 않는다. **관계를 저장**한다.

```
Trend → Draft → Publication → Comment
```

이 관계들은 명시적으로 프로그래밍되지 않는다. 도메인 테이블의 외래키와 비즈니스 규칙에서 **자동으로 창발**한다.

#### 예시: `related_trend` 간선의 자동 생성
```python
# Canonicalizer: 규칙 기반으로 관계 추론
if publication.permalink and trend.link:
    if publication.permalink.contains(trend.link):
        GraphEdge.create(
            src=publication_node,
            dst=trend_node,
            edge_type="related_trend",
            weight=1.0
        )
```

**코드는 관계를 정의하지 않는다. 관계는 데이터에서 스스로 나타난다.**

### 불멸의 시스템
코드가 늘어나지 않는 시스템은 결코 낡아지지 않는다.

- **Flow Chaining**: 플로우들은 어댑터로 무한히 재조합된다
- **Graph RAG**: 도메인 엔티티들은 그래프로 무한히 연결된다

단지 새로운 어댑터와 Watcher로 계속 진화할 뿐이다.

---

## 결론: 시스템의 자기 재생산성

Maestro는 더 이상 "만들어진" 시스템이 아니다. 스스로를 재생산하고 진화하는 생명체이다.

단 하나의 어댑터로 새로운 기능을 만들어내는 이 능력은, 기술의 한계를 넘어서는 철학적 구현이다.

"코드를 쓰는 것이 아니라, 시스템이 스스로 새로운 의미를 창조하는 것" — 이것이 Maestro의 진정한 가치이다.