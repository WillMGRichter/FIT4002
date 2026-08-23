import { inflateRawSync } from "zlib";

export interface RawFormula {
  cell: string;
  formula: string;
}

function readZipEntries(buffer: Buffer): Record<string, Buffer> {
  const entries: Record<string, Buffer> = {};
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocdIndex = buffer.lastIndexOf(signature);
  if (eocdIndex === -1) return entries;

  const centralDirOffset = buffer.readUInt32LE(eocdIndex + 16);
  const centralDirSize = buffer.readUInt32LE(eocdIndex + 12);

  let p = centralDirOffset;
  const end = centralDirOffset + centralDirSize;
  while (p < end) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(p + 10);
    const compressedSize = buffer.readUInt32LE(p + 20);
    const nameLength = buffer.readUInt16LE(p + 28);
    const extraLength = buffer.readUInt16LE(p + 30);
    const commentLength = buffer.readUInt16LE(p + 32);
    const localHeaderOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.slice(p + 46, p + 46 + nameLength).toString("utf8");

    const lhNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const lhExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lhNameLength + lhExtraLength;
    const data = buffer.slice(dataStart, dataStart + compressedSize);

    entries[name] = method === 0 ? Buffer.from(data) : inflateRawSync(data);
    p += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function parseSheets(workbookXml: string): { name: string; rid: string }[] {
  const sheets: { name: string; rid: string }[] = [];
  const tagRegex = /<sheet\b[^>]*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(workbookXml)) !== null) {
    const tag = match[0];
    const name = /name="([^"]*)"/.exec(tag);
    const rid = /\br:id="([^"]+)"/.exec(tag);
    if (name && rid) sheets.push({ name: name[1], rid: rid[1] });
  }
  return sheets;
}

function parseRels(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  const tagRegex = /<Relationship\b[^>]*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(relsXml)) !== null) {
    const tag = match[0];
    const id = /\bId="([^"]+)"/.exec(tag);
    const target = /\bTarget="([^"]+)"/.exec(tag);
    if (id && target) map.set(id[1], target[1]);
  }
  return map;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function colToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + col.charCodeAt(i) - 64;
  }
  return index;
}

function indexToCol(index: number): string {
  let col = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    index = Math.floor((index - 1) / 26);
  }
  return col;
}

function translateSharedFormula(formula: string, masterRef: string, cellRef: string): string {
  const parseRef = (ref: string): { col: number; row: number } | null => {
    const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
    return m ? { col: colToIndex(m[1]), row: parseInt(m[2], 10) } : null;
  };

  const master = parseRef(masterRef.split(":")[0]);
  const cell = parseRef(cellRef);
  if (!master || !cell) return unescapeXml(formula);

  const rowOffset = cell.row - master.row;
  const colOffset = cell.col - master.col;

  return formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (_s, absoluteCol: string, letters: string, absoluteRow: string, digits: string) => {
    const col = colToIndex(letters.toUpperCase()) + (absoluteCol ? 0 : colOffset);
    const row = parseInt(digits, 10) + (absoluteRow ? 0 : rowOffset);
    return (absoluteCol ? "$" : "") + indexToCol(col) + (absoluteRow ? "$" : "") + row;
  });
}

export function parseSheetFormulas(sheetXml: string): RawFormula[] {
  const formulas: RawFormula[] = [];
  const sharedMasters: Record<number, { ref: string; formula: string }> = {};

  const cellRegex = /<c\b[^>]*>(.*?)<\/c>/g;
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(sheetXml)) !== null) {
    const cellTag = match[0];
    const content = match[1];
    const ref = /\br="([A-Z]+\d+)"/.exec(cellTag);
    if (!ref) continue;

    const fMatch = /<f\b([^>]*)>(.*?)<\/f>/.exec(content);
    if (!fMatch) continue;

    const fAttrs = fMatch[1];
    const fBody = fMatch[2];
    const type = /\bt="([^"]+)"/.exec(fAttrs);
    const si = /\bsi="(\d+)"/.exec(fAttrs);
    const refAttr = /\bref="([^"]+)"/.exec(fAttrs);
    const formulaType = type ? type[1] : "normal";

    if (formulaType === "shared") {
      if (si) {
        sharedMasters[parseInt(si[1], 10)] = {
          ref: refAttr ? refAttr[1] : ref[1],
          formula: fBody,
        };
      }
      if (fBody) {
        formulas.push({ cell: ref[1], formula: unescapeXml(fBody) });
        continue;
      }
      const siValue = si ? parseInt(si[1], 10) : -1;
      const master = sharedMasters[siValue];
      if (master) {
        formulas.push({ cell: ref[1], formula: translateSharedFormula(master.formula, master.ref, ref[1]) });
      }
      continue;
    }

    formulas.push({ cell: ref[1], formula: unescapeXml(fBody) });
  }

  return formulas;
}

/**
 * Extracts every formula cell directly from the raw worksheet XML.
 * Required because the `xlsx` library silently drops formula cells that have
 * no cached value (openpyxl-generated files always omit cached values).
 *
 * Returns a map of sheet name -> formula cells (formula strings have no leading "=").
 */
export function extractFormulas(buffer: Buffer): Map<string, RawFormula[]> {
  const result = new Map<string, RawFormula[]>();
  const entries = readZipEntries(buffer);

  const workbookXml = entries["xl/workbook.xml"];
  const relsXml = entries["xl/_rels/workbook.xml.rels"];
  if (!workbookXml || !relsXml) return result;

  const sheets = parseSheets(workbookXml.toString("utf8"));
  const targets = parseRels(relsXml.toString("utf8"));

  for (const sheet of sheets) {
    const target = targets.get(sheet.rid);
    if (!target) continue;
    let path = target;
    if (path.startsWith("/")) {
      path = path.replace(/^\//, "");
    } else if (!path.startsWith("xl/")) {
      path = "xl/" + path;
    }
    const sheetXml = entries[path];
    if (!sheetXml) continue;
    result.set(sheet.name, parseSheetFormulas(sheetXml.toString("utf8")));
  }

  return result;
}
