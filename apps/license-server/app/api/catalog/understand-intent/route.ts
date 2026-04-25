import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export interface IntentResult {
    originalQuery: string;
    intent: {
        coreMaterial: string;
        applicationContext: string;
        userGoal: string;
        specificType: string;
    };
    optimizedSearchTerms: string[];
    suggestedCategory: string | null;
    contextFilters: {
        preferredSectors: string[];
        relevantKeywords: string[];
        irrelevantKeywords: string[];
    };
    explanation: string;
    source: 'ai' | 'rule-based';
}

/**
 * Intent Understanding API (Phase 3)
 * 
 * 검색 전에 사용자 의도를 파악하여 맥락 인식된 검색어를 생성합니다.
 * 
 * 예: "자동차용 반도체" →
 *   - 핵심 소재: semiconductor
 *   - 용도 맥락: automotive
 *   - 최적 검색어: ["semiconductor production", "wafer fabrication"]
 *   - 제외할 것: food/textile 관련
 */
export async function POST(req: NextRequest) {
    try {
        const { query, productContext } = await req.json();

        if (!query || typeof query !== 'string') {
            return NextResponse.json(
                { error: "query is required" },
                { status: 400, headers: corsHeaders }
            );
        }

        // 영문만인 짧은 쿼리는 Intent 분석 불필요
        if (!/[가-힣]/.test(query) && query.split(/\s+/).length <= 2) {
            return NextResponse.json(
                generateSimpleIntent(query),
                { headers: corsHeaders }
            );
        }

        if (!GEMINI_API_KEY) {
            return NextResponse.json(
                generateRuleBasedIntent(query, productContext),
                { headers: corsHeaders }
            );
        }

        const productInfo = productContext?.productName
            ? `\nProduct being assessed: "${productContext.productName}" (Category: ${productContext.category || 'unknown'})`
            : '';

        const prompt = `You are an LCA (Life Cycle Assessment) expert with 30 years of experience in ecoinvent 3.12 database.

=== USER INPUT ===
Search query: "${query}"${productInfo}

=== TASK ===
The user entered this query to find emission factors in ecoinvent 3.12 database.
Analyze their INTENT before performing any search. Understand:
1. What is the CORE MATERIAL? (the actual substance, not the application)
2. What is the APPLICATION CONTEXT? (automotive? food? construction? medical? general?)
3. What specific ecoinvent 3.12 activity names would best match?
4. What should be EXCLUDED to avoid irrelevant results?

=== CRITICAL RULES ===
- "자동차용 반도체" → core material is "semiconductor", context is "automotive" (NOT general electronics)
- "식품용 원지" → core material is "paperboard", context is "food packaging" (NOT general paper)
- "건축용 단열재" → core material is "insulation", context is "construction" (NOT industrial)
- Always provide ecoinvent-compatible terms (e.g., "steel, chromium steel 18/8" not just "stainless steel")
- optimizedSearchTerms should be EXACT ecoinvent activity name patterns when possible
- All explanations must be in Korean

=== OUTPUT FORMAT (JSON only, no markdown) ===
{
  "intent": {
    "coreMaterial": "the actual material in English",
    "applicationContext": "what it's used for",
    "userGoal": "find emission factor for LCA",
    "specificType": "more specific material type if applicable"
  },
  "optimizedSearchTerms": [
    "best ecoinvent search term",
    "second best ecoinvent search term",
    "third alternative"
  ],
  "suggestedCategory": "food|electronics|textile|automotive|construction|chemical|packaging|energy|null",
  "contextFilters": {
    "preferredSectors": ["relevant ecoinvent sector 1", "sector 2"],
    "relevantKeywords": ["keyword1", "keyword2", "keyword3"],
    "irrelevantKeywords": ["noise_keyword1", "noise_keyword2"]
  },
  "explanation": "사용자의 검색 의도를 한글로 1-2문장 설명"
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 600,
                    },
                }),
            }
        );

        if (!response.ok) {
            console.error("Gemini Intent API error:", response.status);
            return NextResponse.json(
                generateRuleBasedIntent(query, productContext),
                { headers: corsHeaders }
            );
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!rawText) {
            return NextResponse.json(
                generateRuleBasedIntent(query, productContext),
                { headers: corsHeaders }
            );
        }

        // JSON 파싱
        let jsonText = rawText;
        if (rawText.includes('```')) {
            jsonText = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }

        try {
            const parsed = JSON.parse(jsonText);

            const result: IntentResult = {
                originalQuery: query,
                intent: parsed.intent || {
                    coreMaterial: query,
                    applicationContext: 'general',
                    userGoal: 'find emission factor',
                    specificType: '',
                },
                optimizedSearchTerms: parsed.optimizedSearchTerms || [query],
                suggestedCategory: parsed.suggestedCategory || null,
                contextFilters: parsed.contextFilters || {
                    preferredSectors: [],
                    relevantKeywords: [],
                    irrelevantKeywords: [],
                },
                explanation: parsed.explanation || '검색 의도를 분석했습니다.',
                source: 'ai',
            };

            console.log(
                `[IntentUnderstanding] "${query}" → ` +
                `core: ${result.intent.coreMaterial}, ` +
                `context: ${result.intent.applicationContext}, ` +
                `terms: [${result.optimizedSearchTerms.join(', ')}]`
            );

            return NextResponse.json(result, { headers: corsHeaders });
        } catch (parseError) {
            console.error("Intent JSON parse error:", parseError, rawText);
            return NextResponse.json(
                generateRuleBasedIntent(query, productContext),
                { headers: corsHeaders }
            );
        }
    } catch (error) {
        console.error("Intent Understanding error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: corsHeaders }
        );
    }
}

