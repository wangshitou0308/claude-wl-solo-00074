import type { KeyId, KeyLabel, LampKey, LampLabel, MachineProfile } from './types';

export const ALL_KEYS: { id: KeyId; defaultLabel: string }[] = [
  { id: 'power', defaultLabel: '电源' },
  { id: 'menu', defaultLabel: '功能/菜单' },
  { id: 'reserve', defaultLabel: '预约' },
  { id: 'hour', defaultLabel: '时' },
  { id: 'min', defaultLabel: '分' },
  { id: 'up', defaultLabel: '+（上调）' },
  { id: 'down', defaultLabel: '-（下调）' },
  { id: 'start', defaultLabel: '开始' },
  { id: 'cancel', defaultLabel: '取消' },
  { id: 'warm', defaultLabel: '保温' },
];

export const ALL_LAMPS: { key: LampKey; defaultLabel: string }[] = [
  { key: 'power', defaultLabel: '电源灯' },
  { key: 'program', defaultLabel: '程序灯（如精煮/快煮）' },
  { key: 'reserve', defaultLabel: '预约灯' },
  { key: 'reserveFinish', defaultLabel: '预约-完成时刻' },
  { key: 'reserveDelay', defaultLabel: '预约-倒计时' },
  { key: 'reserveStart', defaultLabel: '预约-开始时刻' },
  { key: 'cooking', defaultLabel: '煮饭灯' },
  { key: 'keepWarm', defaultLabel: '保温灯' },
];

function nowTs(): number {
  return Date.now();
}

/** 常见 24 小时制、“时/分”键、预约=完成时刻的机型模板 */
export function defaultProfile(id = crypto.randomUUID()): MachineProfile {
  const ts = nowTs();
  return {
    id,
    name: '我的电饭煲',
    hourFormat: 'h24',
    meaning: 'finishAtClock',
    adjust: 'hourMin',
    granularityMin: 10,
    maxSpanMin: 24 * 60,
    cookMinMin: 40,
    cookMaxMin: 60,
    hasClock: true,
    keys: ALL_KEYS.map((k): KeyLabel => ({ id: k.id, label: k.defaultLabel })),
    lamps: ALL_LAMPS.map((l): LampLabel => ({ key: l.key, label: l.defaultLabel })),
    lampFinishHint: '灯旁写“预约/时:分”，数字是“几点煮好”',
    lampDelayHint: '灯旁写“小时/H”，数字只有 1~2 位',
    lampStartHint: '灯旁写“开始”，数字是“几点开始煮”',
    createdAt: ts,
    updatedAt: ts,
  };
}
