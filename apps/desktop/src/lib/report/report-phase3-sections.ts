/**
 * Phase 3 확장 보고서 섹션 생성기
 * 
 * ISO 14067:2018 Section 7.2 / 7.3 완전 준수를 위해
 * Phase 1~2에서 추가된 모듈 데이터를 HTML 보고서 섹션으로 변환
 * 
 * 포함 섹션:
 * - 운송 (P6: transport-modeling)
 * - Proxy 데이터 (P5: proxy-db)
 * - 데이터 품질 DQR (P8: auto-dqr)
 * - BOM Cut-off (P2: bom-manager)
 * - 감사 추적 (P4: audit-trail)
 * - 공정 흐름도 PFD (P9: pfd-generator)
 * - 다중 사업장 (P3: multi-site)
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-14
 */

import type { RouteEmissionResult } from '../core/transport-modeling'
import type { ProxySearchResult } from '../core/proxy-db'
import type { DQRReport } from '../core/auto-dqr'
import type { PFDGraph } from '../core/pfd-generator'

// =============================================================================
// 타입 정의
// =============================================================================

export interface Phase3ReportData {
    transport?: RouteEmissionResult[]
    proxyFactors?: ProxySearchResult[]
    dqrReport?: DQRReport
    bomSummary?: BOMReportData
    auditTrail?: AuditReportData
    pfd?: PFDGraph
    multiSite?: MultiSiteReportData
}

export interface BOMReportData {
    totalItems: number
    includedItems: number
    excludedItems: number
    cutOffThreshold: number          // %
    massContributionCovered: number  // % (포함된 항목의 질량 기여도)
    items: { name: string; mass: number; contribution: number; included: boolean; reason?: string }[]
}

export interface AuditReportData {
    totalEntries: number
    dateRange: { from: string; to: string }
    changesByField: { field: string; count: number }[]
    recentEntries: { date: string; field: string; oldValue: string; newValue: string; reason: string }[]
}

export interface MultiSiteReportData {
    sites: { name: string; country: string; production: number; cfp: number }[]
    weightedAverage: number
    unit: string
}

// =============================================================================
// HTML 공통 스타일
// =============================================================================

const TABLE_STYLE = `
    border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 0.9em;
`
const TH_STYLE = `
    background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 12px;
    text-align: left; font-weight: 600; color: #334155;
`
const TD_STYLE = `
    border: 1px solid #e2e8f0; padding: 8px 12px; color: #475569;
`
const SECTION_TITLE_STYLE = `
    font-size: 1.2em; font-weight: 700; color: #1e293b;
    border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin: 32px 0 16px;
`
const NOTE_STYLE = `
    background: #fef3c7; border-left: 4px solid #f59e0b;
    padding: 12px 16px; margin: 12px 0; font-size: 0.85em; color: #92400e;
`

// =============================================================================
// 섹션 생성 함수
// =============================================================================

/**
 * 운송 배출 섹션 (ISO 14067 7.2(e) 항공 분리)
 */
