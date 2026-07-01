# Windows 데스크톱 설치·실행 안내

이 문서는 GitHub의 `1976haru/shop` 저장소를 Windows PC에 내려받고, 브라우저에서 실행하고, Claude Code와 Codex를 같은 저장소에서 안전하게 병행하는 절차입니다.

## 1. 준비물

- GitHub Desktop
- Node.js 22.13 이상
- npm(Node.js 설치 시 함께 설치됨)
- 선택: Visual Studio Code
- Claude Code를 Windows에서 직접 쓸 경우 Git for Windows 또는 WSL2

버전 확인:

```powershell
node -v
npm -v
```

Node 버전이 `v22.13.0`보다 낮으면 최신 LTS 버전으로 교체합니다.

## 2. GitHub 저장소를 PC로 복제

1. GitHub Desktop을 실행하고 GitHub 계정으로 로그인합니다.
2. 메뉴에서 `File` → `Clone repository...`를 선택합니다.
3. `GitHub.com` 탭에서 `1976haru/shop`을 선택합니다.
4. `Local path`를 지정합니다.
5. `Clone`을 누릅니다.

권장 경로:

```text
C:\Users\사용자이름\Documents\GitHub\shop
```

바탕화면에 둘 수도 있습니다.

```text
C:\Users\사용자이름\Desktop\shop
```

단, 바탕화면이 OneDrive와 동기화되는 PC에서는 파일 잠금이나 불필요한 동기화가 생길 수 있으므로 `Documents\GitHub\shop`을 권장합니다.

이미 저장소를 복제했다면 새로 clone하지 말고 GitHub Desktop에서 다음만 실행합니다.

1. 현재 브랜치를 `main`으로 선택
2. `Fetch origin`
3. 변경사항이 있으면 `Pull origin`

## 3. 브라우저에서 한 번에 실행

복제한 `shop` 폴더를 파일 탐색기로 연 뒤 다음 파일을 더블클릭합니다.

```text
WINDOWS_START.cmd
```

이 파일은 자동으로 다음 작업을 합니다.

1. Node.js 버전 확인
2. `npm ci`로 정확한 의존성 설치
3. 로컬 서버를 별도 창에서 실행
4. 서버 준비 상태 확인
5. 기본 브라우저에서 `http://127.0.0.1:3000` 열기

앱을 사용하는 동안 `Commerce Diagnostic Hub Server` 창을 닫지 마십시오. 앱을 종료하려면 그 서버 창을 닫으면 됩니다.

## 4. 코드 상태 전체 검사

다음 파일을 더블클릭합니다.

```text
WINDOWS_CHECK.cmd
```

검사 항목:

- 의존성 재현 설치
- TypeScript strict 검사
- 전체 테스트
- 코어 경계검사
- 정상 농산물 CLI 진단

모두 성공하면 다음 결과 파일도 생성됩니다.

```text
tmp\windows-check-report.json
```

## 5. 터미널에서 직접 실행

GitHub Desktop에서 `Repository` → `Open in Command Prompt`를 선택하거나, 저장소 폴더에서 PowerShell을 엽니다.

```powershell
npm ci
npm run typecheck
npm test
npm run check
npm start
```

브라우저 주소:

```text
http://127.0.0.1:3000
```

## 6. Claude Code 사용

Claude Code 설치:

```powershell
npm install -g @anthropic-ai/claude-code
```

저장소 폴더에서 실행:

```powershell
cd C:\Users\사용자이름\Documents\GitHub\shop
claude
```

처음 실행할 때 계정 인증을 진행합니다. Windows에서는 WSL2 또는 Git for Windows 기반 환경을 사용할 수 있습니다.

이 저장소에는 Claude Code용 프로젝트 규칙인 `CLAUDE.md`가 이미 있습니다. Claude Code는 작업 전에 이 파일의 규칙을 따라야 합니다.

## 7. Codex 사용

Codex는 Windows에서 네이티브 PowerShell 또는 WSL2 환경으로 사용할 수 있습니다. Codex CLI 또는 Windows 앱을 설치한 뒤 저장소 폴더에서 실행합니다.

```powershell
cd C:\Users\사용자이름\Documents\GitHub\shop
codex
```

처음 실행할 때 ChatGPT 계정 또는 API 키 인증 화면이 표시됩니다.

이 저장소에는 Codex용 프로젝트 지침인 `AGENTS.md`가 이미 있습니다. Codex는 저장소 루트의 해당 지침을 작업 규칙으로 사용합니다.

## 8. Claude Code와 Codex 병행 원칙

두 도구가 같은 파일을 동시에 수정하게 두지 마십시오. 가장 안전한 방식은 **한 도구가 구현하고 다른 도구가 검토하는 방식**입니다.

권장 예시:

```text
Claude Code: 기능 설계·초기 구현
Codex: 타입·테스트·보안·회귀 검토
```

또는 반대로 사용할 수 있습니다.

```text
Codex: 구현과 테스트
Claude Code: 구조 검토·UI 개선·문서화
```

반드시 작업별 브랜치를 분리합니다.

```text
feat/claude-xlsx-import
fix/codex-image-validation
```

안전한 작업 순서:

1. GitHub Desktop에서 `main`을 최신 상태로 Pull
2. 새 브랜치 생성
3. Claude Code 또는 Codex 중 하나만 수정 작업
4. `npm run typecheck`, `npm test`, `npm run check`
5. 변경사항 commit 및 push
6. 다른 도구로 코드 리뷰
7. 수정 후 Pull Request 생성
8. CI 성공 확인 후 `main` 병합

두 도구를 동시에 쓰려면 서로 다른 Git worktree와 서로 다른 브랜치를 사용해야 합니다. Git worktree가 익숙하지 않다면 동시에 실행하지 않는 편이 안전합니다.

## 9. 일상적인 사용 순서

매번 작업을 시작할 때:

1. GitHub Desktop에서 `main` 선택
2. `Fetch origin`
3. `Pull origin`
4. 새 작업이면 별도 브랜치 생성
5. 브라우저 확인은 `WINDOWS_START.cmd`
6. 코드 검사에는 `WINDOWS_CHECK.cmd`

## 10. 자주 발생하는 문제

### `node`를 찾을 수 없음

Node.js를 설치한 뒤 열려 있던 터미널과 GitHub Desktop을 모두 닫았다가 다시 엽니다.

### `npm ci` 실패

- 저장소가 OneDrive 동기화 폴더라면 `Documents\GitHub`로 옮깁니다.
- 백신 프로그램이 `node_modules` 생성을 차단했는지 확인합니다.
- 저장소 루트에 `package-lock.json`이 있는지 확인합니다.

### 브라우저가 열리지만 접속되지 않음

`Commerce Diagnostic Hub Server` 창의 오류 메시지를 확인합니다. 정상 상태 확인 주소는 다음과 같습니다.

```text
http://127.0.0.1:3000/health/live
```

### 3000 포트를 이미 사용 중

PowerShell에서 확인합니다.

```powershell
netstat -ano | findstr :3000
```

기존에 실행한 Commerce Diagnostic Hub 서버 창이 남아 있다면 그 창을 닫고 다시 실행합니다.

## 11. 원격과 로컬의 의미

- GitHub의 `main`: 원격 원본
- PC의 `shop` 폴더: 로컬 작업본
- `Pull origin`: GitHub의 최신 코드를 PC로 가져오기
- `Push origin`: PC의 commit을 GitHub로 올리기
- Pull 전에 수정 중인 파일이 있다면 먼저 commit하거나 변경 내용을 확인합니다.
