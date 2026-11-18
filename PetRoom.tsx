import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CharSprite, imgUrl } from './chars'
import { BGS } from './catalog'
import { usePetSafe } from './PetContext'
import { bgCode, BACKGROUNDS, type SitAnchor, type Walk } from './petCore'

export type Placed = { code: string; x: number; y: number }
const FALLBACK_WALK: Walk = { x0: 30, x1: 70, y0: 72, y1: 86 }
const SIT_ITEMS = new Set(['furn_sofa'])            // placed furniture the character may sit on (backgrounds bring their own anchors)
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

export type RoomInfo = { src: string; walk: Walk; sit: SitAnchor[] }
// background art + walk zone + sit anchors: the five PDF rooms are built in; approved uploads carry them in item.meta (admin-set)
export function useRoomInfo(background?: string | null): RoomInfo {
  const pet = usePetSafe(); const code = bgCode(background)
  return useMemo(() => {
    const b = BGS.find(x => x.code === code)
    if (b) return { src: `/assets/bg/${b.code}.jpg`, walk: b.walk, sit: b.sits }
    const it = pet?.itemMap.get(code)
    if (it?.img) return { src: imgUrl(it.img), walk: it.meta?.walk ?? FALLBACK_WALK, sit: it.meta?.sit ?? [] }
    return { src: '', walk: FALLBACK_WALK, sit: [] }
  }, [code, pet?.itemMap])
}

