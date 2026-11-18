import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './lib'
import { useAuth } from './auth'
import { blip, Boot, getPetUi, InvRow, Item, pickLine, PetSettings, PetT, rpc, setPetUi } from './petCore'

type Status = 'loading' | 'ready' | 'offline' | 'off' | 'none'
type Bubble = { id: number; text: string; mood: string }
type Res = { ok: boolean; error?: string; reason?: string; data?: any }
type Dlg = { event: string; mood: string; line: string }

type Ctx = {
  status: Status; error: string; boot: Boot | null; pets: PetT[]; active: PetT | null; settings: PetSettings | null
  items: Item[]; itemMap: Map<string, Item>; inv: Map<string, InvRow>; badgeNames: Record<string, string>
  owns: (code: string) => boolean; quiet: boolean; sound: boolean; calm: boolean; unseen: Item[]
  bubble: Bubble | null; fx: string; mood: string; busy: boolean
  say: (event: string, vars?: Record<string, string>, force?: boolean) => void; sayText: (text: string, mood?: string, force?: boolean) => void
  clearBubble: () => void; playFx: () => void; setMood: (m: string, ms?: number) => void
  refresh: () => Promise<void>
  care: (petId: string, action: string, item?: string) => Promise<Res>
  rename: (petId: string, name: string) => Promise<Res>
  setLook: (petId: string, look: Record<string, string | null>) => Promise<Res>
  setChar: (petId: string, key: string) => Promise<Res>
  setWear: (petId: string, wear: Record<string, string | null>) => Promise<Res>
  setCompanion: (patch: Record<string, unknown>) => Promise<Res>
  rewardStatus: () => Promise<{ ok: boolean; data?: any; error?: string }>
  rewardClaim: (item: string, week: 'current' | 'previous') => Promise<Res>
  isAdminPet: boolean
  setHome: (petId: string, home: unknown) => Promise<Res>
  setSettings: (patch: Record<string, unknown>) => Promise<Res>
  dailyGift: () => Promise<Res>
  markSeen: () => Promise<void>
  deleteMyData: () => Promise<Res>
  adminGrant: (username: string, item: string, qty?: number) => Promise<Res>
  moment: (kind: 'explore' | 'read', key: string) => Promise<void>
}
const C = createContext<Ctx | null>(null)
export const usePet = () => { const c = useContext(C); if (!c) throw new Error('usePet outside PetProvider'); return c }
export const usePetSafe = () => useContext(C)

const cacheKey = (uid: string) => 'sym_pet_cache_' + uid
const fix = (b: Boot): Boot => ({ ...b, pets: b.pets ?? [], items: b.items ?? [], inventory: b.inventory ?? [], new_badges: b.new_badges ?? [], claimed_monthly: b.claimed_monthly ?? [], badge_ids: b.badge_ids ?? [],
  glory: b.glory ?? { lifetime: 0, weekly: 0, rank: null, weekly_rank: null }, config: b.config ?? { greetings: false, daily_reward: true, monthly_pet: true } })
const readCache = (uid: string): Boot | null => { try { const b = JSON.parse(localStorage.getItem(cacheKey(uid)) || 'null'); return b && b.settings && !b.disabled ? fix(b) : null } catch { return null } }
const writeCache = (uid: string, b: Boot) => { try { localStorage.setItem(cacheKey(uid), JSON.stringify(b)) } catch { /* ignore */ } }

