import { invoke } from '@tauri-apps/api/core';

const FILE_FORMAT_VERSION = '1.0';

export interface CarbonmateFile {
    version: string;
    appVersion: string;
    savedAt: string;
    project: Record<string, unknown>;
}

/**
 * 현재 프로젝트 상태를 .carbonmate 파일로 저장
 * @returns 저장된 파일 경로 (취소 시 null)
 */
export async function saveProjectFile(
    projectState: Record<string, unknown>,
    productName?: string
): Promise<string | null> {
    const fileData: CarbonmateFile = {
        version: FILE_FORMAT_VERSION,
        appVersion: '1.0.0',
        savedAt: new Date().toISOString(),
        project: projectState,
    };

    const defaultName = productName
        ? `${productName.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim()}.carbonmate`
        : 'project.carbonmate';

    const savedPath = await invoke<string>('save_project_file', {
        content: JSON.stringify(fileData, null, 2),
        defaultName,
    });

    return savedPath || null;
}

/**
 * .carbonmate 파일을 열고 프로젝트 상태 반환
 * @returns 프로젝트 상태 객체 (취소 시 null)
 */
export async function loadProjectFile(): Promise<Record<string, unknown> | null> {
    const content = await invoke<string>('load_project_file');
    if (!content) return null;

    const fileData: CarbonmateFile = JSON.parse(content);

    if (!fileData.version || !fileData.project) {
        throw new Error('올바른 CarbonMate 프로젝트 파일이 아닙니다.');
    }

    return fileData.project;
}
