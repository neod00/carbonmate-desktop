import { NextRequest, NextResponse } from "next/server";
import {
    RecommendRequest,
    LcaContext,
    Variant,
    RecommendationResult,
    LcaPurpose,
    LcaScope,
    AIProvider
} from "./types";
import { getTopCandidates, generateWarnings } from "./scoring";
import { generateAIRecommendation, getAvailableProviders } from "./ai";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

// Supabase 검색 대신 Phase 2에서 Neon Postgres 기반 검색으로 대체 예정
async function searchDatabase(_q: string, _geography?: string, _unit?: string): Promise<Variant[]> {
    // TODO Phase 2: Neon Postgres에서 lci_datasets 쿼리
    return [];
}

async function handleRecommend(body: RecommendRequest): Promise<NextResponse> {
    const q = (body.q || "").trim();
    if (!q) {
        return NextResponse.json({ error: "검색어(q)가 필요합니다." }, { status: 400 });
    }

    const context: LcaContext = {
        productName: body.productName,
        functionalUnit: body.functionalUnit,
        lcaPurpose: body.lcaPurpose || "pcf",
        lcaScope: body.lcaScope || "cradle-to-gate",
        materialRole: body.materialRole,
        preferredGeo: body.geography,
        preferredUnit: body.unit,
    };

    const defaultProvider = (process.env.AI_DEFAULT_PROVIDER as AIProvider) || "gemini";
    const aiProvider: AIProvider = body.aiProvider || defaultProvider;

    try {
        let variants: Variant[] = [];

        if (body.targetVariant) {
            const target = body.targetVariant;
            variants = [{
                id: target.id || target.activityUuid || "target",
                activityName: target.activityName,
                referenceProductName: target.referenceProductName,
                canonicalProduct: target.canonicalProduct,
                geography: target.geography,
                unit: target.unit,
                systemModel: target.systemModel,
                ecoinventVersion: target.ecoinventVersion,
                activityUuid: target.activityUuid,
                productUuid: target.productUuid,
                techCategory: target.techCategory,
                processType: target.processType,
                materialType: target.materialType,
                isoScores: target.isoScores,
                ecoQueryUrl: target.ecoQueryUrl
            }];
        } else {
            variants = await searchDatabase(q, body.geography, body.unit);
        }

        if (variants.length === 0) {
            return NextResponse.json({
                query: q,
                recommendation: null,
                message: "검색 결과가 없습니다.",
                availableProviders: getAvailableProviders(),
            }, { headers: corsHeaders });
        }

        const topCandidates = getTopCandidates(variants, context, 10);

        if (topCandidates.length === 0) {
            return NextResponse.json({
                query: q,
                recommendation: null,
                message: "적합한 후보가 없습니다.",
                availableProviders: getAvailableProviders(),
            }, { headers: corsHeaders });
        }

        const warnings = generateWarnings(topCandidates, context);
        const aiResult = await generateAIRecommendation(context, topCandidates, aiProvider);

        const top1 = topCandidates[0];
        const alt1 = topCandidates[1];
        const alt2 = topCandidates[2];

        const recommendation: RecommendationResult = {
            top1: {
                variant: top1,
                reason: aiResult.top1Reason,
                confidence: top1.recommendationScore >= 70 ? "high" :
                    top1.recommendationScore >= 40 ? "medium" : "low",
                score: top1.recommendationScore,
                detailed: aiResult.detailed,
            },
            alternatives: [],
            warnings: [...warnings, ...aiResult.additionalWarnings],
            analysisContext: `${context.productName || q} - ${context.lcaPurpose} / ${context.lcaScope}`,
        };

        if (alt1) recommendation.alternatives.push({
            variant: alt1,
            reason: aiResult.alternativeReasons[0] || "대안 데이터입니다.",
            useCase: aiResult.alternativeUseCases[0] || "다른 조건이 필요한 경우",
            score: alt1.recommendationScore,
        });

        if (alt2) recommendation.alternatives.push({
            variant: alt2,
            reason: aiResult.alternativeReasons[1] || "추가 대안입니다.",
            useCase: aiResult.alternativeUseCases[1] || "추가 대안이 필요한 경우",
            score: alt2.recommendationScore,
        });

        return NextResponse.json({
            query: q,
            context: {
                productName: context.productName,
                lcaPurpose: context.lcaPurpose,
                lcaScope: context.lcaScope,
            },
            recommendation,
            candidatesCount: topCandidates.length,
            aiProvider,
            availableProviders: getAvailableProviders(),
        }, { headers: corsHeaders });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Recommend API error:", error);
        return NextResponse.json(
            { error: "추천 처리 중 오류가 발생했습니다.", details: msg },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const body: RecommendRequest = {
        q: searchParams.get("q") || "",
        geography: searchParams.get("geography") || undefined,
        unit: searchParams.get("unit") || undefined,
        productName: searchParams.get("productName") || undefined,
        lcaPurpose: (searchParams.get("lcaPurpose") as LcaPurpose) || undefined,
        lcaScope: (searchParams.get("lcaScope") as LcaScope) || undefined,
        aiProvider: (searchParams.get("aiProvider") as AIProvider) || undefined,
    };
    return handleRecommend(body);
}

export async function POST(req: NextRequest) {
    const body = (await req.json().catch(() => ({}))) as RecommendRequest;
    return handleRecommend(body);
}
