/**
 * BOM Parser
 * CSV/Excel 파일에서 BOM 데이터를 파싱하는 모듈
 * 
 * 지원 형식:
 * - CSV (쉼표 구분)
 * - Excel (.xlsx, .xls)
 * 
 * 필수 컬럼: 자재명, 수량, 단위
 * 선택 컬럼: 원산지, 공급업체, 자체 배출계수
 */

import { BomItem, BomParseResult } from './types';

// ============================================================================
// 컬럼 매핑 (다양한 헤더명 지원)
// ============================================================================

const COLUMN_ALIASES = {
    name: ['자재명', '재료명', '품명', '부품명', 'material', 'name', 'item', 'component', '원료명'],
    quantity: ['수량', '양', 'quantity', 'qty', 'amount', '사용량', '투입량'],
    unit: ['단위', 'unit', 'uom', '단위(unit)'],
    origin: ['원산지', '조달지역', 'origin', 'country', 'region', '지역'],
    supplier: ['공급업체', '공급사', 'supplier', 'vendor', '업체명'],
    customEF: ['배출계수', 'ef', 'emission factor', '탄소배출계수', 'co2', 'ghg']
};

// ============================================================================
// 단위 정규화
// ============================================================================

const UNIT_NORMALIZATIONS: Record<string, string> = {
    // 질량
    'kg': 'kg',
    'kilogram': 'kg',
    '킬로그램': 'kg',
    'g': 'g',
    'gram': 'g',
    '그램': 'g',
    't': 't',
    'ton': 't',
    'tonne': 't',
    '톤': 't',

    // 에너지
    'kwh': 'kWh',
    'kw/h': 'kWh',
    '킬로와트시': 'kWh',
    'mj': 'MJ',
    '메가줄': 'MJ',

    // 부피
    'm3': 'm³',
    'm³': 'm³',
    '세제곱미터': 'm³',
    'l': 'L',
    'liter': 'L',
    'litre': 'L',
    '리터': 'L',

    // 면적
    'm2': 'm²',
    'm²': 'm²',
    '제곱미터': 'm²',

    // 개수
    'ea': 'ea',
    'pcs': 'ea',
    '개': 'ea',
    '매': 'ea'
};

/**
 * 단위를 표준 형식으로 정규화
 */
function normalizeUnit(unit: string): string {
    const lower = unit.toLowerCase().trim();
    return UNIT_NORMALIZATIONS[lower] || unit.trim();
}

// ============================================================================
// 헤더 컬럼 인덱스 찾기
// ============================================================================

interface ColumnIndices {
    name: number;
    quantity: number;
    unit: number;
    origin?: number;
    supplier?: number;
    customEF?: number;
}

