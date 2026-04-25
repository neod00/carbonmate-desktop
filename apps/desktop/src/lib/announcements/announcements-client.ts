const LICENSE_SERVER = import.meta.env.VITE_LICENSE_SERVER_URL || "http://localhost:3000"

export interface Announcement {
    id: number
    title: string
    body: string
    priority: "info" | "warning" | "urgent"
    created_at: string
}

const READ_KEY = "carbonmate-read-announcements"

export async function fetchAnnouncements(): Promise<Announcement[]> {
    try {
        const res = await fetch(`${LICENSE_SERVER}/api/announcements`, { cache: "no-store" })
        if (!res.ok) return []
        const data = await res.json()
        return data.announcements || []
    } catch {
        return []
    }
}

export function getReadIds(): number[] {
    try {
        const raw = localStorage.getItem(READ_KEY)
        if (!raw) return []
        const arr = JSON.parse(raw)
        return Array.isArray(arr) ? arr.filter(n => typeof n === "number") : []
    } catch {
        return []
    }
}

export function markAsRead(ids: number[]): void {
    const existing = new Set(getReadIds())
    ids.forEach(id => existing.add(id))
    localStorage.setItem(READ_KEY, JSON.stringify([...existing]))
}

export function countUnread(announcements: Announcement[]): number {
    const read = new Set(getReadIds())
    return announcements.filter(a => !read.has(a.id)).length
}
