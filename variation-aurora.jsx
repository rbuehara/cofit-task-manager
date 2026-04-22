// Aurora FINAL — paleta oficial do usuário
// Cores por status:
//   Inbox #6B7280 · A fazer #3B82F6 · Em andamento #F59E0B · Aguardando #06B6D4
//   Snooze #8B5CF6 · Concluído #22C55E · Algum dia #D1A5B0
//
// Decisões:
// • Header de coluna: estilo Aurora X (texto + número na MESMA cor do status)
//   mas no TAMANHO GRANDE (número em Fraunces 28px como na v3).
// • Título do card: Inter Tight 450, 16px, letter-spacing +0.1, lh 1.45 (Aurora Y).
// • 2 cards-opção do "aguardando triagem" no topo do Inbox (pra comparar).

const STATUS_HEX = {
  inbox:   '#9CA3AF',
  todo:    '#3B82F6',
  doing:   '#F59E0B',
  waiting: '#8B5CF6',
  snooze:  '#06B6D4',
  done:    '#22C55E',
  someday: '#E879A0',
};

// light variant (pill bg) via color-mix
const statusBg = (hex) => `color-mix(in oklch, ${hex} 18%, transparent)`;
const statusBgStrong = (hex) => `color-mix(in oklch, ${hex} 28%, transparent)`;

const AU = {
  bg: '#0c1224',
  surface: '#1a2240',
  surfaceHi: '#222b4d',
  surfaceAlt: '#0f1730',
  ink: '#eef1f7',
  inkMid: '#c2cae0',
  inkLow: '#8892ad',
  inkFaint: '#6a7391',
  hair: '#2a3352',
  hairSoft: '#1f284a',
  overdueInk: '#f59e0b',
  counterActive: '#06B6D4',
  counterDoing:  '#F59E0B',
  counterDone:   '#22C55E',
  waitStrong: '#f59e0b',
  waitCalm:   '#f87171',
};

const AU_TAG_HUE = { 'IPVA': 55, 'ITCD': 160, 'Legislação': 310, 'Sistemas/TI': 250, 'Institucional': 25 };

function AuTag({ name }) {
  const h = AU_TAG_HUE[name] ?? 220;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 500,
      background: `oklch(0.32 0.08 ${h} / 0.85)`, color: `oklch(0.88 0.11 ${h})`,
      padding: '3px 10px', borderRadius: 999, letterSpacing: 0.1, whiteSpace: 'nowrap',
    }}>{name}</span>
  );
}

function AuStatusPill({ name }) {
  const map = { 'A fazer':'todo','Em andamento':'doing','Concluído':'done','Aguardando':'waiting','Snooze':'snooze','Algum dia':'someday' };
  const hex = STATUS_HEX[map[name]] || '#888';
  return (
    <button style={{
      border: 'none', background: statusBg(hex), color: hex,
      fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 999,
      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    }}>{name}</button>
  );
}

function ZzzIcon({ color, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h3.5L3 7h3.5M7.5 6.5h3l-3 3h3"/>
    </svg>
  );
}

