# cc-telegram 구현 기능

## 개요
텔레그램을 통해 원격으로 Claude Code를 실행하고 관리하는 CLI 도구

## 핵심 기능

### 1. 텔레그램 봇 (telegram.js)
텔레그램 Long Polling 방식으로 명령어를 수신하고 처리

**지원 명령어:**
| 명령어 | 설명 |
|--------|------|
| `/start` | chatId 확인 |
| `/new` | 새 작업 생성 (단순/복잡 선택) |
| `/list` | 대기/진행중 작업 목록 (우선순위순) |
| `/completed` | 완료된 작업 목록 (최근 10개) |
| `/failed` | 실패한 작업 목록 (최근 10개) |
| `/status` | 현재 진행중인 작업 상태 + 최근 출력 |
| `/debug` | 시스템 상태 (메모리, 가동시간 등) |
| `/cancel` | 작업 생성 플로우 취소 |
| `/reset` | 모든 데이터 초기화 (확인 필요) |

**작업 생성 플로우:**
1. 복잡도 선택 (단순/복잡)
2. 단순: 요구사항만 입력 → 바로 등록 (1회 실행)
3. 복잡: 요구사항 → 완료 기준 → 우선순위 → 반복 횟수 (기본값은 config.defaultMaxRetries)

**특징:**
- 인라인 키보드 버튼 지원
- 사용자 상태 관리 (Map으로 대화 플로우 추적)
- API 재시도 로직 (429 에러, 네트워크 오류)
- 봇 시작 시 PC 이름과 실행 경로 알림

### 2. 작업 관리 (tasks.js)
작업의 생성, 상태 변경, 조회를 담당

**작업 상태:**
- `ready`: 대기 중
- `inProgress`: 진행 중

**작업 우선순위:**
| 레벨 | 상수 | 아이콘 |
|------|------|--------|
| 1 | LOW | 🔵 |
| 2 | NORMAL | 🟢 |
| 3 | HIGH | 🟠 |
| 4 | URGENT | 🔴 |

**주요 함수:**
- `createTask()`: 새 작업 생성 (날짜 기반 ID)
- `getNextTask()`: 다음 실행할 작업 (우선순위 높은 것 먼저, 같으면 오래된 것 먼저)
- `startTask()`: 작업 시작 (상태를 inProgress로)
- `incrementRetry()`: 재시도 횟수 증가
- `completeTask()`: 완료 처리 (completed 폴더로 이동)
- `failTask()`: 실패 처리 (failed 폴더로 이동)
- `cleanupOrphanTasks()`: 비정상 종료 후 inProgress 작업 복구

### 3. Claude 실행기 (executor.js)
Ralph Wiggum 방식의 반복 실행 엔진

**실행 흐름:**
1. 5초마다 대기 작업 확인
2. 작업 발견 시 프롬프트 생성
3. Claude Code 실행 (30분 타임아웃)
4. 결과 분석 (완료 신호 기반)
5. 성공 시 완료 처리, 실패 시 재시도 또는 최종 실패

**완료 신호:**
- `<promise>COMPLETE</promise>`: 성공
- `<promise>FAILED</promise>`: 실패

**프롬프트 구조:**
```
# 작업 요청
## 요구사항
## 완료 조건
## 지시사항
## 완료 신호 (중요!)
```

**결과 분석:**
1. 완료 신호 기반 판단 (최우선)
2. 패턴 기반 폴백 (error, fatal, exception 등)
3. 불확실한 경우:
   - 일반 모드 (maxRetries = 1): 성공으로 간주
   - **엄격 모드 (maxRetries > 1): 실패로 처리** → 다음 반복 진행

**엄격 모드 (반복 작업용):**
- 반복 작업(maxRetries > 1)에서 자동 적용
- 완료 신호(`COMPLETE` 또는 `FAILED`)가 필수
- 신호 없이 종료 시 실패로 처리되어 다음 반복 진행
- 목적: 반복 작업이 조기에 완료 처리되는 것을 방지

### 4. 설정 관리 (config.js)
봇 토큰과 chatId를 암호화하여 저장

