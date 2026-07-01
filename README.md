# Commerce Opportunity & Diagnostic Hub

쇼핑몰을 잘 모르는 사용자도 **테마 선택 → 상품 후보 수집 → 시장성·수익성·규정 검토 → 사람 승인 → 등록 전 진단**까지 한 화면에서 진행할 수 있는 로컬 우선 도구입니다.

외부 판매채널에 상품을 자동 등록하지 않으며, 에이전트가 만든 모든 후보는 사람의 최종 승인을 거칩니다.

## 핵심 기능

### 테마 기회 발굴 에이전트

- 농산물·지역특산품
- 일반 건강식품·헬시플레저 식품
- 건강기능식품
- 데모 데이터로 즉시 체험
- 공급사 CSV를 상품 후보로 연결
- 시장성·수익성·공급안정성·운영난이도 점수
- 규정 적합성을 점수와 분리된 `PASS/WARNING/BLOCKED` 게이트로 처리
- 건강기능식품 판매업 신고 미확인 시 자동 차단
- 후보별 추천 이유·위험·다음 작업 생성
- 사람이 선택한 후보만 검토 승인
- 에이전트 실행·승인 이력 SQLite 저장
- 외부 판매 등록 및 가격·재고 변경 0건

### 공식 데이터원 어댑터

- KAMIS 최근 도·소매가격 Open API
- NAVER Search Trend / NAVER API HUB 교체형 어댑터
- 식품안전나라 Open API
- 공급사 CSV
- 안전한 테마별 fixture

외부 연구는 기본적으로 꺼져 있습니다. API 키가 없더라도 데모 모드와 공급사 CSV 분석은 바로 사용할 수 있습니다.

### 상품 등록 전 진단

- CSV 업로드와 CP949/UTF-8 처리
- 행 단위 오류 격리와 `PARTIAL` 실행 상태
- Zod 기반 Canonical Product 단일 스키마
- SHA-256 기반 입력 무결성·결정적 상품 코드
- basis point 정수 가격 계산
- 브랜드·식별자·카테고리·옵션 단위·고시정보 진단
- `requested=false` 쿠팡 payload preview
- PASS/WARNING/BLOCKED 및 4축 준비도
- JSON·HTML·Issues CSV·Payload JSON 결과
- 필드 수정 후 기존 가격정책으로 재진단
- 실행 비교 API

## 요구사항

- Node.js 22.13 이상
- npm

## Windows 빠른 실행

GitHub Desktop으로 저장소를 clone 또는 Pull한 뒤 저장소 루트의 다음 파일을 더블클릭합니다.

```text
WINDOWS_START.cmd
```

의존성 설치, 서버 실행, 준비 상태 확인, 브라우저 열기를 자동으로 수행합니다. 전체 코드 검사는 다음 파일을 사용합니다.

```text
WINDOWS_CHECK.cmd
```

GitHub Desktop 복제와 Claude Code·Codex 병행 절차는 [`docs/DESKTOP_SETUP_KO.md`](docs/DESKTOP_SETUP_KO.md)를 참고합니다.

## 실행

```bash
npm ci
npm run typecheck
npm test
npm run check
npm start
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다.

처음에는 다음 순서로 사용합니다.

1. `유망 테마·상품 후보 찾기`에서 테마를 선택합니다.
2. `데모 데이터로 체험`을 선택합니다.
3. 공급사 CSV가 있으면 선택하고, 없으면 그대로 실행합니다.
4. 원산지 증빙·이미지 사용권·건기식 판매업 신고 여부를 체크합니다.
5. `에이전트 실행`을 누릅니다.
6. 후보별 점수·근거·위험을 확인하고 필요한 후보만 승인합니다.
7. 실제 상품 등록 전에는 아래 CSV 진단기로 다시 검증합니다.

## 실시간 공식 데이터 수집

`.env.example`을 `.env`로 복사하고 다음 값을 설정합니다.

```env
ALLOW_EXTERNAL_RESEARCH=true

KAMIS_CERT_KEY=
KAMIS_CERT_ID=

NAVER_TREND_ENDPOINT=
NAVER_TREND_CLIENT_ID=
NAVER_TREND_CLIENT_SECRET=
NAVER_TREND_ID_HEADER=X-Naver-Client-Id
NAVER_TREND_SECRET_HEADER=X-Naver-Client-Secret

FOOD_SAFETY_KEY=
FOOD_SAFETY_SERVICE_ID=
FOOD_SAFETY_QUERY_FIELD=
```

### NAVER API 주의

2026년 6월 25일부터 Search API, Search Trend API, Shopping Insight API가 NAVER API HUB로 이관되기 시작했습니다. 기존 개발자센터 신규 신청은 2026년 7월 31일 차단되고, 기존 서비스는 2027년 6월 30일 지원 종료 예정이므로 endpoint와 인증 헤더를 환경변수로 분리했습니다.

### 데이터 수집 원칙

- 공식 Open API를 우선 사용
- 사용자가 제공한 공급사 CSV 사용
- CAPTCHA·로그인·접근제어 우회 금지
- 차단 회피용 프록시 순환 금지
- 수집 실패 시 전체 실행을 멈추지 않고 `PARTIAL`로 기록
- 검색 관심도를 실제 판매량으로 표현하지 않음
- 근거의 출처·수집시각·fixture 여부를 결과에 기록

## CLI 상품 진단

```bash
npm run diagnose -- fixtures/slice0/normal-agri.csv \
  --metadata fixtures/coupang-meta/agri.fixture.json \
  --policy fixtures/policies/local-default.json \
  --out tmp/report.json
```

## Docker

```bash
docker compose up --build
```

실시간 API 키는 `.env`에 넣고 저장소에 커밋하지 않습니다.

## 저장소 모드

### LOCAL_SINGLE_USER

- `node:sqlite` 사용
- 단일 PC에서 가볍게 실행하기 위한 기본 모드
- 데이터 파일 기본 위치: `./data/runs.sqlite`

### HOSTED_SINGLE_TENANT

- PostgreSQL·작업 큐는 후속 운영 모드에서 별도 어댑터로 추가
- 현재 Docker Compose는 LOCAL SQLite 모드

## 안전 고지

- 실제 쿠팡 API를 호출하거나 상품을 등록하지 않습니다.
- 에이전트의 `승인`은 내부 검토승인이며 외부 판매등록이 아닙니다.
- 데모 fixture 점수는 실제 최신 유행이나 판매량을 뜻하지 않습니다.
- 일반식품을 건강기능식품처럼 광고하는 문구를 자동 생성하지 않습니다.
- 브랜드·원산지·식별자·인증·세금 정보를 추측하지 않습니다.
- 건강기능식품은 판매업 신고와 제품 신고정보 확인 전 `BLOCKED` 상태를 유지합니다.

## 후속 범위

- XLSX 직접 읽기와 공급사별 컬럼 매핑 UI
- 이미지 ZIP 픽셀 검사
- KAMIS 품목코드·온라인가격 상세 매핑
- NAVER API HUB 최종 계약 fixture
- 식품안전나라 서비스별 전용 매퍼
- 정책 변경 영향 시뮬레이션
- PostgreSQL·작업 큐 운영 모드
- 실제 쿠팡 읽기·쓰기 연동
- Windows 설치 프로그램
