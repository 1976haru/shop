# CLAUDE.md

이 저장소는 유망 상품 후보를 찾고 공급사 상품 CSV를 등록 전에 진단·교정하는 로컬 우선 도구다.

## 구현 원칙

- 첫 제품은 쿠팡 등록기가 아니라 기회 발굴·등록 전 진단기다.
- `packages/core`와 `packages/agent`는 결정적 순수 함수로 유지한다.
- Canonical 데이터 계약은 `packages/core/src/domain-schema.ts`가 SSOT다.
- Agent 계약은 `packages/agent/src/schema.ts`가 SSOT다.
- 네트워크 호출은 `apps/local-web/src/agent-sources.ts` 같은 adapter에서만 수행한다.
- 에이전트는 후보와 작업목록을 만들고 사람 승인까지 저장하지만 외부 판매 등록은 하지 않는다.
- `BLOCKED` 후보는 승인할 수 없다.
- 건강기능식품 판매업 신고가 확인되지 않으면 `BLOCKED`다.
- 검색 관심도는 판매량이 아니다.
- fixture 결과는 실제 최신 유행을 의미하지 않는다.
- 같은 입력, 정책, 메타데이터 버전은 같은 결과를 만들어야 한다.
- 한 행의 오류는 `BLOCKED` 또는 `DIAGNOSIS_ROW_ERROR`로 격리하고 다음 행을 계속 처리한다.
- 한 외부 데이터원 실패는 가능한 경우 실행을 `PARTIAL`로 남기고 다른 근거로 분석을 계속한다.
- Mock 메타데이터 사용 시 `publishReady=false`다.
- payload preview는 실제 노출 결과를 보장하지 않는다.
- 자동수정은 공백, 안전한 단위 정규화, HTML 정제 등 사실을 바꾸지 않는 범위만 허용한다.

## 완료 기준

- `npm run typecheck`
- `npm test`
- `npm run check`
- 에이전트 DEMO 모드 3개 테마 실행
- `npm run diagnose -- fixtures/slice0/normal-agri.csv`
- `npm start` 후 http://127.0.0.1:3000 접속
