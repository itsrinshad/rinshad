import { supabase } from './lib'

// ---------- types (they mirror SYMBIOTES_LEO_PET.sql) ----------
export type Unlock = { type: 'free' | 'badge' | 'glory' | 'monthly_top' | 'admin' | 'reward'; badge?: string; glory?: number; or_badge?: string }
export type Item = { code: string; name: string; kind: string; emoji: string; description: string; effects: Record<string, number>; unlock: Unlock; sort: number
  char_key?: string | null; slot?: string | null; img?: string | null; meta?: { walk?: Walk; sit?: SitAnchor[] } }
export type Walk = { x0: number; x1: number; y0: number; y1: number }
export type SitAnchor = { x: number; y: number; label?: string }
export type PetT = {
  id: string; slot: 'main' | 'monthly'; variant: 'boy' | 'girl'; char_key: string; name: string
  hunger: number; energy: number; happiness: number; curiosity: number; friendliness: number
  appearance: { w?: Record<string, Partial<Record<'top' | 'pants' | 'hat' | 'glasses' | 'shoes', string>>>; color?: string; outfit?: string; glasses?: string; accessory?: string; ability?: string }
  home: { background?: string; items?: { code: string; x: number; y: number }[] }
  home_updated_at: string | null; source_month: string | null; source_glory: number | null; source_rank: number | null; created_at: string
}
export type PetSettings = {
  owner_id: string; active_pet_id: string | null; widget_state: 'open' | 'min' | 'hidden'; quiet: boolean; sound: boolean
  companion?: { on: boolean; mode: 'roam' | 'follow' | 'stay' | 'sleep' }
  show_pet: boolean; show_name: boolean; show_appearance: boolean; show_home: boolean; show_items: boolean; allow_greetings: boolean; last_daily: string | null
}
export type InvRow = { item_code: string; qty: number; source: string; seen: boolean; updated_at: string }
export type Boot = {
  disabled?: boolean
  config: { greetings: boolean; daily_reward: boolean; monthly_pet: boolean }
  settings: PetSettings; pets: PetT[]; inventory: InvRow[]; items: Item[]; upgrade: boolean
  glory: { lifetime: number; weekly: number; rank: number | null; weekly_rank: number | null }
  is_admin?: boolean; badge_ids: number[]; new_badges: string[]; claimed_monthly: { month: string; glory: number }[]; fresh: boolean; today: string
}
export type PublicPet = {
  owner: { id: string; username: string; display_name: string | null; avatar_url: string | null }
  char_key: string; name: string | null; appearance: PetT['appearance']; home: PetT['home'] | null; show_items: boolean; glory: number; rank: number | null; mood: string
}

export const SLOTS = [['color', '🎨 Colour'], ['outfit', '👕 Outfit'], ['glasses', '🕶️ Glasses'], ['accessory', '🎩 Accessory'], ['ability', '✨ Ability']] as const
export const KIND_LABEL: Record<string, string> = { character: 'Characters', wardrobe: 'Wardrobe skins', food: 'Food', outfit: 'Outfits', glasses: 'Glasses', accessory: 'Accessories', furniture: 'Furniture', decoration: 'Decorations', background: 'Backgrounds', color: 'Colours', ability: 'Abilities' }
export const KINDS = Object.keys(KIND_LABEL)

export const BACKGROUNDS: Record<string, string> = {
  bg_day: 'linear-gradient(#bfe6ff 0 58%, #f5d9a6 58% 100%)',
  bg_night: 'linear-gradient(#141a4a 0 58%, #2b2358 58% 100%)',
  bg_garden: 'linear-gradient(#a7f3d0 0 58%, #4ade80 58% 100%)',
  bg_sunset: 'linear-gradient(#fb923c, #f472b6 58%, #7c3aed 58% 100%)',
  bg_arena: 'linear-gradient(#334155 0 58%, #1e293b 58% 100%)',
  bg_space: 'radial-gradient(circle at 30% 30%, #4c1d95, #0b0720 70%)',
}

export const GREET_PRESETS: { id: string; emoji: string; label: string }[] = [
  { id: 'wave', emoji: '👋', label: 'Wave' }, { id: 'cheer', emoji: '🎉', label: 'Cheer' }, { id: 'hug', emoji: '🤗', label: 'Hug' },
  { id: 'high_five', emoji: '🙌', label: 'High five' }, { id: 'sparkle', emoji: '✨', label: 'Sparkle' },
]

