import { Wallet2 } from "lucide-react";
import { PersonalFinancePanel } from "@/pages/Finance";

export function PersonalFinancePage() {
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/55 via-[#0f172a]/92 to-[#0c1426] px-6 py-6 shadow-xl shadow-black/25 ring-1 ring-violet-400/10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/35">
              <Wallet2 className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">私人流水</h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-shell-muted">
                个人日常收支台账，与报关业务数据隔离；默认按月份查看汇总，也可切换「全部记录」。缅币为主金额，美元栏可作外币备忘。
              </p>
            </div>
          </div>
        </div>
      </header>
      <PersonalFinancePanel />
    </div>
  );
}
