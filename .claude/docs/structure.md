# cc-telegram 프로젝트 구조

## 폴더 트리

```
cc-telegram/
├── src/                          # 소스 코드
│   ├── cli.js                    # CLI 진입점 (npx 실행)
│   ├── index.js                  # 모듈 export
│   ├── config.js                 # 설정 관리
│   ├── init.js                   # 초기화 로직
│   ├── tasks.js                  # 작업 관리
│   ├── executor.js               # Claude 실행기
│   ├── telegram.js               # 텔레그램 봇
│   ├── i18n.js                   # 다국어(i18n) 지원
│   ├── locales/                  # 번역 파일
│   │   ├── ko.json               # 한국어
│   │   ├── en.json               # 영어
│   │   ├── zh.json               # 중국어
│   │   ├── es.json               # 스페인어
│   │   ├── hi.json               # 힌디어
│   │   ├── ar.json               # 아랍어
│   │   ├── pt.json               # 포르투갈어
│   │   ├── ru.json               # 러시아어
│   │   ├── ja.json               # 일본어
│   │   ├── fr.json               # 프랑스어
│   │   └── de.json               # 독일어
│   └── utils/                    # 유틸리티
│       ├── encryption.js         # 암호화/복호화
│       ├── logger.js             # 로깅
│       ├── atomicFile.js         # 원자적 파일 쓰기
│       └── logRotation.js        # 로그 로테이션
│
├── tests/                        # Jest 테스트
│   ├── tasks.test.js
│   ├── executor.test.js
│   ├── encryption.test.js
│   ├── logRotation.test.js
│   ├── config.test.js
│   ├── logger.test.js
│   ├── atomicFile.test.js
│   ├── init.test.js
│   ├── cli.test.js
│   ├── telegram.test.js
│   └── index.test.js
│
├── .claude/                      # Claude 설정
│   ├── CLAUDE.md                 # 프로젝트 지침
│   ├── docs/                     # 문서
│   │   ├── features.md           # 구현 기능
│   │   └── structure.md          # 폴더 구조 (이 파일)
│   ├── agents/                   # 에이전트 정의
│   │   ├── telegram-bot-developer.md
│   │   ├── claude-code-executor.md
│   │   └── task-management-architect.md
│   └── skills/                   # 스킬 정의
│       ├── npm-package-init/
│       ├── telegram-bot/
│       ├── claude-executor/
│       ├── task-manager/
│       ├── encryption/
│       └── init-setup/
│
├── .cc-telegram/                 # 런타임 데이터 (gitignore)
│   ├── config.json               # 암호화된 설정
│   ├── tasks.json                # 대기/진행중 작업 인덱스
│   ├── completed.json            # 완료 작업 인덱스
│   ├── failed.json               # 실패 작업 인덱스
│   ├── tasks/                    # 대기/진행중 작업 파일
│   │   └── {id}.json
│   ├── completed/                # 완료된 작업 파일
│   │   └── {id}.json
│   ├── failed/                   # 실패한 작업 파일
│   │   └── {id}.json
│   └── logs/                     # 날짜별 로그
│       └── YYYY-MM-DD.log
│
├── package.json                  # npm 패키지 설정
└── jest.config.js                # Jest 설정
```

## 소스 파일 설명

### 진입점
| 파일 | 역할 |
|------|------|
| `src/cli.js` | npx cc-telegram 진입점, shebang 포함 |
| `src/index.js` | 라이브러리 export (startBot, createTask 등) |

### 핵심 모듈
| 파일 | 역할 | 주요 export |
|------|------|-------------|
| `src/config.js` | 설정 로드/저장 | loadConfig, saveConfig, configExists |
| `src/init.js` | 최초 초기화 | initialize |
| `src/tasks.js` | 작업 CRUD | createTask, getNextTask, completeTask, failTask, PRIORITY |
| `src/executor.js` | Claude 실행 | startExecutor, stopExecutor |
| `src/telegram.js` | 봇 인터페이스 | startBot, stopBot, sendMessage |
| `src/i18n.js` | 다국어 지원 | t, loadTranslations, detectSystemLanguage |

### 유틸리티
| 파일 | 역할 |
|------|------|
| `src/utils/encryption.js` | AES-256-GCM 암호화 |
| `src/utils/logger.js` | 로그 출력 및 파일 저장 |
| `src/utils/atomicFile.js` | 원자적 파일 쓰기 |
| `src/utils/logRotation.js` | 로그/작업 파일 정리 |

## 데이터 파일 구조

### config.json
```json
{
  "botToken": "iv:authTag:encrypted",
  "chatId": "iv:authTag:encrypted",
  "debugMode": false,
  "claudeCommand": null,
  "logRetentionDays": 7,
  "defaultMaxRetries": 15,
  "parallelExecution": false,
  "maxParallel": 3
}
```

### tasks.json
```json
{
  "lastUpdated": "2026-01-10T07:14:51.135Z",
  "tasks": [
    {
      "id": "20260110-071451-135",
      "file": "tasks/20260110-071451-135.json",
      "status": "ready",
      "priority": 2,
      "createdAt": "2026-01-10T07:14:51.135Z"
    }
  ]
}
```

### completed.json / failed.json
```json
{
  "tasks": [
    {
      "id": "20260110-071451-135",
      "file": "completed/20260110-071451-135.json"
    }
  ]
}
```

## 의존성 관계

```
cli.js
  ├─> config.js
  ├─> init.js ────────> config.js
  ├─> tasks.js ───────> config.js, atomicFile.js, logger.js
  ├─> telegram.js ────> config.js, tasks.js, logger.js
  ├─> executor.js ────> config.js, tasks.js, telegram.js, logger.js
  └─> logRotation.js
```

## 실행 흐름

```
npx cc-telegram
     │
     ▼
  cli.js
     │
     ├─ 설정 없음 ─────> init.js (초기화)
     │
     └─ 설정 있음
         │
         ├─ 로거 초기화
         ├─ orphan 작업 정리
         ├─ 로그 로테이션
         │
         ├─> telegram.js (봇 시작, 폴링)
         │       │
         │       └─> tasks.js (작업 생성/조회)
         │
         └─> executor.js (실행기 시작)
                 │
                 └─> 5초마다 작업 확인
                       │
                       └─> Claude 실행 → 결과 분석 → 완료/재시도/실패
```
