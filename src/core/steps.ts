// 引导步骤生成：把选中的候选翻译成逐步按键操作，每步附带“预期屏显 + 指示灯”。
import type {
  KeyId,
  LampKey,
  MachineProfile,
  Meaning,
  SelectedCandidate,
  Step,
  StepLamp,
} from './types';

export interface BuildStepsInput {
  profile: MachineProfile;
  selected: SelectedCandidate;
}

function lamp(key: LampKey, state: StepLamp['state']): StepLamp {
  return { key, state };
}

export function keyLabelOf(p: MachineProfile, id: KeyId): string {
  return p.keys.find((k) => k.id === id)?.label ?? id;
}

export function buildSteps({ profile, selected }: BuildStepsInput): Step[] {
  const meaning = selected.resolvedMeaning ?? selected.meaning;
  const steps: Step[] = [];
  let i = 0;
  const push = (s: Omit<Step, 'index'>) => steps.push({ ...s, index: i++ });

  const targetToken = selected.token; // 如 "18:30" / "3 小时后煮好"
  const targetDigits = selected.digits; // 如 "18:30" / "3"

  // 0. 待机确认
  push({
    kind: 'standby',
    key: null,
    keyLabel: '',
    title: '先确认电饭煲在待机状态',
    expectScreen: profile.hasClock ? '显示当前时间（例如 20:10）' : '显示 “00:00” 或短横',
    lamps: [lamp('power', 'on'), lamp('keepWarm', 'off'), lamp('cooking', 'off')],
    detail:
      '看屏幕：若“保温”灯亮着，或屏幕是倒计时在走，先按下面“情况不对”退出。确认锅内已放好米和水、盖好盖子。',
    isCheckpoint: true,
    checkpointNote: '已在待机，米水已放好',
  });

  // 1. 选择煮饭程序
  push({
    kind: 'program',
    key: 'menu',
    keyLabel: keyLabelOf(profile, 'menu'),
    title: '选择煮饭程序',
    expectScreen: '所选程序（如“精煮”）灯亮，时间显示不变',
    lamps: [lamp('power', 'on'), lamp('program', 'on'), lamp('reserve', 'off')],
    detail: '按功能/菜单键，选到平时煮饭用的程序（如精煮/香弹煮）。部分机型此步可跳过。',
    isCheckpoint: false,
  });

  // 2. 进入预约
  push({
    kind: 'enterReserve',
    key: 'reserve',
    keyLabel: keyLabelOf(profile, 'reserve'),
    title: '按预约键进入预约',
    expectScreen: '屏幕数字开始闪烁（这是出厂默认预约值，未必正确）',
    lamps: [lamp('power', 'on'), lamp('program', 'on'), lamp('reserve', 'blink')],
    detail:
      profile.meaning === 'unknown'
        ? '进入预约后先别按加减，下一步要看清楚亮的是哪颗灯，才能判断这个数字到底代表什么。'
        : '进入预约后数字会闪烁，接下来把它改成我们算好的数值。',
    isCheckpoint: true,
    checkpointNote: '已进入预约，数字在闪',
  });

  // 3. 含义未知 -> 看灯辨认（用户一旦辨认并记录 resolvedMeaning，重建步骤时不再出现）
  if (profile.meaning === 'unknown' && !selected.resolvedMeaning) {
    push({
      kind: 'observeMeaning',
      key: null,
      keyLabel: '',
      title: '看预约灯旁的小字，判断数字含义',
      expectScreen: '数字仍在闪烁，先不要动',
      lamps: [
        lamp('power', 'on'),
        lamp('program', 'on'),
        lamp('reserve', 'blink'),
        lamp('reserveFinish', 'on'),
      ],
      detail:
        '同样一个数字（例如 3），在不同机器上可能是“3 点煮好”也可能是“3 小时后煮好”，差很多。请看面板上亮灯旁边印的字，选下面最符合的一项。',
      isCheckpoint: true,
      checkpointNote: '已根据模式灯辨认含义',
      options: [
        { value: 'finishAtClock', label: `完成时刻：${profile.lampFinishHint}`, meaning: 'finishAtClock' },
        { value: 'delayFinishHours', label: `倒计时：${profile.lampDelayHint}`, meaning: 'delayFinishHours' },
        { value: 'startAtClock', label: `开始时刻：${profile.lampStartHint}`, meaning: 'startAtClock' },
      ],
    });
  }

  // 4. 调到目标值
  const adjustKey: KeyId = profile.adjust === 'hourMin' ? 'hour' : 'up';
  const adjustTitle =
    profile.adjust === 'hourMin'
      ? `先按“${keyLabelOf(profile, 'hour')}”把小时调到 ${targetDigits}`
      : `长按/点按“${keyLabelOf(profile, 'up')}”把数字调到 ${targetDigits}`;
  push({
    kind: profile.adjust === 'hourMin' ? 'adjustHour' : 'adjustMin',
    key: adjustKey,
    keyLabel: keyLabelOf(profile, adjustKey),
    title: adjustTitle,
    expectScreen: targetToken,
    lamps: [lamp('power', 'on'), lamp('program', 'on'), lamp('reserve', 'blink')],
    ampm: deriveAmpm(selected, meaning, 'hour'),
    detail:
      profile.adjust === 'hourMin'
        ? `调到屏幕显示 ${targetToken}${
            profile.hourFormat === 'h12' ? '（注意上午/下午小灯）' : ''
          }。数字会循环，调过头继续按即可。`
        : `数字按 ${profile.granularityMin} 分钟一跳，停在 ${targetToken}。`,
    isCheckpoint: false,
  });

  if (profile.adjust === 'hourMin') {
    push({
      kind: 'adjustMin',
      key: 'min',
      keyLabel: keyLabelOf(profile, 'min'),
      title: `再按“${keyLabelOf(profile, 'min')}”把分钟调到 ${targetDigits}`,
      expectScreen: targetToken,
      lamps: [lamp('power', 'on'), lamp('program', 'on'), lamp('reserve', 'blink')],
      ampm: deriveAmpm(selected, meaning, 'min'),
      detail: `分钟通常 ${profile.granularityMin} 分钟一跳。最终屏幕必须正好显示 ${targetToken}。`,
      isCheckpoint: false,
    });
  }

  // 5. 核对
  push({
    kind: 'verify',
    key: null,
    keyLabel: '',
    title: `核对屏幕：应为 ${targetToken}`,
    expectScreen: targetToken,
    lamps: [lamp('power', 'on'), lamp('program', 'on'), lamp('reserve', 'blink')],
    ampm: deriveAmpm(selected, meaning, 'hour'),
    detail: `请大声念一遍屏幕数字。含义是“${meaningText(meaning)}”。确认无误后再开始；不对就按情况不对退回重调。`,
    isCheckpoint: true,
    checkpointNote: `屏显已核对为 ${targetToken}`,
  });

  // 6. 按开始
  push({
    kind: 'start',
    key: 'start',
    keyLabel: keyLabelOf(profile, 'start'),
    title: '按开始键，锁定预约',
    expectScreen: '预约灯常亮（不再闪），部分机器显示倒计时',
    lamps: [lamp('power', 'on'), lamp('program', 'on'), lamp('reserve', 'on'), lamp('cooking', 'off')],
    detail: '按下后预约灯应由闪烁变为常亮，表示预约已锁定。若灯没亮或数字还在闪，说明没锁定成功。',
    isCheckpoint: true,
    checkpointNote: '预约灯常亮，预约已锁定',
  });

  // 7. 等待说明
  push({
    kind: 'finishWait',
    key: null,
    keyLabel: '',
    title: '到点前留意，不要开盖',
    expectScreen: '预约灯常亮；到开煮时“煮饭”灯亮、开始冒蒸汽',
    lamps: [lamp('power', 'on'), lamp('program', 'on'), lamp('reserve', 'on'), lamp('cooking', 'blink')],
    detail:
      '预约期间不要拔插头、不要按取消。到开始时间会自动开煮，煮好后多数机器会自动转保温。若提前发现异常，可在引导台点“情况不对”。',
    isCheckpoint: false,
  });

  return steps;
}

function deriveAmpm(
  selected: SelectedCandidate,
  meaning: Meaning,
  part: 'hour' | 'min',
): 'AM' | 'PM' | undefined {
  if (!/^\d{1,2}:\d{2}$/.test(selected.digits)) return undefined;
  if (meaning !== 'finishAtClock' && meaning !== 'startAtClock') return undefined;
  const hour = parseInt(selected.digits.split(':')[0], 10);
  if (part === 'min') return hour < 12 ? 'AM' : 'PM';
  return hour < 12 ? 'AM' : 'PM';
}

export function meaningText(m: Exclude<Meaning, 'unknown'>): string {
  switch (m) {
    case 'finishAtClock':
      return '这个钟点煮好（完成时刻）';
    case 'startAtClock':
      return '这个钟点开始煮（开始时刻）';
    case 'delayFinishHours':
      return '过这么多小时后煮好';
    case 'delayStartHours':
      return '过这么多小时后开煮';
  }
}
