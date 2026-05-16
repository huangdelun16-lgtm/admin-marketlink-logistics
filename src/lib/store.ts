import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Client,
  CustomsDeclaration,
  DocumentFile,
  FinanceRecord,
  PersonalFinanceRecord,
  ImportGoodsLine,
  ImportIndicatorCurrencyCode,
  ImportIndicatorUnitCode,
  ImportLicencePriceRow,
  ImportQuotaIndicator,
  LogisticsShipment,
  Supplier,
  TodoItem,
} from "@/types";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const nowIso = () => new Date().toISOString();

export function normalizePersonalFinanceRecord(x: unknown): PersonalFinanceRecord | null {
  if (typeof x !== "object" || x === null) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  const type = o.type === "expense" ? "expense" : "income";
  const mmk = Math.floor(Number(o.amountMmk) || 0);
  const usd = Number(o.amountUsd);
  const safeUsd = Number.isFinite(usd) && usd >= 0 ? usd : 0;
  const regRaw = o.quotaRegisterNumber;
  const quotaRegisterNumber = typeof regRaw === "string" ? regRaw.trim() || null : null;
  return {
    id: o.id,
    type,
    category: typeof o.category === "string" ? o.category : "其它",
    quotaRegisterNumber,
    amountMmk: Math.min(mmk, Number.MAX_SAFE_INTEGER),
    amountUsd: safeUsd,
    description: typeof o.description === "string" ? o.description : "",
    occurredAt: typeof o.occurredAt === "string" ? o.occurredAt : "",
    createdAt: typeof o.createdAt === "string" ? o.createdAt : nowIso(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : nowIso(),
  };
}

const IMPORT_UNIT_SET = new Set<string>(["KG", "U", "M²", "M³", "PR"]);
const IMPORT_CUR_SET = new Set<string>(["MMK", "USD", "CNY", "THB", "EUR", "SGD", "JPY"]);

function isoDateYmd(iso: string): string {
  const t = iso?.trim();
  if (!t) return new Date().toISOString().slice(0, 10);
  return t.slice(0, 10);
}

function resolveClientIdByCustomerName(clients: Client[], customerName: string): string | null {
  const t = customerName.trim().toLowerCase();
  if (!t) return null;
  for (const c of clients) {
    const company = (c.company ?? "").trim().toLowerCase();
    const name = (c.name ?? "").trim().toLowerCase();
    const label = ((c.company ?? "").trim() || (c.name ?? "").trim()).toLowerCase();
    if (company === t || name === t || label === t) return c.id;
  }
  return null;
}

function myanmarDescriptionSummaryFromIndicator(indicator: ImportQuotaIndicator): string {
  const lines = indicator.goodsLines ?? [];
  if (!lines.length) return "";
  const first = lines[0]?.myanmarDescription?.trim() || "";
  if (lines.length > 1) {
    return first ? `${first}（共 ${lines.length} 项）` : `（共 ${lines.length} 项）`;
  }
  return first;
}

/** 根据进/出口指标草稿生成一条公司流水（收入 · 代办批文） */
function buildFinancePayloadFromQuotaIndicator(
  indicator: ImportQuotaIndicator,
  clients: Client[],
  draftCategory: string
): Omit<FinanceRecord, "id" | "createdAt"> {
  const reg = indicator.registerNumber?.trim() || "";
  const cust = indicator.customerName?.trim() || "";
  const start = isoDateYmd(indicator.startDate || "");
  const tc = Math.floor(Number(indicator.totalChargesForLicense) || 0);
  const clientId = resolveClientIdByCustomerName(clients, cust);
  const mmSummary = myanmarDescriptionSummaryFromIndicator(indicator);

  return {
    type: "income",
    category: draftCategory,
    amountMmk: tc,
    amountUsd: 0,
    relatedDeclarationId: null,
    clientId: clientId ?? null,
    importDraftCustomerName: clientId ? null : cust || null,
    quotaRegisterNumber: reg || null,
    quotaMyanmarDescription: mmSummary || null,
    description: "",
    occurredAt: start,
    linkedImportIndicatorId: indicator.id,
  };
}

function upsertFinanceFromQuotaIndicator(
  finance: FinanceRecord[],
  indicator: ImportQuotaIndicator,
  clients: Client[],
  draftCategory: string
): FinanceRecord[] {
  const payload = buildFinancePayloadFromQuotaIndicator(indicator, clients, draftCategory);
  const idx = finance.findIndex((f) => f.linkedImportIndicatorId === indicator.id);
  if (idx >= 0) {
    const prev = finance[idx];
    return finance.map((f, i) =>
      i === idx ? { ...prev, ...payload, id: prev.id, createdAt: prev.createdAt } : f
    );
  }
  return [...finance, { ...payload, id: uid(), createdAt: nowIso() }];
}

/** 与进、出口指标草稿对齐：补全缺失流水、删除已无草稿的关联流水 */
function reconcileFinanceWithQuotaDrafts(
  finance: FinanceRecord[],
  importIndicators: ImportQuotaIndicator[],
  exportIndicators: ImportQuotaIndicator[],
  clients: Client[]
): FinanceRecord[] {
  const draftIds = new Set([
    ...importIndicators.map((x) => x.id),
    ...exportIndicators.map((x) => x.id),
  ]);
  let next = finance.filter(
    (f) =>
      f.linkedImportIndicatorId === undefined ||
      f.linkedImportIndicatorId === null ||
      draftIds.has(f.linkedImportIndicatorId)
  );
  for (const ind of importIndicators) {
    next = upsertFinanceFromQuotaIndicator(next, ind, clients, "进口指标草稿");
  }
  for (const ind of exportIndicators) {
    next = upsertFinanceFromQuotaIndicator(next, ind, clients, "出口指标草稿");
  }
  return next;
}

function digitsSlice(raw: string, max: number): string {
  return raw.replace(/\D/g, "").slice(0, max);
}

function normalizeGoodsLinePersisted(raw: unknown): ImportGoodsLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const l = raw as Record<string, unknown>;
  const qty = Math.min(
    Math.max(0, Math.floor(Number(l.quantity) || 0)),
    Number.MAX_SAFE_INTEGER
  );
  const price = Number(l.setPrice);
  const safePrice = Number.isFinite(price) ? price : 0;
  let lineTotal =
    typeof l.lineTotal === "number" && Number.isFinite(l.lineTotal) ? l.lineTotal : qty * safePrice;
  if (!Number.isFinite(lineTotal)) lineTotal = qty * safePrice;
  const unitCode =
    typeof l.unitCode === "string" && IMPORT_UNIT_SET.has(l.unitCode)
      ? (l.unitCode as ImportIndicatorUnitCode)
      : "KG";
  const setPriceCurrency =
    typeof l.setPriceCurrency === "string" && IMPORT_CUR_SET.has(l.setPriceCurrency)
      ? (l.setPriceCurrency as ImportIndicatorCurrencyCode)
      : "USD";
  let cargoImageDataUrl: string | undefined;
  if (typeof l.cargoImageDataUrl === "string") {
    const u = l.cargoImageDataUrl.trim();
    if (
      u.startsWith("data:image/jpeg") ||
      u.startsWith("data:image/jpg") ||
      u.startsWith("data:image/png") ||
      u.startsWith("data:image/gif")
    ) {
      cargoImageDataUrl =
        u.length <= 2_800_000 ? u : undefined;
    }
  }
  return {
    id: typeof l.id === "string" ? l.id : uid(),
    hsCode: digitsSlice(String(l.hsCode ?? ""), 10),
    cargoDescription: String(l.cargoDescription ?? ""),
    myanmarDescription: String(l.myanmarDescription ?? ""),
    unitCode,
    setPrice: safePrice,
    setPriceCurrency,
    quantity: qty,
    lineTotal,
    ...(cargoImageDataUrl ? { cargoImageDataUrl } : {}),
  };
}