function AuCard({ task, status, expanded, waitVariant }) {
  const color = STATUS_HEX[status];
  const isOverdue = task.overdue;
  const isInbox = status === 'inbox';
  const isSnooze = status === 'snooze';
  const details = expanded ? window.TASK_DETAILS[`${status}-${task.n}`] : null;

  return (
    <div style={{
      background: expanded ? AU.surfaceHi : AU.surface,
      borderRadius: 10,
      marginBottom: 12,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: expanded
        ? '0 16px 48px rgba(0,0,0,.5), 0 0 0 1px '+AU.hair
        : '0 2px 0 rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px 0' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 0 3px ${color}22`, flexShrink: 0 }} />
        <div style={{ flex: 1, height: 2.5, borderRadius: 2, background: color, opacity: 0.9 }} />
        {isOverdue && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            fontSize: 10, fontWeight: 500, letterSpacing: 0.3,
            color: AU.overdueInk, border: `1px solid ${AU.overdueInk}66`,
            padding: '1px 7px', borderRadius: 999,
          }}>atrasado 3d</span>
        )}
      </div>

      <div style={{ padding: '11px 16px 16px' }}>
        <div style={{
          fontSize: 10, color: AU.inkLow, fontVariantNumeric: 'tabular-nums',
          letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 9,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontWeight: 500,
        }}>Tarefa · {String(task.n).padStart(2, '0')}</div>

        <div style={{
          fontFamily: '"Inter Tight", Inter, sans-serif',
          fontSize: 16, lineHeight: 1.45, color: AU.ink, letterSpacing: 0.1,
          fontWeight: 450, textAlign: 'justify', hyphens: 'auto', marginBottom: 14,
        }}>
          {task.title}
        </div>

        {task.tags && task.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: task.note ? 10 : 0 }}>
            {task.tags.map((t) => <AuTag key={t} name={t} />)}
          </div>
        )}

        {isSnooze && task.note && !expanded && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
            fontSize: 11.5, color: STATUS_HEX.snooze, fontWeight: 500,
            background: statusBg(STATUS_HEX.snooze),
            padding: '3px 9px', borderRadius: 999,
          }}>
            <ZzzIcon color={STATUS_HEX.snooze} />
            {task.note}
          </div>
        )}

        {!isSnooze && task.note && !expanded && (
          <div style={{ fontSize: 11.5, color: AU.inkMid, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ opacity: 0.6 }}>↳</span>{task.note}
          </div>
        )}

        {expanded && details && (
          <>
            <div style={{
              fontSize: 13.5, lineHeight: 1.65, color: AU.inkMid, marginTop: 4, marginBottom: 14,
              textAlign: 'justify', hyphens: 'auto',
            }}>
              {details.description}
            </div>
            <div style={{
              background: AU.surfaceAlt, padding: '10px 12px', borderRadius: 6,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10.5, color: AU.inkMid, lineHeight: 1.7, marginBottom: 14,
            }}>
              <div style={{ color: AU.ink, marginBottom: 4, fontFamily: 'Fraunces, serif', fontSize: 13, fontStyle: 'italic' }}>
                {details.slug}
              </div>
              <div><span style={{ color: AU.inkLow }}>Criado</span>   {details.criado}</div>
              <div><span style={{ color: AU.inkLow }}>Iniciado</span> {details.iniciado}</div>
            </div>

            {isInbox && waitVariant === 'text' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
                fontSize: 12.5, color: AU.waitStrong, fontWeight: 500,
              }}>
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="6" cy="6" r="4.5"/><path d="M6 3.5v3l1.8 1.2"/>
                </svg>
                No Inbox há <strong style={{ fontWeight: 700 }}>41 dias</strong> — aguardando triagem
              </div>
            )}
            {isInbox && waitVariant === 'badge' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 700, color: '#fff',
                  background: AU.waitCalm,
                  padding: '3px 9px', borderRadius: 999, letterSpacing: 0.3,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                }}>41d no Inbox</span>
                <span style={{ fontSize: 11.5, color: AU.waitCalm, fontStyle: 'italic' }}>aguardando triagem</span>
              </div>
            )}
          </>
        )}

        {(isInbox || expanded) && (
          <div style={{
            marginTop: 10, paddingTop: 12, borderTop: `1px solid ${AU.hairSoft}`,
            display: 'flex', flexWrap: 'wrap', gap: 5,
          }}>
            <div style={{ width: '100%', fontSize: 10, color: AU.inkLow, letterSpacing: 0.8,
              textTransform: 'uppercase', marginBottom: 6, fontWeight: 500,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>mover para</div>
            {['A fazer','Em andamento','Concluído','Aguardando','Snooze','Algum dia'].map((s) => <AuStatusPill key={s} name={s} />)}
          </div>
        )}

        {expanded && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${AU.hairSoft}`,
            display: 'flex', gap: 6, color: AU.inkLow }}>
            {[
              { i: '↑', t: 'subir' }, { i: '↓', t: 'descer' },
              { i: '✎', t: 'editar' }, { i: '⏰', t: 'snooze' }, { i: '🗑', t: 'excluir' },
            ].map((b) => (
              <button key={b.t} title={b.t} style={{
                background: AU.surfaceAlt, border: 'none',
                color: AU.inkMid, width: 30, height: 28, borderRadius: 6,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>{b.i}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AuColumn({ col, waitVariant }) {
  const color = STATUS_HEX[col.status];
  // header estilo Aurora X (MESMA cor) mas em tamanho grande (Fraunces 28)
  return (
    <div style={{ width: 276, flexShrink: 0 }}>
      <div style={{
        marginBottom: 16, paddingBottom: 12, display: 'flex', alignItems: 'baseline', gap: 12,
        borderBottom: `1px solid ${AU.hair}`,
      }}>
        <div style={{
          fontFamily: '"Inter Tight", sans-serif', fontSize: 19, fontWeight: 600,
          color, letterSpacing: -0.3, whiteSpace: 'nowrap', flex: 1,
        }}>{col.title}</div>
        <div style={{
          fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 500,
          color, lineHeight: 0.9, letterSpacing: -1, fontVariantNumeric: 'tabular-nums',
        }}>
          {String(col.count).padStart(2, '0')}
        </div>
      </div>
      <div>
        {col.tasks.map((t) => {
          const exp = (window.__EXPANDED_TASK__.col === col.id && window.__EXPANDED_TASK__.n === t.n)
                   || (window.__INBOX_EXPANDED__ && window.__INBOX_EXPANDED__.col === col.id && window.__INBOX_EXPANDED__.n === t.n);
          return <AuCard key={t.n} task={t} status={col.status} expanded={exp} waitVariant={waitVariant} />;
        })}
      </div>
    </div>
  );
}

function AuroraBoard({ waitVariant = 'text' }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: AU.bg,
      fontFamily: 'Manrope, "Inter Tight", sans-serif',
      color: AU.ink,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 28px', borderBottom: `1px solid ${AU.hair}`,
        display: 'flex', alignItems: 'center', gap: 22, background: AU.surfaceAlt,
      }}>
        <div style={{
          fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600,
          letterSpacing: -0.5, color: AU.ink,
        }}>Cofit</div>
        <div style={{
          fontFamily: 'Fraunces, serif', fontSize: 13, color: AU.inkMid,
          letterSpacing: 0.1, fontStyle: 'italic',
        }}>Task Manager</div>
        <div style={{ height: 16, width: 1, background: AU.hair }} />

        <div style={{ display: 'flex', gap: 22, fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 500 }}>
          <span style={{ color: AU.counterActive }}>
            <strong style={{ fontWeight: 700 }}>17</strong>
            <span style={{ opacity: 0.80, marginLeft: 6 }}>ativas</span>
          </span>
          <span style={{ color: AU.counterDoing }}>
            <strong style={{ fontWeight: 700 }}>2</strong>
            <span style={{ opacity: 0.80, marginLeft: 6 }}>em andamento</span>
          </span>
          <span style={{ color: AU.counterDone }}>
            <strong style={{ fontWeight: 700 }}>0</strong>
            <span style={{ opacity: 0.80, marginLeft: 6 }}>concluídas hoje</span>
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <button style={{
          background: 'linear-gradient(180deg, #eef1f7, #c8cfe0)', color: AU.bg,
          border: 'none', padding: '7px 15px', borderRadius: 999,
          fontSize: 13, fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer',
          letterSpacing: -0.1,
        }}>+ Nova tarefa</button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', padding: '24px 28px 0', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {BOARD_DATA.map((c) => <AuColumn key={c.id} col={c} waitVariant={waitVariant} />)}
      </div>
    </div>
  );
}

window.AuroraBoard = AuroraBoard;
