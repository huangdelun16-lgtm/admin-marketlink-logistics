import { useEffect, useMemo, useState } from "react";
import type { FinanceRecord, PersonalFinanceRecord, TxType } from "@/types";
import { useStore } from "@/lib/store";
import { fmtMmk, fmtUsd } from "@/lib/labels";
import {
  formatMmkDigitStringForInput,
  mmkIntToDigitInput,
  MMK_GENERAL_INPUT_MAX_DIGITS,
  parseMmkIntString,
  stripMmkDigitString,
} from "@/lib/mmkFormat";
import { Modal, Field, inputClass, btnPrimary, btnGhost, btnDanger } from "@/components/Modal";
import { ChevronLeft, ChevronRight, Plus, Wallet2 } from "lucide-react";

const categoriesIncome = ["报关服务费", "代理费加成", "仓储装卸", "进口指标草稿", "出口指标草稿", "其它收入"];
const categoriesExpense = ["预付关税", "港口杂费", "运输费", "检验费", "罚金/滞港", "其它支出"];

const COMPANY_MM_FONT =
  'font-[system-ui,"Myanmar Text","Padauk",sans-serif]' as const;

const personalIncomeCategories = ["工资薪金", "兼职副业", "礼金赠与", "退款返现", "其它收入"];
const personalExpenseCategories = [
  "餐饮",
  "交通出行",
  "购物日用",
  "房租水电",
  "医疗健康",
  "娱乐社交",
  "其它支出",
];

