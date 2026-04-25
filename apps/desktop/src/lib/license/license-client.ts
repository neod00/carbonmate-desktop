import { invoke } from "@tauri-apps/api/core";

const LICENSE_SERVER = import.meta.env.VITE_LICENSE_SERVER_URL || "http://localhost:3000";
const STORAGE_KEY = "carbonmate_license";
const OFFLINE_GRACE_MS = 30 * 24 * 60 * 60 * 1000; // 30일

export interface LicenseState {
    key: string;
    valid: boolean;
    plan: string;
    customerName?: string;
    expiresAt?: string;
    lastVerifiedAt: string; // ISO string
}

/**
 * 기기 고유 ID 가져오기 (Tauri)
 * 없으면 랜덤 생성 후 로컬 저장
 */
export async function getMachineId(): Promise<string> {
    const stored = localStorage.getItem("carbonmate_machine_id");
    if (stored) return stored;

    // Tauri: hostname + 랜덤 조합
    const random = crypto.randomUUID();
    localStorage.setItem("carbonmate_machine_id", random);
    return random;
}

/**
 * 로컬에 저장된 라이선스 상태 조회
 */
export function getStoredLicense(): LicenseState | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * 라이선스 상태 로컬 저장
 */
function storeLicense(state: LicenseState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * 라이선스 키 서버 검증
 * @returns 검증 결과
 */
export async function verifyLicense(key: string): Promise<{
    valid: boolean;
    reason?: string;
    plan?: string;
    customerName?: string;
    expiresAt?: string;
}> {
    const machineId = await getMachineId();

    const res = await fetch(`${LICENSE_SERVER}/api/license/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, machineId }),
    });

    const data = await res.json();
    return data;
}

/**
 * 앱 시작 시 라이선스 확인
 * 우선순위: 서버 검증 → 오프라인 유예 → 미인증
 */
export async function checkLicenseOnStartup(): Promise<{
    status: "valid" | "offline_grace" | "invalid" | "unactivated";
    license?: LicenseState;
    reason?: string;
}> {
    const stored = getStoredLicense();

    // 저장된 키가 없으면 미인증
    if (!stored) {
        return { status: "unactivated" };
    }

    // 온라인 검증 시도
    try {
        const result = await verifyLicense(stored.key);

        if (result.valid) {
            const updated: LicenseState = {
                ...stored,
                valid: true,
                plan: result.plan || stored.plan,
                customerName: result.customerName,
                expiresAt: result.expiresAt,
                lastVerifiedAt: new Date().toISOString(),
            };
            storeLicense(updated);
            return { status: "valid", license: updated };
        } else {
            return { status: "invalid", reason: result.reason };
        }
    } catch {
        // 서버 연결 실패 → 오프라인 유예 확인
        const lastVerified = new Date(stored.lastVerifiedAt).getTime();
        const elapsed = Date.now() - lastVerified;

        if (elapsed < OFFLINE_GRACE_MS) {
            const daysLeft = Math.ceil((OFFLINE_GRACE_MS - elapsed) / (24 * 60 * 60 * 1000));
            return {
                status: "offline_grace",
                license: stored,
                reason: `오프라인 모드 (${daysLeft}일 남음)`,
            };
        }

        return { status: "invalid", reason: "오프라인 유예 기간이 만료되었습니다." };
    }
}

/**
 * 라이선스 키 입력 후 활성화
 */
export async function activateLicense(key: string): Promise<{
    success: boolean;
    reason?: string;
    license?: LicenseState;
}> {
    const result = await verifyLicense(key);

    if (!result.valid) {
        return { success: false, reason: result.reason };
    }

    const license: LicenseState = {
        key,
        valid: true,
        plan: result.plan || "standard",
        customerName: result.customerName,
        expiresAt: result.expiresAt,
        lastVerifiedAt: new Date().toISOString(),
    };

    storeLicense(license);
    return { success: true, license };
}

/**
 * 라이선스 초기화 (로그아웃)
 */
export function clearLicense() {
    localStorage.removeItem(STORAGE_KEY);
}
