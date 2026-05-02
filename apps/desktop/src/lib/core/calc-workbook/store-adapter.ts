/**
 * Zustand `PCFState` → `WorkbookData` 매핑 (v1 — 간소 매핑).
 *
 * 한계 (v1.x 에서 보강 예정):
 *   - 월별 분해: store 에 12개월 데이터 부재 → 가상 분해 자동 적용 (§6.3.6 충족 위해)
 *   - 폐기물 처리업체/방법: ActivityInput 에 미존재 → '(미정 — 클라이언트 입력)' placeholder
 *   - 민감도 시나리오: store 의 SensitivityAnalysisResult → SensitivityScenario 변환 (없으면 빈 배열)
 *   - 다제품: store 가 단일 제품만 지원 → 1 제품 fixed
 *   - secondary list: ActivityInput 의 EF 정보로 동적 빌드
 */

import { getEmissionFactorById, MATERIAL_EMISSION_FACTORS } from '../emission-factors'
import type {
  ActivityInput,
  ElectricityInput,
  MaterialInput,
  PackagingInput,
  PCFState,
  ProductInfo,
  StageActivityData,
  TransportInput,
} from '../store'
import type {
  BomItem,
  PowerSourceType,
  ProductCFP,
  SecondaryDataItem,
  SensitivityScenario,
  StudyMeta,
  WorkbookData,
} from './types'

interface AdapterContext {
  efBySeq: Map<string, number> // 동일 EF 출처를 단일 seq 로 묶음 (key = activity_name + ef value)
  secondary: SecondaryDataItem[]
  nextSeq: number
}

function makeContext(): AdapterContext {
  return { efBySeq: new Map(), secondary: [], nextSeq: 1 }
}

/** EF 출처를 secondary list 에 등록하고 seq 반환 — 중복 시 기존 seq 재사용 */
function registerEf(
  ctx: AdapterContext,
  it: ActivityInput,
  inferredEfValue: number,
  category: string,
): number {
  const lci = it.lciGuide
  const dbEf = it.emissionFactorId ? getEmissionFactorById(it.emissionFactorId) : undefined
  // 우선순위: LCI Guide(외교관 추천 메타) > emission-factors DB > 사용자 입력
  const activityName =
    lci?.activityName ??
    dbEf?.name ??
    it.transparencyInfo?.dataSource ??
    `${category}: ${it.name}`
  const key = `${activityName}|${inferredEfValue.toFixed(6)}`
  const existing = ctx.efBySeq.get(key)
  if (existing) return existing
  const seq = ctx.nextSeq
  ctx.nextSeq += 1
  ctx.efBySeq.set(key, seq)
  ctx.secondary.push({
    seq,
    owner: lci
      ? 'LCI Guide (외교관 추천)'
      : dbEf
        ? `${dbEf.source} (${dbEf.year})`
        : 'CarbonMate 내장 LCI DB',
    uuid: lci?.activityUuid ?? '',
    activityName,
    geography: lci?.geography ?? dbEf?.geographicScope ?? it.dataQuality.geographicScope ?? 'KR',
    referenceProduct: dbEf?.nameKo ?? it.name,
    unit: dbEf?.unit ?? it.unit,
    amount: 1.0,
    efKgCo2e: inferredEfValue,
    note: dbEf?.notes ?? category,
  })
  return seq
}

/** ActivityInput 의 EF 추출 — customEmissionFactor 우선, emissionFactorId, materialType 순.
 * PR-V06: MaterialInput.materialType (예: 'material_chem_naoh') 도 fallback 으로 검색.
 * 보고서(emission-calculator.ts)는 이미 materialType 을 사용하지만 워크북 어댑터는 미연결 상태였음.
 * 결과 워크북 raw_materials 의 EF 가 항상 0 이 되어 검증인이 trail 추적 불가했던 F-B02-R02 결함 차단. */
function extractEf(it: ActivityInput): number {
  if (typeof it.customEmissionFactor === 'number' && it.customEmissionFactor > 0) {
    return it.customEmissionFactor
  }
  if (it.emissionFactorId) {
    const ef = getEmissionFactorById(it.emissionFactorId)
    if (ef && ef.value > 0) return ef.value
  }
  const materialType = (it as { materialType?: string }).materialType
  if (materialType) {
    const mat = MATERIAL_EMISSION_FACTORS.find(f => f.id === materialType)
    if (mat && mat.value > 0) return mat.value
  }
  return 0
}

