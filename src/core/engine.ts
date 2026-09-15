// 候选反算引擎：依据机型规则、机内钟偏差、开饭时间窗，枚举所有可行预约设定。
import type { Candidate, MachineProfile, Meaning } from './types';
import {
  DAY_MIN,
  diffMin,
  fmtClock,
  fmtSpan,
  hm,
  pad2,
} from './time';

export interface PlanInput {
  profile: MachineProfile;
  /** 真实现在 */
  realNow: number;
  /** 屏显偏移：屏显 - 真实（分钟）。校时选择“拨准机内钟”后传 0 */
  offsetMin: number;
  windowStart: number;
  windowEnd: number;
}

export interface PlanResult {
  candidates: Candidate[];
  /** 不可行原因（窗口本身无解时） */
  reasons: string[];
}

const MEANING_NAME: Record<Exclude<Meaning, 'unknown'>, string> = {
  finishAtClock: '预约完成时刻（几点煮好）',
  startAtClock: '开始时刻（几点开始煮）',
  delayFinishHours: '延后小时数（几小时后煮好）',
  delayStartHours: '延后小时数（几小时后开煮）',
};

export function meaningName(m: Exclude<Meaning, 'unknown'>): string {
  return MEANING_NAME[m];
}

function isClock(m: Exclude<Meaning, 'unknown'>): boolean {
  return m === 'finishAtClock' || m === 'startAtClock';
}

/** 延后类屏显：按粒度显示“小时”或“小时:分” */
function delayToken(spanMin: number, step: number): string {
  if (step % 60 === 0) return `${Math.round(spanMin / 60)}`;
  const h = Math.floor(spanMin / 60);
  return `${h}:${pad2(spanMin % 60)}`;
}

/**
 * 枚举可行候选。
 * 约定：
 *  - 时钟类含义：机内钟若有偏差，设定钟点要平移 offset（让机器在“真实目标时刻”动作）。
 *  - 延后类含义：倒计时按真实流逝时间走，与钟点偏差无关。
 *  - 煮制时长范围 [cookMin, cookMax] 用于由“开始”反推“煮好”的可行区间。
 */
