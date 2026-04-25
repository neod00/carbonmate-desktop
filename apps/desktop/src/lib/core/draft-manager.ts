// =============================================================================
// Draft Manager — localStorage 기반 임시저장 관리
// =============================================================================
// 별도 백업 서버 없이 브라우저 localStorage를 활용하여
// PCF 계산기 상태를 저장/불러오기/삭제합니다.
// =============================================================================

const DRAFT_LIST_KEY = 'carbonmate-draft-list'
const DRAFT_PREFIX = 'carbonmate-draft-'
const AUTO_SAVE_KEY = 'carbonmate-autosave'
const AUTO_SAVE_META_KEY = 'carbonmate-autosave-meta'

/**
 * 저장된 초안 메타데이터
 */
export interface DraftMeta {
    id: string
    name: string
    productName: string
    boundary: string
    savedAt: string          // ISO datetime
    stageCount: number
    materialCount: number
}

/**
 * 자동 저장 메타데이터
 */
export interface AutoSaveMeta {
    savedAt: string
    productName: string
}

// =============================================================================
// 자동 저장 (Zustand persist 연동)
// =============================================================================

/**
 * 자동 저장 메타 정보 업데이트
 */
export function updateAutoSaveMeta(productName: string): void {
    try {
        const meta: AutoSaveMeta = {
            savedAt: new Date().toISOString(),
            productName
        }
        localStorage.setItem(AUTO_SAVE_META_KEY, JSON.stringify(meta))
    } catch {
        // localStorage 용량 초과 등 무시
    }
}

/**
 * 자동 저장 메타 정보 가져오기
 */
export function getAutoSaveMeta(): AutoSaveMeta | null {
    try {
        const raw = localStorage.getItem(AUTO_SAVE_META_KEY)
        if (!raw) return null
        return JSON.parse(raw) as AutoSaveMeta
    } catch {
        return null
    }
}

// =============================================================================
// 수동 초안 관리 (이름 붙인 복수 저장)
// =============================================================================

/**
 * 초안 목록 가져오기
 */
export function getDraftList(): DraftMeta[] {
    try {
        const raw = localStorage.getItem(DRAFT_LIST_KEY)
        if (!raw) return []
        return JSON.parse(raw) as DraftMeta[]
    } catch {
        return []
    }
}

/**
 * 초안 목록 저장
 */
function saveDraftList(list: DraftMeta[]): void {
    localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(list))
}

/**
 * 초안 ID 생성
 */
function generateDraftId(): string {
    return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
}

/**
 * 현재 스토어 상태를 키에 저장합니다.
 * storeState: PCFState에서 actions와 함수를 제외한 순수 상태 데이터
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveDraft(name: string, storeState: any): DraftMeta {
    const id = generateDraftId()

    // 순수 데이터만 추출 (함수 제외)
    const dataOnly = extractSerializableState(storeState)

    // 메타 정보 생성
    const meta: DraftMeta = {
        id,
        name,
        productName: storeState.productInfo?.name || '(제품명 없음)',
        boundary: storeState.productInfo?.boundary || 'cradle-to-gate',
        savedAt: new Date().toISOString(),
        stageCount: storeState.stages?.length || 0,
        materialCount: storeState.detailedActivityData?.raw_materials?.length || 0
    }

    // 데이터 저장
    localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(dataOnly))

    // 목록에 추가
    const list = getDraftList()
    list.unshift(meta) // 최신 항목이 맨 앞
    saveDraftList(list)

    return meta
}

/**
 * 특정 초안 데이터 불러오기
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadDraft(id: string): any | null {
    try {
        const raw = localStorage.getItem(DRAFT_PREFIX + id)
        if (!raw) return null
        return JSON.parse(raw)
    } catch {
        return null
    }
}

/**
 * 특정 초안 삭제
 */
export function deleteDraft(id: string): void {
    localStorage.removeItem(DRAFT_PREFIX + id)
    const list = getDraftList().filter(d => d.id !== id)
    saveDraftList(list)
}

/**
 * 모든 초안 삭제 (cleanUp)
 */
export function deleteAllDrafts(): void {
    const list = getDraftList()
    list.forEach(d => localStorage.removeItem(DRAFT_PREFIX + d.id))
    localStorage.removeItem(DRAFT_LIST_KEY)
}

// =============================================================================
// 유틸리티
// =============================================================================

/**
 * 스토어 상태에서 직렬화 가능한 데이터만 추출
 * (함수를 제외하고 순수 상태만 반환)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSerializableState(state: any): any {
    const result: Record<string, unknown> = {}
    const excludeKeys = new Set([
        // actions (함수들)
        'setProductInfo', 'toggleStage', 'setActivityData', 'setActivityDataWithMeta',
        'setTransportMode', 'setElectricityGrid', 'setDataQualityMeta',
        'setMultiOutputAllocationMethod', 'setPhysicalAllocationBasis',
        'addCoProduct', 'removeCoProduct', 'updateCoProduct',
        'setMainProductData', 'setTotalProcessEmission',
        'setRecyclingAllocationMethod', 'setRecyclingParams',
        'setAllocationJustification', 'setSensitivityAnalysis',
        'setCutOffPreset', 'setCutOffCriteria', 'setCutOffResult',
        'addCFPSnapshot', 'removeCFPSnapshot', 'getCFPTrackingResult',
        'addRawMaterial', 'removeRawMaterial', 'updateRawMaterial',
        'addTransportStep', 'removeTransportStep', 'updateTransportStep',
        'addPackagingPart', 'removePackagingPart', 'updatePackagingPart',
        'setUser', 'logout', 'reset',
        // non-serializable / auth
        'user'
    ])

    for (const key of Object.keys(state)) {
        if (!excludeKeys.has(key) && typeof state[key] !== 'function') {
            result[key] = state[key]
        }
    }
    return result
}

/**
 * localStorage 사용량 추정 (KB 단위)
 */
export function getLocalStorageUsage(): { usedKB: number; estimatedMaxKB: number } {
    let total = 0
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key) {
                const val = localStorage.getItem(key)
                if (val) total += key.length + val.length
            }
        }
    } catch {
        // 접근 불가 시 무시
    }
    return {
        usedKB: Math.round((total * 2) / 1024), // UTF-16 → 2 bytes per char
        estimatedMaxKB: 5120 // 일반적으로 5MB
    }
}

/**
 * 날짜 문자열을 사람이 읽기 좋은 형태로 변환
 */
export function formatDraftDate(isoString: string): string {
    try {
        const date = new Date(isoString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMinutes = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMinutes / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMinutes < 1) return '방금 전'
        if (diffMinutes < 60) return `${diffMinutes}분 전`
        if (diffHours < 24) return `${diffHours}시간 전`
        if (diffDays < 7) return `${diffDays}일 전`

        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    } catch {
        return isoString
    }
}