/** 한국식 DataQuality → DqrScore (1~5) 휴리스틱 */
function toDqr(it: ActivityInput): { ter: number; ger: number; tir: number } {
  const dq = it.dataQuality
  const yearDiff = Math.max(0, new Date().getFullYear() - (dq.year ?? new Date().getFullYear()))
  const ter = yearDiff <= 1 ? 1 : yearDiff <= 5 ? 2 : yearDiff <= 10 ? 3 : 4
  const ger = dq.geographicScope === 'KR' || dq.geographicScope === 'KOR' ? 1 : dq.geographicScope === 'GLO' ? 4 : 3
  const tir = dq.type === 'primary' ? 1 : dq.type === 'secondary' ? 2 : 4
  return { ter, ger, tir }
}

function toBomItem(
  ctx: AdapterContext,
  it: ActivityInput,
  category: string,
  direction: 'input' | 'output',
  options: {
    transportMode?: string
    transportDistanceKm?: number
    powerSourceType?: PowerSourceType
    powerSupplier?: string
    treatmentMethod?: string
    treatmentFacility?: string
    treatmentDistanceKm?: number
  } = {},
): BomItem {
  const ef = extractEf(it)
  const efSeq = it.isCutOff ? 0 : ef > 0 ? registerEf(ctx, it, ef, category) : 0
  const concentrationPct = it.concentrationPercent ?? 100
  const applyConcentration = concentrationPct < 100 && concentrationPct > 0
  const appliedQty = applyConcentration ? it.quantity * (concentrationPct / 100) : it.quantity

  const cutOffText = it.isCutOff
    ? it.transparencyInfo?.assumptions ?? 'Cut-off 적용 (사유 미입력)'
    : ''

  return {
    direction,
    category,
    name: it.name,
    collectedUnit: it.unit,
    collectedQty: it.quantity,
    appliedUnit: it.unit,
    appliedQty,
    concentrationPct,
    applyConcentration,
    cutOff: cutOffText,
    efSeq,
    collectedMonthly: null, // monthly-expander 가 채움
    transportMode: options.transportMode,
    transportDistanceKm: options.transportDistanceKm,
    powerSourceType: options.powerSourceType,
    powerSupplier: options.powerSupplier,
    treatmentMethod: options.treatmentMethod,
    treatmentFacility: options.treatmentFacility,
    treatmentDistanceKm: options.treatmentDistanceKm,
    note: it.transparencyInfo?.dataSource,
    dqr: toDqr(it),
  }
}

