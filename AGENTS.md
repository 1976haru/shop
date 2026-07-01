# AGENTS.md

## 절대 규칙

- `packages/core`와 `packages/agent`에서 네트워크, DB, UI 프레임워크를 import하지 않는다.
- 외부 API 호출은 `apps/*`의 adapter 경계에서만 허용한다.
- 외부 판매채널 쓰기 기본값은 항상 OFF다.
- 에이전트는 후보와 작업목록을 생성할 뿐 외부 상품등록·가격변경·재고변경을 수행하지 않는다.
- 에이전트 후보는 항상 `humanApprovalRequired=true`다.
- `BLOCKED` 후보는 승인할 수 없다.
- 쿠팡 preview는 `nonExecutable=true`, `requested=false`를 유지한다.
- Canonical 검증의 SSOT는 `packages/core/src/domain-schema.ts`의 Zod 스키마다.
- Agent 계약의 SSOT는 `packages/agent/src/schema.ts`의 Zod 스키마다.
- TypeScript 타입은 Zod 스키마에서 추론하며 수동 중복 선언하지 않는다.
- 가격 요율은 내부에서 basis point 정수로 계산한다.
- 브랜드, 원산지, GTIN, 모델번호, 인증번호, 과세유형을 추측하거나 생성하지 않는다.
- 검색 관심도를 판매량으로 표현하지 않는다.
- 일반식품에 질병 예방·치료 또는 건강기능식품 오인 문구를 생성하지 않는다.
- 건강기능식품 판매업 신고 미확인 시 규정 게이트는 `BLOCKED`다.
- 한 행 또는 한 데이터원의 오류가 전체 실행을 중단시키면 안 된다.
- 외부 데이터원 실패는 가능한 경우 `PARTIAL`로 기록한다.
- fixture 결과 변경 시 테스트와 변경 사유를 함께 제출한다.
- 실제 개인정보와 Secret을 fixture, 로그, 커밋에 넣지 않는다.
- CAPTCHA·로그인·접근제어 우회, 차단회피 프록시 순환을 구현하지 않는다.
- 테스트 삭제나 완화로 실패를 숨기지 않는다.
- 사용자 오류 메시지는 한국어로 작성한다.

## 작업 순서

1. 실패하는 테스트 또는 골든 fixture를 먼저 추가한다.
2. 가장 작은 수직 슬라이스를 구현한다.
3. `npm run typecheck`, `npm test`, `npm run check`를 통과한다.
4. 데모 모드에서 API 키 없이 전체 흐름을 확인한다.
5. LIVE 모드는 공식 API 계약과 출처를 확인한다.
6. README의 실행 절차를 확인한다.
