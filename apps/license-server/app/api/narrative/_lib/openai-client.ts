/**
 * OpenAI Responses API client — narrative 생성 전용.
 *
 * - Model: gpt-5.4-mini (default), 화이트리스트 외 거부
 * - Tools: web_search_preview (옵션)
 * - Prompt caching: ≥1024 토큰 prefix는 자동 캐싱 (system prompt가 캐시됨)
 *
 * 가격표 (2026-04-30 기준, USD per 1M tokens):
 *   input | cache | output
 *   gpt-5.4-mini: 0.75 / 0.075 / 4.5
 *   gpt-5-mini:   0.25 / 0.025 / 2.0
 *   gpt-5.4:      2.5  / 0.25  / 15
 */
import {
  ALLOWED_NARRATIVE_MODELS,
  DEFAULT_NARRATIVE_MODEL,
  type AllowedNarrativeModel,
  type NarrativeCitation,
} from '@lca/shared';

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';

/** USD per 1M tokens */
const MODEL_PRICING: Record<AllowedNarrativeModel, { input: number; cache: number; output: number }> =
  {
    'gpt-5.4-mini': { input: 0.75, cache: 0.075, output: 4.5 },
    'gpt-5-mini': { input: 0.25, cache: 0.025, output: 2.0 },
    'gpt-5.4': { input: 2.5, cache: 0.25, output: 15 },
    'gpt-5.4-pro': { input: 30, cache: 30, output: 180 }, // pro는 cache 없음으로 간주
    'gpt-5': { input: 1.25, cache: 0.125, output: 10 },
    'gpt-5.1': { input: 1.25, cache: 0.125, output: 10 },
    'gpt-5.2': { input: 1.75, cache: 0.175, output: 14 },
  };

export function isAllowedModel(model: string): model is AllowedNarrativeModel {
  return (ALLOWED_NARRATIVE_MODELS as readonly string[]).includes(model);
}

export interface OpenAIResponsesParsedOutput {
  /** 모델이 출력한 JSON 본문 (순수 문자열) */
  text: string;
  /** Web search 도구가 인용한 출처들 */
  citations: NarrativeCitation[];
  /** 토큰 사용량 + 비용 추정 */
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    estimatedCostUSD: number;
  };
  /** 실제 사용된 모델 ID */
  model: string;
}

export interface OpenAIResponsesParams {
  apiKey: string;
  model: AllowedNarrativeModel;
  systemPrompt: string;
  userPrompt: string;
  useWebSearch: boolean;
}

export class OpenAIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

/**
 * OpenAI Responses API 호출.
 * Responses API 응답 형식:
 *   { output: [ { type: "message", content: [ { type: "output_text", text, annotations: [...] } ] }, ... ],
 *     usage: { input_tokens, input_tokens_details: { cached_tokens }, output_tokens, ... } }
 */
export async function callOpenAIResponses(
  params: OpenAIResponsesParams
): Promise<OpenAIResponsesParsedOutput> {
  const { apiKey, model, systemPrompt, userPrompt, useWebSearch } = params;

  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new OpenAIError('유효하지 않은 OpenAI API 키 형식입니다.', 400);
  }

  const body: Record<string, unknown> = {
    model,
    instructions: systemPrompt,
    input: userPrompt,
    // Responses API는 prompt caching이 자동 적용됨 (≥1024 토큰 prefix)
  };

  if (useWebSearch) {
    body.tools = [{ type: 'web_search_preview' }];
  }

  const resp = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new OpenAIError(`OpenAI API 오류 (${resp.status})`, resp.status, errBody);
  }

  const data = (await resp.json()) as OpenAIResponsesRawResponse;

  return parseResponse(data, model);
}

/** Responses API 응답에서 텍스트 + 인용 + 사용량 추출 */
function parseResponse(
  data: OpenAIResponsesRawResponse,
  model: AllowedNarrativeModel
): OpenAIResponsesParsedOutput {
  // 메시지 출력 텍스트 추출
  let text = '';
  const citations: NarrativeCitation[] = [];

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type !== 'message' || !Array.isArray(item.content)) continue;
      for (const c of item.content) {
        if (c.type === 'output_text' && typeof c.text === 'string') {
          text += c.text;
          if (Array.isArray(c.annotations)) {
            for (const a of c.annotations) {
              if (a.type === 'url_citation' && a.url) {
                citations.push({
                  url: a.url,
                  title: a.title ?? a.url,
                  retrievedAt: new Date().toISOString(),
                });
              }
            }
          }
        }
      }
    }
  }

  // 사용량 + 비용
  const inputTokens = data.usage?.input_tokens ?? 0;
  const cachedInputTokens = data.usage?.input_tokens_details?.cached_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const newInputTokens = Math.max(0, inputTokens - cachedInputTokens);

  const pricing = MODEL_PRICING[model];
  const estimatedCostUSD =
    (newInputTokens * pricing.input +
      cachedInputTokens * pricing.cache +
      outputTokens * pricing.output) /
    1_000_000;

  return {
    text,
    citations,
    usage: { inputTokens, cachedInputTokens, outputTokens, estimatedCostUSD },
    model,
  };
}

export { DEFAULT_NARRATIVE_MODEL };

// ============== Raw response types ==============
interface OpenAIResponsesRawResponse {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{
        type?: string;
        url?: string;
        title?: string;
      }>;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens?: number;
  };
}