export function PetProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth()
  const uid = session?.user.id; const active_ = profile?.status === 'active'
  const [status, setStatus] = useState<Status>('loading'); const [error, setError] = useState('')
  const [boot, setBoot] = useState<Boot | null>(null); const [dlg, setDlg] = useState<Dlg[]>([])
  const [badgeNames, setBadgeNames] = useState<Record<string, string>>({})
  const [bubble, setBubble] = useState<Bubble | null>(null); const [fx, setFx] = useState(''); const [moodOv, setMoodOv] = useState(''); const [busy, setBusy] = useState(false)
  const [calm, setCalm] = useState(getPetUi().calm)
  const bubbleT = useRef<number | undefined>(undefined); const fxT = useRef<number | undefined>(undefined); const moodT = useRef<number | undefined>(undefined)
  const greeted = useRef(false); const retries = useRef(0); const retryT = useRef<number | undefined>(undefined)
  const name = profile?.display_name || profile?.username || 'friend'

  const quiet = !!boot?.settings.quiet; const sound = !!boot?.settings.sound && !quiet
  const sayText = useCallback((text: string, mood = 'happy', force = false) => {
    if (quiet && !force) return
    window.clearTimeout(bubbleT.current); setBubble({ id: Date.now(), text, mood }); setMoodOv(mood)
    window.clearTimeout(moodT.current); moodT.current = window.setTimeout(() => setMoodOv(''), 4500)
    bubbleT.current = window.setTimeout(() => setBubble(null), Math.min(9000, 3500 + text.length * 45))
  }, [quiet])
  const say = useCallback((event: string, vars: Record<string, string> = {}, force = false) => {
    const l = pickLine(event, dlg, { user: name, ...vars }); sayText(l.text, l.mood, force)
  }, [dlg, name, sayText])
  const clearBubble = useCallback(() => { window.clearTimeout(bubbleT.current); setBubble(null) }, [])
  const setMood = useCallback((m: string, ms = 3000) => { setMoodOv(m); window.clearTimeout(moodT.current); moodT.current = window.setTimeout(() => setMoodOv(''), ms) }, [])

  const items = boot?.items ?? []
  const itemMap = useMemo(() => new Map(items.map(i => [i.code, i])), [boot])
  const inv = useMemo(() => new Map((boot?.inventory ?? []).map(r => [r.item_code, r])), [boot])
  const owns = useCallback((code: string) => {
    const it = itemMap.get(code); if (!it) return false
    return it.unlock.type === 'free' || (inv.get(code)?.qty ?? 0) > 0 || (!!boot?.upgrade && (it.kind !== 'food' || !!boot?.is_admin))
  }, [itemMap, inv, boot])
  const pets = boot?.pets ?? []
  const active = pets.find(p => p.id === boot?.settings.active_pet_id) ?? pets[0] ?? null
  const unseen = useMemo(() => (boot?.inventory ?? []).filter(r => !r.seen && r.qty > 0).map(r => itemMap.get(r.item_code)).filter(Boolean) as Item[], [boot, itemMap])

  const playFx = useCallback(() => {
    const ab = active?.appearance.ability
    const f = ab === 'ab_flip' ? 'flip' : ab === 'ab_dance' ? 'dance' : ab === 'ab_confetti' ? 'confetti' : 'hearts'
    window.clearTimeout(fxT.current); setFx(f); fxT.current = window.setTimeout(() => setFx(''), 1100)
  }, [active])

  // ---------- load ----------
  const load = useCallback(async (first = false) => {
    if (!uid) return
    const { data, error: err } = await rpc<Boot>('pet_bootstrap')
    if (err || !data) {
      const cached = readCache(uid)
      if (cached) { setBoot(cached); setStatus('offline'); setError(err ?? '') } else { setStatus('offline'); setError(err ?? 'LEO is taking a nap.') }
      if (retries.current < 3) { retries.current++; window.clearTimeout(retryT.current); retryT.current = window.setTimeout(() => load(), 8000 * retries.current) }
      return
    }
    retries.current = 0
    if (data.disabled) { setStatus('off'); setBoot(null); return }
    if (!data.settings || !Array.isArray(data.pets)) { setStatus('offline'); setError('LEO sent something unexpected. Please try again.'); return }
    const nb = fix(data); setBoot(nb); setStatus('ready'); setError(''); writeCache(uid, nb)
    if (first) {
      supabase.from('badges').select('code,name').then(r => setBadgeNames(Object.fromEntries((r.data ?? []).map((b: any) => [b.code, b.name]))))
      supabase.from('pet_dialogue').select('event,mood,line').eq('active', true).then(r => setDlg((r.data ?? []) as Dlg[]))
    }
  }, [uid])
  const refresh = useCallback(async () => { await load() }, [load])

  useEffect(() => {
    document.documentElement.dataset.petcalm = getPetUi().calm ? '1' : '0'
    const f = () => setCalm(getPetUi().calm); window.addEventListener('sym-petui', f); return () => window.removeEventListener('sym-petui', f)
  }, [])
  useEffect(() => {
    greeted.current = false; retries.current = 0
    if (!uid || !active_) { setBoot(null); setStatus('none'); return }
    setStatus('loading'); load(true)
    return () => window.clearTimeout(retryT.current)
  }, [uid, active_, load])
  useEffect(() => { const f = () => { if (document.visibilityState === 'visible' && status === 'offline') load() }; document.addEventListener('visibilitychange', f); window.addEventListener('online', f); return () => { document.removeEventListener('visibilitychange', f); window.removeEventListener('online', f) } }, [status, load])

  // celebrations happen once per session and only for confirmed events returned by the server
  useEffect(() => {
    if (status !== 'ready' || !boot || greeted.current) return
    greeted.current = true
    const t = window.setTimeout(() => {
      if (boot.claimed_monthly?.length) {
        const m = boot.claimed_monthly[boot.claimed_monthly.length - 1]; const pet = boot.pets.find(p => p.source_month === m.month)
        say('monthly', { month: new Date(m.month + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), pet: pet?.name ?? 'LEA' }); blip('win', sound); playFx()
      } else if (boot.new_badges?.length) { say('achievement', { name: boot.new_badges[0] }); blip('win', sound); playFx() }
      else if (unseen.length) { say('unlock'); blip('happy', sound) }
      else say('hello')
    }, 900)
    return () => window.clearTimeout(t)
  }, [status, boot])

  // ---------- actions (every one goes through a server function; the UI only shows what comes back) ----------
  const patchPet = (p: PetT) => setBoot(b => b ? { ...b, pets: b.pets.map(x => x.id === p.id ? { ...x, ...p } : x) } : b)
  const guard = async <T,>(fn: () => Promise<T>): Promise<T | Res> => {
    if (status === 'offline' && !boot) return { ok: false, error: 'LEO is offline right now. Try again in a moment.' }
    setBusy(true); try { return await fn() } finally { setBusy(false) }
  }
  const care: Ctx['care'] = async (petId, action, item) => guard(async () => {
    const { data, error: err } = await rpc<{ ok: boolean; reason?: string; event: string; pet: PetT }>('pet_care', { p_pet: petId, p_action: action, p_item: item ?? null })
    if (err || !data) { sayText(err ?? 'Hmm, that did not work. Try again?', 'confused', true); return { ok: false, error: err ?? 'failed' } }
    patchPet(data.pet)
    if (data.reason === 'slow') return { ok: false, reason: 'slow' }          // a quick double-tap: ignore politely
    if (!data.ok) { say(data.reason === 'full' ? 'full' : 'tired', {}, true); return { ok: false, reason: data.reason } }
    say(action === 'feed' ? 'feed' : action, {}, !quiet); if (action === 'feed') setMood('eating', 2600); blip('care', sound); if (action === 'play' || action === 'cuddle') playFx()
    if (action === 'feed' && item) setBoot(b => { if (!b) return b; const it = b.items.find(i => i.code === item); if (!it || it.unlock.type === 'free') return b; return { ...b, inventory: b.inventory.map(r => r.item_code === item ? { ...r, qty: Math.max(0, r.qty - 1) } : r).filter(r => r.qty > 0) } })
    return { ok: true }
  }) as Promise<Res>
  const rename: Ctx['rename'] = async (petId, nm) => guard(async () => {
    const { data, error: err } = await rpc<string>('pet_rename', { p_pet: petId, p_name: nm })
    if (err || data == null) return { ok: false, error: err ?? 'failed' }
    setBoot(b => b ? { ...b, pets: b.pets.map(p => p.id === petId ? { ...p, name: data } : p) } : b); say('rename', {}, true); return { ok: true }
  }) as Promise<Res>
  const setLook: Ctx['setLook'] = async (petId, look) => guard(async () => {
    const { data, error: err } = await rpc<PetT['appearance']>('pet_set_appearance', { p_pet: petId, p_look: look })
    if (err || !data) return { ok: false, error: err ?? 'failed' }
    setBoot(b => b ? { ...b, pets: b.pets.map(p => p.id === petId ? { ...p, appearance: data } : p) } : b); say('outfit', {}, !quiet); blip('pop', sound); return { ok: true }
  }) as Promise<Res>
  const setChar: Ctx['setChar'] = async (petId, key) => guard(async () => {
    const { data, error: err } = await rpc<{ char_key: string }>('pet_set_character', { p_pet: petId, p_char: key })
    if (err || !data) return { ok: false, error: err ?? 'failed' }
    setBoot(b => b ? { ...b, pets: b.pets.map(p => p.id === petId ? { ...p, char_key: data.char_key } : p) } : b); say('outfit', {}, !quiet); blip('pop', sound); return { ok: true }
  }) as Promise<Res>
  const setWear: Ctx['setWear'] = async (petId, wear) => guard(async () => {
    const { data, error: err } = await rpc<PetT['appearance']>('pet_set_wear', { p_pet: petId, p_wear: wear })
    if (err || !data) return { ok: false, error: err ?? 'failed' }
    setBoot(b => b ? { ...b, pets: b.pets.map(p => p.id === petId ? { ...p, appearance: data } : p) } : b); say('outfit', {}, !quiet); blip('pop', sound); return { ok: true }
  }) as Promise<Res>
  const setCompanion: Ctx['setCompanion'] = async patch => {
    // optimistic: the companion reacts instantly; the server copy is what survives a reload
    setBoot(b => b ? { ...b, settings: { ...b.settings, companion: { on: true, mode: 'roam', ...(b.settings.companion ?? {}), ...patch } as any } } : b)
    const { data, error: err } = await rpc<any>('pet_set_companion', { p_patch: patch })
    if (err || !data) return { ok: false, error: err ?? 'failed' }
    setBoot(b => { if (!b) return b; const n = { ...b, settings: { ...b.settings, companion: data } }; if (uid) writeCache(uid, n); return n }); return { ok: true }
  }
  const rewardStatus: Ctx['rewardStatus'] = async () => { const { data, error: err } = await rpc<any>('reward_status'); return err || !data ? { ok: false, error: err ?? 'failed' } : { ok: true, data } }
  const rewardClaim: Ctx['rewardClaim'] = async (item, week) => guard(async () => {
    const { data, error: err } = await rpc<{ ok: boolean }>('reward_claim', { p_item: item, p_week: week })
    if (err || !data) return { ok: false, error: err ?? 'failed' }
    say('unlock', {}, true); blip('win', sound); playFx(); await load(); return { ok: true }
  }) as Promise<Res>
  const setHome: Ctx['setHome'] = async (petId, home) => guard(async () => {
    const { data, error: err } = await rpc<PetT['home']>('pet_set_home', { p_pet: petId, p_home: home })
    if (err || !data) return { ok: false, error: err ?? 'failed' }
    setBoot(b => b ? { ...b, pets: b.pets.map(p => p.id === petId ? { ...p, home: data, home_updated_at: new Date().toISOString() } : p) } : b); say('home', {}, !quiet); return { ok: true }
  }) as Promise<Res>
  const setSettings: Ctx['setSettings'] = async patch => {
    const { data, error: err } = await rpc<PetSettings>('pet_set_settings', { p_patch: patch })
    if (err || !data) return { ok: false, error: err ?? 'failed' }
    setBoot(b => { if (!b) return b; const n = { ...b, settings: { ...b.settings, ...data } }; if (uid) writeCache(uid, n); return n }); return { ok: true }
  }
  const dailyGift: Ctx['dailyGift'] = async () => guard(async () => {
    const { data, error: err } = await rpc<any>('pet_daily_gift')
    if (err || !data) return { ok: false, error: err ?? 'failed' }
    if (!data.ok) return { ok: false, reason: data.reason }
    say('daily', {}, true); blip('happy', sound); await load(); return { ok: true, data }
  }) as Promise<Res>
  const adminGrant: Ctx['adminGrant'] = async (username, item, qty = 1) => {
    const { data, error: err } = await rpc<{ ok: boolean }>('pet_admin_grant', { p_username: username, p_item: item, p_qty: qty })
    return err || !data ? { ok: false, error: err ?? 'failed' } : { ok: true }
  }
  const markSeen = async () => { if (!unseen.length) return; await rpc('pet_mark_seen'); setBoot(b => b ? { ...b, inventory: b.inventory.map(r => ({ ...r, seen: true })) } : b) }
  const deleteMyData: Ctx['deleteMyData'] = async () => {
    const { error: err } = await rpc('pet_delete_my_data'); if (err) return { ok: false, error: err }
    if (uid) try { localStorage.removeItem(cacheKey(uid)) } catch { /* ignore */ }
    await load(); return { ok: true }
  }
  const moment: Ctx['moment'] = async (kind, key) => {
    const { data } = await rpc<{ rewarded: boolean; pet?: PetT }>('pet_moment', { p_kind: kind, p_key: key })
    if (data?.rewarded && data.pet) patchPet(data.pet)
  }

  const mood = moodOv || (active ? (() => { const p = active; return p.energy < 35 ? 'sleepy' : p.happiness < 40 ? 'sad' : p.hunger < 35 ? 'thinking' : p.happiness >= 80 ? 'happy' : p.curiosity >= 80 ? 'excited' : 'normal' })() : 'normal')
  const value: Ctx = {
    status, error, boot, pets, active, settings: boot?.settings ?? null, items, itemMap, inv, badgeNames, owns, quiet, sound, calm, unseen, bubble, fx, mood: quiet && !moodOv ? (active && active.energy < 35 ? 'sleepy' : 'normal') : mood, busy,
    say, sayText, clearBubble, playFx, setMood, refresh, care, rename, setLook, setChar, setWear, setCompanion, rewardStatus, rewardClaim, isAdminPet: !!boot?.is_admin, setHome, setSettings, dailyGift, markSeen, deleteMyData, adminGrant, moment,
  }
  return <C.Provider value={value}>{children}</C.Provider>
}
export { setPetUi }
