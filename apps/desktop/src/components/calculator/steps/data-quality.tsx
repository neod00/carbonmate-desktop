"use client"

import { useState, useEffect } from "react"
import { usePCFStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Info, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Wand2, Loader2, Shield } from "lucide-react"
import { generateDQRReport, type DQRReport, type DataInputMetadata } from "@/lib/core/auto-dqr"
import {
    PEDIGREE_MATRIX,
    DATA_QUALITY_PRESETS,
    DataQualityIndicators,
    calculateDQI,
    getDQILevel,
    DQI_LEVEL_LABELS,
    estimateUncertaintyFromDQI,
    generateDataQualitySummary,
    getPresetById,
    getDefaultPreset
} from "@/lib/data-quality"

export function DataQualityStep() {
    const { dataQualityMeta, setDataQualityMeta } = usePCFStore()

    // 현재 선택된 프리셋
    const [selectedPreset, setSelectedPreset] = useState<string>('secondary_national')

    // 상세 지표 (커스텀 모드용)
    const [indicators, setIndicators] = useState<DataQualityIndicators>({
        reliability: 2,
        completeness: 3,
        temporalCorrelation: 2,
        geographicalCorrelation: 1,
        technologicalCorrelation: 3
    })

    // 커스텀 모드 여부
    const [isCustomMode, setIsCustomMode] = useState(false)

    // 자동 DQR 상태
    const [autoDQRReport, setAutoDQRReport] = useState<DQRReport | null>(null)
    const [isRunningAutoDQR, setIsRunningAutoDQR] = useState(false)

    // 프리셋 변경 시 지표 업데이트
    useEffect(() => {
        if (!isCustomMode) {
            const preset = getPresetById(selectedPreset)
            if (preset) {
                setIndicators(preset.indicators)
                setDataQualityMeta({
                    overallType: preset.sourceType.includes('primary') ? 'primary' : 'secondary',
                    sources: [preset.nameKo]
                })
            }
        }
    }, [selectedPreset, isCustomMode])

    // DQI 계산
    const dqi = calculateDQI(indicators)
    const level = getDQILevel(dqi)
    const levelInfo = DQI_LEVEL_LABELS[level]
    const uncertainty = estimateUncertaintyFromDQI(dqi)
    const summary = generateDataQualitySummary(indicators)

    // 개별 지표 변경 핸들러
    const handleIndicatorChange = (key: keyof DataQualityIndicators, value: number) => {
        setIsCustomMode(true)
        setIndicators(prev => ({
            ...prev,
            [key]: value as 1 | 2 | 3 | 4 | 5
        }))
    }

    // 자동 DQR 실행 핸들러
    const handleAutoDQR = () => {
        setIsRunningAutoDQR(true)
        try {
            // 현재 store에서 활동 데이터 메타정보 수집
            const state = usePCFStore.getState()
            const items: DataInputMetadata[] = []

            // 기본 전력 데이터
            if (state.activityData.electricity) {
                items.push({
                    fieldName: 'electricity',
                    fieldLabel: '전력 사용량',
                    sourceType: dataQualityMeta.overallType === 'primary' ? 'primary_measured' : 'secondary_verified',
                    dataYear: dataQualityMeta.baseYear,
                    referenceYear: new Date().getFullYear(),
                    dataCountry: 'KR',
                    targetCountry: 'KR',
                    isSameProcess: true,
                    isSameTechnology: true
                })
            }

            // 원자재 데이터
            if (state.activityData.raw_material_weight) {
                items.push({
                    fieldName: 'raw_material',
                    fieldLabel: '원자재 투입량',
                    sourceType: dataQualityMeta.overallType === 'primary' ? 'primary_measured' : 'secondary_database',
                    dataYear: dataQualityMeta.baseYear,
                    referenceYear: new Date().getFullYear(),
                    dataCountry: 'KR',
                    targetCountry: 'KR',
                    isSameProcess: true
                })
            }

            // 운송 데이터
            if (state.activityData.transport_distance) {
                items.push({
                    fieldName: 'transport',
                    fieldLabel: '운송 거리/중량',
                    sourceType: 'estimated',
                    dataYear: dataQualityMeta.baseYear,
                    referenceYear: new Date().getFullYear(),
                    dataCountry: 'KR',
                    targetCountry: 'KR',
                    isSameProcess: false
                })
            }

            // 포장재 데이터
            if (state.activityData.packaging_weight) {
                items.push({
                    fieldName: 'packaging',
                    fieldLabel: '포장재 정보',
                    sourceType: 'secondary_verified',
                    dataYear: dataQualityMeta.baseYear,
                    referenceYear: new Date().getFullYear(),
                    dataCountry: 'KR',
                    targetCountry: 'KR'
                })
            }

            // 폐기 데이터
            if (state.activityData.waste_weight) {
                items.push({
                    fieldName: 'waste',
                    fieldLabel: '폐기물 처리',
                    sourceType: 'secondary_verified',
                    dataYear: dataQualityMeta.baseYear,
                    referenceYear: new Date().getFullYear(),
                    dataCountry: 'KR',
                    targetCountry: 'KR'
                })
            }

            // 최소 1개 이상의 항목이 있어야 함
            if (items.length === 0) {
                items.push({
                    fieldName: 'default',
                    fieldLabel: '기본 데이터',
                    sourceType: dataQualityMeta.overallType === 'primary' ? 'primary_measured' : 'secondary_verified',
                    dataYear: dataQualityMeta.baseYear,
                    referenceYear: new Date().getFullYear(),
                    dataCountry: 'KR',
                    targetCountry: 'KR'
                })
            }

            const report = generateDQRReport(items, state.productInfo.name || 'CFP 프로젝트')
            setAutoDQRReport(report)

            // 결과를 지표에 반영
            if (report.itemResults.length > 0) {
                const avgIndicators = report.itemResults[0].indicators
                setIndicators(avgIndicators)
                setIsCustomMode(true)
            }
        } finally {
            setIsRunningAutoDQR(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* 헤더 */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">데이터 품질 평가</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        ISO 14067 6.3.5
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">
                    사용된 데이터의 품질을 평가하여 결과의 신뢰도와 불확실성을 산정합니다.
                </p>
            </div>

            {/* 입력 데이터 품질 요약 */}
            {(() => {
                const state = usePCFStore.getState()
                const rawMaterials = state.detailedActivityData?.raw_materials || []
                if (rawMaterials.length === 0) return null

                const primaryCount = rawMaterials.filter((m: any) => m.dataQuality?.type === 'primary').length
                const secondaryCount = rawMaterials.filter((m: any) => m.dataQuality?.type === 'secondary').length
                const estimatedCount = rawMaterials.filter((m: any) => !m.dataQuality?.type || m.dataQuality?.type === 'estimated').length
                const withEF = rawMaterials.filter((m: any) => m.customEmissionFactor).length
                const total = rawMaterials.length

                return (
                    <div className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-3">
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium">입력 데이터 품질 현황</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                                원자재 {total}개 항목
                            </span>
                        </div>

                        {/* 분포 바 */}
                        <div className="relative h-3 w-full rounded-full overflow-hidden bg-muted/30 border border-border/30">
                            {primaryCount > 0 && (
                                <div
                                    className="absolute top-0 left-0 h-full bg-green-500/70"
                                    style={{ width: `${(primaryCount / total) * 100}%` }}
                                />
                            )}
                            {secondaryCount > 0 && (
                                <div
                                    className="absolute top-0 h-full bg-blue-500/70"
                                    style={{
                                        left: `${(primaryCount / total) * 100}%`,
                                        width: `${(secondaryCount / total) * 100}%`
                                    }}
                                />
                            )}
                            {estimatedCount > 0 && (
                                <div
                                    className="absolute top-0 h-full bg-orange-500/70"
                                    style={{
                                        left: `${((primaryCount + secondaryCount) / total) * 100}%`,
                                        width: `${(estimatedCount / total) * 100}%`
                                    }}
                                />
                            )}
                        </div>

                        {/* 통계 */}
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                                <span className="text-muted-foreground">1차 데이터:</span>
                                <span className="font-medium">{primaryCount}개</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500/70" />
                                <span className="text-muted-foreground">2차 데이터:</span>
                                <span className="font-medium">{secondaryCount}개</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500/70" />
                                <span className="text-muted-foreground">추정:</span>
                                <span className="font-medium">{estimatedCount}개</span>
                            </div>
                            <div className="ml-auto text-muted-foreground">
                                EF 입력: <span className="font-medium">{withEF}/{total}</span>
                            </div>
                        </div>

                        {primaryCount === 0 && (
                            <p className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1.5 rounded border border-amber-500/20">
                                💡 ISO 14067은 가능한 경우 1차 데이터(실측 데이터) 사용을 권장합니다 (6.3.5 조항).
                            </p>
                        )}
                    </div>
                )
            })()}

            {/* 프리셋 선택 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">데이터 출처 유형</CardTitle>
                    <CardDescription>
                        주로 사용한 데이터의 출처를 선택하세요.
                        상세 지표는 자동으로 설정됩니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {/* P1-6 수정: 출처 유형(preset) 선택 상태를 사용자 지표 조정과 무관하게 유지.
                            사용자가 슬라이더로 미세 조정해도 preset은 "기준점"으로 계속 표시되며,
                            "사용자 조정됨" 배지로 변경 여부를 명시한다. */}
                        {DATA_QUALITY_PRESETS.map((preset) => {
                            const isBaseSelected = selectedPreset === preset.id
                            const showCustomBadge = isBaseSelected && isCustomMode
                            const presetDqi = calculateDQI(preset.indicators)
                            const presetLevel = getDQILevel(presetDqi)

                            return (
                                <div
                                    key={preset.id}
                                    onClick={() => {
                                        setSelectedPreset(preset.id)
                                        setIsCustomMode(false) // preset 클릭 = 기본값으로 리셋
                                    }}
                                    className={`p-4 rounded-lg border cursor-pointer transition-all ${isBaseSelected
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border/50 hover:border-primary/50'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-medium text-sm">
                                                {preset.nameKo}
                                            </h4>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {preset.description}
                                            </p>
                                        </div>
                                        {isBaseSelected && (
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                        )}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                        <DQIBadge level={presetLevel} size="sm" />
                                        <span className="text-xs text-muted-foreground">
                                            ±{preset.uncertaintyFactor}%
                                        </span>
                                        {showCustomBadge && (
                                            <span
                                                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                                title="이 출처 유형을 기준으로 시작했고 일부 지표를 사용자가 조정한 상태입니다. 카드를 다시 클릭하면 기본값으로 리셋됩니다."
                                            >
                                                사용자 조정됨
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* 상세 지표 조정 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                        <span>Pedigree Matrix 상세 지표</span>
                        {isCustomMode && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                                커스텀 설정
                            </span>
                        )}
                    </CardTitle>
                    <CardDescription>
                        각 품질 지표를 조정하여 더 정확한 불확실성을 산정할 수 있습니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {(Object.keys(PEDIGREE_MATRIX) as Array<keyof typeof PEDIGREE_MATRIX>).map((key) => {
                        const matrix = PEDIGREE_MATRIX[key]
                        const value = indicators[key]
                        const levelInfo = matrix.levels[value as keyof typeof matrix.levels]

                        return (
                            <div key={key} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium">
                                        {matrix.nameKo}
                                    </Label>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${value <= 2 ? 'bg-green-500/20 text-green-500' :
                                        value <= 3 ? 'bg-yellow-500/20 text-yellow-500' :
                                            'bg-red-500/20 text-red-500'
                                        }`}>
                                        {levelInfo.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-muted-foreground w-16">높음</span>
                                    <div className="flex-1">
                                        <input
                                            type="range"
                                            min="1"
                                            max="5"
                                            step="1"
                                            value={value}
                                            onChange={(e) => handleIndicatorChange(key, parseInt(e.target.value))}
                                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                            <span>1</span>
                                            <span>2</span>
                                            <span>3</span>
                                            <span>4</span>
                                            <span>5</span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground w-16 text-right">낮음</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {levelInfo.descriptionKo}
                                </p>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {/* DQI 결과 요약 */}
            <Card className={`border-${levelInfo.color}-500/20`}>
                <CardHeader>
                    <CardTitle className="text-base">데이터 품질 평가 결과</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* DQI 점수 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className={`p-4 rounded-lg ${level === 'high' ? 'bg-green-500/10' :
                                    level === 'medium' ? 'bg-yellow-500/10' :
                                        level === 'low' ? 'bg-orange-500/10' :
                                            'bg-red-500/10'
                                    }`}>
                                    <div className="text-3xl font-bold">
                                        {dqi.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">DQI 점수</div>
                                </div>
                                <div>
                                    <DQIBadge level={level} size="lg" />
                                    <p className="text-sm text-muted-foreground mt-1">
                                        데이터 품질 등급
                                    </p>
                                </div>
                            </div>

                            {/* 불확실성 범위 */}
                            <div className="p-4 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                    <span className="font-medium text-sm">추정 불확실성 범위</span>
                                </div>
                                <div className="text-2xl font-bold">
                                    ±{uncertainty.geometric}%
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    결과값의 {100 + uncertainty.min}% ~ {100 + uncertainty.max}% 범위
                                </p>
                            </div>
                        </div>

                        {/* 강점/약점 */}
                        <div className="space-y-4">
                            {summary.strengths.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        <span className="font-medium text-sm">강점</span>
                                    </div>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        {summary.strengths.map((s, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <TrendingUp className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {summary.weaknesses.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                                        <span className="font-medium text-sm">개선 필요</span>
                                    </div>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        {summary.weaknesses.map((w, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <TrendingDown className="h-3 w-3 mt-1 text-orange-500 flex-shrink-0" />
                                                {w}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {summary.recommendations.length > 0 && (
                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info className="h-4 w-4 text-blue-500" />
                                        <span className="font-medium text-sm text-blue-400">권장사항</span>
                                    </div>
                                    <ul className="text-xs text-muted-foreground space-y-1">
                                        {summary.recommendations.map((r, i) => (
                                            <li key={i}>• {r}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 자동 DQR 평가 */}
            <Card className="border-indigo-500/20">
                <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Wand2 className="h-5 w-5 text-indigo-500" />
                            <span>자동 DQR 평가</span>
                        </div>
                        <button
                            onClick={handleAutoDQR}
                            disabled={isRunningAutoDQR}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isRunningAutoDQR ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> 평가 중...</>
                            ) : (
                                <><Wand2 className="h-4 w-4" /> 자동 평가 실행</>
                            )}
                        </button>
                    </CardTitle>
                    <CardDescription>
                        입력된 활동 데이터의 메타정보를 기반으로 DQI를 자동 산정합니다.
                    </CardDescription>
                </CardHeader>
                {autoDQRReport && (
                    <CardContent className="space-y-4">
                        {/* 종합 결과 */}
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="p-4 rounded-lg bg-indigo-500/10">
                                <div className="text-xs text-muted-foreground">평균 DQI</div>
                                <div className="text-2xl font-bold">{autoDQRReport.averageDQI.toFixed(2)}</div>
                            </div>
                            <div className="p-4 rounded-lg bg-indigo-500/10">
                                <div className="text-xs text-muted-foreground">평가 항목</div>
                                <div className="text-2xl font-bold">{autoDQRReport.totalItems}건</div>
                            </div>
                            <div className="p-4 rounded-lg bg-indigo-500/10">
                                <div className="text-xs text-muted-foreground">주의 항목</div>
                                <div className="text-2xl font-bold text-orange-500">{autoDQRReport.criticalItems.length}건</div>
                            </div>
                        </div>

                        {/* 항목별 결과 */}
                        <div className="space-y-2">
                            {autoDQRReport.itemResults.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-2 w-2 rounded-full ${item.level === 'high' ? 'bg-green-500' : item.level === 'medium' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                        <span className="text-sm font-medium">{item.fieldLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-muted-foreground">DQI {item.dqi.toFixed(2)}</span>
                                        <DQIBadge level={item.level} size="sm" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ISO 준수 현황 */}
                        {autoDQRReport.isoCompliance.length > 0 && (
                            <div className="p-4 rounded-lg border border-indigo-500/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <Shield className="h-4 w-4 text-indigo-500" />
                                    <span className="font-medium text-sm">ISO 14067 준수 현황</span>
                                </div>
                                <div className="space-y-2">
                                    {autoDQRReport.isoCompliance.map((item, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            {item.satisfied ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                            )}
                                            <div>
                                                <span className="text-xs font-medium">{item.clause}</span>
                                                <p className="text-xs text-muted-foreground">{item.notes}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 개선 제안 */}
                        {autoDQRReport.improvements.length > 0 && (
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Info className="h-4 w-4 text-blue-500" />
                                    <span className="font-medium text-sm text-blue-400">개선 제안</span>
                                </div>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                    {autoDQRReport.improvements.map((r, i) => (
                                        <li key={i}>• {r}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* ISO 14067 참고사항 */}
            <div className="p-4 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-2">
                <p className="font-medium">ISO 14067 6.3.5 데이터 품질 요구사항:</p>
                <ul className="list-disc list-inside space-y-1">
                    <li>
                        <span className="font-medium">1차 데이터(Primary)</span>: 조직이 재정적/운영적 통제권을 가진
                        공정에서 수집된 현장 특정 데이터
                    </li>
                    <li>
                        <span className="font-medium">2차 데이터(Secondary)</span>: 1차 데이터 수집이 불가능한
                        경우에만 사용, 출처 명시 필수
                    </li>
                    <li>
                        데이터 품질은 시간적, 지리적, 기술적 대표성을 포함하여 평가해야 함
                    </li>
                    <li>
                        전체 CFP의 80% 이상을 차지하는 공정에는 1차 데이터 사용 권장
                    </li>
                </ul>
            </div>
        </div>
    )
}

// =============================================================================
// 헬퍼 컴포넌트
// =============================================================================

function DQIBadge({ level, size = 'md' }: { level: string, size?: 'sm' | 'md' | 'lg' }) {
    const info = DQI_LEVEL_LABELS[level as keyof typeof DQI_LEVEL_LABELS]

    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-3 py-1',
        lg: 'text-base px-4 py-1.5'
    }

    const colorClasses = {
        green: 'bg-green-500/20 text-green-500',
        yellow: 'bg-yellow-500/20 text-yellow-500',
        orange: 'bg-orange-500/20 text-orange-500',
        red: 'bg-red-500/20 text-red-500'
    }

    return (
        <span className={`rounded-full font-medium ${sizeClasses[size]} ${colorClasses[info.color as keyof typeof colorClasses]}`}>
            {info.labelKo}
        </span>
    )
}