/** The 16:9 room. The mini character walks between random waypoints (every 4-8 s), flips to face its direction, and sits when a sofa/bench/cushion is tapped. */
export function PetRoom({ background, items, emojiOf, nameOf, look, char = 'leo', mood = 'happy', petName = 'LEO', selected, onSelect, onPick, hidePet, fx = '', calm = false,
  visitor, onFurniture, reaction, className = '', children }: {
  background?: string; items: Placed[]; emojiOf: (c: string) => string; nameOf?: (c: string) => string; look?: unknown; char?: string; mood?: string; petName?: string; variant?: string
  selected?: number | null; onSelect?: (i: number) => void; onPick?: (x: number, y: number) => void; hidePet?: boolean; fx?: string; calm?: boolean
  visitor?: boolean; onFurniture?: (code: string) => void; reaction?: string; className?: string; children?: React.ReactNode
}) {
  const edit = !!onSelect; const info = useRoomInfo(background); const w = info.walk
  const box = useRef<HTMLDivElement>(null); const [W, setW] = useState(320)
  const [pos, setPos] = useState({ x: (w.x0 + w.x1) / 2, y: (w.y0 + w.y1) / 2 }); const [face, setFace] = useState(1); const [mode, setMode] = useState<'idle' | 'walk' | 'sit'>('idle'); const [dur, setDur] = useState(0)
  const st = useRef({ pos, mode, vis: true, hold: 0 }); st.current.pos = pos; st.current.mode = mode
  const timers = useRef<number[]>([]); const clear = () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = [] }
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth || 320)); ro.observe(el); setW(el.clientWidth || 320)
    const io = new IntersectionObserver(e => { st.current.vis = !!e[0]?.isIntersecting }, { threshold: 0.05 }); io.observe(el); return () => { ro.disconnect(); io.disconnect() } }, [])

  const goTo = useCallback((x: number, y: number, then: 'idle' | 'sit' = 'idle') => {
    const p = st.current.pos; const dist = Math.hypot((x - p.x) * 1.78, y - p.y); const ms = calm ? 120 : Math.max(500, Math.min(3600, dist * 70))
    if (Math.abs(x - p.x) > 0.6) setFace(x < p.x ? -1 : 1)
    clear(); setMode('walk'); setDur(ms); setPos({ x, y }); later(() => setMode(then), ms + 30)
  }, [calm])

  // autonomous walk: a new random waypoint inside the walk zone every 4-8 seconds (paused when hidden, off-screen, being edited or on Calm motion)
  useEffect(() => {
    if (edit || hidePet || calm) return
    let alive = true; let t = 0
    const tick = () => {
      if (!alive) return
      if (document.visibilityState === 'visible' && st.current.vis && Date.now() > st.current.hold) goTo(rnd(w.x0, w.x1), rnd(w.y0, w.y1))
      t = window.setTimeout(tick, rnd(4000, 8000))
    }
    t = window.setTimeout(tick, rnd(1500, 3500))
    return () => { alive = false; window.clearTimeout(t) }
  }, [edit, hidePet, calm, w.x0, w.x1, w.y0, w.y1, goTo])
  useEffect(() => { setPos({ x: (w.x0 + w.x1) / 2, y: (w.y0 + w.y1) / 2 }); setMode('idle'); return clear }, [info.src, edit])

  const sitAt = (a: { x: number; y: number }) => { if (edit || hidePet) return; st.current.hold = Date.now() + 14000; goTo(a.x, a.y, 'sit') }   // stays seated ~10 s before wandering again
  const anchors = useMemo(() => [...info.sit, ...items.filter(i => SIT_ITEMS.has(i.code)).map(i => ({ x: i.x, y: Math.min(95, i.y + 2), label: 'Sofa' }))], [info.sit, items])
  const sz = Math.max(40, W * 0.26) * Math.max(0.8, Math.min(1.12, 0.86 + (pos.y - 60) / 120))
  const shown = mode === 'sit' ? (mood === 'sleepy' || mood === 'sad' ? mood : 'idle') : mode === 'walk' ? 'idle' : mood

  return (
    <div ref={box} className={'pet-room room16 ' + className} style={info.src ? undefined : { background: BACKGROUNDS[bgCode(background)] ?? BACKGROUNDS.bg_day }} role="img"
      aria-label={`${petName}'s room with ${items.length} item${items.length === 1 ? '' : 's'}`}
      onClick={e => { if (!onPick) return; const r = e.currentTarget.getBoundingClientRect(); onPick(Math.round((e.clientX - r.left) / r.width * 100), Math.round((e.clientY - r.top) / r.height * 100)) }}>
      {info.src && <img className="room-bg" src={info.src} alt="" draggable={false} decoding="async" />}
      {edit && <div className="room-zone" style={{ left: w.x0 + '%', top: w.y0 + '%', width: (w.x1 - w.x0) + '%', height: (w.y1 - w.y0) + '%' }} aria-hidden="true" />}
      {items.map((it, i) => {
        const sty = { left: it.x + '%', top: it.y + '%', zIndex: Math.round(it.y) }
        if (edit) return <button key={i} className={'pet-it' + (selected === i ? ' sel' : '')} style={sty} onClick={e => { e.stopPropagation(); onSelect!(i) }} aria-label={`${nameOf?.(it.code) ?? it.code}${selected === i ? ' (selected)' : ''}`}>{emojiOf(it.code)}</button>
        const act = SIT_ITEMS.has(it.code) ? () => sitAt({ x: it.x, y: Math.min(95, it.y + 2) }) : onFurniture ? () => onFurniture(it.code) : undefined
        return act || onFurniture ? <button key={i} className="pet-it" style={sty} onClick={e => { e.stopPropagation(); if (visitor && onFurniture) onFurniture(it.code); else act?.() }} aria-label={nameOf?.(it.code) ?? it.code}>{emojiOf(it.code)}</button>
          : <span key={i} className="pet-it" style={sty} aria-hidden="true">{emojiOf(it.code)}</span>
      })}
      {!edit && !hidePet && !visitor && info.sit.map((a, i) => <button key={'s' + i} className="room-sit" style={{ left: a.x + '%', top: a.y + '%' }} onClick={e => { e.stopPropagation(); sitAt(a) }} aria-label={`Sit on ${a.label ?? 'seat'}`} title={a.label} />)}
      {!hidePet && (
        <div className={'room-pet' + (mode === 'walk' ? ' walking' : '') + (mode === 'sit' ? ' sitting' : '')}
          style={{ left: (edit ? (w.x0 + w.x1) / 2 : pos.x) + '%', top: (edit ? (w.y0 + w.y1) / 2 : pos.y) + '%', transitionDuration: dur + 'ms', zIndex: Math.round(pos.y) + 1, width: sz }}>
          <div style={{ transform: `scaleX(${face})` }}><CharSprite ch={char} look={look} emotion={shown} size={sz} fx={reaction ? 'sparkle' : fx} sit={mode === 'sit'} label={petName} /></div>
        </div>)}
      {children}
    </div>
  )
}
