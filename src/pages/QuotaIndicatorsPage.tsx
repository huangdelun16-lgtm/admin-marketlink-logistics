import type { ReactNode } from "react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import type {
  ImportGoodsLine,
  ImportIndicatorCurrencyCode,
  ImportIndicatorUnitCode,
  ImportQuotaIndicator,
} from "@/types";
import {
  downloadQuotaIndicatorGoodsExcel,
  downloadQuotaIndicatorSummaryExcel,
  type QuotaExcelBranding,
} from "@/lib/exportImportIndicatorExcel";
import {
  compressImageFileToJpegDataUrl,
  MAX_CARGO_IMAGE_DATA_URL_CHARS,
} from "@/lib/cargoImageDataUrl";
import {
  formatMmkDigitStringForInput,
  mmkIntToDigitInput,
  parseMmkIntString,
  stripMmkDigitString,
} from "@/lib/mmkFormat";
import { Modal, Field, inputClass, btnPrimary, btnGhost, btnDanger } from "@/components/Modal";
import { Plus, Trash2, FileSpreadsheet, ImagePlus } from "lucide-react";

const LEN = { register: 9, hs: 10, depositMmkDigits: 15, qtyDigitsMax: 16 } as const;

const UNIT_OPTIONS: ImportIndicatorUnitCode[] = ["KG", "U", "M²", "M³", "PR"];

const CURRENCY_OPTIONS: { code: ImportIndicatorCurrencyCode; label: string }[] = [
  { code: "MMK", label: "缅币 MMK" },
  { code: "USD", label: "美金 USD" },
  { code: "CNY", label: "人民币 CNY" },
  { code: "THB", label: "泰铢 THB" },
  { code: "EUR", label: "欧元 EUR" },
  { code: "SGD", label: "新加坡元 SGD" },
  { code: "JPY", label: "日元 JPY" },
];

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

function parseDeposit(raw: string): number {
  return parseMmkIntString(raw, LEN.depositMmkDigits);
}

/** 订金输入框视为「已填写」：用于决定是否展开经手人栏（仅大于 0 时展开）。 */
function depositAmountEntered(raw: string): boolean {
  return parseDeposit(raw) > 0;
}

function formatTotal(amount: number, code: ImportIndicatorCurrencyCode): string {
  if (!Number.isFinite(amount)) return "—";
  try {
    switch (code) {
      case "USD":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(amount);
      case "CNY":
        return new Intl.NumberFormat("zh-CN", {
          style: "currency",
          currency: "CNY",
          maximumFractionDigits: 2,
        }).format(amount);
      case "THB":
        return new Intl.NumberFormat("th-TH", {
          style: "currency",
          currency: "THB",
          maximumFractionDigits: 2,
        }).format(amount);
      case "EUR":
        return new Intl.NumberFormat("de-DE", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 2,
        }).format(amount);
      case "SGD":
        return new Intl.NumberFormat("en-SG", {
          style: "currency",
          currency: "SGD",
          maximumFractionDigits: 2,
        }).format(amount);
      case "JPY":
        return new Intl.NumberFormat("ja-JP", {
          style: "currency",
          currency: "JPY",
          maximumFractionDigits: 0,
        }).format(amount);
      case "MMK":
        return `${new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount)} MMK`;
      default:
        return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
    }
  } catch {
    return amount.toFixed(2);
  }
}

const numInputClass = `${inputClass} font-mono text-[15px] tracking-wide placeholder:text-shell-muted/35`;

type MmkQuotaFocusField =
  | "depositFirst"
  | "depositSecond"
  | "depositBalance"
  | "totalChargesLicense";

function MmkQuotaAmountInput({
  digitValue,
  onDigitsChange,
  focusField,
  onFocusField,
  field,
  className,
  placeholder,
  "aria-label": ariaLabel,
}: {
  digitValue: string;
  onDigitsChange: (digits: string) => void;
  focusField: MmkQuotaFocusField | null;
  onFocusField: (field: MmkQuotaFocusField | null) => void;
  field: MmkQuotaFocusField;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const focused = focusField === field;
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={formatMmkDigitStringForInput(digitValue, focused, LEN.depositMmkDigits)}
        onFocus={() => onFocusField(field)}
        onBlur={() => onFocusField(null)}
        onChange={(e) =>
          onDigitsChange(stripMmkDigitString(e.target.value, LEN.depositMmkDigits))
        }
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-shell-muted">
        MMK
      </span>
    </div>
  );
}

