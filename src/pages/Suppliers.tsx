import { useMemo, useState } from "react";
import type { Supplier } from "@/types";
import { useStore } from "@/lib/store";
import { Modal, Field, inputClass, btnPrimary, btnGhost, btnDanger } from "@/components/Modal";

const servicePresets = ["车队陆运", "码头堆场", "船代", "检验机构", "仓储", "装卸劳务", "其它"];

export function SuppliersPage() {
  const suppliers = useStore((s) => s.suppliers);
  const addSupplier = useStore((s) => s.addSupplier);
  const updateSupplier = useStore((s) => s.updateSupplier);
  const removeSupplier = useStore((s) => s.removeSupplier);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    serviceType: servicePresets[0],
    phone: "",
    email: "",
    notes: "",
  });

  const sorted = useMemo(
    () => [...suppliers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [suppliers]
  );

  function openNew() {
    setEditingId(null);
    setForm({ name: "", serviceType: servicePresets[0], phone: "", email: "", notes: "" });
    setOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      serviceType: s.serviceType,
      phone: s.phone,
      email: s.email,
      notes: s.notes,
    });
    setOpen(true);
  }

  function save() {
    if (!form.name.trim()) return;
    if (editingId) updateSupplier(editingId, form);
    else addSupplier(form);
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">服务商 / 供应商</h1>
          <p className="mt-1 text-sm text-shell-muted">
            记录拖车、堆场、船代、检验等合作方，便于对账与联络。
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={openNew}>
          新建服务商
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/50">
                <th className="px-4 py-3 font-medium">名称</th>
                <th className="px-4 py-3 font-medium">服务类型</th>
                <th className="px-4 py-3 font-medium">电话</th>
                <th className="px-4 py-3 font-medium">邮箱</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-shell-muted">
                    暂无服务商。
                  </td>
                </tr>
              ) : (
                sorted.map((s) => (
                  <tr key={s.id} className="border-b border-shell-border/80 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                    <td className="px-4 py-3">{s.serviceType}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.phone}</td>
                    <td className="px-4 py-3 text-shell-muted">{s.email}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-2 text-blue-300 hover:underline"
                        onClick={() => openEdit(s)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="text-red-300 hover:underline"
                        onClick={() =>
                          confirm("删除该服务商？删除后无法恢复。") && removeSupplier(s.id)
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

      <Modal title={editingId ? "编辑服务商" : "新建服务商"} open={open} onClose={() => setOpen(false)}>
        <div className="grid gap-4">
          <Field label="名称 *">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="服务类型">
            <select
              className={inputClass}
              value={form.serviceType}
              onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
            >
              {servicePresets.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <Field label="电话">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>
          <Field label="邮箱">
            <input
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label="备注">
            <textarea
              rows={3}
              className={inputClass}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
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
                  removeSupplier(editingId);
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
