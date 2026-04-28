/**
 * P1-9 회귀 방어 테스트
 *
 * Cut-off 선택 시 정당화 문구가 "물리적 할당"이 아닌 "Cut-off"로 생성되어야 함.
 * 메소드별 정당화 함수의 모든 분기를 검증.
 */

import { describe, it, expect } from "vitest"
import { generateJustificationForMethod } from "./justification-generator"

describe("P1-9 회귀 방어: 메소드별 정당화 문구 생성", () => {
    describe("재활용 할당 (recycling)", () => {
        it("Cut-off 선택 시 'Cut-off' 문구를 반환해야 함 (run03 P1-9 회귀 핵심)", () => {
            const result = generateJustificationForMethod("recycling", "cut_off", "ko")
            expect(result).toContain("Cut-off")
            expect(result).not.toContain("질량 기준 물리적 할당")
            expect(result).toContain("ISO 14044")
        })

        it("Substitution 선택 시 '대체' 문구", () => {
            const result = generateJustificationForMethod("recycling", "substitution", "ko")
            expect(result).toContain("대체")
            expect(result).toContain("Substitution")
        })

        it("50:50 선택 시 균등 배분 문구", () => {
            const result = generateJustificationForMethod("recycling", "fifty_fifty", "ko")
            expect(result).toContain("50:50")
            expect(result).toContain("균등")
        })

        it("PEF CFF 선택 시 EU PEF 문구", () => {
            const result = generateJustificationForMethod("recycling", "pef_cff", "ko")
            expect(result).toContain("PEF")
        })
    })

    describe("다중 출력 할당 (multiOutput)", () => {
        it("physical_mass 선택 시 '질량 기준 물리적 할당' 문구", () => {
            const result = generateJustificationForMethod("multiOutput", "physical_mass", "ko")
            expect(result).toContain("질량 기준 물리적 할당")
            expect(result).toContain("ISO 14044")
        })

        it("physical_energy 선택 시 '에너지 함량 기준' 문구", () => {
            const result = generateJustificationForMethod("multiOutput", "physical_energy", "ko")
            expect(result).toContain("에너지 함량")
        })

        it("economic 선택 시 '경제적 가치' 문구", () => {
            const result = generateJustificationForMethod("multiOutput", "economic", "ko")
            expect(result).toContain("경제적 가치")
        })

        it("subdivision 선택 시 '공정 세분화' 문구", () => {
            const result = generateJustificationForMethod("multiOutput", "subdivision", "ko")
            expect(result).toContain("공정 세분화")
            expect(result).toContain("회피")
        })
    })

    describe("회귀 핵심 케이스: multiOutput=mass + recycling=cut_off (run03 시나리오)", () => {
        it("두 정당화 문구가 서로 달라야 한다 (run03 P1-9 회귀의 핵심 보장)", () => {
            const moJustif = generateJustificationForMethod("multiOutput", "physical_mass", "ko")
            const recJustif = generateJustificationForMethod("recycling", "cut_off", "ko")

            // multiOutput: "질량 기준 물리적 할당"
            // recycling: "Cut-off"
            // → 두 문구는 서로 다른 방법을 명시해야 함
            expect(moJustif).not.toBe(recJustif)
            expect(moJustif).toContain("질량 기준 물리적 할당")
            expect(recJustif).toContain("Cut-off")
        })
    })

    describe("영문 버전", () => {
        it("Cut-off (en) → 'Cut-off' 표기", () => {
            const result = generateJustificationForMethod("recycling", "cut_off", "en")
            expect(result).toContain("Cut-off")
            expect(result).toContain("ISO 14044")
        })

        it("physical_mass (en) → 'Mass-based' 표기", () => {
            const result = generateJustificationForMethod("multiOutput", "physical_mass", "en")
            expect(result).toContain("Mass-based")
        })
    })
})
