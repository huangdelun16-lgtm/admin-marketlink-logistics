import { useMemo, useState } from "react";
import type { DocumentFile } from "@/types";
import { useStore } from "@/lib/store";
import { Modal, Field, inputClass, btnPrimary, btnGhost, btnDanger } from "@/components/Modal";

const docCategories = ["发票", "装箱单", "合同", "原产地证", "许可证", "熏蒸证", "保单", "委托书", "其它"];

export function DocumentsPage() {
  const documents = useStore((s) => s.documents);
  const declarations = useStore((s) => s.declarations);
  const addDocument = useStore((s) => s.addDocument);
  const updateDocument = useStore((s) => s.updateDocument);
  const removeDocument = useStore((s) => s.removeDocument);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: docCategories[0],
    linkedDeclarationId: null as string | null,
    remark: "",
  });

  const decMap = useMemo(
    () => Object.fromEntries(declarations.map((d) => [d.id, d.referenceNo])),
    [declarations]
  );

  const sorted = useMemo(
    () => [...documents].sort((a, b) => b.storedAt.localeCompare(a.storedAt)),
    [documents]
  );

  function openNew() {
    setEditingId(null);
    setForm({ title: "", category: docCategories[0], linkedDeclarationId: null, remark: "" });
    setOpen(true);
  }

  function openEdit(d: DocumentFile) {
    setEditingId(d.id);
    setForm({
      title: d.title,
      category: d.category,
      linkedDeclarationId: d.linkedDeclarationId,
      remark: d.remark,
    });
    setOpen(true);
  }

  function save() {
    if (!form.title.trim()) return;
    if (editingId) updateDocument(editingId, form);
    else addDocument(form);
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">单证档案</h1>
          <p className="mt-1 text-sm text-shell-muted">
            登记发票、装箱单、许可证等索引（当前版本为台账占位；后续可接入文件上传与扫描件存档）。
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={openNew}>
          登记单证
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/50">
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="px-4 py-3 font-medium">类别</th>
                <th className="px-4 py-3 font-medium">关联报告单</th>
                <th className="px-4 py-3 font-medium">登记时间</th>
                <th className="px-4 py-3 font-medium">备注</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-shell-muted">
                    暂无单证记录。
                  </td>
                </tr>
              ) : (
                sorted.map((d) => (
                  <tr key={d.id} className="border-b border-shell-border/80 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white">{d.title}</td>
                    <td className="px-4 py-3">{d.category}</td>
                    <td className="px-4 py-3">
                      {d.linkedDeclarationId ? decMap[d.linkedDeclarationId] ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-shell-muted">
                      {d.storedAt.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-shell-muted" title={d.remark}>
                      {d.remark}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-2 text-blue-300 hover:underline"
                        onClick={() => openEdit(d)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="text-red-300 hover:underline"
                        onClick={() =>
                          confirm("删除该记录？删除后无法恢复。") && removeDocument(d.id)
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

      <Modal title={editingId ? "编辑单证" : "登记单证"} open={open} wide onClose={() => setOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="标题 / 文件名 *">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label="类别">
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {docCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="关联报关报告单">
            <select
              className={inputClass}
              value={form.linkedDeclarationId ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  linkedDeclarationId: e.target.value ? e.target.value : null,
                }))
              }
            >
              <option value="">未关联</option>
              {declarations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.referenceNo}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="备注（柜号、抬头差异等）">
              <textarea
                rows={3}
                className={inputClass}
                value={form.remark}
                onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
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
                  removeDocument(editingId);
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