export const generateTransportSection = (routes: RouteEmissionResult[]): string => {
    if (!routes || routes.length === 0) return ''

    let html = `<div class="report-section transport-section">
        <h3 style="${SECTION_TITLE_STYLE}">📦 운송 배출 상세 (Transport Emissions)</h3>
        <p style="margin-bottom:12px;color:#64748b;">ISO 14067:2018 6.3.4 — 운송은 모든 관련 생애주기 단계에서 고려</p>`

    routes.forEach(route => {
        html += `<h4 style="font-weight:600;margin:20px 0 8px;">${route.routeName}</h4>
        <table style="${TABLE_STYLE}">
            <thead>
                <tr>
                    <th style="${TH_STYLE}">#</th>
                    <th style="${TH_STYLE}">구간</th>
                    <th style="${TH_STYLE}">운송 수단</th>
                    <th style="${TH_STYLE}">거리 (km)</th>
                    <th style="${TH_STYLE}">배출계수</th>
                    <th style="${TH_STYLE}">배출량 (kgCO₂e)</th>
                    <th style="${TH_STYLE}">비중 (%)</th>
                </tr>
            </thead>
            <tbody>`

        route.legs.forEach(leg => {
            html += `<tr>
                <td style="${TD_STYLE}">${leg.legNumber}</td>
                <td style="${TD_STYLE}">${leg.origin} → ${leg.destination}</td>
                <td style="${TD_STYLE}">${leg.modeLabel}</td>
                <td style="${TD_STYLE}">${leg.distanceKm.toLocaleString()}</td>
                <td style="${TD_STYLE}">${leg.emissionFactor} kgCO₂e/tkm</td>
                <td style="${TD_STYLE}"><strong>${leg.emission.toFixed(2)}</strong></td>
                <td style="${TD_STYLE}">${leg.share.toFixed(1)}%</td>
            </tr>`
        })

        html += `</tbody>
            <tfoot>
                <tr>
                    <td colspan="3" style="${TD_STYLE};font-weight:700;">합계</td>
                    <td style="${TD_STYLE}">${route.totalDistanceKm.toLocaleString()}</td>
                    <td style="${TD_STYLE}">—</td>
                    <td style="${TD_STYLE};font-weight:700;">${route.totalEmission.toFixed(2)}</td>
                    <td style="${TD_STYLE}">100%</td>
                </tr>
            </tfoot>
        </table>`

        if (route.isAirIncluded) {
            html += `<div style="${NOTE_STYLE}">
                ⚠️ <strong>ISO 14067 7.2(e) 항공 운송 분리 보고:</strong>
                항공 배출량 = ${route.airEmission.toFixed(2)} kgCO₂e
                | 비항공 배출량 = ${route.nonAirEmission.toFixed(2)} kgCO₂e
            </div>`
        }
    })

    html += `</div>`
    return html
}

/**
 * Proxy 배출계수 섹션
 */
export const generateProxyDataSection = (proxies: ProxySearchResult[]): string => {
    if (!proxies || proxies.length === 0) return ''

    let html = `<div class="report-section proxy-section">
        <h3 style="${SECTION_TITLE_STYLE}">🔄 Proxy 배출계수 사용 현황</h3>
        <p style="margin-bottom:12px;color:#64748b;">2차 데이터(Proxy) 사용 시 출처 및 보정 정보 투명 공개 (ISO 14067 6.3.5)</p>
        <table style="${TABLE_STYLE}">
            <thead>
                <tr>
                    <th style="${TH_STYLE}">원자재</th>
                    <th style="${TH_STYLE}">Proxy 명칭</th>
                    <th style="${TH_STYLE}">배출계수</th>
                    <th style="${TH_STYLE}">출처</th>
                    <th style="${TH_STYLE}">품질</th>
                    <th style="${TH_STYLE}">유사도</th>
                </tr>
            </thead>
            <tbody>`

    proxies.forEach(p => {
        const factor = p.proxy
        html += `<tr>
            <td style="${TD_STYLE}">${factor.nameKo}</td>
            <td style="${TD_STYLE}">${factor.name}</td>
            <td style="${TD_STYLE}">${factor.value} ${factor.unit}</td>
            <td style="${TD_STYLE}">${factor.source} (${factor.year})</td>
            <td style="${TD_STYLE}">${factor.quality}</td>
            <td style="${TD_STYLE}">${p.matchScore.toFixed(0)}%</td>
        </tr>`
    })

    html += `</tbody></table></div>`
    return html
}

/**
 * DQR 보고서 섹션 (ISO 14067 6.3.5)
 */
