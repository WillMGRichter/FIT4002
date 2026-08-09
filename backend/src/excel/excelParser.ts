import { Router, Request, Response } from "express";
import multer from "multer";
import XLSX from "xlsx";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /excel/upload
 * Accepts an .xlsx file upload and extracts all formulas with their cell references.
 * Input: multipart/form-data with field "file"
 * Output: Array of { sheet, formulas } where each formula has { cell, formula, references }
 */
router.post("/upload", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  const result: any[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const formulas: any[] = [];

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

    result.push({ sheet: sheetName, formulas });
  });

  res.json(result);
});

export default router;