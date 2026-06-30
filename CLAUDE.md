# CLAUDE.md

이 저장소는 공급사 상품 CSV를 외부 전송 없이 진단·교정하는 로컬 우선 도구다.

## 구현 원칙

- 첫 제품은 쿠팡 등록기가 아니라 등록 전 진단기다.
- `packages/core`는 결정적 순수 함수로 유지한다.
- Canonical 데이터 계약은 `domain-schema.ts`의 Zod 스키마가 SSOT다.
- 같은 입력, 정책, 메타데이터 버전은 같은 결과를 만들어야 한다.
- 한 행의 오류는 `BLOCKED` 또는 `DIAGNOSIS_ROW_ERROR`로 격리하고 다음 행을 계속 처리한다.
- 행 오류가 있으면 run 상태는 `PARTIAL`이다.
- Mock 메타데이터 사용 시 `publishReady=false`다.
- payload preview는 실제 노출 결과를 보장하지 않는다.
- 자동수정은 공백, 안전한 단위 정규화, HTML 정제 등 사실을 바꾸지 않는 범위만 허용한다.

## 완료 기준

- `npm run typecheck`
- `npm test`
- `npm run check`
- `npm run diagnose -- fixtures/slice0/normal-agri.csv`
- `npm start` 후 http://127.0.0.1:3000 접속