export function planCandidates(input: PlanInput): PlanResult {
  const { profile, realNow, offsetMin, windowStart, windowEnd } = input;
  const step = Math.max(1, profile.granularityMin);
  const maxSpan = profile.maxSpanMin;
  const cookMin = profile.cookMinMin;
  const cookMax = profile.cookMaxMin;
  const hour12 = profile.hourFormat === 'h12';
  const reasons: string[] = [];

  if (windowEnd <= windowStart) reasons.push('开饭时间窗的“最晚”早于“最早”，请重新填写。');
  if (windowEnd <= realNow) reasons.push('希望开饭的时间已经过去了，请把时间填到将来（跨日请勾选“已过午夜”）。');

  const out: Candidate[] = [];
  // 机器预约键只有一种含义：登记了什么就枚举什么；
  // 只有“unknown（说明书没写清）”时才全量枚举，交给看灯步骤辨认。
  const meanings: Exclude<Meaning, 'unknown'>[] =
    profile.meaning === 'unknown'
      ? ['finishAtClock', 'startAtClock', 'delayFinishHours', 'delayStartHours']
      : [profile.meaning];

  for (const meaning of meanings) {
    if (isClock(meaning)) {
      // 枚举机内钟点刻度。机器按机内时间在“设定钟点”动作；
      // 机内有偏差时，该动作对应的真实时刻 = 机内时刻 - offset。
      const internalNow = realNow + offsetMin * 60000;
      const DAYMS = DAY_MIN * 60000;
      const startMinOfDay =
        Math.floor(((internalNow % DAYMS) + DAYMS) % DAYMS / 60000 / step) * step;
      const dayBase = Math.floor(internalNow / DAYMS) * DAYMS;
      for (let k = 0; k * step <= maxSpan + DAY_MIN; k++) {
        const internalSetAbs = dayBase + (startMinOfDay + k * step) * 60000;
        if (internalSetAbs <= internalNow + 60000) continue; // 必须是将来的机内钟点
        const setReal = internalSetAbs - offsetMin * 60000;
        const modMin = (((internalSetAbs % DAYMS) + DAYMS) % DAYMS) / 60000;
        const digits24 = hm(modMin);
        const token = fmtClock(modMin, hour12);

        if (meaning === 'finishAtClock') {
          // 设定即煮好；煮制占用 [set-cookMax, set-cookMin]
          const span = diffMin(setReal, realNow);
          if (setReal < windowStart - 1 || setReal > windowEnd + 1) continue;
          if (span < cookMin || span > maxSpan) continue;
          out.push({
            meaning,
            digits: digits24,
            token,
            spanMin: span,
            nearMax: span >= maxSpan - step,
            startReal: setReal - cookMax * 60000,
            finishReal: setReal,
            finishRealLate: setReal,
            valueMin: span,
            plain: `屏幕调到 ${token}，到点就煮好，距今约 ${fmtSpan(span)}；煮饭程序会自动提前开始。`,
          });
        } else {
          // startAtClock：设定即开煮；煮好落在 [set+cookMin, set+cookMax]
          const finishEarly = setReal + cookMin * 60000;
          const finishLate = setReal + cookMax * 60000;
          const startSpan = diffMin(setReal, realNow);
          if (finishLate < windowStart - 1 || finishEarly > windowEnd + 1) continue;
          if (startSpan < 0 || startSpan + cookMin > maxSpan) continue;
          out.push({
            meaning,
            digits: digits24,
            token,
            spanMin: startSpan,
            nearMax: startSpan + cookMax >= maxSpan,
            startReal: setReal,
            finishReal: finishEarly,
            finishRealLate: finishLate,
            valueMin: startSpan,
            plain: `屏幕调到 ${token}，表示那一刻开煮；煮好约在开煮后 ${fmtSpan(cookMin)}~${fmtSpan(cookMax)}。`,
          });
        }
      }
    } else {
      // 延后小时数：枚举 D = k*step（从现在起的真实分钟数）
      const untilFinish = meaning === 'delayFinishHours';
      for (let d = step; d <= maxSpan; d += step) {
        const target = realNow + d * 60000;
        let startReal: number;
        let finishEarly: number;
        let finishRealLate: number;
        let feasible: boolean;
        if (untilFinish) {
          // d = 距煮好；开始区间 [target-cookMax, target-cookMin]
          startReal = target - cookMax * 60000;
          finishEarly = target;
          finishRealLate = target;
          feasible =
            d >= cookMin &&
            target >= windowStart - 60000 &&
            target <= windowEnd + 60000;
        } else {
          // d = 距开煮；煮好 [target+cookMin, target+cookMax]
          startReal = target;
          finishEarly = target + cookMin * 60000;
          finishRealLate = target + cookMax * 60000;
          feasible =
            finishRealLate >= windowStart - 60000 &&
            finishEarly <= windowEnd + 60000 &&
            d + cookMin <= maxSpan;
        }
        if (!feasible) continue;
        const token = delayToken(d, step);
        out.push({
          meaning,
          digits: token,
          token: untilFinish ? `${token} 小时后煮好` : `${token} 小时后开煮`,
          spanMin: d,
          nearMax: untilFinish ? d >= maxSpan - step : d + cookMax >= maxSpan,
          startReal,
          finishReal: finishEarly,
          finishRealLate,
          valueMin: d,
          plain: untilFinish
            ? `屏幕调到 ${token}，表示 ${fmtSpan(d)}后煮好。`
            : `屏幕调到 ${token}，表示 ${fmtSpan(d)}后开煮，再煮 ${fmtSpan(cookMin)}~${fmtSpan(cookMax)}。`,
        });
      }
    }
  }

  // 去掉完全重复项（同含义同 token），按煮好时间排序
  const seen = new Set<string>();
  const uniq = out.filter((c) => {
    const k = `${c.meaning}|${c.token}|${c.finishReal}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  uniq.sort((a, b) => a.finishReal - b.finishReal || a.meaning.localeCompare(b.meaning));

  if (uniq.length === 0 && reasons.length === 0) {
    reasons.push(
      `在该机规则下，时间窗内没有可行设定：可能是窗口距现在太近（不足最短煮制 ${fmtSpan(cookMin)}）、超过最大跨度 ${fmtSpan(maxSpan)}，或受 ${step} 分钟粒度限制。请放宽时间窗或改用“先拨准机内钟”。`,
    );
  }
  return { candidates: uniq, reasons };
}

/** 把同屏显数字、不同含义的候选合并成一组（需看灯辨认） */
export interface CandidateGroup {
  token: string;
  digits: string;
  items: Candidate[];
  ambiguous: boolean;
}

export function groupCandidates(list: Candidate[]): CandidateGroup[] {
  const map = new Map<string, CandidateGroup>();
  for (const c of list) {
    const key = c.digits;
    const g = map.get(key) ?? { token: c.token, digits: c.digits, items: [], ambiguous: false };
    g.items.push(c);
    map.set(key, g);
  }
  for (const g of map.values()) {
    g.ambiguous = new Set(g.items.map((i) => i.meaning)).size > 1;
  }
  return [...map.values()].sort((a, b) => a.items[0].finishReal - b.items[0].finishReal);
}
