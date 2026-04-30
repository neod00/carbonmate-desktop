/**
 * app_settings 테이블 helper — narrative 라우트 + admin settings 라우트 공유.
 *
 * 저장되는 키:
 *   openai_api_key      string  (sk-로 시작)
 *   narrative_model     string  (AllowedNarrativeModel)
 *   web_search_default  'auto' | 'always' | 'never'
 *   narrative_enabled   'true' | 'false'
 */
import { neon } from '@neondatabase/serverless';
import {
  ALLOWED_NARRATIVE_MODELS,
  DEFAULT_NARRATIVE_MODEL,
  type AdminAISettings,
  type AllowedNarrativeModel,
} from '@lca/shared';

type WebSearchDefault = 'auto' | 'always' | 'never';

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  }
  return neon(process.env.DATABASE_URL);
}

/** 모든 AI 설정을 DB에서 조회. row가 없으면 default 반환. */
export async function loadAISettings(): Promise<AdminAISettings> {
  const sql = getSql();
  const rows = (await sql`
    SELECT key, value FROM app_settings
    WHERE key IN ('openai_api_key', 'narrative_model', 'web_search_default', 'narrative_enabled')
  `) as Array<{ key: string; value: string }>;

  const map = new Map<string, string>(rows.map((r) => [r.key, r.value]));

  const model = map.get('narrative_model');
  const validModel: AllowedNarrativeModel =
    model && (ALLOWED_NARRATIVE_MODELS as readonly string[]).includes(model)
      ? (model as AllowedNarrativeModel)
      : DEFAULT_NARRATIVE_MODEL;

  const ws = map.get('web_search_default');
  const validWS: WebSearchDefault =
    ws === 'always' || ws === 'never' ? ws : 'auto';

  return {
    openaiApiKey: map.get('openai_api_key') ?? '',
    narrativeModel: validModel,
    webSearchDefault: validWS,
    narrativeEnabled: map.get('narrative_enabled') === 'true',
  };
}

/** 단일 키 upsert */
export async function upsertSetting(key: string, value: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
  `;
}

/** 단일 키 삭제 */
export async function deleteSetting(key: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM app_settings WHERE key = ${key}`;
}

/** API 키 마스킹 (UI 표시용) */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length < 12) return '***';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}