// ---------- progress toward an unlock (display only; the server decides what is really unlocked) ----------
export function unlockInfo(it: Item, boot: Boot, badgeNames: Record<string, string>): { text: string; done: boolean; pct: number } {
  const u = it.unlock
  if (u.type === 'reward') return { text: 'Weekly reward (3,000 / 5,000 glory in a week) or an admin gift', done: false, pct: 0 }
  if (u.type === 'free') return { text: 'Free for everyone', done: true, pct: 100 }
  if (u.type === 'glory') { const need = u.glory ?? 0; const have = boot.glory.lifetime; return { text: `Reach ${need.toLocaleString()} lifetime glory${u.or_badge ? ' or earn the ' + (badgeNames[u.or_badge] ?? u.or_badge) + ' badge' : ''} (you have ${have.toLocaleString()})`, done: have >= need, pct: need ? Math.min(100, Math.floor(have * 100 / need)) : 100 } }
  if (u.type === 'badge') return { text: `Earn the achievement “${badgeNames[u.badge ?? ''] ?? u.badge}”`, done: false, pct: 0 }
  if (u.type === 'monthly_top') return { text: 'Be the top player of a month (comes with the second pet)', done: false, pct: 0 }
  return { text: 'Gift from an admin, or a daily treat', done: false, pct: 0 }
}

// ---------- mood: always gentle. LEO is never sad, angry or crying because you were away ----------
export function moodOf(p: PetT | null, quiet = false): string {
  if (!p) return 'normal'
  if (p.energy < 35) return 'sleepy'
  if (quiet) return 'normal'
  if (p.happiness < 40) return 'sad'
  if (p.hunger < 35) return 'thinking'
  if (p.happiness >= 80) return 'happy'
  if (p.curiosity >= 80) return 'excited'
  return 'normal'
}
export const needText = (p: PetT) => p.energy < 35 ? 'A bit sleepy 😴 (a rest would be lovely)' : p.happiness < 40 ? 'Feeling a little sad 💧 (play or cuddle?)' : p.hunger < 35 ? 'Thinking about snacks 🍪' : p.happiness >= 80 ? 'Feeling great!' : 'Doing fine'

