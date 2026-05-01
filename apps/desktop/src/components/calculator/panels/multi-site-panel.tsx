"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Plus, Trash2, Building2, Calculator } from "lucide-react"

interface SiteEntry {
    id: string
    name: string
    location: string
    production: number
    cfp: number
}

export function MultiSitePanel() {
    const [sites, setSites] = useState<SiteEntry[]>([])

    const addSite = () => {
        setSites(prev => [...prev, {
            id: `site-${Date.now()}`,
            name: '',
            location: '',
            production: 0,
            cfp: 0
        }])
    }

    const updateSite = (id: string, field: keyof SiteEntry, value: string | number) => {
        setSites(prev => prev.map(site =>
            site.id === id ? { ...site, [field]: value } : site
        ))
    }

    const removeSite = (id: string) => {
        setSites(prev => prev.filter(site => site.id !== id))
    }

    // 가중 평균 CFP 계산
    const totalProduction = sites.reduce((sum, s) => sum + (s.production || 0), 0)
    const weightedCFP = totalProduction > 0
        ? sites.reduce((sum, s) => {
            const weight = (s.production || 0) / totalProduction
            return sum + weight * (s.cfp || 0)
        }, 0)
        : 0

    // 사업장별 기여도
    const sitesWithWeight = sites.map(s => ({
        ...s,
        weight: totalProduction > 0 ? ((s.production || 0) / totalProduction * 100) : 0,
        contribution: totalProduction > 0 ? ((s.production || 0) / totalProduction * (s.cfp || 0)) : 0
    }))

    return (
        <Card className="border-violet-500/10 bg-muted/20">
            <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-violet-500" />
                        <span>다중 사업장 가중 평균</span>
                    </div>
                    <button
                        onClick={addSite}
                        className="px-3 py-1.5 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors flex items-center gap-1.5"
                    >
                        <Plus className="h-4 w-4" /> 사업장 추가
                    </button>
                </CardTitle>
                <CardDescription>
                    동일 제품을 여러 사업장에서 생산하는 경우, 생산량 기반 가중 평균 CFP를 산출합니다.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {sites.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>사업장을 추가하여 다중 사이트 CFP를 계산하세요.</p>
                    </div>
                ) : (
                    <>
                        {sites.map((site, index) => (
                            <div key={site.id} className="p-4 rounded-lg border border-border bg-muted/40 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-violet-400">사업장 {index + 1}</span>
                                    <button
                                        onClick={() => removeSite(site.id)}
                                        className="p-1.5 rounded hover:bg-red-500/10 text-red-400/80 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">사업장명</label>
                                        <input
                                            type="text"
                                            placeholder="예: 수원 공장"
                                            value={site.name}
                                            onChange={e => updateSite(site.id, 'name', e.target.value)}
                                            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">소재지</label>
                                        <input
                                            type="text"
                                            placeholder="예: 대한민국"
                                            value={site.location}
                                            onChange={e => updateSite(site.id, 'location', e.target.value)}
                                            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">연간 생산량 (단위)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={site.production || ''}
                                            onChange={e => updateSite(site.id, 'production', Number(e.target.value))}
                                            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">CFP (kgCO₂e/단위)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={site.cfp || ''}
                                            onChange={e => updateSite(site.id, 'cfp', Number(e.target.value))}
                                            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* 가중치 표시 */}
                                {sitesWithWeight.find(s => s.id === site.id)?.weight! > 0 && (
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-violet-500"
                                                style={{ width: `${sitesWithWeight.find(s => s.id === site.id)?.weight || 0}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-mono text-muted-foreground">
                                            {(sitesWithWeight.find(s => s.id === site.id)?.weight || 0).toFixed(1)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* 결과 */}
                        <div className="p-4 rounded-lg bg-violet-600/10 border border-violet-500/20">
                            <div className="flex items-center gap-2 mb-3">
                                <Calculator className="h-4 w-4 text-violet-400" />
                                <span className="font-medium text-sm text-violet-300">가중 평균 CFP</span>
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                                {weightedCFP.toFixed(4)}
                                <span className="text-sm font-normal text-violet-400 ml-2">kgCO₂e/단위</span>
                            </div>
                            <p className="text-xs text-violet-400/80 mt-1">
                                {sites.length}개 사업장 | 총 생산량 {totalProduction.toLocaleString()} 단위
                            </p>
                        </div>

                        {/* 사업장 비교 차트 */}
                        {sites.filter(s => s.cfp > 0).length >= 2 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-medium text-muted-foreground">사업장별 CFP 비교</h4>
                                {sitesWithWeight
                                    .filter(s => s.cfp > 0)
                                    .sort((a, b) => b.cfp - a.cfp)
                                    .map(site => {
                                        const maxCFP = Math.max(...sitesWithWeight.map(s => s.cfp))
                                        return (
                                            <div key={site.id} className="flex items-center gap-2">
                                                <span className="text-xs w-24 truncate">{site.name || '미지정'}</span>
                                                <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                                                    <div
                                                        className="h-full bg-violet-500/80 rounded"
                                                        style={{ width: `${maxCFP > 0 ? (site.cfp / maxCFP) * 100 : 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-mono w-16 text-right">{site.cfp.toFixed(2)}</span>
                                            </div>
                                        )
                                    })}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
