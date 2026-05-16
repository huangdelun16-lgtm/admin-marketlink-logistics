import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/lib/store";
import { declarationStatusLabel, fmtMmk, fmtUsd } from "@/lib/labels";

export function DashboardPage() {
  const declarations = useStore((s) => s.declarations);
  const finance = useStore((s) => s.finance);
  const todos = useStore((s) => s.todos);
  const shipments = useStore((s) => s.shipments);

  const stats = useMemo(() => {
    const clearing = declarations.filter((d) => d.status === "clearing").length;
    const released = declarations.filter((d) => d.status === "released").length;
    const incomeMmk = finance.filter((f) => f.type === "income").reduce((a, f) => a + f.amountMmk, 0);
    const expenseMmk = finance.filter((f) => f.type === "expense").reduce((a, f) => a + f.amountMmk, 0);
    const openTodos = todos.filter((t) => !t.done).length;
    const inCustomsShip = shipments.filter((s) => s.status === "customs").length;
    return { clearing, released, incomeMmk, expenseMmk, openTodos, inCustomsShip };
  }, [declarations, finance, todos, shipments]);

  const recent = [...declarations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">工作台</h1>
        <p className="mt-1 text-sm text-shell-muted">
          报关进度、资金概况与待办一览。数据保存在本机浏览器，请及时在「设置与备份」导出存档。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="清关中报告单" value={String(stats.clearing)} hint="需跟进放行状态" />
        <StatCard title="本月累计收入（缅币）" value={fmtMmk(stats.incomeMmk)} hint="含全部已登记收入" />
        <StatCard title="本月累计支出（缅币）" value={fmtMmk(stats.expenseMmk)} hint="含税费与外包费用等" />
        <StatCard title="已放行" value={String(stats.released)} hint="历史完成票数" />
        <StatCard title="报关阶段物流" value={String(stats.inCustomsShip)} hint="状态为报关/待放行" />
        <StatCard title="未完成待办" value={String(stats.openTodos)} hint={<Link className="text-blue-300 underline" to="/tasks">前往处理</Link>} />
      </div>

      <div className="rounded-xl border border-shell-border bg-shell-card">
        <div className="flex items-center justify-between border-b border-shell-border px-5 py-4">
          <h2 className="font-semibold text-white">最近更新的报关报告单</h2>
          <Link to="/declarations" className="text-sm text-blue-300 hover:underline">
            查看全部
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-shell-muted">
              <tr className="border-b border-shell-border bg-[#0f172a]/50">
                <th className="px-5 py-3 font-medium">内部编号</th>
                <th className="px-5 py-3 font-medium">提单号</th>
                <th className="px-5 py-3 font-medium">口岸</th>
                <th className="px-5 py-3 font-medium">申报金额</th>
                <th className="px-5 py-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-shell-muted">
                    暂无数据。请在「报关报告单」新建，或在设置中加载演示数据。
                  </td>
                </tr>
              ) : (
                recent.map((d) => (
                  <tr key={d.id} className="border-b border-shell-border/80 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-mono text-blue-200">{d.referenceNo}</td>
                    <td className="px-5 py-3">{d.blNumber}</td>
                    <td className="px-5 py-3">{d.port}</td>
                    <td className="px-5 py-3">{fmtUsd(d.declaredValueUsd)}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs">
                        {declarationStatusLabel[d.status] ?? d.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-shell-border bg-shell-card p-5 shadow-inner">
      <div className="text-xs font-medium uppercase tracking-wide text-shell-muted">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-xs text-shell-muted">{hint}</div>
    </div>
  );
}
