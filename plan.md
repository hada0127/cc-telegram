# 프로젝트 구현 계획

## 개요
- 텔레그램을 통해 클로드 코드를 제어하는 원격 클로드코드 실행 프로그램

## 동작 개요
### 기본 실행 및 파일 관련
- npx 명령어로 실행할 수 있었으면 함. (npx kill-port처럼 별도 명령어 없이)
- .cc-telegram 폴더에 설정 파일이나 진행사항등 관련 파일을 모두 넣었으면함.
- 스스로의 실행을 위해 사용자의 package.json에 어떠한 모듈도 설치하지 말아야함.
- 별도 빌드가 필요없게 javascript로 작업. 타입 필요시 jsdoc 생성

### 실행 시 .cc-telegram/config.json이 없을때 (첫실행이나 사용자가 해당폴더나 config.json을 삭제하여 강제 초기화 이후) 관련
#### 1. 환경 초기화
- .cc-telegram 폴더 생성
- .cc-telegram 경로에 tasks.json, completed.json, failed.json, tasks 폴더, completed 폴더, failed 폴더 생성
- 폴더내에 .gitignore 파일이 있으면 .cc-telegram 폴더는 gitignore에 추가되었으면 함.

#### 2. 사용자 정보 입력
- bot token 입력 받음
- 사용자에게 텔레그램에서 봇에 /start 메세지를 보내고 출력된 chatId를 입력하게함

#### 3. 사용자 정보 저장
봇토큰, chatId를 적절한 암호화를 통해 저장한다. (사용자 실행환경에서 가져올 수 있는 상수를 통해 다른 곳에서 복호화할 수 없게)

### 텔레그램 관련
- 텔레그램 명령어는 /만 쳐도 자동 완성되고 설명이 떠있어야함.
- 별도 서버 없이 명령어 내에서 텔레그램 수신을 받아야함. 

### 등록된 작업 실행 관련
- 여러개의 작업을 등록하고 실행하는 방식
- 오래된 작업부터 순차 실행
- 각 작업은 ralph wiggum 방식에 따라 요구사항, 완료조건, 반복횟수를 지정해서 같은 작업을 여러번 반복하여 성공 확률을 올린다.
- 작업 중 클로드 코드 오류가 발생하면 반복횟수를 1회 차감하고, 남은 반복횟수만큼 이어서 진행.
- 작업시작, 완료 시 사용자에게 텔레그램 알림.

## 참고자료
- C:\Users\taro1\Downloads\cc-orchestrator
- 위 폴더에서 클로드 코드 실행 부분 참조(가장 정확하게 동작함)
- 위 폴더에서 텔레그램 연동 부분 참조

## 텔레그램 명령어 일람

### /start 
메세지를 보낸 사용자의 chatid를 출력한다.

### /new
- 새로운 작업을 생성한다.
- 작업은 총 3단계의 입력을 받아서 작업 목록에 등록한다. 
- 입력 도중 /cancel로 취소 가능하도록
#### 1단계
요구사항을 입력 받는다.(text)
#### 2단계
완료기준을 입력 받는다.(text)
#### 3단계
반복 횟수를 입력 받는다.
3-1. '10회 실행', '직접 입력' 버튼 출력, 직접 입력일 경우에 횟수 입력
#### 접수 완료 안내 메세지 출력

### /list
미완료 작업 리스트를 버튼 형태로 출력해준다.
- 버튼을 클릭하여 작업 선택 시 '{요구사항} 작업취소' 버튼이 나타나서 선택할 수 있음
- 작업취소시 예정된 작업이나, 진행중인 작업을 취소한다.

### /completed
완료 작업 리스트를 텍스트 형태로 출력해준다. (가능하면 테이블 형태)

### /failed
실패 작업 리스트를 텍스트 형태로 출력해준다. (가능하면 테이블 형태, 사유 포함)

### /status
현재 작업상태를 확인한다. (가장 최근 클로드 코드 출력 결과 5줄 전달)

### /debug
시스템 상태를 확인한다. (작업 큐 상태, 메모리 사용량, 마지막 에러 등)

## .cc-telegram 폴더내 파일
### config.json
암호화된 봇토큰, 암호화된 chatId

### tasks.json
미완료, 진행중 작업 목록 json(파일 링크, 상태(ready, inProgress), 등록시간) 파일.
.cc-telegram/tasks 폴더에 각 작업 파일이 json 형태(요구사항,완료조건,반복횟수)로 별도로 존재.

### completed.json
완료 작업 목록 json 파일
.cc-telegram/completed 폴더에 각 작업 파일이 json 형태(요구사항,완료조건,반복횟수, 등록시간, 시작시간, 완료시간, 완료요약(300자 이내))로 별도로 존재.

### failed.json
실패 작업 목록 json 파일
.cc-telegram/failed 폴더에 각 작업 파일이 json 형태(요구사항,완료조건,반복횟수, 등록시간, 시작시간, 실패시간, 실패요약(300자 이내))로 별도로 존재.

## 상태 관리
- tasks.json에 lastUpdated 타임스탬프 추가하여 마지막 갱신 시점 추적
- inProgress 상태 작업의 타임아웃 처리 (일정 시간 이상 갱신 없으면 실패 처리)
- 프로세스 시작 시 orphan 작업 정리 로직 (비정상 종료로 inProgress 상태로 남은 작업 재시작 또는 실패 처리)

## 로깅 및 디버깅
- .cc-telegram/logs 폴더에 실행 로그 저장
- 디버그 모드 옵션 추가 (config.json에 debugMode 플래그)
- /debug 명령어로 시스템 상태 확인

## 작업 파일 스키마
### tasks/{taskId}.json
```json
{
  "id": "uuid",
  "requirement": "요구사항",
  "completionCriteria": "완료조건",
  "maxRetries": 10,
  "currentRetry": 0,
  "status": "ready | inProgress",
  "createdAt": "ISO8601",
  "startedAt": "ISO8601 | null",
  "workingDirectory": "작업 디렉토리 경로"
}
```

### completed/{taskId}.json
```json
{
  "id": "uuid",
  "requirement": "요구사항",
  "completionCriteria": "완료조건",
  "maxRetries": 10,
  "totalRetries": 3,
  "createdAt": "ISO8601",
  "startedAt": "ISO8601",
  "completedAt": "ISO8601",
  "summary": "완료 요약 (300자 이내)"
}
```

### failed/{taskId}.json
```json
{
  "id": "uuid",
  "requirement": "요구사항",
  "completionCriteria": "완료조건",
  "maxRetries": 10,
  "totalRetries": 10,
  "createdAt": "ISO8601",
  "startedAt": "ISO8601",
  "failedAt": "ISO8601",
  "summary": "실패 요약 (300자 이내)"
}
```

