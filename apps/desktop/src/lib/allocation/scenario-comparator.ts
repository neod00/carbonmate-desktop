/**
 * 할당 시나리오 비교 (Scenario Comparator)
 * 
 * 목적: 여러 할당 방법 적용 시 결과를 비교하여 민감도 분석 지원
 * 
 * @version 1.0.0
 */

import {
    AllocationRule,
    AllocationMethod,
    ALLOCATION_RULES_DB
} from './allocation-rules-db'

// =============================================================================
// 타입 정의
// =============================================================================

export interface AllocationScenario {
    method: AllocationMethod
    methodNameKo: string
    methodNameEn: string
    result: number  // kgCO2e
    isPreferred: boolean
    isAllowed: boolean
    reference: string
    notes?: string
}

export interface ScenarioComparison {
    baseScenario: AllocationScenario
    scenarios: AllocationScenario[]
    maxVariationPercent: number
    minValue: number
    maxValue: number
    sensitivityRequired: boolean
    sensitivityThreshold: number
    recommendation: string
}

export interface SensitivityReport {
    productName: string
    baseMethod: AllocationMethod
    baseResult: number
    alternativeResults: {
        method: AllocationMethod
        result: number
        variationPercent: number
        allowed: boolean
    }[]
    conclusion: string
    reportTextKo: string
    reportTextEn: string
}

// =============================================================================
// 할당 방법 정보
// =============================================================================

const ALLOCATION_METHOD_INFO: Record<AllocationMethod, { ko: string; en: string; description: string }> = {
    subdivision: { ko: '공정 세분화', en: 'Process Subdivision', description: '할당 회피' },
    system_expansion: { ko: '시스템 확장', en: 'System Expansion', description: '대체법/크레딧' },
    physical_mass: { ko: '물리적 할당 (질량)', en: 'Physical (Mass)', description: '질량 기준 배분' },
    physical_energy: { ko: '물리적 할당 (에너지)', en: 'Physical (Energy)', description: '에너지 함량 기준 배분' },
    physical_volume: { ko: '물리적 할당 (부피)', en: 'Physical (Volume)', description: '부피 기준 배분' },
    physical_carbon: { ko: '물리적 할당 (탄소)', en: 'Physical (Carbon)', description: '탄소 함량 기준 배분' },
    physical_stoichiometry: { ko: '물리적 할당 (화학량론)', en: 'Physical (Stoichiometry)', description: '화학량론 기준 배분' },
    physical_cwt: { ko: 'CWT 할당', en: 'CWT Allocation', description: '복잡도 가중 할당' },
    physical_capacity: { ko: '물리적 할당 (용량)', en: 'Physical (Capacity)', description: '용량 기준 배분' },
    physical_area: { ko: '물리적 할당 (면적)', en: 'Physical (Area)', description: '면적 기준 배분' },
    economic: { ko: '경제적 할당', en: 'Economic Allocation', description: '가격 기준 배분' },
    cut_off: { ko: 'Cut-off', en: 'Cut-off', description: '재활용 부담 없음' },
    eol_recycling: { ko: 'EOL 재활용', en: 'EOL Recycling', description: '최종 사용자 부담' },
    fifty_fifty: { ko: '50:50 할당', en: '50:50 Allocation', description: '균등 분배' },
    substitution: { ko: '대체법', en: 'Substitution', description: '회피 배출 크레딧' },
    pef_cff: { ko: 'PEF CFF', en: 'PEF CFF', description: 'EU PEF 순환 발자국 공식' }
}

// =============================================================================
// 시나리오 비교 함수
// =============================================================================

/**
 * 다중 할당 시나리오 비교
 */
export const compareAllocationScenarios = (
    rule: AllocationRule,
    baseEmission: number,  // 할당 전 총 배출량 (kgCO2e)
    allocationFactors: Record<AllocationMethod, number>  // 각 방법별 할당 비율 (0-1)
): ScenarioComparison => {
    const methodsToCompare = [
        rule.allocation.multiOutput.preferred,
        ...rule.allocation.sensitivityAnalysis.alternativeMethods
    ].filter((method, index, arr) => arr.indexOf(method) === index)  // 중복 제거

    const scenarios: AllocationScenario[] = methodsToCompare.map(method => {
        const factor = allocationFactors[method] ?? 1
        const result = baseEmission * factor
        const methodInfo = ALLOCATION_METHOD_INFO[method]

        return {
            method,
            methodNameKo: methodInfo.ko,
            methodNameEn: methodInfo.en,
            result,
            isPreferred: method === rule.allocation.multiOutput.preferred,
            isAllowed: rule.allocation.multiOutput.allowed.includes(method),
            reference: rule.references.primaryPCR.name,
            notes: rule.allocation.multiOutput.prohibited.includes(method)
                ? '이 방법은 해당 산업군에서 권장되지 않습니다.'
                : undefined
        }
    })

    const results = scenarios.map(s => s.result)
    const minValue = Math.min(...results)
    const maxValue = Math.max(...results)
    const maxVariationPercent = minValue > 0
        ? ((maxValue - minValue) / minValue) * 100
        : 0

    const baseScenario = scenarios.find(s => s.isPreferred) || scenarios[0]

    return {
        baseScenario,
        scenarios,
        maxVariationPercent,
        minValue,
        maxValue,
        sensitivityRequired: rule.allocation.sensitivityAnalysis.required,
        sensitivityThreshold: rule.allocation.sensitivityAnalysis.thresholdPercent,
        recommendation: maxVariationPercent > rule.allocation.sensitivityAnalysis.thresholdPercent
            ? '할당 방법에 따른 결과 차이가 기준치를 초과합니다. 민감도 분석 결과를 보고서에 포함해야 합니다.'
            : '할당 방법에 따른 결과 차이가 허용 범위 내입니다.'
    }
}