**설정 항목:**
| 항목 | 설명 | 기본값 |
|------|------|--------|
| botToken | 텔레그램 봇 토큰 | (암호화됨) |
| chatId | 허용된 채팅 ID | (암호화됨) |
| debugMode | 디버그 로그 출력 | false |
| claudeCommand | Claude 실행 명령어 | null (자동감지) |
| logRetentionDays | 로그 보관 기간 | 7일 |
| defaultMaxRetries | 기본 반복 횟수 | 15회 |
| parallelExecution | 병렬 실행 사용 | false |
| maxParallel | 최대 동시 실행 개수 | 3 |

### 5. 초기화 (init.js)
최초 실행 시 환경 설정

**초기화 과정:**
1. 폴더 구조 생성 (.cc-telegram/)
2. 초기 JSON 파일 생성
3. .gitignore 업데이트
4. 봇 토큰 입력 및 유효성 검사
5. /start 메시지 대기 → chatId 감지
6. chatId 검증 입력
7. 설정 저장 및 봇 명령어 등록

## 유틸리티

### 암호화 (encryption.js)
- AES-256-GCM 알고리즘 사용
- 사용자 환경 기반 키 생성 (hostname, username, homedir, arch, platform)
- 다른 환경에서 복호화 불가 (보안)

### 로거 (logger.js)
- 레벨: info, warn, error, debug
- 콘솔 출력 + 날짜별 로그 파일 저장
- debug는 debugMode일 때만 출력

### 원자적 파일 쓰기 (atomicFile.js)
- 임시 파일에 쓴 후 rename으로 이동
- 파일 손상 방지 (정전 등)

### 로그 로테이션 (logRotation.js)
- 시작 시 자동 실행
- 로그 파일: logRetentionDays 이후 삭제
- 완료/실패 작업: 30일 이후 삭제

### 다국어 지원 (i18n.js)
시스템 언어에 따라 자동으로 번역을 제공

**지원 언어:**
- 한국어(ko), 영어(en), 중국어(zh), 스페인어(es), 힌디어(hi)
- 아랍어(ar), 포르투갈어(pt), 러시아어(ru), 일본어(ja), 프랑스어(fr), 독일어(de)

**주요 기능:**
- `detectSystemLanguage()`: 시스템 언어 자동 감지 (Windows PowerShell, 환경 변수)
- `t(key, params)`: 번역 문자열 가져오기 (점 표기법, 파라미터 치환)
- `loadTranslations(lang)`: 번역 데이터 로드
- `setLanguage(lang)`: 언어 변경

**번역 파일:**
- `src/locales/{lang}.json` 형식
- 지원되지 않는 언어는 영어(en)로 폴백

## CLI (cli.js)

**실행 흐름:**
1. 설정 파일 확인
2. 없으면 초기화 실행
3. 있으면:
   - 로거 초기화
   - orphan 작업 정리
   - 로그 로테이션 실행
   - 봇 및 실행기 시작
   - 무한 대기

**종료 핸들러:**
- SIGINT (Ctrl+C), SIGTERM 처리
- 봇과 실행기 정상 종료

## 데이터 구조

### 작업 (Task)
```json
{
  "id": "20260110-071451-135",
  "requirement": "요구사항",
  "completionCriteria": "완료 조건",
  "maxRetries": 10,
  "currentRetry": 0,
  "status": "ready",
  "priority": 2,
  "createdAt": "2026-01-10T...",
  "startedAt": null,
  "workingDirectory": "/path/to/project"
}
```

### 완료된 작업
```json
{
  "id": "...",
  "requirement": "...",
  "completionCriteria": "...",
  "maxRetries": 10,
  "totalRetries": 3,
  "createdAt": "...",
  "startedAt": "...",
  "completedAt": "...",
  "summary": "작업 완료 요약 (최대 300자)"
}
```

## 테스트
Jest 기반 단위 테스트 (`npm test`)

**테스트 파일:**
- tasks.test.js
- executor.test.js
- encryption.test.js
- logRotation.test.js
- config.test.js
- logger.test.js
- atomicFile.test.js
- init.test.js
- cli.test.js
- telegram.test.js
- index.test.js
