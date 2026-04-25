# @lca/license-server

CarbonMate 데스크탑용 라이선스 검증 + 업데이트 매니페스트 + AI 프록시 서버.

## 로컬 실행

```bash
cp .env.example .env.local
# .env.local 편집해서 값 채우기
pnpm dev
```

http://localhost:3000

## 엔드포인트

| 메서드 | 경로 | 용도 | 단계 |
|:---|:---|:---|:---|
| POST | `/api/license/verify` | 라이선스 검증 | Phase 2 |
| GET | `/api/updates/manifest` | Tauri 앱 업데이트 매니페스트 | Phase 2 |
| GET | `/api/data/manifest` | LCI/계수 데이터 매니페스트 | Phase 1 |
| POST | `/api/ai/*` | Gemini 프록시 (recommend, justify, ...) | Phase 1 |

## 배포

Vercel 새 프로젝트로 배포. Neon Postgres는 Vercel 마켓플레이스에서 연결 → `DATABASE_URL` 자동 주입.

자세한 셋업은 루트의 [SETUP.md](../../SETUP.md) 참조.
