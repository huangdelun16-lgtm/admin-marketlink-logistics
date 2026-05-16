import { Outlet } from "react-router-dom";

/** 嵌套路由壳：左栏「财务」下挂载公司流水与私人流水 */
export function FinanceOutlet() {
  return <Outlet />;
}
