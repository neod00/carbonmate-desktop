/**
 * 라이선스 발급/검증 관련 타입.
 * desktop ↔ license-server 간 페이로드 계약.
 */

export interface License {
  /** 사용자에게 노출되는 키 (예: "CMATE-XXXX-XXXX-XXXX-XXXX") */
  key: string;
  customer: string;
  email: string;
  issuedAt: string;
  /** null이면 영구 라이선스 */
  expiresAt: string | null;
  /** 첫 활성화 시 바인딩되는 머신 식별자 */
  machineId: string | null;
  /** 폐기된 라이선스는 검증 실패 */
  revoked: boolean;
}

export interface VerifyRequest {
  key: string;
  machineId: string;
  /** 데스크탑 앱 버전 (서버 텔레메트리용) */
  appVersion: string;
}

export type VerifyFailReason =
  | 'unknown-key'
  | 'expired'
  | 'machine-mismatch'
  | 'revoked';

export interface VerifyResponse {
  valid: boolean;
  reason?: VerifyFailReason;
  /** 유효 시 만료일 (UI 표시용) */
  expiresAt?: string | null;
  /**
   * HMAC 서명된 페이로드. 데스크탑 앱이 로컬에 캐싱해서
   * 오프라인 grace period 동안 검증에 사용.
   */
  signedPayload?: string;
  signature?: string;
}