export function CompanyFinancePage() {
  const finance = useStore((s) => s.finance);
  const importIndicators = useStore((s) => s.importIndicators);
  const declarations = useStore((s) => s.declarations);
  const clients = useStore((s) => s.clients);
  const addFinance = useStore((s) => s.addFinance);
  const updateFinance = useStore((s) => s.updateFinance);
  const removeFinance = useStore((s) => s.removeFinance);

  useEffect(() => {
    useStore.getState().reconcileFinanceWithImportDrafts();
  }, []);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountMmkStr, setAmountMmkStr] = useState("");
  const [amountMmkFocused, setAmountMmkFocused] = useState(false);
  const [form, setForm] = useState({
    type: "income" as TxType,
    category: categoriesIncome[0],
    amountMmk: 0,
    relatedDeclarationId: null as string | null,
    clientId: null as string | null,
    quotaRegisterNumber: "",
    quotaMyanmarDescription: "",
    description: "",
    occurredAt: new Date().toISOString().slice(0, 10),
  });

  const decMap = useMemo(
    () => Object.fromEntries(declarations.map((d) => [d.id, d.referenceNo])),
    [declarations]
  );
  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.company || c.name])),
    [clients]
  );

  const totals = useMemo(() => {
    let incMmk = 0,
      expMmk = 0;
    for (const r of finance) {
      if (r.type === "income") incMmk += r.amountMmk;
      else expMmk += r.amountMmk;
    }
    return { incMmk, expMmk };
  }, [finance]);

  /** 与「编辑进口指标草稿」三期款项区块一致：已收 = 三期之和；未收 = Total Charges − 三期之和（逐草稿汇总） */
  const importQuotaDepositTotals = useMemo(() => {
    let received = 0;
    let outstanding = 0;
    for (const ind of importIndicators) {
      const tc = Math.floor(Number(ind.totalChargesForLicense) || 0);
      const d1 = Math.floor(Number(ind.firstDeposited) || 0);
      const d2 = Math.floor(Number(ind.secondDeposited) || 0);
      const d3 = Math.floor(Number(ind.remainingBalance) || 0);
      const three = d1 + d2 + d3;
      received += three;
      outstanding += tc - three;
    }
    return { received, outstanding };
  }, [importIndicators]);

  function companyClientLabel(r: FinanceRecord): string {
    const fromMaster = r.clientId ? clientMap[r.clientId] : undefined;
    const draftName = r.importDraftCustomerName?.trim();
    return fromMaster ?? draftName ?? "—";
  }

  const sorted = useMemo(
    () =>
      [...finance].sort((a, b) =>
        `${b.occurredAt}${b.createdAt}`.localeCompare(`${a.occurredAt}${a.createdAt}`)
      ),
    [finance]
  );

  function openNew() {
    setEditingId(null);
    setForm({
      type: "income",
      category: categoriesIncome[0],
      amountMmk: 0,
      relatedDeclarationId: null,
      clientId: null,
      quotaRegisterNumber: "",
      quotaMyanmarDescription: "",
      description: "",
      occurredAt: new Date().toISOString().slice(0, 10),
    });
    setAmountMmkStr("");
    setOpen(true);
  }

  function openEdit(r: FinanceRecord) {
    setEditingId(r.id);
    setForm({
      type: r.type,
      category: r.category,
      amountMmk: r.amountMmk,
      relatedDeclarationId: r.relatedDeclarationId,
      clientId: r.clientId,
      quotaRegisterNumber: r.quotaRegisterNumber?.trim() ?? "",
      quotaMyanmarDescription: r.quotaMyanmarDescription?.trim() ?? "",
      description: r.description,
      occurredAt: r.occurredAt.slice(0, 10),
    });
    setAmountMmkStr(mmkIntToDigitInput(r.amountMmk));
    setOpen(true);
  }

  function save() {
    const amountMmk = parseMmkIntString(amountMmkStr, MMK_GENERAL_INPUT_MAX_DIGITS);
    const prevUsd = editingId ? finance.find((x) => x.id === editingId)?.amountUsd ?? 0 : 0;
    const payload = {
      ...form,
      amountMmk,
      amountUsd: prevUsd,
      occurredAt: form.occurredAt,
      quotaRegisterNumber: form.quotaRegisterNumber.trim() || null,
      quotaMyanmarDescription: form.quotaMyanmarDescription.trim() || null,
    };
    if (editingId) updateFinance(editingId, payload);
    else addFinance(payload);
    setOpen(false);
  }

  const catOptionsCompany =
    form.type === "income" ? categoriesIncome : categoriesExpense;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">公司流水</h1>
          <p className="mt-1 text-sm text-shell-muted">
            关联报关单与客户，区分收入与支出；金额以缅币为准。卡片「已收 / 未收金额」按当前全部进口指标草稿逐条汇总（与编辑草稿内三期款项一致：已收为
            First + Second + Remaining 之和；未收为 Total Charges For License 减去三期之和）。保存进口/出口草稿后会写入关联公司收入。个人账目请到「财务 → 私人流水」。
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={openNew}>
          登记一笔
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat title="累计收入（缅币）" value={fmtMmk(totals.incMmk)} tone="emerald" />
        <MiniStat title="累计支出（缅币）" value={fmtMmk(totals.expMmk)} tone="rose" />
        <MiniStat
          title="已收金额（缅币）"
          value={fmtMmk(importQuotaDepositTotals.received)}
          tone="teal"
          hint="进口指标草稿：First + Second + Remaining（三期款项合计）"
        />
        <MiniStat
          title="未收金额（缅币）"
          value={fmtMmk(importQuotaDepositTotals.outstanding)}
          tone="cyan"
          hint="进口指标草稿：Total Charges For License − 三期款项合计"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/50">
                <th className="px-4 py-3 font-medium">日期</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">类别</th>
                <th className="px-4 py-3 font-medium">Register No.</th>
                <th className="px-4 py-3 font-medium normal-case">Myanmar Description</th>
                <th className="px-4 py-3 font-medium">缅币</th>
                <th className="px-4 py-3 font-medium">客户</th>
                <th className="px-4 py-3 font-medium">关联报告单</th>
                <th className="px-4 py-3 font-medium">备注</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-shell-muted">
                    暂无流水。
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.id} className="border-b border-shell-border/80 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 whitespace-nowrap">{r.occurredAt.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.type === "income"
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }
                      >
                        {r.type === "income" ? "收入" : "支出"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.category}</td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      {r.quotaRegisterNumber?.trim() || "—"}
                    </td>
                    <td
                      className={`max-w-[220px] truncate px-4 py-3 text-xs leading-snug text-shell-muted ${COMPANY_MM_FONT}`}
                      title={r.quotaMyanmarDescription?.trim() || undefined}
                    >
                      {r.quotaMyanmarDescription?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono">{fmtMmk(r.amountMmk)}</td>
                    <td className="px-4 py-3">{companyClientLabel(r)}</td>
                    <td className="px-4 py-3">
                      {r.relatedDeclarationId ? decMap[r.relatedDeclarationId] ?? "—" : "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-shell-muted" title={r.description}>
                      {r.description}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-2 text-blue-300 hover:underline"
                        onClick={() => openEdit(r)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="text-red-300 hover:underline"
                        onClick={() =>
                          confirm("删除该记录？删除后无法恢复。") && removeFinance(r.id)
                        }
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        title={editingId ? "编辑财务记录" : "新建财务记录"}
        open={open}
        wide
        onClose={() => setOpen(false)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="收支类型">
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as TxType;
                setForm((f) => ({
                  ...f,
                  type,
                  category: type === "income" ? categoriesIncome[0] : categoriesExpense[0],
                }));
              }}
            >
              <option value="income">收入</option>
              <option value="expense">支出</option>
            </select>
          </Field>
          <Field label="业务日期">
            <input
              type="date"
              className={inputClass}
              value={form.occurredAt}
              onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))}
            />
          </Field>
          <Field label="类别">
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {!catOptionsCompany.includes(form.category) && form.category ? (
                <option value={form.category}>{form.category}</option>
              ) : null}
              {catOptionsCompany.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Register No.">
            <input
              className={`${inputClass} font-mono text-sm`}
              placeholder="可选"
              value={form.quotaRegisterNumber}
              onChange={(e) => setForm((f) => ({ ...f, quotaRegisterNumber: e.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Myanmar Description">
              <textarea
                rows={2}
                className={`${inputClass} resize-y leading-relaxed ${COMPANY_MM_FONT}`}
                placeholder="可选；来自批文草稿时会自动填入摘要"
                value={form.quotaMyanmarDescription}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quotaMyanmarDescription: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="关联客户">
            <select
              className={inputClass}
              value={form.clientId ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, clientId: e.target.value ? e.target.value : null }))
              }
            >
              <option value="">未选择</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="关联报关报告单">
            <select
              className={inputClass}
              value={form.relatedDeclarationId ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  relatedDeclarationId: e.target.value ? e.target.value : null,
                }))
              }
            >
              <option value="">未关联</option>
              {declarations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.referenceNo} · {d.blNumber}
                </option>
              ))}
            </select>
          </Field>
          <Field label="金额（缅币）">
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={`${inputClass} pr-14 font-mono`}
                placeholder="例如 10,000,000"
                value={formatMmkDigitStringForInput(
                  amountMmkStr,
                  amountMmkFocused,
                  MMK_GENERAL_INPUT_MAX_DIGITS
                )}
                onFocus={() => setAmountMmkFocused(true)}
                onBlur={() => setAmountMmkFocused(false)}
                onChange={(e) =>
                  setAmountMmkStr(
                    stripMmkDigitString(e.target.value, MMK_GENERAL_INPUT_MAX_DIGITS)
                  )
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-shell-muted">
                MMK
              </span>
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="备注">
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-shell-border pt-4">
          <button type="button" className={btnGhost} onClick={() => setOpen(false)}>
            取消
          </button>
          {editingId && (
            <button
              type="button"
              className={btnDanger}
              onClick={() => {
                if (confirm("确定删除？删除后无法恢复。")) {
                  removeFinance(editingId);
                  setOpen(false);
                }
              }}
            >
              删除
            </button>
          )}
          <button type="button" className={btnPrimary} onClick={save}>
            保存
          </button>
        </div>
      </Modal>
    </div>
  );
}

