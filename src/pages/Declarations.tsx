import { useMemo, useState } from "react";
import type { CustomsDeclaration, DeclarationStatus } from "@/types";
import { useStore } from "@/lib/store";
import { declarationStatusLabel, fmtUsd } from "@/lib/labels";
import { Modal, Field, inputClass, btnPrimary, btnGhost, btnDanger } from "@/components/Modal";

const emptyForm = (): Omit<CustomsDeclaration, "id" | "createdAt" | "updatedAt"> => ({
  referenceNo: "",
  clientId: null,
  direction: "import",
  blNumber: "",
  containerNos: "",
  hsCodes: "",
  goodsDescription: "",
  port: "仰光港",
  declaredValueUsd: 0,
  dutyEstimateUsd: 0,
  status: "draft",
  submittedAt: null,
  clearedAt: null,
  notes: "",
});

export function DeclarationsPage() {
  const clients = useStore((s) => s.clients);
  const declarations = useStore((s) => s.declarations);
  const addDeclaration = useStore((s) => s.addDeclaration);
  const updateDeclaration = useStore((s) => s.updateDeclaration);
  const removeDeclaration = useStore((s) => s.removeDeclaration);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [q, setQ] = useState("");

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.company || c.name])),
    [clients]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return declarations;
    return declarations.filter(
      (d) =>
        d.referenceNo.toLowerCase().includes(s) ||
        d.blNumber.toLowerCase().includes(s) ||
        d.goodsDescription.toLowerCase().includes(s) ||
        d.hsCodes.toLowerCase().includes(s)
    );
  }, [declarations, q]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [filtered]
  );

  function openNew() {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      referenceNo: `DEC-${new Date().getFullYear()}-${String(declarations.length + 1).padStart(4, "0")}`,
    });
    setOpen(true);
  }

  function openEdit(d: CustomsDeclaration) {
    setEditingId(d.id);
    setForm({
      referenceNo: d.referenceNo,
      clientId: d.clientId,
      direction: d.direction,
      blNumber: d.blNumber,
      containerNos: d.containerNos,
      hsCodes: d.hsCodes,
      goodsDescription: d.goodsDescription,
      port: d.port,
      declaredValueUsd: d.declaredValueUsd,
      dutyEstimateUsd: d.dutyEstimateUsd,
      status: d.status,
      submittedAt: d.submittedAt,
      clearedAt: d.clearedAt,
      notes: d.notes,
    });
    setOpen(true);
  }

  function save() {
    if (!form.referenceNo.trim()) return;
    if (editingId) updateDeclaration(editingId, form);
    else addDeclaration(form);
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">报关报告单</h1>
          <p className="mt-1 text-sm text-shell-muted">
            记录进出口报关台账：提单、集装箱、HS 编码、申报货值与关税预估、状态流转。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索编号 / 提单 / 品名 / HS…"
            className={`${inputClass} max-w-xs`}
          />
          <button type="button" className={btnPrimary} onClick={openNew}>
            新建报告单
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="text-xs uppercase text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/50">
                <th className="px-4 py-3 font-medium">编号</th>
                <th className="px-4 py-3 font-medium">客户</th>
                <th className="px-4 py-3 font-medium">进/出口</th>
                <th className="px-4 py-3 font-medium">提单号</th>
                <th className="px-4 py-3 font-medium">口岸</th>
                <th className="px-4 py-3 font-medium">申报货值</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-shell-muted">
                    暂无记录。
                  </td>
                </tr>
              ) : (
                sorted.map((d) => (
                  <tr key={d.id} className="border-b border-shell-border/80 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-blue-200">{d.referenceNo}</td>
                    <td className="px-4 py-3">
                      {d.clientId ? clientMap[d.clientId] ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-3">{d.direction === "import" ? "进口" : "出口"}</td>
                    <td className="px-4 py-3">{d.blNumber}</td>
                    <td className="px-4 py-3">{d.port}</td>
                    <td className="px-4 py-3">{fmtUsd(d.declaredValueUsd)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs">
                        {declarationStatusLabel[d.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="mr-2 text-blue-300 hover:underline" onClick={() => openEdit(d)}>
                        编辑
                      </button>
                      <button
                        type="button"
                        className="text-red-300 hover:underline"
                        onClick={() => {
                          if (
                            confirm(
                              "确定删除该报告单？关联财务与物流将解除关联，删除后无法恢复。"
                            )
                          )
                            removeDeclaration(d.id);
                        }}
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
        title={editingId ? "编辑报关报告单" : "新建报关报告单"}
        open={open}
        wide
        onClose={() => setOpen(false)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="内部编号 *">
            <input
              className={inputClass}
              value={form.referenceNo}
              onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
            />
          </Field>
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
          <Field label="进出口">
            <select
              className={inputClass}
              value={form.direction}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  direction: e.target.value as "import" | "export",
                }))
              }
            >
              <option value="import">进口</option>
              <option value="export">出口</option>
            </select>
          </Field>
          <Field label="报关状态">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as DeclarationStatus }))
              }
            >
              {(Object.keys(declarationStatusLabel) as DeclarationStatus[]).map((k) => (
                <option key={k} value={k}>
                  {declarationStatusLabel[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="提单号 / BL">
            <input
              className={inputClass}
              value={form.blNumber}
              onChange={(e) => setForm((f) => ({ ...f, blNumber: e.target.value }))}
            />
          </Field>
          <Field label="集装箱号（可多行逗号分隔）">
            <input
              className={inputClass}
              value={form.containerNos}
              onChange={(e) => setForm((f) => ({ ...f, containerNos: e.target.value }))}
            />
          </Field>
          <Field label="口岸 / 港口">
            <input
              className={inputClass}
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
            />
          </Field>
          <Field label="HS 编码">
            <input
              className={inputClass}
              value={form.hsCodes}
              onChange={(e) => setForm((f) => ({ ...f, hsCodes: e.target.value }))}
            />
          </Field>
          <Field label="申报货值（美元）">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={form.declaredValueUsd}
              onChange={(e) =>
                setForm((f) => ({ ...f, declaredValueUsd: Number(e.target.value) || 0 }))
              }
            />
          </Field>
          <Field label="关税预估（美元）">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={form.dutyEstimateUsd}
              onChange={(e) =>
                setForm((f) => ({ ...f, dutyEstimateUsd: Number(e.target.value) || 0 }))
              }
            />
          </Field>
          <Field label="提交海关日期">
            <input
              type="date"
              className={inputClass}
              value={form.submittedAt ? form.submittedAt.slice(0, 10) : ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  submittedAt: e.target.value ? `${e.target.value}T00:00:00.000Z` : null,
                }))
              }
            />
          </Field>
          <Field label="放行日期">
            <input
              type="date"
              className={inputClass}
              value={form.clearedAt ? form.clearedAt.slice(0, 10) : ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  clearedAt: e.target.value ? `${e.target.value}T00:00:00.000Z` : null,
                }))
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="品名 / 货物描述">
              <textarea
                rows={3}
                className={inputClass}
                value={form.goodsDescription}
                onChange={(e) => setForm((f) => ({ ...f, goodsDescription: e.target.value }))}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="备注">
              <textarea
                rows={2}
                className={inputClass}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
                  removeDeclaration(editingId);
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
