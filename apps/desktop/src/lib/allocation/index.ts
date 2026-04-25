/**
 * Allocation Module Exports
 * 
 * 할당 규칙 DB 및 관련 유틸리티 통합 export
 */

// 기존 core 할당 모듈 (backward compatibility)
export * from '../core/allocation'

// 할당 규칙 DB
export * from './allocation-rules-db'

// 할당 매칭
export * from './allocation-matcher'

// 시나리오 비교
export * from './scenario-comparator'

// 정당화 생성
export * from './justification-generator'

// 매트릭스 기반 LCI 엔진 (Heijungs-Suh 방법론)
export * from './matrix-lci-engine'

// 산업군별 기본값 및 사용자 가이드
export * from './industry-defaults'