/** detailedActivityData 가 있으면 그것을, 없으면 빈 stage 데이터 사용 */
function buildBomItems(
  ctx: AdapterContext,
  staged: Partial<StageActivityData> | undefined,
  legacy?: Record<string, any>,
): BomItem[] {
  const items: BomItem[] = []
  if (!staged && !legacy) return items
  staged = staged ?? {}

  // 원료물질
  for (const m of staged.raw_materials ?? []) {
    items.push(toBomItem(ctx, m as MaterialInput, '원료물질', 'input'))
  }
  // 에너지 — 전력
  for (const e of staged.manufacturing?.electricity ?? []) {
    const elec = e as ElectricityInput
    const sourceType: PowerSourceType =
      elec.gridType === 'national' || elec.gridType === 'regional'
        ? '외부그리드'
        : elec.gridType === 'onsite'
        ? '자체발전'
        : elec.gridType === 'supplier_specific'
        ? '직접연결'
        : '외부그리드'
    items.push(
      toBomItem(ctx, elec, '에너지', 'input', {
        powerSourceType: sourceType,
        powerSupplier: elec.gridRegion ?? '한국전력공사 — 한국 평균',
      }),
    )
  }
  // 에너지 — 연료/스팀
  for (const f of staged.manufacturing?.fuels ?? []) {
    items.push(toBomItem(ctx, f, '에너지', 'input'))
  }
  // 운송
  for (const t of staged.transport ?? []) {
    const tr = t as TransportInput
    const tonKm = (tr.weight / 1000) * tr.distance
    const itClone: ActivityInput = { ...tr, quantity: tonKm, unit: 'ton-km' }
    items.push(
      toBomItem(ctx, itClone, '육상운송', 'input', {
        transportMode: tr.transportMode,
        transportDistanceKm: tr.distance,
      }),
    )
  }
  // 포장
  for (const p of staged.packaging ?? []) {
    items.push(toBomItem(ctx, p as PackagingInput, '포장', 'input'))
  }
  // 폐기 (output)
  for (const d of staged.eol?.disposal ?? []) {
    items.push(toBomItem(ctx, d, '매립', 'output', { treatmentMethod: '매립' }))
  }
  for (const r of staged.eol?.recycling ?? []) {
    items.push(toBomItem(ctx, r, '재활용', 'output', { treatmentMethod: '재활용' }))
  }

  // PR-V02: legacy activityData 의 평면 에너지 필드 → BOM 합성
  // detailedActivityData.manufacturing 배열이 비었을 때만 동작 — 검증인이 보고서와 워크북 간
  // data trail 단절(F-B02)을 더 이상 발견하지 못하도록 14064-3 §6.1.3.2 충족.
  if (legacy) {
    const hasDetailedElec = (staged.manufacturing?.electricity?.length ?? 0) > 0
    const hasDetailedFuel = (staged.manufacturing?.fuels?.length ?? 0) > 0

    const elecQty = Number(legacy['electricity']) || 0
    if (!hasDetailedElec && elecQty > 0) {
      const efOverride = legacy['electricity_ef_override']
      const ef =
        typeof efOverride === 'number' && efOverride >= 0
          ? efOverride
          : 0.4781 // KECO 한국 평균 2023 (소비단)
      const synthetic: ActivityInput = {
        id: 'legacy-electricity',
        stageId: 'manufacturing',
        name: '전력 (사업장 사용)',
        quantity: elecQty,
        unit: 'kWh',
        emissionSourceType: 'fossil',
        customEmissionFactor: ef,
        dataQuality: {
          type: 'secondary',
          source: '국가 LCI DB (KECO)',
          year: 2023,
          geographicScope: 'KR',
          uncertainty: 10,
        },
      } as ActivityInput
      items.push(
        toBomItem(ctx, synthetic, '에너지', 'input', {
          powerSourceType: '외부그리드',
          powerSupplier: '한국전력공사 — 한국 평균',
        }),
      )
    }

    if (!hasDetailedFuel) {
      const gasQty = Number(legacy['gas']) || 0
      if (gasQty > 0) {
        const gasUnit = (legacy['gas_unit'] as string) || 'MJ'
        const gasEF = gasUnit === 'Nm³' ? 2.75 : 0.0561
        items.push(
          toBomItem(
            ctx,
            {
              id: 'legacy-gas',
              stageId: 'manufacturing',
              name: '천연가스',
              quantity: gasQty,
              unit: gasUnit,
              emissionSourceType: 'fossil',
              customEmissionFactor: gasEF,
              dataQuality: {
                type: 'secondary',
                source: 'IPCC 2006',
                year: 2019,
                geographicScope: 'KR',
                uncertainty: 10,
              },
            } as ActivityInput,
            '에너지',
            'input',
          ),
        )
      }

      const dieselQty = Number(legacy['diesel']) || 0
      if (dieselQty > 0) {
        items.push(
          toBomItem(
            ctx,
            {
              id: 'legacy-diesel',
              stageId: 'manufacturing',
              name: '경유',
              quantity: dieselQty,
              unit: 'L',
              emissionSourceType: 'fossil',
              customEmissionFactor: 2.68,
              dataQuality: {
                type: 'secondary',
                source: 'IPCC 2006',
                year: 2019,
                geographicScope: 'KR',
                uncertainty: 10,
              },
            } as ActivityInput,
            '에너지',
            'input',
          ),
        )
      }

      const steamQty = Number(legacy['steam']) || 0
      if (steamQty > 0) {
        const steamEFRaw = legacy['steam_ef']
        const steamEF =
          typeof steamEFRaw === 'number' && steamEFRaw >= 0 ? steamEFRaw : 0.22
        items.push(
          toBomItem(
            ctx,
            {
              id: 'legacy-steam',
              stageId: 'manufacturing',
              name: '스팀',
              quantity: steamQty,
              unit: 'kg',
              emissionSourceType: 'fossil',
              customEmissionFactor: steamEF,
              dataQuality: {
                type: 'secondary',
                source: '국가 LCI DB',
                year: 2023,
                geographicScope: 'KR',
                uncertainty: 15,
              },
            } as ActivityInput,
            '에너지',
            'input',
          ),
        )
      }
    }
  }

  return items
}

/** Sensitivity result → 시나리오 표 변환 — base/alt CFP 모두 보존 (보고서 동등) */
function buildSensitivity(state: PCFState): SensitivityScenario[] {
  const r = state.sensitivityAnalysis
  if (!r || !r.scenarios) return []
  const baselineCfp = r.baselineCFP
  return r.scenarios.map((s) => {
    const deltaCFP = s.absoluteChange
    // SensitivityScenario.percentageChange 는 % 단위(예: 7.7) — 비율로 환산
    const deltaPct = s.percentageChange / 100
    return {
      name: s.nameKo || s.name || s.parameterChanged || '시나리오',
      baseline: typeof s.baseValue === 'string' ? s.baseValue : String(s.baseValue),
      baselineEmission: s.baseEmission ?? baselineCfp,
      alternativeEmission: s.alternativeEmission,
      deltaKgCo2e: deltaCFP,
      deltaPct,
      // ISO 14067 §6.4.6.1 / §6.6 — 5% 초과 = 유의미 시나리오로 마킹 (스토어 isSignificant 와 일치)
      inRange: !s.isSignificant,
      note: s.description,
    }
  })
}

