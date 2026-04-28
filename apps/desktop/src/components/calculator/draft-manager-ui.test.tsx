/**
 * DraftManagerPanel 컴포넌트 테스트
 *
 * P0-4 회귀 방지: "신규 프로젝트 시작" 버튼이 렌더링되고
 * 클릭 시 확인 다이얼로그를 거쳐 store.reset()을 호출해야 함.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DraftManagerPanel } from "./draft-manager-ui"
import { usePCFStore } from "@/lib/core/store"

beforeEach(() => {
    cleanup()
    localStorage.clear()
    usePCFStore.getState().reset()
})

describe("P0-4 컴포넌트 회귀: DraftManagerPanel 신규 시작 버튼", () => {
    it("패널을 열면 '신규 프로젝트 시작' 버튼이 보여야 한다", async () => {
        const user = userEvent.setup()
        render(<DraftManagerPanel />)

        // 패널 토글 버튼 클릭
        await user.click(screen.getByRole("button", { name: /임시저장/ }))

        // "신규 프로젝트 시작" 버튼 등장 확인
        const newProjectBtn = screen.getByRole("button", {
            name: /신규 프로젝트 시작/
        })
        expect(newProjectBtn).toBeInTheDocument()
    })

    it("'신규 프로젝트 시작' 클릭 시 확인 다이얼로그가 표시되어야 한다", async () => {
        const user = userEvent.setup()
        render(<DraftManagerPanel />)

        await user.click(screen.getByRole("button", { name: /임시저장/ }))
        await user.click(screen.getByRole("button", { name: /신규 프로젝트 시작/ }))

        expect(screen.getByText(/모든 활동 데이터·DQR·할당 설정이 초기화/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /초기화하고 신규 시작/ })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /^취소$/ })).toBeInTheDocument()
    })

    it("확인 클릭 시 store가 reset되어 데이터가 비워져야 한다", async () => {
        const user = userEvent.setup()

        // 먼저 데이터 채워둠
        const store = usePCFStore.getState()
        store.addRawMaterial({
            id: "test1", stageId: "raw_materials", name: "테스트 원료",
            quantity: 100, unit: "kg", emissionSourceType: "fossil",
            materialType: "metal", customEmissionFactor: 1.5,
            dataQuality: { type: "primary", source: "test", year: 2025, geographicScope: "Korea" }
        })
        expect(usePCFStore.getState().detailedActivityData!.raw_materials!.length).toBe(1)

        // 패널 열고 신규 시작 진행
        render(<DraftManagerPanel />)
        await user.click(screen.getByRole("button", { name: /임시저장/ }))
        await user.click(screen.getByRole("button", { name: /신규 프로젝트 시작/ }))
        await user.click(screen.getByRole("button", { name: /초기화하고 신규 시작/ }))

        // store 초기화 확인
        expect(usePCFStore.getState().detailedActivityData!.raw_materials!.length).toBe(0)
    })

    it("취소 클릭 시 store가 변경되지 않아야 한다", async () => {
        const user = userEvent.setup()
        const store = usePCFStore.getState()
        store.addRawMaterial({
            id: "test1", stageId: "raw_materials", name: "유지될 원료",
            quantity: 100, unit: "kg", emissionSourceType: "fossil",
            materialType: "metal",
            dataQuality: { type: "primary", source: "test", year: 2025, geographicScope: "Korea" }
        })

        render(<DraftManagerPanel />)
        await user.click(screen.getByRole("button", { name: /임시저장/ }))
        await user.click(screen.getByRole("button", { name: /신규 프로젝트 시작/ }))
        await user.click(screen.getByRole("button", { name: /^취소$/ }))

        // 데이터 보존 확인
        expect(usePCFStore.getState().detailedActivityData!.raw_materials!.length).toBe(1)
    })
})
