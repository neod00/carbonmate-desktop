/**
 * POST /api/narrative/generate
 *
 * 데스크톱 앱이 보고서 narrative 1개를 생성할 때 호출하는 proxy.
 *
 * - 라이선스 키 + machineId 검증
 * - OpenAI API key / 모델 / web search 기본값을 DB(`app_settings`)에서 조회
 * - Carbony 페르소나 + 슬롯별 instruction을 Responses API로 전송
 * - JSON 응답 파싱 → NarrativeGenerateResponse 반환
 *
 * AI 설정은 관리자 페이지(/admin → AI 설정 탭)에서 관리. 데스크톱은 키를 모름.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  NARRATIVE_SLOT_META,
  NARRATIVE_SLOTS,
  type NarrativeErrorResponse,
  type NarrativeGenerateRequest,
  type NarrativeGenerateResponse,
  type NarrativeSlot,
} from '@lca/shared';
import { checkLicense } from '../_lib/license-check';
import { CARBONY_NARRATIVE_SYSTEM_PROMPT } from '../_lib/carbony-system-prompt';
import { buildSlotPrompt } from '../_lib/slot-instructions';
import { callOpenAIResponses, OpenAIError } from '../_lib/openai-client';
import { loadAISettings } from '../_lib/settings-store';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function err(
  code: NarrativeErrorResponse['code'],
  reason: string,
  httpStatus: number,
  details?: string
): NextResponse {
  const body: NarrativeErrorResponse = { error: reason, code, ...(details ? { details } : {}) };
  return NextResponse.json(body, { status: httpStatus, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  // ============== 1. 요청 파싱 + 형식 검증 ==============
  let payload: Partial<NarrativeGenerateRequest>;
  try {
    payload = (await req.json()) as Partial<NarrativeGenerateRequest>;
  } catch {
    return err('invalid-request', 'JSON 본문 파싱 실패', 400);
  }

  const { licenseKey, machineId, slot, context, useWebSearch } = payload;

  if (!slot || !(NARRATIVE_SLOTS as readonly string[]).includes(slot)) {
    return err('invalid-request', `유효하지 않은 narrative slot: ${String(slot)}`, 400);
  }
  if (!context || !context.product?.name || !context.functionalUnit || !context.totalCFP) {
    return err(
      'invalid-request',
      'context.product.name, functionalUnit, totalCFP는 필수입니다.',
      400
    );
  }

  // ============== 2. 라이선스 검증 ==============
  const lic = await checkLicense(licenseKey, machineId);
  if (!lic.ok) {
    return err('invalid-license', lic.reason, lic.httpStatus);
  }

  // ============== 3. AI 설정 DB 조회 ==============
  let settings: Awaited<ReturnType<typeof loadAISettings>>;
  try {
    settings = await loadAISettings();
  } catch (e) {
    return err(
      'server-error',
      e instanceof Error ? e.message : 'AI 설정 조회 실패',
      500
    );
  }

  if (!settings.narrativeEnabled) {
    return err(
      'narrative-disabled',
      'AI narrative 자동 생성이 관리자에 의해 비활성화되어 있습니다.',
      503
    );
  }
  if (!settings.openaiApiKey) {
    return err(
      'no-server-key',
      'OpenAI API 키가 서버에 설정되지 않았습니다. 관리자에게 문의하세요.',
      503
    );
  }

  // ============== 4. Web search 활성화 결정 ==============
  // 우선순위: 요청 useWebSearch override > 서버 default(auto/always/never) > slot meta
  const slotMeta = NARRATIVE_SLOT_META[slot as NarrativeSlot];
  let enableWebSearch: boolean;
  if (useWebSearch !== undefined) {
    enableWebSearch = useWebSearch;
  } else if (settings.webSearchDefault === 'always') {
    enableWebSearch = true;
  } else if (settings.webSearchDefault === 'never') {
    enableWebSearch = false;
  } else {
    enableWebSearch = slotMeta.useWebSearch; // 'auto'
  }

  // ============== 5. OpenAI 호출 ==============
  const userPrompt = buildSlotPrompt(slot as NarrativeSlot, context);

  let aiOutput: Awaited<ReturnType<typeof callOpenAIResponses>>;
  try {
    aiOutput = await callOpenAIResponses({
      apiKey: settings.openaiApiKey,
      model: settings.narrativeModel,
      systemPrompt: CARBONY_NARRATIVE_SYSTEM_PROMPT,
      userPrompt,
      useWebSearch: enableWebSearch,
    });
  } catch (e) {
    if (e instanceof OpenAIError) {
      const code: NarrativeErrorResponse['code'] =
        e.status === 401 || e.status === 403
          ? 'invalid-api-key'
          : e.status === 429
            ? 'rate-limited'
            : 'openai-api-error';
      return err(code, e.message, e.status === 429 ? 429 : 502, e.body?.slice(0, 500));
    }
    return err(
      'server-error',
      e instanceof Error ? e.message : 'OpenAI 호출 실패',
      500
    );
  }

  // ============== 6. JSON 파싱 ==============
  const parsed = parseNarrativeJson(aiOutput.text);
  if (!parsed) {
    return err(
      'openai-api-error',
      'OpenAI 응답이 예상한 JSON 형식이 아닙니다.',
      502,
      aiOutput.text.slice(0, 500)
    );
  }

  // ============== 7. 응답 ==============
  const response: NarrativeGenerateResponse = {
    slot: slot as NarrativeSlot,
    title: parsed.title ?? undefined,
    paragraphs: parsed.paragraphs,
    citations: aiOutput.citations,
    usage: aiOutput.usage,
    model: aiOutput.model,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response, { headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * OpenAI 응답에서 narrative JSON 추출.
 * 모델이 코드블록으로 감쌀 경우도 처리.
 */
function parseNarrativeJson(
  text: string
): { title?: string | null; paragraphs: string[] } | null {
  if (!text) return null;

  let jsonStr = text.trim();

  const cb = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) jsonStr = cb[1].trim();

  const brace = jsonStr.match(/\{[\s\S]*\}/);
  if (brace) jsonStr = brace[0];

  try {
    const obj = JSON.parse(jsonStr) as { title?: string | null; paragraphs?: unknown };
    if (!Array.isArray(obj.paragraphs) || obj.paragraphs.length === 0) return null;
    const paragraphs = obj.paragraphs.filter(
      (p): p is string => typeof p === 'string' && p.trim().length > 0
    );
    if (paragraphs.length === 0) return null;
    return { title: typeof obj.title === 'string' ? obj.title : null, paragraphs };
  } catch {
    return null;
  }
}
