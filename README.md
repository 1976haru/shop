# Commerce Diagnostic Hub

공급사 상품 CSV를 쿠팡에 올리기 전에 **등록 실패·속성 누락·이미지 위험·마진 손실**을 찾아주는 로컬 우선 진단 도구입니다.

현재 구현 범위는 **Slice-0 + 로컬 MVP-0A 베타**입니다.

## 현재 가능한 기능

- CSV 업로드 및 CP949/UTF-8 디코딩
- Canonical Product 변환과 결정적 상품 코드
- basis point 정수 가격 계산
- 브랜드·식별자·카테고리·옵션 단위·고시정보 진단
- 쿠팡 비실행 payload preview (`requested=false`)
- PASS/WARNING/BLOCKED 및 4축 준비도
- JSON·HTML·Issues CSV·Payload ZIP 다운로드
- 로컬 SQLite 실행 이력
- 필드 패치 후 즉시 재진단
- 이전 실행 비교(run diff)
- 오류 샘플 즉시 체험
- 외부 네트워크 호출 0건

## 요구사항

- Node.js 22.5 이상
- 별도 npm 패키지 설치 없음

## 1분 실행

```bash
git clone https://github.com/1976haru/shop.git
cd shop
git checkout feat/mvp0-implementation
cp .env.example .env
npm test
npm start
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다.

## CLI

```bash
npm run diagnose -- fixtures/slice0/normal-agri.csv \
  --metadata fixtures/coupang-meta/agri.fixture.json \
  --policy fixtures/policies/default-price.json \
  --out tmp/report.json
```

## Docker

```bash
docker compose up --build
```

## 안전 고지

- 이 버전은 쿠팡 API를 호출하지 않습니다.
- preview는 요청 본문 형식의 사전보기이며 실제 등록·승인·노출 결과를 보장하지 않습니다.
- fixture 메타데이터를 쓰면 `publishReady=false`입니다.
- 브랜드, 원산지, 식별자, 인증, 세금 정보를 자동으로 추측하지 않습니다.

## 아직 제외된 범위

- XLSX 직접 읽기
- 이미지 ZIP 픽셀 실검사
- PostgreSQL/pg-boss 운영 배포
- 실제 쿠팡 읽기·쓰기 API
- Windows 설치 프로그램

이 항목들은 명세의 MVP-0A 후속 단계로 남겨져 있습니다. 현재 코드는 코어와 사용자 흐름을 먼저 검증하는 실행 가능한 베타입니다.