function legacyFlatImportToGoodsLine(o: Record<string, unknown>): ImportGoodsLine {
  const qty = Math.min(
    Math.max(0, Math.floor(Number(o.quantity) || 0)),
    Number.MAX_SAFE_INTEGER
  );
  const price = Number(o.setPrice);
  const safePrice = Number.isFinite(price) ? price : 0;
  let lineTotal =
    typeof o.totalPrice === "number" && Number.isFinite(o.totalPrice)
      ? o.totalPrice
      : qty * safePrice;
  if (!Number.isFinite(lineTotal)) lineTotal = qty * safePrice;
  const unitCode =
    typeof o.unitCode === "string" && IMPORT_UNIT_SET.has(o.unitCode)
      ? (o.unitCode as ImportIndicatorUnitCode)
      : "KG";
  const setPriceCurrency =
    typeof o.setPriceCurrency === "string" && IMPORT_CUR_SET.has(o.setPriceCurrency)
      ? (o.setPriceCurrency as ImportIndicatorCurrencyCode)
      : "USD";
  return {
    id: uid(),
    hsCode: digitsSlice(String(o.hsCode ?? ""), 10),
    cargoDescription: String(o.cargoDescription ?? ""),
    myanmarDescription: String(o.myanmarDescription ?? ""),
    unitCode,
    setPrice: safePrice,
    setPriceCurrency,
    quantity: qty,
    lineTotal,
  };
}

