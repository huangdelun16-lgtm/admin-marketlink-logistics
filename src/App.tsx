import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "@/pages/Dashboard";
import { DeclarationsPage } from "@/pages/Declarations";
import { CompanyFinancePage } from "@/pages/Finance";
import { FinanceOutlet } from "@/pages/FinanceOutlet";
import { PersonalFinancePage } from "@/pages/PersonalFinancePage";
import { LogisticsPage } from "@/pages/Logistics";
import { ClientsPage } from "@/pages/Clients";
import { SuppliersPage } from "@/pages/Suppliers";
import { DocumentsPage } from "@/pages/Documents";
import { TasksPage } from "@/pages/Tasks";
import { SettingsPage } from "@/pages/Settings";
import { ImportIndicatorsPage } from "@/pages/ImportIndicators";
import { ImportIndicatorsOutlet } from "@/pages/ImportIndicatorsOutlet";
import { ImportPriceTablePage } from "@/pages/ImportPriceTablePage";
import { ExportIndicatorsPage } from "@/pages/LicenceIndicators";

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="declarations" element={<DeclarationsPage />} />
          <Route path="import-indicators" element={<ImportIndicatorsOutlet />}>
            <Route index element={<Navigate to="draft" replace />} />
            <Route path="draft" element={<ImportIndicatorsPage />} />
            <Route path="price-table" element={<ImportPriceTablePage />} />
          </Route>
          <Route path="import-price-table" element={<Navigate to="/import-indicators/price-table" replace />} />
          <Route path="export-indicators" element={<ExportIndicatorsPage />} />
          <Route path="finance" element={<FinanceOutlet />}>
            <Route index element={<Navigate to="company" replace />} />
            <Route path="company" element={<CompanyFinancePage />} />
            <Route path="personal" element={<PersonalFinancePage />} />
          </Route>
          <Route path="logistics" element={<LogisticsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
