import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  subtitle,
  open,
  onClose,
  children,
  footer,
  wide,
  extraWide,
}: {
  title: string;
  subtitle?: ReactNode;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 固定在底部的操作区（不参与中间滚动） */
  footer?: ReactNode;
  wide?: boolean;
  /** 许可证等大表单 */
  extraWide?: boolean;
}) {
  if (!open) return null;
  const widthClass = extraWide ? "max-w-6xl" : wide ? "max-w-3xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[6px]">
      <div
        className={`flex max-h-[min(92vh,900px)] w-full flex-col overflow-hidden rounded-xl border border-shell-border bg-shell-card shadow-2xl shadow-black/40 ring-1 ring-white/[0.06] ${widthClass}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-shell-border bg-[#121a2e]/95 px-5 py-4 backdrop-blur-md">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
            {subtitle ? (
              <div className="mt-1.5 text-sm leading-snug text-shell-muted">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-shell-muted transition hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer != null ? (
          <footer className="shrink-0 border-t border-shell-border bg-[#0f1629]/95 px-5 py-4 backdrop-blur-md">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-shell-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-shell-border bg-[#0f172a] px-3 py-2 text-sm outline-none ring-blue-500/0 transition focus:border-shell-accent focus:ring-2 focus:ring-blue-500/30";

export const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-shell-accent px-4 py-2 text-sm font-medium text-white shadow hover:bg-shell-accentDim";

export const btnGhost =
  "inline-flex items-center justify-center rounded-lg border border-shell-border bg-transparent px-4 py-2 text-sm text-shell-muted hover:border-shell-muted hover:text-white";

export const btnDanger =
  "inline-flex items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20";
