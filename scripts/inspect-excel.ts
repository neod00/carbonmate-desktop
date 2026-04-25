import * as XLSX from "xlsx";
import * as path from "path";

const EXCEL_PATH = path.join(
    __dirname,
    "../../LCA Platform2/meili/data/Database Overview v3.12 (1).xlsx"
);

const wb = XLSX.readFile(EXCEL_PATH);
console.log("Sheets:", wb.SheetNames);

for (const sheetName of wb.SheetNames.slice(0, 3)) {
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    console.log(`\n=== Sheet: "${sheetName}" (${rows.length} rows) ===`);
    // 첫 5행 출력
    for (let i = 0; i < Math.min(5, rows.length); i++) {
        console.log(`Row ${i}:`, rows[i]);
    }
}
