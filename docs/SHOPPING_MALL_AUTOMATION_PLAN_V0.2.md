# 범용 쇼핑몰 자동화 플랫폼 기획안 v0.2

> 부제: **Qualification-Gated, Diagnostic-First**  
> 기준일: 2026-06-30  
> 이 문서는 기존 `SHOPPING_MALL_AUTOMATION_PLAN.md`의 우선순위와 MVP 범위를 교정한 통합 개정본이다.

---

## 0. 개정 결론

기존의 “쿠팡 등록·가격·재고·주문·송장 MVP”는 1인 초기 개발 범위로 크고, 쿠팡 판매자 자격과 실계정 API 접근권한이 없으면 실제 검증도 불가능하다.

개발 순서를 다음과 같이 바꾼다.

```text
Phase 0  운영 자격과 API 접근권한 확인
MVP-0    외부 전송 없는 읽기 전용 상품 진단기
MVP-1    CSV 1행 → 표준 상품 → 검증 → 쿠팡 DRY_RUN payload
MVP-2    실계정 읽기 연동
MVP-3    상품 1건 제한 쓰기 검증
MVP-4    가격·재고 동기화
MVP-5    주문·송장
MVP-6    네이버와 업종 규칙팩 확장
```

> **자격이 없는 채널·업종의 실제 쓰기 기능은 백로그에서 잠그고, 자격 없이도 만들 수 있는 진단 엔진부터 완성한다.**

---

## 1. 제품 정의

여러 공급처의 상품 데이터를 하나의 표준 모델로 변환하고, 실제 판매 채널에 전송하기 전에 다음을 진단하는 도구로 시작한다.

- 필수 정보 누락
- 옵션·SKU 구조 오류
- 채널별 등록 가능성
- 브랜드·상품식별번호 상태
- 카테고리 필수 속성
- 가격과 예상 마진
- 금지·주의 표현
- 이미지 규격과 사용권
- 채널별 예상 전송 payload

진단 엔진이 안정된 뒤에 상품 등록, 재고, 주문, 배송 자동화를 붙인다.

---

## 2. Phase 0 — 운영 자격 게이트

### 2.1 게이트 상태

```ts
type QualificationStatus =
  | "NOT_CHECKED"
  | "BLOCKED"
  | "IN_PROGRESS"
  | "APPROVED"
  | "EXPIRED"
  | "REVOKED";
```

- `BLOCKED`: Mock, 스키마, DRY_RUN까지만 허용
- `IN_PROGRESS`: 외부 전송 없는 기능만 개발
- `APPROVED`: 제한된 실계정 검증 가능
- `EXPIRED`, `REVOKED`: 모든 쓰기 기능 자동 잠금

### 2.2 쿠팡 게이트

실제 쿠팡 Open API 연동 전 다음을 확보한다.

- [ ] 사업자등록 상태 확인
- [ ] 쿠팡 WING 판매자 등록
- [ ] 사업자 인증 완료
- [ ] Open API 인증정보 발급
- [ ] 개발 PC 또는 서버 IP 등록
- [ ] 인증정보 만료·재발급 일정 기록
- [ ] 연결정보 수정 제한 운영 메모
- [ ] 별도 테스트 환경이 없음을 개발·운영 문서에 명시
- [ ] 실계정 1건 검증 Runbook 승인

쿠팡 공식 안내상 WING 판매자 등록과 사업자 인증이 되지 않은 일반회원에게는 API 인증정보 발급이 지원되지 않고, 별도 테스트 환경도 현재 제공되지 않는다.

공식 자료:

