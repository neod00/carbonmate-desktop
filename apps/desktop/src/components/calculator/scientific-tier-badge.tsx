'use client'

/**
 * ISO 14067 5.5 과학적 근거 등급 배지
 * 배출계수의 과학적 근거 수준을 표시
 */

import { cn } from '@/lib/utils'
import { SCIENTIFIC_TIERS, ScientificTier, determineScientificTier, DataSourceInfo } from '@/lib/core/scientific-tiers'

interface ScientificTierBadgeProps {
    tier: ScientificTier
    size?: 'sm' | 'md'
    showLabel?: boolean
    showDescription?: boolean
}

export function ScientificTierBadge({
    tier,
    size = 'sm',
    showLabel = true,
    showDescription = false
}: ScientificTierBadgeProps) {
    const config = SCIENTIFIC_TIERS[tier]

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded border",
                config.bgColor,
                config.borderColor,
                config.color,
                size === 'sm' ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-xs"
            )}
            title={config.description}
        >
            {tier === 'tier1' && '🟢'}
            {tier === 'tier2' && '🟡'}
            {tier === 'tier3' && '🟠'}
            {tier === 'tier4' && '⚪'}
            {showLabel && <span className="font-medium">{config.label}</span>}
            {showDescription && <span className="text-muted-foreground">({config.labelEn})</span>}
        </span>
    )
}

interface AutoScientificTierBadgeProps {
    dataInfo: DataSourceInfo
    size?: 'sm' | 'md'
    showLabel?: boolean
}

export function AutoScientificTierBadge({
    dataInfo,
    size = 'sm',
    showLabel = true
}: AutoScientificTierBadgeProps) {
    const tier = determineScientificTier(dataInfo)
    return <ScientificTierBadge tier={tier} size={size} showLabel={showLabel} />
}

/**
 * 과학적 등급 범례
 */
export function ScientificTierLegend() {
    return (
        <div className="flex flex-wrap gap-2 text-[10px]">
            <div className="flex items-center gap-1">
                <ScientificTierBadge tier="tier1" size="sm" />
                <span className="text-muted-foreground">측정값</span>
            </div>
            <div className="flex items-center gap-1">
                <ScientificTierBadge tier="tier2" size="sm" />
                <span className="text-muted-foreground">산업평균</span>
            </div>
            <div className="flex items-center gap-1">
                <ScientificTierBadge tier="tier3" size="sm" />
                <span className="text-muted-foreground">국제표준</span>
            </div>
            <div className="flex items-center gap-1">
                <ScientificTierBadge tier="tier4" size="sm" />
                <span className="text-muted-foreground">추정값</span>
            </div>
        </div>
    )
}
