/**
 * Zustand 스토어 회귀 테스트
 *
 * Phase 1 P0-4 (신규 프로젝트 상태 격리) 회귀 방지용.
 * P0-2, P0-3 활동 데이터 흐름 통합 검증 포함.
 *
 * 실행: pnpm test
 */

import { describe, it, expect, beforeEach } from "vitest"
import { usePCFStore } from "./store"
import { calculateStageEmission } from "./emission-calculator"
import { DEFAULT_RECYCLING_ALLOCATION } from "./allocation"

// localStorage 모의 (Node 환경)
const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { store = {} },
        get length() { return Object.keys(store).length },
        key: (i: number) => Object.keys(store)[i] || null
    }
})()

;(globalThis as any).localStorage = localStorageMock

beforeEach(() => {
    localStorageMock.clear()
    // 각 테스트 시작 전에 store를 초기화
    usePCFStore.getState().reset()
})

// =============================================================================
// P0-4: 신규 프로젝트 상태 격리 — reset() 동작 검증
// =============================================================================

describe("P0-4: reset() — 신규 프로젝트 상태 격리", () => {
    it("reset() 호출 시 productInfo가 빈 상태가 되어야 함", () => {
        const store = usePCFStore.getState()
        // 먼저 데이터를 채워둠
        store.setProductInfo({ name: "테스트 제품", category: "test", unit: "1 kg", boundary: "cradle-to-gate", referenceFlow: "" })

        store.reset()
        const after = usePCFStore.getState()
        expect(after.productInfo.name).toBe("")
        expect(after.productInfo.category).toBe("")
    })

    it("reset() 호출 시 raw_materials가 빈 배열이 되어야 함", () => {
        const store = usePCFStore.getState()
        store.addRawMaterial({
            id: "test-mat", stageId: "raw_materials", name: "테스트 원료",
            quantity: 100, unit: "kg", emissionSourceType: "fossil",
            materialType: "metal", customEmissionFactor: 1.5,
            dataQuality: { type: "primary", source: "test", year: 2025, geographicScope: "Korea" }
        })
        expect(usePCFStore.getState().detailedActivityData!.raw_materials!.length).toBe(1)

        store.reset()
        expect(usePCFStore.getState().detailedActivityData!.raw_materials!.length).toBe(0)
    })

    it("reset() 호출 시 모든 활동 데이터(activityData)가 비워져야 함", () => {
        const store = usePCFStore.getState()
        store.setActivityData("electricity", 980)
        store.setActivityData("steam", 850)
        store.setActivityData("waste_general_qty", 320)

        store.reset()
        const data = usePCFStore.getState().activityData as Record<string, unknown>
        expect(data["electricity"]).toBeUndefined()
        expect(data["steam"]).toBeUndefined()
        expect(data["waste_general_qty"]).toBeUndefined()
    })

    it("reset() 호출 시 detailedActivityData의 모든 단계가 비워져야 함", () => {
        const store = usePCFStore.getState()
        store.addRawMaterial({
            id: "m1", stageId: "raw_materials", name: "테스트",
            quantity: 100, unit: "kg", emissionSourceType: "fossil",
            materialType: "metal",
            dataQuality: { type: "primary", source: "test", year: 2025, geographicScope: "Korea" }
        })
        store.addPackagingPart({
            id: "p1", stageId: "packaging", name: "테스트 포장",
            quantity: 10, unit: "kg", emissionSourceType: "fossil",
            materialType: "plastic",
            dataQuality: { type: "primary", source: "test", year: 2025, geographicScope: "Korea" }
        })

        store.reset()
        const detailed = usePCFStore.getState().detailedActivityData!
        expect(detailed.raw_materials!.length).toBe(0)
        expect(detailed.transport!.length).toBe(0)
        expect(detailed.packaging!.length).toBe(0)
        expect(detailed.manufacturing!.electricity.length).toBe(0)
        expect(detailed.manufacturing!.fuels.length).toBe(0)
        expect(detailed.use!.electricity.length).toBe(0)
        expect(detailed.eol!.disposal.length).toBe(0)
    })

    it("reset() 후 신규 데이터 입력이 정상 동작해야 함", () => {
        const store = usePCFStore.getState()
        store.reset()

        store.addRawMaterial({
            id: "new-mat", stageId: "raw_materials", name: "신규 원료",
            quantity: 50, unit: "kg", emissionSourceType: "fossil",
            materialType: "metal", customEmissionFactor: 0.5,
            dataQuality: { type: "primary", source: "test", year: 2025, geographicScope: "Korea" }
        })
        const mats = usePCFStore.getState().detailedActivityData!.raw_materials!
        expect(mats.length).toBe(1)
        expect(mats[0]!.name).toBe("신규 원료")
    })
})