// ---------- authored dialogue (no AI). Admins can add more lines in Admin > LEO ----------
export const LINES: Record<string, string[]> = {
  hello: ['Hey {user}! Good to see you 😁', 'Yay, {user} is here! 🧡', 'Hi {user}! Ready to hang out?'],
  feed: ['Yum! Thank you! 😋', 'Nom nom nom 🍪', 'That was delicious!'],
  full: ["I'm full for now, thank you! 😄", 'Not hungry right now. Maybe later? 😊'],
  play: ['Wheee! That was fun! 🎮', 'Again, again! 😆', 'You are fun to play with!'],
  tired: ["I'm a little sleepy. A rest first? 😴", 'Yawn… a quick nap and then we play! 💤'],
  rest: ['Ahh, that nap was great 😌', 'Zzz… all recharged! ⚡'],
  cuddle: ['Aww! 🥰', 'Hehe, that tickles! 😊', 'You are my favourite human 🧡'],
  rename: ['I love my name! ✨', 'Ooh, a new name! I like it 😍'],
  outfit: ['How do I look? 😎', 'Fresh! ✨', 'I feel fancy! 🎩'],
  home: ['Cosy! I love my room 🏠', 'Looking good in here! 🛋️'],
  daily: ['A little treat for you! 🎁', 'I found something for us! 🎁'],
  gift: ['A gift! Thank you! 🎁', 'Wow, a present for me? 🥳'],
  unlock: ['Something new is unlocked! 🔓', 'Look what you unlocked! ✨'],
  achievement: ['You earned “{name}”! 🎉', 'Congratulations on “{name}”! 🏅'],
  monthly: ['You were the top player of {month}! Meet {pet}, yours forever 🎀', 'Top player of {month}! {pet} is here to stay 🎀'],
  read_start: ["Let's read together! 📖", 'I will follow along 👀'],
  read_done: ['That was nice! 📚', 'Nice reading together 😊'],
  greeted: ['A friend visited me! 💌', 'Someone said hi to me! 👋'],
  idle: ['Just hanging out with you 😊', 'Take your time. I am here 🧡', 'Want to play or have a snack?'],
  quiet_on: ["Quiet mode on. I'll keep it calm 🤫"],
  quiet_off: ["I'm back to my chatty self 😁"],
}
export const PAGE_LINES: { test: RegExp; key: string; line: string }[] = [
  { test: /^\/$/, key: 'home', line: 'Home sweet home! 🏠' },
  { test: /^\/leaderboard/, key: 'leaderboard', line: "Ooh, the leaderboard! Let's see who's shining ✨" },
  { test: /^\/rules/, key: 'rules', line: 'Guild rules! Want me to read along? Tap 📖.' },
  { test: /^\/announcements/, key: 'announcements', line: 'Guild news! 📢' },
  { test: /^\/polls/, key: 'polls', line: 'Polls! Your vote counts 🗳️' },
  { test: /^\/achievements/, key: 'achievements', line: 'Badges and awards! 🏅' },
  { test: /^\/glory/, key: 'glory', line: 'Your glory history 🔥' },
  { test: /^\/members/, key: 'members', line: 'Meet the family! 👥' },
  { test: /^\/chat/, key: 'chat', line: 'Chat time! I only look at messages if you ask me for reply ideas 🤐' },
  { test: /^\/feedback/, key: 'feedback', line: 'Ideas and feedback help the guild grow 💡' },
  { test: /^\/profile|^\/u\//, key: 'profile', line: 'Profiles! 🙂' },
  { test: /^\/notifications/, key: 'notifications', line: 'Your updates 🔔' },
]

export const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')
export function pickLine(event: string, extra: { event: string; mood: string; line: string }[], vars: Record<string, string> = {}): { text: string; mood: string } {
  const own = extra.filter(x => x.event === event)
  const base = (LINES[event] ?? LINES.idle).map(t => ({ line: t, mood: '' }))
  const pool = [...base, ...own]
  const r = pool[Math.floor(Math.random() * pool.length)]
  const moodMap: Record<string, string> = { feed: 'happy', full: 'happy', play: 'excited', tired: 'sleepy', rest: 'happy', cuddle: 'shy', rename: 'happy', outfit: 'winking', home: 'happy', daily: 'excited', gift: 'celebrating', unlock: 'celebrating', achievement: 'celebrating', monthly: 'celebrating', read_start: 'happy', read_done: 'happy', greeted: 'welcoming', hello: 'welcoming', idle: 'normal', quiet_on: 'sleepy', quiet_off: 'happy' }
  return { text: fill(r.line, vars), mood: r.mood || moodMap[event] || 'happy' }
}

// ---------- chat reply ideas: simple keyword templates. Nothing leaves the browser, nothing is sent automatically ----------
export function suggestReplies(incoming: string[]): string[] {
  const last = (incoming[incoming.length - 1] ?? '').trim(); const t = last.toLowerCase()
  if (!last) return []
  const out: string[] = []
  if (/^(hi|hello|hey|hai|yo|namaste|good (morning|evening|night))\b/.test(t)) out.push('Hey! 😊 How are you?', 'Hello! What’s up?', 'Hi! 👋')
  else if (/(thank|thanks|thx|nanni)/.test(t)) out.push('Anytime! 😊', 'No problem at all!', 'Happy to help! 🧡')
  else if (/(sorry|my bad)/.test(t)) out.push('No worries! 😊', 'All good, don’t stress.', 'It’s okay, thanks for telling me!')
  else if (/(gg|well played|nice game|wp)/.test(t)) out.push('GG! 🔥', 'Well played to you too!', 'Great game, let’s go again?')
  else if (/(congrat|well done|awesome|great job)/.test(t)) out.push('Thank you so much! 🎉', 'Thanks, that means a lot! 🧡', 'You’re the best! 😄')
  else if (/(when|what time|where|enthina|eppo|evide)/.test(t) && last.includes('?')) out.push('Let me check and tell you soon.', 'Not sure yet, I’ll confirm later.', 'Good question! Let me find out 😊')
  else if (last.includes('?')) out.push('Yes, sounds good! 👍', 'Not sure yet, let me check.', 'Maybe! What do you think?')
  else if (/(join|play|match|custom|room|squad|team)/.test(t)) out.push('I’m in! 🎮', 'Give me a few minutes!', 'Can’t right now, maybe later?')
  else out.push('Nice! 😊', 'Got it, thanks!', 'Haha, okay! 😄')
  return out.slice(0, 3)
}

// ---------- tiny sound effects (WebAudio, no files). Only after a user gesture, only if sound is on and not quiet ----------
let ac: AudioContext | null = null
export function blip(kind: 'happy' | 'care' | 'pop' | 'win', on: boolean) {
  if (!on) return
  try {
    ac = ac ?? new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ac.state === 'suspended') ac.resume().catch(() => { /* needs a tap first */ })
    const notes = kind === 'win' ? [523, 659, 784, 1046] : kind === 'happy' ? [660, 880] : kind === 'care' ? [520, 620] : [440]
    notes.forEach((f, i) => {
      const o = ac!.createOscillator(); const g = ac!.createGain(); const t0 = ac!.currentTime + i * 0.09
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
      o.connect(g); g.connect(ac!.destination); o.start(t0); o.stop(t0 + 0.18)
    })
  } catch { /* sound is optional */ }
}

