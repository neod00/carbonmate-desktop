"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { usePCFStore } from "@/lib/store"
import { Plus, Trash2, Truck, Ship, Train, Plane, ArrowRight, MapPin } from "lucide-react"
import type { TransportMode } from "@/lib/core/store"

interface TransportLeg {
    id: string
    origin: string
    destination: string
    mode: TransportMode
    distance: number
    weight: number
}

const MODE_ICONS: Record<TransportMode, React.ReactNode> = {
    truck: <Truck className="h-4 w-4" />,
    ship: <Ship className="h-4 w-4" />,
    rail: <Train className="h-4 w-4" />,
    aircraft: <Plane className="h-4 w-4" />,
}

const MODE_LABELS: Record<TransportMode, string> = {
    truck: '도로 (트럭)',
    ship: '해운 (컨테이너)',
    rail: '철도',
    aircraft: '항공',
}

// 운송 모드별 배출계수 (kgCO₂e/tkm)
const MODE_FACTORS: Record<TransportMode, number> = {
    truck: 0.089,
    ship: 0.016,
    rail: 0.022,
    aircraft: 0.602,
}

export function TransportPanel() {
    const {
        detailedActivityData,
        addTransportStep,
        removeTransportStep,
        updateTransportStep
    } = usePCFStore()

    const transportList = detailedActivityData?.transport || []

    // Store 데이터를 UI용 leg 포맷으로 변환 없이 직접 사용하거나, 
    // 여기서는 UI의 legs 상태를 제거하고 transportList를 직접 렌더링하도록 변경합니다.
    // 하지만 기존 TransportPanel의 UI 로직(local state)을 유지하면서 Store와 동기화하는 것이 좋겠습니다.

    // Store 데이터로 초기화 (또는 실시간 연동)
    // 여기서는 store의 transportList를 직접 map하여 보여주는 방식으로 변경하여 Single Source of Truth를 유지합니다.


    const addLeg = () => {
        addTransportStep({
            id: `leg-${Date.now()}`,
            stageId: 'transport',
            name: `운송 구간 ${transportList.length + 1}`,
            quantity: 0,
            unit: 'km',
            emissionSourceType: 'fossil', // 기본값
            transportMode: 'truck',
            distance: 0,
            weight: 0,
            dataQuality: { // 기본값
                type: 'secondary',
                source: 'IPCC',
                year: 2023,
                geographicScope: 'Global',
                uncertainty: 30
            }
        })
    }

    const updateLeg = (id: string, field: keyof TransportLeg, value: string | number) => {
        // TransportLeg 필드와 Store의 TransportInput 필드 매핑 필요
        // origin/destination은 TransportInput에 없으므로 (확장 필요하지만 일단 무시하거나 name에 저장?)
        // 여기서는 주요 필드(mode, distance, weight)만 업데이트합니다.

        const updates: any = {}
        if (field === 'mode') {
            updates.transportMode = value as TransportMode
            // 항공 운송일 경우 emissionSourceType 변경? (보통 자동 계산 로직에서 처리됨)
        } else if (field === 'distance') {
            updates.distance = value
        } else if (field === 'weight') {
            updates.weight = value
        } else if (field === 'origin' || field === 'destination') {
            // 편의상 로컬 상태나 메타데이터에 저장해야 하나, 현재 Store 구조상 name에 병기하거나 무시
            // UI 경험을 위해 name 필드에 "Origin -> Destination" 형식으로 저장
            const item = transportList.find(t => t.id === id)
            if (item) {
                // 기존 name 파싱 로직이 복잡하므로, 단순화:
                // name 필드 업데이트 로직은 별도로 두거나, origin/destination 입력 시 name을 재구성
                // 여기서는 간단히.. origin/destination state를 별도로 관리하지 않으면 입력이 어려움.
                // ActivityDataStep의 다른 컴포넌트들처럼 Store 직접 의존성을 갖도록 수정함.
            }
        }

        if (Object.keys(updates).length > 0) {
            updateTransportStep(id, updates)
        }
    }

    const removeLeg = (id: string) => {
        removeTransportStep(id)
    }

    // 구간별 배출량 계산
    const calculateLegEmission = (leg: TransportLeg) => {
        if (leg.distance <= 0 || leg.weight <= 0) return 0
        const tkm = (leg.weight * leg.distance) / 1000
        return tkm * MODE_FACTORS[leg.mode]
    }

    const totalEmission = transportList.reduce((sum, leg) => {
        // 계산 로직 재사용 (Store 데이터 기반)
        if (!leg.distance || !leg.weight) return sum
        const tkm = (leg.weight * leg.distance) / 1000
        const factor = MODE_FACTORS[leg.transportMode as TransportMode] || 0
        return sum + (tkm * factor)
    }, 0)

    const aircraftEmission = transportList
        .filter(leg => leg.transportMode === 'aircraft')
        .reduce((sum, leg) => {
            if (!leg.distance || !leg.weight) return sum
            const tkm = (leg.weight * leg.distance) / 1000
            const factor = MODE_FACTORS['aircraft']
            return sum + (tkm * factor)
        }, 0)



    return (
        <Card className="border-cyan-500/20">
            <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-cyan-500" />
                        <span>다구간 운송 경로</span>
                    </div>
                    <button
                        onClick={addLeg}
                        className="px-3 py-1.5 text-sm rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors flex items-center gap-1.5"
                    >
                        <Plus className="h-4 w-4" /> 구간 추가
                    </button>
                </CardTitle>
                <CardDescription>
                    출발지-도착지-운송수단 다구간 입력. 항공 운송은 ISO 14067 7.2(e)에 따라 자동 분리됩니다.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {transportList.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>"구간 추가" 버튼을 눌러 운송 경로를 입력하세요.</p>
                    </div>
                ) : (
                    <>
                        {transportList.map((leg, index) => (
                            <div key={leg.id} className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-cyan-600">구간 {index + 1}</span>
                                    <button
                                        onClick={() => removeLeg(leg.id)}
                                        className="p-1.5 rounded hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* 출발지-도착지 */}
                                {/* 출발지-도착지 (이름 필드 활용) */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="이름 / 경로 (예: 인천 공장 -> 부산 항만)"
                                        value={leg.name}
                                        onChange={e => updateTransportStep(leg.id, { name: e.target.value })}
                                        className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-background"
                                    />
                                </div>

                                {/* 운송수단 선택 */}
                                <div className="grid grid-cols-4 gap-2">
                                    {(Object.keys(MODE_LABELS) as TransportMode[]).map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => updateTransportStep(leg.id, { transportMode: mode })}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors ${leg.transportMode === mode
                                                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400 border'
                                                : 'bg-muted/50 border border-transparent hover:border-border'
                                                }`}
                                        >
                                            {MODE_ICONS[mode]}
                                            <span>{MODE_LABELS[mode].split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* 거리, 중량 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">거리 (km)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={leg.distance || ''}
                                            onChange={e => {
                                                updateTransportStep(leg.id, { distance: Number(e.target.value) })
                                            }}
                                            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">중량 (kg)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={leg.weight || ''}
                                            onChange={e => {
                                                updateTransportStep(leg.id, { weight: Number(e.target.value) })
                                            }}
                                            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* 구간 배출량 */}
                                <div className="text-right text-sm">
                                    <span className="text-muted-foreground">배출량: </span>
                                    <span className="font-semibold">{(() => {
                                        if (!leg.distance || !leg.weight) return 0
                                        const tkm = (leg.weight * leg.distance) / 1000
                                        const factor = MODE_FACTORS[leg.transportMode as TransportMode] || 0
                                        return (tkm * factor).toFixed(3)
                                    })()}</span>
                                    <span className="text-xs text-muted-foreground ml-1">kgCO₂e</span>
                                </div>
                            </div>
                        ))}

                        {/* 합계 */}
                        <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">총 운송 배출량</span>
                                <span className="text-lg font-bold">{totalEmission.toFixed(3)} <span className="text-xs font-normal text-muted-foreground">kgCO₂e</span></span>
                            </div>
                            {aircraftEmission > 0 && (
                                <div className="flex items-center justify-between mt-1 text-sm text-blue-400">
                                    <span className="flex items-center gap-1">
                                        <Plane className="h-3 w-3" /> 항공 운송 (별도 보고)
                                    </span>
                                    <span>{aircraftEmission.toFixed(3)} kgCO₂e</span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
