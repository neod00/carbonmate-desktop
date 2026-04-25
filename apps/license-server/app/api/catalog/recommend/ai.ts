import {
    LcaContext,
    ScoredVariant,
    AIProvider,
    LCA_PURPOSE_LABELS,
    LCA_SCOPE_LABELS,
    DetailedRecommendation,
    ISOCompliance,
    DataQualityIndicators
} from "./types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.AI_OPENAI_MODEL || "gpt-5-nano";

// ISO 표준 기반 상세 분석 프롬프트
const ISO_EXPERT_SYSTEM_PROMPT = `당신은 LCA(전과정평가) 검증 심사원입니다. ISO 14040/14044/14067 표준에 따라 LCI 데이터의 적합성을 평가합니다.

추천 이유(summary)와 상세 설명(explanation)을 작성할 때는 "ISO 14067 요구사항에 따라 지리적·기술적 대표성이 가장 높은 데이터를 선정하였습니다"와 같은 정중하고 전문적인 심사원 톤을 유지하세요. "자동 매칭되었습니다"와 같은 기계적인 표현보다는 데이터의 품질과 관련 표준 준수 여부를 강조하세요.

다음 항목을 반드시 평가하고 JSON 형식으로 응답하세요:

## 평가 항목

1. **지리적 대표성** [ISO 14044 §4.2.3.3]
   - 데이터 생산 지역과 실제 조달/생산 지역의 일치 여부
   - 점수 1~4 (1=불일치, 2=부분일치, 3=유사지역, 4=정확히일치)

2. **시간적 대표성** [ISO 14044 §4.2.3.3]
   - 데이터 기준 연도와 현재 기술 수준의 적합성
   - ecoinvent 버전 3.10 이상이면 양호
   - 점수 1~4

3. **기술적 대표성** [ISO 14044 §4.2.3.3]
   - 데이터 기술(market vs production)이 원료 용도와 일치 여부
   - 점수 1~4

4. **시스템 경계** [ISO 14044 §4.2.3.4]
   - 데이터가 LCA 범위(Cradle-to-Gate 등)에 부합하는지
   - market for = 원료 조달 포함, production = 제조만

5. **컷오프 기준** [ISO 14067 §6.3.2]
   - 1% 개별 / 5% 누적 기준 충족 여부 (해당 원료가 포함 대상인지)

## 응답 형식 (반드시 이 JSON 형식으로만 응답)

{
  "summary": "추천 이유 1줄 요약 (한국어)",
  "isoCompliance": {
    "geographic": {
      "isoRef": "ISO 14044 §4.2.3.3",
      "score": 4,
      "status": "pass",
      "explanation": "데이터 지역(KR)이 조달 지역과 일치하여 높은 지리적 대표성 확보"
    },
    "temporal": {
      "isoRef": "ISO 14044 §4.2.3.3", 
      "score": 4,
      "status": "pass",
      "explanation": "ecoinvent v3.12 (2024년)로 최신 기술 수준 반영"
    },
    "technological": {
      "isoRef": "ISO 14044 §4.2.3.3",
      "score": 4,
      "status": "pass", 
      "explanation": "'market for' 데이터로 원료 조달 용도에 적합"
    },
    "systemBoundary": {
      "isoRef": "ISO 14044 §4.2.3.4",
      "score": 4,
      "status": "pass",
      "explanation": "Cradle-to-Gate 범위에 부합하는 시장 데이터"
    },
    "cutoffCriteria": {
      "isoRef": "ISO 14067 §6.3.2",
      "score": 4,
      "status": "pass",
      "explanation": "해당 원료는 제품 질량/영향의 1% 이상으로 포함 대상"
    }
  },
  "dataQuality": {
    "time": 4,
    "geography": 4,
    "technology": 3,
    "completeness": 4,
    "consistency": 4,
    "overallScore": 85
  },
  "auditTrail": "ecoinvent v3.12 cut-off AO 기반, activity UUID로 추적 가능",
  "alternativeReasons": ["대안1 이유", "대안2 이유"],
  "alternativeUseCases": ["대안1 사용 시나리오", "대안2 사용 시나리오"],
  "additionalWarnings": ["경고 메시지 (있는 경우만)"]
}`;

