"use client"

import { useState, useEffect, useMemo } from "react"
import { usePCFStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle, Info, FileText, Leaf, Flame, Plane, TrendingDown, Shield, CheckCircle2, Scale, Recycle, FileDown, Scissors, Check, X, GitBranch, Copy } from "lucide-react"
import { ReportPreview } from "../report-preview"
import { handleExternalClick } from "@/lib/utils/external-link"
import {
    LIMITATION_SINGLE_IMPACT,
    METHODOLOGY_LIMITATIONS,
    getApplicableLimitations,
    EMISSION_FACTOR_SOURCES,
    GHG_LIST
} from "@/lib/iso14067-constants"
import {
    DQI_LEVEL_LABELS,
    DataQualityLevel
} from "@/lib/data-quality"
import {
    calculateStageEmission,
    calculateTotalEmissions,
    type StageEmissionResult,
    type CalculationInput
} from "@/lib/core/emission-calculator"
import {
    MULTI_OUTPUT_ALLOCATION_METHODS,
    RECYCLING_ALLOCATION_METHODS
} from "@/lib/allocation"
import {
    applyCutOffCriteria,
    validateCutOffCriteria,
    generateCutOffSummary,
    CutOffResult
} from "@/lib/cut-off-criteria"
import { generatePFD } from "@/lib/core/pfd-generator"

// =============================================================================
// 단계별 라벨
// =============================================================================

const STAGE_LABELS: Record<string, string> = {
    raw_materials: '원료 채취 (Raw Materials)',
    manufacturing: '제조 (Manufacturing)',
    transport: '운송 (Transport)',
    packaging: '포장 (Packaging)',
    use: '사용 (Use Phase)',
    eol: '폐기 (End-of-Life)'
}

// =============================================================================
// 메인 컴포넌트
// =============================================================================