- [Coupang Open API Key 발급 안내](https://developers.coupangcorp.com/hc/en-us/articles/20288952179993-Issue-Open-API-Key-NEW)
- [Coupang Open API 시작 안내](https://developers.coupangcorp.com/hc/en-us/articles/360033917473-Coupang-OPEN-API)

### 2.3 건강기능식품 게이트

건강기능식품 규칙팩을 실제 판매 운영에 사용하기 전 다음을 확인한다.

- [ ] 판매 형태와 업종 분류
- [ ] 사업자등록 관련 요건
- [ ] 통신판매업 신고 필요 여부와 처리 상태
- [ ] 건강기능식품 판매업 영업신고
- [ ] 신규 안전위생교육 이수
- [ ] 관할 처리기관
- [ ] 판매 채널의 별도 판매권한·서류 요건
- [ ] 표시·광고 검수 책임자
- [ ] 신고·교육 증빙과 확인일

건강기능식품 판매업은 영업신고 대상이며, 일반판매업 신규 교육은 영업신고 전에 이수하는 2시간 교육으로 안내된다.

공식 자료:

- [정부24 건강기능식품 영업신고](https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=14700000484&HighCtgCD=A09006)
- [건강기능식품 위생교육 안내](https://www.sd.go.kr/health/contents.do?key=2380)
- [식약처 지정 건강기능식품교육센터](https://edu.khff.or.kr/)

법률·인허가 판단은 프로그램이 확정하지 않는다. 관할기관과 공식 채널 정책을 확인하고 근거일과 증빙을 자격 레지스트리에 기록한다.

### 2.4 백로그 잠금

- 자격 미확보 쓰기 Issue에는 `blocked:qualification` 라벨을 붙인다.
- 실제 상품 등록, 가격 변경, 재고 변경, 송장 전송은 잠근다.
- payload builder, Mock client, validator, fixture는 개발할 수 있다.
- 실계정 테스트는 수동 실행 워크플로에서만 허용한다.

---

## 3. MVP-0 — 읽기 전용 상품 진단기

### 3.1 처리 흐름

```text
CSV/Excel 업로드
→ 표준 상품 변환
→ Zod 스키마 검증
→ 옵션/SKU 정규화
→ 카테고리 후보
→ 필수 속성 누락 검사
→ 가격·마진 분석
→ 표현 위험 검사
→ 이미지 검사
→ 쿠팡 예상 payload
→ 진단 리포트
```

외부 채널에는 아무것도 전송하지 않는다.

### 3.2 출력

- 원본과 표준 상품 비교
- 필드별 오류와 수정 방법
- SKU·옵션 조합 오류
- 브랜드·GTIN·MPN 상태
- 쿠팡 필수 구매옵션 누락
- 이미지 크기·형식·사용권 문제
- 권장 판매가·최저 판매가·예상 이익
- 금지·주의 표현
- DRY_RUN payload JSON
- `PASS`, `WARNING`, `BLOCKED` 판정
- JSON 및 HTML 리포트

### 3.3 완료 조건

- CSV 1행을 `CanonicalProduct`로 변환한다.
- 오류를 필드 단위로 설명한다.
- API 호출 없이 쿠팡 예상 payload를 생성한다.
- 같은 fixture는 항상 같은 결과를 낸다.
- 외부 인증정보 없이 로컬에서 실행된다.

### 3.4 첫 수익화 후보

- 쿠팡 등록 실패 사전 진단
- 공급사 Excel 정규화
- 마진 손실 진단
- 농산물 표시항목 검사
- 건강기능식품 표현 점검 보조
- 채널별 필수 속성 템플릿

---

## 4. 첫 수직 슬라이스

```text
CSV 1행
→ CanonicalProduct Zod 파싱
→ 공통 검증
→ 쿠팡 Mock 메타데이터 적용
→ CoupangProductPayload 생성
→ DRY_RUN 출력
→ 골든 스냅샷 비교
```

완료 조건:

- 하나의 명령 또는 화면에서 끝까지 실행
- 네트워크 호출 0건
- 입력·표준 모델·payload 모두 확인 가능
- 실패 원인을 사람이 이해할 수 있게 표시
- 골든 결과 변경은 PR에서 명시적으로 승인

이후에는 여러 행, 옵션, 가격, 이미지, 메타데이터, 읽기 API, 1건 쓰기 순으로 넓힌다.

---

## 5. 단일 진실원천 — Canonical Zod Schema

문서의 JSON 예시가 아니라 실제 Zod 스키마를 SSOT로 사용한다.

```text
packages/domain/src/schemas/
├─ product.schema.ts
├─ sku.schema.ts
├─ option.schema.ts
├─ price.schema.ts
├─ inventory.schema.ts
├─ order.schema.ts
└─ channel-listing.schema.ts
```

원칙:

- TypeScript 타입은 Zod에서 추론
- CSV 변환과 API 입력 검증도 동일 스키마 사용
- 유사 타입 중복 선언 금지
- 스키마 버전 저장
- 스키마 변경 시 fixture·migration·계약 테스트 동반

```ts
export type CanonicalProduct = z.infer<typeof canonicalProductSchema>;
```

---

## 6. 핵심 도메인 보강

### 6.1 다채널 재고 동시성

재고를 단일 숫자가 아니라 ledger와 상태 전이로 관리한다.

```text
ON_HAND       실제 보유·공급 가능 수량
RESERVED      주문 수집 후 예약 수량
SAFETY_STOCK  판매 금지 완충 수량
AVAILABLE     판매 가능 수량
ALLOCATED     채널별 노출 수량
```

```text
AVAILABLE = ON_HAND - RESERVED - SAFETY_STOCK
```

필수 설계:

- DB 트랜잭션과 동시성 제어
- `예약 → 확정 → 해제` 상태 전이
- 주문 ID 기반 멱등성
- 채널별 재고 buffer와 최대 노출량
- 오래된 예약 자동 해제
- race condition 방지
- 재고 음수 금지
- 대량 재고 0 반영 차단
- 내부·채널 재고 불일치 감지

### 6.2 옵션/SKU 매핑

옵션 매핑을 `ChannelListing`의 부속 필드가 아니라 1급 엔티티로 둔다.

```ts
interface ChannelSkuMapping {
  internalSkuId: string;
  channelAccountId: string;
  externalProductId?: string;
  externalItemId?: string;
  externalOptionId?: string;
  channelOptionAttributes: ChannelOptionAttribute[];
  identifiers: ProductIdentifier[];
  mappingStatus: "DRAFT" | "VALID" | "INVALID" | "STALE";
  metadataVersion: string;
}
```

쿠팡의 브랜드, GTIN 또는 모델번호, 카테고리 기반 필수 구매옵션 속성 정책을 지원한다.

- [브랜드·GTIN/모델번호·구매옵션 필수 정책](https://developers.coupangcorp.com/hc/en-us/articles/58875696282905-Product-Information-Policy-Update-Mandatory-Brand-GTIN-Model-Number-and-Purchase-Option-Fields-Published-on-May-21-2026)
- [2026년 구매옵션 API 변경 공지](https://developers.coupangcorp.com/hc/en-us/articles/54700630775577--Notice-Mandatory-Purchase-Option-Entry-and-API-Specification-Changes-Effective-Feb-2-2026)

### 6.3 채널별 가격 레이어

`basePrice`만 두지 않는다.

```text
원가 구조 → 표준 최소·권장 판매가
표준 판매가 → 채널별 가격·할인 레이어
```

포함 필드:

- 정가
- 기본 판매가
- 즉시할인
- 쿠폰 예산
- 멤버십 할인
- 광고비 충당액
- 배송비
- 플랫폼 수수료 예상액
- 반품 충당액
- 최저 판매가
- 목표 마진
- 예상 최종 이익

안전장치:

- 최저 판매가 이하 차단
- 예상 이익 음수 차단
- 변동률 임계치 초과 승인
- 환율 출처·수집시각·stale 상태 기록
- 할인 중복 적용 검증

### 6.4 Metadata Registry

카테고리·속성 매핑을 독립 모듈로 분리한다.

- 카테고리 트리
- 필수 속성
- 구매옵션 정의
- 브랜드 레지스트리
- 배송 템플릿
- 검증 규칙
- API 버전과 시행일

기능:

- 정기 동기화
- 버전 보존
- 변경 Diff
- 필수 항목 변경 알림
- 오래된 매핑 `STALE` 처리
- 캐시 만료
- API 공지 수동 등록

### 6.5 이미지 파이프라인

```text
원본 수집
→ 파일 해시·중복 검사
→ 사용권 상태 확인
→ 형식·해상도·비율 검사
→ 리사이즈·압축
→ 배경·과도한 텍스트 경고
→ 채널별 파생본
→ 저장소 업로드
→ payload URL
```

사용권 확인이 되지 않은 이미지는 실제 상품 공개를 차단한다.

---

## 7. 공통 모듈 목록

1. Qualification Registry
2. Canonical Schema
3. CSV/Excel Import
4. Catalog
5. SKU & Option Mapping
6. Metadata Registry
7. Pricing Engine
8. Inventory Ledger
9. Order State Machine
10. Fulfillment
11. Returns & CS
12. Settlement Reconciliation
13. Image Pipeline
14. Compliance Rule Engine
15. Workflow & Scheduler
16. Credential Vault
17. Audit & Observability
18. Notification & Fallback

---

## 8. 초기 부팅 스택과 최종 스택

### 8.1 초기 부팅 스택

- TypeScript
- Node.js
- pnpm workspace
- Next.js 또는 단일 웹 앱
- PostgreSQL
- Drizzle 또는 Prisma
- Zod
- PostgreSQL 기반 작업 큐(`pg-boss` 후보)
- 로컬 파일 또는 단순 S3 호환 저장소
- Vitest
- Playwright
- Pino
- Sentry
- Docker Compose
- GitHub Actions

초기에는 Redis/BullMQ, Turborepo, OpenTelemetry 전체 구성, 마이크로서비스, Kubernetes를 넣지 않는다.

### 8.2 확장 스택

실제 사용량이 생긴 뒤 검토한다.

- Turborepo
- Redis + BullMQ
- 독립 Worker
- Object Storage CDN
- OpenTelemetry와 중앙 로그
- 서비스 분리
- tenant 격리 강화
- 사용량 계측과 구독 결제

큐는 공통 인터페이스 뒤에 숨겨 초기 PostgreSQL 큐를 나중에 교체할 수 있게 한다.

---

## 9. 바이브코딩 운영 규칙

### 9.1 Issue 단위

```md
## 목적
## 입력
## 출력
## 변경 가능한 경계
## 변경 금지 경계
## 실패 조건
## fixture
## 테스트
## 완료 조건
```

### 9.2 AGENTS.md 강제 규칙

- Adapter 밖 외부 API 호출 금지
- 인증정보를 코드·fixture·로그에 저장 금지
- Canonical 타입 수동 중복 선언 금지
- Zod 변경 시 fixture와 테스트 동반
- DB 변경 시 migration 필수
- 쓰기 작업 멱등성 검토 필수
- 개인정보를 LLM에 원문 전송 금지
- 승인 없이 고위험 작업 AUTO 전환 금지
- 골든 스냅샷 변경 시 PR 설명 필수

### 9.3 CI 강제 항목

- TypeScript strict
- 금지 import 검사
- Secret scanning
- migration 누락 검사
- schema/fixture 일관성
- adapter contract test
- 골든 fixture snapshot
- 개인정보 로그 패턴 검사
- 단위 테스트 외부 네트워크 차단

한 에이전트가 구현하고 다른 에이전트가 스키마·보안·테스트 관점에서 리뷰한다.

---

## 10. 골든 fixture

코드보다 먼저 만든다.

### 상품

- 정상 단일 옵션
- 정상 다중 옵션
- 브랜드 누락
- GTIN·MPN 누락
- 필수 구매옵션 누락
- 원산지 누락
- 금지 표현
- 마진 음수
- 이미지 규격 오류
- 이미지 권리 미확인
- 옵션 조합 중복
- 대량 옵션
- 재고 0

### 주문

- 정상 주문
- 중복 주문
- 부분·전체 취소
- 옵션 매핑 실패
- 주소 오류
- 동일 SKU 동시 주문
- 송장 중복 전송
- 개인정보 파기 대상

### 메타데이터

- 필수 속성 추가
- 속성 이름 변경
- 구매옵션 필수 전환
- 브랜드 매핑 변경
- 이전 버전 payload

---

## 11. 샌드박스 없는 쿠팡 테스트 전략

### 11.1 테스트 단계

1. 순수 함수 단위 테스트
2. Zod schema test
3. Adapter contract test
4. Stub server 통합 테스트
5. 개인정보를 제거한 실제 응답 replay test
6. 제한된 실계정 canary test

### 11.2 기록·재생

- 실제 응답의 개인정보 제거
- 상태코드·헤더·body 구조 저장
- 녹화일과 API 버전 기록
- 오래된 fixture를 `STALE` 처리
- API 공지 변경 시 관련 fixture 재검증

### 11.3 실계정 1건 Runbook

실제 쓰기 호출 전 조건:

- 자격 `APPROVED`
- DRY_RUN 통과
- fixture와 계약 테스트 통과
- 수동 승인
- 실행 대상 1건
- 판매 가능 재고 1 이하
- 테스트 식별 태그
- 즉시 중지·회수 절차
- 실행 전후 payload·응답 저장
- 실패 시 추가 쓰기 중단

상품의 비공개·판매중지·노출제한 방식은 공식 API와 실제 계정에서 확인해 별도 Runbook에 기록한다.

---

## 12. 자잘하지만 필수인 운영 설계

### 12.1 시간과 주문 cursor

- DB는 UTC 저장
- 원본 타임존·offset 보존
- 해외 채널은 IANA timezone 사용
- 시간 경계는 overlap 수집
- 중복 주문은 외부 주문 ID로 제거
- 실패한 페이지에서 cursor 전진 금지
- 장시간 미수집 경고

### 12.2 환율

- 데이터 출처
- 기준 통화
- 수집·적용 시각
- stale 기준
- 안전 버퍼
- 수동 고정환율
- 급변 시 자동 가격 변경 중지

### 12.3 개인정보 자동 파기

```text
수집 → 최소 저장 → 마스킹 → 보존기한 → 자동 삭제/비식별화 → 파기 로그
```

- 주문 개인정보 필드 분리
- LLM 전송 전 제거
- 보존기한 파기 Job
- 법적 보존 대상 예외
- 파기 실패 알림
- 실제 개인정보 fixture 사용 금지

### 12.4 알림 폴백

- 관리자 화면
- 이메일
- Telegram 또는 Slack
- 모든 외부 알림 실패 시 대시보드 상단 고정
- CRITICAL 다중 채널 전송
- 동일 오류 폭주 억제
- Kill Switch는 알림 실패와 무관하게 작동

---

## 13. 로드맵

### Phase 0

- 자격 레지스트리
- 쿠팡 WING·사업자 인증·API 상태
- 건강기능식품 신고·교육 경로
- 샌드박스·rate limit·쓰기 위험 조사
- 미확보 기능 백로그 잠금

### MVP-0

- CSV 1행
- 표준 상품
- 검증
- 쿠팡 예상 payload
- JSON·HTML 리포트
- 외부 호출 0건

### MVP-1

- 여러 행과 오류 격리
- 가격 엔진
- 이미지 검사
- 메타데이터 버전
- 농산물 또는 일반 공산품 규칙팩 1개

### MVP-2

- 쿠팡 연결 테스트
- 카테고리·속성 메타데이터
- 상품 조회
- 제한된 실제 읽기

### MVP-3

- DRY_RUN
- 승인함
- canary Runbook
- 상품 1건 제한 등록
- 실패 시 전체 쓰기 중지

### MVP-4

- 가격 레이어
- 재고 ledger
- 예약·확정·해제
- 채널 buffer
- 급변 승인
- 불일치 감지

### MVP-5

- 주문 cursor
- 중복 방지
- 개인정보 보호
- 송장 멱등성
- 취소·반품

### MVP-6

네이버를 추가하면서 공통 코어를 복제하지 않고 Adapter와 Mapping만으로 확장되는지 검증한다.

---

## 14. 시장과 차별화

사방넷·플레이오토·이지어드민 등 기존 통합관리 솔루션과 상품·주문·재고·물류 전체 범위로 정면 경쟁하지 않는다.

> **소규모 판매자가 상품을 올리기 전에 규정·속성·마진·이미지·옵션 오류를 설명 가능한 방식으로 진단하고, 이후 모든 자동 변경의 근거와 복구 경로를 남기는 도구로 차별화한다.**

초기 타깃:

- 입점 전 상품 파일을 정리하는 개인·소규모 판매자
- 공급사 Excel 반복 작업이 많은 판매자
- 상품 등록 실패 원인을 찾기 어려운 판매자
- 농산물·건강기능식품처럼 표시 항목이 많은 업종
- 통합관리 솔루션 도입 전 단계 사용자

---

## 15. 수익화 순서

1. 무료·저가 CSV 진단기
2. 쿠팡 등록 진단 리포트
3. 공급사별 Excel 변환 템플릿
4. 농산물 규칙팩
5. 건강기능식품 검수 보조팩
6. 쿠팡 연결형 유료 모듈
7. 네이버 연결형 유료 모듈
8. 소규모 판매자 구독
9. 맞춤 구축·유지관리

---

## 16. 측정 가능한 KPI

### 진단 품질

- fixture 통과율
- 발견한 누락 필드 수
- false positive 비율
- 진단 후 수정 완료율
- 동일 입력 재현율
- 상품 1건 진단시간

### 운영 안정성

- 주문 누락 감지 건수
- 주문 누락 MTTR
- 중복 주문 차단 건수
- 중복 송장 차단 건수
- 재고 불일치 감지 건수
- 재고 불일치 MTTR
- 재시도 성공률
- 승인 없는 고위험 변경 건수
- 오래된 메타데이터 차단 건수
- 개인정보 파기 성공률

### 사업

- 월 진단 상품 수
- 리포트 다운로드율
- 무료→유료 전환율
- 규칙팩별 매출
- 채널 연결 전환율
- 고객당 절약시간

---

## 17. 첫 코드 백로그

### 지금 바로

1. `docs: add qualification registry`
2. `test: add golden product fixtures`
3. `feat: define canonical product Zod schema`
4. `feat: infer TypeScript types from Zod`
5. `feat: parse one CSV row`
6. `feat: return field-level errors`
7. `feat: define Coupang payload schema`
8. `feat: map canonical product to dry-run payload`
9. `test: snapshot first vertical slice`
10. `feat: render JSON diagnostic report`
11. `feat: render HTML diagnostic report`

### 그다음

12. SKU·옵션 정규화
13. ChannelSkuMapping
14. 최저 판매가 계산
15. 채널 가격 레이어
16. 이미지 검사
17. Metadata Registry
18. stale 메타데이터 감지
19. CI 경계 검사
20. 쿠팡 무샌드박스 Runbook

### 자격 승인 후

21. 쿠팡 인증 클라이언트
22. 연결 테스트
23. 카테고리 메타데이터 읽기
24. 기존 상품 1건 조회
25. canary 상품 1건 등록
26. Inventory Ledger
27. 주문 cursor
28. 멱등 송장 전송

---

## 18. 병렬 진행

### 코드 트랙

```text
Canonical Zod
→ CSV 1행
→ 공통 검증
→ 쿠팡 DRY_RUN payload
→ 골든 테스트
→ HTML 리포트
```

### 자격 트랙

```text
사업자 상태 확인
→ 쿠팡 WING 입점
→ 사업자 인증
→ API 인증정보 발급
→ IP·만료·재발급 운영 절차
```

건강기능식품 진입 시:

```text
판매 형태 확인
→ 신규 위생교육
→ 영업신고
→ 채널 판매권한 확인
→ 규칙팩 실사용 잠금 해제
```

코드 트랙은 자격 트랙을 기다리지 않지만 외부 쓰기는 자격 승인 전에 실행하지 않는다.

---

## 19. 최종 성공 기준

### 첫 성공

- CSV 1행을 넣는다.
- 표준 상품이 생성된다.
- 누락과 위험이 표시된다.
- 예상 마진이 계산된다.
- 쿠팡 payload가 DRY_RUN으로 출력된다.
- 외부 인증정보가 필요하지 않다.

### 두 번째 성공

- 쿠팡 자격을 확보한다.
- DRY_RUN과 테스트를 통과한다.
- 상품 1건을 제한 등록한다.
- 변경 이력이 남는다.
- 즉시 중단·회수할 수 있다.

### 장기 성공

- 두 번째 채널을 추가해도 코어를 복제하지 않는다.
- 새 업종은 규칙팩으로 추가한다.
- 실패·정책 변경·재고 불일치를 설명하고 복구할 수 있다.
- 진단기 자체가 독립적인 유료 상품이 된다.

---

## 20. 최종 결론

첫 제품은 완전 자동 쇼핑몰 운영기가 아니다.

> **첫 제품은 상품을 실제로 올리기 전에 실패·손실·규정 위험을 찾아주는 읽기 전용 진단기다.**

실제 채널 쓰기 연동은 다음 세 조건을 모두 충족한 뒤에만 시작한다.

1. 판매·API 자격 확보
2. DRY_RUN과 골든 테스트 통과
3. 샌드박스 부재를 전제로 한 상품 1건 canary Runbook 승인

이 순서를 지키면 거대한 시스템을 만들다 중단되는 위험과 실계정 자동화 사고 위험을 함께 줄일 수 있다.
