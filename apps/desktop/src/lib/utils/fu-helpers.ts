/**
 * Functional Unit / Declared Unit 헬퍼.
 *
 * PR-V09: FU 단위 변경 시 결과 화면의 CFP 가 비례 환산되도록 mass 단위 파싱.
 * PR-V10: ISO 14067 §6.3.2 — cradle-to-gate B2B 중간재는 선언단위(DU) 적용.
 */

/**
 * BOM 입력의 기준 생산량 (kg). 카보니/일반 화학 공정 관행상 1 ton 기준 입력.
 * 추후 productInfo.bomReferenceMass 필드 도입 시 이 상수를 대체.
 */
export const BOM_REFERENCE_MASS_KG = 1000

/** "1 ton", "1 kg", "100 g" 등 mass 표기에서 kg 단위 mass 추출. mass 가 아니면 null. */
export function parseFuMassKg(unit: string | undefined | null): number | null {
    if (!unit) return null
    const s = unit.toLowerCase().trim()
    // pattern: <number> <ton|kg|g|t|tonne>
    const m = s.match(/(\d+(?:\.\d+)?)\s*(ton|tonne|kg|g|t)\b/)
    if (!m) return null
    const n = Number(m[1])
    if (!Number.isFinite(n) || n <= 0) return null
    const u = m[2]
    if (u === 'ton' || u === 'tonne' || u === 't') return n * 1000
    if (u === 'kg') return n
    if (u === 'g') return n / 1000
    return null
}

/**
 * BOM 절대 합계 → FU 당 CFP 환산.
 * BOM 이 1 ton 기준으로 입력됐다고 가정하고, FU 단위가 mass 면 그 비율로 스케일.
 * mass 가 아닌 단위 (1 set, 1 kWh 등) 면 환산 없이 그대로 반환.
 */
export function scaleCfpToFu(absoluteCfp: number, fuUnit: string | undefined | null): number {
    const fuMass = parseFuMassKg(fuUnit)
    if (fuMass == null) return absoluteCfp
    return absoluteCfp * (fuMass / BOM_REFERENCE_MASS_KG)
}

/**
 * ISO 14067 §6.3.2 — 시스템 경계가 cradle-to-gate (B2B 중간재) 면 DU, 아니면 FU.
 * 보고서 / 결과 화면 / 워크북 헤더 등에서 일관 적용.
 */
export function getUnitTypeLabel(boundary: string | undefined | null): { short: string; long: string } {
    const isIntermediate = boundary === 'cradle-to-gate'
    return isIntermediate
        ? { short: '선언단위', long: '선언단위 (DU)' }
        : { short: '기능단위', long: '기능단위 (FU)' }
}