export const generateDQRSection = (report: DQRReport): string => {
    let html = `<div class="report-section dqr-section">
        <h3 style="${SECTION_TITLE_STYLE}">📊 데이터 품질 평가 (DQR — ISO 14067 6.3.5)</h3>
        <p style="margin-bottom:12px;color:#64748b;">
            평가 일시: ${new Date(report.assessmentDate).toLocaleDateString('ko-KR')}
            | 항목 수: ${report.totalItems}
            | 종합 DQI: <strong>${report.averageDQI.toFixed(2)}</strong>
        </p>

        <table style="${TABLE_STYLE}">
            <thead>
                <tr>
                    <th style="${TH_STYLE}">항목</th>
                    <th style="${TH_STYLE}">신뢰성</th>
                    <th style="${TH_STYLE}">완전성</th>
                    <th style="${TH_STYLE}">시간</th>
                    <th style="${TH_STYLE}">지리</th>
                    <th style="${TH_STYLE}">기술</th>
                    <th style="${TH_STYLE}">DQI</th>
                    <th style="${TH_STYLE}">수준</th>
                </tr>
            </thead>
            <tbody>`

    report.itemResults.forEach(item => {
        const dqiColor = item.dqi <= 2.0 ? '#22c55e' : item.dqi <= 3.0 ? '#f59e0b' : '#ef4444'
        html += `<tr>
            <td style="${TD_STYLE}">${item.fieldLabel}</td>
            <td style="${TD_STYLE};text-align:center;">${item.indicators.reliability}</td>
            <td style="${TD_STYLE};text-align:center;">${item.indicators.completeness}</td>
            <td style="${TD_STYLE};text-align:center;">${item.indicators.temporalCorrelation}</td>
            <td style="${TD_STYLE};text-align:center;">${item.indicators.geographicalCorrelation}</td>
            <td style="${TD_STYLE};text-align:center;">${item.indicators.technologicalCorrelation}</td>
            <td style="${TD_STYLE};text-align:center;"><strong style="color:${dqiColor}">${item.dqi.toFixed(2)}</strong></td>
            <td style="${TD_STYLE}">${item.levelLabel}</td>
        </tr>`
    })

    html += `</tbody></table>`

    // ISO 준수 체크리스트
    html += `<h4 style="font-weight:600;margin:20px 0 8px;">ISO 준수 확인</h4>
        <table style="${TABLE_STYLE}">
            <thead><tr>
                <th style="${TH_STYLE}">조항</th>
                <th style="${TH_STYLE}">충족</th>
                <th style="${TH_STYLE}">비고</th>
            </tr></thead>
            <tbody>`

    report.isoCompliance.forEach(c => {
        html += `<tr>
            <td style="${TD_STYLE}">${c.clause}</td>
            <td style="${TD_STYLE};text-align:center;">${c.satisfied ? '✅' : '❌'}</td>
            <td style="${TD_STYLE}">${c.notes}</td>
        </tr>`
    })

    html += `</tbody></table>`

    // 개선 제안
    if (report.improvements.length > 0) {
        html += `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;margin:12px 0;">
            <strong>💡 개선 제안:</strong><ul style="margin:8px 0 0 20px;">`
        report.improvements.forEach(imp => {
            html += `<li>${imp}</li>`
        })
        html += `</ul></div>`
    }

    html += `</div>`
    return html
}

/**
 * BOM Cut-off 섹션 (ISO 14044 4.2.3.3.2)
 */
export const generateBOMSection = (bom: BOMReportData): string => {
    let html = `<div class="report-section bom-section">
        <h3 style="${SECTION_TITLE_STYLE}">📋 원재료 투입 (BOM) 및 Cut-off 분석</h3>
        <p style="margin-bottom:12px;color:#64748b;">
            ISO 14044:2006 4.2.3.3.2 — Cut-off 기준: 질량 기준 ${bom.cutOffThreshold}% 미만 제외
            | 포함 ${bom.includedItems}/${bom.totalItems}개 항목 (질량 기여 ${bom.massContributionCovered.toFixed(1)}%)
        </p>
        <table style="${TABLE_STYLE}">
            <thead><tr>
                <th style="${TH_STYLE}">원자재</th>
                <th style="${TH_STYLE}">질량 (kg)</th>
                <th style="${TH_STYLE}">질량 기여 (%)</th>
                <th style="${TH_STYLE}">포함 여부</th>
                <th style="${TH_STYLE}">비고</th>
            </tr></thead>
            <tbody>`

    bom.items.forEach(item => {
        const rowStyle = item.included ? '' : 'opacity:0.6;'
        html += `<tr style="${rowStyle}">
            <td style="${TD_STYLE}">${item.name}</td>
            <td style="${TD_STYLE}">${item.mass.toFixed(2)}</td>
            <td style="${TD_STYLE}">${item.contribution.toFixed(2)}%</td>
            <td style="${TD_STYLE};text-align:center;">${item.included ? '✅' : '❌'}</td>
            <td style="${TD_STYLE}">${item.reason || ''}</td>
        </tr>`
    })

    html += `</tbody></table></div>`
    return html
}

/**
 * 감사 추적 섹션 (ISO 14067 검증 대응)
 */
