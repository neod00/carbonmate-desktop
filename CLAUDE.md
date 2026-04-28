# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CarbonMate** — ISO 14067 CFP(탄소발자국) 계산을 위한 Tauri 데스크톱 앱 + 라이선스/업데이트 백엔드 모노레포. 완전 무료 인프라(Vercel, Neon, GitHub Releases) 위에서 동작하는 독립 제품.

## Commands

```bash
# 개발
pnpm dev:desktop       # Tauri 앱 개발 모드
pnpm dev:server        # 라이선스 서버 로컬 실행 (Next.js, port 3000)

# 빌드
pnpm build:desktop     # 데스크톱 릴리즈 빌드
pnpm build:server      # 라이선스 서버 빌드

# 타입 체크
pnpm typecheck         # 전체 워크스페이스 TypeScript 검사

# 데스크톱 앱 단독 (apps/desktop/)
pnpm dev               # Vite dev server (port 1420)
pnpm tauri <cmd>       # Tauri CLI 직접 실행

# 릴리즈
pnpm release:patch     # 패치 버전 bump
pnpm release:minor     # 마이너 버전 bump

# 데이터
pnpm import:lci        # LCI 데이터를 Neon DB로 임포트
```

## Architecture

### 모노레포 구조

```
apps/
  desktop/         # Tauri 2 + React 19 데스크톱 앱
  license-server/  # Next.js 15 라이선스 및 업데이트 API (Vercel 배포)
packages/
  shared/          # 공유 TypeScript 타입 (@lca/shared)
scripts/           # 릴리즈, DB 초기화, 데이터 임포트 유틸
```

### 데스크톱 앱 흐름 (`apps/desktop/`)

앱 진입 시 **LicenseGate → UpdateGate → CalculatorWizard** 순으로 레이어가 쌓인다.

- `src/App.tsx` — 위 게이트 래퍼 조합
- `src/lib/core/` — 순수 비즈니스 로직 (배분 엔진, DQR, CFP 추적, BOM 파서, ISO 14067 컴플라이언스)
- `src/components/` — UI 컴포넌트 (Calculator 위저드, 라이선스, 업데이트, 내보내기 등)
- `src/store/` — Zustand 스토어 (localStorage 영속화)
- `src-tauri/` — Rust 백엔드 (파일 I/O, 시스템 통합)

상태는 Zustand로만 관리하며, 프로젝트 파일은 Tauri 파일시스템 API를 통해 `.json`으로 저장된다. 보고서는 `xlsx`/`docx` 라이브러리로 직접 생성한다.

### 라이선스 서버 (`apps/license-server/`)

Next.js 15 App Router 기반. 주요 API 경로:

| 경로 | 역할 |
|------|------|
| `/api/license/verify` | 라이선스 키 검증 및 다중 기기 활성화 |
| `/api/updates/manifest` | Tauri 자동 업데이트 매니페스트 |
| `/api/data/manifest` | LCI 데이터 매니페스트 |
| `/api/catalog/*` | Gemini AI 기반 LCI 검색/분석/추천 |
| `/api/announcements` | 클라이언트 공지 |
| `/api/admin/*` | 어드민 (라이선스, 공지, 업데이트 관리) |

데이터베이스: Neon Postgres (`@neondatabase/serverless`). 이메일: Resend + Nodemailer 폴백.

### 공유 패키지 (`packages/shared/`)

런타임 의존성 없는 순수 TypeScript 타입만 포함. `@lca/shared`로 임포트.
- `license.ts` — 라이선스 키 스키마
- `update.ts` — 자동 업데이트 매니페스트 타입
- `project-file.ts` — 프로젝트 파일 포맷 타입

## Key Tech Stack

| 레이어 | 기술 |
|--------|------|
| Desktop UI | React 19, Tailwind CSS 4, Framer Motion 12 |
| Desktop 상태 | Zustand 5 (localStorage 영속화) |
| Desktop 런타임 | Tauri 2 (Rust) |
| Backend API | Next.js 15 App Router |
| DB | Neon PostgreSQL (serverless) |
| AI | Google Gemini API |
| 패키지 매니저 | pnpm 9 (워크스페이스) |
| 내보내기 | xlsx, docx, file-saver |
| CI/CD | GitHub Actions → GitHub Releases (MSI, NSIS) |

## CI/CD

`.github/workflows/build.yml` — `v*` 태그 푸시 시 Windows 인스톨러(MSI + NSIS .exe) 빌드 후 GitHub Releases에 업로드. Tauri 서명 키는 GitHub Secrets에 보관.

## 자동 테스트

`apps/desktop/`에 Vitest + jsdom + @testing-library 셋업. **모든 코드 수정 후 실행 권장**.

```bash
cd apps/desktop
pnpm test          # 1회 실행 (~0.5초)
pnpm test:watch    # 파일 변경 감지
```

테스트 파일 5개, 64개 케이스. P0/P1 회귀 자동 방어 — 위치는 `src/**/*.test.{ts,tsx}`.

## 카보니(Carbony) 검증 프로세스

상위 폴더 `../../carbony/`는 ISO 14067 컨설턴트 페르소나 AI 기반 검증 자산입니다. lca-desktop 앱의 P0/P1 결함을 사전 발견·회귀 검증하는 데 사용.

- `carbony/persona.md` — 12년차 ISO 14067 컨설턴트 페르소나 정의
- `carbony/scenarios/` — 시나리오 (현재: 토리컴 황산니켈)
- `carbony/runs/` — 실행 결과 누적 (run01~run05 완료, 1,065 kgCO₂e/ton 안정)
- `carbony/runs/2026-04-27_run05/handoff-package/` — 진짜 컨설턴트 인계 자료

### Phase 진행 상태 (2026-04-28 기준)

- ✅ Phase 1 (P0 4건) — 완료
- ✅ Phase 2 (P1 17건) — 완료
- ✅ Phase 2.5 (전력·포장재 EF override) — 완료
- 🟢 인계 준비 완료 — 미수정 결함 0건

### 관련 Skills (`~/.claude/skills/`)

| Skill | 트리거 | 상태 |
|-------|--------|------|
| `carbony-regression-run` | "카보니 회귀", "run0X", "회귀 검증" | ✅ 구축 완료 |
| `cfp-handoff-package` | "인계 자료", "프로젝트 종료" | ⏳ 다음 |
| `carbony-persona-bootstrap` | "신규 산업 카보니" | ⏳ 다음 |
| `iso14067-compliance-check` | "ISO 14067 점검" | ⏳ 마지막 (검증심사원 토대) |
