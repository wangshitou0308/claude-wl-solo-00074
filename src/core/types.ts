// 核心数据类型：机型资料、会话、候选方案、引导步骤
// 全应用不依赖任何网络服务，所有资料仅写入本机 IndexedDB。

export type HourFormat = 'h12' | 'h24';

/** 预约键的真实含义（由说明书/实物登记，未知则运行时看灯辨认） */
export type Meaning =
  | 'finishAtClock' // 预约完成时刻：屏显“几点煮好”
  | 'startAtClock' // 开始时刻：屏显“几点开始煮”
  | 'delayFinishHours' // 延后小时数=距煮好
  | 'delayStartHours' // 延后小时数=距开煮
  | 'unknown'; // 说明书没写清，需要按模式灯辨认

export type AdjustKind =
  | 'hourMin' // 用“时/分”两个键调
  | 'upDown'; // 用“上/下（+/-）”键调

export type LampKey =
  | 'power'
  | 'program'
  | 'reserve'
  | 'reserveFinish'
  | 'reserveDelay'
  | 'reserveStart'
  | 'cooking'
  | 'keepWarm';

export type KeyId =
  | 'power'
  | 'menu'
  | 'reserve'
  | 'hour'
  | 'min'
  | 'up'
  | 'down'
  | 'start'
  | 'cancel'
  | 'warm';

export interface KeyLabel {
  id: KeyId;
  label: string; // 按实物/说明书登记的字样
}

export interface LampLabel {
  key: LampKey;
  label: string;
}

export interface MachineProfile {
  id: string;
  name: string; // 机型，如“美的 MB-FB40”
  hourFormat: HourFormat;
  /** 登记说明书中预约键的含义；unknown 表示需看灯辨认 */
  meaning: Meaning;
  /** 调时方式 */
  adjust: AdjustKind;
  /** 设定粒度（分钟），如 10 */
  granularityMin: number;
  /** 最大预约跨度（分钟） */
  maxSpanMin: number;
  /** 煮制时长范围（分钟） */
  cookMinMin: number;
  cookMaxMin: number;
  /** 是否带机内时钟屏（部分简易机型没有） */
  hasClock: boolean;
  /** 按键字样（按实物登记） */
  keys: KeyLabel[];
  /** 指示灯字样（按实物登记） */
  lamps: LampLabel[];
  /** “预约完成时刻”模式灯旁的提示语（无灯机型填空） */
  lampFinishHint: string;
  /** “延后小时数”模式灯旁的提示语 */
  lampDelayHint: string;
  /** “开始时刻”模式灯旁的提示语 */
  lampStartHint: string;
  createdAt: number;
  updatedAt: number;
}

// ---------- 会话 ----------

export type SessionStatus =
  | 'clock' // 阶段：校时
  | 'window' // 阶段：开饭时间窗
  | 'choose' // 阶段：选择候选方案
  | 'running' // 阶段：按步骤操作
  | 'done'; // 完成

export interface Checkpoint {
  stepIndex: number;
  at: number;
  note: string;
}

export interface SessionLogEntry {
  at: number;
  text: string;
}

export interface Session {
  id: string;
  profileId: string;
  /** 建立会话时所依据机型规则的指纹；规则改动后旧步骤即失效 */
  ruleHash: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;

  // 校时
  /** 用户手机/挂钟的真实现在时刻（epoch ms） */
  realNow: number | null;
  /** 电饭煲屏显现在时刻（epoch ms，按真实日历对齐） */
  screenNow: number | null;
  /** 屏显 - 真实，分钟偏移（正=电饭煲快） */
  offsetMin: number | null;
  /** 校时方式：adjustClock=先拨准机内钟；compensate=不动钟，按偏差换算 */
  clockMode: 'adjust' | 'compensate' | null;

  // 开饭时间窗（真实时间，epoch ms）
  windowStart: number | null;
  windowEnd: number | null;

  // 选中的候选
  selected: SelectedCandidate | null;

  // 运行步骤
  steps: Step[];
  stepIndex: number;
  checkpoints: Checkpoint[];
  log: SessionLogEntry[];
}

export interface SelectedCandidate {
  meaning: Exclude<Meaning, 'unknown'>;
  digits: string; // 屏显数字，如 "18:30" 或 "3"
  token: string; // 完整屏显（含冒号/“小时”）
  /** 若看灯后辨认为其他含义，记录在此 */
  resolvedMeaning?: Exclude<Meaning, 'unknown'>;
  cookMin: number; // 该方案采用的煮制时长（范围内取值）
  predictedStartReal: number;
  predictedFinishReal: number;
}

// ---------- 候选 ----------

export interface Candidate {
  meaning: Exclude<Meaning, 'unknown'>;
  /** 屏显数字（去掉冒号外的修饰），用于“同数字”合并 */
  digits: string;
  /** 预期屏显全文 */
  token: string;
  /** 预约设定跨度（分钟） */
  spanMin: number;
  nearMax: boolean; // 接近机型最大跨度
  /** 预计开始/煮好（真实时间 epoch），完成时刻类为区间 */
  startReal: number;
  finishReal: number;
  finishRealLate: number;
  /** 内部设定值（分钟） */
  valueMin: number;
  /** 给老人的一句话解释 */
  plain: string;
}

// ---------- 引导步骤 ----------

export type StepKind =
  | 'standby'
  | 'program'
  | 'enterReserve'
  | 'observeMeaning'
  | 'adjustHour'
  | 'adjustMin'
  | 'verify'
  | 'start'
  | 'finishWait';

export interface StepLamp {
  key: LampKey;
  state: 'on' | 'blink' | 'off';
}

export interface StepOption {
  /** observeMeaning 步骤：选灯；其余为“情况不对”选项 */
  value: string;
  label: string;
  meaning?: Exclude<Meaning, 'unknown'>;
}

export interface Step {
  kind: StepKind;
  index: number;
  title: string;
  /** 本次要按的键；null 表示只需观察 */
  key: KeyId | null;
  keyLabel: string;
  /** 按键后预期屏显 */
  expectScreen: string;
  lamps: StepLamp[];
  /** 12 小时制时，预期上午/下午标识 */
  ampm?: 'AM' | 'PM';
  detail: string;
  isCheckpoint: boolean;
  checkpointNote?: string;
  /** observeMeaning 专用：各灯候选项 */
  options?: StepOption[];
}
