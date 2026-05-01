/**
 * context-hash 회귀 테스트.
 *
 * P0-B 방어: BOM·EF·결과값이 변경되면 해시가 달라져야 함.
 *           narrative record가 stale 상태로 남는 사고 방지.
 */
import { describe, it, expect } from 'vitest'
import { computeContextHash, isContextHashStale } from './context-hash'

function makeCtx(overrides: any = {}): any {
  return {
    productName: 'NiSO4',
    declaredUnit: '1 ton',
    systemBoundary: 'cradle-to-gate',
    totalCFP: { value: 759.72, unit: 'kg CO2e' },
    stageBreakdown: [
      { stage: '제조', value: 511.34, sharePercent: 67.3 },
      { stage: '원료 채취', value: 207.9, sharePercent: 27.4 },
      { stage: '운송', value: 40.48, sharePercent: 5.3 },
    ],
    ...overrides,
  }
}

describe('computeContextHash — 결정성', () => {
  it('동일 입력에 동일 해시', () => {
    const h1 = computeContextHash(makeCtx())
    const h2 = computeContextHash(makeCtx())
    expect(h1).toBe(h2)
  })

  it('stageBreakdown 순서가 달라도 동일 해시 (정렬 안정성)', () => {
    const a = computeContextHash(makeCtx({
      stageBreakdown: [
        { stage: '제조', value: 511.34 },
        { stage: '원료 채취', value: 207.9 },
        { stage: '운송', value: 40.48 },
      ],
    }))
    const b = computeContextHash(makeCtx({
      stageBreakdown: [
        { stage: '운송', value: 40.48 },
        { stage: '원료 채취', value: 207.9 },
        { stage: '제조', value: 511.34 },
      ],
    }))
    expect(a).toBe(b)
  })
})

describe('computeContextHash — 변경 감지', () => {
  it('totalCFP 변경 시 해시 변경 (P0-B 핵심 시나리오)', () => {
    // 옛 값: 34.50 (r1 보고서 narrative에 박혀있던 값)
    const oldHash = computeContextHash(makeCtx({ totalCFP: { value: 34.5, unit: 'kg CO2e' } }))
    // 새 값: 759.72 (r1 보고서 표지에 표시된 값)
    const newHash = computeContextHash(makeCtx({ totalCFP: 759.72 }))
    expect(oldHash).not.toBe(newHash)
  })

  it('단계별 배출량 변경 시 해시 변경', () => {
    const a = computeContextHash(makeCtx({
      stageBreakdown: [{ stage: '제조', value: 100 }],
    }))
    const b = computeContextHash(makeCtx({
      stageBreakdown: [{ stage: '제조', value: 200 }],
    }))
    expect(a).not.toBe(b)
  })

  it('시스템 경계 변경 시 해시 변경', () => {
    const a = computeContextHash(makeCtx({ systemBoundary: 'cradle-to-gate' }))
    const b = computeContextHash(makeCtx({ systemBoundary: 'cradle-to-grave' }))
    expect(a).not.toBe(b)
  })

  it('제품명만 바뀌면 해시는 동일 (오타 수정 시 narrative 재생성 강제 금지)', () => {
    const a = computeContextHash(makeCtx({ productName: 'NiSO4' }))
    const b = computeContextHash(makeCtx({ productName: '황산니켈' }))
    expect(a).toBe(b)
  })
})

describe('isContextHashStale', () => {
  it('해시가 다르면 stale', () => {
    expect(isContextHashStale('aaaaaaaa', 'bbbbbbbb')).toBe(true)
  })

  it('해시가 같으면 fresh', () => {
    expect(isContextHashStale('abc12345', 'abc12345')).toBe(false)
  })

  it('record에 해시가 없으면 stale (구버전 record 호환)', () => {
    expect(isContextHashStale(undefined, 'abc12345')).toBe(true)
  })
})

describe('r1 보고서 회귀 시나리오', () => {
  it('r1에서 옛 narrative(34.50)와 새 결과(759.72)의 해시는 반드시 달라야 함', () => {
    const oldR1 = computeContextHash(makeCtx({
      totalCFP: { value: 34.5, unit: 'kg CO2e' },
      stageBreakdown: [
        { stage: '원료 채취', value: 34.5, sharePercent: 100 },
        { stage: '제조', value: 0, sharePercent: 0 },
      ],
    }))
    const newR1 = computeContextHash(makeCtx({
      totalCFP: { value: 759.72, unit: 'kg CO2e' },
      stageBreakdown: [
        { stage: '제조', value: 511.34, sharePercent: 67.3 },
        { stage: '원료 채취', value: 207.9, sharePercent: 27.4 },
        { stage: '운송', value: 40.48, sharePercent: 5.3 },
      ],
    }))
    // 두 해시가 다르면 invalidateStaleRecords가 옛 narrative를 폐기함
    expect(oldR1).not.toBe(newR1)
    expect(isContextHashStale(oldR1, newR1)).toBe(true)
  })
})
