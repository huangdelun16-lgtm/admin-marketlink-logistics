import { useMemo, useRef, useState, type ChangeEvent } from "react";
import type { ImportGoodsLine, ImportLicencePriceRow, ImportQuotaIndicator } from "@/types";
import { useStore } from "@/lib/store";
import { extractLicencePlaintext, parseImportLicenceText } from "@/lib/importLicenceExtract";
import { Field, inputClass, btnPrimary, btnGhost } from "@/components/Modal";
import { Search, Upload, FileImage } from "lucide-react";

function normalizeGoodsQty(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), Number.MAX_SAFE_INTEGER);
}

function isBlankGoodsLine(line: ImportGoodsLine): boolean {
  return (
    !String(line.hsCode ?? "").trim() &&
    !String(line.cargoDescription ?? "").trim() &&
    !String(line.myanmarDescription ?? "").trim() &&
    normalizeGoodsQty(line.quantity) === 0 &&
    !(Number.isFinite(line.setPrice) && line.setPrice !== 0)
  );
}

/** Register No. 归一化（仅数字），用于去重比对 */
function normalizeRegisterDigits(reg: string): string {
  return reg.replace(/\D/g, "").slice(0, 12);
}

/** 当前价格表中已出现的注册号（草稿批文 + 证照导入） */
function collectExistingRegisterSet(
  indicators: ImportQuotaIndicator[],
  licenceRows: ImportLicencePriceRow[]
): Set<string> {
  const set = new Set<string>();
  for (const ind of indicators) {
    const n = normalizeRegisterDigits(ind.registerNumber ?? "");
    if (n) set.add(n);
  }
  for (const row of licenceRows) {
    const n = normalizeRegisterDigits(row.registerNumber ?? "");
    if (n) set.add(n);
  }
  return set;
}

export type PriceTableRow = {
  key: string;
  indicatorId: string;
  registerNumber: string;
  indicatorUpdatedAt: string;
  hsCode: string;
  cargoDescription: string;
  unitCode: string;
  setPrice: number;
  setPriceCurrency: string;
  source: "draft" | "licence";
};

function flattenImportRows(list: ImportQuotaIndicator[]): PriceTableRow[] {
  const rows: PriceTableRow[] = [];
  const sorted = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const ind of sorted) {
    for (const line of ind.goodsLines) {
      if (isBlankGoodsLine(line)) continue;
      rows.push({
        key: `${ind.id}:${line.id}`,
        indicatorId: ind.id,
        registerNumber: ind.registerNumber?.trim() ?? "",
        indicatorUpdatedAt: ind.updatedAt,
        hsCode: String(line.hsCode ?? "").trim(),
        cargoDescription: String(line.cargoDescription ?? "").trim(),
        unitCode: line.unitCode,
        setPrice: Number.isFinite(line.setPrice) ? line.setPrice : 0,
        setPriceCurrency: line.setPriceCurrency,
        source: "draft",
      });
    }
  }
  return rows;
}

function flattenLicenceExtractRows(list: ImportLicencePriceRow[]): PriceTableRow[] {
  return list.map((r) => ({
    key: `licence:${r.id}`,
    indicatorId: r.batchId,
    registerNumber: r.registerNumber,
    indicatorUpdatedAt: r.extractedAt,
    hsCode: r.hsCode,
    cargoDescription: r.cargoDescription,
    unitCode: r.unitCode,
    setPrice: r.setPrice,
    setPriceCurrency: r.setPriceCurrency,
    source: "licence",
  }));
}

