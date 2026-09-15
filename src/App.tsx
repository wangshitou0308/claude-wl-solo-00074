import { useEffect, useMemo, useState } from 'react';
import { usePersistent } from './state/usePersistent';
import { KEYS } from './core/db';
import { defaultProfile } from './core/defaults';
import { ruleHash } from './core/hash';
import { planCandidates, type PlanResult } from './core/engine';
import {
  createSession,
  rebuildStepsFrom,
  replan,
  toSelected,
} from './core/session';
import { buildSteps } from './core/steps';
import type { Candidate, MachineProfile, Meaning, Session } from './core/types';
import { ProfileForm } from './components/ProfileForm';
import { ClockStep } from './components/ClockStep';
import { WindowStep } from './components/WindowStep';
import { ChoosePlan } from './components/ChoosePlan';
import { RunningGuide, type ProblemType } from './components/RunningGuide';
import { KitchenCard } from './components/KitchenCard';
import { fmtDate } from './core/time';

const STAGES = [
  { key: 'profile', label: '机型资料' },
  { key: 'clock', label: '校时' },
  { key: 'window', label: '开饭窗' },
  { key: 'choose', label: '选设定' },
  { key: 'running', label: '逐步操作' },
] as const;

export default function App() {
  const [profiles, setProfiles, profilesLoaded] = usePersistent<MachineProfile[]>(KEYS.profiles, []);
  const [activeId, setActiveId, activeLoaded] = usePersistent<string>(KEYS.activeProfile, '');
  const [session, setSession, sessionLoaded] = usePersistent<Session | null>(KEYS.session, null);

  const [profileDraft, setProfileDraft] = useState<MachineProfile | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [notice, setNotice] = useState<{ kind: 'warn' | 'bad' | 'ok'; text: string } | null>(null);
  const [replanInfo, setReplanInfo] = useState({ count: 0, lastAt: null as number | null, message: null as string | null });

  const dbReady = profilesLoaded && activeLoaded && sessionLoaded;

  // 首次加载完成后：有已存机型则选中（优先 activeId），否则建默认草稿
  useEffect(() => {
    if (!dbReady || profileDraft) return;
    if (profiles.length > 0) {
      setProfileDraft(profiles.find((x) => x.id === activeId) ?? profiles[0]);
    } else {
      setProfileDraft(defaultProfile());
    }
  }, [dbReady, profiles, activeId, profileDraft]);

  const profile = profileDraft;

  // 机型规则变化 -> 旧步骤失效
  const ruleMismatch =
    dbReady &&
    !!session &&
    !!profile &&
    session.profileId === profile.id &&
    session.ruleHash !== ruleHash(profile);

  // 会话引用的机型不存在（切换/删除机型）
  const sessionProfileMissing = dbReady && !!session && !profiles.some((p) => p.id === session.profileId);
  // 会话属于别的机型：不能把旧步骤套到当前机型
  const sessionOtherProfile = dbReady && !!session && !!profile && session.profileId !== profile.id;
  const sessionBlocked = ruleMismatch || sessionProfileMissing || sessionOtherProfile;

  // 刷新续做：若停在选设定/运行中，按已存窗口重算一次
  useEffect(() => {
    if (!session || !profile) return;
    if (sessionBlocked) return;
    if (
      (session.status === 'choose' || session.status === 'running') &&
      session.windowStart != null &&
      session.windowEnd != null &&
      session.offsetMin != null
    ) {
      const offset = session.clockMode === 'adjust' ? 0 : session.offsetMin;
      setPlan(
        planCandidates({
          profile,
          realNow: session.realNow ?? Date.now(),
          offsetMin: offset,
          windowStart: session.windowStart,
          windowEnd: session.windowEnd,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, !!profile]);

  const activeStageIndex = useMemo(() => {
    if (!session) return 0;
    if (session.status === 'clock') return 1;
    if (session.status === 'window') return 2;
    if (session.status === 'choose') return 3;
    return 4;
  }, [session]);

  if (!profile) {
    return (
      <div className="wrap">
        <p>正在读取本机资料…</p>
      </div>
    );
  }

  const persistProfile = () => {
    const p = { ...profile, updatedAt: Date.now() };
    setProfileDraft(p);
    setProfiles((prev) => {
      const exists = prev.some((x) => x.id === p.id);
      return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
    });
    setActiveId(p.id);
    setSavedFlash(true);
    setNotice({ kind: 'ok', text: '机型资料已保存到本机浏览器。' });
    if (!session || session.profileId !== p.id) {
      setSession(createSession(p));
    } else if (session.ruleHash !== ruleHash(p)) {
      // 规则变更：旧步骤失效，回到校时
      const fresh = { ...createSession(p) };
      setSession(fresh);
      setPlan(null);
      setNotice({ kind: 'warn', text: '机型规则已变化，原引导步骤失效，请重新校时并反算。' });
    }
  };

  const newProfile = () => {
    const p = defaultProfile();
    setProfileDraft(p);
    setSavedFlash(false);
  };

  const switchProfile = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setProfileDraft(p);
    setActiveId(id);
  };

  const ensureSession = (): Session => {
    if (session && session.profileId === profile.id) return session;
    const s = createSession(profile);
    setSession(s);
    return s;
  };

  const updateSession = (patch: Partial<Session>) => {
    setSession((prev) => (prev ? { ...prev, ...patch, updatedAt: Date.now() } : prev));
  };

  const appendLog = (s: Session, text: string): Session => ({
    ...s,
    log: [{ at: Date.now(), text }, ...s.log].slice(0, 50),
  });

  // ---------- 各阶段动作 ----------

  const saveClock = (patch: Partial<Session>) => {
    const s = ensureSession();
    const next = appendLog({ ...s, ...patch, status: 'clock' }, '已登记机内时钟偏差与校时方式。');
    setSession(next);
  };

  const gotoWindow = () => {
    const s = ensureSession();
    setSession(appendLog({ ...s, status: 'window' }, '进入开饭时间窗登记。'));
  };

  const computePlan = (wStart: number, wEnd: number) => {
    const s = ensureSession();
    const base = s.realNow ?? Date.now();
    const offset = s.clockMode === 'adjust' || s.offsetMin == null ? 0 : s.offsetMin;
    const result = planCandidates({
      profile,
      realNow: base,
      offsetMin: offset,
      windowStart: wStart,
      windowEnd: wEnd,
    });
    setPlan(result);
    const next = appendLog(
      { ...s, realNow: base, windowStart: wStart, windowEnd: wEnd, status: 'choose', selected: null, steps: [], stepIndex: 0, checkpoints: [] },
      `已按时间窗反算，得到 ${result.candidates.length} 个可行设定。`,
    );
    setSession(next);
    if (result.candidates.length === 0) {
      setNotice({ kind: 'bad', text: result.reasons.join(' ') });
    } else {
      setNotice(null);
    }
  };

  const pickCandidate = (c: Candidate, cookMin: number) => {
    if (!session) return;
    const selected = toSelected(c, cookMin);
    const steps = buildSteps({ profile, selected });
    const next = appendLog(
      {
        ...session,
        selected,
        steps,
        stepIndex: 0,
        status: 'running',
        checkpoints: [],
      },
      `已选设定“${c.token}”（${selected.meaning}），开始逐步引导。`,
    );
    setSession(next);
    setReplanInfo({ count: 0, lastAt: null, message: null });
  };

  const advance = (resolvedMeaning?: Exclude<Meaning, 'unknown'>, actualScreen?: string) => {
    if (!session) return;
    let sel = session.selected;
    let steps = session.steps;

    // 看灯辨认：确定含义后重建步骤（去掉看灯步、按该含义走）
    if (resolvedMeaning && sel) {
      sel = { ...sel, resolvedMeaning };
      steps = buildSteps({ profile, selected: sel });
    }

    const cur = steps[session.stepIndex];
    const checkpoints = cur.isCheckpoint
      ? [...session.checkpoints.filter((c) => c.stepIndex !== cur.index), { stepIndex: cur.index, at: Date.now(), note: cur.checkpointNote ?? cur.title }]
      : session.checkpoints;

    const nextIndex = session.stepIndex + 1;
    const done = nextIndex >= steps.length;
    let next: Session = {
      ...session,
      selected: sel,
      steps,
      stepIndex: done ? steps.length - 1 : nextIndex,
      checkpoints,
      status: done ? 'done' : 'running',
    };
    const logText = actualScreen
      ? `第 ${cur.index + 1} 步已确认（实际：${actualScreen}）。`
      : `第 ${cur.index + 1} 步已确认。`;
    next = appendLog(next, logText);
    setSession(next);
    if (done) setNotice({ kind: 'ok', text: '预约已完成！可打印下方厨房卡备用。' });
  };

  const undo = () => {
    if (!session) return;
    if (session.stepIndex === 0) {
      setNotice({ kind: 'warn', text: '已经是第一步，无法再撤回；可“放弃本次引导”重来。' });
      return;
    }
    // 误确认撤回：回到上一步重新操作与确认
    const target = session.stepIndex - 1;
    const targetStep = session.steps[target];
    const next = appendLog(
      {
        ...session,
        stepIndex: target,
        // 丢弃目标步之后已建立的检查点；目标步自身要重做也一并丢弃
        checkpoints: session.checkpoints.filter(
          (c) => c.stepIndex < (targetStep?.index ?? target),
        ),
      },
      `已撤回，回到“${targetStep?.title ?? `第 ${target + 1} 步`}”重新确认。`,
    );
    setSession(next);
  };

  // ---------- 异常：从最近确认状态重算 ----------

  const handleProblem = (t: ProblemType) => {
    if (!session || !session.selected) return;
    const now = Date.now();
    const problemText: Record<ProblemType, string> = {
      outOfWindow: '报告：时间不对/错过开饭窗',
      keepWarm: '报告：误入保温',
      cancelled: '报告：预约被取消',
      wrong: '报告：屏显与预期不符',
    };

    // 先在原步骤层面退回：cancelled/keepWarm 需从待机重来
    const r = replan(session, profile, now);
    if (!r) {
      setNotice({ kind: 'bad', text: '缺少时间窗或校时信息，无法重算，请重新登记。' });
      const fresh = appendLog({ ...createSession(profile) }, problemText[t] + '，资料不足，重置。');
      setSession(fresh);
      setPlan(null);
      return;
    }

    // 原设定仍可行 -> 回到最近的检查点（没有则第 0 步）
    if (r.retained) {
      const cp = session.checkpoints[session.checkpoints.length - 1];
      const from = cp ? cp.stepIndex : 0;
      let rebuilt = rebuildStepsFrom(session, profile, from);
      rebuilt = appendLog(rebuilt, `${problemText[t]}；原设定仍可行，已从“${cp?.note ?? '待机'}”处重来。`);
      setSession(rebuilt);
      setReplanInfo((x) => ({
        count: x.count + 1,
        lastAt: now,
        message: `${problemText[t]}。原数字仍可行，已从最近确认处（第 ${from + 1} 步）重来，请照做。`,
      }));
      setPlan(r.candidates);
      return;
    }

    // 原设定不再可行 -> 回到选设定，用新候选
    setPlan(r.candidates);
    const next = appendLog(
      { ...session, status: 'choose', steps: [], stepIndex: 0, selected: session.selected, checkpoints: [] },
      `${problemText[t]}；原设定已不适用，已按当前时间重算，请重选。`,
    );
    setSession(next);
    setReplanInfo({ count: replanInfo.count + 1, lastAt: now, message: null });
    setNotice({
      kind: 'warn',
      text:
        r.candidates.candidates.length > 0
          ? '原设定已不适用（可能错过窗口），已重算出新候选，请重新选择。'
          : r.candidates.reasons.join(' '),
    });
  };

  const abortSession = () => {
    const fresh = appendLog(createSession(profile), '放弃本次引导，重置到校时阶段。');
    setSession(fresh);
    setPlan(null);
    setNotice(null);
    setReplanInfo({ count: 0, lastAt: null, message: null });
  };

  // 规则变更横幅
  const renderStale = () => {
    if (ruleMismatch)
      return (
        <div className="alert alert-bad no-print">
          ⚠ 机型规则已被改动，本次旧步骤已失效。保存机型资料后将从校时重新开始。
        </div>
      );
    if (sessionProfileMissing)
      return (
        <div className="alert alert-bad no-print">
          ⚠ 当前会话对应的机型不在已保存列表中，请在上方切换或另建机型。
        </div>
      );
    if (sessionOtherProfile)
      return (
        <div className="alert alert-info no-print">
          当前打开的是“{profile.name}”机型；进行中的会话属于另一台电饭煲。继续操作将为“
          {profile.name}”另开一次引导（旧会话仍保留，切回原机型可续做）。
          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-primary mini"
              onClick={() => setSession(createSession(profile))}
            >
              为“{profile.name}”开始引导
            </button>
          </div>
        </div>
      );
    return null;
  };

  return (
    <div className="wrap">
      <header className="app-header">
        <div>
          <h1>电饭煲预约跨日校时引导台</h1>
          <div className="sub">帮长辈分清“几点煮好 / 几小时后 / 几点开煮”，逐步按键、看灯核对</div>
        </div>
        <div className="top-actions no-print">
          <span className="privacy">🔒 纯本机运行 · 资料只存本浏览器 IndexedDB</span>
          <button className="btn btn-ghost mini" onClick={() => window.print()}>
            打印厨房卡
          </button>
        </div>
      </header>

      {notice && (
        <div className={`alert ${notice.kind === 'ok' ? 'alert-ok' : notice.kind === 'warn' ? 'alert-warn' : 'alert-bad'} no-print`}>
          {notice.text}
        </div>
      )}
      {renderStale()}

      {/* 进度条 */}
      <div className="steps-bar no-print">
        {STAGES.map((s, i) => (
          <span
            key={s.key}
            className={`chip ${i === activeStageIndex && session ? 'active' : ''} ${
              i < activeStageIndex ? 'done' : ''
            }`}
          >
            {i + 1}. {s.label}
          </span>
        ))}
      </div>

      {/* 已保存机型切换 */}
      {profiles.length > 0 && (
        <div className="card no-print" style={{ padding: 12 }}>
          <strong>已登记机型：</strong>
          <div className="seg" style={{ display: 'inline-flex', marginLeft: 8 }}>
            {profiles.map((p) => (
              <button
                key={p.id}
                className={p.id === profile.id ? 'sel' : ''}
                onClick={() => switchProfile(p.id)}
              >
                {p.name}
              </button>
            ))}
            <button onClick={newProfile}>＋ 另建</button>
          </div>
        </div>
      )}

      <ProfileForm
        profile={profile}
        onChange={setProfileDraft}
        onSave={persistProfile}
        onNew={newProfile}
        saved={savedFlash || profiles.some((p) => p.id === profile.id)}
      />

      {!sessionBlocked && session && (
        <>
          {session.status === 'clock' && (
            <ClockStep profile={profile} session={session} onUpdate={saveClock} onNext={gotoWindow} />
          )}

          {session.status === 'window' && session.clockMode && (
            <WindowStep
              profile={profile}
              session={session}
              onCompute={computePlan}
              onBack={() => updateSession({ status: 'clock' })}
            />
          )}

          {session.status === 'choose' && plan && (
            <ChoosePlan
              profile={profile}
              plan={plan}
              onPick={pickCandidate}
              onBack={() => updateSession({ status: 'window' })}
            />
          )}

          {(session.status === 'running' || session.status === 'done') && session.steps.length > 0 && (
            <RunningGuide
              profile={profile}
              session={session}
              replanInfo={replanInfo}
              onAdvance={advance}
              onUndo={undo}
              onProblem={handleProblem}
              onAbort={abortSession}
            />
          )}

          {session.status === 'done' && (
            <div className="alert alert-ok">
              🎉 预约流程已全部确认完成。下方厨房卡可打印贴在电饭煲旁；刷新页面后仍可打开本页续做或重印。
            </div>
          )}

          {(session.status === 'running' || session.status === 'done') && session.selected && (
            <KitchenCard profile={profile} session={session} />
          )}

          {/* 会话记录 */}
          <div className="card no-print">
            <h2>本次记录</h2>
            <div className="row2">
              <div>
                <p className="muted" style={{ margin: 0 }}>
                  会话建立：{fmtDate(session.createdAt)}
                  <br />
                  最近更新：{fmtDate(session.updatedAt)}
                  {session.windowStart != null && (
                    <>
                      <br />
                      开饭窗：{fmtDate(session.windowStart)} ~ {fmtDate(session.windowEnd!)}
                    </>
                  )}
                </p>
                <div className="big-btn-row">
                  <button className="btn btn-ghost mini" onClick={abortSession}>
                    重新开始本次引导
                  </button>
                  <button className="btn btn-primary mini" onClick={() => window.print()}>
                    打印本机厨房卡
                  </button>
                </div>
              </div>
              <div className="log-list">
                {session.log.map((l, i) => (
                  <div key={i}>
                    {new Date(l.at).toLocaleTimeString('zh-CN')} · {l.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <footer className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        关闭/刷新页面后可继续（资料存于本机 IndexedDB）；清除浏览器站点数据会删除全部登记。
      </footer>
    </div>
  );
}