// =============================================================================
// P0-1 + P0-2 + P0-3 통합 흐름 검증 (스토어 → 계산)
// =============================================================================

describe("통합 흐름: 스토어 입력 → 계산 엔진", () => {
    it("스토어에 cut-off 원료 입력 → 계산 결과 0이어야 함", () => {
        const store = usePCFStore.getState()
        store.addRawMaterial({
            id: "cutoff-mat", stageId: "raw_materials", name: "조황산니켈",
            quantity: 1450, unit: "kg", emissionSourceType: "fossil",
            materialType: "metal", customEmissionFactor: 0,
            dataQuality: { type: "primary", source: "test", year: 2025, geographicScope: "Korea" }
        })

        const state = usePCFStore.getState()
        const result = calculateStageEmission("raw_materials", {
            activityData: state.activityData,
            detailedActivityData: state.detailedActivityData,
            recyclingAllocation: DEFAULT_RECYCLING_ALLOCATION
        })
        expect(result.total).toBe(0)
    })

    it("스토어에 스팀+폐기물 입력 → 계산이 모두 반영되어야 함 (P0-2 + P0-3)", () => {
        const store = usePCFStore.getState()
        store.setActivityData("steam", 850)
        store.setActivityData("waste_general_qty", 320)
        store.setActivityData("waste_hazardous_qty", 45)
        store.setActivityData("waste_water_qty", 11)

        const state = usePCFStore.getState()
        const result = calculateStageEmission("manufacturing", {
            activityData: state.activityData,
            detailedActivityData: state.detailedActivityData,
            recyclingAllocation: DEFAULT_RECYCLING_ALLOCATION
        })
        // 스팀 187 + 매립 9.6 + 지정 54 + 폐수 4.4 = 255
        expect(result.total).toBeCloseTo(255, 0)
        const sources = result.details.map(d => d.source)
        expect(sources).toContain("스팀")
        expect(sources).toContain("일반 폐기물 매립")
        expect(sources).toContain("지정 폐기물 처리")
        expect(sources).toContain("산업폐수 처리")
    })

    it("reset() 후 계산 결과가 0이어야 함 (P0-4 회귀 방지)", () => {
        const store = usePCFStore.getState()
        // 먼저 데이터 입력
        store.setActivityData("electricity", 980)
        store.setActivityData("steam", 850)
        store.addRawMaterial({
            id: "m1", stageId: "raw_materials", name: "X",
            quantity: 100, unit: "kg", emissionSourceType: "fossil",
            materialType: "metal", customEmissionFactor: 1.5,
            dataQuality: { type: "primary", source: "test", year: 2025, geographicScope: "Korea" }
        })

        // reset
        store.reset()

        // 계산
        const state = usePCFStore.getState()
        const rmResult = calculateStageEmission("raw_materials", {
            activityData: state.activityData,
            detailedActivityData: state.detailedActivityData,
            recyclingAllocation: DEFAULT_RECYCLING_ALLOCATION
        })
        const mfgResult = calculateStageEmission("manufacturing", {
            activityData: state.activityData,
            detailedActivityData: state.detailedActivityData,
            recyclingAllocation: DEFAULT_RECYCLING_ALLOCATION
        })
        expect(rmResult.total).toBe(0)
        expect(mfgResult.total).toBe(0)
    })
})