/** 兼容数字 id、避免整条记录在 hydration 时被静默丢弃 */
function coercePersistedRecordId(o: Record<string, unknown>): string | null {
  const raw = o.id;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return null;
}

/**
 * 规范化本地存储中的进口指标草稿。
 * 历史上若此处返回 null，persist merge 会把整条记录过滤掉，刷新后表现为「订单/草稿全部丢失」；
 * 因此对不明形状的数据尽量降级恢复为「至少保留一条空商品行」，而不再返回 null。
 */
function normalizePersistedImportIndicator(x: unknown): ImportQuotaIndicator | null {
  if (typeof x !== "object" || x === null) return null;
  const o = x as Record<string, unknown>;
  const id = coercePersistedRecordId(o);
  if (!id) return null;

  const registerNumber = String(o.registerNumber ?? "").replace(/\D/g, "").slice(0, 16);

  const base = {
    id,
    registerNumber,
    portOfDischarge: String(o.portOfDischarge ?? ""),
    customerName: String(o.customerName ?? ""),
    startDate: String(o.startDate ?? ""),
    edDate: String(o.edDate ?? ""),
    firstDeposited: Math.floor(Number(o.firstDeposited) || 0),
    secondDeposited: Math.floor(Number(o.secondDeposited) || 0),
    remainingBalance: Math.floor(Number(o.remainingBalance) || 0),
    totalChargesForLicense: Math.floor(Number(o.totalChargesForLicense) || 0),
    firstDepositedHandler: String(o.firstDepositedHandler ?? ""),
    secondDepositedHandler: String(o.secondDepositedHandler ?? ""),
    remainingBalanceHandler: String(o.remainingBalanceHandler ?? ""),
    createdAt: typeof o.createdAt === "string" ? o.createdAt : nowIso(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : nowIso(),
  };

  if (Array.isArray(o.goodsLines)) {
    const goodsLines = (o.goodsLines as unknown[])
      .map(normalizeGoodsLinePersisted)
      .filter((g): g is ImportGoodsLine => g !== null);
    return { ...base, goodsLines };
  }

  const fromLicenceTemplate = legacyTradeLicenceToQuota(o);
  if (fromLicenceTemplate) return fromLicenceTemplate;

  if (typeof o.hsCode === "string") {
    return {
      ...base,
      goodsLines: [legacyFlatImportToGoodsLine(o)],
    };
  }

  return {
    ...base,
    goodsLines: [
      {
        id: uid(),
        hsCode: "",
        cargoDescription: String(
          (o as { goodsDescription?: unknown }).goodsDescription ??
            (o as { note?: unknown }).note ??
            ""
        ),
        myanmarDescription: "",
        unitCode: "KG",
        setPrice: 0,
        setPriceCurrency: "USD",
        quantity: 0,
        lineTotal: 0,
      },
    ],
  };
}

function normalizeLicencePriceRow(raw: unknown): ImportLicencePriceRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const unitCode =
    typeof r.unitCode === "string" && IMPORT_UNIT_SET.has(r.unitCode)
      ? (r.unitCode as ImportIndicatorUnitCode)
      : "KG";
  const setPriceCurrency =
    typeof r.setPriceCurrency === "string" && IMPORT_CUR_SET.has(r.setPriceCurrency)
      ? (r.setPriceCurrency as ImportIndicatorCurrencyCode)
      : "USD";
  const id = typeof r.id === "string" ? r.id : uid();
  const batchId = typeof r.batchId === "string" ? r.batchId : uid();
  const sourceFileName = String(r.sourceFileName ?? "");
  const extractedAt = typeof r.extractedAt === "string" ? r.extractedAt : nowIso();
  const hsCode = digitsSlice(String(r.hsCode ?? ""), 10);
  const cargoDescription = String(r.cargoDescription ?? "");
  const registerNumber = String(r.registerNumber ?? "").replace(/\D/g, "").slice(0, 12);
  const setPrice = Number(r.setPrice);
  const safePrice = Number.isFinite(setPrice) ? setPrice : 0;
  const qty = Math.min(
    Math.max(0, Math.floor(Number(r.quantity) || 0)),
    Number.MAX_SAFE_INTEGER
  );
  let lineTotal = Number(r.lineTotal);
  if (!Number.isFinite(lineTotal)) lineTotal = safePrice * qty;
  return {
    id,
    batchId,
    sourceFileName,
    extractedAt,
    registerNumber,
    hsCode,
    cargoDescription,
    unitCode,
    setPrice: safePrice,
    setPriceCurrency,
    quantity: qty,
    lineTotal,
  };
}

