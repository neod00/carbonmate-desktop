import { openUrl } from '@tauri-apps/plugin-opener'

/**
 * 외부 URL을 OS 기본 브라우저로 연다.
 * Tauri WebView는 a target="_blank"를 차단하므로 plugin-opener 필수.
 * 브라우저 dev 환경(non-Tauri)에서는 window.open으로 폴백.
 */
export async function openExternal(url: string): Promise<void> {
    try {
        await openUrl(url)
    } catch {
        if (typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer')
        }
    }
}

/**
 * <a> 태그의 onClick 핸들러로 사용. preventDefault + 외부 열기.
 */
export function handleExternalClick(url: string) {
    return (e: React.MouseEvent) => {
        e.preventDefault()
        openExternal(url)
    }
}