// ---------- local look-and-feel prefs (per device) ----------
export type PetUi = { calm: boolean }
export const getPetUi = (): PetUi => { try { return { calm: false, ...JSON.parse(localStorage.getItem('sym_pet_ui') || '{}') } } catch { return { calm: false } } }
export const setPetUi = (p: Partial<PetUi>) => { const n = { ...getPetUi(), ...p }; try { localStorage.setItem('sym_pet_ui', JSON.stringify(n)) } catch { /* private mode */ } document.documentElement.dataset.petcalm = n.calm ? '1' : '0'; window.dispatchEvent(new Event('sym-petui')); return n }

// ---------- safe RPC wrapper: never throws, never hangs, always returns a friendly message ----------
// The raw technical message is kept in lastRpcError so the LEO space can show it under "Technical details".
export let lastRpcError = ''
const NET = 'LEO cannot reach the server right now. Check your connection and try again.'
const DBFIX = 'LEO’s database needs an update. An admin should run SYMBIOTES_LEO_PET.sql and then SYMBIOTES_PHASE4.sql once in Supabase.'
export function friendlyError(m: string): string {
  if (/Failed to fetch|NetworkError|network|timed out|AbortError/i.test(m)) return NET
  if (/function .* does not exist|schema cache|Could not find the function/i.test(m)) return 'LEO’s database setup is missing. An admin needs to run SYMBIOTES_LEO_PET.sql and SYMBIOTES_PHASE4.sql once.'
  if (/operator does not exist|syntax error|column .* does not exist|relation .* does not exist|violates|ambiguous|invalid input|permission denied|infinite recursion/i.test(m)) return DBFIX
  if (/^not allowed$/i.test(m.trim())) return 'LEO is for active guild members. If you were just approved, sign out and back in.'
  return m
}
const withTimeout = <T,>(p: PromiseLike<T>, ms: number): Promise<T> =>
  new Promise<T>((res, rej) => { const t = window.setTimeout(() => rej(new Error('timed out')), ms); Promise.resolve(p).then(v => { window.clearTimeout(t); res(v) }, e => { window.clearTimeout(t); rej(e) }) })

export async function rpc<T = any>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await withTimeout<{ data: unknown; error: { message?: string } | null }>(supabase.rpc(fn, args as any) as PromiseLike<any>, 20000)
    if (error) {
      const raw = error.message || 'Something went wrong.'
      lastRpcError = `${fn}: ${raw}`; console.warn('[LEO]', lastRpcError)
      return { data: null, error: friendlyError(raw) }
    }
    return { data: data as T, error: null }
  } catch (e) {
    lastRpcError = `${fn}: ${(e as Error)?.message ?? e}`; console.warn('[LEO]', lastRpcError)
    return { data: null, error: NET }
  }
}

// ---------- small helpers for the wardrobe and the room ----------
// legacy slot kinds (kept so old saved looks still load); the new wardrobe uses kind 'wardrobe' with 5 slots
export const SLOT_KINDS = ['color', 'outfit', 'glasses', 'accessory', 'ability'] as const
export const ROOM_KINDS = ['furniture', 'decoration'] as const
export const MAX_ROOM_ITEMS = 14

// legacy background ids -> the five PDF backgrounds
export const BG_ALIAS: Record<string, string> = { bg_day: 'bg01', bg_garden: 'bg02', bg_night: 'bg03', bg_arena: 'bg03', bg_sunset: 'bg04', bg_space: 'bg05' }
export const bgCode = (c?: string | null) => (c ? BG_ALIAS[c] ?? c : 'bg01')
