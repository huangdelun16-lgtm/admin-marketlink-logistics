export type DeclarationStatus =
  | "draft"
  | "submitted"
  | "clearing"
  | "released"
  | "exception";

export interface CustomsDeclaration {
  id: string;
  referenceNo: string;
  clientId: string | null;
  /** 进出口 */
  direction: "import" | "export";
  blNumber: string;
  containerNos: string;
  hsCodes: string;
  goodsDescription: string;
  port: string;
  declaredValueUsd: number;
  dutyEstimateUsd: number;
  status: DeclarationStatus;
  submittedAt: string | null;
  clearedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type TxType = "income" | "expense";

export interface FinanceRecord {
  id: string;
  type: TxType;
  category: string;
  amountMmk: number;
  amountUsd: number;
  relatedDeclarationId: string | null;
  clientId: string | null;
  /** 进口草稿同步且客户档案未匹配时，用于在「客户」列展示草稿上的客户名称 */
  importDraftCustomerName?: string | null;
  /** Register No（与批文草稿一致；手工登记亦可填写） */
  quotaRegisterNumber?: string | null;
  /** Myanmar Description 摘要（多商品时为「首条描述（共 N 项）」） */
  quotaMyanmarDescription?: string | null;
  description: string;
  occurredAt: string;
  createdAt: string;
  /** 由「进口指标草稿」保存时自动同步到公司流水时关联（删除草稿会一并移除对应流水） */
  linkedImportIndicatorId?: string | null;
}

/** 个人日常收支（与业务财务 {@link FinanceRecord} 分库存储，互不关联报关单/客户） */
export interface PersonalFinanceRecord {
  id: string;
  type: TxType;
  category: string;
  /** Register No.（与「进口指标草稿」批文字段对应；可选） */
  quotaRegisterNumber?: string | null;
  amountMmk: number;
  /** 可选外币备忘（如旅行美元支出） */
  amountUsd: number;
  description: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export type ShipmentStatus =
  | "booking"
  | "in_transit"
  | "at_port"
  | "customs"
  | "delivered";

export interface LogisticsShipment {
  id: string;
  declarationId: string | null;
  carrier: string;
  vesselOrFlight: string;
  eta: string;
  etd: string;
  origin: string;
  destination: string;
  trackingRef: string;
  status: ShipmentStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  tinOrRegNo: string;
  notes: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  serviceType: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
}

export interface DocumentFile {
  id: string;
  title: string;
  category: string;
  linkedDeclarationId: string | null;
  remark: string;
  /** ISO date stored when user uploads placeholder — real file upload can replace */
  storedAt: string;
}

export interface TodoItem {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
  linkedDeclarationId: string | null;
  createdAt: string;
}

/**
 * 进口指标（新版台账 — 与出口许可证模板分离）
 */
export type ImportIndicatorUnitCode = "KG" | "U" | "M²" | "M³" | "PR";

export type ImportIndicatorCurrencyCode =
  | "MMK"
  | "USD"
  | "CNY"
  | "THB"
  | "EUR"
  | "SGD"
  | "JPY";

export interface ImportGoodsLine {
  id: string;
  /** H.S Code — 10 位数字 */
  hsCode: string;
  cargoDescription: string;
  myanmarDescription: string;
  unitCode: ImportIndicatorUnitCode;
  setPrice: number;
  setPriceCurrency: ImportIndicatorCurrencyCode;
  quantity: number;
  /** Quantity × Set Price */
  lineTotal: number;
  /** 货物参考图（JPEG data URL，由表单上传并压缩） */
  cargoImageDataUrl?: string;
}

export interface ImportQuotaIndicator {
  id: string;
  /** Register Number — 9 位数字 */
  registerNumber: string;
  /** Port Of Discharge — 城市名 */
  portOfDischarge: string;
  /** 客户名称 */
  customerName: string;
  /** Start Date — 批文/指标起始日 */
  startDate: string;
  /** 一单批文内多行商品（与第 2、3、4 步一一对应） */
  goodsLines: ImportGoodsLine[];
  /** ED date */
  edDate: string;
  /** 申请批文订金 */
  firstDeposited: number;
  /** ANNI Fees */
  secondDeposited: number;
  /** License */
  remainingBalance: number;
  /** 许可证侧 Total Charges For License（缅币），用于与三期款项对账 */
  totalChargesForLicense: number;
  /** 申请批文订金 — 经手人（客户汇款收款账号名） */
  firstDepositedHandler: string;
  /** ANNI Fees — 经手人（收款账号名） */
  secondDepositedHandler: string;
  /** License 尾款 — 经手人（收款账号名） */
  remainingBalanceHandler: string;
  createdAt: string;
  updatedAt: string;
}

/** 从 IMPORT LICENCE 证照（PNG/PDF）解析导入「进口价格表」的行 */
export interface ImportLicencePriceRow {
  id: string;
  batchId: string;
  sourceFileName: string;
  extractedAt: string;
  registerNumber: string;
  hsCode: string;
  cargoDescription: string;
  unitCode: ImportIndicatorUnitCode;
  setPrice: number;
  setPriceCurrency: ImportIndicatorCurrencyCode;
  quantity: number;
  lineTotal: number;
}

/** 出口指标台账（与 {@link ImportQuotaIndicator} 结构一致，共用表单与存储规范化逻辑） */
export type ExportQuotaIndicator = ImportQuotaIndicator;

/** 缅甸商务部进口/出口许可证（指标）货物明细行 — 对应表格 Box 13–19 */
export interface LicenceGoodsLine {
  id: string;
  srNo: number;
  hsCode: string;
  description: string;
  unitCode: string;
  unitPrice: number;
  quantity: number;
  /** 外币金额（如 CNY），对应许可证「Value」列 */
  lineValueForeign: number;
}

export type LicenceTransportMode = "sea" | "rail" | "road" | "air";

/**
 * 缅甸进口/出口许可证台账字段（对齐纸质 IMPORT LICENCE 各编号栏位）
 */
export interface TradeLicenceIndicator {
  id: string;
  /** 表格右上角参考编号（如 484588） */
  formReferenceNo: string;
  /** Box 7 Licence No */
  licenceNo: string;
  /** Box 1 */
  importerName: string;
  importerAddress: string;
  /** Box 2 */
  registrationNo: string;
  registrationValidDate: string;
  /** Box 3 Consignor */
  consignorName: string;
  consignorAddress: string;
  /** Box 4 — 进口为最后进口日；出口页展示为最后出口/装运日 */
  lastShipmentDate: string;
  /** Box 5 */
  modeOfTransport: LicenceTransportMode;
  /** Box 6 — 卸货港/交货地（出口场景可自行填启运港等） */
  portOfDischarge: string;
  /** Box 8 */
  countryConsigned: string;
  /** Box 9 */
  countryOfOrigin: string;
  /** Box 10 — Normal TT 等 */
  methodOfTrade: string;
  /** Box 11 — 发票币种代码，如 CNY */
  invoiceCurrency: string;
  invoiceAmount: number;
  /** Box 11 Incoterm */
  incoterm: string;
  /** Box 12 Total Value (Kyats) */
  totalValueKyats: number;
  lineItems: LicenceGoodsLine[];
  /** Box 20 */
  remarks: string;
  /** Box 21 */
  declarantName: string;
  declarantDesignation: string;
  declarationDate: string;
  /** Box 22 */
  conditions: string;
  /** Box 23 */
  revenueStamp: string;
  /** Box 24 */
  dateOfIssue: string;
  /** 签章说明（数字化占位，可填印花税号或备注） */
  stampSignatureNotes: string;
  createdAt: string;
  updatedAt: string;
}
