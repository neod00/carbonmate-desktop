'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePCFStore } from '@/lib/store'
import { ProGate } from '@/components/subscription/pro-gate'
import { FEATURES } from '@/lib/subscription'
import {
    CFPReportData,
    CFP_REPORT_REQUIREMENTS,
    CFP_REPORT_ADDITIONAL_REQUIREMENTS,
    REPORT_SECTIONS,
    calculateComplianceScore
} from '@/lib/report-template'
import {
    generateReportData,
    generateHTMLReport,
    generateMarkdownReport,
    generateJSONReport,
    CalculatedResults
} from '@/lib/report-generator'
import { generateAllPhase3Sections, generateComplianceChecklist } from '@/lib/report/report-phase3-sections'
import type { Phase3ReportData } from '@/lib/report/report-phase3-sections'
import { generatePFD } from '@/lib/core/pfd-generator'
import { generateDQRReport, DataInputMetadata } from '@/lib/core/auto-dqr'
import { convertToPACTFormat, validatePACTCompliance, generatePACTValidationReport } from '@/lib/report/pact-export'
import { generateWordReport } from '@/lib/report/report-docx'
import { generateCalcWorkbook } from '@/lib/core/calc-workbook'
import { storeToWorkbookData } from '@/lib/core/calc-workbook/store-adapter'
import { saveFile } from '@/lib/utils/save-file'
import {
    X,
    Download,
    FileText,
    Printer,
    CheckCircle,
    AlertCircle,
    Copy,
    ExternalLink,
    FileJson,
    FileCode,
    Globe,
    FileType
} from 'lucide-react'

interface ReportPreviewProps {
    isOpen: boolean
    onClose: () => void
    calculatedResults: CalculatedResults
}

