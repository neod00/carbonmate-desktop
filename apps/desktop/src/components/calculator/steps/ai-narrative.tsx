"use client"

import * as React from "react"
import { ArrowRight, ArrowLeft } from "lucide-react"
import { ContextMemoInput } from "../narrative/context-memo-input"
import { NarrativeReviewPanel } from "../narrative/narrative-review-panel"

type SubStep = "memos" | "review"

/**
 * 위저드 step 8 — AI 보고서 narrative.
 *
 * 두 sub-step:
 *   1. 컨텍스트 메모 입력 (사용자 자유 입력으로 AI hallucination 방지)
 *   2. 6개 narrative 자동 생성 + 검토
 *
 * 두 sub-step 간 이동은 step 내부 버튼으로 처리 (위저드 진행과 분리).
 * step 8 자체는 위저드의 "다음" 버튼으로 step 9 (보고서)로 이동.
 */
export function AINarrativeStep() {
  const [sub, setSub] = React.useState<SubStep>("memos")

  return (
    <div className="space-y-6">
      {/* 서브 진행 인디케이터 */}
      <div className="flex items-center gap-3">
        <SubBadge active={sub === "memos"} done={sub === "review"} label="1. 컨텍스트 메모" />
        <div className="flex-1 h-px bg-border" />
        <SubBadge active={sub === "review"} done={false} label="2. narrative 검토" />
      </div>

      {/* 본문 */}
      {sub === "memos" ? (
        <>
          <ContextMemoInput />
          <div className="flex justify-end">
            <button
              onClick={() => setSub("review")}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              다음 — narrative 생성/검토
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <>
          <NarrativeReviewPanel />
          <div className="flex justify-start">
            <button
              onClick={() => setSub("memos")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-muted hover:bg-muted/70 text-foreground rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              컨텍스트 메모로 돌아가기
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function SubBadge({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
        active
          ? "bg-emerald-600 text-white border-emerald-600"
          : done
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
            : "bg-muted text-muted-foreground border-border"
      }`}
    >
      {label}
    </div>
  )
}
