# encryption Skill

봇 토큰 암호화를 담당하는 스킬

## 적용 시점
- 설정 저장/로드 시
- 보안 관련 기능 구현 시

## 구현 내용
- AES-256-GCM 알고리즘
- 환경 기반 키 생성 (hostname, username 등)
- iv:authTag:encrypted 형식 저장
