import { getVersion } from "@tauri-apps/api/app"
import { getMachineId, getStoredLicense } from "@/lib/license/license-client"

const LICENSE_SERVER = import.meta.env.VITE_LICENSE_SERVER_URL || "http://localhost:3000"

export interface ContactPayload {
    subject: string
    message: string
    senderName?: string
    senderEmail?: string
}

export async function sendContact(payload: ContactPayload): Promise<{ ok: boolean; error?: string }> {
    try {
        const license = getStoredLicense()
        const [version, machineId] = await Promise.all([
            getVersion().catch(() => "unknown"),
            getMachineId().catch(() => "unknown"),
        ])

        const res = await fetch(`${LICENSE_SERVER}/api/contact`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...payload,
                senderName: payload.senderName || license?.customerName,
                licenseKey: license?.key,
                appVersion: version,
                machineId,
            }),
        })

        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            return { ok: false, error: data.error || `발송 실패 (${res.status})` }
        }
        return { ok: true }
    } catch (e) {
        return { ok: false, error: String(e) }
    }
}
