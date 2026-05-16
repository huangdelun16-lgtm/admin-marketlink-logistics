import { useMemo, useState } from "react";
import type { LogisticsShipment, ShipmentStatus } from "@/types";
import { useStore } from "@/lib/store";
import { shipmentStatusLabel } from "@/lib/labels";
import { Modal, Field, inputClass, btnPrimary, btnGhost, btnDanger } from "@/components/Modal";

export function LogisticsPage() {
  const shipments = useStore((s) => s.shipments);
  const declarations = useStore((s) => s.declarations);
  const addShipment = useStore((s) => s.addShipment);
  const updateShipment = useStore((s) => s.updateShipment);
  const removeShipment = useStore((s) => s.removeShipment);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    declarationId: null as string | null,
    carrier: "",
    vesselOrFlight: "",
    eta: "",
    etd: "",
    origin: "",
    destination: "仰光",
    trackingRef: "",
    status: "booking" as ShipmentStatus,
    notes: "",
  });

  const decMap = useMemo(
    () => Object.fromEntries(declarations.map((d) => [d.id, `${d.referenceNo} · ${d.blNumber}`])),
    [declarations]
  );

  const sorted = useMemo(
    () => [...shipments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [shipments]
  );

  function openNew() {
    setEditingId(null);
    setForm({
      declarationId: null,
      carrier: "",
      vesselOrFlight: "",
      eta: "",
      etd: "",
      origin: "",
      destination: "仰光",
      trackingRef: "",
      status: "booking",
      notes: "",
    });
    setOpen(true);
  }

  function openEdit(s: LogisticsShipment) {
    setEditingId(s.id);
    setForm({
      declarationId: s.declarationId,
      carrier: s.carrier,
      vesselOrFlight: s.vesselOrFlight,
      eta: s.eta.slice(0, 10),
      etd: s.etd.slice(0, 10),
      origin: s.origin,
      destination: s.destination,
      trackingRef: s.trackingRef,
      status: s.status,
      notes: s.notes,
    });
    setOpen(true);
  }

  function save() {
    const payload = {
      ...form,
      eta: form.eta ? `${form.eta}T00:00:00.000Z` : "",
      etd: form.etd ? `${form.etd}T00:00:00.000Z` : "",
    };
    if (editingId) updateShipment(editingId, payload);
    else addShipment(payload);
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">物流跟踪</h1>
          <p className="mt-1 text-sm text-shell-muted">
            船公司 / 航次、ETD/ETA、起运港目的港，可与报关报告单绑定便于协同。
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={openNew}>
          新建物流记录
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="text-xs uppercase text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/50">
                <th className="px-4 py-3 font-medium">承运人</th>
                <th className="px-4 py-3 font-medium">船名/航班</th>
                <th className="px-4 py-3 font-medium">路线</th>
                <th className="px-4 py-3 font-medium">ETD</th>
                <th className="px-4 py-3 font-medium">ETA</th>
                <th className="px-4 py-3 font-medium">跟踪号</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">报关单</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-shell-muted">
                    暂无物流记录。
                  </td>
                </tr>
              ) : (
                sorted.map((s) => (
                  <tr key={s.id} className="border-b border-shell-border/80 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">{s.carrier}</td>
                    <td className="px-4 py-3">{s.vesselOrFlight}</td>
                    <td className="px-4 py-3">
                      {s.origin} → {s.destination}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{s.etd ? s.etd.slice(0, 10) : "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{s.eta ? s.eta.slice(0, 10) : "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.trackingRef}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs">
                        {shipmentStatusLabel[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.declarationId ? decMap[s.declarationId] ?? "—" : "—"}
                    </td>
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
                          confirm("删除该物流记录？删除后无法恢复。") && removeShipment(s.id)
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
        title={editingId ? "编辑物流" : "新建物流"}
        open={open}
        wide
        onClose={() => setOpen(false)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="关联报关报告单">
            <select
              className={inputClass}
              value={form.declarationId ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  declarationId: e.target.value ? e.target.value : null,
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
          <Field label="运输状态">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as ShipmentStatus }))
              }
            >
              {(Object.keys(shipmentStatusLabel) as ShipmentStatus[]).map((k) => (
                <option key={k} value={k}>
                  {shipmentStatusLabel[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="承运人 / 船公司">
            <input
              className={inputClass}
              value={form.carrier}
              onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
            />
          </Field>
          <Field label="船名 / 航班号">
            <input
              className={inputClass}
              value={form.vesselOrFlight}
              onChange={(e) => setForm((f) => ({ ...f, vesselOrFlight: e.target.value }))}
            />
          </Field>
          <Field label="起运地">
            <input
              className={inputClass}
              value={form.origin}
              onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
            />
          </Field>
          <Field label="目的地">
            <input
              className={inputClass}
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
            />
          </Field>
          <Field label="ETD">
            <input
              type="date"
              className={inputClass}
              value={form.etd}
              onChange={(e) => setForm((f) => ({ ...f, etd: e.target.value }))}
            />
          </Field>
          <Field label="ETA">
            <input
              type="date"
              className={inputClass}
              value={form.eta}
              onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))}
            />
          </Field>
          <Field label="跟踪编号">
            <input
              className={inputClass}
              value={form.trackingRef}
              onChange={(e) => setForm((f) => ({ ...f, trackingRef: e.target.value }))}
            />
          </Field>
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
                  removeShipment(editingId);
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