export const generateAuditTrailSection = (audit: AuditReportData): string => {
    let html = `<div class="report-section audit-section">
        <h3 style="${SECTION_TITLE_STYLE}">📝 데이터 변경 이력 (Audit Trail)</h3>
        <p style="margin-bottom:12px;color:#64748b;">
            총 ${audit.totalEntries}건의 변경 기록 (${audit.dateRange.from} ~ ${audit.dateRange.to})
        </p>
        <table style="${TABLE_STYLE}">
            <thead><tr>
                <th style="${TH_STYLE}">일시</th>
                <th style="${TH_STYLE}">항목</th>
                <th style="${TH_STYLE}">이전 값</th>
                <th style="${TH_STYLE}">변경 값</th>
                <th style="${TH_STYLE}">사유</th>
            </tr></thead>
            <tbody>`

    audit.recentEntries.slice(0, 20).forEach(entry => {
        html += `<tr>
            <td style="${TD_STYLE}">${entry.date}</td>
            <td style="${TD_STYLE}">${entry.field}</td>
            <td style="${TD_STYLE}">${entry.oldValue}</td>
            <td style="${TD_STYLE}"><strong>${entry.newValue}</strong></td>
            <td style="${TD_STYLE}">${entry.reason}</td>
        </tr>`
    })

    html += `</tbody></table>`

    if (audit.totalEntries > 20) {
        html += `<p style="color:#64748b;font-size:0.85em;">* 최근 20건만 표시. 전체 목록은 별도 파일 참조.</p>`
    }

    html += `</div>`
    return html
}

/**
 * PFD 섹션 (ISO 14067 7.3 d)
 */
export const generatePFDSection = (pfd: PFDGraph): string => {
    let html = `<div class="report-section pfd-section">
        <h3 style="${SECTION_TITLE_STYLE}">🔀 공정 흐름도 (Process Flow Diagram)</h3>
        <p style="margin-bottom:12px;color:#64748b;">
            ISO 14067:2018 7.3 d) — 제품 시스템에 포함된 단위 공정 목록 및 연결
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:12px 0;">
            <p><strong>시스템 경계:</strong> ${pfd.boundary}</p>
            <p><strong>제품:</strong> ${pfd.productName} (${pfd.functionalUnit})</p>
            <p><strong>투입:</strong> ${pfd.totalInputs}개 | <strong>산출:</strong> ${pfd.totalOutputs}개 | <strong>배출:</strong> ${pfd.totalEmissions}개</p>
        </div>
        
        <h4 style="font-weight:600;margin:20px 0 8px;">단계별 포함 공정</h4>
        <table style="${TABLE_STYLE}">
            <thead><tr>
                <th style="${TH_STYLE}">단계</th>
                <th style="${TH_STYLE}">포함 노드 수</th>
            </tr></thead>
            <tbody>`

    pfd.stageGroups.forEach(sg => {
        html += `<tr>
            <td style="${TD_STYLE}">${sg.stageKo}</td>
            <td style="${TD_STYLE}">${sg.nodeIds.length}</td>
        </tr>`
    })

    html += `</tbody></table>

        <h4 style="font-weight:600;margin:20px 0 8px;">PFD Mermaid 코드 (렌더링용)</h4>
        <pre style="background:#1e293b;color:#e2e8f0;padding:16px;border-radius:8px;font-size:0.8em;overflow-x:auto;white-space:pre-wrap;">${escapeHtml(pfd.mermaidCode)}</pre>
    </div>`

    return html
}

/**
 * 다중 사업장 섹션
 */
export const generateMultiSiteSection = (data: MultiSiteReportData): string => {
    let html = `<div class="report-section multisite-section">
        <h3 style="${SECTION_TITLE_STYLE}">🏭 다중 사업장 가중 평균</h3>
        <p style="margin-bottom:12px;color:#64748b;">
            CFP = Σ(CFPᵢ × Pᵢ) / ΣPᵢ = <strong>${data.weightedAverage.toFixed(4)} ${data.unit}</strong>
        </p>
        <table style="${TABLE_STYLE}">
            <thead><tr>
                <th style="${TH_STYLE}">사업장</th>
                <th style="${TH_STYLE}">국가</th>
                <th style="${TH_STYLE}">생산량</th>
                <th style="${TH_STYLE}">CFP (${data.unit})</th>
            </tr></thead>
            <tbody>`

    data.sites.forEach(site => {
        html += `<tr>
            <td style="${TD_STYLE}">${site.name}</td>
            <td style="${TD_STYLE}">${site.country}</td>
            <td style="${TD_STYLE}">${site.production.toLocaleString()}</td>
            <td style="${TD_STYLE}">${site.cfp.toFixed(4)}</td>
        </tr>`
    })

    html += `</tbody>
        <tfoot><tr>
            <td colspan="2" style="${TD_STYLE};font-weight:700;">가중 평균</td>
            <td style="${TD_STYLE}">${data.sites.reduce((s, si) => s + si.production, 0).toLocaleString()}</td>
            <td style="${TD_STYLE};font-weight:700;">${data.weightedAverage.toFixed(4)}</td>
        </tr></tfoot>
    </table></div>`

    return html
}

