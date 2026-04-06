import express, { Request, Response } from "express";
import multer from "multer";
import XLSX from "xlsx";
import cors from "cors";

const app = express();
const port = 5000;

// Enable CORS if frontend is on a different port
app.use(cors());

// Multer config: store uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

// POST /excel/upload
app.post("/excel/upload", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Read workbook from buffer
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const result: any[] = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const formulas: any[] = [];

      for (const cellAddress in sheet) {
        const cell = sheet[cellAddress];

        if (cell.f) { // formula exists
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process Excel file" });
  }
});

app.listen(port, () => {
  console.log(`Excel formula API running at http://localhost:${port}/excel/upload`);
});