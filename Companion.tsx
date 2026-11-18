import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CharSprite } from './chars'
import { usePet } from './PetContext'
import { getPrefs } from './prefs'

// Roaming mini-companion on every page. The layer never takes pointer events; only the 56px sprite (and the little peek tab) can be tapped.
const HIDE_ON = /^\/(admin|login|admin-login|leo|profile|u\/|welcome)/
const BLOCK = 'a,button,input,textarea,select,label,summary,h1,h2,h3,h4,h5,h6,p,li,td,th,img:not(.cs img),svg:not(.cs svg),canvas,video,[role="button"],.pet-card,.pet-bub'
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
type Mode = 'roam' | 'follow' | 'stay' | 'sleep'

// slow or low-power devices never mount it (it stays completely off, no timers, no images)
export const lowPower = () => {
  const n = navigator as any
  return (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2) || !!n.connection?.saveData || getPrefs().lite ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export default function Companion() {
  const { status, active, settings, mood: petMood, calm, quiet, setCompanion, boot } = usePet()
  const { pathname } = useLocation(); const nav = useNavigate()
  const cfg = settings?.companion ?? { on: true, mode: 'roam' as Mode }; const mode = (cfg.mode ?? 'roam') as Mode
  const [pos, setPos] = useState({ x: 24, y: 0 }); const [face, setFace] = useState(1); const [walking, setWalking] = useState(false)
  const [menu, setMenu] = useState(false); const [over, setOver] = useState(''); const [sit, setSit] = useState(false); const [idleSleep, setIdleSleep] = useState(false)
  const [peek, setPeek] = useState(false); const [ready, setReady] = useState(false); const [sadStart, setSadStart] = useState(false)
  const S = window.innerWidth < 480 ? 48 : 58
  const st = useRef({ pos, mode, menu, walking: false }); st.current = { pos, mode, menu, walking }
  const tm = useRef<number[]>([]); const lastAct = useRef(Date.now()); const wave = useRef(false)
  const off = useMemo(() => lowPower(), [])

  const base = useCallback(() => { const tb = document.querySelector('.tabbar') as HTMLElement | null; return window.innerHeight - (tb?.offsetHeight ?? 0) - 6 }, [])
  const clamp = useCallback((x: number, y: number) => ({ x: Math.max(4, Math.min(window.innerWidth - S - 4, x)), y: Math.max(S + 60, Math.min(base(), y)) }), [S, base])
  // a spot is clear when none of the sprite's sample points touches a button, link, field or text block
  const clear = useCallback((x: number, y: number) => {
    const pts = [[x + S / 2, y - 4], [x + 6, y - S / 2], [x + S - 6, y - S / 2], [x + S / 2, y - S + 6], [x + S / 2, y - S / 2]]
    return pts.every(([px, py]) => { try { return !document.elementsFromPoint(px, py).some(e => !e.closest('.comp-layer') && e.matches(BLOCK)) } catch { return true } })
  }, [S])
  const move = useCallback((x: number, y: number, ms?: number) => {
    const p = st.current.pos; const c = clamp(x, y); const d = Math.hypot(c.x - p.x, c.y - p.y)
    if (d < 6) return; setFace(c.x < p.x ? -1 : 1); setSit(false); setWalking(true)
    setPos(c); const t = ms ?? Math.max(600, Math.min(4000, d * 9)); document.documentElement.style.setProperty('--comp-ms', t + 'ms')
    tm.current.push(window.setTimeout(() => setWalking(false), t))
  }, [clamp])
  const say = (e: string, ms = 2200) => { setOver(e); window.setTimeout(() => setOver(o => (o === e ? '' : o)), ms) }

  // mount only when the browser is idle, so it can never slow the page load
  useEffect(() => {
    if (off) return
    const go = () => { setPos(clamp(window.innerWidth - S - 90, base())); setReady(true) }
    const ric = (window as any).requestIdleCallback as undefined | ((f: () => void, o?: object) => number)
    const id = ric ? ric(go, { timeout: 2500 }) : window.setTimeout(go, 1500)
    return () => { if (ric) (window as any).cancelIdleCallback?.(id); else window.clearTimeout(id) }
  }, [off])

  // reactions: wave on login, celebrate on glory, sad when the member has been away, sleepy when idle
  useEffect(() => {
    if (!ready || status !== 'ready') return
    if (!wave.current) {
      wave.current = true; say('👋', 3000)
      const last = Number(localStorage.getItem('sym_last_visit') || 0); if (last && Date.now() - last > 2 * 86400e3) setSadStart(true)
    }
    localStorage.setItem('sym_last_visit', String(Date.now()))
    const cele = () => { say('🎉', 3500); setSadStart(false) }
    window.addEventListener('sym-glory-submitted', cele); return () => window.removeEventListener('sym-glory-submitted', cele)
  }, [ready, status])
  useEffect(() => {
    if (!ready) return
    const act = () => { lastAct.current = Date.now(); setIdleSleep(false) }
    const ev = ['pointerdown', 'keydown', 'scroll']; ev.forEach(e => window.addEventListener(e, act, { passive: true }))
    const t = window.setInterval(() => { if (Date.now() - lastAct.current > 60000) setIdleSleep(true) }, 5000)
    return () => { ev.forEach(e => window.removeEventListener(e, act)); window.clearInterval(t) }
  }, [ready])

  // roam: walk, idle, sit, and nap on its own, always choosing a spot clear of buttons and text
  useEffect(() => {
    if (!ready || !cfg.on || mode !== 'roam' || calm) return
    let alive = true; let t = 0
    const tick = () => {
      if (!alive) return
      if (document.visibilityState === 'visible' && !st.current.menu) {
        const r = Math.random()
        if (r < 0.22) setSit(s => !s)
        else if (r < 0.9) {
          for (let i = 0; i < 8; i++) {
            const x = Math.random() < 0.5 ? rnd(4, window.innerWidth * 0.3) : rnd(window.innerWidth * 0.5, window.innerWidth - S - 4); const y = base()
            if (clear(x, y)) { move(x, y); break }
          }
        }
      }
      t = window.setTimeout(tick, rnd(3500, 7500))
    }
    t = window.setTimeout(tick, 2500); return () => { alive = false; window.clearTimeout(t) }
  }, [ready, cfg.on, mode, calm, clear, move, base])

  // follow my finger / cursor (offset to the side so it never sits under the pointer)
  useEffect(() => {
    if (!ready || !cfg.on || mode !== 'follow') return
    let raf = 0; let px = 0, py = 0
    const f = (e: PointerEvent) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(() => { raf = 0; document.documentElement.style.setProperty('--comp-ms', '450ms'); const c = clamp(px + 34, py + 30); setFace(c.x < st.current.pos.x ? -1 : 1); setSit(false); setWalking(true); setPos(c); window.setTimeout(() => setWalking(false), 460) }) }
    window.addEventListener('pointermove', f, { passive: true }); return () => { window.removeEventListener('pointermove', f); if (raf) cancelAnimationFrame(raf) }
  }, [ready, cfg.on, mode, clamp])
  useEffect(() => { const r = () => setPos(p => clamp(p.x, p.y)); window.addEventListener('resize', r); return () => { window.removeEventListener('resize', r); tm.current.forEach(clearTimeout) } }, [clamp])
  useEffect(() => { setMenu(false) }, [pathname])

  if (off || !ready || !boot || !settings || !active || status !== 'ready') return null
  if (HIDE_ON.test(pathname)) return null
  if (!cfg.on) return (
    <button className="comp-peek" onClick={() => { setPeek(true); setCompanion({ on: true }); window.setTimeout(() => setPeek(false), 900) }} aria-label="Bring your companion back" title="Tap to bring your companion back">🫣</button>)

  const emo = mode === 'sleep' || idleSleep ? 'sleepy' : sadStart ? 'sad' : active.happiness < 40 ? 'sad' : active.energy < 35 ? 'sleepy' : over === '🎉' ? 'excited' : over === '👋' ? 'excited' : over ? 'idle' : sit ? 'idle' : petMood === 'sleepy' ? 'sleepy' : 'idle'
  const set = (patch: Record<string, unknown>) => { setCompanion(patch); setMenu(false) }
  const tap = () => { setSadStart(false); lastAct.current = Date.now(); setIdleSleep(false); setMenu(m => !m) }
  const emote = () => { const e = ['😄', '💖', '✨', '🎵', '😎'][Math.floor(Math.random() * 5)]; say(e, 1800); setMenu(false) }
  const pose = () => { setSit(false); setOver('🤸'); window.setTimeout(() => setOver(''), 1600); setMenu(false) }
  const left = pos.x + S / 2 > window.innerWidth / 2

  return (
    <div className="comp-layer" aria-hidden={false}>
      <div className={'comp' + (walking ? ' walking' : '') + (sit ? ' sitting' : '') + (over === '🤸' ? ' posing' : '')} style={{ transform: `translate(${pos.x}px, ${pos.y - S}px)`, width: S, height: S, pointerEvents: mode === 'follow' ? 'none' : 'auto' }}>
        <button className="comp-body" onClick={tap} aria-label={`${active.name} the companion. Tap for options`} aria-expanded={menu}>
          <div style={{ transform: `scaleX(${face})` }}><CharSprite ch={active.char_key} look={active.appearance} emotion={emo} size={S} sit={sit} label={active.name} /></div>
        </button>
        {over && over !== '🤸' && !quiet && <span className="comp-emo" aria-hidden="true">{over}</span>}
        {menu && (
          <div className={'comp-menu glass ' + (left ? 'l' : 'r')} role="menu" aria-label="Companion menu">
            <button role="menuitem" onClick={pose}>🤸 Pose</button><button role="menuitem" onClick={emote}>😄 Emote</button>
            <button role="menuitem" onClick={() => { setMenu(false); nav('/leo') }}>🏠 Go home</button>
            <button role="menuitem" aria-pressed={mode === 'follow'} onClick={() => set({ mode: mode === 'follow' ? 'roam' : 'follow' })}>🧲 {mode === 'follow' ? 'Stop following' : 'Follow me'}</button>
            <button role="menuitem" aria-pressed={mode === 'stay'} onClick={() => set({ mode: mode === 'stay' ? 'roam' : 'stay' })}>📍 {mode === 'stay' ? 'Roam again' : 'Stay here'}</button>
            <button role="menuitem" aria-pressed={mode === 'sleep'} onClick={() => set({ mode: mode === 'sleep' ? 'roam' : 'sleep' })}>😴 {mode === 'sleep' ? 'Wake up' : 'Sleep'}</button>
            <button role="menuitem" onClick={() => { setMenu(false); setCompanion({ on: false }) }}>🫣 Hide</button>
          </div>)}
      </div>
      {peek && <span className="comp-peek-in">🫣</span>}
    </div>
  )
}
