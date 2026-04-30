"use client"

import * as React from "react"
import { Plus, Trash2, Lightbulb } from "lucide-react"
import { useNarrativeStore } from "@/lib/narrative/narrative-store"

const SUGGESTED_TEMPLATES = [
  { label: "PCR 검색 결과", text: "PCR 검색일·검색어·결과 (예: 2026-04-30, EPD International에서 'nickel sulfate' 검색 → 미발견)" },
  { label: "Dataset 선정 사유", text: "특정 dataset을 고른/배제한 사유 (예: 한국 KR dataset 부재로 GLO 선택)" },
  { label: "공급사 기술 정보", text: "공급사가 알려준 기술/공정 정보 (예: NaOH 공급사가 membrane cell 방식)" },
  { label: "이전 측정값", text: "Searates 외 직접 측정한 거리/값" },
  { label: "할당 보류 사유", text: "경제적 배분을 보류한 사유 (예: 매입 단가 미확보)" },
  { label: "산업 맥락", text: "동종 산업 평균값 또는 비교 가능한 다른 발표 자료" },
]

/**
 * 위저드 step 8의 첫 화면 — 사용자가 컨텍스트 메모를 자유 입력.
 *
 * AI가 narrative를 생성할 때 hallucination을 막기 위한 factual claim의 출처가 됨.
 * 모든 메모는 narrative-store에 영속화.
 */
export function ContextMemoInput() {
  const { contextMemos, addMemo, updateMemo, removeMemo } = useNarrativeStore()

  // 처음 진입 시 빈 메모 1개 자동 추가 (입력 유도)
  React.useEffect(() => {
    if (contextMemos.length === 0) {
      addMemo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const insertTemplate = (text: string) => {
    addMemo()
    // 마지막 메모를 채움 — addMemo가 동기적으로 끝나지 않으므로 다음 tick에서
    setTimeout(() => {
      const memos = useNarrativeStore.getState().contextMemos
      const last = memos[memos.length - 1]
      if (last) updateMemo(last.id, text)
    }, 0)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          AI에게 알려줄 컨텍스트 (선택)
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          보고서 narrative를 생성하기 전에, AI가 모를 수 있는 사실 정보를 자유롭게 입력하세요.
          비워두셔도 narrative는 생성되지만, 입력하실수록 정확도와 신뢰도가 높아집니다.
        </p>
      </div>

      {/* 템플릿 제안 */}
      <div className="bg-muted/40 border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          이런 정보를 넣으면 좋아요
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SUGGESTED_TEMPLATES.map((t) => (
            <button
              key={t.label}
              onClick={() => insertTemplate(t.text)}
              className="text-left text-xs bg-background hover:bg-muted border border-border rounded-md px-3 py-2 transition-colors"
            >
              <div className="font-medium text-foreground">{t.label}</div>
              <div className="text-muted-foreground mt-0.5 line-clamp-1">{t.text}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 메모 입력 리스트 */}
      <div className="space-y-3">
        {contextMemos.map((memo, idx) => (
          <div key={memo.id} className="flex gap-2 items-start">
            <div className="text-xs font-mono text-muted-foreground pt-3 w-6 text-right shrink-0">
              {idx + 1}.
            </div>
            <textarea
              value={memo.text}
              onChange={(e) => updateMemo(memo.id, e.target.value)}
              placeholder="예: 2026년 4월 EPD International에서 'nickel sulfate PCR' 검색 결과 미발견"
              className="flex-1 min-h-[60px] bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y"
              spellCheck={false}
              rows={2}
            />
            <button
              onClick={() => removeMemo(memo.id)}
              className="p-2 mt-1 text-muted-foreground hover:text-red-500 transition-colors"
              aria-label="메모 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addMemo}
        className="w-full flex items-center justify-center gap-2 py-3 bg-muted hover:bg-muted/80 border border-dashed border-border rounded-lg text-sm font-medium text-foreground transition-colors"
      >
        <Plus className="h-4 w-4" />
        메모 추가
      </button>

      <p className="text-xs text-muted-foreground">
        총 <b className="text-foreground">{contextMemos.filter((m) => m.text.trim()).length}</b>개 메모 입력됨.
        (권장: 3~10개)
      </p>
    </div>
  )
}
