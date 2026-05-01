/**
 * narrative-sanitizer 단위 테스트.
 *
 * P0-E 회귀 방어: r1 보고서에서 발견된 AI 흔적 5종을 자동 검출.
 *  - ?utm_source=openai 추적 파라미터
 *  - "사용자가 명시한 바와 같이" 채팅 어투
 *  - "본 컨텍스트에는" AI 메타 표현
 *  - "수%~수십% 범위" 모호 hedging
 *  - Citation URL의 추적 파라미터
 */
import { describe, it, expect } from 'vitest'
import {
  sanitizeText,
  sanitizeCitation,
  sanitizeNarrativePayload,
  stripTrackingParams,
} from './narrative-sanitizer'

describe('stripTrackingParams', () => {
  it('removes ?utm_source=openai from URL', () => {
    expect(stripTrackingParams('https://www.environdec.com/library/epd13223?utm_source=openai'))
      .toBe('https://www.environdec.com/library/epd13223')
  })

  it('removes ?utm_source=openai from URL with other params', () => {
    expect(stripTrackingParams('https://example.com/page?id=42&utm_source=openai'))
      .toBe('https://example.com/page?id=42')
  })

  it('removes &utm_source=openai when in middle', () => {
    expect(stripTrackingParams('https://example.com/page?id=42&utm_source=openai&lang=ko'))
      .toBe('https://example.com/page?id=42&lang=ko')
  })

  it('removes utm_medium / utm_campaign / utm_term / utm_content', () => {
    const url = 'https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=d&utm_content=e'
    expect(stripTrackingParams(url)).toBe('https://example.com/')
  })

  it('preserves non-tracking query params', () => {
    expect(stripTrackingParams('https://example.com/?id=42&page=2'))
      .toBe('https://example.com/?id=42&page=2')
  })

  it('returns empty string unchanged', () => {
    expect(stripTrackingParams('')).toBe('')
  })

  it('returns invalid URL unchanged enough to not crash', () => {
    expect(() => stripTrackingParams('not-a-url')).not.toThrow()
  })
})

describe('sanitizeText — AI 흔적 표현 치환', () => {
  it('replaces "사용자가 명시한 바와 같이" with "의뢰자가"', () => {
    const input = '사용자가 명시한 바와 같이 매입 단가가 확보되지 않았다.'
    expect(sanitizeText(input)).toBe('의뢰자가 명시한 바와 같이 매입 단가가 확보되지 않았다.')
  })

  it('replaces "사용자가 제공한"', () => {
    expect(sanitizeText('사용자가 제공한 메모에 따라'))
      .toBe('의뢰자가 제공한 메모에 따라')
  })

  it('replaces "사용자가 제시한"', () => {
    expect(sanitizeText('사용자가 제시한 정보만으로는'))
      .toBe('의뢰자가 제시한 정보만으로는')
  })

  it('replaces "본 컨텍스트에는"', () => {
    expect(sanitizeText('본 컨텍스트에는 채택 dataset명이 제시되지 않아'))
      .toBe('본 산정에서는 채택 dataset명이 제시되지 않아')
  })

  it('replaces 모호 hedging "수%~수십% 범위"', () => {
    expect(sanitizeText('대략 수%~수십% 범위의 차이'))
      .toBe('추정 변동 범위의 차이')
  })

  it('replaces 모호 hedging "수% 수준"', () => {
    expect(sanitizeText('CFP에 수% 수준의 영향'))
      .toBe('CFP에 소폭의 영향')
  })

  it('replaces 모호 hedging "한 자릿수 %에서 두 자릿수 %까지"', () => {
    expect(sanitizeText('농축/희석 차이에 따라 중간 한 자릿수 %에서 두 자릿수 %까지 변동'))
      .toBe('농축/희석 차이에 따라 중간 유의 수준의 변동')
  })
})

describe('sanitizeText — 인라인 URL 추적 파라미터', () => {
  it('strips utm from URL inside markdown link', () => {
    const input = '검색하였다 ([environdec.com](https://www.environdec.com/library/epd13223?utm_source=openai))'
    expect(sanitizeText(input)).toBe(
      '검색하였다 ([environdec.com](https://www.environdec.com/library/epd13223))'
    )
  })

  it('strips utm from plain inline URL', () => {
    const input = '참고: https://example.com/?utm_source=openai 에서 확인'
    expect(sanitizeText(input)).toContain('https://example.com/')
    expect(sanitizeText(input)).not.toContain('utm_source')
  })
})

describe('sanitizeCitation', () => {
  it('strips utm from citation URL while preserving title', () => {
    const result = sanitizeCitation({
      url: 'https://support.ecoinvent.org/ecoinvent-version-3.12?utm_source=openai',
      title: 'ecoinvent Version 3.12',
      retrievedAt: '2026-05-01T00:00:00.000Z',
    })
    expect(result.url).toBe('https://support.ecoinvent.org/ecoinvent-version-3.12')
    expect(result.title).toBe('ecoinvent Version 3.12')
    expect(result.retrievedAt).toBe('2026-05-01T00:00:00.000Z')
  })
})

describe('sanitizeNarrativePayload — 통합 정화', () => {
  it('paragraphs와 citations 모두 정화', () => {
    const input = {
      paragraphs: [
        '사용자가 명시한 바와 같이 매입 단가 미확보',
        '본 컨텍스트에는 dataset이 없어 ([env.com](https://env.com/?utm_source=openai))',
      ],
      citations: [
        {
          url: 'https://ibu-epd.com/?utm_source=openai',
          title: 'PCR FAQ',
          retrievedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    }
    const result = sanitizeNarrativePayload(input)
    expect(result.paragraphs[0]).toBe('의뢰자가 명시한 바와 같이 매입 단가 미확보')
    expect(result.paragraphs[1]).toBe('본 산정에서는 dataset이 없어 ([env.com](https://env.com/))')
    expect(result.citations[0].url).toBe('https://ibu-epd.com/')
  })
})

describe('r1 보고서 회귀 시나리오 — 실제 인용 텍스트', () => {
  it('§1.2 PCR narrative — 인라인 인용 + utm 정화', () => {
    const input =
      '한국 PCR registry 공개 검색에서도 황산니켈에 직접 대응하는 PCR 공개 결과를 확인하지 못하였다. ' +
      '([environdec.com](https://www.environdec.com/library/epd13223?utm_source=openai))'
    const result = sanitizeText(input)
    expect(result).not.toMatch(/utm_source/)
    expect(result).toContain('https://www.environdec.com/library/epd13223')
  })

  it('§3.6 할당 narrative — "사용자가 제공한" 정화', () => {
    const input = 'PCR 검색은 사용자가 제공한 메모에 따라 2026-04-30 기준 EPD International에서 검색하였다.'
    const result = sanitizeText(input)
    expect(result).not.toMatch(/사용자가 제공/)
    expect(result).toContain('의뢰자가 제공한')
  })

  it('§3.4 dataset narrative — hedging 정화', () => {
    const input = '석탄 비중이 높은 대체 mix를 쓸 경우 CFP가 증가할 수 있어 대략 수%~수십% 범위의 차이 가능성을 배제할 수 없다.'
    const result = sanitizeText(input)
    expect(result).not.toMatch(/수%~수십%/)
    expect(result).toContain('추정 변동 범위')
  })
})
