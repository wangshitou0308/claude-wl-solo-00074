// 会话生命周期：创建、选候选、异常后从最近确认状态重算。
import { planCandidates } from './engine';
import { ruleHash } from './hash';
import { buildSteps } from './steps';
import type { Candidate, MachineProfile, SelectedCandidate, Session } from './types';

export function createSession(profile: MachineProfile): Session {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    profileId: profile.id,
    ruleHash: ruleHash(profile),
    status: 'clock',
    createdAt: now,
    updatedAt: now,
    realNow: null,
    screenNow: null,
    offsetMin: null,
    clockMode: null,
    windowStart: null,
    windowEnd: null,
    selected: null,
    steps: [],
    stepIndex: 0,
    checkpoints: [],
    log: [{ at: now, text: '已建立本次预约引导会话。' }],
  };
}

export function toSelected(c: Candidate, cookMin: number): SelectedCandidate {
  return {
    meaning: c.meaning,
    digits: c.digits,
    token: c.token,
    cookMin,
    predictedStartReal: c.startReal,
    predictedFinishReal: c.finishReal,
  };
}

export interface ReplanOutcome {
  candidates: ReturnType<typeof planCandidates>;
  /** 原选择在当前时刻仍可行时返回它 */
  retained: Candidate | null;
}

/**
 * 异常（超窗/误进保温/预约取消）后重算：
 * 以“现在”为基准、同一时间窗重新反算；优先保留原来的数字+含义。
 */
export function replan(session: Session, profile: MachineProfile, now: number): ReplanOutcome | null {
  if (session.windowStart == null || session.windowEnd == null || session.offsetMin == null) {
    return null;
  }
  const effectiveOffset = session.clockMode === 'adjust' ? 0 : session.offsetMin;
  const candidates = planCandidates({
    profile,
    realNow: now,
    offsetMin: effectiveOffset,
    windowStart: session.windowStart,
    windowEnd: session.windowEnd,
  });
  let retained: Candidate | null = null;
  if (session.selected) {
    const wantMeaning = session.selected.resolvedMeaning ?? session.selected.meaning;
    retained =
      candidates.candidates.find(
        (c) => c.meaning === wantMeaning && c.digits === session.selected!.digits,
      ) ?? null;
  }
  return { candidates, retained };
}

/** 依据当前选中方案（重新）生成步骤并回到指定检查点 */
export function rebuildStepsFrom(
  session: Session,
  profile: MachineProfile,
  fromIndex: number,
): Session {
  if (!session.selected) return session;
  const steps = buildSteps({ profile, selected: session.selected });
  return {
    ...session,
    steps,
    stepIndex: Math.max(0, Math.min(fromIndex, steps.length - 1)),
    status: 'running',
    updatedAt: Date.now(),
  };
}
