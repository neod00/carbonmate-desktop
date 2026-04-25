/**
 * ISO 14067 5.7 완전성 검사기 (Completeness Checker)
 * 시스템 경계 내 누락된 단계/프로세스를 자동 감지합니다.
 */

import { BoundaryType } from './store'

// =============================================================================
// 타입 정의
// =============================================================================

export interface CompletenessIssue {
    type: 'missing_stage' | 'empty_data' | 'low_contribution'
    severity: 'error' | 'warning' | 'info'
    stageId: string
    message: string
    recommendation: string
}

export interface CompletenessCheckResult {
    isComplete: boolean
    score: number // 0-100
    issues: CompletenessIssue[]
    summary: {
        totalRequiredStages: number
        coveredStages: number
        emptyStages: number
    }
}

// =============================================================================
// 경계 타입별 필수 단계 정의
// =============================================================================

const REQUIRED_STAGES_BY_BOUNDARY: Record<BoundaryType, string[]> = {
    'cradle-to-gate': ['raw_materials', 'manufacturing', 'transport'],
    'cradle-to-grave': ['raw_materials', 'manufacturing', 'transport', 'use', 'eol'],
    'gate-to-gate': ['manufacturing']
}

const RECOMMENDED_STAGES_BY_BOUNDARY: Record<BoundaryType, string[]> = {
    'cradle-to-gate': ['packaging'],
    'cradle-to-grave': ['packaging'],
    'gate-to-gate': ['transport']
}

const STAGE_LABELS: Record<string, string> = {
    raw_materials: '원료 채취',
    manufacturing: '제조',
    transport: '운송',
    packaging: '포장',
    use: '사용',
    eol: '폐기/재활용'
}

// =============================================================================
// 완전성 검사 함수
// =============================================================================

export function checkCompleteness(
    boundary: BoundaryType,
    selectedStages: string[],
    activityData: Record<string, any>,
    detailedActivityData?: any
): CompletenessCheckResult {
    const issues: CompletenessIssue[] = []
    const requiredStages = REQUIRED_STAGES_BY_BOUNDARY[boundary] || []
    const recommendedStages = RECOMMENDED_STAGES_BY_BOUNDARY[boundary] || []

    let coveredStages = 0
    let emptyStages = 0

    // 1. 필수 단계 누락 검사
    for (const stage of requiredStages) {
        if (!selectedStages.includes(stage)) {
            issues.push({
                type: 'missing_stage',
                severity: 'error',
                stageId: stage,
                message: `필수 단계 '${STAGE_LABELS[stage] || stage}'가 시스템 경계에서 누락되었습니다.`,
                recommendation: `${boundary} 경계에서는 '${STAGE_LABELS[stage] || stage}' 단계가 반드시 포함되어야 합니다. 이 단계를 추가하거나, 제외 사유를 문서화하세요.`
            })
        } else {
            // 단계는 선택되었지만 데이터가 비어있는지 확인
            const hasData = checkStageHasData(stage, activityData, detailedActivityData)
            if (hasData) {
                coveredStages++
            } else {
                emptyStages++
                issues.push({
                    type: 'empty_data',
                    severity: 'warning',
                    stageId: stage,
                    message: `'${STAGE_LABELS[stage] || stage}' 단계에 활동 데이터가 입력되지 않았습니다.`,
                    recommendation: `이 단계의 활동 데이터를 입력하거나, 해당 단계에서 배출이 발생하지 않는 경우 그 사유를 문서화하세요.`
                })
            }
        }
    }

    // 2. 권장 단계 누락 검사 (정보 수준)
    for (const stage of recommendedStages) {
        if (!selectedStages.includes(stage)) {
            issues.push({
                type: 'missing_stage',
                severity: 'info',
                stageId: stage,
                message: `'${STAGE_LABELS[stage] || stage}' 단계 포함을 권장합니다.`,
                recommendation: `이 단계를 포함하면 CFP 산정의 완전성이 향상됩니다.`
            })
        }
    }

    // 3. 점수 계산
    const totalRequired = requiredStages.length
    const score = totalRequired > 0
        ? Math.round((coveredStages / totalRequired) * 100)
        : 100

    const isComplete = issues.filter(i => i.severity === 'error').length === 0

    return {
        isComplete,
        score,
        issues,
        summary: {
            totalRequiredStages: totalRequired,
            coveredStages,
            emptyStages
        }
    }
}

// =============================================================================
// 디테일 활동 데이터 체크
// =============================================================================

function checkStageHasData(
    stageId: string,
    activityData: Record<string, any>,
    detailedActivityData?: any
): boolean {
    // 상세 활동 데이터가 있는 경우 우선 확인
    if (detailedActivityData) {
        switch (stageId) {
            case 'raw_materials':
                return (detailedActivityData.raw_materials?.length || 0) > 0
            case 'manufacturing':
                const mfg = detailedActivityData.manufacturing
                if (!mfg) return false
                return (
                    (mfg.electricity?.length || 0) > 0 ||
                    (mfg.fuels?.length || 0) > 0 ||
                    (mfg.processEmissions?.length || 0) > 0
                )
            case 'transport':
                return (detailedActivityData.transport?.length || 0) > 0
            case 'packaging':
                return (detailedActivityData.packaging?.length || 0) > 0
            case 'use':
                const use = detailedActivityData.use
                if (!use) return false
                return (
                    (use.electricity?.length || 0) > 0 ||
                    (use.consumables?.length || 0) > 0
                )
            case 'eol':
                const eol = detailedActivityData.eol
                if (!eol) return false
                return (
                    (eol.disposal?.length || 0) > 0 ||
                    (eol.recycling?.length || 0) > 0
                )
        }
    }

    // 레거시 activityData 확인
    const legacyKeys: Record<string, string[]> = {
        raw_materials: ['raw_material_weight', 'raw_material_type'],
        manufacturing: ['electricity_consumption', 'fuel_consumption', 'process_emission'],
        transport: ['transport_distance', 'transport_weight'],
        packaging: ['packaging_weight'],
        use: ['use_electricity', 'use_consumables'],
        eol: ['eol_disposal', 'eol_recycling']
    }

    const keys = legacyKeys[stageId] || []
    return keys.some(key => (activityData[key] || 0) > 0)
}

// =============================================================================
// 완전성 점수 등급
// =============================================================================

export function getCompletenessGrade(score: number): {
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    label: string
    color: string
} {
    if (score >= 90) return { grade: 'A', label: '우수', color: 'green' }
    if (score >= 75) return { grade: 'B', label: '양호', color: 'blue' }
    if (score >= 60) return { grade: 'C', label: '보통', color: 'yellow' }
    if (score >= 40) return { grade: 'D', label: '미흡', color: 'orange' }
    return { grade: 'F', label: '불완전', color: 'red' }
}
