# Phase 0 셋업 가이드

이 문서는 **딱 한 번** 따라하면 됩니다. 끝나면 데스크탑 앱이 로컬에서 부팅되고, 라이선스 서버가 Vercel에 배포된 상태가 됩니다.

소요 시간: 1~2시간 (Rust 설치 시간 포함).

---

## 사전 요구사항

- [ ] **Node.js 20+** ([nodejs.org](https://nodejs.org))
- [ ] **pnpm 9+** — 설치: `npm install -g pnpm`
- [ ] **Rust toolchain** — 설치: [rustup.rs](https://rustup.rs) (Tauri 빌드용, ~10분)
- [ ] **Git**
- [ ] **GitHub 계정** (Releases, Actions용)
- [ ] **Vercel 계정** (라이선스 서버 호스팅용, 무료)

Windows 추가 사전요구:
- [ ] **Microsoft C++ Build Tools** ([다운로드](https://visualstudio.microsoft.com/visual-cpp-build-tools/)) — Tauri 빌드에 필요

---

## 1단계: 의존성 설치

```bash
cd "d:/OneDrive/Business/ai automation/LCA GPTs/lca-desktop"
pnpm install
```

---

## 2단계: 라이선스 서버 로컬 실행 확인

```bash
pnpm dev:server
```

http://localhost:3000 접속 → 안내 페이지가 보이면 성공.

다음 엔드포인트도 확인:
- http://localhost:3000/api/updates/manifest
- http://localhost:3000/api/data/manifest

`Ctrl+C`로 종료.

---

## 3단계: 데스크탑 앱 초기화 (Tauri 공식 스캐폴더)

`apps/desktop` 폴더는 현재 placeholder입니다. 공식 도구로 교체합니다:

```bash
# placeholder 삭제
rm -rf apps/desktop

# Tauri 공식 스캐폴더로 생성
cd apps
pnpm dlx create-tauri-app desktop --template react-ts --manager pnpm
cd ..
```

생성 시 프롬프트가 뜨면:
- **App name**: `CarbonMate`
- **Window title**: `CarbonMate`
- **identifier**: `com.carbonmate.desktop`

생성 후 `apps/desktop/package.json`을 열어서:
- `"name"`을 `"@lca/desktop"`으로 변경
- `dependencies`에 추가: `"@lca/shared": "workspace:*"`

그리고 다시 설치:

```bash
pnpm install
```

부팅 확인:

```bash
pnpm dev:desktop
```

처음엔 Rust 의존성 컴파일로 5~15분 걸립니다. 창이 뜨면 성공.

---

## 4단계: Tauri 업데이트 서명 키 생성 (무료, 필수)

```bash
cd apps/desktop
pnpm tauri signer generate -w ~/.tauri/carbonmate-signing.key
```

생성된 **public key**(`~/.tauri/carbonmate-signing.key.pub` 내용)를 메모해두세요. 5단계에서 사용.

⚠️ **private key (`carbonmate-signing.key`) 는 절대 git에 올리지 마세요.** GitHub Actions Secrets에 `TAURI_SIGNING_PRIVATE_KEY`로 저장.

---

## 5단계: Tauri 설정에 updater 추가

`apps/desktop/src-tauri/tauri.conf.json`에 다음을 추가:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://YOUR-LICENSE-SERVER.vercel.app/api/updates/manifest"
      ],
      "pubkey": "여기에-4단계의-public-key-붙여넣기"
    }
  }
}
```

`YOUR-LICENSE-SERVER`는 6단계 후 확정됩니다. 일단 placeholder로 두세요.

---

## 6단계: GitHub 리포 생성 + 푸시

```bash
cd "d:/OneDrive/Business/ai automation/LCA GPTs/lca-desktop"
git init
git add .
git commit -m "chore: initial Phase 0 scaffold"
```

GitHub에서 새 private 리포(`carbonmate-desktop`) 만들고:

```bash
git remote add origin https://github.com/YOUR-USER/carbonmate-desktop.git
git push -u origin main
```

---

## 7단계: Vercel에 라이선스 서버 배포

1. [vercel.com/new](https://vercel.com/new) 접속
2. GitHub 리포 import
3. **Root Directory**: `apps/license-server` 로 설정 (중요!)
4. **Build Command**: `cd ../.. && pnpm install && pnpm build:server`
5. **Output Directory**: 자동 (`apps/license-server/.next`)
6. 환경변수는 일단 비워두고 Deploy

배포 URL 확인 (예: `https://carbonmate-license.vercel.app`).

이 URL을 5단계의 `tauri.conf.json` `endpoints`에 반영하고, `apps/license-server/.env.example`을 참고해 `DATA_BASE_URL`도 설정.

---

## 8단계: Neon Postgres 연결 (Phase 2 전 준비)

Vercel 프로젝트 대시보드 → **Storage** 탭 → **Create Database** → **Neon (Serverless Postgres)** 선택 → 무료 플랜 → 연결.

`DATABASE_URL` 환경변수가 자동 주입됩니다.

---

## 완료 체크리스트

- [ ] `pnpm install` 성공
- [ ] `pnpm dev:server`로 라이선스 서버 로컬 부팅 확인
- [ ] `pnpm dev:desktop`로 데스크탑 빈 창 부팅 확인
- [ ] Tauri 서명 public key 메모
- [ ] GitHub 리포 푸시 완료
- [ ] Vercel 배포 URL 받음
- [ ] Neon Postgres 연결 완료

여기까지 오면 **Phase 0 완료**. 다음은 Phase 1 (계산 엔진 포팅)입니다.

---

## 막히면

- **Rust 컴파일 에러**: Windows면 Visual Studio Build Tools 설치 확인. macOS면 `xcode-select --install`.
- **Tauri 창이 안 뜸**: WebView2 런타임 설치 확인 (Windows). `winget install Microsoft.EdgeWebView2Runtime`.
- **Vercel 빌드 실패**: Root Directory 설정 확인. monorepo는 반드시 `apps/license-server`로 지정.
- **`@lca/shared` not found**: `pnpm install`을 루트에서 실행했는지 확인.
