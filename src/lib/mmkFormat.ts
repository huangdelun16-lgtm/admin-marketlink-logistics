/** 批文三期等与整数缅币输入共用 */

export const MMK_QUOTA_INPUT_MAX_DIGITS = 15;
/** 财务流水等略宽裕上限 */
export const MMK_GENERAL_INPUT_MAX_DIGITS = 18;

/** 仅保留数字并限制位数（不含千位分隔符） */
export function stripMmkDigitString(raw: string, maxDigits: number): string {
  return raw.replace(/\D/g, "").slice(0, maxDigits);
}

/** 未聚焦：10,000,000；聚焦：连续数字便于改光标位置 */
export function formatMmkDigitStringForInput(
  digitsOnly: string,
  isFocused: boolean,
  maxDigits: number
): string {
  const d = stripMmkDigitString(digitsOnly, maxDigits);
  if (!d) return "";
  if (isFocused) return d;
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 数字串 → 安全整数（与批文三期 parseDeposit 一致） */
export function parseMmkIntString(raw: string, maxDigits: number): number {
  const s = stripMmkDigitString(raw, maxDigits);
  if (!s) return 0;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(n, Number.MAX_SAFE_INTEGER);
}

/** 已保存整数缅币 → 输入框 digit 串 */
export function mmkIntToDigitInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.min(Math.floor(Math.abs(n)), Number.MAX_SAFE_INTEGER));
}
