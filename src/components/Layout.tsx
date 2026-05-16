import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ArrowUpFromLine,
  Building2,
  ChevronDown,
  ClipboardList,
  FileEdit,
  FileStack,
  Import,
  LayoutDashboard,
  ListTodo,
  Settings,
  Ship,
  Table,
  Users,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";

type SimpleNavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const mainNav: SimpleNavItem[] = [
  { to: "/", label: "工作台", icon: LayoutDashboard, end: true },
  { to: "/declarations", label: "报关报告单", icon: ClipboardList },
];

const tailNav: SimpleNavItem[] = [
  { to: "/export-indicators", label: "出口指标", icon: ArrowUpFromLine },
  { to: "/logistics", label: "物流跟踪", icon: Ship },
  { to: "/clients", label: "客户", icon: Users },
  { to: "/suppliers", label: "服务商/供应商", icon: Building2 },
  { to: "/documents", label: "单证档案", icon: FileStack },
  { to: "/tasks", label: "待办事项", icon: ListTodo },
  { to: "/settings", label: "设置与备份", icon: Settings },
];

function ImportIndicatorsNavGroup() {
  const location = useLocation();
  const onImportSection = location.pathname.startsWith("/import-indicators");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!onImportSection) setExpanded(false);
  }, [onImportSection]);

  const showSub = expanded || onImportSection;

  const subLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex items-center gap-2 rounded-lg py-1.5 pl-3 pr-2 text-sm transition-colors",
      isActive
        ? "bg-shell-accent/15 text-blue-200 ring-1 ring-shell-accent/40"
        : "text-shell-muted hover:bg-white/5 hover:text-white",
    ].join(" ");

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={showSub}
        className={[
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
          onImportSection
            ? "bg-shell-accent/15 text-blue-200 ring-1 ring-shell-accent/40"
            : "text-shell-muted hover:bg-white/5 hover:text-white",
        ].join(" ")}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${showSub ? "-rotate-180" : ""}`}
          aria-hidden
        />
        <Import className="h-4 w-4 shrink-0 opacity-90" />
        <span className="flex-1 text-left">进口指标</span>
      </button>
      {showSub ? (
        <div className="mb-0.5 ml-2 flex flex-col gap-0.5 border-l border-white/[0.08] pl-2">
          <NavLink to="/import-indicators/draft" className={subLinkClass}>
            <FileEdit className="h-3.5 w-3.5 shrink-0 opacity-90" />
            进口指标草稿
          </NavLink>
          <NavLink to="/import-indicators/price-table" className={subLinkClass}>
            <Table className="h-3.5 w-3.5 shrink-0 opacity-90" />
            进口价格表
          </NavLink>
        </div>
      ) : null}
    </div>
  );
}

function FinanceNavGroup() {
  const location = useLocation();
  const onFinanceSection = location.pathname.startsWith("/finance");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!onFinanceSection) setExpanded(false);
  }, [onFinanceSection]);

  const showSub = expanded || onFinanceSection;

  const subLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex items-center gap-2 rounded-lg py-1.5 pl-3 pr-2 text-sm transition-colors",
      isActive
        ? "bg-shell-accent/15 text-blue-200 ring-1 ring-shell-accent/40"
        : "text-shell-muted hover:bg-white/5 hover:text-white",
    ].join(" ");

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={showSub}
        className={[
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
          onFinanceSection
            ? "bg-shell-accent/15 text-blue-200 ring-1 ring-shell-accent/40"
            : "text-shell-muted hover:bg-white/5 hover:text-white",
        ].join(" ")}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${showSub ? "-rotate-180" : ""}`}
          aria-hidden
        />
        <Wallet className="h-4 w-4 shrink-0 opacity-90" />
        <span className="flex-1 text-left">财务</span>
      </button>
      {showSub ? (
        <div className="mb-0.5 ml-2 flex flex-col gap-0.5 border-l border-white/[0.08] pl-2">
          <NavLink to="/finance/company" className={subLinkClass}>
            <Building2 className="h-3.5 w-3.5 shrink-0 opacity-90" />
            公司流水
          </NavLink>
          <NavLink to="/finance/personal" className={subLinkClass}>
            <UserRound className="h-3.5 w-3.5 shrink-0 opacity-90" />
            私人流水
          </NavLink>
        </div>
      ) : null}
    </div>
  );
}

function NavRow({ to, label, icon: Icon, end }: SimpleNavItem): ReactNode {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-shell-accent/15 text-blue-200 ring-1 ring-shell-accent/40"
            : "text-shell-muted hover:bg-white/5 hover:text-white",
        ].join(" ")
      }
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      {label}
    </NavLink>
  );
}

export function Layout(): ReactNode {
  const companyName = useStore((s) => s.companyName);

  return (
    <div className="flex min-h-screen bg-shell-bg">
      <aside className="w-56 shrink-0 border-r border-shell-border bg-[#0e1628] px-3 py-6">
        <div className="mb-8 px-2">
          <div className="text-xs uppercase tracking-wider text-shell-muted">内部后台</div>
          <div className="mt-1 text-lg font-semibold leading-tight text-white">{companyName}</div>
        </div>
        <nav className="flex flex-col gap-1">
          {mainNav.map((item) => (
            <NavRow key={item.to} {...item} />
          ))}
          <ImportIndicatorsNavGroup />
          <FinanceNavGroup />
          {tailNav.map((item) => (
            <NavRow key={item.to} {...item} />
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
