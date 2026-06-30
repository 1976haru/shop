# MVP-0 코드 리뷰 보완 결과

기준일: 2026-07-01

## 반영 완료

### P0

- 금액·재고·중량 범위 오류를 `throw`가 아닌 행 단위 `BLOCKED` 이슈로 변환
- 예상하지 못한 행 예외를 `DIAGNOSIS_ROW_ERROR`로 격리
- 다른 행의 진단 계속 진행
- `run.status = PARTIAL | COMPLETED` 실제 구현
- `rowErrors` 실제 집계
- 음수 원가 1행과 정상 1행 혼합 회귀 테스트 추가

### P1

- TypeScript 6 strict typecheck와 CI 단계 추가
- Canonical Product 및 리포트 계약을 Zod SSOT로 전환
- 타입은 Zod 스키마에서 추론
- `inputSha256`을 실제 SHA-256으로 교체
- `internalCode`를 `SHA-256(supplierId|supplierSku)` 앞 12자리로 교체
- LOCAL 모드는 SQLite로 확정하고 HOSTED 모드는 향후 PostgreSQL로 분리
- Node 22 내장 SQLite가 Active development 상태임을 문서화

### P2

- 수정·재진단 시 최초 실행의 가격정책 재사용
- 정규식 HTML 정제기를 `sanitize-html`로 교체
- sanitizer 우회 패턴 테스트 추가
- ISO2 원산지 코드 검증
- 금액·재고·중량 상하한 검증
- sellerProductName 100자 및 itemName 150자 검증
- Coupang enum·길이 계약 fixture 추가
- `adultOnly=EVERYONE`, 수입·해외구매대행 기본 enum 계약 테스트

## 의도적으로 유지한 결정

### LOCAL_SINGLE_USER

- 저장소: `node:sqlite`
- 이유: 설치가 가볍고 단일 PC 로컬 운영에 적합
- 제한: Node 22에서 Active development 상태
- 지원 Node: 22.13 이상

### HOSTED_SINGLE_TENANT

- 향후 PostgreSQL 어댑터를 별도로 추가
- LOCAL SQLite와 운영형 PostgreSQL을 같은 저장소 포트 뒤에서 교체

## 검증 명령

```bash
npm install
npm run typecheck
npm test
npm run check
npm run diagnose -- fixtures/slice0/normal-agri.csv --out tmp/report.json
```
