import type { ImportQuotaIndicator } from "@/types";
import type ExcelJS from "exceljs";
import {
  cmToExcelImagePx,
  GOODS_EXCEL_IMAGE_HEIGHT_CM,
  GOODS_EXCEL_IMAGE_WIDTH_CM,
  goodsExcelImageRowHeightPt,
} from "@/lib/cargoImageDataUrl";

function safeFilenamePart(s: string): string {
  return s.replace(/[/\\?*[\]:]/g, "_").slice(0, 80);
}

function quotaExcelFilenameParts(r: ImportQuotaIndicator, branding: QuotaExcelBranding) {
  const stamp = new Date().toISOString().slice(0, 10);
  const reg = safeFilenamePart(r.registerNumber || "unknown");
  return { stamp, reg, prefix: branding.filePrefix };
}

function parseGoodsLineImageForExcel(dataUrl?: string): {
  base64: string;
  extension: "jpeg" | "png" | "gif";
} | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const t = dataUrl.trim().replace(/\s/g, "");
  const m = /^data:image\/(jpeg|jpg|png|gif);base64,(.+)$/i.exec(t);
  if (!m?.[2] || m[2].length < 40) return null;
  const extRaw = m[1].toLowerCase();
  const extension =
    extRaw === "jpg" || extRaw === "jpeg" ? "jpeg" : extRaw === "png" ? "png" : "gif";
  return { extension, base64: m[2] };
}