function SectionCard({
  step,
  title,
  hint,
  headerExtra,
  children,
}: {
  step?: string;
  title: string;
  hint?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-[#101a30]/95 to-[#0c1426]/95 p-5 shadow-lg shadow-black/25 ring-1 ring-blue-500/[0.06]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-3">
        <div className="flex min-w-[min(100%,280px)] flex-1 items-start gap-3">
          {step ? (
            <span className="flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg bg-blue-500/20 px-2 text-xs font-bold tabular-nums text-blue-200 ring-1 ring-blue-400/30">
              {step}
            </span>
          ) : (
            <span className="mt-1 h-8 w-1 shrink-0 rounded-full bg-blue-500/75" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold tracking-wide text-white">{title}</h3>
            {hint ? (
              <p className="mt-1.5 text-xs leading-relaxed text-shell-muted">{hint}</p>
            ) : null}
          </div>
        </div>
        {headerExtra ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{headerExtra}</div>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function emptyGoodsLine(): ImportGoodsLine {
  return {
    id: uid(),
    hsCode: "",
    cargoDescription: "",
    myanmarDescription: "",
    unitCode: "KG",
    setPrice: 0,
    setPriceCurrency: "USD",
    quantity: 0,
    lineTotal: 0,
  };
}

type FormSnapshot = Omit<ImportQuotaIndicator, "id" | "createdAt" | "updatedAt">;

function emptyBusinessForm(): FormSnapshot {
  return {
    registerNumber: "",
    portOfDischarge: "",
    customerName: "",
    startDate: "",
    goodsLines: [emptyGoodsLine()],
    edDate: "",
    firstDeposited: 0,
    secondDeposited: 0,
    remainingBalance: 0,
    totalChargesForLicense: 0,
    firstDepositedHandler: "",
    secondDepositedHandler: "",
    remainingBalanceHandler: "",
  };
}

/** 缅币整数展示（表单只读余额框） */
function formatMmkIntegerDisplay(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const v = Math.trunc(n);
  const abs = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.abs(v));
  return `${v < 0 ? "−" : ""}${abs} MMK`;
}

function normalizeGoodsQty(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), Number.MAX_SAFE_INTEGER);
}

function lineTotalLive(line: ImportGoodsLine): number {
  const q = normalizeGoodsQty(line.quantity);
  const p = Number(line.setPrice);
  const safeP = Number.isFinite(p) ? p : 0;
  return q * safeP;
}

/** 已保存单价的展示字符串（不用 type=number，避免出现 ".6"） */
function formatSetPriceForDisplay(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  const s = n.toString();
  if (/e/i.test(s)) return n.toFixed(16).replace(/\.?0+$/, "").replace(/\.$/, "") || "";
  return s;
}

function sanitizeSetPriceInputRaw(raw: string): string {
  let s = raw.replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  }
  return s;
}

function parseSetPriceDraft(draft: string): number {
  const t = draft.trim();
  if (t === "" || t === ".") return 0;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const LIST_MYANMAR_FONT =
  'font-[system-ui,"Myanmar Text","Padauk",sans-serif]' as const;

function listMyanmarDescriptionPreview(r: ImportQuotaIndicator): string {
  const lines = r.goodsLines;
  if (!lines.length) return "—";
  const first = lines[0]?.myanmarDescription?.trim() || "—";
  return lines.length > 1 ? `${first}（共 ${lines.length} 项）` : first;
}

function listQtySum(r: ImportQuotaIndicator): number {
  return r.goodsLines.reduce((a, l) => a + normalizeGoodsQty(l.quantity), 0);
}

function listAmountPreview(r: ImportQuotaIndicator): string {
  const lines = r.goodsLines;
  if (!lines.length) return "—";
  const cur = lines[0]?.setPriceCurrency;
  if (cur && lines.every((l) => l.setPriceCurrency === cur)) {
    const sum = lines.reduce((a, l) => a + (Number.isFinite(l.lineTotal) ? l.lineTotal : 0), 0);
    return formatTotal(sum, cur);
  }
  const byCur = new Map<ImportIndicatorCurrencyCode, number>();
  for (const l of lines) {
    const t = Number.isFinite(l.lineTotal) ? l.lineTotal : 0;
    const c = l.setPriceCurrency;
    byCur.set(c, (byCur.get(c) ?? 0) + t);
  }
  return [...byCur.entries()]
    .map(([code, amt]) => formatTotal(amt, code))
    .join(" · ");
}

function goodsLinesAmountAgg(lines: ImportGoodsLine[]) {
  if (!lines.length) return null;
  const cur = lines[0]?.setPriceCurrency;
  if (cur && lines.every((l) => l.setPriceCurrency === cur)) {
    const sum = lines.reduce((a, l) => a + lineTotalLive(l), 0);
    return { mode: "single" as const, currency: cur, total: sum };
  }
  const byCur = new Map<ImportIndicatorCurrencyCode, number>();
  for (const l of lines) {
    const t = lineTotalLive(l);
    const c = l.setPriceCurrency;
    byCur.set(c, (byCur.get(c) ?? 0) + t);
  }
  return { mode: "mixed" as const, parts: [...byCur.entries()] };
}

/** 按 Unit Code 汇总本单数量；仅列出本单实际出现的单位，顺序与表单下拉一致。 */
function goodsLinesQtyTotalsByUnit(lines: ImportGoodsLine[]) {
  const map = new Map<ImportIndicatorUnitCode, number>();
  for (const line of lines) {
    const u = line.unitCode;
    const q = normalizeGoodsQty(line.quantity);
    map.set(u, (map.get(u) ?? 0) + q);
  }
  return UNIT_OPTIONS.filter((u) => map.has(u)).map((u) => ({
    unit: u,
    totalQty: map.get(u)!,
  }));
}

type GoodsLinesAmountAgg = ReturnType<typeof goodsLinesAmountAgg>;

/** 表单 / Cargo 弹窗共用的紧凑合计区：金额与「按单位数量」横向编排，避免纵向过长。 */
function TotalAmountSummaryBox({
  amountAgg,
  qtyTotalsByUnit,
}: {
  amountAgg: GoodsLinesAmountAgg;
  qtyTotalsByUnit: { unit: ImportIndicatorUnitCode; totalQty: number }[];
}) {
  const amountText =
    amountAgg === null
      ? "—"
      : amountAgg.mode === "single"
        ? formatTotal(amountAgg.total, amountAgg.currency)
        : amountAgg.parts.map(([code, amt]) => formatTotal(amt, code)).join(" · ");

  return (
    <div className="rounded-lg border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-teal-900/12 to-[#0a1222]/90 px-3 py-2 ring-1 ring-emerald-500/10">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-1.5">
        <div className="min-w-0 sm:max-w-[min(100%,28rem)]">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-200/85">
              Total Amount
            </span>
            <span className="text-[9px] text-shell-muted/95">· 商品金额合计</span>
          </div>
          <p className="mt-0.5 break-words font-mono text-sm font-semibold tabular-nums leading-snug text-emerald-50">
            {amountText}
          </p>
          {amountAgg?.mode === "mixed" ? (
            <p className="mt-1 text-[9px] leading-snug text-shell-muted">
              币种不一致，分项汇总，不做折算。
            </p>
          ) : null}
        </div>
        {qtyTotalsByUnit.length > 0 ? (
          <div
            className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end"
            aria-label="按单位汇总数量"
          >
            {qtyTotalsByUnit.map(({ unit, totalQty }) => (
              <span
                key={unit}
                title={`Total Quantity Of ${unit}`}
                className="inline-flex items-center gap-1 rounded-md bg-black/28 px-2 py-0.5 font-mono text-[11px] tabular-nums ring-1 ring-emerald-500/28"
              >
                <span className="text-emerald-300/88">{unit}</span>
                <span className="font-semibold text-emerald-50">{totalQty}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ListMyanmarDescriptionCell({
  r,
  clickable,
  onOpenCargoSummary,
}: {
  r: ImportQuotaIndicator;
  clickable: boolean;
  onOpenCargoSummary: () => void;
}) {
  const lines = r.goodsLines;
  if (!lines.length) return <span className="text-shell-muted">—</span>;
  const firstDisplay = lines[0]?.myanmarDescription?.trim() || "—";
  const n = lines.length;
  const previewTitle = listMyanmarDescriptionPreview(r);

  if (!clickable) {
    return (
      <span className="block max-w-full text-xs leading-snug" title={previewTitle}>
        <span className={`line-clamp-2 break-words ${LIST_MYANMAR_FONT}`}>{firstDisplay}</span>
        {n > 1 ? (
          <span className="mt-1 block text-[11px] text-shell-muted">（共 {n} 项）</span>
        ) : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`group max-w-full rounded-lg border border-transparent px-1.5 py-1.5 text-left transition-colors hover:border-sky-500/40 hover:bg-sky-500/[0.12] focus:outline-none focus-visible:border-sky-400/55 focus-visible:ring-2 focus-visible:ring-sky-400/45 ${LIST_MYANMAR_FONT}`}
      title="查看本条批文全部商品的 Cargo Description · 单价 · 数量 · 小计"
      aria-label={`查看 Cargo 明细：${previewTitle}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenCargoSummary();
      }}
    >
      <span className="block line-clamp-2 break-words text-xs leading-snug text-shell-muted group-hover:text-white">
        {firstDisplay}
      </span>
      {n > 1 ? (
        <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-sky-500/20 px-2 py-1 text-[11px] font-semibold tabular-nums text-sky-100 ring-1 ring-sky-400/35 transition group-hover:bg-sky-500/30 group-hover:ring-sky-300/45">
          （共 {n} 项）
          <span className="font-normal text-[10px] text-sky-200/85">明细</span>
        </span>
      ) : null}
    </button>
  );
}

export interface QuotaIndicatorsPageProps {
  pageTitle: string;
  pageSubtitle: string;
  modalTitleNew: string;
  modalTitleEdit: string;
  excelBranding: QuotaExcelBranding;
  list: ImportQuotaIndicator[];
  addRec: (r: Omit<ImportQuotaIndicator, "id" | "createdAt" | "updatedAt">) => void;
  updateRec: (id: string, patch: Partial<ImportQuotaIndicator>) => void;
  removeRec: (id: string) => void;
  /** 为 true 时，列表 Myanmar Description 列可点击打开 Cargo 明细弹窗（进口页使用） */
  listCargoSummaryEnabled?: boolean;
  /** 列表右上角主按钮文案（如进口草稿页可用「新建草稿」） */
  primaryButtonLabel?: string;
}

export function QuotaIndicatorsPage({
  pageTitle,
  pageSubtitle,
  modalTitleNew,
  modalTitleEdit,
  excelBranding,
  list,
  addRec,
  updateRec,
  removeRec,
  listCargoSummaryEnabled = false,
  primaryButtonLabel = "新建指标",
}: QuotaIndicatorsPageProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormSnapshot>(emptyBusinessForm());
  const [depositFirstStr, setDepositFirstStr] = useState("");
  const [depositSecondStr, setDepositSecondStr] = useState("");
  const [depositBalanceStr, setDepositBalanceStr] = useState("");
  const [totalChargesLicenseStr, setTotalChargesLicenseStr] = useState("");
  const [mmkQuotaFocusField, setMmkQuotaFocusField] = useState<MmkQuotaFocusField | null>(null);
  const [cargoSummaryRecord, setCargoSummaryRecord] = useState<ImportQuotaIndicator | null>(null);
  /** 单价输入过程中的草稿（保留 "0."、"0.6" 等）；blur / 保存 / 换单时收敛 */
  const [setPriceDraftByLineId, setSetPriceDraftByLineId] = useState<Record<string, string>>({});
  const cargoImageInputRef = useRef<HTMLInputElement>(null);
  const cargoImageLineIdRef = useRef<string | null>(null);
  const [cargoImageBusy, setCargoImageBusy] = useState(false);

  const sorted = useMemo(
    () => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [list]
  );

  const goodsAmountAgg = useMemo(() => goodsLinesAmountAgg(form.goodsLines), [form.goodsLines]);

  const goodsQtyTotalsByUnit = useMemo(
    () => goodsLinesQtyTotalsByUnit(form.goodsLines),
    [form.goodsLines]
  );

  const cargoSummaryAmountAgg = useMemo(
    () =>
      cargoSummaryRecord
        ? goodsLinesAmountAgg(cargoSummaryRecord.goodsLines)
        : null,
    [cargoSummaryRecord]
  );

  const cargoSummaryQtyTotalsByUnit = useMemo(
    () =>
      cargoSummaryRecord
        ? goodsLinesQtyTotalsByUnit(cargoSummaryRecord.goodsLines)
        : [],
    [cargoSummaryRecord]
  );

  function updateGoodsLine(id: string, patch: Partial<ImportGoodsLine>) {
    setForm((f) => ({
      ...f,
      goodsLines: f.goodsLines.map((line) =>
        line.id === id ? { ...line, ...patch } : line
      ),
    }));
  }

  function triggerCargoImagePick(lineId: string) {
    cargoImageLineIdRef.current = lineId;
    cargoImageInputRef.current?.click();
  }

  async function onCargoImageFileChange(ev: ChangeEvent<HTMLInputElement>) {
    const lineId = cargoImageLineIdRef.current;
    cargoImageLineIdRef.current = null;
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !lineId) return;
    try {
      setCargoImageBusy(true);
      const url = await compressImageFileToJpegDataUrl(file);
      if (url.length > MAX_CARGO_IMAGE_DATA_URL_CHARS) {
        alert("图片仍过大，请换一张较小的图片");
        return;
      }
      updateGoodsLine(lineId, { cargoImageDataUrl: url });
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setCargoImageBusy(false);
    }
  }

  function addGoodsLine() {
    setForm((f) => ({
      ...f,
      goodsLines: [...f.goodsLines, emptyGoodsLine()],
    }));
  }

  function removeGoodsLine(id: string) {
    setSetPriceDraftByLineId((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
    setForm((f) => {
      if (f.goodsLines.length <= 1) return f;
      return { ...f, goodsLines: f.goodsLines.filter((l) => l.id !== id) };
    });
  }

  function loadRecordIntoForm(r: ImportQuotaIndicator) {
    setForm({
      registerNumber: r.registerNumber,
      portOfDischarge: r.portOfDischarge,
      customerName: r.customerName,
      startDate: r.startDate ? r.startDate.slice(0, 10) : "",
      goodsLines:
        r.goodsLines.length > 0 ? r.goodsLines.map((l) => ({ ...l })) : [emptyGoodsLine()],
      edDate: r.edDate ? r.edDate.slice(0, 10) : "",
      firstDeposited: r.firstDeposited,
      secondDeposited: r.secondDeposited,
      remainingBalance: r.remainingBalance,
      totalChargesForLicense: r.totalChargesForLicense ?? 0,
      firstDepositedHandler: r.firstDepositedHandler ?? "",
      secondDepositedHandler: r.secondDepositedHandler ?? "",
      remainingBalanceHandler: r.remainingBalanceHandler ?? "",
    });
    setDepositFirstStr(mmkIntToDigitInput(r.firstDeposited));
    setDepositSecondStr(mmkIntToDigitInput(r.secondDeposited));
    setDepositBalanceStr(mmkIntToDigitInput(r.remainingBalance));
    setTotalChargesLicenseStr(mmkIntToDigitInput(r.totalChargesForLicense ?? 0));
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyBusinessForm());
    setSetPriceDraftByLineId({});
    setDepositFirstStr("");
    setDepositSecondStr("");
    setDepositBalanceStr("");
    setTotalChargesLicenseStr("");
    setOpen(true);
  }

  function openEdit(r: ImportQuotaIndicator) {
    setEditingId(r.id);
    setSetPriceDraftByLineId({});
    loadRecordIntoForm(r);
    setOpen(true);
  }

  function save() {
    const reg = digitsOnly(form.registerNumber, LEN.register);

    const drafts = setPriceDraftByLineId;
    const normalizedLines: ImportGoodsLine[] = [];
    for (let i = 0; i < form.goodsLines.length; i++) {
      const line = form.goodsLines[i];
      const hs = digitsOnly(line.hsCode, LEN.hs);
      const qty = normalizeGoodsQty(line.quantity);
      const draft = drafts[line.id];
      const rawPrice =
        draft !== undefined ? parseSetPriceDraft(draft) : Number(line.setPrice);
      const safePrice = Number.isFinite(rawPrice) ? rawPrice : 0;

      let cargoImageDataUrl: string | undefined;
      if (typeof line.cargoImageDataUrl === "string") {
        const u = line.cargoImageDataUrl.trim();
        if (
          (u.startsWith("data:image/jpeg") ||
            u.startsWith("data:image/jpg") ||
            u.startsWith("data:image/png") ||
            u.startsWith("data:image/gif")) &&
          u.length <= MAX_CARGO_IMAGE_DATA_URL_CHARS
        ) {
          cargoImageDataUrl = u;
        }
      }

      normalizedLines.push({
        ...line,
        hsCode: hs,
        quantity: qty,
        setPrice: safePrice,
        lineTotal: qty * safePrice,
        cargoImageDataUrl,
      });
    }

    const d1 = parseDeposit(depositFirstStr);
    const d2 = parseDeposit(depositSecondStr);
    const bal = parseDeposit(depositBalanceStr);
    const totalChargesLicense = parseDeposit(totalChargesLicenseStr);

    const payload: Omit<ImportQuotaIndicator, "id" | "createdAt" | "updatedAt"> = {
      ...form,
      registerNumber: reg,
      goodsLines: normalizedLines,
      firstDeposited: d1,
      secondDeposited: d2,
      remainingBalance: bal,
      totalChargesForLicense: totalChargesLicense,
      startDate: form.startDate ? `${form.startDate}T00:00:00.000Z` : "",
      edDate: form.edDate ? `${form.edDate}T00:00:00.000Z` : "",
    };

    if (editingId) updateRec(editingId, payload);
    else addRec(payload);
    setSetPriceDraftByLineId({});
    setOpen(false);
  }

  const modalSubtitle =
    "同一批文内可添加多「条」商品。Register No.、H.S Code 等均可选填，保存时不强制校验位数；建议后续补全便于报关与价格表汇总。";

  const addGoodsButton = (
    <button
      type="button"
      className={`${btnGhost} inline-flex items-center gap-1.5 border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/15`}
      onClick={addGoodsLine}
    >
      <Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} />
      添加商品
    </button>
  );

  const modalFooter = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-shell-muted">
        {editingId ? "正在编辑已有记录" : "填写完成后点击保存入库"}
        <span className="mx-1.5 text-shell-muted/40">·</span>
        当前 {form.goodsLines.length} 行商品
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={btnGhost} onClick={() => setOpen(false)}>
          取消
        </button>
        {editingId ? (
          <button
            type="button"
            className={btnDanger}
            onClick={() => {
              if (confirm("确定删除该记录？删除后无法恢复。")) {
                removeRec(editingId);
                setOpen(false);
              }
            }}
          >
            删除
          </button>
        ) : null}
        <button type="button" className={`${btnPrimary} min-w-[96px]`} onClick={save}>
          保存
        </button>
      </div>
    </div>
  );

  const totalChargesLicenseLive = parseDeposit(totalChargesLicenseStr);
  const depositsThreeSumLive =
    parseDeposit(depositFirstStr) +
    parseDeposit(depositSecondStr) +
    parseDeposit(depositBalanceStr);
  const licenseChargesRemainderLive = totalChargesLicenseLive - depositsThreeSumLive;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{pageTitle}</h1>
          <p className="mt-1 text-sm text-shell-muted">{pageSubtitle}</p>
        </div>
        <button type="button" className={btnPrimary} onClick={openNew}>
          {primaryButtonLabel}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="text-xs uppercase text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/50">
                <th className="px-4 py-3 font-medium">Register No.</th>
                <th className="px-4 py-3 font-medium">Start Date</th>
                <th className="px-4 py-3 font-medium">客户名称</th>
                <th className="px-4 py-3 font-medium">卸货港</th>
                <th className="px-4 py-3 font-medium normal-case">Myanmar Description</th>
                <th className="px-4 py-3 font-medium">数量合计</th>
                <th className="px-4 py-3 font-medium">金额汇总</th>
                <th className="px-4 py-3 font-medium">ED Date</th>
                <th className="px-3 py-3 text-center font-medium normal-case">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-shell-muted">
                    暂无记录，请点击「{primaryButtonLabel}」。
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.id} className="border-b border-shell-border/80 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono tracking-wide">{r.registerNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                      {r.startDate ? r.startDate.slice(0, 10) : "—"}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3" title={r.customerName}>
                      {r.customerName.trim() ? r.customerName : "—"}
                    </td>
                    <td className="px-4 py-3">{r.portOfDischarge}</td>
                    <td className="max-w-[260px] px-4 py-3 align-top text-xs">
                      <ListMyanmarDescriptionCell
                        r={r}
                        clickable={listCargoSummaryEnabled}
                        onOpenCargoSummary={() => setCargoSummaryRecord(r)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono">{listQtySum(r)}</td>
                    <td className="px-4 py-3 font-mono text-emerald-200">{listAmountPreview(r)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.edDate ? r.edDate.slice(0, 10) : "—"}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div
                        className="mx-auto grid w-max grid-cols-2 gap-x-2 gap-y-1 text-[11px] leading-tight"
                        role="group"
                        aria-label="本行操作"
                      >
                        <button
                          type="button"
                          className="inline-flex w-[8.75rem] items-center justify-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/12 px-2 py-1 font-medium text-emerald-100 transition hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45"
                          title="导出批文概要（Excel）"
                          onClick={() => {
                            if (
                              !confirm(
                                "确认导出「批文概要」Excel 吗？\n\n将下载仅含批文基本信息的工作簿（单表「批文概要」）。文件将保存到浏览器默认下载位置。"
                              )
                            )
                              return;
                            void downloadQuotaIndicatorSummaryExcel(r, excelBranding).catch(
                              (err) =>
                                alert(
                                  `导出失败：${err instanceof Error ? err.message : String(err)}`
                                )
                            );
                          }}
                        >
                          <FileSpreadsheet className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                          导出批文概要
                        </button>
                        <button
                          type="button"
                          className="inline-flex w-[8.75rem] items-center justify-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-medium text-sky-100 transition hover:bg-sky-500/18 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
                          onClick={() => openEdit(r)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="inline-flex w-[8.75rem] items-center justify-center gap-1 rounded-md border border-teal-500/35 bg-teal-600/12 px-2 py-1 font-medium text-teal-50 transition hover:bg-teal-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/45"
                          title="导出商品明细（Excel）"
                          onClick={() => {
                            if (
                              !confirm(
                                "确认导出「商品明细」Excel 吗？\n\n将下载全部货物行；若含货物图片，文件体积可能较大。文件将保存到浏览器默认下载位置。"
                              )
                            )
                              return;
                            void downloadQuotaIndicatorGoodsExcel(r, excelBranding).catch((err) =>
                              alert(
                                `导出失败：${err instanceof Error ? err.message : String(err)}`
                              )
                            );
                          }}
                        >
                          <FileSpreadsheet className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                          导出商品明细
                        </button>
                        <button
                          type="button"
                          className="inline-flex w-[8.75rem] items-center justify-center rounded-md border border-red-500/35 bg-red-500/10 px-2 py-1 font-medium text-red-200/95 transition hover:bg-red-500/16 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/35"
                          onClick={() =>
                            confirm("确定删除该记录？删除后无法恢复。") && removeRec(r.id)
                          }
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        title="Cargo Description · 商品明细"
        subtitle={
          cargoSummaryRecord ? (
            <span>
              Register{" "}
              <span className="font-mono text-sky-200/90">
                {cargoSummaryRecord.registerNumber?.trim() || "—"}
              </span>
              <span className="text-shell-muted"> · </span>
              {cargoSummaryRecord.customerName?.trim() || "—"}
              <span className="text-shell-muted"> · 共 </span>
              <span className="tabular-nums text-emerald-200/90">
                {cargoSummaryRecord.goodsLines.length}
              </span>
              <span className="text-shell-muted"> 条商品</span>
            </span>
          ) : undefined
        }
        open={cargoSummaryRecord !== null}
        wide
        onClose={() => setCargoSummaryRecord(null)}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setCargoSummaryRecord(null)}
            >
              关闭
            </button>
          </div>
        }
      >
        {cargoSummaryRecord ? (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-shell-border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-shell-border bg-[#0f172a]/70 text-xs uppercase text-shell-muted">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">#</th>
                    <th className="min-w-[200px] px-3 py-2.5 font-medium">
                      1 · 名称 · Cargo Description
                    </th>
                    <th className="px-3 py-2.5 font-medium">2 · Unit Code</th>
                    <th className="px-3 py-2.5 font-medium">3 · Set Price</th>
                    <th className="px-3 py-2.5 font-medium">4 · 币种</th>
                    <th className="px-3 py-2.5 font-medium">5 · Quantity</th>
                    <th className="px-3 py-2.5 font-medium">6 · Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cargoSummaryRecord.goodsLines.map((line, i) => (
                    <tr
                      key={line.id}
                      className="border-b border-shell-border/70 hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-2.5 font-mono tabular-nums text-shell-muted">
                        {i + 1}
                      </td>
                      <td className="max-w-[320px] whitespace-pre-wrap px-3 py-2.5 text-shell-muted">
                        {line.cargoDescription?.trim() ? line.cargoDescription : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono">{line.unitCode}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        {Number.isFinite(line.setPrice) ? line.setPrice : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{line.setPriceCurrency}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        {normalizeGoodsQty(line.quantity)}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums text-emerald-200">
                        {formatTotal(lineTotalLive(line), line.setPriceCurrency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TotalAmountSummaryBox
              amountAgg={cargoSummaryAmountAgg}
              qtyTotalsByUnit={cargoSummaryQtyTotalsByUnit}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        title={editingId ? modalTitleEdit : modalTitleNew}
        subtitle={modalSubtitle}
        open={open}
        extraWide
        footer={modalFooter}
        onClose={() => setOpen(false)}
      >
        <div className="space-y-5">
          <input
            ref={cargoImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onCargoImageFileChange}
          />
          <SectionCard
            title="生效起始 · Start Date"
            hint="批文或指标开始生效的日期与客户名称；填写后再填写下方注册号与商品明细。"
          >
            <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
              <Field label="Start Date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.startDate.slice(0, 10)}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </Field>
              <Field label="客户名称">
                <input
                  type="text"
                  className={inputClass}
                  autoComplete="organization"
                  value={form.customerName}
                  onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  placeholder="客户或公司名称"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            step="1"
            title="注册号与口岸 · Register & Port"
            hint="Register 固定 9 位数字；可从别处复制整串粘贴。卸货港填写城市或港口英文/当地惯用写法。"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Register Number">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={LEN.register}
                  placeholder="000000000（9 位）"
                  className={numInputClass}
                  value={form.registerNumber}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      registerNumber: digitsOnly(e.target.value, LEN.register),
                    }))
                  }
                />
              </Field>
              <Field label="Port Of Discharge（卸货港 / 城市）">
                <input
                  className={inputClass}
                  value={form.portOfDischarge}
                  onChange={(e) => setForm((f) => ({ ...f, portOfDischarge: e.target.value }))}
                  placeholder="例如：Yangon、Muse…"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            step="2"
            title="商品明细 · HS / Cargo / 计价（合一）"
            hint={`每笔批文可有多个商品：每张卡片独立填写编码、描述与金额。当前 ${form.goodsLines.length} 条，可自行增减。`}
            headerExtra={addGoodsButton}
          >
            <div className="flex flex-col gap-5">
              {form.goodsLines.map((line, i) => (
                <article
                  key={line.id}
                  className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0d1629]/98 via-[#0a1222]/95 to-[#080f18]/98 shadow-xl shadow-black/30 ring-1 ring-white/[0.04]"
                >
                  <div
                    className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-600 opacity-90"
                    aria-hidden
                  />
                  <div className="relative pl-4 sm:pl-5">
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-black/25 px-4 py-3 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-semibold tabular-nums text-sky-100 ring-1 ring-sky-400/35">
                          商品 {i + 1}
                        </span>
                        <span className="text-[11px] text-shell-muted">
                          / 共 {form.goodsLines.length} 条
                        </span>
                        {line.hsCode.length >= LEN.hs ? (
                          <span className="hidden font-mono text-[11px] text-emerald-200/90 sm:inline">
                            ✓ HS 已填齐
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {form.goodsLines.length > 1 ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 px-2.5 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/10"
                            title="删除本条商品（需确认）"
                            onClick={() => {
                              if (
                                confirm(
                                  "确定删除本条商品明细？（若尚未保存，仍可关闭窗口放弃整单更改）"
                                )
                              )
                                removeGoodsLine(line.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除本条
                          </button>
                        ) : (
                          <span className="text-[11px] text-shell-muted/70">至少保留 1 条</span>
                        )}
                      </div>
                    </header>

                    <div className="space-y-5 px-4 py-4 sm:px-5">
                      <div className="rounded-xl bg-black/20 px-3 py-3 ring-1 ring-inset ring-white/[0.05]">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-200/80">
                          A · H.S Code（10 位）
                        </p>
                        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                          <div className="min-w-0 flex-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              spellCheck={false}
                              maxLength={LEN.hs}
                              placeholder="粘贴或输入 10 位关税编码"
                              className={numInputClass}
                              value={line.hsCode}
                              onChange={(e) =>
                                updateGoodsLine(line.id, {
                                  hsCode: digitsOnly(e.target.value, LEN.hs),
                                })
                              }
                              aria-label={`商品 ${i + 1} H.S Code`}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={cargoImageBusy}
                              className={`${btnGhost} inline-flex items-center gap-1.5 border-sky-500/35 bg-sky-500/10 px-2.5 py-2 text-xs text-sky-100`}
                              onClick={() => triggerCargoImagePick(line.id)}
                            >
                              <ImagePlus className="h-3.5 w-3.5" />
                              上传图片
                            </button>
                            {line.cargoImageDataUrl ? (
                              <>
                                <img
                                  src={line.cargoImageDataUrl}
                                  alt=""
                                  className="h-14 w-14 rounded-md border border-white/15 object-cover"
                                />
                                <button
                                  type="button"
                                  className="text-[11px] text-shell-muted underline hover:text-red-300"
                                  onClick={() =>
                                    updateGoodsLine(line.id, { cargoImageDataUrl: undefined })
                                  }
                                >
                                  移除图片
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200/85">
                          B · 货物描述
                        </p>
                        <div className="grid gap-4 xl:grid-cols-2">
                          <Field label="Cargo Description">
                            <textarea
                              rows={3}
                              className={`${inputClass} min-h-[88px] resize-y leading-relaxed`}
                              value={line.cargoDescription}
                              onChange={(e) =>
                                updateGoodsLine(line.id, { cargoDescription: e.target.value })
                              }
                              placeholder={"Cargo Name & Brand\nPower · Weight · Size"}
                            />
                          </Field>
                          <Field label="Myanmar Description">
                            <textarea
                              rows={3}
                              className={`${inputClass} min-h-[88px] resize-y font-[system-ui,"Myanmar Text","Padauk",sans-serif] leading-relaxed`}
                              dir="ltr"
                              value={line.myanmarDescription}
                              onChange={(e) =>
                                updateGoodsLine(line.id, {
                                  myanmarDescription: e.target.value,
                                })
                              }
                              placeholder="မြန်မာဘာသာဖြင့် ဖော်ပြပါ"
                            />
                          </Field>
                        </div>
                      </div>

                      <div>
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200/85">
                          C · 单价 / 数量 / 小计
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(5.5rem,7rem)_minmax(14rem,1fr)_minmax(8.5rem,10rem)_minmax(9rem,11rem)] xl:items-end">
                          <Field label="Unit Code">
                            <select
                              className={`${inputClass} min-h-[42px]`}
                              value={line.unitCode}
                              onChange={(e) =>
                                updateGoodsLine(line.id, {
                                  unitCode: e.target.value as ImportIndicatorUnitCode,
                                })
                              }
                            >
                              {UNIT_OPTIONS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Set Price（单价）">
                            <div className="flex min-h-[42px] flex-col gap-2 sm:flex-row sm:items-stretch">
                              <input
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                spellCheck={false}
                                className={`${numInputClass} min-h-[42px] w-full min-w-[11rem] flex-1 sm:min-w-[13rem]`}
                                placeholder="例如 0.6"
                                value={
                                  setPriceDraftByLineId[line.id] !== undefined
                                    ? setPriceDraftByLineId[line.id]
                                    : formatSetPriceForDisplay(line.setPrice)
                                }
                                onFocus={() =>
                                  setSetPriceDraftByLineId((m) =>
                                    m[line.id] !== undefined
                                      ? m
                                      : {
                                          ...m,
                                          [line.id]:
                                            line.setPrice === 0
                                              ? ""
                                              : formatSetPriceForDisplay(line.setPrice),
                                        }
                                  )
                                }
                                onChange={(e) => {
                                  const cleaned = sanitizeSetPriceInputRaw(e.target.value);
                                  setSetPriceDraftByLineId((m) => ({
                                    ...m,
                                    [line.id]: cleaned,
                                  }));
                                  updateGoodsLine(line.id, {
                                    setPrice: parseSetPriceDraft(cleaned),
                                  });
                                }}
                                onBlur={() => {
                                  const draft = setPriceDraftByLineId[line.id];
                                  if (draft !== undefined) {
                                    updateGoodsLine(line.id, {
                                      setPrice: parseSetPriceDraft(draft),
                                    });
                                  }
                                  setSetPriceDraftByLineId((m) => {
                                    const next = { ...m };
                                    delete next[line.id];
                                    return next;
                                  });
                                }}
                              />
                              <select
                                className={`${inputClass} min-h-[42px] w-full shrink-0 sm:w-[9.25rem] sm:max-w-[10rem] text-[13px]`}
                                value={line.setPriceCurrency}
                                onChange={(e) =>
                                  updateGoodsLine(line.id, {
                                    setPriceCurrency:
                                      e.target.value as ImportIndicatorCurrencyCode,
                                  })
                                }
                              >
                                {CURRENCY_OPTIONS.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </Field>
                          <Field label="Quantity">
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              spellCheck={false}
                              maxLength={LEN.qtyDigitsMax}
                              placeholder="整数（大额可用）"
                              className={`${numInputClass} min-h-[42px]`}
                              value={line.quantity === 0 ? "" : String(line.quantity)}
                              onChange={(e) => {
                                const d = digitsOnly(e.target.value, LEN.qtyDigitsMax);
                                let qty = 0;
                                if (d) {
                                  const n = parseInt(d, 10);
                                  if (Number.isFinite(n))
                                    qty = Math.min(n, Number.MAX_SAFE_INTEGER);
                                }
                                updateGoodsLine(line.id, { quantity: qty });
                              }}
                            />
                          </Field>
                          <Field label="Line Total">
                            <div className="flex min-h-[36px] items-center rounded-lg border border-emerald-400/35 bg-gradient-to-br from-emerald-500/14 via-teal-600/10 to-cyan-900/18 px-2.5 py-1.5 font-mono text-sm font-semibold tabular-nums text-emerald-50 shadow-inner shadow-black/20 ring-1 ring-emerald-500/12">
                              {formatTotal(lineTotalLive(line), line.setPriceCurrency)}
                            </div>
                          </Field>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <TotalAmountSummaryBox
              amountAgg={goodsAmountAgg}
              qtyTotalsByUnit={goodsQtyTotalsByUnit}
            />

            <p className="mt-1 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-shell-muted">
              <span className="font-medium text-shell-muted">操作提示：</span>
              新卡片会追加在下方；填写时请从上到下逐条完成。留空的 Register / HS 亦可保存。
            </p>
          </SectionCard>

          <SectionCard step="3" title="期限 · ED Date" hint="指标或许可证相关截止日期。">
            <div className="max-w-xs">
              <Field label="ED date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.edDate.slice(0, 10)}
                  onChange={(e) => setForm((f) => ({ ...f, edDate: e.target.value }))}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            step="4"
            title="三期款项 · Deposits（缅币 MMK）"
            hint="以下三项均为缅币金额；右侧填写 Total Charges For License（缅币）。底部余额 = Total Charges − 三期合计。某一期的金额填写大于 0 后，才会显示该期的「经手人 · 收款账号名」，便于对账。"
            headerExtra={
              <div className="flex w-full min-w-0 flex-col gap-1.5 sm:max-w-[min(100%,240px)] sm:items-end">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90 sm:text-right">
                  Total Charges For License
                </span>
                <MmkQuotaAmountInput
                  digitValue={totalChargesLicenseStr}
                  onDigitsChange={setTotalChargesLicenseStr}
                  focusField={mmkQuotaFocusField}
                  onFocusField={setMmkQuotaFocusField}
                  field="totalChargesLicense"
                  className={`${numInputClass} w-full pr-14`}
                  placeholder="例如 10,000,000"
                  aria-label="Total Charges For License MMK"
                />
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-3">
                <Field label="First Deposited · MMK">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-200/85">
                    申请批文订金
                  </p>
                  <MmkQuotaAmountInput
                    digitValue={depositFirstStr}
                    onDigitsChange={setDepositFirstStr}
                    focusField={mmkQuotaFocusField}
                    onFocusField={setMmkQuotaFocusField}
                    field="depositFirst"
                    className={`${numInputClass} w-full pr-14`}
                    placeholder="例如 10,000,000"
                  />
                </Field>
                {depositAmountEntered(depositFirstStr) ? (
                  <Field label="经手人 · 收款账号名">
                    <input
                      type="text"
                      className={inputClass}
                      autoComplete="off"
                      placeholder="客户汇款收款方账户名"
                      value={form.firstDepositedHandler}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, firstDepositedHandler: e.target.value }))
                      }
                    />
                  </Field>
                ) : null}
              </div>
              <div className="space-y-3">
                <Field label="Second Deposited · MMK">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-200/85">
                    ANNI Fees
                  </p>
                  <MmkQuotaAmountInput
                    digitValue={depositSecondStr}
                    onDigitsChange={setDepositSecondStr}
                    focusField={mmkQuotaFocusField}
                    onFocusField={setMmkQuotaFocusField}
                    field="depositSecond"
                    className={`${numInputClass} w-full pr-14`}
                    placeholder="例如 10,000,000"
                  />
                </Field>
                {depositAmountEntered(depositSecondStr) ? (
                  <Field label="经手人 · 收款账号名">
                    <input
                      type="text"
                      className={inputClass}
                      autoComplete="off"
                      placeholder="客户汇款收款方账户名"
                      value={form.secondDepositedHandler}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, secondDepositedHandler: e.target.value }))
                      }
                    />
                  </Field>
                ) : null}
              </div>
              <div className="space-y-3">
                <Field label="Remaining Balance · MMK">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-200/85">
                    License
                  </p>
                  <MmkQuotaAmountInput
                    digitValue={depositBalanceStr}
                    onDigitsChange={setDepositBalanceStr}
                    focusField={mmkQuotaFocusField}
                    onFocusField={setMmkQuotaFocusField}
                    field="depositBalance"
                    className={`${numInputClass} w-full pr-14`}
                    placeholder="例如 10,000,000"
                  />
                </Field>
                {depositAmountEntered(depositBalanceStr) ? (
                  <Field label="经手人 · 收款账号名">
                    <input
                      type="text"
                      className={inputClass}
                      autoComplete="off"
                      placeholder="客户汇款收款方账户名"
                      value={form.remainingBalanceHandler}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, remainingBalanceHandler: e.target.value }))
                      }
                    />
                  </Field>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-cyan-400/35 bg-gradient-to-br from-cyan-950/40 via-[#0a1222]/92 to-[#080f18]/96 px-4 py-3 ring-1 ring-cyan-500/15">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200/90">
                Balance · 余额（Total Charges − 三期款项合计）
              </p>
              <p className="mt-1 text-[11px] leading-snug text-shell-muted">
                Total Charges For License −（申请批文订金 + ANNI Fees + License）
              </p>
              <div
                className={`mt-2 flex min-h-[44px] items-center rounded-lg border px-3 py-2 font-mono text-base font-semibold tabular-nums shadow-inner shadow-black/25 ring-1 ${
                  licenseChargesRemainderLive < 0
                    ? "border-amber-400/45 bg-amber-950/30 text-amber-100 ring-amber-500/25"
                    : "border-cyan-400/35 bg-black/40 text-cyan-50 ring-cyan-500/15"
                }`}
              >
                {formatMmkIntegerDisplay(licenseChargesRemainderLive)}
              </div>
            </div>
          </SectionCard>
        </div>
      </Modal>
    </div>
  );
}
