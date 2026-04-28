/**
 * 배출량 계산 엔진 회귀 테스트
 *
 * Phase 1 P0 결함 (1, 2, 3) 회귀 방지용.
 * 카보니 황산니켈 시나리오 기반.
 *
 * 실행: pnpm test
 */

import { describe, it, expect } from "vitest"
import { calculateStageEmission } from "./emission-calculator"
import { DEFAULT_RECYCLING_ALLOCATION } from "./allocation"

const noRecycling = DEFAULT_RECYCLING_ALLOCATION

// =============================================================================
// P0-1: 사용자 입력 EF 우선 + 0(cut-off) 보존
// =============================================================================

describe("P0-1: customEmissionFactor priority and cut-off (0) preservation", () => {
    it("EF=0 (cut-off)이 LCI DB값으로 덮어쓰이지 않고 0 emission으로 처리되어야 한다", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "m1", name: "조황산니켈", quantity: 1450, unit: "kg", customEmissionFactor: 0 }
                ]
            },
            recyclingAllocation: noRecycling
        })
        expect(result.total).toBe(0)
        // 미입력 경고가 아닌 정상 처리되어야 함
        const detail = result.details.find(d => d.source === "조황산니켈")
        expect(detail).toBeDefined()
        expect(detail?.value).toBe(0)
        expect(detail?.emissionFactor).not.toBe("미입력")
    })

    it("EF=0.5 입력 시 weight*0.5로 계산되어야 한다", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "m1", name: "테스트", quantity: 100, unit: "kg", customEmissionFactor: 0.5 }
                ]
            },
            recyclingAllocation: noRecycling
        })
        expect(result.total).toBe(50)
    })

    it("customEmissionFactor가 undefined면 미입력으로 처리되어야 한다", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "m1", name: "미입력 테스트", quantity: 100, unit: "kg" }
                ]
            },
            recyclingAllocation: noRecycling
        })
        expect(result.total).toBe(0)
        const detail = result.details.find(d => d.source.includes("미입력 테스트"))
        expect(detail?.emissionFactor).toBe("미입력")
    })

    it("customEmissionFactor가 음수면 미입력으로 처리되어야 한다", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "m1", name: "음수 테스트", quantity: 100, unit: "kg", customEmissionFactor: -1 }
                ]
            },
            recyclingAllocation: noRecycling
        })
        expect(result.total).toBe(0)
        const detail = result.details.find(d => d.source.includes("음수 테스트"))
        expect(detail?.emissionFactor).toBe("미입력")
    })

    it("황산니켈 시나리오: 두 cut-off 원료 + 일반 원료 혼재", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "m1", name: "조황산니켈", quantity: 1450, unit: "kg", customEmissionFactor: 0 },
                    { id: "m2", name: "배터리 슬러지", quantity: 620, unit: "kg", customEmissionFactor: 0 },
                    { id: "m3", name: "황산", quantity: 60, unit: "kg", customEmissionFactor: 0.14 },
                    { id: "m4", name: "NaOH 100%", quantity: 190, unit: "kg", customEmissionFactor: 1.20 },
                    { id: "m5", name: "H2O2 100%", quantity: 45.5, unit: "kg", customEmissionFactor: 1.50 }
                ]
            },
            recyclingAllocation: noRecycling
        })
        // 황산: 60 * 0.14 = 8.4
        // NaOH: 190 * 1.20 = 228.0
        // H2O2: 45.5 * 1.50 = 68.25
        // 합계 = 304.65
        expect(result.total).toBeCloseTo(304.65, 1)
    })
})

// =============================================================================
// P0-2: 산업용 스팀 입력 및 계산
// =============================================================================

