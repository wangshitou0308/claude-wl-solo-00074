import type { KeyId, LampKey, MachineProfile } from '../core/types';

interface CookerSvgProps {
  profile: MachineProfile;
  /** 屏显文字 */
  screen: string;
  /** 当前应按的键（高亮+脉冲） */
  activeKey: KeyId | null;
  /** 各灯状态 */
  lamps: { key: LampKey; state: 'on' | 'blink' | 'off' }[];
  ampm?: 'AM' | 'PM';
  /** 用户实际回报与预期是否一致（影响屏幕边框颜色） */
  match?: boolean | null;
}

const KEY_GEOM: Record<KeyId, { x: number; y: number; w: number; h: number }> = {
  power: { x: 24, y: 132, w: 60, h: 40 },
  menu: { x: 96, y: 232, w: 78, h: 40 },
  reserve: { x: 184, y: 232, w: 78, h: 40 },
  hour: { x: 186, y: 130, w: 60, h: 36 },
  min: { x: 258, y: 130, w: 60, h: 36 },
  up: { x: 330, y: 124, w: 56, h: 30 },
  down: { x: 330, y: 160, w: 56, h: 30 },
  start: { x: 272, y: 232, w: 78, h: 40 },
  cancel: { x: 360, y: 232, w: 40, h: 40 },
  warm: { x: 24, y: 184, w: 60, h: 36 },
};

export function CookerSvg({ profile, screen, activeKey, lamps, ampm, match }: CookerSvgProps) {
  const lampState = (k: LampKey) => lamps.find((l) => l.key === k)?.state ?? 'off';
  const klabel = (id: KeyId) => profile.keys.find((k) => k.id === id)?.label ?? id;

  // 时/分机型隐藏上下键，反之亦然
  const showUpDown = profile.adjust === 'upDown';

  const keyButton = (id: KeyId, opts?: { hide?: boolean; small?: boolean }) => {
    if (opts?.hide) return null;
    const g = KEY_GEOM[id];
    const active = activeKey === id;
    const label = klabel(id);
    const display =
      id === 'up'
        ? '+'
        : id === 'down'
          ? '−'
          : id === 'hour'
            ? '时'
            : id === 'min'
              ? '分'
              : label.length > (opts?.small ? 4 : 5)
                ? label.slice(0, 4)
                : label;
    return (
      <g key={id}>
        {active && (
          <rect
            x={g.x - 5}
            y={g.y - 5}
            width={g.w + 10}
            height={g.h + 10}
            rx={12}
            fill="none"
            stroke="#b8442c"
            strokeWidth={3}
            className="pulse-ring"
          />
        )}
        <rect
          x={g.x}
          y={g.y}
          width={g.w}
          height={g.h}
          rx={9}
          fill={active ? '#b8442c' : '#f3eee6'}
          stroke={active ? '#8f3320' : '#b9ad9d'}
          strokeWidth={1.5}
        />
        <text
          x={g.x + g.w / 2}
          y={g.y + g.h / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={display.length > 3 ? 12 : 14}
          fontWeight={700}
          fill={active ? '#fff' : '#453d33'}
        >
          {display}
        </text>
      </g>
    );
  };

  const lamp = (key: LampKey, x: number, y: number, short: string) => {
    const st = lampState(key);
    const fill = st === 'on' ? '#e8a21c' : st === 'blink' ? '#f0c35a' : '#cfc6b8';
    return (
      <g>
        <circle cx={x} cy={y} r={6.5} fill={fill} stroke="#8f8577" strokeWidth={1}>
          {st === 'blink' && (
            <animate attributeName="opacity" values="1;0.15;1" dur="1.1s" repeatCount="indefinite" />
          )}
        </circle>
        <text x={x + 11} y={y + 4} fontSize={11} fill="#5a5248">
          {short}
        </text>
      </g>
    );
  };

  const borderColor = match === false ? '#b02a2a' : match === true ? '#2e7d4f' : '#3a342c';

  return (
    <svg viewBox="0 0 420 300" role="img" aria-label="电饭煲面板示意图" style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf8f2" />
          <stop offset="1" stopColor="#e9e2d6" />
        </linearGradient>
      </defs>

      {/* 机身 */}
      <rect x={8} y={8} width={404} height={284} rx={22} fill="url(#body)" stroke="#c7bcab" strokeWidth={2} />

      {/* 屏幕 */}
      <rect x={96} y={28} width={228} height={86} rx={12} fill="#141a17" stroke={borderColor} strokeWidth={3} />
      <text
        x={210}
        y={72}
        textAnchor="middle"
        fontSize={40}
        fontWeight={800}
        fontFamily="'Courier New', monospace"
        fill="#8fe6a6"
        letterSpacing={3}
      >
        {screen}
      </text>
      {ampm && (
        <text x={112} y={52} fontSize={13} fill="#8fe6a6" fontWeight={700}>
          {ampm === 'AM' ? '上午' : '下午'}
        </text>
      )}
      <text x={310} y={104} textAnchor="end" fontSize={10} fill="#5c554b">
        屏显示意（以实物字样为准）
      </text>

      {/* 灯组 */}
      {lamp('power', 20, 36, '电源')}
      {lamp('program', 20, 60, '程序')}
      {lamp('reserve', 20, 84, '预约')}
      {lamp('reserveFinish', 336, 36, '完成')}
      {lamp('reserveDelay', 336, 60, '倒计时')}
      {lamp('reserveStart', 336, 84, '开始')}
      {lamp('cooking', 20, 108, '煮饭')}
      {lamp('keepWarm', 336, 108, '保温')}

      {/* 按键 */}
      {keyButton('power')}
      {keyButton('warm')}
      {showUpDown ? keyButton('up') : keyButton('hour')}
      {showUpDown ? keyButton('down') : keyButton('min')}
      {keyButton('menu')}
      {keyButton('reserve')}
      {keyButton('start')}
      {keyButton('cancel', { small: true })}

      {/* 高亮键说明箭头 */}
      {activeKey && (
        <g>
          {(() => {
            const g = KEY_GEOM[activeKey];
            return (
              <text x={g.x + g.w / 2} y={g.y - 12} textAnchor="middle" fontSize={13} fill="#b8442c" fontWeight={800}>
                ▼ 本次按这个
              </text>
            );
          })()}
        </g>
      )}
    </svg>
  );
}
