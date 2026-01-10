# claude-executor Skill

Claude Code 실행 및 반복 처리를 담당하는 스킬

## 적용 시점
- 작업 실행 로직 구현 시
- 결과 분석 로직 수정 시

## 구현 내용
- spawn으로 Claude 프로세스 실행
- 완료 신호 기반 결과 판단
- 재시도 로직 (Ralph Wiggum 방식)
- 30분 타임아웃
