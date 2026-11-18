import { useCallback, useEffect, useRef, useState } from 'react'

// "Read with me": LEO highlights the visible text of supported pages and (if the browser can) reads it aloud.
// Everything runs in the browser. Nothing is sent anywhere. Chat, settings, profile, admin and notification pages are never read.
export const READABLE = [/^\/$/, /^\/rules/, /^\/announcements/, /^\/polls/, /^\/leaderboard/, /^\/achievements/, /^\/members/, /^\/feedback/]
export const canRead = (path: string) => READABLE.some(r => r.test(path))

const SEL = 'h1,h2,h3,h4,p,li,summary,blockquote'
function collect(): HTMLElement[] {
  const root = document.querySelector('main.page'); if (!root) return []
  const out: HTMLElement[] = []
  root.querySelectorAll<HTMLElement>(SEL).forEach(el => {
    if (el.closest('[data-noread],[aria-hidden="true"],nav,button,select,textarea,input,.leo-widget,.leo-panel')) return
    if (el.offsetParent === null) return                         // hidden or inside a closed section
    if (el.querySelector(SEL)) return                            // read the inner block instead
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim()
    if (t.length < 2) return
    out.push(el)
  })
  return out
}
const clean = (t: string) => t.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500)
const CLS = 'leo-reading'

export type ReaderState = 'idle' | 'playing' | 'paused'
export function useReader(path: string, onDone?: () => void) {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  const [state, setState] = useState<ReaderState>('idle'); const [idx, setIdx] = useState(0); const [total, setTotal] = useState(0)
  const [rate, setRate] = useState(1); const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]); const [voiceName, setVoiceName] = useState('')
  const q = useRef<HTMLElement[]>([]); const i = useRef(0); const run = useRef(0); const rateR = useRef(1); const voiceR = useRef('')
  const calm = () => document.documentElement.dataset.petcalm === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!synth) return
    const f = () => setVoices(synth.getVoices()); f(); synth.addEventListener?.('voiceschanged', f)
    return () => synth.removeEventListener?.('voiceschanged', f)
  }, [synth])
  useEffect(() => { rateR.current = rate }, [rate]); useEffect(() => { voiceR.current = voiceName }, [voiceName])

  const unmark = () => document.querySelectorAll('.' + CLS).forEach(e => e.classList.remove(CLS))
  const stop = useCallback(() => { run.current++; synth?.cancel(); unmark(); setState('idle'); setIdx(0) }, [synth])

  const speakAt = useCallback((n: number, token: number) => {
    if (token !== run.current) return
    if (n >= q.current.length) { unmark(); setState('idle'); setIdx(0); onDone?.(); return }
    i.current = n; setIdx(n); unmark()
    const el = q.current[n]; el.classList.add(CLS); el.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' })
    const text = clean(el.innerText || '')
    if (!synth || !text) return
    const u = new SpeechSynthesisUtterance(text); u.rate = rateR.current
    const vs = synth.getVoices(); const v = vs.find(x => x.name === voiceR.current) || (/[\u0D00-\u0D7F]/.test(text) ? vs.find(x => x.lang.toLowerCase().startsWith('ml')) : undefined)
    if (v) { u.voice = v; u.lang = v.lang }
    u.onend = () => speakAt(n + 1, token); u.onerror = e => { if ((e as SpeechSynthesisErrorEvent).error !== 'canceled' && (e as SpeechSynthesisErrorEvent).error !== 'interrupted') speakAt(n + 1, token) }
    synth.speak(u)
  }, [synth, onDone])

  const start = useCallback(() => {
    if (!canRead(path)) return false
    synth?.cancel(); unmark(); const token = ++run.current
    q.current = collect(); setTotal(q.current.length); if (!q.current.length) return false
    setState('playing'); speakAt(0, token); return true
  }, [path, synth, speakAt])
  const pause = useCallback(() => { synth?.pause(); setState('paused') }, [synth])
  const resume = useCallback(() => { synth?.resume(); setState('playing') }, [synth])
  const jump = useCallback((d: number) => {
    if (!q.current.length) return
    const token = ++run.current; synth?.cancel(); setState('playing'); speakAt(Math.max(0, Math.min(q.current.length - 1, i.current + d)), token)
  }, [synth, speakAt])
  // speech-less browsers: the highlight still steps along with the buttons

  useEffect(() => { stop() }, [path])          // leaving a page always stops reading
  useEffect(() => () => { run.current++; synth?.cancel(); unmark() }, [synth])
  return { supported: !!synth, state, idx, total, rate, setRate, voices, voiceName, setVoiceName, start, pause, resume, stop, next: () => jump(1), prev: () => jump(-1), allowed: canRead(path) }
}
