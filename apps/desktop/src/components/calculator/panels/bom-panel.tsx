"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Plus, Trash2, Package, AlertTriangle, CheckCircle2 } from "lucide-react"

interface BOMItem {
    id: string
    name: string
    weight: number
    unit: string
    materialType: string
}

export function BOMPanel() {
    const [items, setItems] = useState<BOMItem[]>([])
    const [cutoffThreshold, setCutoffThreshold] = useState(1) // 1% 미만 제외

    const addItem = () => {
        setItems(prev => [...prev, {
            id: `bom-${Date.now()}`,
            name: '',
            weight: 0,
            unit: 'kg',
            materialType: ''
        }])
    }

    const updateItem = (id: string, field: keyof BOMItem, value: string | number) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id))
    }

    // 총 질량 계산
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0)

    // 기여도 및 컷오프 적용
    const itemsWithContribution = items.map(item => {
        const contribution = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0
        const isExcluded = contribution < cutoffThreshold
        return { ...item, contribution, isExcluded }
    }).sort((a, b) => b.contribution - a.contribution)

    const includedCount = itemsWithContribution.filter(i => !i.isExcluded).length
    const excludedCount = itemsWithContribution.filter(i => i.isExcluded).length
    const coverage = itemsWithContribution
        .filter(i => !i.isExcluded)
        .reduce((sum, i) => sum + i.contribution, 0)

    return (
        <Card className="border-amber-500/20">
            <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-amber-500" />
                        <span>BOM 관리 (원재료 목록)</span>
                    </div>
                    <button
                        onClick={addItem}
                        className="px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center gap-1.5"
                    >
                        <Plus className="h-4 w-4" /> 항목 추가
                    </button>
                </CardTitle>
                <CardDescription>
                    원재료 목록을 입력하면 질량 기여도 기반 자동 컷오프가 적용됩니다. (ISO 14067 6.3.4.3)
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* 컷오프 설정 */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <label className="text-xs text-amber-700 font-medium whitespace-nowrap">컷오프 기준:</label>
                    <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={cutoffThreshold}
                        onChange={e => setCutoffThreshold(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-sm rounded border border-amber-300 bg-white text-center"
                    />
                    <span className="text-xs text-amber-600">% 미만 제외</span>
                </div>

                {/* BOM 항목 목록 */}
                {items.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>원재료 항목을 추가하세요.</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {items.map((item, index) => {
                                const withContrib = itemsWithContribution.find(i => i.id === item.id)
                                return (
                                    <div
                                        key={item.id}
                                        className={`p-3 rounded-lg border ${withContrib?.isExcluded
                                                ? 'border-red-200 bg-red-50/50 opacity-60'
                                                : 'border-border/50 bg-muted/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                                            <input
                                                type="text"
                                                placeholder="원재료명"
                                                value={item.name}
                                                onChange={e => updateItem(item.id, 'name', e.target.value)}
                                                className="flex-1 px-2 py-1.5 text-sm rounded border border-border bg-background"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="중량"
                                                value={item.weight || ''}
                                                onChange={e => updateItem(item.id, 'weight', Number(e.target.value))}
                                                className="w-24 px-2 py-1.5 text-sm rounded border border-border bg-background text-right"
                                            />
                                            <span className="text-xs text-muted-foreground">kg</span>
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>

                                        {/* 기여도 바 */}
                                        {withContrib && withContrib.contribution > 0 && (
                                            <div className="flex items-center gap-2 ml-6">
                                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${withContrib.isExcluded ? 'bg-red-400' : 'bg-amber-500'}`}
                                                        style={{ width: `${Math.min(withContrib.contribution, 100)}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-mono ${withContrib.isExcluded ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                    {withContrib.contribution.toFixed(1)}%
                                                </span>
                                                {withContrib.isExcluded && (
                                                    <AlertTriangle className="h-3 w-3 text-red-400" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* 결과 요약 */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                                <div className="text-xs text-green-600 mb-1">포함</div>
                                <div className="text-lg font-bold text-green-700">{includedCount}건</div>
                            </div>
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                                <div className="text-xs text-red-600 mb-1">제외</div>
                                <div className="text-lg font-bold text-red-700">{excludedCount}건</div>
                            </div>
                            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                                <div className="text-xs text-amber-600 mb-1">커버리지</div>
                                <div className="text-lg font-bold text-amber-700">{coverage.toFixed(1)}%</div>
                            </div>
                        </div>

                        {coverage < 95 && items.length > 0 && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
                                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-orange-700">
                                    커버리지가 95% 미만입니다. ISO 14067은 질량 기준 95% 이상의
                                    투입물을 포함할 것을 권장합니다.
                                </p>
                            </div>
                        )}

                        {coverage >= 95 && items.length > 0 && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-green-700">
                                    커버리지 {coverage.toFixed(1)}% — ISO 14067 6.3.4.3 컷오프 기준 충족
                                </p>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