export function ResultsStep() {
    const {
        productInfo,
        stages,
        activityData,
        detailedActivityData,
        dataQualityMeta,
        multiOutputAllocation,
        recyclingAllocation,
        cutOffCriteria,
        setCutOffResult
    } = usePCFStore()

    // 보고서 미리보기 상태
    const [showReportPreview, setShowReportPreview] = useState(false)

    // PFD 다이어그램 상태
    const [showPFD, setShowPFD] = useState(false)
    const [pfdCode, setPfdCode] = useState<string | null>(null)
    const [pfdCopied, setPfdCopied] = useState(false)

    // =========================================================================
    // 배출량 계산 — 공유 모듈 사용 (ISO 14067 6.4, 6.5 준수)
    // =========================================================================

    const calcInput: CalculationInput = {
        activityData,
        detailedActivityData,
        recyclingAllocation
    }

    // P1-1: calculateTotalEmissions에 할당 정보 전달하여 통합 계산
    const totalResult = useMemo(() => {
        return calculateTotalEmissions(stages, calcInput, multiOutputAllocation)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stages, activityData, detailedActivityData, recyclingAllocation, multiOutputAllocation])

    // 개별 변수로 디스트럭처링 (기존 코드 호환)
    const { stageResults, totalEmission, totalFossil, totalBiogenic, totalAircraft, avgUncertainty, allocation: allocationInfo } = totalResult

    // P1-1: 할당 적용 시 표시할 최종 CFP 값
    const displayCFP = allocationInfo?.applied ? allocationInfo.allocatedTotal : totalEmission
    const displayFossil = allocationInfo?.applied ? allocationInfo.allocatedFossil : totalFossil
    const displayBiogenic = allocationInfo?.applied ? allocationInfo.allocatedBiogenic : totalBiogenic
    const displayAircraft = allocationInfo?.applied ? allocationInfo.allocatedAircraft : totalAircraft

    // 적용 가능한 제한사항 가져오기
    const applicableLimitations = getApplicableLimitations(
        productInfo.boundary,
        stages,
        'secondary'
    )

    // 제외 기준 적용 (ISO 14067 6.3.4.3)
    const cutOffResult = useMemo(() => {
        return applyCutOffCriteria(activityData, cutOffCriteria, stages)
    }, [activityData, cutOffCriteria, stages])

    // 제외 기준 검증
    const cutOffValidation = useMemo(() => {
        return validateCutOffCriteria(cutOffResult)
    }, [cutOffResult])

    // 제외 기준 결과를 스토어에 저장
    useEffect(() => {
        setCutOffResult(cutOffResult)
    }, [cutOffResult, setCutOffResult])

    // =========================================================================
    // 렌더링
    // =========================================================================

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* 헤더 */}
            <div className="text-center space-y-2 px-2">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold">CFP 계산 결과</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                    제품: <span className="font-semibold text-foreground">
                        {productInfo.name || '미지정 제품'}
                    </span> | 기능단위: {productInfo.unit}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                    시스템 경계: {productInfo.boundary.replace(/-/g, ' → ').replace('to', '')}
                </p>
            </div>

            {/* 메인 결과 카드 */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                {/* 총 탄소발자국 */}
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="px-4 sm:px-6">
                        <CardTitle className="text-center text-primary text-base sm:text-lg">
                            총 탄소발자국 (CFP)
                        </CardTitle>
                        <CardDescription className="text-center text-xs sm:text-sm">
                            ISO 14067:2018 기준
                            {allocationInfo?.applied && (
                                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    할당 적용: {allocationInfo.methodLabel} ({(allocationInfo.mainProductShare * 100).toFixed(1)}%)
                                </span>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center px-4 sm:px-6 pb-4 sm:pb-6">
                        <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
                            {displayCFP.toFixed(2)}
                            <span className="text-sm sm:text-base md:text-lg font-normal text-muted-foreground ml-1 sm:ml-2">
                                kg CO₂e
                            </span>
                        </div>
                        <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
                            per {productInfo.unit}
                        </p>
                        {/* P1-1: 할당 전/후 비교 표시 */}
                        {allocationInfo?.applied && (
                            <div className="mt-3 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
                                <div className="flex items-center justify-center gap-3 text-xs">
                                    <div className="text-muted-foreground">
                                        <span className="block text-[10px]">할당 전</span>
                                        <span className="font-mono line-through">{totalEmission.toFixed(2)}</span>
                                    </div>
                                    <span className="text-blue-500">→</span>
                                    <div className="text-blue-600 dark:text-blue-400 font-semibold">
                                        <span className="block text-[10px]">할당 후</span>
                                        <span className="font-mono">{allocationInfo.allocatedTotal.toFixed(2)}</span>
                                    </div>
                                    <span className="text-green-600 dark:text-green-400 text-[10px]">
                                        (-{allocationInfo.coProductsReduction.toFixed(2)} 부산물 배분)
                                    </span>
                                </div>
                            </div>
                        )}
                        <div className="mt-3 sm:mt-4 text-[10px] sm:text-xs text-muted-foreground">
                            불확실성 범위: ±{avgUncertainty.toFixed(0)}%
                            <br />
                            ({(displayCFP * (1 - avgUncertainty / 100)).toFixed(2)} ~ {(displayCFP * (1 + avgUncertainty / 100)).toFixed(2)} kg CO₂e)
                        </div>
                    </CardContent>
                </Card>

                {/* 단계별 분해 */}
                <Card>
                    <CardHeader className="px-4 sm:px-6">
                        <CardTitle className="text-base sm:text-lg">단계별 배출량</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">ISO 14067 7.2 (a) 준수</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 sm:px-6">
                        <div className="space-y-2 sm:space-y-3">
                            {stages.map(stage => {
                                const result = stageResults[stage]
                                const percentage = totalEmission > 0
                                    ? (result.total / totalEmission) * 100
                                    : 0

                                return (
                                    <div key={stage} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs sm:text-sm">
                                            <span className="truncate pr-2">{STAGE_LABELS[stage] || stage}</span>
                                            <span className="font-mono flex-shrink-0">
                                                {result.total.toFixed(2)} ({percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-secondary/20 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${result.total < 0 ? 'bg-green-500' : 'bg-primary'}`}
                                                style={{ width: `${Math.abs(percentage)}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ISO 14067 7.2 (b)(c)(e) - 화석/생물기원/항공 GHG 분리 */}
            <Card>
                <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                        GHG 배출원 분류
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">ISO 14067 7.2 (b)(c)(e) - 필수 분리 기록</CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
                        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                            <Flame className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-muted-foreground">화석 GHG 배출</p>
                                <p className="text-xl sm:text-2xl font-bold">{displayFossil.toFixed(2)}</p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">kg CO₂e</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                            <Leaf className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-muted-foreground">생물기원 GHG 배출</p>
                                <p className="text-xl sm:text-2xl font-bold">{displayBiogenic.toFixed(2)}</p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">kg CO₂e</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Plane className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-muted-foreground">항공 운송 GHG</p>
                                <p className="text-xl sm:text-2xl font-bold">{displayAircraft.toFixed(2)}</p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">kg CO₂e</p>
                            </div>
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">
                        * dLUC(직접 토지이용변화) 및 iLUC(간접 토지이용변화) 배출은 현재 버전에서 미지원
                    </p>
                </CardContent>
            </Card>

            {/* P1-3: GHG 개별 분해 상세 (ISO 14067 7.3 e) */}
            {totalResult.ghgBreakdown && Object.keys(totalResult.ghgBreakdown).length > 0 && (
                <Card className="border-purple-500/20">
                    <CardHeader className="px-4 sm:px-6">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <GitBranch className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                            온실가스별 상세 분해
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">ISO 14067 7.3 e — 고려된 온실가스별 배출량</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 sm:px-6">
                        <div className="space-y-2">
                            {Object.entries(totalResult.ghgBreakdown)
                                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                                .filter(([, val]) => Math.abs(val) > 0.000001)
                                .map(([ghgKey, value]) => {
                                    const pct = displayCFP > 0 ? (value / displayCFP) * 100 : 0
                                    const label = ghgKey
                                        .replace('co2_fossil', 'CO₂ (화석)')
                                        .replace('co2_biogenic', 'CO₂ (생물기원)')
                                        .replace('ch4', 'CH₄')
                                        .replace('n2o', 'N₂O')
                                        .replace('hfcs', 'HFCs')
                                        .replace('other', '기타 GHG')
                                    const barColor = ghgKey.includes('fossil') ? 'bg-orange-500'
                                        : ghgKey.includes('biogenic') ? 'bg-green-500'
                                            : ghgKey === 'ch4' ? 'bg-yellow-500'
                                                : ghgKey === 'n2o' ? 'bg-red-500'
                                                    : 'bg-gray-500'

                                    return (
                                        <div key={ghgKey} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs sm:text-sm">
                                                <span className="font-medium">{label}</span>
                                                <span className="font-mono flex-shrink-0">
                                                    {value.toFixed(4)} kg CO₂e ({pct.toFixed(1)}%)
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-secondary/20 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all ${barColor}`}
                                                    style={{ width: `${Math.min(Math.abs(pct), 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })
                            }
                        </div>
                        <p className="mt-3 text-[10px] sm:text-xs text-muted-foreground">
                            * GHG 분해는 배출 기원별 대표 비율 기반으로 산정 (화석: CO₂ 95%, CH₄ 3%, N₂O 2%)
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Cut-off 기준 적용 결과 (ISO 14067 6.3.4.3) */}
            <Card className={cutOffCriteria.enabled ? 'border-orange-500/30' : ''}>
                <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Scissors className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                        Cut-off 기준 적용 결과
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                        ISO 14067 6.3.4.3 - 제외 기준 및 적용 내역
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                    {!cutOffCriteria.enabled ? (
                        <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                            <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    제외 기준이 적용되지 않았습니다. 모든 물질 및 에너지 흐름이 계산에 포함되었습니다.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* 제외 기준 요약 */}
                            <div className="grid gap-3 sm:gap-4 md:grid-cols-4">
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <p className="text-xs text-muted-foreground">전체 항목</p>
                                    <p className="text-xl font-bold">{cutOffResult.totalItems}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                    <p className="text-xs text-muted-foreground">포함 항목</p>
                                    <p className="text-xl font-bold text-green-500">{cutOffResult.includedItems}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                    <p className="text-xs text-muted-foreground">제외 항목</p>
                                    <p className="text-xl font-bold text-orange-500">{cutOffResult.excludedItems}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <p className="text-xs text-muted-foreground">제외 배출량</p>
                                    <p className="text-xl font-bold">{cutOffResult.excludedEmissionPercent.toFixed(2)}%</p>
                                </div>
                            </div>

                            {/* 적용된 기준 */}
                            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                <p className="text-xs font-medium text-orange-400 mb-2">적용된 제외 기준</p>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="px-2 py-1 rounded bg-background/50">
                                        질량 {'<'} {cutOffCriteria.massThreshold}%
                                    </span>
                                    <span className="px-2 py-1 rounded bg-background/50">
                                        에너지 {'<'} {cutOffCriteria.energyThreshold}%
                                    </span>
                                    <span className="px-2 py-1 rounded bg-background/50">
                                        환경영향 {'<'} {cutOffCriteria.environmentalThreshold}%
                                    </span>
                                </div>
                            </div>

                            {/* 제외된 항목 목록 */}
                            {cutOffResult.excludedItemsList.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">제외된 항목 목록</p>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-border/50">
                                                    <th className="text-left py-2 px-2">항목</th>
                                                    <th className="text-left py-2 px-2">단계</th>
                                                    <th className="text-right py-2 px-2">수량</th>
                                                    <th className="text-right py-2 px-2">배출량</th>
                                                    <th className="text-right py-2 px-2">기여도</th>
                                                    <th className="text-left py-2 px-2">제외 사유</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {cutOffResult.excludedItemsList.map((item, idx) => (
                                                    <tr key={idx} className="border-b border-border/30">
                                                        <td className="py-2 px-2">{item.nameKo}</td>
                                                        <td className="py-2 px-2">{item.stageKo}</td>
                                                        <td className="text-right py-2 px-2 font-mono">
                                                            {item.quantity.toFixed(2)} {item.unit}
                                                        </td>
                                                        <td className="text-right py-2 px-2 font-mono">
                                                            {item.emission.toFixed(4)} kg CO₂e
                                                        </td>
                                                        <td className="text-right py-2 px-2 font-mono">
                                                            {item.emissionContribution.toFixed(2)}%
                                                        </td>
                                                        <td className="py-2 px-2 text-muted-foreground">
                                                            {item.exclusionReason}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ISO 준수 현황 */}
                            <div className="space-y-2">
                                <p className="text-sm font-medium">ISO 14067 준수 현황</p>
                                <div className="space-y-1">
                                    {cutOffResult.isoCompliance.map((compliance, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-start gap-2 p-2 rounded text-xs ${compliance.satisfied
                                                ? 'bg-green-500/10 border border-green-500/20'
                                                : 'bg-red-500/10 border border-red-500/20'
                                                }`}
                                        >
                                            {compliance.satisfied ? (
                                                <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <X className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div>
                                                <p className="font-medium">{compliance.clause}</p>
                                                <p className="text-muted-foreground">{compliance.requirement}</p>
                                                <p className={compliance.satisfied ? 'text-green-400' : 'text-red-400'}>
                                                    {compliance.notes}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 검증 결과 경고 */}
                            {!cutOffValidation.isValid && (
                                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                                        <div className="text-xs">
                                            <p className="font-medium text-yellow-400 mb-1">제외 기준 검증 경고</p>
                                            <ul className="space-y-0.5 text-yellow-300">
                                                {cutOffValidation.warnings.map((warning, idx) => (
                                                    <li key={idx}>• {warning}</li>
                                                ))}
                                            </ul>
                                            {cutOffValidation.recommendations.length > 0 && (
                                                <>
                                                    <p className="font-medium text-yellow-400 mt-2 mb-1">권장사항</p>
                                                    <ul className="space-y-0.5 text-yellow-300">
                                                        {cutOffValidation.recommendations.map((rec, idx) => (
                                                            <li key={idx}>• {rec}</li>
                                                        ))}
                                                    </ul>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 데이터 품질 요약 (ISO 14067 6.3.5) */}
            <Card>
                <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                        데이터 품질 요약
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">ISO 14067 6.3.5 - 데이터 품질 평가 결과</CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
                        <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
                            <p className="text-xs sm:text-sm text-muted-foreground">데이터 유형</p>
                            <p className="text-base sm:text-lg font-bold mt-1">
                                {dataQualityMeta.overallType === 'primary' ? '1차 데이터' :
                                    dataQualityMeta.overallType === 'secondary' ? '2차 데이터' : '추정'}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                {dataQualityMeta.overallType === 'primary'
                                    ? '현장 특정 데이터'
                                    : '데이터베이스 기반'}
                            </p>
                        </div>
                        <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
                            <p className="text-xs sm:text-sm text-muted-foreground">불확실성 범위</p>
                            <p className="text-base sm:text-lg font-bold mt-1">±{avgUncertainty.toFixed(0)}%</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                {(totalEmission * (1 - avgUncertainty / 100)).toFixed(1)} ~ {(totalEmission * (1 + avgUncertainty / 100)).toFixed(1)} kg CO₂e
                            </p>
                        </div>
                        <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
                            <p className="text-xs sm:text-sm text-muted-foreground">기준 연도</p>
                            <p className="text-base sm:text-lg font-bold mt-1">{dataQualityMeta.baseYear}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">배출계수 기준</p>
                        </div>
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-muted-foreground">
                                <span className="font-medium text-blue-400">데이터 출처: </span>
                                {dataQualityMeta.sources.join(', ')}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 상세 계산 내역 */}
            <Card>
                <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
                        상세 계산 내역
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">사용된 배출계수 및 계산 근거</CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                    <div className="space-y-3 sm:space-y-4">
                        {stages.map(stage => {
                            const result = stageResults[stage]
                            if (result.details.length === 0) return null

                            return (
                                <div key={stage} className="space-y-2">
                                    <h4 className="font-medium text-xs sm:text-sm">{STAGE_LABELS[stage]}</h4>
                                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                                        <div className="min-w-[600px] sm:min-w-0">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b text-muted-foreground">
                                                        <th className="text-left py-2 pr-2 sm:py-1">항목</th>
                                                        <th className="text-right py-2 px-2 sm:py-1">수량</th>
                                                        <th className="text-right py-2 px-2 sm:py-1">배출계수</th>
                                                        <th className="text-right py-2 pl-2 sm:py-1">배출량</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.details.map((detail, idx) => (
                                                        <tr key={idx} className="border-b border-border/50">
                                                            <td className="py-2 pr-2 sm:py-1">{detail.source}</td>
                                                            <td className="text-right py-2 px-2 sm:py-1">
                                                                {detail.quantity.toFixed(2)} {detail.unit}
                                                            </td>
                                                            <td className="text-right py-2 px-2 sm:py-1 text-muted-foreground text-[10px] sm:text-xs">
                                                                {detail.emissionFactor}
                                                            </td>
                                                            <td className={`text-right py-2 pl-2 sm:py-1 font-mono ${detail.value < 0 ? 'text-green-500' : ''}`}>
                                                                {detail.value.toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* 할당 설정 요약 (ISO 14067 6.4.6) */}
            <Card>
                <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Scale className="h-4 w-4 sm:h-5 sm:w-5" />
                        할당 설정 요약
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">ISO 14067 6.4.6 - 할당 절차</CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                        {/* 다중 출력 할당 */}
                        <div className="p-3 sm:p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Scale className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500 flex-shrink-0" />
                                <span className="font-medium text-indigo-400 text-xs sm:text-sm">다중 출력 프로세스</span>
                            </div>
                            <p className="text-xs sm:text-sm font-medium">
                                {MULTI_OUTPUT_ALLOCATION_METHODS[multiOutputAllocation.method].nameKo}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                {MULTI_OUTPUT_ALLOCATION_METHODS[multiOutputAllocation.method].descriptionKo}
                            </p>
                            {multiOutputAllocation.coProducts.length > 0 && (
                                <p className="text-xs text-indigo-400 mt-2">
                                    공동 제품: {multiOutputAllocation.coProducts.length}개
                                </p>
                            )}
                            {multiOutputAllocation.justification && (
                                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-indigo-500/20">
                                    <span className="font-medium">정당화:</span> {multiOutputAllocation.justification}
                                </p>
                            )}
                        </div>

                        {/* 재활용 할당 */}
                        <div className="p-3 sm:p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Recycle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                                <span className="font-medium text-green-400 text-xs sm:text-sm">재사용/재활용</span>
                            </div>
                            <p className="text-xs sm:text-sm font-medium">
                                {RECYCLING_ALLOCATION_METHODS[recyclingAllocation.method].nameKo}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                {recyclingAllocation.loopType === 'closed_loop' ? '폐쇄 루프' : '개방 루프'}
                            </p>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] sm:text-xs">
                                <div>
                                    <span className="text-muted-foreground">재활용 투입:</span>
                                    <span className="ml-1 font-mono">{(recyclingAllocation.recycledContentInput * 100).toFixed(0)}%</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">재활용 산출:</span>
                                    <span className="ml-1 font-mono">{(recyclingAllocation.recyclabilityOutput * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                            {recyclingAllocation.justification && (
                                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-green-500/20">
                                    <span className="font-medium">정당화:</span> {recyclingAllocation.justification}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 데이터 품질 및 갭 경고 */}
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="font-semibold text-yellow-500">데이터 품질 및 갭</h4>
                        <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                            <li>
                                사용된 배출계수는 2차 데이터(Secondary Data)입니다.
                                실제 공급망 1차 데이터(Primary Data) 사용 시 정확도가 향상됩니다.
                            </li>
                            {productInfo.boundary === 'cradle-to-gate' && (
                                <li>
                                    Cradle-to-Gate 경계로 사용 및 폐기 단계는 제외되거나 참고용입니다.
                                </li>
                            )}
                            {totalEmission === 0 && (
                                <li className="text-yellow-600 font-medium">
                                    입력된 데이터가 없어 결과가 0입니다. 이전 단계에서 데이터를 입력해주세요.
                                </li>
                            )}
                            <li>
                                배출계수 출처: {EMISSION_FACTOR_SOURCES.korea_lci.name} ({EMISSION_FACTOR_SOURCES.korea_lci.year}),
                                {' '}{EMISSION_FACTOR_SOURCES.ipcc.name}, {EMISSION_FACTOR_SOURCES.glec.name}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* ISO 14067 Annex A - 제한사항 */}
            <Card className="border-blue-500/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-400">
                        <Info className="h-5 w-5" />
                        CFP 연구 제한사항
                    </CardTitle>
                    <CardDescription>
                        ISO 14067:2018 Annex A (규정) 준수 - 모든 CFP 보고서에 명시 필수
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* A.2 단일 환경 영향 */}
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                        <h5 className="font-medium text-sm text-blue-400">
                            {LIMITATION_SINGLE_IMPACT.title}
                        </h5>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {LIMITATION_SINGLE_IMPACT.description}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/60">
                            참조: {LIMITATION_SINGLE_IMPACT.isoReference}
                        </p>
                    </div>

                    {/* A.3 방법론 제한사항 */}
                    <div className="space-y-2">
                        <h5 className="font-medium text-sm">방법론 관련 제한사항</h5>
                        <div className="grid gap-2 md:grid-cols-2">
                            {applicableLimitations.slice(0, 6).map((limitation) => (
                                <div
                                    key={limitation.id}
                                    className="p-2 rounded border border-border/50 bg-muted/30"
                                >
                                    <p className="text-xs font-medium">{limitation.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {limitation.description.slice(0, 100)}...
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 고려된 GHG 목록 (7.3 e) */}
                    <div className="pt-2 border-t border-border/50">
                        <h5 className="font-medium text-sm mb-2">고려된 온실가스 (ISO 14067 7.3 e)</h5>
                        <div className="flex flex-wrap gap-2">
                            {GHG_LIST.slice(0, 4).map((ghg) => (
                                <span
                                    key={ghg.formula}
                                    className="px-2 py-1 text-xs rounded-full bg-muted"
                                >
                                    {ghg.formula} ({ghg.name})
                                </span>
                            ))}
                            <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                                +{GHG_LIST.length - 4} more
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* PFD 공정 흐름도 (ISO 14067 7.2/7.3) */}
            <Card className="border-teal-500/20">
                <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                        <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 sm:h-5 sm:w-5 text-teal-500" />
                            공정 흐름도 (PFD)
                        </div>
                        <button
                            onClick={() => {
                                if (!showPFD) {
                                    try {
                                        const state = usePCFStore.getState()
                                        const pfd = generatePFD(
                                            state.productInfo,
                                            state.activityData,
                                            state.stages,
                                            state.detailedActivityData || undefined
                                        )
                                        setPfdCode(pfd.mermaidCode)
                                    } catch {
                                        setPfdCode('graph LR\n  A[\"\ub370\uc774\ud130 \ubd80\uc871\"] --> B[\"\ud65c\ub3d9 \ub370\uc774\ud130\ub97c \uc785\ub825\ud558\uc138\uc694\"]')
                                    }
                                }
                                setShowPFD(!showPFD)
                            }}
                            className="px-4 py-2 text-sm rounded-lg border border-teal-500/30 text-teal-600 hover:bg-teal-50 transition-colors flex items-center gap-2"
                        >
                            <GitBranch className="h-4 w-4" />
                            {showPFD ? 'PFD 숨기기' : 'PFD 보기'}
                        </button>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                        시스템 경계 내 몇력 흐름을 Mermaid 다이어그램으로 시각화합니다.
                    </CardDescription>
                </CardHeader>
                {showPFD && pfdCode && (
                    <CardContent className="px-4 sm:px-6 space-y-4">
                        <div className="relative">
                            <button
                                onClick={async () => {
                                    await navigator.clipboard.writeText(pfdCode)
                                    setPfdCopied(true)
                                    setTimeout(() => setPfdCopied(false), 2000)
                                }}
                                className="absolute top-3 right-3 px-3 py-1.5 text-xs rounded-md bg-muted hover:bg-muted/80 transition-colors flex items-center gap-1.5 z-10"
                            >
                                <Copy className="h-3 w-3" />
                                {pfdCopied ? '복사됨!' : 'Mermaid 복사'}
                            </button>
                            <pre className="p-4 pt-12 rounded-lg bg-muted/50 border border-border/50 overflow-x-auto text-xs font-mono whitespace-pre-wrap">
                                {pfdCode}
                            </pre>
                        </div>
                        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-700">
                            <p className="font-medium mb-1">활용 안내</p>
                            <p>위 Mermaid 코드를 <a href="https://mermaid.live" onClick={handleExternalClick("https://mermaid.live")} target="_blank" rel="noopener noreferrer" className="underline font-medium cursor-pointer">mermaid.live</a>에 붙여넣으면 다이어그램을 시각적으로 확인하고 PNG/SVG로 내보낼 수 있습니다.</p>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* 보고서 생성 버튼 */}
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-purple-500/5">
                <CardContent className="py-4 sm:py-6 px-4 sm:px-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex-1">
                            <h3 className="font-semibold text-base sm:text-lg">ISO 14067 준수 보고서</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                CFP 연구 보고서를 생성하여 다양한 형식으로 내보내세요.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            {/* ISO 14067 하이브리드 보고서 (P1-4) */}
                            <button
                                onClick={async () => {
                                    try {
                                        const { generateReport } = await import('@/lib/report/report-generator')
                                        const { saveAs } = await import('file-saver')
                                        const storeState = usePCFStore.getState()
                                        const report = generateReport(storeState, totalResult)

                                        // Markdown 파일 다운로드
                                        const blob = new Blob([report.fullReport], { type: 'text/markdown;charset=utf-8' })
                                        saveAs(blob, `PCF_Report_${(productInfo.name || 'product').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`)
                                    } catch (e) {
                                        console.error('Report generation failed:', e)
                                        alert('보고서 생성에 실패했습니다.\n\n오류: ' + (e instanceof Error ? e.message : String(e)))
                                    }
                                }}
                                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-medium shadow-lg shadow-emerald-500/25 text-sm sm:text-base w-full sm:w-auto h-11 sm:h-auto"
                            >
                                <FileDown className="w-4 h-4 sm:w-5 sm:h-5" />
                                ISO 14067 보고서 (Markdown)
                            </button>
                            {/* ISO 14067 전체본 Word 보고서 */}
                            <button
                                onClick={async () => {
                                    try {
                                        const { generateFullWordReport } = await import('@/lib/report/report-docx-full')
                                        const { saveAs } = await import('file-saver')
                                        const { useNarrativeStore } = await import('@/lib/narrative/narrative-store')
                                        const storeState = usePCFStore.getState()
                                        const narratives = useNarrativeStore.getState().records
                                        const blob = await generateFullWordReport(storeState, totalResult, { narratives })
                                        saveAs(blob, `PCF_Report_ISO14067_${(productInfo.name || 'product').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`)
                                    } catch (e) {
                                        console.error('Word report generation failed:', e)
                                        alert('Word 보고서 생성에 실패했습니다.\n\n오류: ' + (e instanceof Error ? e.message : String(e)))
                                    }
                                }}
                                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl hover:from-indigo-700 hover:to-blue-700 transition-all font-medium shadow-lg shadow-indigo-500/25 text-sm sm:text-base w-full sm:w-auto h-11 sm:h-auto"
                            >
                                <FileDown className="w-4 h-4 sm:w-5 sm:h-5" />
                                ISO 14067 보고서 (Word)
                            </button>
                            {/* 기존 HTML 보고서 */}
                            <button
                                onClick={() => setShowReportPreview(true)}
                                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-primary to-purple-600 text-white rounded-xl hover:from-primary/90 hover:to-purple-700 transition-all font-medium shadow-lg shadow-primary/25 text-sm sm:text-base w-full sm:w-auto h-11 sm:h-auto"
                            >
                                <FileDown className="w-4 h-4 sm:w-5 sm:h-5" />
                                보고서 미리보기 · 요약본 (HTML)
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 푸터 메타데이터 */}
            <div className="text-center text-xs text-muted-foreground space-y-1">
                <p>계산 기준: ISO 14067:2018 | GWP: IPCC AR6 (100년 기준)</p>
                <p>본 결과는 스크리닝 목적의 추정치이며, 공식 CFP 인증을 대체하지 않습니다.</p>
            </div>

            {/* 보고서 미리보기 모달 */}
            <ReportPreview
                isOpen={showReportPreview}
                onClose={() => setShowReportPreview(false)}
                calculatedResults={{
                    totalCFP: displayCFP,
                    fossilEmissions: displayFossil,
                    biogenicEmissions: displayBiogenic,
                    aircraftEmissions: displayAircraft,
                    dlucEmissions: 0,
                    stageBreakdown: stages.map(stage => {
                        const result = allocationInfo?.applied
                            ? allocationInfo.allocatedStageResults[stage]
                            : stageResults[stage]
                        const emission = result?.total || 0
                        return {
                            stage: STAGE_LABELS[stage] || stage,
                            stageKo: STAGE_LABELS[stage]?.split(' ')[0] || stage,
                            emission,
                            percentage: displayCFP > 0 ? (emission / displayCFP) * 100 : 0
                        }
                    }),
                    uncertainty: avgUncertainty,
                    ghgBreakdown: totalResult.ghgBreakdown
                }}
            />
        </div>
    )
}
