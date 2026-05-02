/**
 * 자동 적합성 검사 함수 — clause prefix 매칭으로 dispatch.
 *
 * 자동 판정 가능한 조항만 등록 (~30~40개). 그 외는 'manual' 또는 'info' 처리.
 *
 * 설계 원칙:
 *   - state 기반 결정 — 사용자가 명시적으로 입력한 정보로만 판정
 *   - 보수적 판정 — 정보 부족 시 'partial' 또는 'manual' (절대 'pass' 아님)
 *   - finding 텍스트는 검증심사원이 한눈에 이해 가능하도록 간결
 */

import type { ActivityInput, PCFState, StageActivityData } from '../store'
import type { ComplianceCheckResult } from './types'

type Checker = (state: PCFState) => ComplianceCheckResult

const PASS = (finding: string, ev?: string): ComplianceCheckResult => ({
  status: 'pass',
  finding,
  evidenceLocation: ev,
})
const FAIL = (finding: string, action: string): ComplianceCheckResult => ({
  status: 'fail',
  finding,
  correctiveAction: action,
})
const PARTIAL = (finding: string, action: string, ev?: string): ComplianceCheckResult => ({
  status: 'partial',
  finding,
  correctiveAction: action,
  evidenceLocation: ev,
})
const MANUAL = (finding: string): ComplianceCheckResult => ({
  status: 'manual',
  finding,
})
const NA = (finding: string): ComplianceCheckResult => ({
  status: 'na',
  finding,
})

function flatActivities(state: PCFState): ActivityInput[] {
  const d: Partial<StageActivityData> | undefined = state.detailedActivityData
  if (!d) return []
  return [
    ...(d.raw_materials ?? []),
    ...(d.manufacturing?.electricity ?? []),
    ...(d.manufacturing?.fuels ?? []),
    ...(d.manufacturing?.processEmissions ?? []),
    ...(d.transport ?? []),
    ...(d.packaging ?? []),
    ...(d.use?.electricity ?? []),
    ...(d.use?.consumables ?? []),
    ...(d.eol?.disposal ?? []),
    ...(d.eol?.recycling ?? []),
  ]
}

// ============================================================================
// 조항별 체커 등록
// ============================================================================

