import { ALL_KEYS, ALL_LAMPS } from '../core/defaults';
import type { AdjustKind, HourFormat, MachineProfile, Meaning } from '../core/types';

interface Props {
  profile: MachineProfile;
  onChange: (p: MachineProfile) => void;
  onSave: () => void;
  onNew: () => void;
  saved: boolean;
}

function num(v: string, fb: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fb;
}

const MEANINGS: { v: Meaning; label: string; help: string }[] = [
  { v: 'finishAtClock', label: '预约完成时刻', help: '设的是“几点煮好”，如 18:30 煮好' },
  { v: 'startAtClock', label: '开始时刻', help: '设的是“几点开始煮”，如 17:40 开煮' },
  { v: 'delayFinishHours', label: '延后小时数=距煮好', help: '设“几小时后好”，如 3 表示 3 小时后煮好' },
  { v: 'delayStartHours', label: '延后小时数=距开煮', help: '设“几小时后煮”，如 3 表示 3 小时后开煮' },
  { v: 'unknown', label: '说明书没写清（看灯辨认）', help: '引导时会让你观察模式灯再确定' },
];

export function ProfileForm({ profile, onChange, onSave, onNew, saved }: Props) {
  const set = <K extends keyof MachineProfile>(k: K, v: MachineProfile[K]) =>
    onChange({ ...profile, [k]: v, updatedAt: Date.now() });

  const setKeyLabel = (id: string, label: string) =>
    onChange({
      ...profile,
      keys: profile.keys.map((k) => (k.id === id ? { ...k, label } : k)),
      updatedAt: Date.now(),
    });
  const setLampLabel = (key: string, label: string) =>
    onChange({
      ...profile,
      lamps: profile.lamps.map((l) => (l.key === key ? { ...l, label } : l)),
      updatedAt: Date.now(),
    });

  return (
    <div className="card no-print">
      <h2>① 登记机型资料</h2>
      <p className="hint">照着说明书或电饭煲实物填写。资料只存在这台电脑/手机的浏览器里。</p>

      <div className="field">
        <label>机型称呼</label>
        <input type="text" value={profile.name} onChange={(e) => set('name', e.target.value)} placeholder="如：美的 MB-FB40" />
      </div>

      <div className="row2">
        <div className="field">
          <label>屏幕是 12 小时制还是 24 小时制？</label>
          <div className="seg">
            {(['h12', 'h24'] as HourFormat[]).map((h) => (
              <button key={h} className={profile.hourFormat === h ? 'sel' : ''} onClick={() => set('hourFormat', h)}>
                {h === 'h12' ? '12 小时制（有上午/下午）' : '24 小时制（如 18:30）'}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>调时间用哪组键？</label>
          <div className="seg">
            {([
              ['hourMin', '“时 / 分”两个键'],
              ['upDown', '“上 / 下（+/-）”键'],
            ] as [AdjustKind, string][]).map(([v, label]) => (
              <button key={v} className={profile.adjust === v ? 'sel' : ''} onClick={() => set('adjust', v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field">
        <label>“预约”键设的数字是什么含义？</label>
        <div className="seg">
          {MEANINGS.map((m) => (
            <button
              key={m.v}
              className={profile.meaning === m.v ? 'sel' : ''}
              onClick={() => set('meaning', m.v)}
              title={m.help}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="desc">{MEANINGS.find((m) => m.v === profile.meaning)?.help}</div>
      </div>

      <div className="row3">
        <div className="field">
          <label>设定粒度（分钟）</label>
          <div className="desc">按一下加减，数字跳多少分，常见 10 或 1</div>
          <input
            type="number"
            min={1}
            value={profile.granularityMin}
            onChange={(e) => set('granularityMin', num(e.target.value, 10))}
          />
        </div>
        <div className="field">
          <label>最大预约跨度（小时）</label>
          <div className="desc">说明书“最长可预约”，常见 12 / 13 / 24</div>
          <input
            type="number"
            min={1}
            value={Math.round(profile.maxSpanMin / 60)}
            onChange={(e) => set('maxSpanMin', num(e.target.value, 24) * 60)}
          />
        </div>
        <div className="field">
          <label>带机内时钟屏？</label>
          <div className="seg">
            <button className={profile.hasClock ? 'sel' : ''} onClick={() => set('hasClock', true)}>
              有（平时显示几点）
            </button>
            <button className={!profile.hasClock ? 'sel' : ''} onClick={() => set('hasClock', false)}>
              没有
            </button>
          </div>
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>煮制时长：最短（分钟）</label>
          <div className="desc">该程序从开煮到能吃的最短时间，如 40</div>
          <input
            type="number"
            min={1}
            value={profile.cookMinMin}
            onChange={(e) => set('cookMinMin', num(e.target.value, 40))}
          />
        </div>
        <div className="field">
          <label>煮制时长：最长（分钟）</label>
          <div className="desc">不确定就把范围放宽些，如 40 ~ 70</div>
          <input
            type="number"
            min={1}
            value={profile.cookMaxMin}
            onChange={(e) => set('cookMaxMin', num(e.target.value, 60))}
          />
        </div>
      </div>

      <details className="field">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>按键与指示灯字样（按实物核对，选填）</summary>
        <div className="row2" style={{ marginTop: 8 }}>
          <div>
            {ALL_KEYS.map((k) => {
              const cur = profile.keys.find((x) => x.id === k.id);
              return (
                <div className="field" key={k.id} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: '0.85rem' }}>{k.defaultLabel}</label>
                  <input
                    type="text"
                    value={cur?.label ?? ''}
                    onChange={(e) => setKeyLabel(k.id, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
          <div>
            {ALL_LAMPS.map((l) => {
              const cur = profile.lamps.find((x) => x.key === l.key);
              return (
                <div className="field" key={l.key} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: '0.85rem' }}>{l.defaultLabel}</label>
                  <input
                    type="text"
                    value={cur?.label ?? ''}
                    onChange={(e) => setLampLabel(l.key, e.target.value)}
                  />
                </div>
              );
            })}
            <div className="field" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: '0.85rem' }}>完成时刻灯旁提示</label>
              <input type="text" value={profile.lampFinishHint} onChange={(e) => set('lampFinishHint', e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: '0.85rem' }}>倒计时灯旁提示</label>
              <input type="text" value={profile.lampDelayHint} onChange={(e) => set('lampDelayHint', e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: '0.85rem' }}>开始时刻灯旁提示</label>
              <input type="text" value={profile.lampStartHint} onChange={(e) => set('lampStartHint', e.target.value)} />
            </div>
          </div>
        </div>
      </details>

      <div className="big-btn-row">
        <button className="btn btn-primary" onClick={onSave}>
          {saved ? '已保存，点此更新机型资料' : '保存机型资料'}
        </button>
        <button className="btn btn-ghost" onClick={onNew}>
          另建一个机型
        </button>
        {saved && <span className="privacy">✓ 已存入本机浏览器</span>}
      </div>
    </div>
  );
}
