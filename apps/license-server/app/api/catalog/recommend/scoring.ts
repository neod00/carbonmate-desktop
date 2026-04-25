import { LcaContext, LcaPurpose, LcaScope, Variant, ScoredVariant } from "./types";

/**
 * LCI 데이터에 대한 추천 점수를 계산합니다.
 * 규칙 기반으로 텍스트 매칭, 지리, 단위, 데이터 타입, LCA 목적/범위를 고려합니다.
 */
export function calculateRecommendationScore(
    variant: Variant,
    context: LcaContext
): ScoredVariant {
    const breakdown = {
        geography: getGeographyScore(variant.geography, context),
        unit: getUnitScore(variant.unit, context.preferredUnit),
        dataType: getDataTypeScore(variant.activityName, context),
        purpose: getPurposeScore(variant, context.lcaPurpose),
        scope: getScopeScore(variant.activityName, context.lcaScope),
    };

    const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);

    return {
        ...variant,
        recommendationScore: totalScore,
        scoreBreakdown: breakdown,
    };
}

/**
 * 지리(Geography) 점수 (0~25점)
 */
function getGeographyScore(geography: string | undefined, context: LcaContext): number {
    const geo = (geography || "").toUpperCase();
    const preferred = (context.preferredGeo || "").toUpperCase();

    // 사용자가 선호 지역을 지정한 경우
    if (preferred) {
        if (geo === preferred) return 25;
        if (geo === "GLO") return 15;
        return 5;
    }

    // 목적에 따른 기본 점수
    switch (context.lcaPurpose) {
        case "epd":
            // EPD: 유럽 데이터 선호
            if (["RER", "EUROPE", "EU"].some(e => geo.includes(e))) return 25;
            if (geo === "GLO") return 15;
            return 10;

        case "regulation":
            // 규제: 특정 지역 데이터 필요할 수 있음
            if (geo === "GLO") return 20;
            return 15;

        case "supply_chain":
            // 공급망: 실제 조달 지역 중요
            if (geo === "KR") return 25;
            if (geo === "GLO") return 15;
            return 10;

        default:
            // PCF, 내부: GLO 우선
            if (geo === "GLO") return 20;
            if (geo === "KR") return 18;
            return 10;
    }
}

/**
 * 단위(Unit) 점수 (0~15점, 불일치 시 -50)
 */
function getUnitScore(unit: string | undefined, preferredUnit: string | undefined): number {
    if (!preferredUnit) return 10; // 선호 단위 없으면 기본 점수

    const u = (unit || "").toLowerCase().trim();
    const p = preferredUnit.toLowerCase().trim();

    if (u === p) return 15;

    // 호환 가능한 단위 그룹
    const massUnits = ["kg", "g", "t", "ton", "tonne"];
    const energyUnits = ["kwh", "mj", "j", "gj"];
    const volumeUnits = ["m3", "l", "liter", "litre"];

    const isCompatible = (units: string[]) =>
        units.some(x => u.includes(x)) && units.some(x => p.includes(x));

    if (isCompatible(massUnits) || isCompatible(energyUnits) || isCompatible(volumeUnits)) {
        return 10; // 호환 가능
    }

    return -50; // 단위 불일치 페널티
}

/**
 * 데이터 타입 점수 (0~30점)
 * market for vs production 등
 */
function getDataTypeScore(activityName: string | undefined, context: LcaContext): number {
    const name = (activityName || "").toLowerCase();

    const isMarket = name.includes("market for") || name.includes("market group");
    const isProduction = name.includes("production") || name.includes("processing");
    const isDisposal = name.includes("disposal") || name.includes("treatment") || name.includes("waste");
    const isTransport = name.includes("transport");

    // 원료 용도에 따른 가산점
    const role = (context.materialRole || "").toLowerCase();
    const isProcurement = role.includes("구매") || role.includes("조달") || role.includes("원료");
    const isManufacturing = role.includes("제조") || role.includes("가공") || role.includes("공정");

    let score = 0;

    // 범위에 따른 데이터 타입 선호
    switch (context.lcaScope) {
        case "cradle-to-gate":
            // 원료 조달 + 제조
            if (isProcurement && isMarket) score += 30;
            else if (isManufacturing && isProduction) score += 30;
            else if (isMarket) score += 25;
            else if (isProduction) score += 20;
            break;

        case "gate-to-gate":
            // 제조 공정만
            if (isProduction) score += 30;
            else if (isMarket) score += 10; // market은 gate-to-gate에 덜 적합
            break;

        case "cradle-to-grave":
            // 전체 수명주기
            if (isMarket) score += 25;
            if (isDisposal) score += 20;
            break;
    }

    // 운송은 일반적으로 낮은 점수
    if (isTransport && !role.includes("운송")) {
        score -= 10;
    }

    return Math.max(0, Math.min(30, score));
}

