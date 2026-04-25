import { getVersion } from "@tauri-apps/api/app"

const LICENSE_SERVER = import.meta.env.VITE_LICENSE_SERVER_URL || "http://localhost:3000"

export interface UpdateManifest {
    version: string
    notes: string
    forceUpdate: boolean
    pub_date?: string
    platforms: {
        "windows-x86_64"?: { url: string; signature?: string }
    }
}

export interface UpdateCheckResult {
    hasUpdate: boolean
    forceUpdate: boolean
    manifest?: UpdateManifest
    currentVersion: string
    error?: string
}

function compareVersions(current: string, latest: string): number {
    const a = current.split(".").map(n => parseInt(n, 10) || 0)
    const b = latest.split(".").map(n => parseInt(n, 10) || 0)
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) {
        const x = a[i] || 0
        const y = b[i] || 0
        if (x < y) return -1
        if (x > y) return 1
    }
    return 0
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
    let currentVersion = "0.0.0"
    try {
        currentVersion = await getVersion()
    } catch {
        // ignore
    }

    try {
        const res = await fetch(`${LICENSE_SERVER}/api/updates/manifest`, {
            cache: "no-store",
        })
        if (!res.ok) {
            return { hasUpdate: false, forceUpdate: false, currentVersion, error: `매니페스트 조회 실패 (${res.status})` }
        }
        const manifest: UpdateManifest = await res.json()
        if (!manifest.version) {
            return { hasUpdate: false, forceUpdate: false, currentVersion }
        }
        const cmp = compareVersions(currentVersion, manifest.version)
        const hasUpdate = cmp < 0
        return {
            hasUpdate,
            forceUpdate: hasUpdate && Boolean(manifest.forceUpdate),
            manifest,
            currentVersion,
        }
    } catch (e) {
        return { hasUpdate: false, forceUpdate: false, currentVersion, error: String(e) }
    }
}
