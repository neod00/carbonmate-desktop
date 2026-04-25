/**
 * 감사 추적 (Audit Trail)
 * 
 * 목적: CFP 데이터의 모든 변경사항을 자동 기록하여
 *       검증 시 "이 숫자가 언제, 왜 바뀌었는가?"를 추적
 * 
 * ISO 14067:2018 검증 요구사항:
 * - 데이터의 추적 가능성 (traceability)
 * - 변경 이력 (change log)
 * - 데이터 출처 문서화
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-14
 */

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 감사 로그 항목
 */
export interface AuditEntry {
    id: string
    timestamp: string               // ISO 8601
    field: string                   // 변경된 필드 (예: 'electricity', 'raw_material_weight')
    fieldLabel: string              // 한국어 필드명 (예: '전력 사용량')
    category: AuditCategory
    oldValue: string | number | null
    newValue: string | number | null
    unit?: string
    changedBy: string               // 사용자 식별 (기본: 'user')
    reason?: string                 // 변경 사유
    source?: string                 // 데이터 출처
    stage?: string                  // 관련 생애주기 단계
}

/**
 * 감사 카테고리
 */
export type AuditCategory =
    | 'activity_data'       // 활동 데이터 변경
    | 'emission_factor'     // 배출계수 변경
    | 'allocation'          // 할당 방법 변경
    | 'cut_off'             // 컷오프 기준 변경
    | 'boundary'            // 시스템 경계 변경
    | 'bom'                 // BOM 변경
    | 'multi_site'          // 다중 사업장 변경
    | 'general'             // 기타

/**
 * 감사 추적 필터
 */
export interface AuditFilter {
    startDate?: string
    endDate?: string
    categories?: AuditCategory[]
    fields?: string[]
    stages?: string[]
}

/**
 * 감사 보고서 요약
 */
export interface AuditSummary {
    totalEntries: number
    dateRange: { start: string; end: string }
    byCategory: Record<AuditCategory, number>
    byStage: Record<string, number>
    recentChanges: AuditEntry[]
    criticalChanges: AuditEntry[]   // 배출량에 큰 영향을 미치는 변경
}

// =============================================================================
// 필드 라벨 매핑
// =============================================================================

const FIELD_LABELS: Record<string, { ko: string; category: AuditCategory; stage?: string }> = {
    // 원자재
    'raw_material_weight': { ko: '원자재 중량', category: 'activity_data', stage: 'raw_materials' },
    'raw_material_type': { ko: '원자재 종류', category: 'activity_data', stage: 'raw_materials' },
    // 제조
    'electricity': { ko: '전력 사용량', category: 'activity_data', stage: 'manufacturing' },
    'electricity_grid': { ko: '전력 그리드', category: 'emission_factor', stage: 'manufacturing' },
    'gas': { ko: '천연가스 사용량', category: 'activity_data', stage: 'manufacturing' },
    'diesel': { ko: '경유 사용량', category: 'activity_data', stage: 'manufacturing' },
    'steam': { ko: '스팀 사용량', category: 'activity_data', stage: 'manufacturing' },
    // 운송
    'transport_weight': { ko: '운송 중량', category: 'activity_data', stage: 'transport' },
    'transport_distance': { ko: '운송 거리', category: 'activity_data', stage: 'transport' },
    'transport_mode': { ko: '운송 수단', category: 'activity_data', stage: 'transport' },
    // 포장
    'packaging_weight': { ko: '포장재 중량', category: 'activity_data', stage: 'packaging' },
    // 사용
    'use_electricity': { ko: '사용단계 전력', category: 'activity_data', stage: 'use' },
    'use_years': { ko: '사용 연수', category: 'activity_data', stage: 'use' },
    // 폐기
    'waste_weight': { ko: '폐기물 중량', category: 'activity_data', stage: 'eol' },
    'recycling_rate': { ko: '재활용률', category: 'activity_data', stage: 'eol' },
    // 할당
    'allocation_method': { ko: '할당 방법', category: 'allocation' },
    'allocation_basis': { ko: '할당 기준', category: 'allocation' },
    // 컷오프
    'cut_off_preset': { ko: '컷오프 프리셋', category: 'cut_off' },
    'cut_off_threshold': { ko: '컷오프 임계값', category: 'cut_off' },
    // BOM
    'bom_item_add': { ko: 'BOM 항목 추가', category: 'bom' },
    'bom_item_remove': { ko: 'BOM 항목 삭제', category: 'bom' },
    'bom_item_update': { ko: 'BOM 항목 수정', category: 'bom' },
    // 다중 사업장
    'site_add': { ko: '사업장 추가', category: 'multi_site' },
    'site_remove': { ko: '사업장 삭제', category: 'multi_site' },
    'site_update': { ko: '사업장 데이터 수정', category: 'multi_site' }
}

// =============================================================================
// AuditTrail 클래스
// =============================================================================

/**
 * 감사 추적 관리자
 * 
 * 사용법:
 * ```
 * const audit = new AuditTrail()
 * audit.trackChange('electricity', null, 1500, { reason: '계량기 검침 결과' })
 * audit.trackChange('electricity', 1500, 1600, { reason: '월간 데이터 반영' })
 * const summary = audit.getSummary()
 * const csv = audit.exportCSV()
 * ```
 */
export class AuditTrail {
    private entries: AuditEntry[] = []

    constructor(initialEntries?: AuditEntry[]) {
        if (initialEntries) {
            this.entries = [...initialEntries]
        }
    }

