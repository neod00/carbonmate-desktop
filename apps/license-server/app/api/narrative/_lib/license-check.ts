/**
 * 라이선스 검증 helper — narrative proxy 라우트들이 공유.
 * verify route와 동일한 검증 규칙을 inline 적용 (last_verified_at은 업데이트하지 않음).
 */
import { neon } from '@neondatabase/serverless';

export type LicenseCheckResult =
  | { ok: true; plan: string | null; customerName: string | null }
  | { ok: false; reason: string; httpStatus: number };

export async function checkLicense(
  key: string | undefined,
  machineId: string | undefined
): Promise<LicenseCheckResult> {
  if (!key || !machineId) {
    return { ok: false, reason: 'key와 machineId가 필요합니다.', httpStatus: 400 };
  }

  if (!process.env.DATABASE_URL) {
    return { ok: false, reason: 'DATABASE_URL이 설정되지 않았습니다.', httpStatus: 500 };
  }

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
        SELECT key, status, expires_at, machine_id, plan, customer_name
        FROM license_keys WHERE key = ${key} LIMIT 1
    `;

  if (rows.length === 0) {
    return { ok: false, reason: '유효하지 않은 라이선스 키입니다.', httpStatus: 401 };
  }

  const license = rows[0];

  if (license.status !== 'active') {
    return { ok: false, reason: `라이선스가 ${license.status} 상태입니다.`, httpStatus: 403 };
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { ok: false, reason: '라이선스가 만료되었습니다.', httpStatus: 403 };
  }

  if (license.machine_id && license.machine_id !== machineId) {
    return { ok: false, reason: '다른 기기에서 활성화된 라이선스입니다.', httpStatus: 403 };
  }

  return {
    ok: true,
    plan: license.plan ?? null,
    customerName: license.customer_name ?? null,
  };
}
