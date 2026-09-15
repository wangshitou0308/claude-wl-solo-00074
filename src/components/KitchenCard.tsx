import type { CSSProperties, ReactNode } from 'react';
import type { MachineProfile, Session } from '../core/types';
import { fmtDate, fmtSpan } from '../core/time';
import { meaningText } from '../core/steps';

interface Props {
  profile: MachineProfile;
  session: Session;
}

export function KitchenCard({ profile, session }: Props) {
  const sel = session.selected;
  const meaning = sel?.resolvedMeaning ?? sel?.meaning;
  return (
    <div className="card">
      <h2>本机厨房卡（可打印贴在电饭煲旁）</h2>
      <div
        style={{
          border: '2px dashed #b8442c',
          borderRadius: 12,
          padding: 16,
          background: '#fff',
        }}
      >
        <h3 style={{ margin: '0 0 6px', color: '#b8442c' }}>{profile.name} · 预约备忘</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
          <tbody>
            <tr>
              <Td k>时间制</Td>
              <Td>{profile.hourFormat === 'h12' ? '12 小时制（看上午/下午）' : '24 小时制'}</Td>
            </tr>
            <tr>
              <Td k>预约数字含义</Td>
              <Td>{meaning ? meaningText(meaning) : '—'}</Td>
            </tr>
            <tr>
              <Td k>调时键</Td>
              <Td>
                {profile.adjust === 'hourMin'
                  ? `“${profile.keys.find((k) => k.id === 'hour')?.label}”+“${
                      profile.keys.find((k) => k.id === 'min')?.label
                    }”`
                  : `“${profile.keys.find((k) => k.id === 'up')?.label}”/“${
                      profile.keys.find((k) => k.id === 'down')?.label
                    }”，每按 ${profile.granularityMin} 分钟`}
              </Td>
            </tr>
            <tr>
              <Td k>最大跨度</Td>
              <Td>{fmtSpan(profile.maxSpanMin)}</Td>
            </tr>
            <tr>
              <Td k>煮制时长</Td>
              <Td>
                {profile.cookMinMin}~{profile.cookMaxMin} 分钟
              </Td>
            </tr>
            {session.offsetMin !== null && session.clockMode === 'compensate' && (
              <tr>
                <Td k>机内钟偏差</Td>
                <Td>
                  {session.offsetMin === 0
                    ? '无'
                    : `比真实时间${session.offsetMin > 0 ? '快' : '慢'} ${fmtSpan(Math.abs(session.offsetMin))}，设点已自动换算`}
                </Td>
              </tr>
            )}
            {sel && (
              <>
                <tr>
                  <Td k>本次屏显数字</Td>
                  <Td style={{ fontSize: '1.3rem', fontWeight: 800, color: '#b8442c' }}>{sel.token}</Td>
                </tr>
                <tr>
                  <Td k>预计开煮/煮好</Td>
                  <Td>
                    {fmtDate(sel.predictedStartReal)} 开煮
                    <br />
                    {fmtDate(sel.predictedFinishReal)} 煮好
                  </Td>
                </tr>
              </>
            )}
          </tbody>
        </table>
        <ol style={{ marginTop: 10, paddingLeft: 20, marginBottom: 0 }}>
          <li>放米放水、盖盖，确认在待机（保温灯不亮）。</li>
          <li>
            按“{profile.keys.find((k) => k.id === 'menu')?.label}”选煮饭程序。
          </li>
          <li>
            按“{profile.keys.find((k) => k.id === 'reserve')?.label}”，看亮灯旁小字确认含义。
          </li>
          <li>
            把数字调到 <b>{sel?.token ?? '______'}</b>，核对上午/下午。
          </li>
          <li>
            按“{profile.keys.find((k) => k.id === 'start')?.label}”，预约灯常亮才算成功。
          </li>
        </ol>
        <p className="muted" style={{ marginTop: 8 }}>
          生成于 {fmtDate(Date.now())}；仅供本机参考，异常时按“取消”退回待机重来。
        </p>
      </div>
      <div className="big-btn-row no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          打印 / 另存为 PDF
        </button>
      </div>
    </div>
  );
}

function Td({ children, k, style }: { children: ReactNode; k?: boolean; style?: CSSProperties }) {
  return (
    <td
      style={{
        border: '1px solid #e3dccf',
        padding: '6px 9px',
        verticalAlign: 'top',
        fontWeight: k ? 700 : 400,
        width: k ? 120 : undefined,
        background: k ? '#faf5ee' : '#fff',
        ...style,
      }}
    >
      {children}
    </td>
  );
}