export const ReportPreview = ({ isOpen, onClose, calculatedResults }: ReportPreviewProps) => {
    const state = usePCFStore()
    const [activeTab, setActiveTab] = useState<'checklist' | 'export'>('checklist')

    // 민감도 분석 데이터 변환 (SensitivityAnalysisResult -> SensitivityAnalysisData)
    const sensitivityData = state.sensitivityAnalysis ? {
        performed: true,
        analysisDate: state.sensitivityAnalysis.analysisDate,
        baselineCFP: state.sensitivityAnalysis.baselineCFP,
        significantFactors: state.sensitivityAnalysis.significantFactors,
        scenarios: state.sensitivityAnalysis.scenarios.map(s => ({
            name: s.name,
            type: s.type,
            baseValue: s.baseValue,
            alternativeValue: s.alternativeValue,
            percentageChange: s.percentageChange,
            isSignificant: s.isSignificant
        })),
        recommendations: state.sensitivityAnalysis.recommendations,
        isoCompliance: state.sensitivityAnalysis.isoCompliance
    } : undefined

    // 보고서 데이터 생성 (제외 기준 결과 포함)
    const reportData = generateReportData(state, calculatedResults, sensitivityData, state.cutOffResult || undefined)

    // 준수율 계산
    const compliance = calculateComplianceScore(reportData as any)

    const phase3Data: Phase3ReportData = {
        pfd: generatePFD(state.productInfo, state.activityData, state.stages, state.detailedActivityData),
        bomSummary: state.cutOffResult ? {
            totalItems: state.cutOffResult.totalItems,
            includedItems: state.cutOffResult.includedItems,
            excludedItems: state.cutOffResult.excludedItems,
            cutOffThreshold: state.cutOffCriteria.massThreshold,
            massContributionCovered: 100 - state.cutOffResult.excludedMassPercent,
            items: state.cutOffResult.items.map(item => ({
                name: item.nameKo,
                mass: item.quantity,
                contribution: item.massContribution || 0,
                included: !item.isExcluded,
                reason: item.exclusionReason
            }))
        } : undefined,
        dqrReport: (() => {
            const items: DataInputMetadata[] = [
                ...(state.detailedActivityData?.raw_materials || []).map(m => ({
                    fieldName: m.id,
                    fieldLabel: m.name,
                    sourceType: (m.dataQuality?.type === 'primary' ? 'primary_measured' : 'secondary_database') as any,
                    dataYear: m.dataQuality?.year,
                    dataCountry: m.dataQuality?.geographicScope
                })),
                ...(state.detailedActivityData?.manufacturing?.electricity || []).map(m => ({
                    fieldName: m.id,
                    fieldLabel: m.name,
                    sourceType: (m.dataQuality?.type === 'primary' ? 'primary_measured' : 'secondary_database') as any,
                    dataYear: m.dataQuality?.year,
                    dataCountry: m.dataQuality?.geographicScope
                })),
                ...(state.detailedActivityData?.transport || []).map(m => ({
                    fieldName: m.id,
                    fieldLabel: m.name,
                    sourceType: (m.dataQuality?.type === 'primary' ? 'primary_measured' : 'secondary_database') as any,
                    dataYear: m.dataQuality?.year,
                    dataCountry: m.dataQuality?.geographicScope
                }))
            ]
            if (items.length === 0) return undefined
            return generateDQRReport(items, state.productInfo.name)
        })(),
        transport: []
    }
    const phase3Html = generateAllPhase3Sections(phase3Data)

    // HTML 보고서 생성 (Phase 3 부록 포함)
    const baseHtml = generateHTMLReport(reportData)
    const htmlReport = phase3Html
        ? baseHtml.replace('</body>', `${phase3Html}</body>`)
        : baseHtml

    // 새 창에서 보고서 열기
    const handleOpenInNewWindow = () => {
        const newWindow = window.open('', '_blank')
        if (newWindow) {
            newWindow.document.write(htmlReport)
            newWindow.document.close()
            newWindow.document.title = `CFP 보고서 - ${reportData.product.name}`
        }
    }

    // 내보내기 핸들러
    const handleExport = async (format: 'html' | 'markdown' | 'json' | 'pact') => {
        let content: string
        let filename: string
        let filterName: string
        let filterExt: string

        switch (format) {
            case 'html':
                content = htmlReport
                filename = `CFP_Report_${reportData.reportId}.html`
                filterName = 'HTML 문서'
                filterExt = 'html'
                break
            case 'markdown':
                content = generateMarkdownReport(reportData)
                filename = `CFP_Report_${reportData.reportId}.md`
                filterName = 'Markdown 문서'
                filterExt = 'md'
                break
            case 'json':
                content = generateJSONReport(reportData)
                filename = `CFP_Report_${reportData.reportId}.json`
                filterName = 'JSON 문서'
                filterExt = 'json'
                break
            case 'pact': {
                const pactData = convertToPACTFormat(reportData)
                content = JSON.stringify(pactData, null, 2)
                filename = `PACT_${reportData.reportId}.json`
                filterName = 'PACT JSON'
                filterExt = 'json'
                break
            }
        }

        try {
            await saveFile(content, filename, filterName, filterExt)
        } catch (e) {
            console.error('파일 저장 실패:', e)
            alert('파일 저장에 실패했습니다.\n\n오류: ' + (e instanceof Error ? e.message : String(e)))
        }
    }

    // Word 내보내기
    const handleExportWord = async () => {
        try {
            const blob = await generateWordReport(reportData)
            await saveFile(blob, `CFP_Report_${reportData.reportId}.docx`, 'Word 문서', 'docx')
        } catch (err) {
            console.error('Word 보고서 생성 실패:', err)
            alert('Word 보고서 생성에 실패했습니다.\n\n오류: ' + (err instanceof Error ? err.message : String(err)))
        }
    }

    // 산정 워크북 내보내기 (KS I ISO 14067 검증 통과 등급, 11 시트, 살아있는 수식)
    const handleExportCalcWorkbook = async () => {
        try {
            const data = storeToWorkbookData(state)
            const result = await generateCalcWorkbook(data)
            const filename = `CFP_CalcWorkbook_${reportData.reportId}.xlsx`
            await saveFile(result.blob, filename, '산정 워크북', 'xlsx')
        } catch (err) {
            console.error('산정 워크북 생성 실패:', err)
            alert('산정 워크북 생성에 실패했습니다.\n\n오류: ' + (err instanceof Error ? err.message : String(err)))
        }
    }

    // 인쇄 핸들러 (새 창에서 인쇄)
    const handlePrint = () => {
        const printWindow = window.open('', '_blank')
        if (printWindow) {
            printWindow.document.write(htmlReport)
            printWindow.document.close()
            printWindow.focus()
            setTimeout(() => {
                printWindow.print()
            }, 500)
        }
    }

    // 클립보드 복사
    const handleCopy = async (format: 'html' | 'markdown' | 'json' | 'pact') => {
        let content: string
        switch (format) {
            case 'html':
                content = htmlReport
                break
            case 'markdown':
                content = generateMarkdownReport(reportData)
                break
            case 'json':
                content = generateJSONReport(reportData)
                break
            case 'pact': {
                const pactData = convertToPACTFormat(reportData)
                content = JSON.stringify(pactData, null, 2)
                break
            }
        }

        try {
            await navigator.clipboard.writeText(content)
            alert('클립보드에 복사되었습니다.')
        } catch (err) {
            console.error('복사 실패:', err)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">CFP 보고서</h2>
                            <p className="text-sm text-slate-500">
                                보고서 ID: {reportData.reportId}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* 준수율 배지 */}
                            <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${compliance.percentage >= 80
                                ? 'bg-green-100 text-green-700'
                                : compliance.percentage >= 50
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                ISO 14067 준수율: {compliance.percentage.toFixed(0)}%
                            </div>
                            {/* 새 창에서 보기 버튼 */}
                            <button
                                onClick={handleOpenInNewWindow}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                                <ExternalLink className="w-4 h-4" />
                                새 창에서 보기
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                    </div>

                    {/* 탭 */}
                    <div className="flex border-b border-slate-200 px-6">
                        {[
                            { id: 'checklist', label: '준수 체크리스트', icon: CheckCircle },
                            { id: 'export', label: '내보내기', icon: Download }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* 콘텐츠 */}
                    <div className="flex-1 overflow-auto">
                        {/* 체크리스트 탭 */}
                        {activeTab === 'checklist' && (
                            <div className="p-6 space-y-6">
                                {/* 요약 */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-green-50 rounded-xl">
                                        <div className="text-2xl font-bold text-green-600">
                                            {Math.round(compliance.score)}
                                        </div>
                                        <div className="text-sm text-green-700">완료된 항목</div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-xl">
                                        <div className="text-2xl font-bold text-slate-600">
                                            {compliance.total}
                                        </div>
                                        <div className="text-sm text-slate-700">총 필수 항목</div>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-xl">
                                        <div className="text-2xl font-bold text-blue-600">
                                            {compliance.percentage.toFixed(0)}%
                                        </div>
                                        <div className="text-sm text-blue-700">준수율</div>
                                    </div>
                                </div>

                                {/* 필수 항목 (7.2) */}
                                <div>
                                    <h3 className="font-semibold text-slate-900 mb-3">
                                        ISO 14067 7.2 - CFP 연구 보고서 필수 요소
                                    </h3>
                                    <div className="space-y-2">
                                        {CFP_REPORT_REQUIREMENTS.map((req) => (
                                            <div
                                                key={req.id}
                                                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                                            >
                                                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono text-slate-500">
                                                            {req.clause}
                                                        </span>
                                                        <span className="font-medium text-slate-900 text-sm">
                                                            {req.titleKo}
                                                        </span>
                                                        {req.category === 'mandatory' && (
                                                            <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                                                                필수
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-600 mt-1">
                                                        {req.descriptionKo}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 추가 항목 (7.3) */}
                                <div>
                                    <h3 className="font-semibold text-slate-900 mb-3">
                                        ISO 14067 7.3 - 추가 요구사항
                                    </h3>
                                    <div className="space-y-2">
                                        {CFP_REPORT_ADDITIONAL_REQUIREMENTS.slice(0, 6).map((req) => (
                                            <div
                                                key={req.id}
                                                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                                            >
                                                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono text-slate-500">
                                                            {req.clause}
                                                        </span>
                                                        <span className="font-medium text-slate-900 text-sm">
                                                            {req.titleKo}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 mt-1">
                                                        {req.descriptionKo}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 내보내기 탭 */}
                        {activeTab === 'export' && (
                            <ProGate feature={FEATURES.REPORT_EXPORT}>
                                <div className="p-6 space-y-6">
                                    {/* 내보내기 옵션 */}
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                        {/* HTML (요약본) */}
                                        <div className="p-6 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-colors relative">
                                            <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">요약본</span>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-blue-100 rounded-lg">
                                                    <FileCode className="w-6 h-6 text-blue-600" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900">HTML</h4>
                                                    <p className="text-xs text-slate-500">웹 브라우저용 · 요약</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => handleExport('html')}
                                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    다운로드
                                                </button>
                                                <button
                                                    onClick={() => handleCopy('html')}
                                                    className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm flex items-center justify-center gap-2"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                    복사
                                                </button>
                                            </div>
                                        </div>

                                        {/* Markdown */}
                                        <div className="p-6 border border-slate-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-colors">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-purple-100 rounded-lg">
                                                    <FileText className="w-6 h-6 text-purple-600" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900">Markdown</h4>
                                                    <p className="text-xs text-slate-500">문서 편집용</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => handleExport('markdown')}
                                                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    다운로드
                                                </button>
                                                <button
                                                    onClick={() => handleCopy('markdown')}
                                                    className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm flex items-center justify-center gap-2"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                    복사
                                                </button>
                                            </div>
                                        </div>

                                        {/* JSON */}
                                        <div className="p-6 border border-slate-200 rounded-xl hover:border-green-300 hover:bg-green-50/50 transition-colors">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-green-100 rounded-lg">
                                                    <FileJson className="w-6 h-6 text-green-600" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900">JSON</h4>
                                                    <p className="text-xs text-slate-500">데이터 교환용</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => handleExport('json')}
                                                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    다운로드
                                                </button>
                                                <button
                                                    onClick={() => handleCopy('json')}
                                                    className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm flex items-center justify-center gap-2"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                    복사
                                                </button>
                                            </div>
                                        </div>

                                        {/* PACT (공급망 표준) */}
                                        <div className="p-6 border border-slate-200 rounded-xl hover:border-orange-300 hover:bg-orange-50/50 transition-colors">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-orange-100 rounded-lg">
                                                    <Globe className="w-6 h-6 text-orange-600" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900">PACT</h4>
                                                    <p className="text-xs text-slate-500">공급망 데이터 교환 표준</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => handleExport('pact')}
                                                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    PACT JSON 다운로드
                                                </button>
                                                <button
                                                    onClick={() => handleCopy('pact')}
                                                    className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm flex items-center justify-center gap-2"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                    복사
                                                </button>
                                            </div>
                                        </div>

                                        {/* MS Word (요약본) */}
                                        <div className="p-6 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors relative">
                                            <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">요약본</span>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-indigo-100 rounded-lg">
                                                    <FileType className="w-6 h-6 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900">Word</h4>
                                                    <p className="text-xs text-slate-500">MS Word 문서 · 요약</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <button
                                                    onClick={handleExportWord}
                                                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    .docx 다운로드
                                                </button>
                                            </div>
                                        </div>

                                        {/* 산정 워크북 (KS I ISO 14067 검증 통과 등급) */}
                                        <div className="p-6 border border-emerald-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors relative">
                                            <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded-full">검증용</span>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-emerald-100 rounded-lg">
                                                    <FileType className="w-6 h-6 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900">산정 워크북</h4>
                                                    <p className="text-xs text-slate-500">11시트 · 월별 12컬럼 · 살아있는 수식</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <button
                                                    onClick={handleExportCalcWorkbook}
                                                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    .xlsx 다운로드
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 인쇄 옵션 */}
                                    <div className="p-6 bg-slate-50 rounded-xl">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-200 rounded-lg">
                                                    <Printer className="w-6 h-6 text-slate-600" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900">인쇄 / PDF 저장</h4>
                                                    <p className="text-sm text-slate-500">
                                                        브라우저 인쇄 기능으로 PDF 저장 가능
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handlePrint}
                                                className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium flex items-center gap-2"
                                            >
                                                <Printer className="w-4 h-4" />
                                                인쇄하기
                                            </button>
                                        </div>
                                    </div>

                                    {/* 안내 */}
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                            <div className="text-sm text-blue-800">
                                                <p className="font-medium mb-1">보고서 활용 안내</p>
                                                <ul className="list-disc list-inside space-y-1 text-blue-700">
                                                    <li>HTML: 웹 브라우저에서 바로 열어볼 수 있는 <strong>요약본</strong>입니다.</li>
                                                    <li>Markdown: 목차 포함 전체 보고서. GitHub, Notion 등에서 편집 가능합니다.</li>
                                                    <li>Word: 표지·목차·본문이 포함된 프로페셔널한 .docx 파일입니다.</li>
                                                    <li>JSON: 다른 시스템과 데이터 연동에 사용됩니다.</li>
                                                    <li>PACT: WBCSD Pathfinder v2.2 공급망 데이터 교환 표준 양식</li>
                                                    <li>PDF: 인쇄 버튼 → "PDF로 저장" 선택</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ProGate>
                        )}
                    </div>

                    {/* 푸터 */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                        <p className="text-xs text-slate-500">
                            ISO 14067:2018 준수 보고서 | 작성일: {reportData.reportDate}
                        </p>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
                        >
                            닫기
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence >
    )
}

