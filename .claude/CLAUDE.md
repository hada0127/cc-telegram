# Claude 설정

## 응답 스타일
- 반말로 응답한다 (할게, 했어, 할까? 등)

## 작업 규칙
- 모든 작업 완료 후 .claude 폴더 내의 적절한 파일에 작업 내용을 반영한다
- **작업 완료 시 반드시 커밋 및 푸시**:
  1. `git add -A`
  2. 변경 내용에 맞는 커밋 메시지 생성 (feat/fix/docs/test/chore)
  3. `git commit -m "타입: 설명"`
  4. `git push origin HEAD`

## 프로젝트 개요
- 텔레그램을 통해 클로드 코드를 원격 제어하는 프로그램
- npx cc-telegram으로 실행

## 에이전트 (Task tool로 호출)
| 에이전트 | 용도 |
|----------|------|
| telegram-bot-developer | 텔레그램 봇 코드 작성 |
| claude-code-executor | 클로드 코드 실행 로직 |
| task-management-architect | 작업 관리 시스템 설계 |

## 스킬 (자동 적용)
Claude가 작업 내용에 따라 자동으로 적용하는 스킬들:

| 스킬 | 용도 |
|------|------|
| npm-package-init | npx 실행 가능한 패키지 구조 초기화 |
| telegram-bot | 텔레그램 봇 명령어/폴링/키보드 구현 |
| claude-executor | 클로드 코드 실행 및 반복 처리 |
| task-manager | 작업 생성/상태관리/조회 |
| encryption | 봇 토큰 암호화 |
| init-setup | 최초 실행 시 환경 초기화 |

## 문서
| 문서 | 설명 |
|------|------|
| [features.md](docs/features.md) | 구현된 기능 상세 |
| [structure.md](docs/structure.md) | 프로젝트 폴더 구조 |

## 작업 시 참고 파일
- .claude/skills/*/SKILL.md: 각 스킬 상세 정의

## 최근 개선 사항
### 2026-01-13 적용 완료
1. **복잡 작업 Plan 모드 자동 적용**
   - 복잡도(complexity) 필드 추가: 'simple' / 'complex'
   - 복잡 작업(complexity: 'complex') 실행 시 Claude에 `--permission-mode plan` 옵션 자동 추가
   - 프롬프트에 plan 모드 지시 추가 (계획 자동 승인, 사용자 입력 대기 안함)
   - 단순 작업(complexity: 'simple')은 기존 방식 유지

2. **테스트 케이스 추가**
   - COMPLEXITY 상수 테스트 추가
   - createTask complexity 파라미터 테스트 추가
   - buildPrompt plan 모드 지시 테스트 추가
   - 총 381개 테스트 케이스 (2026-01-13 기준)

### 2026-01-12 적용 완료
1. **반복 작업 완료 신호 필수화 (엄격 모드)**
   - 반복 작업(maxRetries > 1)에서 자동으로 엄격 모드 적용
   - 엄격 모드: `<promise>COMPLETE</promise>` 또는 `<promise>FAILED</promise>` 신호 필수
   - 신호 없이 종료 시 실패로 처리 → 다음 반복 진행
   - 단순 작업(maxRetries = 1)은 기존 동작 유지 (하위 호환성)
   - 문제 해결: 반복 작업이 완료되지 않았는데 조기 완료 처리되던 버그

2. **HTML 파싱 오류 자동 복구**
   - 텔레그램 API의 HTML 파싱 오류 시 plain text로 자동 재시도
   - sendLongMessage에서 `<pre>`, `<b>`, `<code>` 태그 분할 시 올바르게 닫고 열기
   - 오류 메시지: "can't parse entities: Can't find end tag" 문제 해결

3. **테스트 케이스 추가**
   - 엄격 모드 관련 테스트 15개 추가
   - HTML 파싱 및 sendLongMessage 테스트 7개 추가
   - 총 375개 테스트 케이스 (2026-01-12 기준)

### 2026-01-11 적용 완료
1. **작업 완료/실패 시 전체 CLI 출력 표시**
   - 요약 대신 전체 Claude CLI 출력을 텔레그램으로 전송
   - 긴 출력은 자동 분할 전송 (4000자 단위)
   - `<pre>` 태그로 CLI 출력 스타일 유지
   - sendLongMessage() 함수 추가

2. **작업 생성 시 파일 첨부 기능**
   - 요구사항/완료 조건 입력 시 파일 첨부 가능
   - 파일 먼저 전송 후 텍스트로 요구사항 입력
   - 첨부 파일은 `.cc-telegram/temp/{taskId}/`에 저장
   - 작업 완료/실패/취소 시 자동으로 임시 파일 삭제
   - 세션 기반 파일 관리 (sessionId → taskId로 이동)

2. **첨부 파일 관리 유틸리티** (src/utils/attachments.js)
   - generateSessionId(): 임시 세션 ID 생성
   - saveAttachment(): 파일 저장
   - moveSessionToTask(): 세션 → 작업으로 파일 이동
   - cleanupTaskTempDir(): 작업 완료 시 정리
   - cleanupOldTempDirs(): 오래된 세션 정리

3. **테스트 케이스 추가**
   - attachments.test.js: 17개 테스트 케이스
   - 총 353개 테스트 케이스 (2026-01-11 기준)

### 2026-01-10 적용 완료
1. **Claude 실행 명령어 설정화** (config.claudeCommand)
   - config.json에서 claudeCommand 필드로 사용자 지정 가능
   - null이면 자동 감지 (Windows: claude.cmd, 기타: claude)
   - 예: "npx claude", "/usr/local/bin/claude" 등

2. **로그 로테이션 기능** (config.logRetentionDays)
   - 시작 시 오래된 로그 파일 자동 정리
   - 기본 보관 기간: 7일 (설정 변경 가능)
   - 완료/실패 작업 파일: 30일 후 자동 삭제

3. **작업 우선순위 기능** (PRIORITY 상수)
   - LOW(1), NORMAL(2), HIGH(3), URGENT(4)
   - 텔레그램 작업 생성 시 우선순위 선택 가능
   - 높은 우선순위 작업이 먼저 실행됨

4. **단위 테스트 추가**
   - tests/ 폴더에 핵심 로직 테스트 코드
   - npm test로 실행 (Jest 기반)
   - 322개 테스트 케이스 (2026-01-10 기준)
   - 테스트 파일: tasks.js, executor.js, encryption.js, logRotation.js, config.js, telegram.js 등

5. **실행 중인 작업 취소 기능** (cancelRunningTask)
   - /status 명령에서 실행 중인 작업마다 중지 버튼 표시
   - 버튼 클릭 시 프로세스 종료 및 작업 실패 처리
   - Windows/Unix 모두 지원