function currentMonthYmString(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftPersonalMonthYm(ym: string, delta: number): string {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return currentMonthYmString();
  }
  const d = new Date(y, m - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function PersonalFinancePanel() {
  const personalFinance = useStore((s) => s.personalFinance);
  const addPersonalFinance = useStore((s) => s.addPersonalFinance);
  const updatePersonalFinance = useStore((s) => s.updatePersonalFinance);
  const removePersonalFinance = useStore((s) => s.removePersonalFinance);

  const [scope, setScope] = useState<"month" | "all">("month");
  const [monthYm, setMonthYm] = useState(() => new Date().toISOString().slice(0, 7));

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountMmkStr, setAmountMmkStr] = useState("");
  const [amountMmkFocused, setAmountMmkFocused] = useState(false);
  const [form, setForm] = useState({
    type: "expense" as TxType,
    category: personalExpenseCategories[0],
    quotaRegisterNumber: "",
    amountUsd: 0,
    description: "",
    occurredAt: new Date().toISOString().slice(0, 10),
  });

  const filtered = useMemo(() => {
    let rows = personalFinance;
    if (scope === "month") {
      rows = rows.filter((r) => r.occurredAt.slice(0, 7) === monthYm);
    }
    return [...rows].sort((a, b) =>
      `${b.occurredAt}${b.updatedAt}`.localeCompare(`${a.occurredAt}${a.updatedAt}`)
    );
  }, [personalFinance, scope, monthYm]);

  const personalTotals = useMemo(() => {
    let inc = 0,
      exp = 0,
      incUsd = 0,
      expUsd = 0;
    for (const r of filtered) {
      if (r.type === "income") {
        inc += r.amountMmk;
        incUsd += r.amountUsd;
      } else {
        exp += r.amountMmk;
        expUsd += r.amountUsd;
      }
    }
    return { inc, exp, incUsd, expUsd, balance: inc - exp };
  }, [filtered]);

  function openNewPersonal() {
    setEditingId(null);
    setForm({
      type: "expense",
      category: personalExpenseCategories[0],
      quotaRegisterNumber: "",
      amountUsd: 0,
      description: "",
      occurredAt: new Date().toISOString().slice(0, 10),
    });
    setAmountMmkStr("");
    setModalOpen(true);
  }

  function openEditPersonal(r: PersonalFinanceRecord) {
    setEditingId(r.id);
    setForm({
      type: r.type,
      category: r.category,
      quotaRegisterNumber: r.quotaRegisterNumber?.trim() ?? "",
      amountUsd: r.amountUsd,
      description: r.description,
      occurredAt: r.occurredAt.slice(0, 10),
    });
    setAmountMmkStr(mmkIntToDigitInput(r.amountMmk));
    setModalOpen(true);
  }

  function savePersonal() {
    const amountMmk = parseMmkIntString(amountMmkStr, MMK_GENERAL_INPUT_MAX_DIGITS);
    const amountUsd = Number.isFinite(form.amountUsd) ? Math.max(0, form.amountUsd) : 0;
    if (amountMmk <= 0 && amountUsd <= 0) {
      window.alert("请至少填写一项：缅币金额大于 0，或美元备忘大于 0。");
      return;
    }
    const payload = {
      type: form.type,
      category: form.category,
      quotaRegisterNumber: form.quotaRegisterNumber.trim() || null,
      amountMmk,
      amountUsd,
      description: form.description.trim(),
      occurredAt: form.occurredAt,
    };
    if (editingId) updatePersonalFinance(editingId, payload);
    else addPersonalFinance(payload);
    setModalOpen(false);
  }

  const catOptions =
    form.type === "income" ? personalIncomeCategories : personalExpenseCategories;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-shell-border bg-shell-card/95 px-4 py-4 shadow-lg shadow-black/25 ring-1 ring-white/[0.05] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">
            查看范围
          </span>
          <select
            className={`${inputClass} w-auto min-w-[7.5rem] py-2 text-xs`}
            value={scope}
            onChange={(e) => setScope(e.target.value as "month" | "all")}
          >
            <option value="month">按月份</option>
            <option value="all">全部记录</option>
          </select>
          {scope === "month" ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="rounded-lg border border-white/12 bg-white/[0.05] p-2 text-shell-muted transition hover:bg-white/[0.09] hover:text-white"
                aria-label="上一月"
                onClick={() => setMonthYm((y) => shiftPersonalMonthYm(y, -1))}
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <input
                type="month"
                className={`${inputClass} max-w-[11rem] py-2 font-mono text-xs`}
                value={monthYm}
                onChange={(e) => setMonthYm(e.target.value)}
              />
              <button
                type="button"
                className="rounded-lg border border-white/12 bg-white/[0.05] p-2 text-shell-muted transition hover:bg-white/[0.09] hover:text-white"
                aria-label="下一月"
                onClick={() => setMonthYm((y) => shiftPersonalMonthYm(y, 1))}
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={`${btnGhost} shrink-0 border-violet-500/25 px-3 py-2 text-xs text-violet-100 hover:bg-violet-500/15`}
                onClick={() => setMonthYm(currentMonthYmString())}
              >
                本月
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={`${btnPrimary} inline-flex items-center justify-center gap-2 shadow-lg shadow-violet-950/40`}
          onClick={openNewPersonal}
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          记一笔
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] via-[#0f172a]/80 to-[#0c1426] p-5 shadow-inner shadow-black/30 ring-1 ring-emerald-500/15">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">
            收入（缅币）
          </div>
          <div className="mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight text-emerald-50">
            {fmtMmk(personalTotals.inc)}
          </div>
          {personalTotals.incUsd > 0 ? (
            <div className="mt-2 font-mono text-[12px] text-emerald-200/80">
              备忘合计 {fmtUsd(personalTotals.incUsd)}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-gradient-to-br from-rose-500/[0.08] via-[#0f172a]/80 to-[#0c1426] p-5 shadow-inner shadow-black/30 ring-1 ring-rose-500/15">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-200/90">
            支出（缅币）
          </div>
          <div className="mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight text-rose-50">
            {fmtMmk(personalTotals.exp)}
          </div>
          {personalTotals.expUsd > 0 ? (
            <div className="mt-2 font-mono text-[12px] text-rose-200/75">
              备忘合计 {fmtUsd(personalTotals.expUsd)}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-600/[0.12] via-[#0f172a]/85 to-[#0c1426] p-5 shadow-inner shadow-black/30 ring-1 ring-violet-400/20">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-100/95">
            结余（收入 − 支出）
          </div>
          <div
            className={`mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight ${personalTotals.balance >= 0 ? "text-violet-50" : "text-amber-200"}`}
          >
            {fmtMmk(personalTotals.balance)}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px] text-shell-muted">
            <span>{scope === "month" ? monthYm : "全部月份"}</span>
            <span className="text-shell-muted/55">·</span>
            <span className="tabular-nums">{filtered.length} 笔</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-card shadow-xl shadow-black/25 ring-1 ring-white/[0.04]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/55">
                <th className="px-4 py-3 font-medium">日期</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">类别</th>
                <th className="px-4 py-3 font-medium">Register No.</th>
                <th className="px-4 py-3 font-medium">缅币</th>
                <th className="px-4 py-3 font-medium">美元</th>
                <th className="px-4 py-3 font-medium">备注</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
                      <Wallet2 className="h-14 w-14 text-violet-400/20" strokeWidth={1.15} />
                      <div className="text-center">
                        <p className="text-sm font-medium text-white">暂无记录</p>
                        <p className="mt-1 max-w-xs text-xs leading-relaxed text-shell-muted">
                          {scope === "month"
                            ? `${monthYm} 尚无收支，点击下方按钮开始记账。`
                            : "还没有任何个人流水，可先「记一笔」。"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`${btnPrimary} inline-flex items-center gap-2 text-sm`}
                        onClick={openNewPersonal}
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.25} />
                        记一笔
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-shell-border/65 transition hover:bg-white/[0.04] ${r.type === "income" ? "bg-emerald-500/[0.025]" : "bg-rose-500/[0.025]"}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-shell-muted">
                      {r.occurredAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.type === "income"
                            ? "inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30"
                            : "inline-flex rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-400/30"
                        }
                      >
                        {r.type === "income" ? "收入" : "支出"}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-xs" title={r.category}>
                      {r.category}
                    </td>
                    <td
                      className="max-w-[120px] truncate px-4 py-3 font-mono text-xs tabular-nums text-shell-muted"
                      title={r.quotaRegisterNumber?.trim() || undefined}
                    >
                      {r.quotaRegisterNumber?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm tabular-nums text-white">
                      {fmtMmk(r.amountMmk)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-shell-muted">
                      {r.amountUsd ? fmtUsd(r.amountUsd) : "—"}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-4 py-3 text-xs text-shell-muted"
                      title={r.description}
                    >
                      {r.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      <button
                        type="button"
                        className="mr-3 text-sky-300 hover:text-sky-200 hover:underline"
                        onClick={() => openEditPersonal(r)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="text-red-300 hover:text-red-200 hover:underline"
                        onClick={() =>
                          confirm("删除这条个人财务记录？") && removePersonalFinance(r.id)
                        }
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Modal
        title={editingId ? "编辑个人收支" : "新建个人收支"}
        open={modalOpen}
        wide
        onClose={() => setModalOpen(false)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="收支类型">
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as TxType;
                setForm((f) => ({
                  ...f,
                  type,
                  category:
                    type === "income" ? personalIncomeCategories[0] : personalExpenseCategories[0],
                }));
              }}
            >
              <option value="income">收入</option>
              <option value="expense">支出</option>
            </select>
          </Field>
          <Field label="发生日期">
            <input
              type="date"
              className={inputClass}
              value={form.occurredAt}
              onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))}
            />
          </Field>
          <Field label="类别">
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {!catOptions.includes(form.category) ? (
                <option value={form.category}>{form.category}</option>
              ) : null}
              {catOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Register No.">
            <input
              className={`${inputClass} font-mono text-sm`}
              placeholder="可选；与进口指标草稿一致"
              value={form.quotaRegisterNumber}
              onChange={(e) => setForm((f) => ({ ...f, quotaRegisterNumber: e.target.value }))}
            />
          </Field>
          <Field label="金额（缅币）">
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={`${inputClass} pr-14 font-mono`}
                placeholder="例如 50,000"
                value={formatMmkDigitStringForInput(
                  amountMmkStr,
                  amountMmkFocused,
                  MMK_GENERAL_INPUT_MAX_DIGITS
                )}
                onFocus={() => setAmountMmkFocused(true)}
                onBlur={() => setAmountMmkFocused(false)}
                onChange={(e) =>
                  setAmountMmkStr(
                    stripMmkDigitString(e.target.value, MMK_GENERAL_INPUT_MAX_DIGITS)
                  )
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-shell-muted">
                MMK
              </span>
            </div>
          </Field>
          <Field label="美元（可选备忘）">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={form.amountUsd || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, amountUsd: Number(e.target.value) || 0 }))
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="备注">
              <textarea
                rows={2}
                className={`${inputClass} resize-y leading-relaxed`}
                placeholder="例如：午饭、打车回住处…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-shell-border pt-4">
          <button type="button" className={btnGhost} onClick={() => setModalOpen(false)}>
            取消
          </button>
          {editingId ? (
            <button
              type="button"
              className={btnDanger}
              onClick={() => {
                if (confirm("确定删除？删除后无法恢复。")) {
                  removePersonalFinance(editingId);
                  setModalOpen(false);
                }
              }}
            >
              删除
            </button>
          ) : null}
          <button type="button" className={btnPrimary} onClick={savePersonal}>
            保存
          </button>
        </div>
      </Modal>
    </div>
  );
}

function MiniStat({
  title,
  value,
  tone,
  hint,
}: {
  title: string;
  value: string;
  tone: "emerald" | "rose" | "sky" | "amber" | "teal" | "cyan";
  hint?: string;
}) {
  const ring =
    tone === "emerald"
      ? "border-emerald-500/30"
      : tone === "rose"
        ? "border-rose-500/30"
        : tone === "sky"
          ? "border-sky-500/30"
          : tone === "teal"
            ? "border-teal-500/30"
            : tone === "cyan"
              ? "border-cyan-500/30"
              : "border-amber-500/30";
  return (
    <div className={`rounded-xl border bg-shell-card p-4 ${ring}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-shell-muted">{title}</div>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-shell-muted">{hint}</p> : null}
      <div className="mt-2 text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}