function findColumnIndices(headers: string[]): ColumnIndices | null {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    const findIndex = (aliases: string[]): number => {
        for (const alias of aliases) {
            const idx = lowerHeaders.indexOf(alias.toLowerCase());
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const nameIdx = findIndex(COLUMN_ALIASES.name);
    const quantityIdx = findIndex(COLUMN_ALIASES.quantity);
    const unitIdx = findIndex(COLUMN_ALIASES.unit);

    // 필수 컬럼 체크
    if (nameIdx === -1 || quantityIdx === -1 || unitIdx === -1) {
        return null;
    }

    return {
        name: nameIdx,
        quantity: quantityIdx,
        unit: unitIdx,
        origin: findIndex(COLUMN_ALIASES.origin) !== -1 ? findIndex(COLUMN_ALIASES.origin) : undefined,
        supplier: findIndex(COLUMN_ALIASES.supplier) !== -1 ? findIndex(COLUMN_ALIASES.supplier) : undefined,
        customEF: findIndex(COLUMN_ALIASES.customEF) !== -1 ? findIndex(COLUMN_ALIASES.customEF) : undefined
    };
}

// ============================================================================
// CSV 파싱
// ============================================================================

/**
 * CSV 문자열을 BOM 항목 배열로 파싱
 */
export function parseCsv(csvContent: string): BomParseResult {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    const errors: BomParseResult['errors'] = [];
    const warnings: string[] = [];
    const items: BomItem[] = [];

    if (lines.length < 2) {
        return {
            success: false,
            items: [],
            errors: [{ row: 0, message: '데이터가 없습니다. 헤더와 최소 1개 이상의 데이터 행이 필요합니다.' }],
            warnings: []
        };
    }

    // 헤더 파싱
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const indices = findColumnIndices(headers);

    if (!indices) {
        const missing: string[] = [];
        if (!headers.some(h => COLUMN_ALIASES.name.some(a => h.toLowerCase().includes(a.toLowerCase())))) {
            missing.push('자재명');
        }
        if (!headers.some(h => COLUMN_ALIASES.quantity.some(a => h.toLowerCase().includes(a.toLowerCase())))) {
            missing.push('수량');
        }
        if (!headers.some(h => COLUMN_ALIASES.unit.some(a => h.toLowerCase().includes(a.toLowerCase())))) {
            missing.push('단위');
        }
        return {
            success: false,
            items: [],
            errors: [{ row: 1, message: `필수 컬럼을 찾을 수 없습니다: ${missing.join(', ')}` }],
            warnings: []
        };
    }

    // 데이터 행 파싱
    const seenNames = new Map<string, number>();

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const rowNum = i + 1;

        // 자재명 체크
        const name = row[indices.name]?.trim();
        if (!name) {
            errors.push({ row: rowNum, message: '자재명이 비어있습니다.' });
            continue;
        }

        // 수량 체크
        const quantityStr = row[indices.quantity]?.trim();
        const quantity = parseFloat(quantityStr);
        if (isNaN(quantity) || quantity <= 0) {
            errors.push({ row: rowNum, message: `수량이 유효하지 않습니다: "${quantityStr}"` });
            continue;
        }

        // 단위 체크
        const rawUnit = row[indices.unit]?.trim();
        if (!rawUnit) {
            errors.push({ row: rowNum, message: '단위가 비어있습니다.' });
            continue;
        }
        const unit = normalizeUnit(rawUnit);

        // 중복 체크
        if (seenNames.has(name)) {
            warnings.push(`중복 자재 발견: "${name}" (행 ${seenNames.get(name)} 및 ${rowNum})`);
        }
        seenNames.set(name, rowNum);

        // BOM 항목 생성
        const item: BomItem = { name, quantity, unit };

        if (indices.origin !== undefined && row[indices.origin]) {
            item.origin = row[indices.origin].trim();
        }
        if (indices.supplier !== undefined && row[indices.supplier]) {
            item.supplier = row[indices.supplier].trim();
        }
        if (indices.customEF !== undefined && row[indices.customEF]) {
            const ef = parseFloat(row[indices.customEF]);
            if (!isNaN(ef)) {
                item.customEF = ef;
            }
        }

        items.push(item);
    }

    return {
        success: errors.length === 0,
        items,
        errors,
        warnings
    };
}

// ============================================================================
// Excel 파싱 (xlsx 라이브러리 필요)
// ============================================================================

/**
 * Excel 파일 (ArrayBuffer)을 BOM 항목 배열로 파싱
 * 주의: 이 함수는 클라이언트에서 xlsx 라이브러리가 필요합니다
 * npm install xlsx
 */
export async function parseExcel(fileBuffer: ArrayBuffer): Promise<BomParseResult> {
    try {
        // 동적 import (Next.js 환경에서 클라이언트 전용)
        const XLSX = await import('xlsx');

        const workbook = XLSX.read(fileBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // CSV 형식으로 변환 후 파싱
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);
        return parseCsv(csvContent);
    } catch (error) {
        console.error('Excel parsing error:', error);
        return {
            success: false,
            items: [],
            errors: [{ row: 0, message: 'Excel 파일을 읽을 수 없습니다. 파일 형식을 확인해주세요.' }],
            warnings: []
        };
    }
}

// ============================================================================
// 파일 자동 감지 및 파싱
// ============================================================================

/**
 * 파일 타입을 자동 감지하여 적절한 파서 호출
 */
export async function parseFile(file: File): Promise<BomParseResult> {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
        const text = await file.text();
        return parseCsv(text);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        return parseExcel(buffer);
    } else {
        return {
            success: false,
            items: [],
            errors: [{ row: 0, message: '지원하지 않는 파일 형식입니다. CSV 또는 Excel(.xlsx) 파일을 업로드해주세요.' }],
            warnings: []
        };
    }
}

// ============================================================================
// 템플릿 생성
// ============================================================================

/**
 * BOM 업로드용 CSV 템플릿 생성
 * UTF-8 BOM을 포함하여 Excel에서 한글이 깨지지 않도록 함
 */
export function generateBomTemplate(): string {
    // UTF-8 BOM (Byte Order Mark) - Excel이 UTF-8을 인식하도록 함
    const UTF8_BOM = '\uFEFF';
    const headers = ['자재명', '수량', '단위', '원산지', '공급업체', '배출계수(선택)'];
    const exampleRow = ['알루미늄 판재', '150', 'kg', 'KR', 'ABC금속', ''];

    return UTF8_BOM + [headers.join(','), exampleRow.join(',')].join('\n');
}
