import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Material Intelligence API (Phase 2)
 * 
 * 원료명을 입력받아 AI가 원료의 본질(카테고리, 성분, ecoinvent 최적 검색어)을
 * 분석한 뒤 구조화된 결과를 반환합니다.
 * 
 * 이 분석 결과를 활용하면:
 * 1. 검색어가 ecoinvent에 최적화됨
 * 2. "SUS304" → "chromium steel 18/8" 같은 전문 매핑
 * 3. 직접 검색 불가능한 자재는 자동 분해/프록시 추천
 */
export async function POST(req: NextRequest) {
    try {
        const { materialName, quantity, unit, productContext } = await req.json();

        if (!materialName) {
            return NextResponse.json(
                { error: "materialName is required" },
                { status: 400, headers: corsHeaders }
            );
        }

        if (!GEMINI_API_KEY) {
            // AI 없이 기본 분석 반환
            return NextResponse.json(
                generateFallbackAnalysis(materialName, productContext),
                { headers: corsHeaders }
            );
        }

        const category = productContext?.category?.toLowerCase() || 'other';

        const prompt = `You are an LCA expert with 30 years experience in ecoinvent database.

=== INPUT ===
Material: "${materialName}" (${quantity || 1} ${unit || 'kg'})
Product Category: ${productContext?.productName || 'Unknown'} / ${category}

=== TASK ===
Analyze this material and provide structured information for optimal ecoinvent database search.

Rules:
1. Identify the material's category, composition, and properties
2. Provide the EXACT ecoinvent-compatible search terms (primary + secondary)
3. Determine if this material is directly searchable in ecoinvent 3.12
4. If not directly available, suggest decomposition or proxy
5. All explanations in Korean

Output JSON only (no markdown):
{
  "materialCategory": "metal|plastic|paper|chemical|food|energy|textile|mineral|transport|other",
  "subCategory": "specific sub-type (e.g., stainless steel, thermoplastic)",
  "composition": {"element1": percentage, "element2": percentage} or null,
  "properties": ["key property 1", "key property 2"],
  
  "primarySearchTerms": ["best ecoinvent search term", "second best"],
  "secondarySearchTerms": ["broader fallback term 1", "broader fallback term 2"],
  
  "ecoinventHints": {
    "preferredActivityType": "market|production",
    "preferredTechCategory": "virgin|recycled|mixed|any",
    "unitGroup": "mass|energy|volume|area|length|items"
  },
  
  "isDirectlyAvailable": true or false,
  "confidence": "high|medium|low",
  "suggestedProxy": "proxy material name if not directly available, else null",
  "decomposition": [
    {"name": "component english name", "nameKo": "한글명", "percentage": 50}
  ] or null,
  
  "analysisNote": "분석 근거 설명 (한글, 1-2문장)"
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 800,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API error:", response.status, errorText);
            return NextResponse.json(
                generateFallbackAnalysis(materialName, productContext),
                { headers: corsHeaders }
            );
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!rawText) {
            return NextResponse.json(
                generateFallbackAnalysis(materialName, productContext),
                { headers: corsHeaders }
            );
        }

        // JSON 파싱
        let jsonText = rawText;
        if (rawText.includes('```')) {
            jsonText = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }

        try {
            const result = JSON.parse(jsonText);

            console.log(`[MaterialIntel] "${materialName}" → category: ${result.materialCategory}, ` +
                `primary: [${result.primarySearchTerms?.join(', ')}], ` +
                `available: ${result.isDirectlyAvailable}`);

            return NextResponse.json(
                {
                    input: materialName,
                    ...result,
                    source: "ai-material-intelligence",
                },
                { headers: corsHeaders }
            );
        } catch (parseError) {
            console.error("JSON parse error:", parseError, rawText);
            return NextResponse.json(
                generateFallbackAnalysis(materialName, productContext),
                { headers: corsHeaders }
            );
        }
    } catch (error) {
        console.error("Material Intelligence error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: corsHeaders }
        );
    }
}

/**
 * AI 실패 시 규칙 기반 폴백 분석
 */
function generateFallbackAnalysis(materialName: string, productContext?: any) {
    const name = materialName.toLowerCase();

    // 간단한 규칙 기반 카테고리 분류
    let materialCategory = 'other';
    let primarySearchTerms = [materialName];

    if (['steel', 'iron', 'alumin', 'copper', 'zinc', 'nickel', 'metal', '강', '철', '알루미늄', '구리'].some(k => name.includes(k))) {
        materialCategory = 'metal';
    } else if (['poly', 'plastic', 'pet', 'pvc', 'nylon', 'rubber', '플라스틱', '고무'].some(k => name.includes(k))) {
        materialCategory = 'plastic';
    } else if (['paper', 'cardboard', 'pulp', 'wood', '종이', '목재', '판지'].some(k => name.includes(k))) {
        materialCategory = 'paper';
    } else if (['electric', 'energy', 'gas', 'diesel', 'fuel', '전기', '가스', '디젤'].some(k => name.includes(k))) {
        materialCategory = 'energy';
    } else if (['cement', 'concrete', 'glass', 'brick', '시멘트', '유리', '콘크리트'].some(k => name.includes(k))) {
        materialCategory = 'mineral';
    } else if (['flour', 'sugar', 'salt', 'oil', 'milk', 'meat', '밀', '설탕', '소금', '우유'].some(k => name.includes(k))) {
        materialCategory = 'food';
    }

    return {
        input: materialName,
        materialCategory,
        subCategory: null,
        composition: null,
        properties: [],
        primarySearchTerms,
        secondarySearchTerms: [],
        ecoinventHints: {
            preferredActivityType: 'market',
            preferredTechCategory: 'any',
            unitGroup: 'mass',
        },
        isDirectlyAvailable: true,
        confidence: 'low',
        suggestedProxy: null,
        decomposition: null,
        analysisNote: 'AI 분석을 사용할 수 없어 기본 분석을 반환합니다.',
        source: 'fallback-rule-based',
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}
