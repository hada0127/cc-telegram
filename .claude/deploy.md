# cc-telegram 배포 가이드

## npm 배포 방법

### 1. npm 계정 준비
```bash
# npm 로그인 (최초 1회)
npm login
```

### 2. 배포 전 체크리스트
- [ ] package.json의 version 확인/업데이트
- [ ] README.md 최신화
- [ ] 테스트 통과 확인 (`npm test`)
- [ ] .npmignore 또는 files 필드로 배포 파일 지정

### 3. 버전 업데이트
```bash
# 패치 버전 (0.1.0 → 0.1.1): 버그 수정
npm version patch

# 마이너 버전 (0.1.0 → 0.2.0): 새 기능 추가
npm version minor

# 메이저 버전 (0.1.0 → 1.0.0): 호환성 깨지는 변경
npm version major
```

### 4. npm에 배포
```bash
# 배포
npm publish

# 스코프 패키지인 경우 (@username/cc-telegram)
npm publish --access public
```

---

## npx 실행 시 버전 관리

### 기본 동작: `npx cc-telegram`
| 상황 | 동작 |
|------|------|
| 처음 실행 | 최신 버전 다운로드 후 실행 |
| 이전에 실행한 적 있음 | **캐시된 버전 사용** (최신 아닐 수 있음) |

### 항상 최신 버전 실행하기
```bash
# 방법 1: @latest 명시
npx cc-telegram@latest

# 방법 2: 캐시 무시
npx --yes cc-telegram@latest

# 방법 3: 캐시 완전 삭제 후 실행
npm cache clean --force
npx cc-telegram
```

### 특정 버전 실행
```bash
npx cc-telegram@0.1.0
npx cc-telegram@1.2.3
```

---

## 사용자 관점 정리

### Q: 최신 버전이 자동으로 실행되나요?
**A: 아니요, 자동은 아닙니다.**

npx는 한 번 다운로드한 패키지를 캐시에 저장합니다. 이후 실행 시 캐시된 버전을 사용하므로, 새 버전이 배포되어도 자동 업데이트되지 않습니다.

### Q: 사용자가 업데이트하려면?
```bash
# 최신 버전 강제 실행
npx cc-telegram@latest

# 또는 전역 설치 후 업데이트
npm install -g cc-telegram        # 설치
npm update -g cc-telegram         # 업데이트
cc-telegram                       # 실행
```

### Q: 권장 사용 방법은?
```bash
# 항상 최신 버전이 필요하면
npx cc-telegram@latest

# 안정적인 버전 고정이 필요하면
npx cc-telegram@1.0.0
```

---

## 배포 자동화 (GitHub Actions)

`.github/workflows/publish.yml` 예시:
```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitHub에서 배포하기
1. GitHub에서 Release 생성
2. 태그 이름: `v0.1.0` 형식
3. Actions가 자동으로 npm에 배포

---

## 버전 관리 전략

### Semantic Versioning (SemVer)
```
MAJOR.MINOR.PATCH (예: 1.2.3)
```

| 변경 유형 | 버전 | 예시 |
|-----------|------|------|
| 버그 수정 | PATCH | 0.1.0 → 0.1.1 |
| 새 기능 (하위 호환) | MINOR | 0.1.0 → 0.2.0 |
| 호환성 깨짐 | MAJOR | 0.1.0 → 1.0.0 |

### 배포 체크리스트
```bash
# 1. 테스트 확인
npm test

# 2. 버전 업데이트 (자동으로 git tag 생성)
npm version patch -m "v%s: 버그 수정"

# 3. 배포
npm publish

# 4. 태그 푸시
git push origin main --tags
```

---

## 문제 해결

### "패키지 이름이 이미 사용 중입니다"
- npm에서 다른 사람이 이미 사용 중인 이름
- 해결: 스코프 패키지로 변경 (`@username/cc-telegram`)

### "권한이 없습니다"
```bash
npm login  # 다시 로그인
npm whoami # 로그인 확인
```

### 배포 취소 (72시간 이내만 가능)
```bash
npm unpublish cc-telegram@0.1.0
```

---

## 요약

| 목적 | 명령어 |
|------|--------|
| npm 배포 | `npm publish` |
| 버전 올리기 | `npm version patch/minor/major` |
| 최신 버전 실행 | `npx cc-telegram@latest` |
| 특정 버전 실행 | `npx cc-telegram@1.0.0` |
| 전역 설치 | `npm install -g cc-telegram` |
| 전역 업데이트 | `npm update -g cc-telegram` |
