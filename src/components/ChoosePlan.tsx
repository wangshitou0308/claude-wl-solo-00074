import { useMemo, useState } from 'react';
import { groupCandidates, meaningName, type PlanResult } from '../core/engine';
import type { Candidate, MachineProfile } from '../core/types';
import { fmtDate, fmtSpan } from '../core/time';

interface Props {
  profile: MachineProfile;
  plan: PlanResult;
  onPick: (c: Candidate, cookMin: number) => void;
  onBack: () => void;
}

export function ChoosePlan({ profile, plan, onPick, onBack }: Props) {
  const groups = useMemo(() => groupCandidates(plan.candidates), [plan]);
  // 开始时刻类：允许在煮制时长范围内选一个具体时长
  const [cookPick, setCookPick] = useState<Record<string, number>>({});

  if (plan.candidates.length === 0) {
    return (
      <div className="card">
        <h2>④ 可行设定</h2>
        {plan.reasons.map((r, i) => (
          <div key={i} className="alert alert-bad">
            {r}
          </div>
        ))}
        <button className="btn btn-ghost" onClick={onBack}>
          返回修改时间窗
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>④ 选择一个可行设定</h2>
      <p className="hint">
        共 {plan.candidates.length} 个可行设定，按预计煮好时间排序。看不准含义时，优先选标注
        <b>“同数字·看灯”</b>
        的项，引导时会带你辨认模式灯。
      </p>

      {groups.map((g) =>
        g.items.map((c, idx) => {
          const startMeaning = c.meaning === 'startAtClock' || c.meaning === 'delayStartHours';
          const chosenCook =
            cookPick[`${g.digits}-${c.meaning}`] ??
            (startMeaning ? Math.round(profile.cookMinMin) : profile.cookMinMin);
          return (
            <div className="candidate" key={`${c.meaning}-${c.token}-${idx}`}>
              <div>
                <span className="digits">{c.token.replace(/ 小时后.*/, '')}</span>
                {g.ambiguous && <span className="tag tag-amb">同数字 · 看灯辨认</span>}
                {c.nearMax && <span className="tag tag-max">接近最大跨度</span>}
                <span className="tag tag-meaning">{meaningName(c.meaning)}</span>
              </div>
              <div className="meta">{c.plain}</div>
              <div className="meta">
                预计开煮：{fmtDate(c.startReal)}；预计煮好：
                {c.finishReal === c.finishRealLate
                  ? fmtDate(c.finishReal)
                  : `${fmtDate(c.finishReal)} ~ ${fmtDate(c.finishRealLate)}`}
                {c.spanMin >= 0 && <>（距今 {fmtSpan(c.spanMin)}）</>}
              </div>
              {startMeaning && (
                <div className="field" style={{ margin: '8px 0 4px' }}>
                  <label style={{ fontSize: '0.85rem' }}>
                    这锅大概煮多久？（在 {profile.cookMinMin}~{profile.cookMaxMin} 分钟内选，用于核对能否准时）
                  </label>
                  <input
                    type="range"
                    min={profile.cookMinMin}
                    max={profile.cookMaxMin}
                    value={chosenCook}
                    onChange={(e) =>
                      setCookPick((s) => ({
                        ...s,
                        [`${g.digits}-${c.meaning}`]: Number(e.target.value),
                      }))
                    }
                    style={{ width: '60%' }}
                  />
                  <span className="meta" style={{ marginLeft: 8 }}>
                    {chosenCook} 分钟 → 约 {fmtDate(c.startReal + chosenCook * 60000)} 煮好
                  </span>
                </div>
              )}
              <button className="btn btn-primary mini" style={{ marginTop: 6 }} onClick={() => onPick(c, chosenCook)}>
                就按这个设定开始引导
              </button>
            </div>
          );
        }),
      )}

      <button className="btn btn-ghost" onClick={onBack}>
        返回修改时间窗
      </button>
    </div>
  );
}
