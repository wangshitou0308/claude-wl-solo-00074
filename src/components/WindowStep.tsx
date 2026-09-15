import { useMemo, useState } from 'react';
import type { MachineProfile, Session } from '../core/types';
import { DAY_MIN, atMinute, diffMin, fmtDate, fmtSpan, pad2 } from '../core/time';

interface Props {
  profile: MachineProfile;
  session: Session;
  onCompute: (windowStart: number, windowEnd: number) => void;
  onBack: () => void;
}

function timeInput(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function WindowStep({ profile, session, onCompute, onBack }: Props) {
  const base = session.realNow ?? Date.now();
  const baseD = new Date(base);
  const [startHM, setStartHM] = useState(timeInput(baseD));
  const [endHM, setEndHM] = useState(timeInput(new Date(base + 60 * 60000)));
  const [cross, setCross] = useState(false);
  const [endCross, setEndCross] = useState(false);

  const parse = (s: string, isTomorrow: boolean) => {
    const [h, m] = s.split(':').map(Number);
    let ts = atMinute(base, h * 60 + m, 0);
    if (isTomorrow) ts += DAY_MIN * 60000;
    return ts;
  };

  const winStart = startHM ? parse(startHM, cross) : NaN;
  const winEnd = endHM ? parse(endHM, endCross) : NaN;
  const valid =
    Number.isFinite(winStart) && Number.isFinite(winEnd) && winEnd > winStart && winStart > base - 60000;

  const span = Number.isFinite(winEnd) && Number.isFinite(winStart) ? diffMin(winEnd, winStart) : null;

  // 简单可行性预判提示
  const preHint = useMemo(() => {
    if (!Number.isFinite(winStart)) return null;
    const lead = diffMin(winStart, base);
    const tips: string[] = [];
    if (lead < profile.cookMinMin)
      tips.push(`最早开饭距现在只有 ${fmtSpan(lead)}，短于最短煮制 ${fmtSpan(profile.cookMinMin)}，可能来不及。`);
    if (lead > profile.maxSpanMin)
      tips.push(`最早开饭在 ${fmtSpan(lead)}后，超过该机最大跨度 ${fmtSpan(profile.maxSpanMin)}。`);
    return tips;
  }, [winStart, base, profile]);

  return (
    <div className="card">
      <h2>③ 填写希望开饭的时间窗</h2>
      <p className="hint">
        给出“最早能开饭”和“最晚要开饭”两个时刻；引导台只把煮好时间落在此区间内的设定列为可行。跨午夜请勾选“次日”。
      </p>

      <div className="alert alert-info">
        现在（真实时间）：<b>{fmtDate(base)}</b>
        {profile.hasClock && session.clockMode === 'compensate' && session.offsetMin !== 0 && (
          <>；机内钟{session.offsetMin! > 0 ? '快' : '慢'} {fmtSpan(Math.abs(session.offsetMin!))}，将自动换算</>
        )}
      </div>

      <div className="row2">
        <div className="field">
          <label>最早能开饭</label>
          <input type="time" value={startHM} onChange={(e) => setStartHM(e.target.value)} />
          <label className="readback" style={{ fontWeight: 400, marginTop: 6 }}>
            <input type="checkbox" checked={cross} onChange={(e) => setCross(e.target.checked)} /> 次日（已过午夜）
          </label>
          <div className="desc">{Number.isFinite(winStart) ? `即 ${fmtDate(winStart)}` : ''}</div>
        </div>
        <div className="field">
          <label>最晚要开饭</label>
          <input type="time" value={endHM} onChange={(e) => setEndHM(e.target.value)} />
          <label className="readback" style={{ fontWeight: 400, marginTop: 6 }}>
            <input type="checkbox" checked={endCross} onChange={(e) => setEndCross(e.target.checked)} /> 次日（已过午夜）
          </label>
          <div className="desc">{Number.isFinite(winEnd) ? `即 ${fmtDate(winEnd)}` : ''}</div>
        </div>
      </div>

      {span !== null && (
        <p className="muted">
          开饭窗口宽 {fmtSpan(span)}
          {!valid && <span style={{ color: 'var(--bad)' }}>（最晚必须晚于最早、且在将来）</span>}
        </p>
      )}
      {preHint?.map((t, i) => (
        <div key={i} className="alert alert-warn">
          {t}
        </div>
      ))}

      <div className="big-btn-row">
        <button className="btn btn-ghost" onClick={onBack}>
          返回校时
        </button>
        <button className="btn btn-primary" disabled={!valid} onClick={() => onCompute(winStart, winEnd)}>
          反算可行设定
        </button>
      </div>
    </div>
  );
}
