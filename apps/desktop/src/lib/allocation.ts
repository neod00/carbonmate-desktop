// Re-export from core for backward compatibility
export * from './core/allocation'

// Re-export new allocation rules DB modules
export * from './allocation/allocation-rules-db'
export * from './allocation/allocation-matcher'
export * from './allocation/scenario-comparator'
export * from './allocation/justification-generator'

// 매트릭스 기반 LCI 엔진
export * from './allocation/matrix-lci-engine'

// 산업군별 기본값 및 사용자 가이드
export * from './allocation/industry-defaults'
