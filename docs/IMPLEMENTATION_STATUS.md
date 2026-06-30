# MVP-0 구현 상태

## 현재 완료

- Slice-0 CLI
- Zod SSOT 기반 Canonical Product 타입·검증·행 변환
- SHA-256 입력 무결성 해시와 결정적 상품 ID
- 주입 가능한 Clock
- 정수 basis point 가격 엔진
- 옵션 수치·단위 정규화
- 농산물 진단 규칙
- 행 단위 오류 격리와 `PARTIAL` 실행 상태
- Mock 메타데이터 신뢰등급 봉인
- 쿠팡 비실행 payload preview
- 쿠팡 enum·길이 계약 fixture
- 4축 준비도 점수
- JSON·HTML·Issues CSV·Payload JSON
- 로컬 SQLite 실행 이력
- 기존 가격정책을 유지하는 필드 수정·재진단
- 실행 비교 API
- 로컬 웹 UI
- 검증된 HTML sanitizer
- TypeScript strict·Docker·GitHub Actions

## 현재 배포 모드

- LOCAL_SINGLE_USER: Node 22.13 이상 + `node:sqlite`
- HOSTED_SINGLE_TENANT: 향후 PostgreSQL·작업 큐 어댑터 추가

## 다음 구현 단계

- XLSX 입력과 컬럼 매핑 프로파일 UI
- 이미지 묶음 안전 해제와 픽셀·용량 검사
- 규칙팩 manifest·서명·정책 영향 시뮬레이션
- PostgreSQL·작업 큐 운영 모드
- Windows 설치형 패키지
- 건강기능식품 규칙팩
- 자격 승인 후 쿠팡 읽기 API와 1건 canary 쓰기

## 제한

현재 버전은 외부 판매채널 API를 호출하지 않으며 실제 상품을 등록하지 않습니다. Fixture 메타데이터를 사용하면 항상 `publishReady=false`입니다. Node 22의 내장 SQLite API는 Active development 상태이므로 일반 사용자용 최종 설치판에서는 저장소 어댑터를 다시 평가합니다.