/** JSON 恢复等非 persist merge 场景下的进口指标规范化（含旧版单商品扁平结构） */
export function migrateImportQuotaRecord(x: unknown): ImportQuotaIndicator | null {
  return normalizePersistedImportIndicator(x);
}

function isoTail(isoOrDay: unknown): string {
  const s = String(isoOrDay ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function legacyLicenceLineToGoodsLine(
  raw: unknown,
  defaultCurrency: ImportIndicatorCurrencyCode
): ImportGoodsLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const li = raw as Record<string, unknown>;
  const qty = Math.min(
    Math.max(0, Math.floor(Number(li.quantity) || 0)),
    Number.MAX_SAFE_INTEGER
  );
  const safePrice = Number.isFinite(Number(li.unitPrice)) ? Number(li.unitPrice) : 0;
  let lineTotal = Number(li.lineValueForeign);
  if (!Number.isFinite(lineTotal)) lineTotal = qty * safePrice;
  const ucRaw = String(li.unitCode ?? "KG").trim();
  const unitCode = IMPORT_UNIT_SET.has(ucRaw) ? (ucRaw as ImportIndicatorUnitCode) : "KG";
  return {
    id: typeof li.id === "string" ? li.id : uid(),
    hsCode: digitsSlice(String(li.hsCode ?? ""), 10),
    cargoDescription: String(li.description ?? ""),
    myanmarDescription: "",
    unitCode,
    setPrice: safePrice,
    setPriceCurrency: defaultCurrency,
    quantity: qty,
    lineTotal,
  };
}

function legacyTradeLicenceToQuota(o: Record<string, unknown>): ImportQuotaIndicator | null {
  if (!coercePersistedRecordId(o)) return null;
  const items = o.lineItems;
  if (!Array.isArray(items) || items.length === 0) return null;
  const invCurRaw = String(o.invoiceCurrency ?? "USD").trim();
  const currency: ImportIndicatorCurrencyCode = IMPORT_CUR_SET.has(invCurRaw)
    ? (invCurRaw as ImportIndicatorCurrencyCode)
    : "USD";

  const goodsLines = items
    .map((x) => legacyLicenceLineToGoodsLine(x, currency))
    .filter((g): g is ImportGoodsLine => g !== null);
  if (goodsLines.length === 0) return null;

  const regDigits = String(o.registrationNo ?? "").replace(/\D/g, "");
  const registerNumber =
    regDigits.length >= 9 ? regDigits.slice(-9) : regDigits.padStart(9, "0");

  return {
    id: coercePersistedRecordId(o)!,
    registerNumber,
    portOfDischarge: String(o.portOfDischarge ?? ""),
    customerName: String(o.importerName ?? ""),
    startDate: isoTail(o.dateOfIssue) || isoTail(o.lastShipmentDate),
    goodsLines,
    edDate: isoTail(o.lastShipmentDate) || isoTail(o.declarationDate),
    firstDeposited: 0,
    secondDeposited: 0,
    remainingBalance: 0,
    totalChargesForLicense: 0,
    firstDepositedHandler: "",
    secondDepositedHandler: "",
    remainingBalanceHandler: "",
    createdAt: typeof o.createdAt === "string" ? o.createdAt : nowIso(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : nowIso(),
  };
}

function normalizePersistedExportIndicator(x: unknown): ImportQuotaIndicator | null {
  if (typeof x !== "object" || x === null) return null;
  const o = x as Record<string, unknown>;
  if (!coercePersistedRecordId(o)) return null;

  if (Array.isArray(o.goodsLines)) {
    const cleaned: Record<string, unknown> = { ...o };
    delete cleaned.lineItems;
    return normalizePersistedImportIndicator(cleaned);
  }

  if (Array.isArray(o.lineItems)) {
    return legacyTradeLicenceToQuota(o);
  }

  const cleaned: Record<string, unknown> = { ...o };
  delete cleaned.lineItems;
  return normalizePersistedImportIndicator(cleaned);
}

/** JSON 恢复：出口指标（含旧版许可证 lineItems 模板迁移为 goodsLines） */
export function migrateExportQuotaRecord(x: unknown): ImportQuotaIndicator | null {
  return normalizePersistedExportIndicator(x);
}

function demoGoodsLine(
  hs: string,
  cargoDescription: string,
  quantity: number,
  setPrice: number
): ImportGoodsLine {
  const id = uid();
  const qty = Math.min(Math.max(0, Math.floor(quantity)), Number.MAX_SAFE_INTEGER);
  const safePrice = Number.isFinite(setPrice) ? setPrice : 0;
  return {
    id,
    hsCode: digitsSlice(hs, 10),
    cargoDescription,
    myanmarDescription: "",
    unitCode: "KG",
    setPrice: safePrice,
    setPriceCurrency: "USD",
    quantity: qty,
    lineTotal: qty * safePrice,
  };
}

/** 两条可用于恢复的演示进口草稿（客户名称对齐演示客户「示例贸易有限公司」） */
function createDemoImportIndicatorDrafts(): ImportQuotaIndicator[] {
  const t = nowIso();
  const day = new Date().toISOString().slice(0, 10);
  const isoDay = `${day}T00:00:00.000Z`;
  return [
    {
      id: uid(),
      registerNumber: "123456789",
      portOfDischarge: "仰光港",
      customerName: "示例贸易有限公司",
      startDate: isoDay,
      goodsLines: [demoGoodsLine("847130", "笔记本电脑配件（演示）", 80, 42)],
      edDate: isoDay,
      firstDeposited: 5_000_000,
      secondDeposited: 3_000_000,
      remainingBalance: 2_000_000,
      totalChargesForLicense: 10_500_000,
      firstDepositedHandler: "演示账号 · 订金",
      secondDepositedHandler: "演示账号 · ANNI",
      remainingBalanceHandler: "演示账号 · License",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: uid(),
      registerNumber: "987654321",
      portOfDischarge: "曼德勒",
      customerName: "示例贸易有限公司",
      startDate: isoDay,
      goodsLines: [demoGoodsLine("851762", "通信设备零件（演示）", 1200, 3.2)],
      edDate: isoDay,
      firstDeposited: 2_000_000,
      secondDeposited: 1_500_000,
      remainingBalance: 1_000_000,
      totalChargesForLicense: 8_800_000,
      firstDepositedHandler: "",
      secondDepositedHandler: "",
      remainingBalanceHandler: "",
      createdAt: t,
      updatedAt: t,
    },
  ];
}

interface AppState {
  companyName: string;
  setCompanyName: (v: string) => void;
  declarations: CustomsDeclaration[];
  finance: FinanceRecord[];
  personalFinance: PersonalFinanceRecord[];
  shipments: LogisticsShipment[];
  clients: Client[];
  suppliers: Supplier[];
  documents: DocumentFile[];
  todos: TodoItem[];
  importIndicators: ImportQuotaIndicator[];
  exportIndicators: ImportQuotaIndicator[];

  addDeclaration: (d: Omit<CustomsDeclaration, "id" | "createdAt" | "updatedAt">) => void;
  updateDeclaration: (id: string, patch: Partial<CustomsDeclaration>) => void;
  removeDeclaration: (id: string) => void;

  addFinance: (r: Omit<FinanceRecord, "id" | "createdAt">) => void;
  updateFinance: (id: string, patch: Partial<FinanceRecord>) => void;
  removeFinance: (id: string) => void;

  reconcileFinanceWithImportDrafts: () => void;
  /** 追加内置演示进口指标草稿（非备份还原；真实数据须从 JSON 备份导入） */
  appendDemoImportIndicators: () => void;

  addPersonalFinance: (r: Omit<PersonalFinanceRecord, "id" | "createdAt" | "updatedAt">) => void;
  updatePersonalFinance: (id: string, patch: Partial<PersonalFinanceRecord>) => void;
  removePersonalFinance: (id: string) => void;

  addShipment: (s: Omit<LogisticsShipment, "id" | "createdAt" | "updatedAt">) => void;
  updateShipment: (id: string, patch: Partial<LogisticsShipment>) => void;
  removeShipment: (id: string) => void;

  addClient: (c: Omit<Client, "id" | "createdAt">) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  removeClient: (id: string) => void;

  addSupplier: (s: Omit<Supplier, "id" | "createdAt">) => void;
  updateSupplier: (id: string, patch: Partial<Supplier>) => void;
  removeSupplier: (id: string) => void;

  addDocument: (d: Omit<DocumentFile, "id" | "storedAt">) => void;
  updateDocument: (id: string, patch: Partial<DocumentFile>) => void;
  removeDocument: (id: string) => void;

  addTodo: (t: Omit<TodoItem, "id" | "createdAt">) => void;
  updateTodo: (id: string, patch: Partial<TodoItem>) => void;
  removeTodo: (id: string) => void;

  addImportIndicator: (r: Omit<ImportQuotaIndicator, "id" | "createdAt" | "updatedAt">) => void;
  updateImportIndicator: (id: string, patch: Partial<ImportQuotaIndicator>) => void;
  removeImportIndicator: (id: string) => void;

  addExportIndicator: (r: Omit<ImportQuotaIndicator, "id" | "createdAt" | "updatedAt">) => void;
  updateExportIndicator: (id: string, patch: Partial<ImportQuotaIndicator>) => void;
  removeExportIndicator: (id: string) => void;

  importLicencePriceRows: ImportLicencePriceRow[];
  appendImportLicencePriceRows: (rows: Omit<ImportLicencePriceRow, "id">[]) => void;
  clearImportLicencePriceRows: () => void;

  seedDemo: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      companyName: "缅甸报关后台",
      setCompanyName: (companyName) => set({ companyName }),

      declarations: [],
      finance: [],
      personalFinance: [],
      shipments: [],
      clients: [],
      suppliers: [],
      documents: [],
      todos: [],
      importIndicators: [],
      exportIndicators: [],
      importLicencePriceRows: [],

      addDeclaration: (d) =>
        set((s) => ({
          declarations: [
            ...s.declarations,
            { ...d, id: uid(), createdAt: nowIso(), updatedAt: nowIso() },
          ],
        })),
      updateDeclaration: (id, patch) =>
        set((s) => ({
          declarations: s.declarations.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: nowIso() } : x
          ),
        })),
      removeDeclaration: (id) =>
        set((s) => ({
          declarations: s.declarations.filter((x) => x.id !== id),
          finance: s.finance.map((f) =>
            f.relatedDeclarationId === id ? { ...f, relatedDeclarationId: null } : f
          ),
          shipments: s.shipments.map((sh) =>
            sh.declarationId === id ? { ...sh, declarationId: null } : sh
          ),
          documents: s.documents.map((doc) =>
            doc.linkedDeclarationId === id ? { ...doc, linkedDeclarationId: null } : doc
          ),
          todos: s.todos.map((t) =>
            t.linkedDeclarationId === id ? { ...t, linkedDeclarationId: null } : t
          ),
        })),

      addFinance: (r) =>
        set((s) => ({
          finance: [...s.finance, { ...r, id: uid(), createdAt: nowIso() }],
        })),
      updateFinance: (id, patch) =>
        set((s) => ({
          finance: s.finance.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      removeFinance: (id) =>
        set((s) => ({ finance: s.finance.filter((x) => x.id !== id) })),

      reconcileFinanceWithImportDrafts: () =>
        set((s) => ({
          finance: reconcileFinanceWithQuotaDrafts(
            s.finance,
            s.importIndicators,
            s.exportIndicators,
            s.clients
          ),
        })),

      appendDemoImportIndicators: () =>
        set((s) => {
          const drafts = createDemoImportIndicatorDrafts();
          let finance = s.finance;
          for (const row of drafts) {
            finance = upsertFinanceFromQuotaIndicator(finance, row, s.clients, "进口指标草稿");
          }
          return {
            importIndicators: [...s.importIndicators, ...drafts],
            finance,
          };
        }),

      addPersonalFinance: (r) =>
        set((s) => ({
          personalFinance: [
            ...s.personalFinance,
            { ...r, id: uid(), createdAt: nowIso(), updatedAt: nowIso() },
          ],
        })),
      updatePersonalFinance: (id, patch) =>
        set((s) => ({
          personalFinance: s.personalFinance.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: nowIso() } : x
          ),
        })),
      removePersonalFinance: (id) =>
        set((s) => ({
          personalFinance: s.personalFinance.filter((x) => x.id !== id),
        })),

      addShipment: (sh) =>
        set((s) => ({
          shipments: [...s.shipments, { ...sh, id: uid(), createdAt: nowIso(), updatedAt: nowIso() }],
        })),
      updateShipment: (id, patch) =>
        set((s) => ({
          shipments: s.shipments.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: nowIso() } : x
          ),
        })),
      removeShipment: (id) =>
        set((s) => ({ shipments: s.shipments.filter((x) => x.id !== id) })),

      addClient: (c) =>
        set((s) => ({
          clients: [...s.clients, { ...c, id: uid(), createdAt: nowIso() }],
        })),
      updateClient: (id, patch) =>
        set((s) => ({
          clients: s.clients.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      removeClient: (id) =>
        set((s) => ({
          clients: s.clients.filter((x) => x.id !== id),
          declarations: s.declarations.map((d) =>
            d.clientId === id ? { ...d, clientId: null } : d
          ),
          finance: s.finance.map((f) =>
            f.clientId === id ? { ...f, clientId: null } : f
          ),
        })),

      addSupplier: (sup) =>
        set((s) => ({
          suppliers: [...s.suppliers, { ...sup, id: uid(), createdAt: nowIso() }],
        })),
      updateSupplier: (id, patch) =>
        set((s) => ({
          suppliers: s.suppliers.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      removeSupplier: (id) =>
        set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) })),

      addDocument: (d) =>
        set((s) => ({
          documents: [...s.documents, { ...d, id: uid(), storedAt: nowIso() }],
        })),
      updateDocument: (id, patch) =>
        set((s) => ({
          documents: s.documents.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      removeDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((x) => x.id !== id) })),

      addTodo: (t) =>
        set((s) => ({
          todos: [...s.todos, { ...t, id: uid(), createdAt: nowIso() }],
        })),
      updateTodo: (id, patch) =>
        set((s) => ({
          todos: s.todos.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      removeTodo: (id) =>
        set((s) => ({ todos: s.todos.filter((x) => x.id !== id) })),

      addImportIndicator: (r) =>
        set((s) => {
          const id = uid();
          const row: ImportQuotaIndicator = {
            ...r,
            id,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          return {
            importIndicators: [...s.importIndicators, row],
            finance: upsertFinanceFromQuotaIndicator(s.finance, row, s.clients, "进口指标草稿"),
          };
        }),
      updateImportIndicator: (id, patch) =>
        set((s) => {
          const importIndicators = s.importIndicators.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: nowIso() } : x
          );
          const updated = importIndicators.find((x) => x.id === id);
          return {
            importIndicators,
            finance: updated
              ? upsertFinanceFromQuotaIndicator(s.finance, updated, s.clients, "进口指标草稿")
              : s.finance,
          };
        }),
      removeImportIndicator: (id) =>
        set((s) => ({
          importIndicators: s.importIndicators.filter((x) => x.id !== id),
          finance: s.finance.filter((f) => f.linkedImportIndicatorId !== id),
        })),

      addExportIndicator: (r) =>
        set((s) => {
          const id = uid();
          const row: ImportQuotaIndicator = {
            ...r,
            id,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          return {
            exportIndicators: [...s.exportIndicators, row],
            finance: upsertFinanceFromQuotaIndicator(s.finance, row, s.clients, "出口指标草稿"),
          };
        }),
      updateExportIndicator: (id, patch) =>
        set((s) => {
          const exportIndicators = s.exportIndicators.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: nowIso() } : x
          );
          const updated = exportIndicators.find((x) => x.id === id);
          return {
            exportIndicators,
            finance: updated
              ? upsertFinanceFromQuotaIndicator(s.finance, updated, s.clients, "出口指标草稿")
              : s.finance,
          };
        }),
      removeExportIndicator: (id) =>
        set((s) => ({
          exportIndicators: s.exportIndicators.filter((x) => x.id !== id),
          finance: s.finance.filter((f) => f.linkedImportIndicatorId !== id),
        })),

      appendImportLicencePriceRows: (rows) =>
        set((s) => ({
          importLicencePriceRows: [
            ...s.importLicencePriceRows,
            ...rows.map((row) => ({ ...row, id: uid() })),
          ],
        })),
      clearImportLicencePriceRows: () => set({ importLicencePriceRows: [] }),

      seedDemo: () => {
        if (get().declarations.length > 0) return;
        const clientId = uid();
        const decId = uid();
        set({
          clients: [
            {
              id: clientId,
              name: "联系人示例",
              company: "示例贸易有限公司",
              phone: "+95 9 xxx xxx",
              email: "demo@example.com",
              address: "仰光",
              tinOrRegNo: "",
              notes: "演示数据，可自行删除",
              createdAt: nowIso(),
            },
          ],
          declarations: [
            {
              id: decId,
              referenceNo: "DEC-2026-0001",
              clientId,
              direction: "import",
              blNumber: "BL-DEMO-001",
              containerNos: "MSKU1234567",
              hsCodes: "8471.30",
              goodsDescription: "笔记本电脑配件",
              port: "仰光港",
              declaredValueUsd: 12500,
              dutyEstimateUsd: 1875,
              status: "clearing",
              submittedAt: nowIso(),
              clearedAt: null,
              notes: "",
              createdAt: nowIso(),
              updatedAt: nowIso(),
            },
          ],
          finance: [
            {
              id: uid(),
              type: "income",
              category: "报关服务费",
              amountMmk: 3500000,
              amountUsd: 0,
              relatedDeclarationId: decId,
              clientId,
              description: "进口报关代理费",
              occurredAt: nowIso().slice(0, 10),
              createdAt: nowIso(),
            },
          ],
          shipments: [
            {
              id: uid(),
              declarationId: decId,
              carrier: "Maersk",
              vesselOrFlight: "MV DEMO",
              eta: nowIso().slice(0, 10),
              etd: nowIso().slice(0, 10),
              origin: "新加坡",
              destination: "仰光",
              trackingRef: "TRK-DEMO",
              status: "customs",
              notes: "",
              createdAt: nowIso(),
              updatedAt: nowIso(),
            },
          ],
          todos: [
            {
              id: uid(),
              title: "核对 HS 编码与发票金额",
              dueDate: nowIso().slice(0, 10),
              done: false,
              linkedDeclarationId: decId,
              createdAt: nowIso(),
            },
          ],
        });

        set((s) => {
          if (s.importIndicators.length > 0) return {};
          const drafts = createDemoImportIndicatorDrafts();
          let finance = s.finance;
          for (const row of drafts) {
            finance = upsertFinanceFromQuotaIndicator(finance, row, s.clients, "进口指标草稿");
          }
          return {
            importIndicators: [...s.importIndicators, ...drafts],
            finance,
          };
        });
      },
    }),
    {
      name: "customs-admin-storage-v1",
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> | undefined;
        if (!p || typeof p !== "object") return current;
        const importIndicators = Array.isArray(p.importIndicators)
          ? p.importIndicators
              .map(normalizePersistedImportIndicator)
              .filter((row): row is ImportQuotaIndicator => row !== null)
          : [];
        const exportIndicators = Array.isArray(p.exportIndicators)
          ? p.exportIndicators
              .map(normalizePersistedExportIndicator)
              .filter((row): row is ImportQuotaIndicator => row !== null)
          : [];
        const financeRaw = Array.isArray(p.finance) ? p.finance : [];
        const clientsForReconcile = Array.isArray(p.clients) ? (p.clients as Client[]) : [];
        const finance = reconcileFinanceWithQuotaDrafts(
          financeRaw,
          importIndicators,
          exportIndicators,
          clientsForReconcile
        );

        return {
          ...current,
          ...p,
          importIndicators,
          exportIndicators,
          finance,
          importLicencePriceRows: Array.isArray(p.importLicencePriceRows)
            ? p.importLicencePriceRows
                .map(normalizeLicencePriceRow)
                .filter((row): row is ImportLicencePriceRow => row !== null)
            : [],
          personalFinance: Array.isArray((p as { personalFinance?: unknown }).personalFinance)
            ? ((p as { personalFinance: unknown[] }).personalFinance)
                .map(normalizePersonalFinanceRecord)
                .filter((row): row is PersonalFinanceRecord => row !== null)
            : [],
        };
      },
    }
  )
);

useStore.persist.onFinishHydration(() => {
  queueMicrotask(() => {
    useStore.getState().reconcileFinanceWithImportDrafts();
  });
});
