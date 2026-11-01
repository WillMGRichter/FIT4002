import { Router, Request, Response } from "express";
import XLSX from "xlsx";
import { extractFormulas } from "./formulaExtractor";
import { createExcelUpload } from "../config/upload";

/** One formula found in a sheet, with the cell refs it mentions. */
interface FormulaEntry {
  cell: string;
  formula: string;
  references: string[];
}

/** Response shape of POST /excel/upload: the formulas found in each sheet. */
interface SheetFormulas {
  sheet: string;
  formulas: FormulaEntry[];
}

const router = Router();
const upload = createExcelUpload();

/**
 * POST /excel/upload
 * Accepts an .xlsx file upload and extracts all formulas with their cell references.
 * Input: multipart/form-data with field "file"
 * Output: Array of { sheet, formulas } where each formula has { cell, formula, references }
 */
router.post("/upload", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  const rawFormulasBySheet = extractFormulas(req.file.buffer);
  const result: SheetFormulas[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const formulas: FormulaEntry[] = [];

    for (const cellAddress in sheet) {
      if (cellAddress[0] === '!') continue;
      const cell = sheet[cellAddress];
      if (cell.f) {
        const references = cell.f.match(/([A-Z]+[0-9]+)/g) || [];
        formulas.push({
          cell: cellAddress,
          formula: cell.f,
          references,
        });
      }
    }

    const seen = new Set(formulas.map(f => f.cell));
    for (const { cell, formula } of rawFormulasBySheet.get(sheetName) || []) {
      if (seen.has(cell)) continue;
      formulas.push({
        cell,
        formula,
        references: formula.match(/([A-Z]+[0-9]+)/g) || [],
      });
    }

    result.push({ sheet: sheetName, formulas });
  });

  res.json(result);
});

export default router;