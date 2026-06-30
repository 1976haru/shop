# AGENTS.md

## 절대 규칙

- `packages/core`에서 네트워크, DB, UI 프레임워크를 import하지 않는다.
- 외부 API 호출은 adapter 경계 밖에서 금지한다.
- 외부 전송 기본값은 항상 OFF다.
- 쿠팡 preview는 `nonExecutable=true`, `requested=false`를 유지한다.
- Canonical 타입과 검증 규칙은 `packages/core/src/schema.ts`와 `types.ts`에서만 정의한다.
- 가격 요율은 내부에서 basis point 정수로 계산한다.
- 브랜드, 원산지, GTIN, 모델번호, 인증번호, 과세유형을 추측하거나 생성하지 않는다.
- fixture 결과 변경 시 테스트와 변경 사유를 함께 제출한다.
- 실제 개인정보와 Secret을 fixture, 로그, 커밋에 넣지 않는다.
- 테스트 삭제나 완화로 실패를 숨기지 않는다.
- 사용자 오류 메시지는 한국어로 작성한다.

## 작업 순서

1. 실패하는 테스트 또는 골든 fixture를 먼저 추가한다.
2. 가장 작은 수직 슬라이스를 구현한다.
3. `npm test`와 `npm run check`를 통과한다.
4. README의 실행 절차를 확인한다.
