# cc-telegram

🌍 **Language / 언어 / 语言**:
[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md) | [Español](README.es.md) | [हिन्दी](README.hi.md) | [العربية](README.ar.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

---

텔레그램 봇을 통한 원격 Claude Code 실행

텔레그램 앱을 사용하여 어디서든 Claude Code를 제어하세요. 작업을 생성하고, 진행 상황을 모니터링하고, 완료 알림을 받으세요 - 모두 휴대폰에서 가능합니다.

## 기능

- **원격 작업 실행**: 텔레그램을 통해 Claude Code에 코딩 작업 전송
- **병렬 실행**: 여러 작업을 동시에 실행 (설정 가능)
- **우선순위 시스템**: 긴급, 높음, 보통, 낮음 우선순위 레벨
- **자동 재시도**: 실패 시 자동 재시도 (횟수 설정 가능)
- **실시간 상태**: 작업 진행 상황 및 Claude 출력 모니터링
- **로그 로테이션**: 오래된 로그 및 완료된 작업 자동 정리

## 요구 사항

- Node.js 18.0.0 이상
- [Claude Code CLI](https://claude.ai/claude-code) 설치 및 인증 완료
- 텔레그램 계정

## 설치

```bash
npx cc-telegram
```

또는 전역 설치:

```bash
npm install -g cc-telegram
cc-telegram
```

## 초기 설정

처음 실행 시 cc-telegram이 설정 과정을 안내합니다:

1. **텔레그램 봇 생성**
   - 텔레그램에서 [@BotFather](https://t.me/BotFather) 검색
   - `/newbot` 전송 후 안내에 따라 진행
   - 제공된 봇 토큰 복사

2. **봇 토큰 입력**
   - 프롬프트에서 봇 토큰 붙여넣기
   - 토큰 유효성 자동 검증

3. **계정 연결**
   - 텔레그램에서 새 봇 열기
   - 봇에게 `/start` 전송
   - CLI가 메시지를 감지하고 chat ID 표시
   - chat ID 입력하여 확인

4. **설정 구성**
   - 기본 재시도 횟수 설정 (권장: 15)
   - 병렬 실행 활성화/비활성화
   - 최대 동시 작업 수 설정 (병렬 활성화 시)

설정은 `.cc-telegram/config.json`에 암호화되어 저장됩니다.

## 사용법

설정 후 다음 명령으로 실행:

```bash
npx cc-telegram
```

봇이 시작되고 텔레그램 계정의 명령을 수신합니다.

## 텔레그램 명령어

| 명령어 | 설명 |
|--------|------|
| `/new` | 새 작업 생성 |
| `/list` | 대기 중 및 진행 중인 작업 보기 |
| `/completed` | 완료된 작업 보기 |
| `/failed` | 실패한 작업 보기 |
| `/status` | 현재 실행 상태 확인 |
| `/debug` | 시스템 정보 보기 |
| `/cancel` | 작업 생성 흐름 취소 |
| `/reset` | 모든 데이터 초기화 (확인 필요) |

## 작업 생성

### 단순 작업
완료 조건 없이 1회 실행:

1. `/new` 전송
2. "단순(완료 조건, 반복 없음)" 선택
3. 요구사항 입력
4. 작업이 즉시 대기열에 추가됨

### 복잡 작업
완료 조건과 자동 재시도가 있는 작업:

1. `/new` 전송
2. "복잡(완료 조건, 반복 있음)" 선택
3. 요구사항 입력
4. 완료 조건 입력 (예: "모든 테스트 통과")
5. 우선순위 선택
6. 재시도 횟수 선택 (10회 또는 직접 입력)

## 작업 우선순위

작업은 우선순위 순서로 실행됩니다:

| 우선순위 | 아이콘 | 설명 |
|----------|--------|------|
| 긴급 | 🔴 | 가장 먼저 실행 |
| 높음 | 🟠 | 높은 우선순위 |
| 보통 | 🟢 | 기본 우선순위 |
| 낮음 | 🔵 | 유휴 시 실행 |

## 병렬 실행

설정 시 활성화하면 여러 작업을 동시에 실행할 수 있습니다:

- 최대 동시 작업 수 설정 (1-10)
- 각 작업은 콘솔 출력에 ID 접두사 표시
- `/status`로 모든 실행 중인 작업 확인
- 높은 우선순위 작업이 우선 슬롯 획득

### 콘솔 출력 (병렬 모드)

```
[a1b2c3d4] 작업 시작...
[e5f6g7h8] 프로젝트 컴파일 중...
[a1b2c3d4] 테스트 통과!
```

## 설정

설정은 `.cc-telegram/config.json`에 저장됩니다:

| 설정 | 설명 | 기본값 |
|------|------|--------|
| `botToken` | 텔레그램 봇 토큰 (암호화) | - |
| `chatId` | 텔레그램 chat ID (암호화) | - |
| `debugMode` | 디버그 로깅 활성화 | `false` |
| `claudeCommand` | 사용자 정의 Claude CLI 명령 | `null` (자동 감지) |
| `logRetentionDays` | 로그 파일 보관 일수 | `7` |
| `defaultMaxRetries` | 기본 재시도 횟수 | `15` |
| `parallelExecution` | 병렬 실행 활성화 | `false` |
| `maxParallel` | 최대 동시 작업 수 | `3` |

### 사용자 정의 Claude 명령

Claude CLI가 비표준 위치에 설치된 경우:

```json
{
  "claudeCommand": "npx @anthropic-ai/claude-code"
}
```

## 디렉토리 구조

```
.cc-telegram/
├── config.json      # 암호화된 설정
├── tasks.json       # 대기 작업 인덱스
├── completed.json   # 완료 작업 인덱스
├── failed.json      # 실패 작업 인덱스
├── tasks/           # 개별 작업 파일
├── completed/       # 완료 작업 상세
├── failed/          # 실패 작업 상세
└── logs/            # 일별 로그 파일
```

## 완료 감지

Claude Code는 특수 마커를 사용하여 작업 완료를 신호합니다:

- `<promise>COMPLETE</promise>` - 작업 성공적으로 완료
- `<promise>FAILED</promise>` - 작업 실패 (이유 포함)

신호가 감지되지 않으면 시스템이 출력 내용을 기반으로 패턴 매칭을 통해 성공/실패를 판단합니다.

## 로그 관리

- 로그 파일은 매일 생성됨: `YYYY-MM-DD.log`
- `logRetentionDays` 이후 오래된 로그 자동 삭제
- 완료/실패 작업 파일은 30일 후 정리됨

## 보안

- 봇 토큰과 chat ID는 AES-256-GCM으로 암호화
- 등록된 chat ID의 메시지만 처리
- 모든 데이터는 프로젝트 디렉토리에 로컬 저장

## 문제 해결

### 봇이 응답하지 않음
- 봇이 실행 중인지 확인 (`npx cc-telegram`)
- chat ID가 설정된 것과 일치하는지 확인
- 인터넷 연결 확인

### Claude Code를 찾을 수 없음
- Claude CLI 설치 확인: `npm install -g @anthropic-ai/claude-code`
- 또는 설정에서 사용자 정의 명령 설정: `"claudeCommand": "npx @anthropic-ai/claude-code"`

### 작업이 진행 중 상태에서 멈춤
- 재시작 시 고아 작업은 자동으로 "ready" 상태로 리셋됨
- 필요한 경우 `/reset`으로 모든 데이터 초기화

## 라이선스

MIT