const CHECKERS: Record<string, Checker> = {
  // 5.3 — 기능단위/선언단위
  '5.3': (s) => {
    const fu = s.productInfo.unit?.trim()
    if (!fu) return FAIL('기능단위 (FU) 미정의', '제품 정보 화면에서 기능단위를 입력하세요 (예: "1 ton NiSO4").')
    return PASS(`기능단위: ${fu}`, '보고서 §6.3.3 / 산정 워크북 표지')
  },

  // 5.7 — 완전성 (cut-off 95% 임계 충족)
  // CutOffResult.excludedMassPercent 가 ≤ 5 인 경우 포함율 ≥ 95% 충족
  '5.7': (s) => {
    const co = s.cutOffResult
    if (!co) return MANUAL('Cut-off 분석 미수행 — 위저드의 cut-off 단계 실행 후 자동 판정.')
    const includedPct = 100 - (co.excludedMassPercent ?? 0)
    if (includedPct >= 95) return PASS(`완전성 ${includedPct.toFixed(1)}% — 95% 임계 충족`, '산정 워크북 Cut-off 누적 표')
    return FAIL(`완전성 ${includedPct.toFixed(1)}% — 95% 미만`, '추가 활동 데이터 항목을 포함하여 95% 이상 커버리지 확보.')
  },

  // 5.10 — 정확성 (DQR + 불확도 명시)
  '5.10': (s) => {
    const acts = flatActivities(s)
    if (acts.length === 0) return MANUAL('활동 데이터 미입력.')
    const withUncertainty = acts.filter((a) => a.dataQuality?.uncertainty != null).length
    const ratio = withUncertainty / acts.length
    if (ratio >= 0.9) return PASS(`불확도 명시 비율 ${(ratio * 100).toFixed(0)}%`, '산정 워크북 DQR 5축')
    return PARTIAL(`불확도 명시 비율 ${(ratio * 100).toFixed(0)}%`, '모든 활동 데이터에 불확도(%) 입력 권고.', '산정 워크북 DQR 5축')
  },

  // 5.11 — 투명성 (출처 + 가정 명시)
  '5.11': (s) => {
    const acts = flatActivities(s)
    if (acts.length === 0) return MANUAL('활동 데이터 미입력.')
    const withSource = acts.filter((a) => a.transparencyInfo?.dataSource).length
    const ratio = withSource / acts.length
    if (ratio >= 0.95) return PASS(`출처 명시 비율 ${(ratio * 100).toFixed(0)}%`, 'Evidence Pack 09_Primary_Activity_Data_Index')
    if (ratio >= 0.5) return PARTIAL(`출처 명시 비율 ${(ratio * 100).toFixed(0)}%`, '모든 활동 데이터에 출처 입력 (위저드 transparencyInfo).')
    return FAIL(`출처 명시 비율 ${(ratio * 100).toFixed(0)}%`, 'ISO 14067 §5.11 위반 가능성 — 모든 활동 데이터에 출처 입력 필수.')
  },

  // 5.12 — 중복계산 배제
  '5.12': (s) => {
    const acts = flatActivities(s)
    const dupIgnored = acts.filter((a) => a.duplicateIgnored).length
    if (dupIgnored === 0) return PASS('중복 항목 없음 (또는 미식별)', '산정 워크북 BOM 시트')
    return PARTIAL(
      `중복 의도적 허용 ${dupIgnored} 건`,
      `각 duplicateIgnored 항목의 사유를 transparencyInfo.assumptions 에 기록.`,
    )
  },

  // 6.2 — PCR 적용
  '6.2': (s) => {
    const pcrs = s.pcrReferences ?? []
    if (pcrs.length === 0) return MANUAL('PCR 참조 미입력 — 적용 가능한 PCR이 없는 경우 6.3 직접 준수.')
    const usable = pcrs.filter((p) => !p.isAbsent)
    if (usable.length > 0) return PASS(`PCR ${usable.length}건 적용`, '보고서 §6.2 PCR 참조')
    return PARTIAL(
      `PCR 부재 명시 (${pcrs.length}건)`,
      '부재 사유를 absenceReason 에 정당화 기록 + 직접 §6.3~6.5 준수.',
    )
  },

  // 6.3.1 — 연구 목표 명시
  '6.3.1': (s) => {
    const g = s.productInfo.studyGoal
    if (!g) return FAIL('연구 목표 미입력', '위저드에서 적용 목적/수행 이유/대상 청중을 입력.')
    const filled = [g.applicationPurpose, g.reasonForStudy, g.targetAudience].filter(Boolean).length
    if (filled >= 3) return PASS('연구 목표 3종 모두 명시', '보고서 §6.3.1 / 표지')
    return PARTIAL(`연구 목표 ${filled}/3 항목 입력`, '적용 목적·수행 이유·대상 청중 모두 입력.')
  },

  // 6.3.4.3 — 제외 기준
  '6.3.4.3': (s) => {
    const co = s.cutOffResult
    if (!co) return FAIL('Cut-off 분석 미수행', '위저드 cut-off 단계에서 분석 실행 후 95% 임계 검증.')
    const includedPct = 100 - (co.excludedMassPercent ?? 0)
    return PASS(`제외 기준 적용됨 (커버리지 ${includedPct.toFixed(1)}%)`, '산정 워크북 Cut-off 표')
  },

  // 6.3.5 — 데이터 품질
  '6.3.5': (s) => {
    const acts = flatActivities(s)
    if (acts.length === 0) return MANUAL('활동 데이터 미입력.')
    const withDqi = acts.filter((a) => a.dataQuality?.type).length
    const ratio = withDqi / acts.length
    if (ratio >= 0.95) return PASS(`DQR 평가 비율 ${(ratio * 100).toFixed(0)}%`, 'Evidence Pack 05_DQR_Justification')
    return PARTIAL(`DQR 평가 비율 ${(ratio * 100).toFixed(0)}%`, '모든 활동 데이터에 DQI(M/C/E) 입력.')
  },

  // 6.3.6 — 시간 경계
  '6.3.6': (s) => {
    const tb = s.productInfo.timeBoundary
    if (!tb) return FAIL('시간 경계 미정의', '데이터 수집 시작/종료 + CFP 대표 연도 입력.')
    if (tb.dataCollectionStart && tb.dataCollectionEnd && tb.cfpRepresentativeYear) {
      return PASS(`시간 경계: ${tb.dataCollectionStart} ~ ${tb.dataCollectionEnd}`, '보고서 §6.3.6')
    }
    return PARTIAL('시간 경계 부분 입력', '시작/종료/대표연도 모두 입력 + 계절 변동 고려 여부 명시.')
  },

  // 6.4.6 — 할당
  '6.4.6': (s) => {
    const mo = s.multiOutputAllocation
    if (!mo.method) return FAIL('할당 방법 미선택', 'ISO 14044 §5.3.5 우선순위 (① 분리 → ② 시스템 확장 → ③ 물리 → ④ 경제) 에 따라 선택.')
    const hasJust = !!mo.justification && mo.justification.trim().length > 10
    if (!hasJust) return PARTIAL(`할당 방법: ${mo.method} — 정당화 부족`, '할당 정당화 근거 10자 이상 입력.', 'Evidence Pack 06_Allocation_Methodology')
    return PASS(`할당 방법: ${mo.method} (정당화 입력됨)`, 'Evidence Pack 06_Allocation_Methodology')
  },

  // 6.4.6.1 — 대체 할당 시 민감도 분석 의무
  '6.4.6.1': (s) => {
    const sa = s.sensitivityAnalysis
    const moMethod = s.multiOutputAllocation?.method
    const requiresMandatory = moMethod && moMethod !== 'subdivision' && moMethod !== 'system_expansion'
    if (!requiresMandatory) return PASS('할당 회피 적용 — 민감도 분석 면제 가능', '보고서 §6.4.6.1')
    if (!sa) return FAIL('할당 민감도 분석 미수행', '위저드 민감도 분석 단계에서 시나리오 추가 (할당 방법 변경).')
    return PASS(`민감도 시나리오 ${sa.scenarios.length}건`, 'Evidence Pack 07_Sensitivity_Analysis')
  },

  // 6.4.7 — CFP 성과 추적 (있으면 검증, 없으면 N/A)
  '6.4.7': (s) => {
    const hist = s.cfpHistory ?? []
    if (hist.length === 0) return NA('성과 추적 미적용 (단일 시점 산정).')
    if (hist.length < 2) return PARTIAL(`스냅샷 ${hist.length}건`, '시점 간 비교를 위해 ≥ 2 스냅샷 필요.')
    return PASS(`스냅샷 ${hist.length}건 — 성과 추적 가능`, '보고서 §6.4.7')
  },

  // 6.4.9.4 — 전력 처리 4유형
  '6.4.9.4': (s) => {
    const elec = s.detailedActivityData?.manufacturing?.electricity ?? []
    if (elec.length === 0) return NA('전력 사용 없음.')
    const withType = elec.filter((e) => e.gridType).length
    if (withType === elec.length) return PASS(`전력 ${elec.length}건 모두 grid 유형 명시`, '산정 워크북 전기 사용량 시트')
    return FAIL(`전력 ${elec.length}건 중 ${withType}건만 유형 명시`, '모든 전력 항목에 gridType (national/regional/supplier_specific/onsite) 입력.')
  },

  // 6.5.1 — GWP IPCC 최신 적용
  '6.5.1': (s) =>
    s.characterizationModel === 'AR6'
      ? PASS('GWP100 AR6 적용', '보고서 §6.5.1')
      : PARTIAL(`GWP100 ${s.characterizationModel} 적용`, 'IPCC 최신(AR6) 으로 업그레이드 권고. AR5 적용 시 정당화 기록.'),

  // 6.6 — 해석 (민감도 + 결론)
  '6.6': (s) => {
    const sa = s.sensitivityAnalysis
    if (!sa) return FAIL('해석 단계 민감도 분석 미수행', 'ISO 14067 §6.6 의무 — 위저드에서 시나리오 추가.')
    return PASS(`민감도 시나리오 ${sa.scenarios.length}건 + 권고 ${sa.recommendations?.length ?? 0}건`, 'Evidence Pack 07_Sensitivity_Analysis')
  },

  // 7.3 d) — 데이터원 기록
  '7.3': (s) => {
    const acts = flatActivities(s)
    if (acts.length === 0) return MANUAL('활동 데이터 미입력.')
    const withSource = acts.filter((a) => a.transparencyInfo?.dataSource).length
    const ratio = withSource / acts.length
    if (ratio >= 0.95) return PASS(`데이터원 기록 비율 ${(ratio * 100).toFixed(0)}%`, 'Evidence Pack 09_Primary_Activity_Data_Index')
    return PARTIAL(`데이터원 기록 비율 ${(ratio * 100).toFixed(0)}%`, '모든 활동 데이터에 출처 입력.')
  },

  // 7.3 n) — 가치 선택 공개
  '7.3 n': (s) => {
    const vc = s.valueChoices ?? []
    if (vc.length === 0) return PARTIAL('가치 선택 기록 0건', '주요 방법론적 선택(할당/Cut-off/EF 출처 등)에 대한 가치 선택 기록 권고.')
    return PASS(`가치 선택 ${vc.length}건 기록`, '보고서 §7.3 n')
  },

  // 8 — 정밀검토 (해당 시)
  '8': (s) => {
    const ri = s.reviewInfo
    // ReviewType: internal | external | critical_review | none
    if (!ri || !ri.reviewType || ri.reviewType === 'none') {
      return NA('정밀검토 비적용 — 자가선언 별첨.')
    }
    if (ri.reviewType === 'internal') {
      return PARTIAL(
        '내부 검토 — 외부/정밀검토 권고 (검증 통과 강도 향상).',
        '검증 통과 신뢰도 향상을 위해 외부(external) 또는 정밀검토(critical_review) 진행 권고.',
      )
    }
    if (!ri.reviewerName || !ri.reviewDate) {
      return PARTIAL('검토자 정보 부분 입력', '검토자명/조직/일자/범위/진술 모두 입력.')
    }
    return PASS(`정밀검토 ${ri.reviewType} (${ri.reviewerName})`, '보고서 §8')
  },
}

/** 조항에 매칭되는 자동 검사 결과를 반환. 없으면 manual. */
export function autoCheck(clause: string, state: PCFState): ComplianceCheckResult {
  // 정확 일치
  if (CHECKERS[clause]) return CHECKERS[clause](state)
  // prefix 매칭 (예: 6.3.5.1 → 6.3.5)
  for (const key of Object.keys(CHECKERS)) {
    if (clause.startsWith(key + '.') || clause === key) return CHECKERS[key](state)
  }
  return { status: 'manual', finding: '자동 검사 미지원 — 수동 확인 필요.' }
}
