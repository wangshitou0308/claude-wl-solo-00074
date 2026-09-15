import { useEffect, useState } from 'react';
import { CookerSvg } from './CookerSvg';
import { meaningText } from '../core/steps';
import type { MachineProfile, Meaning, Session } from '../core/types';

export type ProblemType = 'outOfWindow' | 'keepWarm' | 'cancelled' | 'wrong';

interface Props {
  profile: MachineProfile;
  session: Session;
  replanInfo: { count: number; lastAt: number | null; message: string | null };
  onAdvance: (resolvedMeaning?: Exclude<Meaning, 'unknown'>, actualScreen?: string) => void;
  onUndo: () => void;
  onProblem: (t: ProblemType) => void;
  onAbort: () => void;
}

export function RunningGuide({ profile, session, replanInfo, onAdvance, onUndo, onProblem, onAbort }: Props) {
  const step = session.steps[session.stepIndex];
  const [ack, setAck] = useState(false);
  const [actual, setActual] = useState('');
  const [meaningChoice, setMeaningChoice] = useState<string>('');
  const [match, setMatch] = useState<boolean | null>(null);

  useEffect(() => {
    setAck(false);
    setActual('');
    setMeaningChoice('');
    setMatch(null);
  }, [session.stepIndex, session.steps]);

  if (!step) return null;
  const total = session.steps.length;
  const isObserve = step.kind === 'observeMeaning';
  const canNext = isObserve ? meaningChoice !== '' : ack;

  const confirm = () => {
    if (!canNext) return;
    if (isObserve) {
      onAdvance(meaningChoice as Exclude<Meaning, 'unknown'>);
    } else {
      setMatch(true);
      onAdvance(undefined, actual.trim() || undefined);
    }
  };

  return (
    <div className="card">
      <h2>
        第 {session.stepIndex + 1} / {total} 步：{step.title}
      </h2>
      {replanInfo.message && <div className="alert alert-warn">{replanInfo.message}</div>}

      <div className="row2" style={{ alignItems: 'start' }}>
        <div>
          <CookerSvg
            profile={profile}
            screen={step.expectScreen.length > 8 ? step.expectScreen.slice(0, 8) : step.expectScreen}
            activeKey={step.key}
            lamps={step.lamps}
            ampm={step.ampm}
            match={match}
          />
          <div className="muted" style={{ textAlign: 'center' }}>
            红框脉动处 = 本次要按的键；黄圆常亮=指示灯亮，半透明=灭，闪烁=灯在闪
          </div>
        </div>

        <div>
          {step.key && (
            <p>
              本次按键：<span className="kbd">{step.keyLabel}</span>
            </p>
          )}
          <p>
            预期屏显：<b style={{ fontSize: '1.15rem' }}>{step.expectScreen}</b>
            {step.ampm && (
              <span className="tag tag-meaning">{step.ampm === 'AM' ? '上午小灯' : '下午小灯'}</span>
            )}
          </p>
          <div className="field">
            <label>这一步灯的状态</label>
            <div className="meta">
              {step.lamps.map((l) => {
                const label = profile.lamps.find((x) => x.key === l.key)?.label ?? l.key;
                return (
                  <span key={l.key} className="tag tag-meaning" style={{ marginBottom: 4 }}>
                    {label}：{l.state === 'on' ? '亮' : l.state === 'blink' ? '闪' : '灭'}
                  </span>
                );
              })}
            </div>
          </div>
          <p>{step.detail}</p>

          {isObserve ? (
            <div className="field">
              <label>我看到亮灯旁的字是：</label>
              <div className="seg" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                {step.options?.map((o) => (
                  <button
                    key={o.value}
                    className={meaningChoice === o.value ? 'sel' : ''}
                    onClick={() => setMeaningChoice(o.value)}
                    style={{ textAlign: 'left' }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {meaningChoice && (
                <div className="alert alert-info" style={{ marginTop: 8 }}>
                  辨认结果：{meaningText(meaningChoice as Exclude<Meaning, 'unknown'>)}。后续按键将按此含义执行。
                </div>
              )}
            </div>
          ) : (
            <>
              <label className="readback">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  aria-label="实际显示与预期一致"
                />
                我照做后，电饭煲实际显示/灯况与上面“预期”一致
              </label>
              <div className="field" style={{ marginTop: 8 }}>
                <label className="desc">可选：把实际屏显写下来（便于回看）</label>
                <input
                  type="text"
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  placeholder="如：18:30 / 预约灯常亮"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="big-btn-row">
        <button className="btn btn-ghost" onClick={onUndo} disabled={session.stepIndex === 0 && session.checkpoints.length === 0}>
          ↩ 撤回上一步（误确认）
        </button>
        <button className="btn btn-ok" onClick={confirm} disabled={!canNext}>
          {step.kind === 'finishWait' ? '完成本次预约' : '一致，继续下一步'}
        </button>
      </div>

      <div style={{ marginTop: 14, borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
        <strong>情况不对？按实情选择，引导台会从最近确认处重算：</strong>
        <div className="big-btn-row">
          <button className="btn btn-warn mini" onClick={() => onProblem('outOfWindow')}>
            时间不对/已错过开饭窗
          </button>
          <button className="btn btn-warn mini" onClick={() => onProblem('keepWarm')}>
            误入保温（保温灯亮）
          </button>
          <button className="btn btn-warn mini" onClick={() => onProblem('cancelled')}>
            预约被取消（灯全灭/退出预约）
          </button>
          <button className="btn btn-warn mini" onClick={() => onProblem('wrong')}>
            屏显和预期完全不一样
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-bad mini" onClick={onAbort}>
            放弃本次引导，回到开头
          </button>
        </div>
      </div>
    </div>
  );
}
