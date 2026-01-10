# npm-package-init Skill

npx로 실행 가능한 패키지 구조를 초기화하는 스킬

## 적용 시점
- 새 npm 패키지 생성 시
- CLI 도구 구조 설정 시

## 구현 내용
- package.json 설정 (bin, main, files)
- shebang 추가 (#!/usr/bin/env node)
- engines 설정 (node >= 18)