describe("P0-2: 산업용 스팀 (steam) 계산", () => {
    it("스팀 850kg, 기본 EF 0.22로 187 kgCO2e 산정", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { steam: 850 },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const steamDetail = result.details.find(d => d.source === "스팀")
        expect(steamDetail).toBeDefined()
        expect(steamDetail?.value).toBeCloseTo(187, 1)
        expect(steamDetail?.unit).toBe("kg")
    })

    it("스팀 EF 사용자 입력값(0.18) 적용", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { steam: 850, steam_ef: 0.18 },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const steamDetail = result.details.find(d => d.source === "스팀")
        expect(steamDetail?.value).toBeCloseTo(153, 1)
    })

    it("스팀 EF=0 입력 시 0으로 처리 (cut-off)", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { steam: 850, steam_ef: 0 },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const steamDetail = result.details.find(d => d.source === "스팀")
        expect(steamDetail?.value).toBe(0)
    })

    it("스팀 사용량 0이면 항목 자체가 결과에 없어야 함", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { steam: 0 },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const steamDetail = result.details.find(d => d.source === "스팀")
        expect(steamDetail).toBeUndefined()
    })

    it("스팀 + 전력 + 가스 동시 입력 시 합산 검증", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { electricity: 980, gas: 436, steam: 850 },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        // 전력: 980 * 0.4173 = 408.954
        // 가스(MJ): 436 * 0.0561 = 24.4596
        // 스팀: 850 * 0.22 = 187.0
        // 합계 ≈ 620.4
        expect(result.total).toBeCloseTo(620.4, 0)
    })
})

// =============================================================================
// P0-3: 공정 폐기물 처리 입력 및 계산
// =============================================================================

describe("P0-3: 공정 폐기물 처리 계산", () => {
    it("일반 폐기물 매립 320kg, 기본 EF 0.03 → 9.6 kgCO2e", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { waste_general_qty: 320 },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const detail = result.details.find(d => d.source === "일반 폐기물 매립")
        expect(detail?.value).toBeCloseTo(9.6, 2)
    })

    it("지정 폐기물 45kg, 기본 EF 1.20 → 54.0 kgCO2e", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { waste_hazardous_qty: 45 },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const detail = result.details.find(d => d.source === "지정 폐기물 처리")
        expect(detail?.value).toBeCloseTo(54.0, 2)
    })

    it("산업폐수 11m³, 기본 EF 0.40 → 4.4 kgCO2e", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { waste_water_qty: 11 },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const detail = result.details.find(d => d.source === "산업폐수 처리")
        expect(detail?.value).toBeCloseTo(4.4, 2)
        expect(detail?.unit).toBe("m³")
    })

    it("폐기물 3종 동시 입력 시 합계 ≈ 68 kgCO2e (황산니켈 시나리오)", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: {
                waste_general_qty: 320,
                waste_hazardous_qty: 45,
                waste_water_qty: 11
            },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        // 9.6 + 54.0 + 4.4 = 68.0
        expect(result.total).toBeCloseTo(68.0, 1)
    })

    it("사용자 EF 입력 시 기본값을 덮어써야 함 (지정폐기물 0.80)", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { waste_hazardous_qty: 45, waste_hazardous_ef: 0.80 },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const detail = result.details.find(d => d.source === "지정 폐기물 처리")
        expect(detail?.value).toBeCloseTo(36.0, 2) // 45 * 0.80
    })
})

// =============================================================================
// P1 Group A: 단위 정확성
// =============================================================================