/**
 * 간단한 영문 쿼리용 Intent (AI 호출 없이)
 */
function generateSimpleIntent(query: string): IntentResult {
    return {
        originalQuery: query,
        intent: {
            coreMaterial: query,
            applicationContext: 'general',
            userGoal: 'find emission factor',
            specificType: '',
        },
        optimizedSearchTerms: [query],
        suggestedCategory: null,
        contextFilters: {
            preferredSectors: [],
            relevantKeywords: [],
            irrelevantKeywords: [],
        },
        explanation: '영문 단일 키워드 입력 — 직접 검색합니다.',
        source: 'rule-based',
    };
}

/**
 * 규칙 기반 의도 분석 (AI 없이 폴백)
 */
function generateRuleBasedIntent(query: string, productContext?: any): IntentResult {
    const q = query.toLowerCase();

    // 용도 키워드 감지
    let applicationContext = 'general';
    let suggestedCategory: string | null = null;
    const irrelevantKeywords: string[] = [];

    if (q.includes('자동차') || q.includes('차량') || q.includes('automotive')) {
        applicationContext = 'automotive';
        suggestedCategory = 'automotive';
        irrelevantKeywords.push('food', 'textile', 'wood');
    } else if (q.includes('식품') || q.includes('음식') || q.includes('food')) {
        applicationContext = 'food';
        suggestedCategory = 'food';
        irrelevantKeywords.push('electronic', 'circuit', 'semiconductor');
    } else if (q.includes('건축') || q.includes('건설') || q.includes('construction')) {
        applicationContext = 'construction';
        suggestedCategory = 'construction';
        irrelevantKeywords.push('food', 'electronic');
    } else if (q.includes('의료') || q.includes('medical')) {
        applicationContext = 'medical';
        irrelevantKeywords.push('food', 'construction');
    } else if (q.includes('포장') || q.includes('packaging')) {
        applicationContext = 'packaging';
        suggestedCategory = 'packaging';
    } else if (q.includes('전자') || q.includes('electronic')) {
        applicationContext = 'electronics';
        suggestedCategory = 'electronics';
        irrelevantKeywords.push('food', 'construction');
    }

    // 핵심 소재 추출 (용도 키워드 제거)
    const contextWords = ['자동차용', '차량용', '식품용', '건축용', '의료용', '포장용', '전자용', '산업용'];
    let coreMaterial = query;
    for (const cw of contextWords) {
        coreMaterial = coreMaterial.replace(cw, '').trim();
    }

    return {
        originalQuery: query,
        intent: {
            coreMaterial: coreMaterial || query,
            applicationContext,
            userGoal: 'find emission factor',
            specificType: productContext?.productName || '',
        },
        optimizedSearchTerms: [coreMaterial || query],
        suggestedCategory,
        contextFilters: {
            preferredSectors: [],
            relevantKeywords: [],
            irrelevantKeywords,
        },
        explanation: `"${query}"에서 용도(${applicationContext})와 소재(${coreMaterial})를 규칙 기반으로 분리했습니다.`,
        source: 'rule-based',
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}
