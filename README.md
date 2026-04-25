# lca-desktop

CarbonMate 데스크탑 앱 + 라이선스/업데이트 서버 모노레포.

## 구조

```
lca-desktop/
├── apps/
│   ├── desktop/          # Tauri 앱 (Vite + React)
│   └── license-server/   # Next.js (Vercel 배포)
└── packages/
    └── shared/           # 공유 TypeScript 타입
```

## 시작하기

처음 셋업은 [SETUP.md](./SETUP.md)를 따라가세요.

설치 후 일상 명령:

```bash
pnpm dev:desktop      # 데스크탑 앱 개발 모드
pnpm dev:server       # 라이선스 서버 로컬 실행
pnpm build:desktop    # 데스크탑 앱 릴리스 빌드
pnpm build:server     # 라이선스 서버 빌드
```

## 인프라 (전부 무료 티어)

| 용도 | 서비스 |
|:---|:---|
| 라이선스 서버 호스팅 | Vercel Hobby |
| 라이선스 DB | Neon Postgres (Vercel 마켓플레이스) |
| 데스크탑 설치파일 배포 | GitHub Releases |
| LCI/계수 데이터 | Vercel `/public` |
| CI 빌드 | GitHub Actions |
| 라이선스 키 이메일 | Resend Free |

## 라이선스

Proprietary. © CarbonMate.
