import multer from 'multer';

/** Default cap for an uploaded Excel workbook, in megabytes. */
const DEFAULT_MAX_UPLOAD_MB = 10;

/**
 * Reads MAX_UPLOAD_MB from the environment. Anything that is not a positive
 * number falls back to the default, so a typo can never silently disable the
 * limit (e.g. 0 or NaN meaning "unlimited").
 */
function readMaxUploadMb(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_MB;
}

export const MAX_UPLOAD_MB = readMaxUploadMb(process.env.MAX_UPLOAD_MB);
export const MAX_UPLOAD_BYTES = Math.floor(MAX_UPLOAD_MB * 1024 * 1024);

/**
 * Builds the multer instance used for Excel uploads.
 *
 * Files are held in memory (they are parsed immediately, never written to
 * disk), so an unbounded upload is both a memory-exhaustion and a DoS risk.
 * Cap the size and accept a single file per request. Real workbooks here are
 * ~20 KB, so the default leaves a very large margin.
 */
export function createExcelUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });
}
