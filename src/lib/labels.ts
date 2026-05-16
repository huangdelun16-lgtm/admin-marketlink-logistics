export function fmtMmk(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export const declarationStatusLabel: Record<string, string> = {
  draft: "草稿",
  submitted: "已申报",
  clearing: "清关中",
  released: "已放行",
  exception: "异常/查验",
};

export const shipmentStatusLabel: Record<string, string> = {
  booking: "订舱",
  in_transit: "在途",
  at_port: "到港",
  customs: "报关/待放行",
  delivered: "已交付",
};