    /**
     * 변경 기록 추가
     */
    trackChange(
        field: string,
        oldValue: string | number | null,
        newValue: string | number | null,
        options?: {
            reason?: string
            source?: string
            changedBy?: string
            unit?: string
        }
    ): AuditEntry {
        const fieldInfo = FIELD_LABELS[field] || { ko: field, category: 'general' as AuditCategory }

        const entry: AuditEntry = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            field,
            fieldLabel: fieldInfo.ko,
            category: fieldInfo.category,
            oldValue,
            newValue,
            unit: options?.unit,
            changedBy: options?.changedBy || 'user',
            reason: options?.reason,
            source: options?.source,
            stage: fieldInfo.stage
        }

        this.entries.push(entry)
        return entry
    }

    /**
     * 여러 변경 한번에 기록 (예: 활동 데이터 일괄 입력)
     */
    trackBulkChanges(
        changes: { field: string; oldValue: string | number | null; newValue: string | number | null }[],
        options?: { reason?: string; source?: string; changedBy?: string }
    ): AuditEntry[] {
        return changes
            .filter(c => c.oldValue !== c.newValue)
            .map(c => this.trackChange(c.field, c.oldValue, c.newValue, options))
    }

    /**
     * 전체 로그 조회 (필터 적용)
     */
    getEntries(filter?: AuditFilter): AuditEntry[] {
        let result = [...this.entries]

        if (filter?.startDate) {
            result = result.filter(e => e.timestamp >= filter.startDate!)
        }
        if (filter?.endDate) {
            result = result.filter(e => e.timestamp <= filter.endDate!)
        }
        if (filter?.categories && filter.categories.length > 0) {
            result = result.filter(e => filter.categories!.includes(e.category))
        }
        if (filter?.fields && filter.fields.length > 0) {
            result = result.filter(e => filter.fields!.includes(e.field))
        }
        if (filter?.stages && filter.stages.length > 0) {
            result = result.filter(e => e.stage && filter.stages!.includes(e.stage))
        }

        return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    }

    /**
     * 요약 보고서 생성
     */
    getSummary(): AuditSummary {
        const entries = this.getEntries()
        const byCategory: Record<AuditCategory, number> = {
            activity_data: 0, emission_factor: 0, allocation: 0,
            cut_off: 0, boundary: 0, bom: 0, multi_site: 0, general: 0
        }
        const byStage: Record<string, number> = {}

        entries.forEach(e => {
            byCategory[e.category] = (byCategory[e.category] || 0) + 1
            if (e.stage) byStage[e.stage] = (byStage[e.stage] || 0) + 1
        })

        const sortedEntries = [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

        return {
            totalEntries: entries.length,
            dateRange: {
                start: entries.length > 0 ? sortedEntries[sortedEntries.length - 1].timestamp : '',
                end: entries.length > 0 ? sortedEntries[0].timestamp : ''
            },
            byCategory,
            byStage,
            recentChanges: sortedEntries.slice(0, 10),
            criticalChanges: sortedEntries.filter(e =>
                e.category === 'emission_factor' || e.category === 'allocation'
            )
        }
    }

    /**
     * CSV 내보내기 (검증 제출용)
     */
    exportCSV(): string {
        const headers = [
            '일시', '필드', '필드명', '카테고리', '이전값', '변경값',
            '단위', '변경사유', '데이터출처', '생애주기단계', '변경자'
        ]

        const rows = this.entries.map(e => [
            e.timestamp,
            e.field,
            e.fieldLabel,
            e.category,
            e.oldValue ?? '',
            e.newValue ?? '',
            e.unit ?? '',
            e.reason ?? '',
            e.source ?? '',
            e.stage ?? '',
            e.changedBy
        ])

        return [
            headers.join(','),
            ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        ].join('\n')
    }

    /**
     * JSON 내보내기
     */
    exportJSON(): string {
        return JSON.stringify({
            exportDate: new Date().toISOString(),
            totalEntries: this.entries.length,
            entries: this.entries
        }, null, 2)
    }

    /**
     * 특정 필드의 변경 이력 조회
     */
    getFieldHistory(field: string): AuditEntry[] {
        return this.entries
            .filter(e => e.field === field)
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    }

    /**
     * 모든 로그 초기화
     */
    clear(): void {
        this.entries = []
    }

    /**
     * 로그 수
     */
    get count(): number {
        return this.entries.length
    }

    /**
     * 직렬화 (localStorage 저장용)
     */
    serialize(): string {
        return JSON.stringify(this.entries)
    }

    /**
     * 역직렬화 (localStorage 복원용)
     */
    static deserialize(data: string): AuditTrail {
        try {
            const entries = JSON.parse(data) as AuditEntry[]
            return new AuditTrail(entries)
        } catch {
            return new AuditTrail()
        }
    }
}

// =============================================================================
// 헬퍼 함수
// =============================================================================

/**
 * 감사 항목을 읽기 좋은 한국어 문자열로 변환
 */
export const formatAuditEntry = (entry: AuditEntry): string => {
    const time = new Date(entry.timestamp).toLocaleString('ko-KR')
    const field = entry.fieldLabel
    const from = entry.oldValue === null ? '(없음)' : `${entry.oldValue}${entry.unit ? ' ' + entry.unit : ''}`
    const to = entry.newValue === null ? '(삭제)' : `${entry.newValue}${entry.unit ? ' ' + entry.unit : ''}`

    let text = `[${time}] ${field}: ${from} → ${to}`
    if (entry.reason) text += ` (사유: ${entry.reason})`
    return text
}

/**
 * 카테고리별 한국어 라벨
 */
export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
    activity_data: '활동 데이터',
    emission_factor: '배출계수',
    allocation: '할당',
    cut_off: '컷오프 기준',
    boundary: '시스템 경계',
    bom: 'BOM',
    multi_site: '다중 사업장',
    general: '기타'
}
