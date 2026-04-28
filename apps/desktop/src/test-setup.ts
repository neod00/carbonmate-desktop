/**
 * Vitest 컴포넌트 테스트 셋업
 * - jest-dom 매처 등록
 * - localStorage 모의
 */
import "@testing-library/jest-dom/vitest"

// Tauri API 모의 (컴포넌트 테스트에서는 호출 안 됨)
;(globalThis as any).window = (globalThis as any).window || {}
