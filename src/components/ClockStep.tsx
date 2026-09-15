import { useMemo, useState } from 'react';
import type { MachineProfile, Session } from '../core/types';
import { clockOffsetMin, fmtClock, fmtSpan, hm, minutesOf, pad2 } from '../core/time';

interface Props {
  profile: MachineProfile;
  session: Session;
  onUpdate: (patch: Partial<Session>) => void;
  onNext: () => void;
}

function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function ClockStep({ profile, session, onUpdate, onNext }: Props) {
  const [realInput, setRealInput] = useState(session.realNow ? toLocalInputValue(session.realNow) : '');
  const [screenHM, setScreenHM] = useState(
    session.screenNow ? hm(minutesOf(new Date(session.screenNow))) : '',
  );
  const [screenCross, setScreenCross] = useState(false);

  const hour12 = profile.hourFormat === 'h12';

  const realNow = realInput ? new Date(realInput).getTime() : null;
  const offset = useMemo(() => {
    if (realNow == null || !screenHM) return null;
    const [h, m] = screenHM.split(':').map(Number);
    let screen = new Date(realNow);
    screen.setHours(h, m, 0, 0);
    if (screenCross) screen = new Date(screen.getTime() + 24 * 3600 * 1000);
    return { off: clockOffsetMin(screen.getTime(), realNow), screenTs: screen.getTime() };
  }, [realNow, screenHM, screenCross]);

  const captureNow = () => {
    const t = Date.now();
    setRealInput(toLocalInputValue(t));
    onUpdate({ realNow: t, screenNow: t, offsetMin: 0, clockMode: 'compensate' });
  };

  const apply = (mode: 'adjust' | 'compensate') => {
    if (realNow == null || offset == null) return;
    onUpdate({
      realNow,
      screenNow: offset.screenTs,
      offsetMin: offset.off,
      clockMode: mode,
    });
    onNext();
  };

  const reAdjust = () => {
    // 用户拨准机内钟后，重新取此刻手机时间：屏显此刻=真实此刻，偏差归零
    const t = Date.now();
    setRealInput(toLocalInputValue(t));
    setScreenHM(hm(minutesOf(new Date(t))));
    setScreenCross(false);
    onUpdate({ realNow: t, screenNow: t, offsetMin: 0, clockMode: 'adjust' });
    onNext();
  };

  if (!profile.hasClock) {
    return (
      <div className="card">
        <h2>② 核对时间</h2>
        <p className="hint">这台机器没有机内时钟（多为“倒计时”型），无需校时，只需记住手机上的现在时间。</p>
        <div className="alert alert-info">
          现在手机时间：<b>{realNow ? new Date(realNow).toLocaleString('zh-CN') : '尚未记录'}</b>
        </div>
        <button className="btn btn-primary" onClick={captureNow}>
          记下现在时间并继续
        </button>
        {session.realNow && (
          <button className="btn btn-ghost" style={{ marginLeft: 10 }} onClick={onNext}>
            下一步：填开饭时间窗
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <h2>② 核对机内时钟偏差与跨日</h2>
      <p className="hint">
        机内钟快/慢几分钟，预约“几点煮好”就会差几分钟。先量出偏差，再决定是拨准钟还是让引导台替你换算。
      </p>

      <div className="row2">
        <div className="field">
          <label>真实现在时间（看手机/挂钟）</label>
          <input type="datetime-local" value={realInput} onChange={(e) => setRealInput(e.target.value)} />
          <button className="btn btn-ghost mini" style={{ marginTop: 8 }} onClick={captureNow}>
            一键取本机现在时间
          </button>
        </div>
        <div className="field">
          <label>电饭煲屏幕现在显示（{hour12 ? '填 24 小时制即可，如 18:30' : '如 20:10'}）</label>
          <input type="time" value={screenHM} onChange={(e) => setScreenHM(e.target.value)} />
          <label style={{ fontWeight: 400, marginTop: 6 }} className="readback">
            <input type="checkbox" checked={screenCross} onChange={(e) => setScreenCross(e.target.checked)} />
            屏幕数字对应“明天”（跨午夜校时才勾）
          </label>
        </div>
      </div>

      {offset && (
        <>
          <div className={offset.off === 0 ? 'alert alert-ok' : 'alert alert-warn'}>
            {offset.off === 0 ? (
              <>机内钟与真实时间一致，无需校时。</>
            ) : (
              <>
                机内钟比真实时间<b>{offset.off > 0 ? '快' : '慢'} {fmtSpan(Math.abs(offset.off))}</b>
                （真实 {hm(minutesOf(new Date(realNow!)))}，屏幕显示 {fmtClock((minutesOf(new Date(realNow!)) + offset.off), hour12)}
                ）。
              </>
            )}
          </div>

          {offset.off !== 0 ? (
            <div className="big-btn-row">
              <button className="btn btn-primary" onClick={reAdjust}>
                我这就去把机内钟拨准（拨完点我）
              </button>
              <button className="btn btn-ghost" onClick={() => apply('compensate')}>
                不拨钟，按 {fmtSpan(Math.abs(offset.off))} 偏差自动换算
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => apply('adjust')}>
              时间一致，下一步
            </button>
          )}

          {session.clockMode === 'adjust' && offset.off === 0 && (
            <p className="muted" style={{ marginTop: 8 }}>
              已采用“先拨准机内钟”。
            </p>
          )}
        </>
      )}
    </div>
  );
}
