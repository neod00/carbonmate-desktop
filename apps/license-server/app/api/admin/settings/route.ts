/**
 * GET  /api/admin/settings — 현재 AI 설정 조회 (API 키 마스킹)
 * POST /api/admin/settings — AI 설정 업데이트 (변경할 필드만)
 *
 * 인증: x-admin-password 헤더 (ADMIN_PASSWORD env 비교)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  ALLOWED_NARRATIVE_MODELS,
  type AdminAISettingsMaskedResponse,
  type AdminAISettingsUpdateRequest,
  type AllowedNarrativeModel,
} from '@lca/shared';
import { deleteSetting, loadAISettings, maskApiKey, upsertSetting } from '../../narrative/_lib/settings-store';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function checkAuth(req: NextRequest, bodyPassword?: string): boolean {
  const headerPwd = req.headers.get('x-admin-password');
  return headerPwd === ADMIN_PASSWORD || bodyPassword === ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await loadAISettings();
    const response: AdminAISettingsMaskedResponse = {
      openaiApiKeyMasked: maskApiKey(settings.openaiApiKey),
      openaiApiKeyConfigured: !!settings.openaiApiKey,
      narrativeModel: settings.narrativeModel,
      webSearchDefault: settings.webSearchDefault,
      narrativeEnabled: settings.narrativeEnabled,
    };
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '설정 조회 실패' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: AdminAISettingsUpdateRequest;
  try {
    body = (await req.json()) as AdminAISettingsUpdateRequest;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 });
  }

  // password는 헤더 또는 body에서 받음
  if (!checkAuth(req, body.password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // openaiApiKey: undefined면 변경 안 함, 빈 문자열이면 삭제, 값 있으면 sk- 검증 후 upsert
    if (body.openaiApiKey !== undefined) {
      const trimmed = body.openaiApiKey.trim();
      if (trimmed === '') {
        await deleteSetting('openai_api_key');
      } else {
        if (!trimmed.startsWith('sk-')) {
          return NextResponse.json(
            { error: 'OpenAI API 키는 sk-로 시작해야 합니다.' },
            { status: 400 }
          );
        }
        await upsertSetting('openai_api_key', trimmed);
      }
    }

    if (body.narrativeModel !== undefined) {
      if (!(ALLOWED_NARRATIVE_MODELS as readonly string[]).includes(body.narrativeModel)) {
        return NextResponse.json(
          { error: `허용되지 않은 모델: ${body.narrativeModel}` },
          { status: 400 }
        );
      }
      await upsertSetting('narrative_model', body.narrativeModel as AllowedNarrativeModel);
    }

    if (body.webSearchDefault !== undefined) {
      if (!['auto', 'always', 'never'].includes(body.webSearchDefault)) {
        return NextResponse.json(
          { error: 'webSearchDefault는 auto/always/never 중 하나여야 합니다.' },
          { status: 400 }
        );
      }
      await upsertSetting('web_search_default', body.webSearchDefault);
    }

    if (body.narrativeEnabled !== undefined) {
      await upsertSetting('narrative_enabled', body.narrativeEnabled ? 'true' : 'false');
    }

    // 업데이트 후 최신 상태 반환
    const settings = await loadAISettings();
    const response: AdminAISettingsMaskedResponse = {
      openaiApiKeyMasked: maskApiKey(settings.openaiApiKey),
      openaiApiKeyConfigured: !!settings.openaiApiKey,
      narrativeModel: settings.narrativeModel,
      webSearchDefault: settings.webSearchDefault,
      narrativeEnabled: settings.narrativeEnabled,
    };
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '설정 저장 실패' },
      { status: 500 }
    );
  }
}
