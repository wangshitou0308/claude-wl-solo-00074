// 时间与时钟偏差工具：统一用“分钟数”表示一天内时刻，epoch ms 表示真实日期时间。

export const DAY_MIN = 24 * 60;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** 一天内分钟 -> "HH:MM"（24 小时制） */
export function hm(min: number): string {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** 24 小时制分钟 -> 12 小时制展示 "上午 6:30" */
export function hm12(min: number, withMeri = true): string {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h24 < 12 ? '上午' : '下午';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${withMeri ? ampm + ' ' : ''}${h12}:${pad2(mm)}`;
}

export function fmtClock(min: number, hour12: boolean): string {
  return hour12 ? hm12(min) : hm(min);
}

/** epoch -> "M月D日 HH:MM" */
export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fmtSpan(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}分钟`;
  if (r === 0) return `${h}小时`;
  return `${h}小时${r}分`;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 把“今天/明天某时刻（分钟）”结合基准 epoch 解析为绝对时间，自动跨午夜 */
export function atMinute(baseTs: number, minuteOfDay: number, dayOffset = 0): number {
  return startOfDay(baseTs) + dayOffset * DAY_MIN * 60000 + minuteOfDay * 60000;
}

/**
 * 解析用户填的希望开饭时刻。允许输入 24 小时制 "H:MM"；
 * 通过“跨日勾选 + 与现在比较”决定是今天还是明天。
 */
export function resolveFutureTime(
  baseTs: number,
  minuteOfDay: number,
  crossMidnight: boolean,
): number {
  const today = atMinute(baseTs, minuteOfDay, 0);
  if (crossMidnight) {
    return today <= baseTs ? today + DAY_MIN * 60000 : today + DAY_MIN * 60000;
  }
  // 未勾选跨日：若时刻已过，提示由上层处理；这里返回今天
  return today;
}

/** 计算两个 epoch 相差分钟（a - b），可负 */
export function diffMin(a: number, b: number): number {
  return Math.round((a - b) / 60000);
}

/** 计算屏显偏移（分钟）：屏显 - 真实。入参为两个“当前时刻”epoch */
export function clockOffsetMin(screenNow: number, realNow: number): number {
  // 只取一天内的差，避免登记日期错位；结果落在 (-720, 720]
  let d = diffMin(screenNow, realNow) % DAY_MIN;
  if (d <= -DAY_MIN / 2) d += DAY_MIN;
  if (d > DAY_MIN / 2) d -= DAY_MIN;
  return d;
}

/** 按粒度向下/向上取整到合法刻度 */
export function floorTo(v: number, step: number): number {
  return Math.floor(v / step) * step;
}
export function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}
