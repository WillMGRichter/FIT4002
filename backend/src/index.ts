import express from "express";
import { Express } from "express";
import cors from "cors";
import multer from "multer";
import XLSX from "xlsx";
import { Request } from "express";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const app = express();
const PORT = 5000;

// Enable CORS if frontend is on a different port
app.use(cors());

// Multer config: store uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

// POST /excel/upload
app.post("/excel/upload", upload.single("file"), (req: MulterRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // read Excel from buffer
  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  const result: any[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const formulas: any[] = [];

    for (const cellAddress in sheet) {
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

app.get("/", (req, res) => {
  res.send({ message: "Hello from backend!" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



