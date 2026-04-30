-- ============================================================
-- 001_app_settings.sql
-- 관리자 설정 키-값 저장 테이블 (OpenAI API 키, 모델, web search 등)
--
-- 실행 방법: Neon dashboard SQL Editor에서 직접 실행
-- 또는 psql:  psql "$DATABASE_URL" -f migrations/001_app_settings.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 기본값 시드 (없을 때만 — narrative 비활성 상태로 시작)
INSERT INTO app_settings (key, value) VALUES
  ('narrative_model', 'gpt-5.4-mini'),
  ('web_search_default', 'auto'),
  ('narrative_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 참고: openai_api_key는 관리자가 admin 페이지에서 직접 입력하기 전엔 row가 생성되지 않음.
-- 키가 비어있으면 narrative 라우트가 503 (no-server-key) 반환.
