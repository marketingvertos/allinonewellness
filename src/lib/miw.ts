export const MIW_DEFAULT_FEE = 500;
export function miwEndDate(start: string) {
  return new Date(Date.parse(`${start}T00:00:00Z`) + 20 * 86400000).toISOString().slice(0, 10);
}
export function miwDay(start: string, today: string) {
  return Math.max(0, Math.min(21, Math.floor((Date.parse(today) - Date.parse(start)) / 86400000) + 1));
}
export function miwChange(start: number | null, latest: number | null) {
  return start == null || latest == null ? null : Math.round((latest - start) * 100) / 100;
}