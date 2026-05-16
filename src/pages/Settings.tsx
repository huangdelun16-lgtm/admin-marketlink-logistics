import { useRef, useState } from "react";
import { useStore, migrateImportQuotaRecord, migrateExportQuotaRecord, normalizePersonalFinanceRecord } from "@/lib/store";
import { Field, inputClass, btnPrimary, btnGhost, btnDanger } from "@/components/Modal";
import type {
  Client,
  CustomsDeclaration,
  DocumentFile,
  FinanceRecord,
  PersonalFinanceRecord,
  ImportQuotaIndicator,
  LogisticsShipment,
  Supplier,
  TodoItem,
} from "@/types";

type Snapshot = {
  version: 3;
  exportedAt: string;
  companyName: string;
  declarations: CustomsDeclaration[];
  finance: FinanceRecord[];
  personalFinance: PersonalFinanceRecord[];
  shipments: LogisticsShipment[];
  clients: Client[];
  suppliers: Supplier[];
  documents: DocumentFile[];
  todos: TodoItem[];
  importIndicators: ImportQuotaIndicator[];
  exportIndicators: ImportQuotaIndicator[];
};

export function SettingsPage() {
  const companyName = useStore((s) => s.companyName);
  const setCompanyName = useStore((s) => s.setCompanyName);
  const seedDemo = useStore((s) => s.seedDemo);
  const appendDemoImportIndicators = useStore((s) => s.appendDemoImportIndicators);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function buildSnapshot(): Snapshot {
    const s = useStore.getState();
    return {
      version: 3,
      exportedAt: new Date().toISOString(),
      companyName: s.companyName,
      declarations: s.declarations,
      finance: s.finance,
      personalFinance: s.personalFinance,
      shipments: s.shipments,
      clients: s.clients,
      suppliers: s.suppliers,
      documents: s.documents,
      todos: s.todos,
      importIndicators: s.importIndicators,
      exportIndicators: s.exportIndicators,
    };
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(buildSnapshot(), null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `customs-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("已导出备份文件。");
  }

  function importJson(text: string) {
    const parsed = JSON.parse(text) as Partial<Snapshot> & { version?: number };
    if (!parsed || typeof parsed !== "object") throw new Error("格式无效");
    useStore.setState({
      companyName: typeof parsed.companyName === "string" ? parsed.companyName : companyName,
      declarations: Array.isArray(parsed.declarations) ? parsed.declarations : [],
      finance: Array.isArray(parsed.finance) ? parsed.finance : [],
      personalFinance: Array.isArray(parsed.personalFinance)
        ? parsed.personalFinance
            .map(normalizePersonalFinanceRecord)
            .filter((row): row is PersonalFinanceRecord => row !== null)
        : [],
      shipments: Array.isArray(parsed.shipments) ? parsed.shipments : [],
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      importIndicators: Array.isArray(parsed.importIndicators)
        ? parsed.importIndicators
            .map(migrateImportQuotaRecord)
            .filter((row): row is ImportQuotaIndicator => row !== null)
        : [],
      exportIndicators: Array.isArray(parsed.exportIndicators)
        ? parsed.exportIndicators
            .map(migrateExportQuotaRecord)
            .filter((row): row is ImportQuotaIndicator => row !== null)
        : [],
    });
    useStore.getState().reconcileFinanceWithImportDrafts();
    setMsg("已从备份恢复数据。");
  }

  function clearAll() {
    useStore.setState({
      declarations: [],
      finance: [],
      shipments: [],
      clients: [],
      suppliers: [],
      documents: [],
      todos: [],
      importIndicators: [],
      exportIndicators: [],
      personalFinance: [],
    });
    setMsg("已清空业务数据（公司名称保留）。");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">设置与备份</h1>
        <p className="mt-1 text-sm text-shell-muted">
          当前为纯前端版本：数据保存在本机浏览器本地存储。更换电脑或清除浏览器数据前请导出 JSON 备份。
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {msg}
        </div>
      )}

      <section className="rounded-xl border border-shell-border bg-shell-card p-6">
        <h2 className="font-semibold text-white">公司显示名称</h2>
        <p className="mt-1 text-sm text-shell-muted">侧栏标题，可按贵司正式名称修改。</p>
        <div className="mt-4">
          <Field label="名称">
            <input
              className={inputClass}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-shell-border bg-shell-card p-6">
        <h2 className="font-semibold text-white">演示数据</h2>
        <p className="mt-1 text-sm text-shell-muted">
          若为空库，可一键生成示例报关单、财务与物流记录；同时会写入<strong className="text-white/90">两条演示进口指标草稿</strong>（与演示客户「示例贸易有限公司」对应）。
        </p>
        <button
          type="button"
          className={`${btnPrimary} mt-4`}
          onClick={() => {
            seedDemo();
            setMsg("若原先为空库，已写入演示数据（含进口草稿）；否则报关块保持不变。");
          }}
        >
          写入演示数据
        </button>
      </section>

      <section className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-6">
        <h2 className="font-semibold text-amber-100">进口指标草稿 · 演示恢复</h2>
        <p className="mt-1 text-sm text-shell-muted">
          <strong className="font-medium text-amber-50/95">真实草稿丢失后无法自动找回</strong>
          ，除非您曾在本页导出过 JSON 备份并用「从文件恢复」。下方按钮仅<strong className="text-white/90">追加</strong>
          两条<strong className="text-white/90">内置演示草稿</strong>（不覆盖已有记录），便于列表不为空；条目可随时在进口指标页删除或改写。
        </p>
        <button
          type="button"
          className={`${btnPrimary} mt-4 border border-amber-400/40 bg-amber-600/80 hover:bg-amber-500/90`}
          onClick={() => {
            appendDemoImportIndicators();
            setMsg("已追加 2 条演示进口指标草稿；可与演示客户名称对齐编辑。");
          }}
        >
          追加演示进口指标草稿（2 条）
        </button>
      </section>

      <section className="rounded-xl border border-shell-border bg-shell-card p-6">
        <h2 className="font-semibold text-white">备份 / 恢复</h2>
        <p className="mt-1 text-sm text-shell-muted">
          导出为 JSON 文件后妥善保管；恢复将覆盖当前系统中的同名模块数据。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={exportJson}>
            导出备份 (JSON)
          </button>
          <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
            从文件恢复…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const text = await f.text();
                importJson(text);
              } catch {
                setMsg("导入失败：文件无法解析。");
              }
            }}
          />
        </div>
      </section>

      <section className="rounded-xl border border-red-500/25 bg-red-500/5 p-6">
        <h2 className="font-semibold text-red-200">危险区域</h2>
        <p className="mt-1 text-sm text-shell-muted">
          清空所有业务数据（报关、进出口指标、财务流水、个人财务、物流、客户、服务商、单证、待办）。公司名称不会被清除。
        </p>
        <button
          type="button"
          className={`${btnDanger} mt-4`}
          onClick={() => {
            if (
              confirm(
                "确定清空全部业务数据？此操作不可撤销（除非您已有备份）。"
              )
            )
              clearAll();
          }}
        >
          清空业务数据
        </button>
      </section>
    </div>
  );
}
