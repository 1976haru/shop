# Commerce Diagnostic Hub

공급사 상품 CSV의 등록 실패·속성 누락·마진 위험을 외부 판매채널 전송 없이 검사하는 로컬 우선 진단 도구입니다.

## 구현된 기능

- CSV 업로드와 CP949/UTF-8 처리
- Canonical Product 변환과 결정적 상품 코드
- basis point 정수 가격 계산
- 브랜드·식별자·카테고리·옵션 단위·고시정보 진단
- `requested=false` 쿠팡 payload preview
- PASS/WARNING/BLOCKED 및 4축 준비도
- JSON·HTML·Issues CSV·Payload JSON 결과
- 로컬 SQLite 실행 이력
- 필드 수정 후 재진단
- 실행 비교 API
- 오류 샘플 체험

## 실행

Node.js 22.5 이상이 필요하며 별도 패키지 설치는 없습니다.

```bash
npm test
npm run check
npm start
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다.

CLI 실행:

```bash
npm run diagnose -- fixtures/slice0/normal-agri.csv \
  --metadata fixtures/coupang-meta/agri.fixture.json \
  --policy fixtures/policies/local-default.json \
  --out tmp/report.json
```

Docker 실행:

```bash
docker compose up --build
```

## 안전 고지

- 실제 쿠팡 API를 호출하거나 상품을 등록하지 않습니다.
- preview는 요청 본문 사전보기이며 실제 노출 결과를 보장하지 않습니다.
- fixture 메타데이터 사용 시 `publishReady=false`입니다.
- 브랜드·원산지·식별자·인증·세금 정보를 자동으로 추측하지 않습니다.

## 후속 범위

- XLSX 직접 읽기
- 이미지 ZIP 픽셀 검사
- PostgreSQL·작업 큐 운영 모드
- 실제 쿠팡 읽기·쓰기 연동
- Windows 설치 프로그램
