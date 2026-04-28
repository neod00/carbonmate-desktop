/**
 * P1-8 회귀 방어 테스트
 *
 * 민감도 분석에서 고기여 시약(NaOH, H2O2 등)이 자동 시나리오로 포함되어야 함.
 */

import { describe, it, expect } from "vitest"
import { analyzeRawMaterialSensitivity } from "./sensitivity-analysis"

describe("P1-8 회귀 방어: 원자재 민감도 자동 식별", () => {
    const baselineCFP = 1000

    it("고기여 시약(NaOH 228 kgCO2e)이 시나리오에 포함되어야 함", () => {
        const rawMaterials = [
            { id: "1", name: "NaOH", quantity: 190, unit: "kg", customEmissionFactor: 1.20 },
            { id: "2", name: "황산", quantity: 60, unit: "kg", customEmissionFactor: 0.14 },
            { id: "3", name: "조황산니켈", quantity: 1450, unit: "kg", customEmissionFactor: 0 } // cut-off
        ]
        const scenarios = analyzeRawMaterialSensitivity(rawMaterials, baselineCFP)

        const naohScenarios = scenarios.filter(s => s.name.includes("NaOH"))
        expect(naohScenarios.length).toBe(2) // +20%, -20%
        expect(naohScenarios[0]?.absoluteChange).toBeCloseTo(228 * 0.20, 1) // 45.6
    })

    it("Cut-off(EF=0) 원료는 시나리오에서 제외되어야 함 (기여도 0)", () => {
        const rawMaterials = [
            { id: "1", name: "조황산니켈", quantity: 1450, unit: "kg", customEmissionFactor: 0 },
            { id: "2", name: "배터리 슬러지", quantity: 620, unit: "kg", customEmissionFactor: 0 },
            { id: "3", name: "NaOH", quantity: 190, unit: "kg", customEmissionFactor: 1.20 }
        ]
        const scenarios = analyzeRawMaterialSensitivity(rawMaterials, baselineCFP)

        const cutoffScenarios = scenarios.filter(s =>
            s.name.includes("조황산니켈") || s.name.includes("배터리 슬러지")
        )
        expect(cutoffScenarios.length).toBe(0)

        // NaOH는 포함
        const naohScenarios = scenarios.filter(s => s.name.includes("NaOH"))
        expect(naohScenarios.length).toBe(2)
    })

    it("기여도 상위 N개로 제한 (default 5)", () => {
        const rawMaterials = Array.from({ length: 10 }, (_, i) => ({
            id: `m${i}`,
            name: `Material${i}`,
            quantity: 100,
            unit: "kg",
            customEmissionFactor: 10 - i * 0.5 // 기여도 차등
        }))
        const scenarios = analyzeRawMaterialSensitivity(rawMaterials, baselineCFP)

        // 상위 5개 × ±20% = 10개 시나리오
        expect(scenarios.length).toBe(10)
        // 가장 높은 기여도(Material0, EF=10) 포함
        expect(scenarios.find(s => s.name.includes("Material0"))).toBeTruthy()
        // 가장 낮은 기여도(Material9)는 제외
        expect(scenarios.find(s => s.name.includes("Material9"))).toBeFalsy()
    })

    it("농도(%) 적용 후 기여도 계산 — H2O2 35% 130kg", () => {
        const rawMaterials = [
            { id: "1", name: "H2O2 용액", quantity: 130, unit: "kg", customEmissionFactor: 1.50, concentrationPercent: 35 }
        ]
        const scenarios = analyzeRawMaterialSensitivity(rawMaterials, baselineCFP)

        // 130 × 0.35 × 1.50 = 68.25 기여도
        // ±20% 시나리오 = ±13.65
        expect(scenarios[0]?.absoluteChange).toBeCloseTo(68.25 * 0.20, 1)
    })

    it("빈 raw_materials 배열 → 빈 시나리오", () => {
        const scenarios = analyzeRawMaterialSensitivity([], baselineCFP)
        expect(scenarios).toEqual([])
    })

    it("토리컴 황산니켈 시나리오 — NaOH가 가장 큰 단일 기여, 시나리오 1순위", () => {
        const rawMaterials = [
            { id: "1", name: "조황산니켈", quantity: 1450, unit: "kg", customEmissionFactor: 0 },
            { id: "2", name: "배터리 슬러지", quantity: 620, unit: "kg", customEmissionFactor: 0 },
            { id: "3", name: "황산", quantity: 60, unit: "kg", customEmissionFactor: 0.14 },
            { id: "4", name: "NaOH", quantity: 190, unit: "kg", customEmissionFactor: 1.20 },
            { id: "5", name: "H2O2", quantity: 45.5, unit: "kg", customEmissionFactor: 1.50 }
        ]
        const scenarios = analyzeRawMaterialSensitivity(rawMaterials, baselineCFP)

        // NaOH (228) > H2O2 (68.25) > 황산 (8.4)
        // 시나리오는 기여도 순으로 정렬되어 있어야 함
        const highScenarios = scenarios.filter(s => s.id.endsWith("_high"))
        expect(highScenarios[0]?.name).toContain("NaOH")
    })
})
