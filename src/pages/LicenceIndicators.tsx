import { useStore } from "@/lib/store";
import { EXPORT_QUOTA_EXCEL_BRANDING } from "@/lib/exportImportIndicatorExcel";
import { QuotaIndicatorsPage } from "@/pages/QuotaIndicatorsPage";

/** 出口指标：表单字段与进口指标草稿一致，数据保存在 exportIndicators。 */
export function ExportIndicatorsPage() {
  const list = useStore((s) => s.exportIndicators);
  const addRec = useStore((s) => s.addExportIndicator);
  const updateRec = useStore((s) => s.updateExportIndicator);
  const removeRec = useStore((s) => s.removeExportIndicator);

  return (
    <QuotaIndicatorsPage
      pageTitle="出口指标"
      pageSubtitle="与进口指标草稿相同的台账结构（注册号、客户、商品明细、ED 日期与三期缅币款项），便于统一录入与导出。"
      modalTitleNew="新建出口指标"
      modalTitleEdit="编辑出口指标"
      excelBranding={EXPORT_QUOTA_EXCEL_BRANDING}
      list={list}
      addRec={addRec}
      updateRec={updateRec}
      removeRec={removeRec}
    />
  );
}