/**
 * 민감도 분석 보고서 생성
 */
export const generateSensitivityReport = (
    productName: string,
    comparison: ScenarioComparison,
    rule: AllocationRule
): SensitivityReport => {
    const { baseScenario, scenarios, maxVariationPercent } = comparison

    const alternativeResults = scenarios
        .filter(s => !s.isPreferred)
        .map(s => ({
            method: s.method,
            result: s.result,
            variationPercent: ((s.result - baseScenario.result) / baseScenario.result) * 100,
            allowed: s.isAllowed
        }))

    const conclusion = maxVariationPercent > comparison.sensitivityThreshold
        ? `할당 방법에 따라 최대 ${maxVariationPercent.toFixed(1)}%의 결과 차이가 발생합니다. ISO 14044에 따라 이 민감도 분석 결과를 CFP 보고서에 포함해야 합니다.`
        : `할당 방법에 따른 결과 차이가 ${maxVariationPercent.toFixed(1)}%로 허용 범위 내입니다.`

    const reportTextKo = `
## 민감도 분석: 할당 방법 비교

### 대상 제품
${productName}

### 기준 할당 방법
- 방법: ${ALLOCATION_METHOD_INFO[baseScenario.method].ko}
- 결과: ${baseScenario.result.toFixed(4)} kgCO₂e
- 근거: ${rule.references.primaryPCR.name}

### 대안 할당 방법 비교
${alternativeResults.map(r =>
        `- ${ALLOCATION_METHOD_INFO[r.method].ko}: ${r.result.toFixed(4)} kgCO₂e (${r.variationPercent >= 0 ? '+' : ''}${r.variationPercent.toFixed(1)}%)`
    ).join('\n')}

### 결과 범위
- 최소: ${comparison.minValue.toFixed(4)} kgCO₂e
- 최대: ${comparison.maxValue.toFixed(4)} kgCO₂e
- 최대 변동률: ${maxVariationPercent.toFixed(1)}%

### 결론
${conclusion}
`

    const reportTextEn = `
## Sensitivity Analysis: Allocation Method Comparison

### Product
${productName}

### Base Allocation Method
- Method: ${ALLOCATION_METHOD_INFO[baseScenario.method].en}
- Result: ${baseScenario.result.toFixed(4)} kgCO₂e
- Reference: ${rule.references.primaryPCR.nameEn}

### Alternative Methods Comparison
${alternativeResults.map(r =>
        `- ${ALLOCATION_METHOD_INFO[r.method].en}: ${r.result.toFixed(4)} kgCO₂e (${r.variationPercent >= 0 ? '+' : ''}${r.variationPercent.toFixed(1)}%)`
    ).join('\n')}

### Result Range
- Minimum: ${comparison.minValue.toFixed(4)} kgCO₂e
- Maximum: ${comparison.maxValue.toFixed(4)} kgCO₂e
- Maximum Variation: ${maxVariationPercent.toFixed(1)}%

### Conclusion
${maxVariationPercent > comparison.sensitivityThreshold
            ? `Allocation method choice significantly impacts results (${maxVariationPercent.toFixed(1)}% variation). Per ISO 14044, this sensitivity analysis must be included in the CFP report.`
            : `Allocation method variation is within acceptable limits (${maxVariationPercent.toFixed(1)}%).`
        }
`

    return {
        productName,
        baseMethod: baseScenario.method,
        baseResult: baseScenario.result,
        alternativeResults,
        conclusion,
        reportTextKo: reportTextKo.trim(),
        reportTextEn: reportTextEn.trim()
    }
}

/**
 * 할당 방법 정보 조회
 */
export const getAllocationMethodInfo = (method: AllocationMethod) => {
    return ALLOCATION_METHOD_INFO[method]
}

/**
 * 모든 할당 방법 목록 조회
 */
export const getAllAllocationMethods = () => {
    return Object.entries(ALLOCATION_METHOD_INFO).map(([method, info]) => ({
        method: method as AllocationMethod,
        ...info
    }))
}
