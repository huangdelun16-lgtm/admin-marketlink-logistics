import { useStore } from "@/lib/store";
import { IMPORT_QUOTA_EXCEL_BRANDING } from "@/lib/exportImportIndicatorExcel";
import { QuotaIndicatorsPage } from "@/pages/QuotaIndicatorsPage";

export function ImportIndicatorsPage() {
  const list = useStore((s) => s.importIndicators);
  const addRec = useStore((s) => s.addImportIndicator);
  const updateRec = useStore((s) => s.updateImportIndicator);
  const removeRec = useStore((s) => s.removeImportIndicator);

  return (
    <QuotaIndicatorsPage
      pageTitle="进口指标草稿"
      pageSubtitle="批文草稿台账：含客户名称；单笔可登记多条商品，每条在一张卡片内完成 HS、描述与计价。保存后的明细会汇总到「进口价格表」。列表「Myanmar Description」列可点击（多条时含「共 N 项」标签）查看 Cargo 明细。"
      modalTitleNew="新建进口指标草稿"
      modalTitleEdit="编辑进口指标草稿"
      excelBranding={IMPORT_QUOTA_EXCEL_BRANDING}
      list={list}
      addRec={addRec}
      updateRec={updateRec}
      removeRec={removeRec}
      listCargoSummaryEnabled
      primaryButtonLabel="新建草稿"
    />
  );
}