describe("P1-A: 다양한 단위 지원 (m³, Nm³, L, kWh, MJ)", () => {
    it("원료를 m³ 단위로 입력 시 EF×수량으로 계산됨 (변환 없음)", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "1", name: "공업용수", quantity: 12.5, unit: "m³", customEmissionFactor: 0.35 }
                ]
            },
            recyclingAllocation: noRecycling
        })
        // 12.5 m³ × 0.35 = 4.375
        expect(result.total).toBeCloseTo(4.375, 2)
        expect(result.details[0]?.unit).toBe("m³")
    })

    it("원료를 L 단위로 입력 시 EF×수량으로 계산됨", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "1", name: "윤활유", quantity: 100, unit: "L", customEmissionFactor: 1.0 }
                ]
            },
            recyclingAllocation: noRecycling
        })
        expect(result.total).toBe(100)
        expect(result.details[0]?.unit).toBe("L")
    })

    it("천연가스 Nm³ 단위 선택 시 EF 2.75 적용", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { gas: 12, gas_unit: "Nm³" as unknown as number },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const gasDetail = result.details.find(d => d.source === "천연가스")
        // 12 Nm³ × 2.75 = 33.0
        expect(gasDetail?.value).toBeCloseTo(33.0, 1)
        expect(gasDetail?.unit).toBe("Nm³")
        expect(gasDetail?.emissionFactor).toContain("Nm³")
    })

    it("천연가스 MJ 단위 (기본) 선택 시 EF 0.0561 적용", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { gas: 437 },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const gasDetail = result.details.find(d => d.source === "천연가스")
        // 437 × 0.0561 ≈ 24.52
        expect(gasDetail?.value).toBeCloseTo(24.52, 1)
        expect(gasDetail?.unit).toBe("MJ")
    })
})

// =============================================================================
// P1 Group A: 운송 트럭 클래스 선택
// =============================================================================

describe("P1-A: 운송 트럭 클래스별 EF", () => {
    it("16-32t 트럭 (medium_large 기본) → EF 0.10 적용", () => {
        const result = calculateStageEmission("transport", {
            activityData: {},
            detailedActivityData: {
                transport: [{ id: "t1", weight: 1450, distance: 270, transportMode: "truck", truckClass: "medium_large" }]
            },
            recyclingAllocation: noRecycling
        })
        // tkm = 1.45 * 270 = 391.5, × 0.10 = 39.15
        expect(result.total).toBeCloseTo(39.15, 1)
    })

    it("32t 초과 대형 트럭 → EF 0.0621 적용", () => {
        const result = calculateStageEmission("transport", {
            activityData: {},
            detailedActivityData: {
                transport: [{ id: "t1", weight: 1450, distance: 270, transportMode: "truck", truckClass: "large" }]
            },
            recyclingAllocation: noRecycling
        })
        // 391.5 × 0.0621 ≈ 24.31
        expect(result.total).toBeCloseTo(24.31, 1)
    })

    it("truckClass 미지정 시 medium_large(16-32t) 기본값 사용", () => {
        const result = calculateStageEmission("transport", {
            activityData: {},
            detailedActivityData: {
                transport: [{ id: "t1", weight: 1450, distance: 270, transportMode: "truck" }]
            },
            recyclingAllocation: noRecycling
        })
        // 기본 16-32t → 0.10
        expect(result.total).toBeCloseTo(39.15, 1)
    })

    it("7.5t 미만 소형 트럭 → EF 0.193 적용", () => {
        const result = calculateStageEmission("transport", {
            activityData: {},
            detailedActivityData: {
                transport: [{ id: "t1", weight: 500, distance: 100, transportMode: "truck", truckClass: "small" }]
            },
            recyclingAllocation: noRecycling
        })
        // 0.5 * 100 * 0.193 = 9.65
        expect(result.total).toBeCloseTo(9.65, 2)
    })
})

// =============================================================================
// P1-run03-01: 용액 농도 (%) 자동 환산
// =============================================================================