/**
 * LCA 목적별 가산점 (0~20점)
 */
function getPurposeScore(variant: Variant, purpose: LcaPurpose): number {
    const version = variant.ecoinventVersion || "";
    const geo = (variant.geography || "").toUpperCase();

    switch (purpose) {
        case "pcf":
            // PCF: 범용성, GLO 선호
            if (geo === "GLO") return 20;
            return 10;

        case "epd":
            // EPD: 지역 특정성, 최신 버전
            let score = 0;
            if (["RER", "EUROPE"].some(e => geo.includes(e))) score += 15;
            if (version >= "3.10") score += 5;
            return score;

        case "supply_chain":
            // 공급망: 실제 지역 데이터
            if (geo === "KR" || geo === "CN" || geo === "US") return 20;
            if (geo === "GLO") return 10;
            return 5;

        case "internal":
            // 내부: 일관성 중요
            if (version >= "3.10") return 15;
            return 10;

        case "regulation":
            // 규제: 최신 버전, 공식 인정
            if (version >= "3.10") return 20;
            if (version >= "3.8") return 15;
            return 5;

        default:
            return 10;
    }
}

/**
 * LCA 범위별 가산점 (0~10점)
 */
function getScopeScore(activityName: string | undefined, scope: LcaScope): number {
    const name = (activityName || "").toLowerCase();

    const isMarket = name.includes("market for");
    const isProduction = name.includes("production");
    const isDisposal = name.includes("disposal") || name.includes("treatment");

    switch (scope) {
        case "cradle-to-gate":
            if (isMarket) return 10;
            if (isProduction) return 8;
            return 3;

        case "gate-to-gate":
            if (isProduction) return 10;
            if (isMarket) return 3;
            return 5;

        case "cradle-to-grave":
            if (isMarket) return 8;
            if (isDisposal) return 10;
            if (isProduction) return 6;
            return 3;

        default:
            return 5;
    }
}

/**
 * 경고 메시지 생성
 */
export function generateWarnings(
    topVariants: ScoredVariant[],
    context: LcaContext
): string[] {
    const warnings: string[] = [];

    const top = topVariants[0];
    if (!top) return warnings;

    // 단위 불일치 경고
    if (context.preferredUnit && top.unit !== context.preferredUnit) {
        warnings.push(`단위 주의: 데이터 단위(${top.unit})와 선호 단위(${context.preferredUnit})가 다릅니다. 환산이 필요합니다.`);
    }

    // 지역 불일치 경고
    if (context.preferredGeo && top.geography !== context.preferredGeo) {
        warnings.push(`지역 주의: 선호 지역(${context.preferredGeo})과 데이터 지역(${top.geography})이 다릅니다.`);
    }

    // EPD 목적인데 GLO 데이터인 경우
    if (context.lcaPurpose === "epd" && top.geography === "GLO") {
        warnings.push("EPD 발행 시 PCR의 지역 요구사항을 확인하세요. GLO 데이터가 허용되지 않을 수 있습니다.");
    }

    // 규제 목적인데 구버전인 경우
    if (context.lcaPurpose === "regulation" && top.ecoinventVersion && top.ecoinventVersion < "3.10") {
        warnings.push(`규제 대응 시 최신 버전 데이터 사용을 권장합니다. 현재: v${top.ecoinventVersion}`);
    }

    // Cradle-to-Grave인데 폐기 데이터가 없는 경우
    if (context.lcaScope === "cradle-to-grave") {
        const hasDisposal = topVariants.some(v =>
            (v.activityName || "").toLowerCase().includes("disposal") ||
            (v.activityName || "").toLowerCase().includes("treatment")
        );
        if (!hasDisposal) {
            warnings.push("Cradle-to-Grave 범위입니다. 폐기 단계(disposal/treatment) 데이터도 별도로 검색하세요.");
        }
    }

    return warnings;
}

/**
 * 상위 N개 추천 후보 추출
 */
export function getTopCandidates(
    variants: Variant[],
    context: LcaContext,
    topN: number = 10
): ScoredVariant[] {
    const scored = variants.map(v => calculateRecommendationScore(v, context));

    // 단위 불일치(-50점 이하)는 필터링
    const filtered = scored.filter(v => v.recommendationScore > -30);

    // 점수 내림차순 정렬
    filtered.sort((a, b) => b.recommendationScore - a.recommendationScore);

    return filtered.slice(0, topN);
}
