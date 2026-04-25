"use client"

import { useEffect, useState } from "react"
import { usePCFStore } from "@/lib/store"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Check, X, Info, Lock, Scissors, Settings2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    LIFECYCLE_STAGES,
    getStageStatus,
    getSystemBoundaryConfig,
    isStageSelectableForBoundary
} from "@/lib/system-boundary"
import { CUT_OFF_PRESETS, CutOffPreset } from "@/lib/cut-off-criteria"

export function LifecycleStagesStep() {
    const { 
        stages, 
        toggleStage, 
        productInfo,
        cutOffCriteria,
        cutOffPreset,
        setCutOffPreset,
        setCutOffCriteria
    } = usePCFStore()
    
    const boundaryConfig = getSystemBoundaryConfig(productInfo.boundary)
    const [showCutOffSettings, setShowCutOffSettings] = useState(false)

    // 시스템 경계에 따른 필수 단계 자동 선택
    useEffect(() => {
        boundaryConfig.requiredStages.forEach(stageId => {
            if (!stages.includes(stageId)) {
                toggleStage(stageId)
            }
        })
        
        // 제외 단계 자동 해제
        boundaryConfig.excludedStages.forEach(stageId => {
            if (stages.includes(stageId)) {
                toggleStage(stageId)
            }
        })
    }, [productInfo.boundary])

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">생애주기 단계 선택</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        ISO 14067 6.3.4
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">
                    선택된 시스템 경계: <span className="font-medium text-foreground">{boundaryConfig.nameKo}</span>
                </p>
            </div>

            {/* 경계 설명 */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-sm text-muted-foreground">
                    {boundaryConfig.descriptionKo}
                </p>
                <div className="flex flex-wrap gap-4 mt-3 text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <span>필수 단계</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span>선택 단계</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                        <span>제외 단계</span>
                    </div>
                </div>
            </div>

            {/* 단계 목록 */}
            <div className="grid gap-4 md:grid-cols-2">
                {LIFECYCLE_STAGES.map((stage) => {
                    const status = getStageStatus(stage.id, productInfo.boundary)
                    const isSelected = stages.includes(stage.id)
                    const isSelectable = status !== 'excluded'
                    const isRequired = status === 'required'

                    return (
                        <Card
                            key={stage.id}
                            className={`transition-all ${
                                !isSelectable 
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : isSelected
                                        ? 'border-primary/50 bg-primary/5'
                                        : 'hover:border-primary/30'
                            }`}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    {/* 체크박스 */}
                                    <div className="pt-0.5">
                                        {isRequired ? (
                                            <div className="flex items-center justify-center h-5 w-5 rounded border-2 border-primary bg-primary">
                                                <Check className="h-3 w-3 text-primary-foreground" />
                                            </div>
                                        ) : !isSelectable ? (
                                            <div className="flex items-center justify-center h-5 w-5 rounded border-2 border-muted-foreground/30">
                                                <X className="h-3 w-3 text-muted-foreground/50" />
                                            </div>
                                        ) : (
                                            <Checkbox
                                                id={stage.id}
                                                checked={isSelected}
                                                onCheckedChange={() => toggleStage(stage.id)}
                                                disabled={!isSelectable}
                                            />
                                        )}
                                    </div>

                                    {/* 단계 정보 */}
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{stage.icon}</span>
                                            <Label
                                                htmlFor={stage.id}
                                                className={`text-base font-medium ${
                                                    !isSelectable ? 'text-muted-foreground' : 'cursor-pointer'
                                                }`}
                                            >
                                                {stage.nameKo}
                                            </Label>
                                            
                                            {/* 상태 배지 */}
                                            <StageStatusBadge status={status} />
                                        </div>
                                        
                                        <p className="text-xs text-muted-foreground">
                                            {stage.name}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {stage.descriptionKo}
                                        </p>

                                        {/* 하위 단계 */}
                                        {stage.subStages && isSelected && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {stage.subStages.map(sub => (
                                                    <span 
                                                        key={sub}
                                                        className="text-xs px-2 py-0.5 rounded-full bg-muted"
                                                    >
                                                        {formatSubStage(sub)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* 선택된 단계 요약 */}
            <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                        <h4 className="font-medium text-sm">선택된 단계 ({stages.length}개)</h4>
                        <div className="flex flex-wrap gap-2">
                            {stages.map(stageId => {
                                const stage = LIFECYCLE_STAGES.find(s => s.id === stageId)
                                const status = getStageStatus(stageId, productInfo.boundary)
                                return (
                                    <span 
                                        key={stageId}
                                        className={`text-xs px-2 py-1 rounded-full ${
                                            status === 'required' 
                                                ? 'bg-primary/20 text-primary' 
                                                : 'bg-blue-500/20 text-blue-400'
                                        }`}
                                    >
                                        {stage?.icon} {stage?.nameKo || stageId}
                                    </span>
                                )
                            })}
                        </div>
                        
                        {/* 경고: 필수 단계 누락 */}
                        {boundaryConfig.requiredStages.some(s => !stages.includes(s)) && (
                            <div className="flex items-center gap-2 mt-3 text-yellow-500 text-xs">
                                <AlertTriangle className="h-4 w-4" />
                                <span>
                                    일부 필수 단계가 선택되지 않았습니다. 
                                    {boundaryConfig.nameKo} 경계에서는 다음 단계가 필수입니다: 
                                    {boundaryConfig.requiredStages
                                        .filter(s => !stages.includes(s))
                                        .map(s => LIFECYCLE_STAGES.find(stage => stage.id === s)?.nameKo)
                                        .join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cut-off 기준 설정 (ISO 14067 6.3.4.3) */}
            <div className="rounded-lg border border-border/50 overflow-hidden">
                <button
                    onClick={() => setShowCutOffSettings(!showCutOffSettings)}
                    className="w-full p-4 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Scissors className="h-5 w-5 text-orange-500" />
                        <div className="text-left">
                            <h4 className="font-medium text-sm">Cut-off 기준 설정</h4>
                            <p className="text-xs text-muted-foreground">
                                ISO 14067 6.3.4.3 - 중요하지 않은 물질/에너지 흐름 제외 기준
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">
                            {CUT_OFF_PRESETS.find(p => p.id === cutOffPreset)?.nameKo || '사용자 정의'}
                        </span>
                        {showCutOffSettings ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                    </div>
                </button>
                
                {showCutOffSettings && (
                    <div className="p-4 space-y-4 border-t border-border/50">
                        {/* 프리셋 선택 */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">기준 선택</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {CUT_OFF_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => setCutOffPreset(preset.id)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                                            cutOffPreset === preset.id
                                                ? 'border-orange-500 bg-orange-500/10'
                                                : 'border-muted bg-muted/30 hover:bg-muted/50'
                                        }`}
                                    >
                                        <span className="text-sm font-medium">{preset.nameKo}</span>
                                        <span className="text-xs text-muted-foreground text-center mt-1">
                                            {preset.descriptionKo}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* 사용자 정의 설정 */}
                        {cutOffPreset === 'custom' && (
                            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                                <div className="flex items-center gap-2">
                                    <Settings2 className="h-4 w-4 text-orange-500" />
                                    <Label className="text-sm font-medium">임계값 설정 (%)</Label>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">질량 기준</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="0.1"
                                            value={cutOffCriteria.massThreshold}
                                            onChange={(e) => setCutOffCriteria({ 
                                                massThreshold: parseFloat(e.target.value) || 0,
                                                enabled: true
                                            })}
                                            className="text-center"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">에너지 기준</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="0.1"
                                            value={cutOffCriteria.energyThreshold}
                                            onChange={(e) => setCutOffCriteria({ 
                                                energyThreshold: parseFloat(e.target.value) || 0,
                                                enabled: true
                                            })}
                                            className="text-center"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">환경영향 기준</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="0.1"
                                            value={cutOffCriteria.environmentalThreshold}
                                            onChange={(e) => setCutOffCriteria({ 
                                                environmentalThreshold: parseFloat(e.target.value) || 0,
                                                enabled: true
                                            })}
                                            className="text-center"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* 현재 설정 요약 */}
                        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-orange-200">
                                    {!cutOffCriteria.enabled ? (
                                        <p>모든 물질 및 에너지 흐름이 계산에 포함됩니다.</p>
                                    ) : (
                                        <>
                                            <p className="font-medium mb-1">현재 설정된 제외 기준:</p>
                                            <ul className="space-y-0.5 text-orange-300">
                                                <li>• 질량 기여도 {cutOffCriteria.massThreshold}% 미만</li>
                                                <li>• 에너지 기여도 {cutOffCriteria.energyThreshold}% 미만</li>
                                                <li>• 환경영향(배출량) 기여도 {cutOffCriteria.environmentalThreshold}% 미만</li>
                                            </ul>
                                            <p className="mt-2 text-orange-400">
                                                ※ 위 기준을 모두 충족하는 항목은 계산에서 제외됩니다.
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ISO 14067 참고사항 */}
            <div className="text-xs text-muted-foreground space-y-1">
                <p>
                    • <span className="font-medium">Cradle-to-Gate</span>: B2B 거래 시 일반적으로 사용되며, 
                    고객이 사용 및 폐기 단계를 추가할 수 있습니다.
                </p>
                <p>
                    • <span className="font-medium">Cradle-to-Grave</span>: 제품의 전체 환경 영향을 
                    평가할 때 사용합니다. 사용 시나리오와 폐기 시나리오를 명확히 정의해야 합니다.
                </p>
                <p>
                    • ISO 14067 6.3.4.3에 따라, 전체의 1% 미만인 항목은 Cut-off 기준에 따라 제외할 수 있습니다.
                </p>
            </div>
        </div>
    )
}

// =============================================================================
// 헬퍼 컴포넌트
// =============================================================================

function StageStatusBadge({ status }: { status: 'required' | 'optional' | 'excluded' }) {
    switch (status) {
        case 'required':
            return (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                    <Lock className="h-3 w-3" />
                    필수
                </span>
            )
        case 'optional':
            return (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                    선택
                </span>
            )
        case 'excluded':
            return (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    제외
                </span>
            )
        default:
            return null
    }
}

function formatSubStage(subStage: string): string {
    const labels: Record<string, string> = {
        extraction: '채굴',
        processing: '가공',
        upstream_transport: '상류 운송',
        energy_use: '에너지 사용',
        process_emissions: '공정 배출',
        auxiliary_materials: '보조 재료',
        inbound_transport: '입고 운송',
        outbound_transport: '출고 운송',
        warehousing: '창고',
        primary_packaging: '1차 포장',
        secondary_packaging: '2차 포장',
        tertiary_packaging: '3차 포장',
        energy_consumption: '에너지 소비',
        maintenance: '유지보수',
        consumables: '소모품',
        collection: '수거',
        sorting: '분류',
        recycling: '재활용',
        disposal: '처리'
    }
    return labels[subStage] || subStage
}