function buildMeta(state: PCFState, productName: string): StudyMeta {
  const meta = state.reportMeta
  const pi = state.productInfo
  return {
    projectTitle: `${pi.name || productName} 제품 탄소발자국 산정`,
    clientCompany: meta?.commissioner || '(미정 — 클라이언트 입력)',
    clientAddress: meta?.geographicScope || '(미정 — 클라이언트 입력)',
    contactName: '(미정 — 클라이언트 입력)',
    contactPhone: '(미정 — 클라이언트 입력)',
    contactEmail: '(미정 — 클라이언트 입력)',
    consultants: [
      {
        name: meta?.practitioner || 'CarbonMate 자가 산정',
        phone: '—',
        email: '—',
      },
    ],
    studyDate: new Date().toISOString().slice(0, 10),
    standard: 'ISO 14067:2018 / KS I ISO 14067',
    gwpBasis:
      state.characterizationModel === 'AR6'
        ? 'IPCC AR6, 100년 (GWP100)'
        : 'IPCC AR5, 100년 (GWP100)',
    assessmentPeriod: pi.timeBoundary
      ? `${pi.timeBoundary.dataCollectionStart ?? ''} ~ ${pi.timeBoundary.dataCollectionEnd ?? ''}`
      : '(미정)',
    purpose: pi.studyGoal?.applicationPurpose ?? '제품 탄소발자국 산정 및 보고',
  }
}

/**
 * Store state → WorkbookData. 추출 가능한 모든 정보를 매핑.
 * detailedActivityData 가 비어있으면 빈 BOM 으로 빈 워크북 생성됨 (호출자 책임).
 */
export function storeToWorkbookData(state: PCFState): WorkbookData {
  const ctx = makeContext()
  const productName = state.productInfo.name || 'Product'
  const productCode = sanitizeCode(productName) || 'PRODUCT'

  const bom = buildBomItems(ctx, state.detailedActivityData, state.activityData)
  // 제품 출력 행 자동 추가 (없으면) — FU anchor 필수
  const hasProductOutput = bom.some((b) => b.direction === 'output' && b.category === '제품')
  if (!hasProductOutput) {
    const fuKg = inferFuKg(state.productInfo)
    bom.push({
      direction: 'output',
      category: '제품',
      name: productName,
      collectedUnit: 'kg',
      collectedQty: fuKg,
      appliedUnit: 'kg',
      appliedQty: fuKg,
      concentrationPct: 100,
      applyConcentration: false,
      cutOff: '',
      efSeq: 0,
      collectedMonthly: null,
      note: '기능단위 anchor — 자동 추가',
      dqr: { ter: 1, ger: 1, tir: 1 },
    })
  }

  const product: ProductCFP = {
    code: productCode,
    displayName: productName,
    functionalUnit: state.productInfo.unit ?? '1 ton 제품',
    fuLabel: state.productInfo.unit ?? `${productName} 1 ton`,
    impactCategory: 'Climate change - global warming potential (GWP100)',
    unit: 'kg CO2-Eq.',
    total: 0,
    stages: [
      { name: '원료 채취', valueKgCo2e: 0 },
      { name: '제조', valueKgCo2e: 0 },
      { name: '운송', valueKgCo2e: 0 },
      { name: '포장', valueKgCo2e: 0 },
    ],
    subcategories: [
      { name: 'Climate change - Biogenic', valueKgCo2e: 0 },
      { name: 'Climate change - Fossil', valueKgCo2e: 0 },
      { name: 'Climate change - Land use and land use change', valueKgCo2e: 0 },
    ],
  }

  return {
    meta: buildMeta(state, productName),
    products: [product],
    productBoms: { [product.code]: bom },
    fuKgByProduct: { [product.code]: inferFuKg(state.productInfo) },
    sensitivity: buildSensitivity(state),
    secondary: ctx.secondary,
  }
}

/** 제품명에서 시트명/코드로 안전한 식별자 추출 */
function sanitizeCode(name: string): string {
  return name.replace(/[\[\]\/\\?*:\s]/g, '_').slice(0, 31)
}

/** ProductInfo.unit 에서 FU kg 추출 (예: "1 ton" → 1000) */
function inferFuKg(pi: ProductInfo): number {
  const unit = pi.unit?.toLowerCase() ?? ''
  if (unit.includes('ton')) return 1000
  if (unit.includes('kg')) {
    const m = unit.match(/(\d+(?:\.\d+)?)\s*kg/)
    if (m) return Number(m[1])
    return 1
  }
  return 1000
}
