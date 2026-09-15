// 机型规则指纹：只要影响设定推算的字段变化，旧会话步骤立即失效。
import type { MachineProfile } from './types';

export function ruleHash(p: MachineProfile): string {
  const core = {
    h: p.hourFormat,
    m: p.meaning,
    a: p.adjust,
    g: p.granularityMin,
    x: p.maxSpanMin,
    c0: p.cookMinMin,
    c1: p.cookMaxMin,
    clk: p.hasClock,
    keys: p.keys.map((k) => `${k.id}=${k.label}`),
    lamps: p.lamps.map((l) => `${l.key}=${l.label}`),
    hf: p.lampFinishHint,
    hd: p.lampDelayHint,
    hs: p.lampStartHint,
  };
  let h = 5381;
  const s = JSON.stringify(core);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'r' + (h >>> 0).toString(36);
}
