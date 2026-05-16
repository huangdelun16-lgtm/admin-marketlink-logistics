import { useMemo, useState } from "react";
import type { Client } from "@/types";
import { useStore } from "@/lib/store";
import { Modal, Field, inputClass, btnPrimary, btnGhost, btnDanger } from "@/components/Modal";

export function ClientsPage() {
  const clients = useStore((s) => s.clients);
  const addClient = useStore((s) => s.addClient);
  const updateClient = useStore((s) => s.updateClient);
  const removeClient = useStore((s) => s.removeClient);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    address: "",
    tinOrRegNo: "",
    notes: "",
  });

  const sorted = useMemo(
    () => [...clients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [clients]
  );

  function openNew() {
    setEditingId(null);
    setForm({
      name: "",
      company: "",
      phone: "",
      email: "",
      address: "",
      tinOrRegNo: "",
      notes: "",
    });
    setOpen(true);
  }

  function openEdit(c: Client) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      company: c.company,
      phone: c.phone,
      email: c.email,
      address: c.address,
      tinOrRegNo: c.tinOrRegNo,
      notes: c.notes,
    });
    setOpen(true);
  }

  function save() {
    if (!form.company.trim() && !form.name.trim()) return;
    if (editingId) updateClient(editingId, form);
    else addClient(form);
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">客户档案</h1>
          <p className="mt-1 text-sm text-shell-muted">
            保存进出口货主与对接人信息，报关单与财务流水可关联到此。
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={openNew}>
          新建客户
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs uppercase text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/50">
                <th className="px-4 py-3 font-medium">公司</th>
                <th className="px-4 py-3 font-medium">联系人</th>
                <th className="px-4 py-3 font-medium">电话</th>
                <th className="px-4 py-3 font-medium">邮箱</th>
                <th className="px-4 py-3 font-medium">地址</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-shell-muted">
                    暂无客户。
                  </td>
                </tr>
              ) : (
                sorted.map((c) => (
                  <tr key={c.id} className="border-b border-shell-border/80 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white">{c.company || "—"}</td>
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.phone}</td>
                    <td className="px-4 py-3 text-shell-muted">{c.email}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-shell-muted" title={c.address}>
                      {c.address}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-2 text-blue-300 hover:underline"
                        onClick={() => openEdit(c)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="text-red-300 hover:underline"
                        onClick={() =>
                          confirm(
                            "删除客户将解除报关单与流水上的关联，删除后无法恢复，确定？"
                          ) && removeClient(c.id)
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

      <Modal title={editingId ? "编辑客户" : "新建客户"} open={open} wide onClose={() => setOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="公司名称">
            <input
              className={inputClass}
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
          </Field>
          <Field label="联系人">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
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
          <Field label="税号 / 注册号">
            <input
              className={inputClass}
              value={form.tinOrRegNo}
              onChange={(e) => setForm((f) => ({ ...f, tinOrRegNo: e.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="地址">
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="备注">
              <textarea
                rows={3}
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
                  removeClient(editingId);
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
