const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const app = express();
const port = 3000;

// Set up multer to store uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

// POST /upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Read workbook from buffer
  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  const result = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const formulas = [];

    for (const cellAddress in sheet) {
      const cell = sheet[cellAddress];

      if (cell.f) { // if the cell has a formula
        const references = cell.f.match(/([A-Z]+[0-9]+)/g) || [];
        formulas.push({
          cell: cellAddress,
          formula: cell.f,
          references
        });
      }
    }

    result.push({ sheet: sheetName, formulas });
  });

  res.json(result);
});

app.listen(port, () => {
  console.log(`Excel formula API running on http://localhost:${port}`);
});