interface AIRecommendationOutput {
    top1Reason: string;
    alternativeReasons: string[];
    alternativeUseCases: string[];
    additionalWarnings: string[];
    detailed?: DetailedRecommendation;
}

/**
 * ISO 표준 기반 상세 분석 프롬프트 생성
 */
function buildDetailedPrompt(context: LcaContext, candidates: ScoredVariant[]): string {
    const top3 = candidates.slice(0, 3);

    const contextStr = `
## LCA 컨텍스트

| 항목 | 값 |
|------|-----|
| 대상 제품 | ${context.productName || "(미입력)"} |
| 기능단위 | ${context.functionalUnit || "(미입력)"} |
| LCA 목적 | ${LCA_PURPOSE_LABELS[context.lcaPurpose]} |
| LCA 범위 | ${LCA_SCOPE_LABELS[context.lcaScope]} |
| 원료 용도 | ${context.materialRole || "(미입력)"} |
| 선호 지역 | ${context.preferredGeo || "없음"} |
| 선호 단위 | ${context.preferredUnit || "없음"} |
`;

    const candidatesStr = top3.map((c, i) => {
        // ISO 6가지 지표 점수 (있으면 표시)
        const isoScores = (c as any).isoScores;
        const isoStr = isoScores ? `
- **ISO 6가지 지표 점수**:
  - 시간적 대표성: ${isoScores.temporal}/100
  - 지리적 대표성: ${isoScores.geographical}/100
  - 기술적 대표성: ${isoScores.technological}/100
  - 완전성: ${isoScores.completeness}/100
  - 정밀성: ${isoScores.precision}/100
  - 일관성: ${isoScores.consistency}/100
  - **종합 점수: ${isoScores.overall}/100**` : '';

        // 메타데이터 (있으면 표시)
        const techCategory = (c as any).techCategory || 'unknown';
        const processType = (c as any).processType || 'unknown';
        const materialType = (c as any).materialType || 'unknown';

        return `
### 후보 ${i + 1}: ${c.activityName || c.referenceProductName || c.id}
- **지역**: ${c.geography || "-"}
- **단위**: ${c.unit || "-"}
- **버전**: ecoinvent ${c.ecoinventVersion || "-"}
- **모델**: ${c.systemModel || "-"}
- **활동 UUID**: ${c.activityUuid || "-"}
- **추천 점수**: ${c.recommendationScore}점
- **기술 분류**: ${techCategory} (virgin=신재, recycled=재생, mixed=혼합)
- **공정 유형**: ${processType}
- **소재 유형**: ${materialType}${isoStr}
`;
    }).join("\n");

    return `${contextStr}

## 검색된 LCI 후보 Top 3
${candidatesStr}

## 요청사항

1번 후보에 대해 ISO 14040/14044/14067 기준으로 상세 분석을 수행하세요.

**중요: 위에 제시된 ISO 6가지 지표 점수를 참고하여 선정 근거를 작성하세요.**
각 점수가 낮은 항목(70점 미만)이 있다면 그 이유와 주의사항을 반드시 언급하세요.

각 ISO 적합성 항목과 데이터 품질 지표(DQI)를 평가하세요.
2번과 3번 후보는 대안으로서의 적합성과 사용 시나리오를 설명하세요.

**반드시 위에서 정의한 JSON 형식으로만 응답하세요.**`;
}

/**
 * Gemini API 호출 (ISO 버전)
 */
async function callGeminiISO(prompt: string): Promise<AIRecommendationOutput> {
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: ISO_EXPERT_SYSTEM_PROMPT },
                            { text: prompt }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.8,
                    maxOutputTokens: 2048,
                }
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API 오류: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return parseDetailedAIResponse(text);
}

/**
 * OpenAI API 호출 (ISO 버전)
 */
async function callOpenAIISO(prompt: string): Promise<AIRecommendationOutput> {
    if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
                { role: "system", content: ISO_EXPERT_SYSTEM_PROMPT },
                { role: "user", content: prompt }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API 오류: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return parseDetailedAIResponse(text);
}

