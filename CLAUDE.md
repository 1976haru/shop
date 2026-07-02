# CLAUDE.md — commerce-diagnostic-hub 작업 규칙

## 프로젝트 한 줄
검증된 사실만 상품 등록·쇼핑쇼츠가 되는 로컬 우선 커머스 자동화.
"제안은 자동, 실행은 사람 승인"이 정체성이다.

## 명령어
- 의존성: `npm ci` (테스트 전 필수 — 미설치가 최다 실패 원인)
- 테스트: `npm test` / 코어만: `npm run test:core`
- 타입검사: `npm run typecheck`
- 경계검사: `npm run check` (core·agent·campaign에 네트워크/DB import 금지)
- 실행: `APP_PORT=3000 npm start` (PORT 아님 주의)
- 진단 CLI: `npm run diagnose fixtures/slice0/normal-agri.csv`
- 렌더 데모: `npm run render:demo` (ffmpeg + 한글 폰트 필요)

## 절대 규칙 (위반 시 PR 거부됨)
1. packages/core, packages/agent, packages/campaign 안에서 fetch/네트워크/DB 금지.
   외부 호출은 apps/* 계층에서만. `npm run check`가 이를 강제한다.
2. 타입은 Zod 스키마에서 z.infer로만 파생. 수동 interface 중복 선언 금지.
3. 골든 픽스처(fixtures/)의 기대값 변경은 커밋 메시지에
   `BREAKING-FIXTURE:` 접두어 + 사유 명시. 몰래 수정 금지.
4. 자동 업로드/자동 게시/채널 쓰기 API 호출 코드 작성 금지.
   모든 산출물은 requiresHumanReview 또는 승인 게이트를 거친다.
5. 돈 계산은 정수(원, basis point)만. 부동소수 요율 연산 금지 (money.ts 패턴).
6. 결정성: Date.now()/Math.random() 직접 호출 금지. Clock/createId 주입 사용.
   (예외: 렌더 임시파일 등 비순수 apps 계층의 OS 상호작용)
7. API 키·시크릿은 .env만. 코드/픽스처/커밋 포함 금지. BYOK 원칙:
   외부 유료 API(AI영상/TTS)는 사용자 키를 .env에서 읽는 구조로만.
8. 영상 속 사실(가격·구성·원산지)은 승인된 캠페인 데이터에서만 파생.
   렌더러에 임의 텍스트 주입 경로를 만들지 않는다 (FACT_SOURCE_MISMATCH 예방).

## 작업 방식
- 테스트 우선: 구현 전에 골든 픽스처/테스트를 먼저 커밋한다.
- 한 세션 = 한 슬라이스 = 한 PR. 범위를 넘는 리팩터링 금지.
- 세션 종료 전 필수: npm ci && npm test && npm run typecheck && npm run check 전부 통과.
- 막히면 우회 구현하지 말고 BLOCKED.md에 상황을 적고 멈춘다.

## 아키텍처 지도
- packages/core: 진단·가격·payload (순수)
- packages/campaign: 쇼츠 캠페인·크리에이티브·렌더 계획 (순수)
- packages/agent: 리서치 에이전트 로직 (순수)
- apps/local-web: 서버·UI·SQLite·외부 데이터원 (비순수 허용)
- apps/renderer: ffmpeg 렌더 실행기 (비순수 허용)
- apps/cli: 진단 CLI
- fixtures/: 골든 정답지 · docs/: 명세 (구현 전 반드시 해당 명세 읽기)