function parseExcelDate(iso: string): Date | undefined {
  const t = iso?.trim();
  if (!t) return undefined;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** exceljs writeBuffer 在浏览器里可能是 ArrayBuffer / Uint8Array / Node Buffer（polyfill） */
function toBlobPart(buf: unknown): BlobPart {
  if (buf instanceof ArrayBuffer) return buf;
  if (buf instanceof Uint8Array) return buf;
  if (
    buf &&
    typeof buf === "object" &&
    "buffer" in buf &&
    "byteOffset" in buf &&
    "byteLength" in buf
  ) {
    const v = buf as ArrayBufferView;
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  }
  throw new Error("无法生成 Excel 二进制数据");
}

function triggerDownload(buffer: BlobPart, filename: string): void {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type WorkbookCtor = new () => ExcelJS.Workbook;

function getWorkbookConstructor(mod: Record<string, unknown>): WorkbookCtor {
  const inner = (mod.default ?? mod) as Record<string, unknown>;
  const WB = inner.Workbook ?? mod.Workbook;
  if (typeof WB === "function") return WB as WorkbookCtor;
  throw new Error("ExcelJS Workbook 未找到（请确认依赖与构建配置）");
}

/** Excel 导出中的文档抬头 / 文件名前缀（进出口共用表单时可切换文案） */
export type QuotaExcelBranding = {
  summaryTitle: string;
  goodsTitle: string;
  filePrefix: string;
};

export const IMPORT_QUOTA_EXCEL_BRANDING: QuotaExcelBranding = {
  summaryTitle: "进口指标草稿 · 批文概要",
  goodsTitle: "商品明细 · Goods Lines",
  filePrefix: "进口指标草稿",
};

export const EXPORT_QUOTA_EXCEL_BRANDING: QuotaExcelBranding = {
  summaryTitle: "出口指标 · 批文概要",
  goodsTitle: "商品明细 · Goods Lines",
  filePrefix: "出口指标",
};

type ThinBorderFn = () => {
  top: { style: "thin"; color: { argb: string } };
  left: { style: "thin"; color: { argb: string } };
  bottom: { style: "thin"; color: { argb: string } };
  right: { style: "thin"; color: { argb: string } };
};

type CellVal = string | number | Date | undefined;

function populateSummarySheet(
  ws1: ExcelJS.Worksheet,
  r: ImportQuotaIndicator,
  branding: QuotaExcelBranding,
  thin: ThinBorderFn
): void {
  ws1.columns = [{ width: 30 }, { width: 56 }];

  let row = 1;

  ws1.mergeCells(row, 1, row, 2);
  const title = ws1.getCell(row, 1);
  title.value = branding.summaryTitle;
  title.font = { bold: true, size: 17, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  title.border = thin();
  ws1.getRow(row).height = 40;
  row++;

  ws1.mergeCells(row, 1, row, 2);
  const sub = ws1.getCell(row, 1);
  sub.value = `注册号：${r.registerNumber || "—"}　　　导出：${new Date().toLocaleString("zh-CN", { hour12: false })}`;
  sub.font = { size: 11, color: { argb: "FF334155" } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  sub.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  sub.border = thin();
  ws1.getRow(row).height = 28;
  row++;

  ws1.getRow(row).height = 10;
  row++;

  function sectionBanner(text: string) {
    ws1.mergeCells(row, 1, row, 2);
    const c = ws1.getCell(row, 1);
    c.value = text;
    c.font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFDBFE" } };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    c.border = thin();
    ws1.getRow(row).height = 28;
    row++;
  }

  function addLabelValue(label: string, val: CellVal, opts?: { numFmt?: string }) {
    const ra = ws1.getCell(row, 1);
    const rb = ws1.getCell(row, 2);
    ra.value = label;
    ra.font = { bold: true, color: { argb: "FF475569" }, size: 11 };
    ra.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    ra.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
    ra.border = thin();

    if (typeof val === "number") {
      rb.value = val;
      rb.numFmt = opts?.numFmt ?? "#,##0";
      rb.font = { color: { argb: "FF0F172A" }, size: 11 };
      rb.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    } else if (val instanceof Date) {
      rb.value = val;
      rb.numFmt = opts?.numFmt ?? "yyyy-mm-dd";
      rb.font = { color: { argb: "FF0F172A" }, size: 11 };
      rb.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    } else {
      const s = val === undefined || val === "" ? "—" : String(val);
      rb.value = s;
      rb.font =
        s === "—"
          ? { italic: true, color: { argb: "FF94A3B8" }, size: 11 }
          : { color: { argb: "FF0F172A" }, size: 11 };
      rb.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
    }
    rb.border = thin();

    const longText =
      (typeof val === "string" && val.length > 48) ||
      label.length > 28 ||
      (typeof val === "string" && val.includes("\n"));
    ws1.getRow(row).height = longText ? 32 : 24;
    row++;
  }

  sectionBanner("　基本信息");

  addLabelValue("注册号 Register No.", r.registerNumber || undefined);
  addLabelValue("客户名称", r.customerName || undefined);
  addLabelValue("卸货港 Port of Discharge", r.portOfDischarge || undefined);
  addLabelValue("起始日期 Start Date", parseExcelDate(r.startDate));
  addLabelValue("截止日期 ED Date", parseExcelDate(r.edDate));

  ws1.getRow(row).height = 10;
  row++;

  sectionBanner("　三期款项（缅币 MMK）");

  addLabelValue("申请批文订金 First Deposited", r.firstDeposited, { numFmt: "#,##0" });
  addLabelValue("　└ 经手人 · 收款账号名（订金）", r.firstDepositedHandler || undefined);
  addLabelValue("ANNI Fees Second Deposited", r.secondDeposited, { numFmt: "#,##0" });
  addLabelValue("　└ 经手人 · 收款账号名（ANNI）", r.secondDepositedHandler || undefined);
  addLabelValue("License Remaining Balance", r.remainingBalance, { numFmt: "#,##0" });
  addLabelValue("　└ 经手人 · 收款账号名（License）", r.remainingBalanceHandler || undefined);

  addLabelValue("Total Charges For License（缅币 MMK）", r.totalChargesForLicense, {
    numFmt: "#,##0",
  });
  const depositsSum =
    Math.floor(Number(r.firstDeposited) || 0) +
    Math.floor(Number(r.secondDeposited) || 0) +
    Math.floor(Number(r.remainingBalance) || 0);
  addLabelValue(
    "Balance（Total Charges − 三期合计）",
    Math.floor(Number(r.totalChargesForLicense) || 0) - depositsSum,
    { numFmt: "#,##0" }
  );

  ws1.getRow(row).height = 10;
  row++;

  sectionBanner("　系统记录");

  const created = new Date(r.createdAt);
  const updated = new Date(r.updatedAt);
  addLabelValue(
    "创建时间 Created",
    Number.isNaN(created.getTime()) ? "—" : created,
    { numFmt: "yyyy-mm-dd hh:mm:ss" }
  );
  addLabelValue(
    "更新时间 Updated",
    Number.isNaN(updated.getTime()) ? "—" : updated,
    { numFmt: "yyyy-mm-dd hh:mm:ss" }
  );
}

function populateGoodsSheet(
  wb: ExcelJS.Workbook,
  ws2: ExcelJS.Worksheet,
  r: ImportQuotaIndicator,
  branding: QuotaExcelBranding,
  thin: ThinBorderFn
): void {
  const hdrRow = 4;

  ws2.columns = [
    { width: 8 },
    { width: 14 },
    { width: 18 },
    { width: 40 },
    { width: 32 },
    { width: 10 },
    { width: 14 },
    { width: 11 },
    { width: 14 },
    { width: 16 },
  ];

  const goodsImgW = cmToExcelImagePx(GOODS_EXCEL_IMAGE_WIDTH_CM);
  const goodsImgH = cmToExcelImagePx(GOODS_EXCEL_IMAGE_HEIGHT_CM);

  let row = 1;
  ws2.mergeCells(row, 1, row, 10);
  const gt = ws2.getCell(row, 1);
  gt.value = branding.goodsTitle;
  gt.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  gt.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  gt.alignment = { vertical: "middle", horizontal: "center" };
  gt.border = thin();
  ws2.getRow(row).height = 38;
  row++;

  ws2.mergeCells(row, 1, row, 10);
  const gs = ws2.getCell(row, 1);
  gs.value = `与本批文关联的商品共 ${r.goodsLines.length} 条（可在表头行使用筛选）`;
  gs.font = { size: 11, color: { argb: "FF334155" } };
  gs.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  gs.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  gs.border = thin();
  ws2.getRow(row).height = 26;
  row++;

  ws2.getRow(row).height = 8;
  row++;

  const headers = [
    "序号",
    "H.S Code\n（10 位）",
    `货物图片\n（≈宽 ${GOODS_EXCEL_IMAGE_WIDTH_CM} cm × 高 ${GOODS_EXCEL_IMAGE_HEIGHT_CM} cm）`,
    "货物描述（英文）\nCargo Description",
    "缅甸文描述\nMyanmar",
    "单位\nUnit",
    "单价\nSet Price",
    "币种",
    "数量\nQty",
    "行小计\nLine Total",
  ];

  const hr = ws2.getRow(row);
  hr.height = 36;
  headers.forEach((text, i) => {
    const cell = ws2.getCell(row, i + 1);
    cell.value = text;
    cell.font = { bold: true, size: 11, color: { argb: "FF1E3A8A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFDBFE" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thin();
  });
  row++;

  const firstDataRow = row;

  r.goodsLines.forEach((line, idx) => {
    const alt = idx % 2 === 1;
    const bg = alt ? "FFF8FAFC" : "FFFFFFFF";
    const dataRow = ws2.getRow(row);
    const lineImg = parseGoodsLineImageForExcel(line.cargoImageDataUrl);

    const cells: {
      col: number;
      val: string | number;
      fmt?: string;
      align?: "left" | "center" | "right";
      wrap?: boolean;
    }[] = [
      { col: 1, val: idx + 1, align: "center" },
      { col: 2, val: line.hsCode || "—", align: "center" },
      { col: 3, val: lineImg ? "" : "—", align: "center" },
      { col: 4, val: line.cargoDescription || "—", align: "left", wrap: true },
      { col: 5, val: line.myanmarDescription || "—", align: "left", wrap: true },
      { col: 6, val: line.unitCode, align: "center" },
      { col: 7, val: line.setPrice, fmt: "#,##0.00", align: "right" },
      { col: 8, val: line.setPriceCurrency, align: "center" },
      { col: 9, val: line.quantity, fmt: "#,##0", align: "right" },
      { col: 10, val: line.lineTotal, fmt: "#,##0.00", align: "right" },
    ];

    for (const { col, val, fmt, align, wrap } of cells) {
      const cell = ws2.getCell(row, col);
      cell.value = val;
      if (fmt) cell.numFmt = fmt;
      cell.font = { size: 11, color: { argb: "FF0F172A" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = {
        vertical: "middle",
        horizontal: align ?? "left",
        wrapText: wrap ?? false,
      };
      cell.border = thin();
    }

    const descLen = Math.max(line.cargoDescription.length, line.myanmarDescription.length);
    let rowPt = descLen > 120 ? 40 : 26;
    if (lineImg) rowPt = Math.max(rowPt, goodsExcelImageRowHeightPt());
    dataRow.height = rowPt;

    if (lineImg) {
      try {
        const imageId = wb.addImage({
          base64: lineImg.base64,
          extension: lineImg.extension,
        });
        ws2.addImage(imageId, {
          tl: { col: 2 + 0.06, row: row - 1 + 0.06 },
          ext: { width: goodsImgW, height: goodsImgH },
          editAs: "oneCell",
        });
      } catch {
        /* 嵌入失败则保留占位 */
      }
    }

    row++;
  });

  const lastDataRow = row - 1;
  if (r.goodsLines.length > 0 && lastDataRow >= firstDataRow) {
    ws2.autoFilter = {
      from: { row: hdrRow, column: 1 },
      to: { row: lastDataRow, column: 10 },
    };
  }
}

async function quotaExcelWorkbookSetup(): Promise<{
  wb: ExcelJS.Workbook;
  thin: ThinBorderFn;
}> {
  const mod = (await import("exceljs")) as unknown as Record<string, unknown>;
  const WorkbookClass = getWorkbookConstructor(mod);
  const BORDER = "FFB8C4CE";

  const thin: ThinBorderFn = () => ({
    top: { style: "thin", color: { argb: BORDER } },
    left: { style: "thin", color: { argb: BORDER } },
    bottom: { style: "thin", color: { argb: BORDER } },
    right: { style: "thin", color: { argb: BORDER } },
  });

  const wb = new WorkbookClass();
  wb.creator = "Myanmar Customs Admin";
  wb.created = new Date();
  return { wb, thin };
}

/** 仅导出批文概要工作簿（单 Sheet「批文概要」） */
export async function downloadQuotaIndicatorSummaryExcel(
  r: ImportQuotaIndicator,
  branding: QuotaExcelBranding = IMPORT_QUOTA_EXCEL_BRANDING
): Promise<void> {
  const { wb, thin } = await quotaExcelWorkbookSetup();
  const ws1 = wb.addWorksheet("批文概要", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 22 },
  });
  populateSummarySheet(ws1, r, branding, thin);

  const { stamp, reg, prefix } = quotaExcelFilenameParts(r, branding);
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(toBlobPart(buf), `${prefix}_批文概要_${reg}_${stamp}.xlsx`);
}

/** 仅导出商品明细工作簿（单 Sheet「商品明细」） */
export async function downloadQuotaIndicatorGoodsExcel(
  r: ImportQuotaIndicator,
  branding: QuotaExcelBranding = IMPORT_QUOTA_EXCEL_BRANDING
): Promise<void> {
  const { wb, thin } = await quotaExcelWorkbookSetup();
  const hdrRow = 4;
  const ws2 = wb.addWorksheet("商品明细", {
    views: [{ state: "frozen", ySplit: hdrRow, showGridLines: false }],
    properties: { defaultRowHeight: 22 },
  });
  populateGoodsSheet(wb, ws2, r, branding, thin);

  const { stamp, reg, prefix } = quotaExcelFilenameParts(r, branding);
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(toBlobPart(buf), `${prefix}_商品明细_${reg}_${stamp}.xlsx`);
}