/**
 * ISO 상세 응답 파싱
 */
function parseDetailedAIResponse(text: string): AIRecommendationOutput {
    // JSON 블록 추출
    let jsonStr = text;

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    }

    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
        jsonStr = braceMatch[0];
    }

    try {
        const parsed = JSON.parse(jsonStr);

        // ISO 적합성 파싱
        const isoCompliance: ISOCompliance = {
            geographic: parsed.isoCompliance?.geographic || createDefaultISOItem("지리적 대표성"),
            temporal: parsed.isoCompliance?.temporal || createDefaultISOItem("시간적 대표성"),
            technological: parsed.isoCompliance?.technological || createDefaultISOItem("기술적 대표성"),
            systemBoundary: parsed.isoCompliance?.systemBoundary || createDefaultISOItem("시스템 경계"),
            cutoffCriteria: parsed.isoCompliance?.cutoffCriteria || createDefaultISOItem("컷오프 기준"),
        };

        // DQI 파싱
        const dataQuality: DataQualityIndicators = {
            time: parsed.dataQuality?.time || 3,
            geography: parsed.dataQuality?.geography || 3,
            technology: parsed.dataQuality?.technology || 3,
            completeness: parsed.dataQuality?.completeness || 3,
            consistency: parsed.dataQuality?.consistency || 3,
            overallScore: parsed.dataQuality?.overallScore || 75,
        };

        const detailed: DetailedRecommendation = {
            summary: parsed.summary || "추천 이유를 생성할 수 없습니다.",
            isoCompliance,
            dataQuality,
            auditTrail: parsed.auditTrail || "검증 정보 없음",
        };

        return {
            top1Reason: parsed.summary || "추천 이유를 생성할 수 없습니다.",
            alternativeReasons: parsed.alternativeReasons || [],
            alternativeUseCases: parsed.alternativeUseCases || [],
            additionalWarnings: parsed.additionalWarnings || [],
            detailed,
        };
    } catch (e) {
        console.error("AI 응답 파싱 실패:", text);
        return createFallbackOutput();
    }
}

function createDefaultISOItem(name: string) {
    return {
        isoRef: "ISO 14044",
        score: 3 as 1 | 2 | 3 | 4,
        status: "pass" as "pass" | "warn" | "fail",
        explanation: `${name} 평가 정보 없음`,
    };
}

function createFallbackOutput(): AIRecommendationOutput {
    return {
        top1Reason: "AI 응답을 파싱할 수 없습니다.",
        alternativeReasons: [],
        alternativeUseCases: [],
        additionalWarnings: [],
        detailed: undefined,
    };
}

/**
 * 규칙 기반 ISO 적합성 생성 (AI 없이)
 */