export function ImportPriceTablePage() {
  const importIndicators = useStore((s) => s.importIndicators);
  const licenceRows = useStore((s) => s.importLicencePriceRows);
  const appendLicenceRows = useStore((s) => s.appendImportLicencePriceRows);
  const clearLicenceRows = useStore((s) => s.clearImportLicencePriceRows);

  const [cargoSearch, setCargoSearch] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const draftRows = useMemo(() => flattenImportRows(importIndicators), [importIndicators]);
  const licenceFlat = useMemo(() => flattenLicenceExtractRows(licenceRows), [licenceRows]);

  const rows = useMemo(() => {
    return [...draftRows, ...licenceFlat].sort((a, b) =>
      b.indicatorUpdatedAt.localeCompare(a.indicatorUpdatedAt)
    );
  }, [draftRows, licenceFlat]);

  const q = cargoSearch.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!q) return rows;
    return rows.filter((r) => r.cargoDescription.toLowerCase().includes(q));
  }, [rows, q]);

  async function handleLicenceFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setUploadErr(null);
    setUploadMsg(null);
    setUploadBusy(true);
    try {
      const plaintext = await extractLicencePlaintext(file);
      const parsed = parseImportLicenceText(plaintext);
      if (parsed.rows.length === 0) {
        throw new Error(
          "未能识别货物明细表。请确认证照中有「10 位 HS + 英文品名 + 单位 + 单价 + 数量 + 金额」列；扫描件请尽量高清，或尝试导出为可选中文字的 PDF。"
        );
      }
      const incomingReg = normalizeRegisterDigits(parsed.registerNumber);
      const { importIndicators: indList, importLicencePriceRows: licList } = useStore.getState();
      const existingRegs = collectExistingRegisterSet(indList, licList);
      if (incomingReg && existingRegs.has(incomingReg)) {
        setUploadMsg("此单已上传");
        return;
      }

      const batchId = crypto.randomUUID();
      const extractedAt = new Date().toISOString();
      appendLicenceRows(
        parsed.rows.map((row) => ({
          batchId,
          sourceFileName: file.name,
          extractedAt,
          registerNumber: incomingReg || normalizeRegisterDigits(parsed.registerNumber),
          hsCode: row.hsCode,
          cargoDescription: row.cargoDescription,
          unitCode: row.unitCode,
          setPrice: row.setPrice,
          setPriceCurrency: parsed.currency,
          quantity: row.quantity,
          lineTotal: row.lineTotal,
        }))
      );
      setUploadMsg(`已从「${file.name}」导入 ${parsed.rows.length} 条（IMPORT LICENCE 解析）。`);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">进口价格表</h1>
        <p className="mt-1 text-sm text-shell-muted">
          自动汇总「进口指标草稿」已保存的货物行；亦可上传 IMPORT LICENCE 的 PDF / PNG，解析后与草稿数据合并。同一 Register
          No. 不会重复导入。
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-card">
        <div className="border-b border-shell-border bg-[#0f172a]/35 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-[min(100%,320px)] flex-1 max-w-xl">
              <Field label="货物名称筛选 · Cargo Description">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-shell-muted"
                    aria-hidden
                  />
                  <input
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="输入关键字，按英文品名快速查找…"
                    className={`${inputClass} pl-9`}
                    value={cargoSearch}
                    onChange={(e) => setCargoSearch(e.target.value)}
                  />
                </div>
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,.pdf,.png"
                className="hidden"
                onChange={handleLicenceFile}
              />
              <button
                type="button"
                disabled={uploadBusy}
                className={`${btnPrimary} inline-flex items-center gap-2`}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4 shrink-0" aria-hidden />
                {uploadBusy ? "解析中…" : "上传证照解析"}
              </button>
              {licenceRows.length > 0 ? (
                <button
                  type="button"
                  className={`${btnGhost} border-white/15 text-shell-muted hover:text-white`}
                  onClick={() => {
                    if (
                      confirm(
                        "确定清空所有「证照上传」导入的行？此操作不可撤销（不影响进口指标草稿）。"
                      )
                    ) {
                      clearLicenceRows();
                      setUploadMsg(null);
                      setUploadErr(null);
                    }
                  }}
                >
                  清空证照导入
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-shell-muted">
            <span className="inline-flex items-center gap-1">
              <FileImage className="h-3.5 w-3.5 opacity-80" aria-hidden />
              支持 PNG 与 PDF；PDF 会先抽取文字，失败时再对首页 OCR（需联网加载识别引擎）。
            </span>
          </div>
          {uploadErr ? (
            <p className="mt-2 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {uploadErr}
            </p>
          ) : null}
          {uploadMsg ? (
            <p
              className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                uploadMsg === "此单已上传"
                  ? "border-amber-500/35 bg-amber-500/15 text-amber-100"
                  : "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {uploadMsg}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-shell-muted">
            <span>
              共 <span className="font-mono tabular-nums text-emerald-200/90">{rows.length}</span> 条
              {q ? (
                <>
                  {" "}
                  · 筛选后{" "}
                  <span className="font-mono tabular-nums text-sky-200/90">{filteredRows.length}</span>{" "}
                  条
                </>
              ) : null}
            </span>
            {cargoSearch ? (
              <button
                type="button"
                className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-shell-muted hover:border-white/20 hover:text-white"
                onClick={() => setCargoSearch("")}
              >
                清除筛选
              </button>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="text-xs uppercase text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/50">
                <th className="px-4 py-3 font-medium">Register No.</th>
                <th className="px-4 py-3 font-medium">H.S Code</th>
                <th className="px-4 py-3 font-normal normal-case">
                  <span className="font-medium uppercase tracking-wide text-shell-muted">
                    Cargo Description
                  </span>
                  <span className="mt-1 block text-[10px] font-normal capitalize leading-snug text-sky-200/70">
                    （支持上方关键字筛选）
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">Unit Code</th>
                <th className="px-4 py-3 font-medium">Set Price</th>
                <th className="px-4 py-3 font-medium">币种</th>
                <th className="px-4 py-3 whitespace-nowrap font-medium">来源 / 更新时间</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-shell-muted">
                    暂无数据。请在「进口指标草稿」保存含明细的记录，或使用「上传证照解析」导入 IMPORT LICENCE。
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-shell-muted">
                    没有与「{cargoSearch.trim()}」匹配的 Cargo Description，请尝试其他关键字或{" "}
                    <button
                      type="button"
                      className="text-sky-300 underline hover:text-sky-200"
                      onClick={() => setCargoSearch("")}
                    >
                      清除筛选
                    </button>
                    。
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr
                    key={r.key}
                    className="border-b border-shell-border/80 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 font-mono text-xs tracking-wide">
                      {r.registerNumber || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.hsCode || "—"}</td>
                    <td className="max-w-[320px] px-4 py-3 text-shell-muted" title={r.cargoDescription}>
                      {r.cargoDescription || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono">{r.unitCode}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-emerald-200">
                      {Number.isFinite(r.setPrice) ? r.setPrice : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.setPriceCurrency}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-shell-muted">
                      <span
                        className={
                          r.source === "licence" ? "text-sky-200/90" : "text-shell-muted"
                        }
                      >
                        {r.source === "licence" ? "证照" : "草稿"}
                      </span>
                      <span className="text-shell-muted/50"> · </span>
                      {r.indicatorUpdatedAt ? r.indicatorUpdatedAt.slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-shell-muted">
        说明：完全空白的商品行不会出现在草稿汇总中；证照解析依赖版式与清晰度，识别后请人工核对。若解析出的 Register No.
        与表中已有记录相同，将提示「此单已上传」且不会重复写入。
      </p>
    </div>
  );
}
