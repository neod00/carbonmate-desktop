import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Gemini API를 사용한 LCA 전문 번역
 * 한글 자재명을 ecoinvent LCI DB 검색에 최적화된 영문 키워드로 변환
 */
export async function POST(req: NextRequest) {
    try {
        const { query } = await req.json();

        if (!query || typeof query !== 'string') {
            return NextResponse.json(
                { error: "query is required" },
                { status: 400, headers: corsHeaders }
            );
        }

        if (!GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY not configured");
            return NextResponse.json(
                { error: "Translation service unavailable" },
                { status: 503, headers: corsHeaders }
            );
        }

        const prompt = `You are an LCA expert specializing in ecoinvent 3.12 database with 30 years of experience.
Translate the following Korean material/product name into English keywords optimized for searching the ecoinvent LCI database.

=== ECOINVENT ACTIVITY NAME PATTERNS ===
ecoinvent uses these standardized naming patterns:
- "[material] production" (e.g., "steel production, converter, unalloyed")
- "market for [product]" (e.g., "market for aluminium, wrought alloy")
- "[process], [specification]" (e.g., "injection moulding, polycarbonate")
- "treatment of [waste]" (e.g., "treatment of waste polyethylene")
- "electricity production, [source]" (e.g., "electricity production, photovoltaic")
- "[material] production, [detail]" (e.g., "flat glass production, uncoated")

=== RULES ===
1. Use exact ecoinvent terminology when possible
2. Focus on the core material, not brand names or application context
3. Return the MOST SPECIFIC ecoinvent term first, then broader alternatives
4. Use lowercase, separate multiple keywords with comma
5. If the term contains parentheses (e.g., "밀가루 (연질밀)"), translate both parts
6. Remove application context words (자동차용, 식품용, 건축용) and focus on the material itself

=== FEW-SHOT EXAMPLES ===
"알루미늄" → "aluminium, wrought alloy, aluminium alloy production"
"스테인리스강" → "chromium steel 18/8, steel production, stainless"
"HDPE" → "polyethylene, high density, granulate, HDPE"
"자동차용 반도체" → "semiconductor, integrated circuit, wafer fabrication"
"식품용 원지" → "solid bleached board, paperboard, base paper production"
"건축용 단열재" → "glass wool mat, insulation, expanded polystyrene"
"리튬이온 배터리" → "battery cell production, lithium-ion, NMC"
"천연가스" → "natural gas, high pressure, market for natural gas"
"골판지 상자" → "corrugated board box production, folding box"
"전기" → "electricity, medium voltage, market for electricity"

Korean term: "${query}"

English translation:`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.05,
                        maxOutputTokens: 150,
                    },
                }),
            }
        );

        if (!response.ok) {
            console.error("Gemini API error:", response.status);
            return NextResponse.json(
                { error: "Translation failed" },
                { status: 500, headers: corsHeaders }
            );
        }

        const data = await response.json();
        const translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!translation) {
            return NextResponse.json(
                { error: "No translation returned" },
                { status: 500, headers: corsHeaders }
            );
        }

        // 로그
        console.log(`[Translate] "${query}" → "${translation}"`);

        return NextResponse.json(
            { query, translation },
            { headers: corsHeaders }
        );
    } catch (error) {
        console.error("Translation error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}
