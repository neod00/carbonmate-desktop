import { invoke } from '@tauri-apps/api/core'

/**
 * Tauri 네이티브 save 다이얼로그로 파일 저장.
 * file-saver/`<a download>` 트릭은 Tauri WebView2에서 무반응 실패하므로
 * 보고서 등 모든 다운로드는 이 함수를 사용해야 함.
 *
 * @param content - 저장할 내용 (Blob, Uint8Array, 또는 string)
 * @param filename - 기본 파일명 (확장자 포함)
 * @param filterName - 다이얼로그 필터 표시명 (예: "Word 문서")
 * @param filterExt - 확장자 (점 없이, 예: "docx")
 * @returns 저장된 경로 (취소 시 null)
 */
export async function saveFile(
    content: Blob | Uint8Array | string,
    filename: string,
    filterName: string,
    filterExt: string,
): Promise<string | null> {
    let bytes: number[]

    if (content instanceof Blob) {
        const buf = await content.arrayBuffer()
        bytes = Array.from(new Uint8Array(buf))
    } else if (content instanceof Uint8Array) {
        bytes = Array.from(content)
    } else {
        bytes = Array.from(new TextEncoder().encode(content))
    }

    const savedPath = await invoke<string>('save_report_file', {
        content: bytes,
        defaultName: filename,
        filterName,
        filterExt,
    })

    return savedPath || null
}
