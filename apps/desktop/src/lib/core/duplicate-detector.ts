/**
 * ISO 14067 5.12 중복 계산 감지기 (Duplicate Detector)
 * 동일 배출원 중복 입력을 자동 감지합니다.
 */

// =============================================================================
// 타입 정의
// =============================================================================

export interface DuplicateWarning {
    type: 'exact_match' | 'similar_name' | 'same_lci' | 'cross_stage'
    severity: 'error' | 'warning'
    itemIds: string[]
    message: string
    recommendation: string
}

export interface DuplicateCheckResult {
    hasDuplicates: boolean
    warnings: DuplicateWarning[]
    summary: {
        exactMatches: number
        similarNames: number
        crossStage: number
    }
}

// =============================================================================
// 유사도 계산 (Levenshtein Distance)
// =============================================================================

function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i]
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                )
            }
        }
    }

    return matrix[b.length][a.length]
}

function nameSimilarity(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim()
    const n2 = name2.toLowerCase().trim()

    if (n1 === n2) return 1.0

    const maxLen = Math.max(n1.length, n2.length)
    if (maxLen === 0) return 1.0

    const distance = levenshteinDistance(n1, n2)
    return 1 - (distance / maxLen)
}

// =============================================================================
// 중복 검사 함수
// =============================================================================

interface ActivityItem {
    id: string
    name: string
    stageId: string
    lciGuide?: {
        activityUuid?: string
        activityName?: string
    }
}

export function checkDuplicates(items: ActivityItem[]): DuplicateCheckResult {
    const warnings: DuplicateWarning[] = []
    let exactMatches = 0
    let similarNames = 0
    let crossStage = 0

    const SIMILARITY_THRESHOLD = 0.85 // 85% 이상 유사하면 경고

    // 모든 아이템 쌍 비교
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            const item1 = items[i]
            const item2 = items[j]

            // 1. 정확히 동일한 이름
            if (item1.name.toLowerCase().trim() === item2.name.toLowerCase().trim()) {
                exactMatches++

                const isCrossStage = item1.stageId !== item2.stageId
                if (isCrossStage) crossStage++

                warnings.push({
                    type: isCrossStage ? 'cross_stage' : 'exact_match',
                    severity: 'error',
                    itemIds: [item1.id, item2.id],
                    message: isCrossStage
                        ? `'${item1.name}'이(가) 여러 단계에 중복 입력되었습니다.`
                        : `'${item1.name}'이(가) 동일 단계에 중복 입력되었습니다.`,
                    recommendation: isCrossStage
                        ? '한 단계에서만 계산하거나, 양쪽 모두 포함이 필요한 경우 이중 계산이 아님을 문서화하세요.'
                        : '중복 항목을 삭제하거나 수량을 합산하세요.'
                })
                continue
            }

            // 2. 동일한 LCI Activity UUID
            if (
                item1.lciGuide?.activityUuid &&
                item1.lciGuide.activityUuid === item2.lciGuide?.activityUuid
            ) {
                warnings.push({
                    type: 'same_lci',
                    severity: 'warning',
                    itemIds: [item1.id, item2.id],
                    message: `'${item1.name}'과(와) '${item2.name}'이(가) 동일한 LCI 데이터를 사용합니다.`,
                    recommendation: '의도적인 경우 무시할 수 있습니다. 그렇지 않다면 하나를 삭제하세요.'
                })
                continue
            }

            // 3. 유사한 이름
            const similarity = nameSimilarity(item1.name, item2.name)
            if (similarity >= SIMILARITY_THRESHOLD) {
                similarNames++
                warnings.push({
                    type: 'similar_name',
                    severity: 'warning',
                    itemIds: [item1.id, item2.id],
                    message: `'${item1.name}'과(와) '${item2.name}'이(가) 매우 유사합니다 (${Math.round(similarity * 100)}%).`,
                    recommendation: '동일한 자재인 경우 통합을 고려하세요.'
                })
            }
        }
    }

    return {
        hasDuplicates: warnings.length > 0,
        warnings,
        summary: {
            exactMatches,
            similarNames,
            crossStage
        }
    }
}

// =============================================================================
// 단계 전체에서 중복 검사
// =============================================================================

export function checkAllStagesDuplicates(detailedActivityData: any): DuplicateCheckResult {
    const allItems: ActivityItem[] = []

    // 원자재
    if (detailedActivityData?.raw_materials) {
        allItems.push(...detailedActivityData.raw_materials.map((item: any) => ({
            id: item.id,
            name: item.name,
            stageId: 'raw_materials',
            lciGuide: item.lciGuide
        })))
    }

    // 포장재
    if (detailedActivityData?.packaging) {
        allItems.push(...detailedActivityData.packaging.map((item: any) => ({
            id: item.id,
            name: item.name,
            stageId: 'packaging',
            lciGuide: item.lciGuide
        })))
    }

    // 제조 - 연료
    if (detailedActivityData?.manufacturing?.fuels) {
        allItems.push(...detailedActivityData.manufacturing.fuels.map((item: any) => ({
            id: item.id,
            name: item.name,
            stageId: 'manufacturing',
            lciGuide: item.lciGuide
        })))
    }

    // 사용 - 소비재
    if (detailedActivityData?.use?.consumables) {
        allItems.push(...detailedActivityData.use.consumables.map((item: any) => ({
            id: item.id,
            name: item.name,
            stageId: 'use',
            lciGuide: item.lciGuide
        })))
    }

    return checkDuplicates(allItems)
}