describe("P1-run03-01: 용액 농도(%) 환산", () => {
    it("NaOH 50% 용액 380kg + EF 1.20 → 190kg × 1.20 = 228 kgCO2e", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "1", name: "NaOH 용액", quantity: 380, unit: "kg", customEmissionFactor: 1.20, concentrationPercent: 50 } as any
                ]
            },
            recyclingAllocation: noRecycling
        })
        // 380 * (50/100) * 1.20 = 228
        expect(result.total).toBeCloseTo(228, 1)
    })

    it("H2O2 35% 용액 130kg + EF 1.50 → 45.5kg × 1.50 = 68.25 kgCO2e", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "1", name: "H2O2 용액", quantity: 130, unit: "kg", customEmissionFactor: 1.50, concentrationPercent: 35 } as any
                ]
            },
            recyclingAllocation: noRecycling
        })
        // 130 * 0.35 * 1.50 = 68.25
        expect(result.total).toBeCloseTo(68.25, 1)
    })

    it("농도 100% 또는 미입력 시 환산하지 않음", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "1", name: "순물질", quantity: 100, unit: "kg", customEmissionFactor: 1.0, concentrationPercent: 100 } as any
                ]
            },
            recyclingAllocation: noRecycling
        })
        expect(result.total).toBe(100)
    })

    it("농도 0% 또는 음수는 무시 (환산 안 함)", () => {
        const result = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "1", name: "테스트", quantity: 100, unit: "kg", customEmissionFactor: 1.0, concentrationPercent: 0 } as any
                ]
            },
            recyclingAllocation: noRecycling
        })
        expect(result.total).toBe(100)
    })
})

// =============================================================================
// P2-run03-02 (인계 직전 수정): 전력 EF 사용자 직접 입력
// =============================================================================

describe("P2-run03-02: 전력 EF override (컨설턴트 보유 데이터셋 적용)", () => {
    it("electricity_ef_override가 있으면 그리드 EF 대신 적용됨", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: {
                electricity: 980,
                electricity_grid: "electricity_korea_2023_consumption",
                electricity_ef_override: 0.4594 // 사용자 입력 (예: KLCI 데이터)
            } as any,
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const elecDetail = result.details.find(d => d.source.includes("전력"))
        // 980 × 0.4594 = 450.21 (앱 내장 0.4173 대신 사용자 0.4594 적용)
        expect(elecDetail?.value).toBeCloseTo(450.21, 1)
        expect(elecDetail?.emissionFactor).toContain("0.4594")
        expect(elecDetail?.source).toContain("사용자 EF")
    })

    it("electricity_ef_override 미설정 시 그리드 EF 기본 적용 (회귀 보장)", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: { electricity: 980, electricity_grid: "electricity_korea_2023_consumption" },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const elecDetail = result.details.find(d => d.source === "전력")
        // 980 × 0.4173 = 408.95
        expect(elecDetail?.value).toBeCloseTo(408.95, 1)
        expect(elecDetail?.source).toBe("전력") // "사용자 EF" 표기 없음
    })

    it("electricity_ef_override가 0 (cut-off)이면 0으로 적용", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: {
                electricity: 980,
                electricity_ef_override: 0 // 재생에너지 100% PPA 등
            } as any,
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const elecDetail = result.details.find(d => d.source.includes("전력"))
        expect(elecDetail?.value).toBe(0)
        expect(elecDetail?.source).toContain("사용자 EF")
    })

    it("electricity_ef_override 음수는 무시 → 그리드 EF로 fallback", () => {
        const result = calculateStageEmission("manufacturing", {
            activityData: {
                electricity: 980,
                electricity_grid: "electricity_korea_2023_consumption",
                electricity_ef_override: -1
            } as any,
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        const elecDetail = result.details.find(d => d.source === "전력")
        // 음수 무시 → 그리드 EF 0.4173 적용
        expect(elecDetail?.value).toBeCloseTo(408.95, 1)
    })
})

// =============================================================================
// 포장재 EF override (인계 직전 수정)
// =============================================================================