function generateFallbackDetailedRecommendation(
    context: LcaContext,
    candidate: ScoredVariant
): DetailedRecommendation {
    const geo = candidate.geography || "GLO";
    const version = candidate.ecoinventVersion || "3.12";
    const isMarket = (candidate.activityName || "").toLowerCase().includes("market for");

    const isoCompliance: ISOCompliance = {
        geographic: {
            isoRef: "ISO 14044 §4.2.3.3",
            score: geo === context.preferredGeo ? 4 : (geo === "GLO" ? 3 : 2),
            status: geo === context.preferredGeo ? "pass" : (geo === "GLO" ? "pass" : "warn"),
            explanation: geo === context.preferredGeo
                ? `데이터 지역(${geo})이 선호 지역과 일치합니다.`
                : geo === "GLO"
                    ? "글로벌 평균 데이터로 범용적으로 사용 가능합니다."
                    : `데이터 지역(${geo})이 선호 지역과 다릅니다.`,
        },
        temporal: {
            isoRef: "ISO 14044 §4.2.3.3",
            score: version >= "3.10" ? 4 : (version >= "3.8" ? 3 : 2),
            status: version >= "3.10" ? "pass" : "warn",
            explanation: `ecoinvent v${version} 사용. ${version >= "3.10" ? "최신 기술 수준 반영." : "최신 버전 권장."}`,
        },
        technological: {
            isoRef: "ISO 14044 §4.2.3.3",
            score: isMarket ? 4 : 3,
            status: "pass",
            explanation: isMarket
                ? "'market for' 데이터로 시장 평균 기술 수준 반영."
                : "'production' 데이터로 특정 기술 수준 반영.",
        },
        systemBoundary: {
            isoRef: "ISO 14044 §4.2.3.4",
            score: 4,
            status: "pass",
            explanation: `${LCA_SCOPE_LABELS[context.lcaScope]} 범위에 ${isMarket ? "시장 데이터로" : "생산 데이터로"} 적합합니다.`,
        },
        cutoffCriteria: {
            isoRef: "ISO 14067 §6.3.2",
            score: 4,
            status: "pass",
            explanation: "해당 원료는 1% 컷오프 기준을 초과하여 포함 대상입니다.",
        },
    };

    const avgScore = (isoCompliance.geographic.score + isoCompliance.temporal.score +
        isoCompliance.technological.score + isoCompliance.systemBoundary.score +
        isoCompliance.cutoffCriteria.score) / 5;

    const dataQuality: DataQualityIndicators = {
        time: version >= "3.10" ? 4 : 3,
        geography: geo === context.preferredGeo ? 4 : (geo === "GLO" ? 3 : 2),
        technology: isMarket ? 4 : 3,
        completeness: 4,
        consistency: 4,
        overallScore: Math.round(avgScore * 25),
    };

    return {
        summary: `${LCA_PURPOSE_LABELS[context.lcaPurpose]} 목적에 적합한 ${geo} ${isMarket ? "시장" : "생산"} 데이터입니다.`,
        isoCompliance,
        dataQuality,
        auditTrail: `ecoinvent v${version} ${candidate.systemModel || "cut-off"} AO 기반, activity UUID: ${candidate.activityUuid || "N/A"}`,
    };
}

/**
 * 규칙 기반 폴백 (AI 없이)
 */
function generateFallbackReasons(
    context: LcaContext,
    candidates: ScoredVariant[]
): AIRecommendationOutput {
    const top = candidates[0];
    const alt1 = candidates[1];
    const alt2 = candidates[2];

    const detailed = top ? generateFallbackDetailedRecommendation(context, top) : undefined;

    const alternativeReasons: string[] = [];
    const alternativeUseCases: string[] = [];

    if (alt1) {
        alternativeReasons.push(`지역(${alt1.geography}) 또는 데이터 타입이 다른 대안입니다.`);
        alternativeUseCases.push(`${alt1.geography} 지역 데이터가 필요한 경우`);
    }
    if (alt2) {
        alternativeReasons.push(`추가 대안 데이터입니다.`);
        alternativeUseCases.push(`다른 접근 방식이 필요한 경우`);
    }

    return {
        top1Reason: detailed?.summary || "추천 이유를 생성할 수 없습니다.",
        alternativeReasons,
        alternativeUseCases,
        additionalWarnings: [],
        detailed,
    };
}

/**
 * AI 추천 이유 생성 메인 함수 (ISO 표준 기반)
 */
export async function generateAIRecommendation(
    context: LcaContext,
    candidates: ScoredVariant[],
    provider: AIProvider = "gemini"
): Promise<AIRecommendationOutput> {
    if (candidates.length === 0) {
        return {
            top1Reason: "검색 결과가 없습니다.",
            alternativeReasons: [],
            alternativeUseCases: [],
            additionalWarnings: [],
        };
    }

    const prompt = buildDetailedPrompt(context, candidates);

    try {
        if (provider === "gemini") {
            return await callGeminiISO(prompt);
        } else if (provider === "openai") {
            return await callOpenAIISO(prompt);
        } else {
            return generateFallbackReasons(context, candidates);
        }
    } catch (error) {
        console.error("AI 호출 실패, 폴백 사용:", error);
        return generateFallbackReasons(context, candidates);
    }
}

/**
 * AI Provider 사용 가능 여부 확인
 */
export function getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
    if (GEMINI_API_KEY) providers.push("gemini");
    if (OPENAI_API_KEY) providers.push("openai");
    return providers;
}

