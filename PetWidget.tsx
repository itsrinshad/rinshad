import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Leo } from './Leo'
import { foodView } from './chars'
import { usePet } from './PetContext'
import { getPrefs } from './prefs'
import { blip, needText, PAGE_LINES } from './petCore'
import { useReader } from './PetReader'

const Bar = ({ label, v, c }: { label: string; v: number; c: string }) => (
  <div className="pet-bar" title={`${label}: ${v}/100`}><span>{label}</span><i role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}><b style={{ width: v + '%', background: c }} /></i></div>
)

// Floating companion. It lives outside the page routes, so it travels with the member from page to page.
export function PetWidget() {
  const { status, error, active, settings, bubble, fx, mood, quiet, sound, items, inv, owns, boot, care, say, sayText, playFx, setSettings, refresh, moment, calm, busy } = usePet()
  const { pathname } = useLocation()
  const [panel, setPanel] = useState(false); const [feed, setFeed] = useState(false); const [off, setOff] = useState(!getPrefs().leo)
  const seen = useRef<Set<string>>(new Set())
  const reader = useReader(pathname, () => say('read_done'))
  useEffect(() => { const f = () => setOff(!getPrefs().leo); window.addEventListener('sym-prefs', f); return () => window.removeEventListener('sym-prefs', f) }, [])

  // reacts to the page the member opens (short authored lines, shown once per page per visit) and records the small "explore" moment
  useEffect(() => {
    if (status !== 'ready') return
    const hit = PAGE_LINES.find(p => p.test.test(pathname)); if (!hit) return
    const t = window.setTimeout(() => {
      moment('explore', hit.key)
      if (!seen.current.has(hit.key) && settings?.widget_state !== 'hidden') { seen.current.add(hit.key); sayText(hit.line, 'happy') }
    }, 700)
    return () => window.clearTimeout(t)
  }, [pathname, status])

  if (off || !settings || (status !== 'ready' && status !== 'offline') || settings.widget_state === 'hidden') return null
  if (pathname.startsWith('/admin') || pathname === '/login') return null

  const set = (w: 'open' | 'min' | 'hidden') => { setPanel(false); setFeed(false); setSettings({ widget_state: w }) }
  const foods = items.filter(i => i.kind === 'food' && owns(i.code))
  const look = active?.appearance
  const tap = () => { playFx(); blip('pop', sound); if (!quiet && !bubble) say('idle') }

  if (settings.widget_state === 'min') return (
    <button className="leo-fab pet-min" onClick={() => set('open')} aria-label={`Open ${active?.name ?? 'LEO'}`} title={`Open ${active?.name ?? 'LEO'}`}>
      <Leo emotion={mood} size={52} look={look} char={active?.char_key} label={active?.name ?? 'LEO'} />
    </button>)

  return (
    <div className="leo-widget" role="complementary" aria-label={`${active?.name ?? 'LEO'}, your companion`}>
      {bubble && !panel && <div className="pet-bub" role="status" aria-live="polite" onClick={() => { /* click to dismiss */ }}>{bubble.text}</div>}
      {panel && (
        <div className="pet-card glass" role="dialog" aria-label="LEO companion panel">
          <div className="flex items-center gap-2 mb-1">
            <b className="truncate">{active?.name ?? 'LEO'}</b><span className="text-[11px] text-gray-400 truncate">{active ? needText(active) : ''}</span>
            <button className="pet-x ml-auto" onClick={() => setPanel(false)} aria-label="Close panel">✕</button>
          </div>
          {status === 'offline' && <div className="pet-warn" role="alert">{error || 'LEO is offline.'} <button className="underline" onClick={refresh}>Retry</button></div>}
          {active && <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
            <Bar label="Tummy" v={active.hunger} c="#f59e0b" /><Bar label="Energy" v={active.energy} c="#22d3ee" /><Bar label="Happy" v={active.happiness} c="#f472b6" /><Bar label="Curious" v={active.curiosity} c="#a78bfa" /><Bar label="Friendly" v={active.friendliness} c="#34d399" />
          </div>}
          {!feed && <div className="grid grid-cols-4 gap-1">
            <button className="pet-act" disabled={busy || !active} onClick={() => setFeed(true)}><span>🍪</span>Feed</button>
            <button className="pet-act" disabled={busy || !active} onClick={() => active && care(active.id, 'play')}><span>🎮</span>Play</button>
            <button className="pet-act" disabled={busy || !active} onClick={() => active && care(active.id, 'rest')}><span>😴</span>Rest</button>
            <button className="pet-act" disabled={busy || !active} onClick={() => active && care(active.id, 'cuddle')}><span>🤗</span>Cuddle</button>
          </div>}
          {feed && <div>
            <div className="flex flex-wrap gap-1">{foods.map(f => { const q = inv.get(f.code)?.qty; return (
              <button key={f.code} className="pet-act !w-auto px-2" disabled={busy} onClick={async () => { if (active) { await care(active.id, 'feed', f.code); setFeed(false) } }} title={f.description}><img className="food-thumb" alt="" src={foodView(f.code, active?.char_key ?? 'leo', f).src} />{foodView(f.code, active?.char_key ?? 'leo', f).name}{f.unlock.type === 'free' || boot?.is_admin ? ' ∞' : ` ×${q}`}</button>) })}
              {!foods.length && <p className="text-xs text-gray-400">No food yet. Check the LEO space for a daily treat.</p>}</div>
            <button className="text-xs underline text-gray-400 mt-1" onClick={() => setFeed(false)}>Back</button>
          </div>}

          <div className="pet-read mt-2">
            {reader.allowed ? (reader.state === 'idle'
              ? <button className="sym-btn !py-1 w-full" onClick={() => { if (reader.start()) say('read_start', {}, true); else sayText('There is nothing here for me to read yet.', 'confused', true) }}>📖 Read with me</button>
              : <div role="group" aria-label="Reading controls">
                <div className="flex gap-1 items-center">
                  <button className="pet-act !w-auto px-2" onClick={reader.prev} aria-label="Previous paragraph">⏮</button>
                  {reader.state === 'playing' ? <button className="pet-act !w-auto px-3" onClick={reader.pause} aria-label="Pause">⏸</button> : <button className="pet-act !w-auto px-3" onClick={reader.resume} aria-label="Play">▶</button>}
                  <button className="pet-act !w-auto px-2" onClick={reader.next} aria-label="Next paragraph">⏭</button>
                  <button className="pet-act !w-auto px-3" onClick={reader.stop} aria-label="Stop reading">⏹</button>
                  <span className="text-[11px] text-gray-400 ml-auto">{reader.idx + 1}/{reader.total}</span>
                </div>
                <div className="flex gap-2 items-center mt-1 text-[11px] text-gray-300">
                  <label className="flex items-center gap-1">Speed<input type="range" min={0.6} max={1.5} step={0.1} value={reader.rate} onChange={e => reader.setRate(Number(e.target.value))} aria-label="Reading speed" /></label>
                  {reader.supported && reader.voices.length > 0 && <select className="sym-inp !mb-0 !py-0.5 !text-[11px] min-w-0" value={reader.voiceName} onChange={e => reader.setVoiceName(e.target.value)} aria-label="Voice"><option value="">Auto voice</option>{reader.voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select>}
                </div>
                {!reader.supported && <p className="text-[11px] text-amber-300 mt-1">This browser cannot speak, but I will still highlight each part. Use ⏭ to move along.</p>}
              </div>)
              : <p className="text-[11px] text-gray-500">“Read with me” works on Home, Rules, News, Polls, Leaderboard, Achievements and Members. Private pages are never read.</p>}
          </div>
          <div className="flex gap-1 mt-2">
            <Link to="/leo" className="sym-btn !py-1 flex-1 text-center text-sm" onClick={() => setPanel(false)}>🏠 LEO space</Link>
            <button className="sym-btn !py-1 text-sm" onClick={() => set('min')} aria-label="Minimize LEO">▁</button>
            <button className="sym-btn !py-1 text-sm" onClick={() => set('hidden')} aria-label="Hide LEO (bring it back from the LEO space)">🙈</button>
          </div>
        </div>)}
      <button className="pet-body" onClick={tap} onDoubleClick={() => setPanel(p => !p)} aria-label={`${active?.name ?? 'LEO'}. Tap to say hi`}>
        <Leo emotion={mood} size={78} talking={!!bubble && !calm} look={look} char={active?.char_key} fx={fx} label={active?.name ?? 'LEO'} />
      </button>
      <button className="pet-toggle" onClick={() => setPanel(p => !p)} aria-expanded={panel} aria-label={panel ? 'Close LEO panel' : 'Open LEO panel'}>{panel ? '▾' : '▴'}</button>
      {quiet && <span className="pet-q" title="Quiet mode is on">🤫</span>}
    </div>
  )
}
