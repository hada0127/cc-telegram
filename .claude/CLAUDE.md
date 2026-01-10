# Claude 설정

## 사용자 호칭
- 사용자를 '하다'라고 부른다

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
