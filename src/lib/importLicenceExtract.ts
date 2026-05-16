import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type {
  ImportIndicatorCurrencyCode,
  ImportIndicatorUnitCode,
} from "@/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export type ParsedLicenceGoodsRow = {
  hsCode: string;
  cargoDescription: string;
  unitCode: ImportIndicatorUnitCode;
  setPrice: number;
  quantity: number;
  lineTotal: number;
};

export type ParsedImportLicence = {
  registerNumber: string;
  importerName: string;
  currency: ImportIndicatorCurrencyCode;
  rows: ParsedLicenceGoodsRow[];
};

function normalizeWhitespace(t: string): string {
  return t
    .replace(/\r\n/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** 缓解 OCR 在数字中间插入空格 */
function tightenDigitSpans(t: string): string {
  let s = t.replace(/(\d)\s+(?=\d)/g, "$1");
  s = s.replace(/(\d)\s+(?=\d)/g, "$1");
  return s;
}

function normalizeForMatch(t: string): string {
  return tightenDigitSpans(normalizeWhitespace(t)).replace(/\n+/g, " ");
}

function parseMoney(raw: string): number {
  const x = raw.replace(/,/g, "").trim();
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeUnit(raw: string): ImportIndicatorUnitCode {
  const u = raw.trim().toUpperCase().replace(/\s/g, "");
  if (u === "M2") return "M²";
  if (u === "M3") return "M³";
  if (u === "KG") return "KG";
  if (u === "U") return "U";
  if (u === "PR") return "PR";
  if (u === "M²" || u === "M³") return u as ImportIndicatorUnitCode;
  return "KG";
}

function detectCurrency(text: string): ImportIndicatorCurrencyCode {
  const t = text.toUpperCase();
  if (/\bCNY\b|\bRMB\b|人民币/i.test(t)) return "CNY";
  if (/\bUSD\b|美金|美元/i.test(t)) return "USD";
  if (/\bMMK\b|缅币/i.test(t)) return "MMK";
  if (/\bTHB\b/.test(t)) return "THB";
  if (/\bEUR\b/.test(t)) return "EUR";
  if (/\bSGD\b/.test(t)) return "SGD";
  if (/\bJPY\b/.test(t)) return "JPY";
  return "USD";
}

const UNIT_RX = "(KG|U|M²|M³|M2|M3|PR)";

function pushParsedRow(
  rows: ParsedLicenceGoodsRow[],
  hsCode: string,
  descRaw: string,
  unitRaw: string,
  pStr: string,
  qStr: string,
  tStr: string
): void {
  const setPrice = parseMoney(pStr);
  const qtyFloat = parseMoney(qStr);
  const lineTotal = parseMoney(tStr);
  if (!Number.isFinite(setPrice) || !Number.isFinite(qtyFloat) || !Number.isFinite(lineTotal))
    return;
  let desc = descRaw.replace(/\s+/g, " ").trim();
  desc = desc.replace(/\s+(KG|U|M²|M³|PR)$/i, "").trim();
  if (!desc || hsCode.length !== 10) return;
  rows.push({
    hsCode,
    cargoDescription: desc,
    unitCode: normalizeUnit(unitRaw),
    setPrice,
    quantity: Math.min(Math.floor(qtyFloat), Number.MAX_SAFE_INTEGER),
    lineTotal,
  });
}

function parseGoodsRowsFromText(text: string): ParsedLicenceGoodsRow[] {
  const rows: ParsedLicenceGoodsRow[] = [];
  const flat = normalizeForMatch(text);

  const globRe = new RegExp(
    `\\b(\\d{10})\\s+([A-Za-z0-9][A-Za-z0-9.,'&\\-\\s]{2,}?)\\s+${UNIT_RX}\\s+([\\d.,]+)\\s+([\\d.,]+)\\s+([\\d.,]+)`,
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = globRe.exec(flat)) !== null) {
    pushParsedRow(rows, m[1], m[2], m[3], m[4], m[5], m[6]);
  }
  if (rows.length === 0) {
    const lineRe = new RegExp(
      `^(?:\\d+\\s+)?(\\d{10})\\s+(.+?)\\s+${UNIT_RX}\\s+([\\d.,]+)\\s+([\\d.,]+)\\s+([\\d.,]+)\\s*$`,
      "i"
    );
    for (const line of normalizeWhitespace(text).split("\n")) {
      const ln = line.trim();
      if (!ln) continue;
      const lm = ln.match(lineRe);
      if (lm) pushParsedRow(rows, lm[1], lm[2], lm[3], lm[4], lm[5], lm[6]);
    }
  }

  const seen = new Set<string>();
  const deduped: ParsedLicenceGoodsRow[] = [];
  for (const r of rows) {
    const k = `${r.hsCode}|${r.cargoDescription}|${r.setPrice}|${r.quantity}|${r.lineTotal}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }
  return deduped;
}

function extractRegister(text: string): string {
  const flat = normalizeForMatch(text);
  const a = flat.match(
    /(?:Registration|REG(?:ISTRATION)?)\s*(?:No\.?|N[oO]\.?|#)?\s*[:\s.-]*(\d{8,12})/i
  );
  if (a) return a[1].replace(/\D/g, "").slice(0, 12);
  const b = flat.match(/\b(\d{9})\s*(?:\(|Valid|VALID)/);
  if (b) return b[1];
  const c = flat.match(/\b(\d{8,10})\b/);
  return c ? c[1] : "";
}

function extractImporter(text: string): string {
  const flat = normalizeForMatch(text);
  const m = flat.match(
    /([A-Z][A-Z0-9\s,.'&\-]{10,180}?(?:LIMITED|LTD\.?|INC\.?|CO\.?,?\s*LTD))\b/i
  );
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

export function parseImportLicenceText(rawText: string): ParsedImportLicence {
  const currency = detectCurrency(rawText);
  const rows = parseGoodsRowsFromText(rawText);
  return {
    registerNumber: extractRegister(rawText),
    importerName: extractImporter(rawText),
    currency,
    rows,
  };
}

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    for (const item of tc.items) {
      if (typeof item === "object" && item !== null && "str" in item) {
        const s = String((item as { str?: string }).str ?? "");
        if (s) parts.push(s);
      }
    }
    parts.push("\n");
  }
  return parts.join(" ");
}

export async function renderPdfFirstPageCanvas(data: ArrayBuffer): Promise<HTMLCanvasElement> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const task = page.render({ canvas, viewport });
  await task.promise;
  return canvas;
}

export async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(canvas);
    return text;
  } finally {
    await worker.terminate();
  }
}

export async function ocrImageFile(file: File): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text;
  } finally {
    await worker.terminate();
  }
}

/** PDF：先抽文本；若无表格再对首页 OCR（扫描件） */
export async function extractLicencePlaintext(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  if (isPdf) {
    const buf = await file.arrayBuffer();
    let text = await extractPdfText(buf);
    const parsed = parseImportLicenceText(text);
    if (parsed.rows.length === 0 || text.replace(/\s/g, "").length < 120) {
      const canvas = await renderPdfFirstPageCanvas(buf);
      const ocrText = await ocrCanvas(canvas);
      text = `${text}\n${ocrText}`;
    }
    return text;
  }
  return ocrImageFile(file);
}