describe("포장재 EF override (컨설턴트 보유 데이터셋 적용)", () => {
    it("packaging.customEmissionFactor가 있으면 앱 내장 EF 대신 적용됨", () => {
        const result = calculateStageEmission("packaging", {
            activityData: {},
            detailedActivityData: {
                packaging: [
                    { id: "p1", name: "FIBC 빅백", quantity: 2.0, unit: "kg", materialType: "material_plastic_pp", customEmissionFactor: 2.00 } as any
                ]
            },
            recyclingAllocation: noRecycling
        })
        // 2.0 × 2.00 = 4.00 (앱 내장 1.86 대신 사용자 2.00 적용)
        expect(result.total).toBeCloseTo(4.00, 2)
        const detail = result.details.find(d => d.source.includes("FIBC"))
        expect(detail?.source).toContain("사용자 EF")
    })

    it("customEmissionFactor 미설정 시 앱 내장 EF 적용 (회귀 보장)", () => {
        const result = calculateStageEmission("packaging", {
            activityData: {},
            detailedActivityData: {
                packaging: [
                    { id: "p1", name: "FIBC", quantity: 2.0, unit: "kg", materialType: "material_plastic_pp" } as any
                ]
            },
            recyclingAllocation: noRecycling
        })
        // 2.0 × 1.86 (PP 앱 내장) = 3.72
        expect(result.total).toBeCloseTo(3.72, 2)
        const detail = result.details.find(d => d.source === "FIBC") // "사용자 EF" 표기 없음
        expect(detail).toBeDefined()
    })

    it("customEmissionFactor=0 (cut-off, 재활용 빅백 등) 적용", () => {
        const result = calculateStageEmission("packaging", {
            activityData: {},
            detailedActivityData: {
                packaging: [
                    { id: "p1", name: "재활용 빅백", quantity: 2.0, unit: "kg", materialType: "material_plastic_pp", customEmissionFactor: 0 } as any
                ]
            },
            recyclingAllocation: noRecycling
        })
        expect(result.total).toBe(0)
    })
})

// =============================================================================
// 통합 회귀: 황산니켈 전체 시나리오
// =============================================================================

describe("통합: 토리컴 황산니켈 1톤 시나리오 전체 검증", () => {
    it("정정 CFP가 카보니 산정값 1,057 kgCO2e/ton에 근접해야 함", () => {
        // 원료 채취
        const rawMatResult = calculateStageEmission("raw_materials", {
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: "1", name: "조황산니켈", quantity: 1450, unit: "kg", customEmissionFactor: 0 },
                    { id: "2", name: "배터리 슬러지", quantity: 620, unit: "kg", customEmissionFactor: 0 },
                    { id: "3", name: "황산", quantity: 60, unit: "kg", customEmissionFactor: 0.14 },
                    { id: "4", name: "NaOH(100%환산)", quantity: 190, unit: "kg", customEmissionFactor: 1.20 },
                    { id: "5", name: "H2O2(100%환산)", quantity: 45.5, unit: "kg", customEmissionFactor: 1.50 },
                    { id: "6", name: "공업용수", quantity: 12500, unit: "kg", customEmissionFactor: 0.00035 }
                    // 공업용수 12.5 m³ ≈ 12500 kg (밀도 1), EF 0.35/m³ → 0.00035/kg
                    // 12500 * 0.00035 = 4.375
                ]
            },
            recyclingAllocation: noRecycling
        })
        // 8.4 + 228 + 68.25 + 4.375 ≈ 309
        expect(rawMatResult.total).toBeCloseTo(309, 0)

        // 제조 (전력 + LNG + 스팀 + 폐기물)
        const mfgResult = calculateStageEmission("manufacturing", {
            activityData: {
                electricity: 980,
                gas: 436, // 12 Nm³ ≈ 436 MJ
                steam: 850,
                steam_ef: 0.22,
                waste_general_qty: 320,
                waste_hazardous_qty: 45,
                waste_water_qty: 11
            },
            detailedActivityData: null,
            recyclingAllocation: noRecycling
        })
        // 전력 408.95 + 가스 24.46 + 스팀 187 + 폐기물 68 ≈ 688
        expect(mfgResult.total).toBeCloseTo(688, 0)

        const total = rawMatResult.total + mfgResult.total
        // 운송·포장 (~60 kgCO2e) 미포함이므로 1057이 아닌 ~997이 기대치
        // 카보니 산정 정정값: 원료 309 + 제조 670 + 운송 56 + 폐기물 68 + 포장 4 = 1107
        // 본 테스트에서는 폐기물을 제조에 포함하므로 ≈ 997 (운송+포장 별도)
        expect(total).toBeGreaterThan(950)
        expect(total).toBeLessThan(1050)
    })
})