/**
 * 전체 Phase 3 섹션 통합 생성
 */
export const generateAllPhase3Sections = (data: Phase3ReportData): string => {
    let html = ''

    html += `<div style="page-break-before:always;"></div>
        <h2 style="font-size:1.5em;font-weight:700;color:#0f172a;margin:24px 0 16px;border-bottom:3px solid #1e293b;padding-bottom:8px;">
            부록: 확장 분석 결과
        </h2>`

    if (data.pfd) html += generatePFDSection(data.pfd)
    if (data.bomSummary) html += generateBOMSection(data.bomSummary)
    if (data.transport && data.transport.length > 0) html += generateTransportSection(data.transport)
    if (data.proxyFactors && data.proxyFactors.length > 0) html += generateProxyDataSection(data.proxyFactors)
    if (data.dqrReport) html += generateDQRSection(data.dqrReport)
    if (data.multiSite) html += generateMultiSiteSection(data.multiSite)
    if (data.auditTrail) html += generateAuditTrailSection(data.auditTrail)

    return html
}

// =============================================================================
// ISO 7.2 / 7.3 준수율 체크리스트
// =============================================================================

export interface ComplianceCheckItem {
    clause: string
    requirement: string
    requirementKo: string
    satisfied: boolean
    evidence?: string
}

export const generateComplianceChecklist = (data: Phase3ReportData): ComplianceCheckItem[] => {
    return [
        {
            clause: '7.2 a)', requirement: 'System boundary description',
            requirementKo: '시스템 경계 설명',
            satisfied: !!data.pfd,
            evidence: data.pfd ? `PFD: ${data.pfd.boundary}` : undefined
        },
        {
            clause: '7.2 e)', requirement: 'Aircraft GHG separate reporting',
            requirementKo: '항공 GHG 분리 보고',
            satisfied: !data.transport?.some(r => r.isAirIncluded) ||
                data.transport?.every(r => r.airEmission !== undefined) || false,
            evidence: data.transport?.find(r => r.isAirIncluded)
                ? `항공: ${data.transport.find(r => r.isAirIncluded)?.airEmission.toFixed(2)} kgCO₂e`
                : '항공 운송 없음'
        },
        {
            clause: '7.2 j)', requirement: 'Data quality assessment',
            requirementKo: '데이터 품질 평가',
            satisfied: !!data.dqrReport,
            evidence: data.dqrReport
                ? `DQI 평균: ${data.dqrReport.averageDQI.toFixed(2)}`
                : undefined
        },
        {
            clause: '7.3 d)', requirement: 'List of unit processes',
            requirementKo: '단위 공정 목록',
            satisfied: !!data.pfd && data.pfd.nodes.length > 0,
            evidence: data.pfd ? `${data.pfd.nodes.filter(n => n.type === 'process').length}개 공정` : undefined
        },
        {
            clause: '7.3 e)', requirement: 'Data sources and emission factors',
            requirementKo: '데이터 출처 및 배출계수',
            satisfied: (data.proxyFactors?.length || 0) > 0 || !!data.dqrReport
        },
        {
            clause: 'ISO 14044 4.2.3.3.2', requirement: 'Cut-off criteria',
            requirementKo: '컷오프 기준',
            satisfied: !!data.bomSummary,
            evidence: data.bomSummary
                ? `${data.bomSummary.massContributionCovered.toFixed(1)}% 질량 커버`
                : undefined
        }
    ]
}

// =============================================================================
// 유틸리티
// =============================================================================

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
