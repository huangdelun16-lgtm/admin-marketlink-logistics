import { useMemo, useState } from "react";
import type { TodoItem } from "@/types";
import { useStore } from "@/lib/store";
import { Modal, Field, inputClass, btnPrimary, btnGhost, btnDanger } from "@/components/Modal";

export function TasksPage() {
  const todos = useStore((s) => s.todos);
  const declarations = useStore((s) => s.declarations);
  const addTodo = useStore((s) => s.addTodo);
  const updateTodo = useStore((s) => s.updateTodo);
  const removeTodo = useStore((s) => s.removeTodo);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    dueDate: new Date().toISOString().slice(0, 10),
    done: false,
    linkedDeclarationId: null as string | null,
  });

  const decMap = useMemo(
    () => Object.fromEntries(declarations.map((d) => [d.id, d.referenceNo])),
    [declarations]
  );

  const sorted = useMemo(() => {
    const rank = (t: TodoItem) => `${t.done ? "1" : "0"}-${t.dueDate}`;
    return [...todos].sort((a, b) => rank(a).localeCompare(rank(b)));
  }, [todos]);

  function openNew() {
    setEditingId(null);
    setForm({
      title: "",
      dueDate: new Date().toISOString().slice(0, 10),
      done: false,
      linkedDeclarationId: null,
    });
    setOpen(true);
  }

  function openEdit(t: TodoItem) {
    setEditingId(t.id);
    setForm({
      title: t.title,
      dueDate: t.dueDate.slice(0, 10),
      done: t.done,
      linkedDeclarationId: t.linkedDeclarationId,
    });
    setOpen(true);
  }

  function save() {
    if (!form.title.trim()) return;
    const payload = {
      ...form,
      dueDate: form.dueDate,
    };
    if (editingId) updateTodo(editingId, payload);
    else addTodo(payload);
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">待办事项</h1>
          <p className="mt-1 text-sm text-shell-muted">
            跟进查验补料、税金到账、卫生检疫等重点节点；可与报关报告单绑定。
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={openNew}>
          新建待办
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/50">
                <th className="px-4 py-3 font-medium">完成</th>
                <th className="px-4 py-3 font-medium">事项</th>
                <th className="px-4 py-3 font-medium">截止日期</th>
                <th className="px-4 py-3 font-medium">关联报告单</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-shell-muted">
                    暂无待办。
                  </td>
                </tr>
              ) : (
                sorted.map((t) => (
                  <tr key={t.id} className="border-b border-shell-border/80 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={(e) => updateTodo(t.id, { done: e.target.checked })}
                        className="h-4 w-4 rounded border-shell-border bg-[#0f172a]"
                      />
                    </td>
                    <td className={`px-4 py-3 ${t.done ? "text-shell-muted line-through" : "text-white"}`}>
                      {t.title}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{t.dueDate.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      {t.linkedDeclarationId ? decMap[t.linkedDeclarationId] ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-2 text-blue-300 hover:underline"
                        onClick={() => openEdit(t)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="text-red-300 hover:underline"
                        onClick={() =>
                          confirm("删除该待办？删除后无法恢复。") && removeTodo(t.id)
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

      <Modal title={editingId ? "编辑待办" : "新建待办"} open={open} onClose={() => setOpen(false)}>
        <div className="grid gap-4">
          <Field label="事项说明 *">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label="截止日期">
            <input
              type="date"
              className={inputClass}
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-shell-muted">
            <input
              type="checkbox"
              checked={form.done}
              onChange={(e) => setForm((f) => ({ ...f, done: e.target.checked }))}
              className="h-4 w-4 rounded border-shell-border bg-[#0f172a]"
            />
            标记为已完成
          </label>
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
                  removeTodo(editingId);
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
