import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Leo } from './Leo'
import { CharSprite, CHAR_BY, SLOT_LIST, charName, charCode, foodView, imgUrl, previewCharSrc, wardrobeBuiltin, wearOf, type Slot } from './chars'
import { BGS, CHARS } from './catalog'
import { DeadlineBanner } from './deadline'
import { PetRoom, type Placed } from './PetRoom'
import { usePet } from './PetContext'
import { useAuth } from './auth'
import { bgCode, blip, getPetUi, lastRpcError, MAX_ROOM_ITEMS, needText, ROOM_KINDS, setPetUi, unlockInfo } from './petCore'

const Bar = ({ label, v, c }: { label: string; v: number; c: string }) => (
  <div className="pet-bar" title={`${label}: ${v}/100`}><span>{label}</span><i role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}><b style={{ width: v + '%', background: c }} /></i></div>
)
const Sw = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
  <label className="row flex items-center justify-between py-1.5 text-sm"><span>{label}</span>
    <input type="checkbox" role="switch" checked={on} onChange={e => set(e.target.checked)} aria-label={label} className="h-5 w-5" /></label>
)
const Meter = ({ pct, label }: { pct: number; label: string }) => (
  <i className="pet-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><b style={{ width: Math.max(0, Math.min(100, pct)) + '%' }} /></i>
)

type Tab = 'home' | 'chars' | 'wardrobe' | 'room' | 'rewards' | 'settings'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '🏠' }, { id: 'chars', label: 'Characters', icon: '🧑' }, { id: 'wardrobe', label: 'Wardrobe', icon: '👕' }, { id: 'room', label: 'Room', icon: '🛋️' }, { id: 'rewards', label: 'Rewards', icon: '🎁' }, { id: 'settings', label: 'Settings', icon: '⚙️' },
]

// ---------------------------------------------------------------- Characters: the 5 PDF characters + approved player uploads
function Characters({ note }: { note: (t: string) => void }) {
  const { active, items, owns, itemMap, boot, badgeNames, setChar, busy, look: _l } = usePet() as any
  if (!active || !boot) return null
  const ups = items.filter((i: any) => i.kind === 'character' && i.code.startsWith('up_'))
  const list = [...CHARS.map(c => ({ key: c.key, name: `${c.first} "${c.nick}" ${c.last}`, sub: `#0${c.num} · ${c.role}`, code: 'char_' + c.key })), ...ups.map((u: any) => ({ key: u.code, name: u.name, sub: 'Player upload', code: u.code }))]
  const pick = async (k: string) => { const r = await setChar(active.id, k); note(r.ok ? 'Character changed 🎉' : r.error ?? 'Could not change that right now.') }
  return (
    <section className="glass p-3" aria-label="Characters">
      <p className="text-xs text-gray-400 mb-2">Pick your companion. Each character has its own wardrobe and foods. New characters come from the weekly reward (5,000 glory in a week) or an admin gift.</p>
      <ul className="grid grid-cols-2 gap-2">
        {list.map(c => { const mine = owns(c.code); const on = active.char_key === c.key; const it = itemMap.get(c.code); return (
          <li key={c.key}><button className={'pet-card2' + (on ? ' on' : '') + (mine ? '' : ' locked')} disabled={busy || !mine || on} aria-pressed={on} onClick={() => pick(c.key)}>
            <img src={previewCharSrc(c.key, itemMap)} alt="" className="char-thumb" loading="lazy" /><b>{c.name}</b>
            <small>{on ? 'Active' : mine ? 'Tap to switch' : it ? unlockInfo(it, boot, badgeNames).text : 'Locked'}</small></button></li>) })}
      </ul>
    </section>)
}

// ---------------------------------------------------------------- Wardrobe: 45 skins per character (9 x 5 categories), layered on one 512x512 canvas
function Wardrobe({ note }: { note: (t: string) => void }) {
  const { active, items, owns, boot, badgeNames, setWear, busy, mood } = usePet()
  const [slot, setSlot] = useState<Slot>('top')
  if (!active || !boot) return null
  const ch = active.char_key; const w = wearOf(active.appearance, ch); const worn = w[slot] ?? ''
  const list = items.filter(i => i.kind === 'wardrobe' && i.slot === slot && (i.char_key === ch || i.char_key === 'all')).sort((a, b) => a.sort - b.sort)
  const equip = async (code: string) => { const r = await setWear(active.id, { [slot]: code || null }); if (!r.ok) note(r.error ?? 'Could not change that right now.') }
  const thumb = (code: string, img?: string | null) => wardrobeBuiltin(code) ?? imgUrl(img)
  return (
    <section className="glass p-3" aria-label="Wardrobe">
      <div className="flex gap-3 items-center">
        <div className="wardrobe-prev"><CharSprite ch={ch} look={active.appearance} emotion={mood} size={150} label={`${active.name} wearing your skins`} /></div>
        <p className="text-xs text-gray-400 flex-1">Wearing a top, pants or shoes switches to the undergarment base model, so every piece shows. Basics (white tee, jeans, shoes) are free; more skins come from weekly rewards or admin gifts.</p>
      </div>
      <div className="flex flex-wrap gap-1 mt-2" role="tablist" aria-label="Wardrobe categories">
        {SLOT_LIST.map(s => <button key={s.id} role="tab" aria-selected={slot === s.id} className={'pet-chip' + (slot === s.id ? ' on' : '')} onClick={() => setSlot(s.id)}>{s.icon} {s.label}</button>)}
      </div>
      <ul className="grid grid-cols-3 gap-2 mt-3">
        <li><button className={'pet-card2' + (!worn ? ' on' : '')} disabled={busy || !worn} aria-pressed={!worn} onClick={() => equip('')}><span className="text-xl">🚫</span><b>None</b><small>{!worn ? 'Selected' : 'Take it off'}</small></button></li>
        {list.map(it => {
          const mine = owns(it.code); const on = worn === it.code; const info = unlockInfo(it, boot, badgeNames)
          return (
            <li key={it.code}><button className={'pet-card2' + (on ? ' on' : '') + (mine ? '' : ' locked')} disabled={busy || !mine} aria-pressed={on} title={it.description} onClick={() => equip(it.code)}>
              <img src={thumb(it.code, it.img)} alt="" className="item-thumb" loading="lazy" /><b>{it.name}</b><small>{on ? 'Wearing' : mine ? 'Tap to wear' : info.text}</small></button></li>)
        })}
      </ul>
      {!list.length && <p className="text-xs text-gray-400 mt-2">Nothing here yet. Check back soon!</p>}
    </section>
  )
}

// ---------------------------------------------------------------- Rewards: weekly glory -> 1 new character (5,000) or 1 new skin (3,000). Max one per week.
function Rewards({ note }: { note: (t: string) => void }) {
  const { active, items, owns, rewardStatus, rewardClaim, busy, boot } = usePet()
  const [rs, setRs] = useState<any>(null); const [wk, setWk] = useState<'current' | 'previous'>('current'); const [pick, setPick] = useState('')
  useEffect(() => { rewardStatus().then(r => r.ok ? setRs(r.data) : note(r.error ?? 'Could not load rewards.')) }, [boot?.glory?.weekly])
  if (!active) return null
  const total = rs ? (wk === 'current' ? rs.current : rs.previous ?? 0) : 0; const claimed = rs ? (wk === 'current' ? rs.claimed_current : rs.claimed_previous) : null
  const tier = total >= 5000 ? 2 : total >= 3000 ? 1 : 0
  const skins = items.filter(i => i.kind === 'wardrobe' && (i.char_key === active.char_key || i.char_key === 'all') && !owns(i.code))
  const chars = items.filter(i => i.kind === 'character' && !owns(i.code))
  const go = async () => { const r = await rewardClaim(pick, wk); if (r.ok) { setPick(''); note('Reward claimed! 🎁'); rewardStatus().then(x => x.ok && setRs(x.data)) } else note(r.error ?? 'Could not claim that.') }
  const pct = (n: number) => Math.min(100, Math.floor(total * 100 / n))
  return (
    <section className="glass p-3 space-y-3" aria-label="Weekly rewards">
      <DeadlineBanner compact />
      <div className="flex gap-1">{(['current', 'previous'] as const).map(k => <button key={k} className={'pet-chip' + (wk === k ? ' on' : '')} onClick={() => { setWk(k); setPick('') }}>{k === 'current' ? 'This week' : 'Last week'}</button>)}</div>
      <div><div className="text-sm">🎽 Weekly glory: <b>{total.toLocaleString()}</b></div>
        <div className="text-xs text-gray-400 mt-1">3,000 → 1 new skin for your current character</div><Meter pct={pct(3000)} label="Progress to 3,000" />
        <div className="text-xs text-gray-400 mt-1">5,000 → 1 new character</div><Meter pct={pct(5000)} label="Progress to 5,000" /></div>
      {claimed ? <p className="text-sm text-emerald-300">✅ Already claimed for that week: {items.find(i => i.code === claimed)?.name ?? claimed}. One reward per week.</p>
        : tier === 0 ? <p className="text-sm text-gray-300">Reach 3,000 glory in a week to unlock a reward. You can claim last week’s reward too if you earned it.</p>
        : <>
          <p className="text-sm">Choose one reward (only one per week):</p>
          <select className="sym-inp" value={pick} onChange={e => setPick(e.target.value)} aria-label="Reward to claim">
            <option value="">Choose…</option>
            {tier >= 2 && <optgroup label="New character (5,000)">{chars.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>}
            <optgroup label={`Skin for ${CHAR_BY.get(active.char_key)?.nick ?? 'your character'} (3,000)`}>{skins.map(c => <option key={c.code} value={c.code}>{SLOT_LIST.find(s => s.id === c.slot)?.icon} {c.name}</option>)}</optgroup>
          </select>
          <button className="sym-btn w-full" disabled={busy || !pick} onClick={go}>Claim reward</button></>}
      <p className="text-[11px] text-gray-500">Admins own every character, skin, food and background automatically.</p>
    </section>)
}

// ---------------------------------------------------------------- Room: background + up to 14 placed items
function RoomEditor({ note }: { note: (t: string) => void }) {
  const { active, items, owns, itemMap, boot, badgeNames, setHome, busy, mood, calm } = usePet()
  const [bg, setBg] = useState<string>(bgCode(active?.home?.background))
  const [placed, setPlaced] = useState<Placed[]>(active?.home?.items ?? [])
  const [adding, setAdding] = useState<string | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  if (!active || !boot) return null
  const edit = (fn: () => void) => { fn(); setDirty(true) }
  const emojiOf = (c: string) => itemMap.get(c)?.emoji ?? '🎁'
  const nameOf = (c: string) => itemMap.get(c)?.name ?? c
  const pick = (x: number, y: number) => {
    if (adding) {
      if (placed.length >= MAX_ROOM_ITEMS) { note(`The room is full (${MAX_ROOM_ITEMS} items). Remove one first.`); return }
      edit(() => { setPlaced(p => [...p, { code: adding, x, y }]); setSel(placed.length); setAdding(null) })
    } else if (sel != null && placed[sel]) edit(() => setPlaced(p => p.map((it, i) => i === sel ? { ...it, x, y } : it)))
  }
  const remove = () => { if (sel == null) return; edit(() => { setPlaced(p => p.filter((_, i) => i !== sel)); setSel(null) }) }
  const save = async () => {
    const r = await setHome(active.id, { background: bg, items: placed })
    if (r.ok) { setDirty(false); note('Room saved 🏠') } else note(r.error ?? 'Could not save the room right now.')
  }
  const reset = () => { setBg(bgCode(active.home?.background)); setPlaced(active.home?.items ?? []); setSel(null); setAdding(null); setDirty(false) }
  const backgrounds = items.filter(i => i.kind === 'background').sort((a, b) => a.sort - b.sort)
  const stuff = items.filter(i => (ROOM_KINDS as readonly string[]).includes(i.kind)).sort((a, b) => a.sort - b.sort)
  const hint = adding ? `Tap the room to place ${nameOf(adding)}.` : sel != null ? `${nameOf(placed[sel]?.code ?? '')} selected. Tap the room to move it.` : 'Pick something below, then tap the room to place it.'
  return (
    <section className="glass p-3" aria-label="Room editor">
      <PetRoom background={bg} items={placed} emojiOf={emojiOf} nameOf={nameOf} look={active.appearance} char={active.char_key} mood={mood} calm={calm}
        petName={active.name} selected={sel} onSelect={i => { setAdding(null); setSel(i) }} onPick={pick} />
      <p className="text-xs text-gray-300 mt-2" role="status" aria-live="polite">{hint} <span className="text-gray-500">({placed.length}/{MAX_ROOM_ITEMS})</span></p>
      <div className="flex flex-wrap gap-2 mt-2">
        <button className="sym-btn !py-1" disabled={busy || !dirty} onClick={save}>Save room</button>
        <button className="sym-btn !py-1" disabled={sel == null} onClick={remove}>Remove selected</button>
        <button className="text-xs underline text-gray-400" disabled={!dirty} onClick={reset}>Undo changes</button>
      </div>
      <b className="block mt-3 text-sm">Background</b>
      <div className="flex flex-wrap gap-1 mt-1">
        {backgrounds.map(b => { const mine = owns(b.code); return (
          <button key={b.code} className={'pet-chip' + (bg === b.code ? ' on' : '')} disabled={!mine} aria-pressed={bg === b.code} title={mine ? b.description : unlockInfo(b, boot, badgeNames).text}
            onClick={() => edit(() => setBg(b.code))}>
            <img className="bg-thumb" alt="" src={BGS.some(x => x.code === b.code) ? `/assets/bg/${b.code}_t.jpg` : imgUrl(b.img)} loading="lazy" />{mine ? b.name : `🔒 ${b.name}`}</button>) })}
      </div>
      <b className="block mt-3 text-sm">Furniture and decorations</b>
      <div className="flex flex-wrap gap-1 mt-1">
        {stuff.map(s => { const mine = owns(s.code); return (
          <button key={s.code} className={'pet-chip' + (adding === s.code ? ' on' : '')} disabled={!mine} aria-pressed={adding === s.code} title={mine ? s.description : unlockInfo(s, boot, badgeNames).text}
            onClick={() => { setSel(null); setAdding(a => a === s.code ? null : s.code) }}>{mine ? s.emoji : '🔒'} {s.name}</button>) })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- Admin: gift an item
function AdminGift({ note }: { note: (t: string) => void }) {
  const { items, adminGrant } = usePet()
  const [user, setUser] = useState(''); const [code, setCode] = useState(''); const [qty, setQty] = useState(1); const [go, setGo] = useState(false); const [q, setQ] = useState('')
  const item = items.find(i => i.code === code)
  const send = async () => {
    setGo(true); const r = await adminGrant(user.trim(), code, qty); setGo(false)
    if (r.ok) { note(`Gifted ${item?.emoji ?? '🎁'} ${item?.name ?? code} to ${user.trim()}.`); setUser('') } else note(r.error ?? 'Could not gift that.')
  }
  return (
    <section className="glass p-3" aria-label="Admin gifts">
      <b>Admin: gift an item 🎁</b>
      <p className="text-xs text-gray-400 mt-1">Gives a member any item, including “Gift from an admin” ones. Foods stack; cosmetics are given once.</p>
      <input className="sym-inp mt-2" value={user} onChange={e => setUser(e.target.value)} placeholder="Member username" aria-label="Member username" />
      <input className="sym-inp" value={q} onChange={e => setQ(e.target.value)} placeholder="Search characters, skins, foods, backgrounds…" aria-label="Search items" />
      <select className="sym-inp" value={code} onChange={e => setCode(e.target.value)} aria-label="Item to gift">
        <option value="">Choose an item…</option>
        {items.filter(i => !q || (i.name + i.kind + (i.char_key ?? '')).toLowerCase().includes(q.toLowerCase()) || i.code === code).map(i => <option key={i.code} value={i.code}>{i.emoji} {i.name} ({i.kind})</option>)}
      </select>
      {item?.kind === 'food' && <input className="sym-inp" type="number" min={1} max={99} value={qty} onChange={e => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} aria-label="How many" />}
      <button className="sym-btn" disabled={go || !user.trim() || !code} onClick={send}>{go ? 'Sending…' : 'Gift it'}</button>
    </section>
  )
}

// The member's own LEO space: meet LEO, care for it, dress it, decorate its room, and choose how it behaves.
export function LeoSpace() {
  const { status, error, active, settings, boot, mood, fx, items, inv, owns, badgeNames, care, rename, setSettings, setCompanion, dailyGift, markSeen, deleteMyData, refresh, playFx, say, sayText, quiet, sound, calm, busy, unseen, itemMap } = usePet()
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('home')
  const [name, setName] = useState(''); const [msg, setMsg] = useState(''); const [feed, setFeed] = useState(false); const [confirm, setConfirm] = useState(false); const [retrying, setRetrying] = useState(false)
  const note = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(''), 4500) }
  const retry = async () => { setRetrying(true); try { await refresh() } finally { setRetrying(false) } }

  const next = useMemo(() => {
    if (!boot) return null
    const c = items.filter(i => i.unlock.type === 'glory' && !owns(i.code)).sort((a, b) => (a.unlock.glory ?? 0) - (b.unlock.glory ?? 0))[0]
    return c ? { it: c, info: unlockInfo(c, boot, badgeNames) } : null
  }, [items, boot, inv, badgeNames])

  if (status === 'loading') return <div className="glass p-4 text-center" role="status">LEO is waking up… 💤</div>
  if (status === 'off') return <div className="glass p-4 text-center">LEO is resting for now. Check back later! 🌙</div>
  if (!settings || !boot || !active) return (
    <div className="glass p-4 text-center space-y-2" role="alert">
      <div className="flex justify-center"><Leo emotion="sleepy" size={72} label="LEO is sleeping" /></div>
      <p>{error || 'LEO is taking a nap and cannot be reached right now.'}</p>
      <button className="sym-btn" disabled={retrying} onClick={retry}>{retrying ? 'Trying…' : 'Try again'}</button>
      {lastRpcError && <details className="text-left text-xs text-gray-400 mt-2"><summary className="cursor-pointer">Technical details (for admins)</summary><code className="block break-all mt-1">{lastRpcError}</code></details>}
    </div>)

  const foods = items.filter(i => i.kind === 'food' && owns(i.code))
  const setCalm = (v: boolean) => { setPetUi({ calm: v }); document.documentElement.dataset.petcalm = v ? '1' : '0'; window.dispatchEvent(new Event('sym-petui')) }
  const doRename = async () => { const r = await rename(active.id, name); if (r.ok) { setName(''); note('Name saved 💛') } else note(r.error ?? 'Could not save that name.') }
  const daily = async () => { const r = await dailyGift(); note(r.ok ? 'LEO found a cake for you! 🍰' : r.reason === 'claimed' ? 'You already got today’s treat. Come back tomorrow! 🌅' : r.error ?? 'No treat right now.') }
  const g = boot.glory

  return (
    <div className="space-y-3">
      {status === 'offline' && <div className="pet-warn" role="alert">{error || 'LEO is offline.'} <button className="underline" onClick={retry}>{retrying ? 'Trying…' : 'Retry'}</button></div>}

      <section className="glass p-3" aria-label={`${active.name} and its room`}>
        {tab !== 'room' && <PetRoom background={active.home?.background} items={active.home?.items ?? []} emojiOf={c => itemMap.get(c)?.emoji ?? '🎁'} nameOf={c => itemMap.get(c)?.name ?? c}
          look={active.appearance} char={active.char_key} mood={mood} petName={active.name} fx={fx} calm={calm} />}
        <div className="flex items-center gap-2 mt-2"><b className="text-lg truncate">{active.name}</b><span className="text-xs text-gray-400">{needText(active)}</span></div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
          <Bar label="Tummy" v={active.hunger} c="#f59e0b" /><Bar label="Energy" v={active.energy} c="#22d3ee" />
          <Bar label="Happy" v={active.happiness} c="#f472b6" /><Bar label="Curious" v={active.curiosity} c="#a78bfa" />
          <Bar label="Friendly" v={active.friendliness} c="#34d399" />
        </div>
      </section>

      <div className="pet-tabs" role="tablist" aria-label="LEO space sections">
        {TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} className={'pet-tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}><span aria-hidden="true">{t.icon}</span> {t.label}</button>)}
      </div>
      <p className="text-xs text-gray-300 min-h-[1.1rem]" role="status" aria-live="polite">{msg}</p>

      {unseen.length > 0 && <section className="glass p-3"><b>New for you 🎉</b>
        <p className="text-sm mt-1">{unseen.map(u => `${u.emoji} ${u.name}`).join(', ')}</p>
        <div className="flex gap-2 mt-2"><button className="sym-btn !py-1" onClick={() => { setTab('wardrobe'); markSeen() }}>Try it on</button><button className="text-xs underline text-gray-400" onClick={markSeen}>Got it</button></div></section>}

      {tab === 'home' && <>
        <section className="glass p-3" aria-label="Care">
          {!feed ? <div className="grid grid-cols-4 gap-1">
            <button className="pet-act" disabled={busy} onClick={() => setFeed(true)}><span>🍪</span>Feed</button>
            <button className="pet-act" disabled={busy} onClick={() => care(active.id, 'play')}><span>🎮</span>Play</button>
            <button className="pet-act" disabled={busy} onClick={() => care(active.id, 'rest')}><span>😴</span>Rest</button>
            <button className="pet-act" disabled={busy} onClick={() => care(active.id, 'cuddle')}><span>🤗</span>Cuddle</button>
          </div> : <div>
            <div className="flex flex-wrap gap-1">{foods.map(f => { const q = inv.get(f.code)?.qty; return (
              <button key={f.code} className="pet-act !w-auto px-2" disabled={busy} title={f.description} onClick={async () => { await care(active.id, 'feed', f.code); setFeed(false) }}>
                <img className="food-thumb" alt="" src={foodView(f.code, active.char_key, f).src} />{foodView(f.code, active.char_key, f).name}{f.unlock.type !== 'free' && q != null && !boot.is_admin ? ` ×${q}` : ''}</button>) })}</div>
            <button className="text-xs underline text-gray-400 mt-1" onClick={() => setFeed(false)}>Back</button>
          </div>}
          <button className="sym-btn w-full mt-2 !py-1.5" onClick={() => { playFx(); blip('pop', sound); if (!quiet) say('idle', {}, true); else sayText('…', 'normal', true) }}>👋 Say hi</button>
          {boot.config.daily_reward && <button className="sym-btn w-full mt-2 !py-1.5" onClick={daily}>🎁 Today’s treat (optional)</button>}
        </section>

        <section className="glass p-3" aria-label="Your guild progress">
          <b>Your guild progress 🔥</b>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center">
            <div><div className="text-lg font-bold">{(g.lifetime ?? 0).toLocaleString()}</div><small className="text-gray-400">Lifetime glory</small></div>
            <div><div className="text-lg font-bold">{g.rank != null ? '#' + g.rank : '—'}</div><small className="text-gray-400">Overall rank</small></div>
            <div><div className="text-lg font-bold">{(boot.badge_ids ?? []).length}</div><small className="text-gray-400">Achievements</small></div>
          </div>
          {next && <div className="mt-3"><p className="text-xs text-gray-300">Next unlock: <b>{next.it.emoji} {next.it.name}</b> · {next.info.pct}%</p><Meter pct={next.info.pct} label={`Progress to ${next.it.name}`} /><p className="text-[11px] text-gray-500 mt-1">{next.info.text}</p></div>}
          <p className="text-[11px] text-gray-500 mt-2">LEO only reads your glory and achievements to unlock things. It never changes them. <Link to="/leaderboard" className="underline">See the leaderboard</Link></p>
        </section>
      </>}

      {tab === 'chars' && <Characters note={note} />}
      {tab === 'wardrobe' && <Wardrobe note={note} />}
      {tab === 'rewards' && <Rewards note={note} />}
      {tab === 'room' && <RoomEditor key={active.id} note={note} />}

      {tab === 'settings' && <>
        <section className="glass p-3" aria-label="Rename">
          <b>Name</b>
          <div className="flex gap-2 mt-2"><input className="sym-inp !mb-0" value={name} maxLength={20} placeholder={active.name} onChange={e => setName(e.target.value)} aria-label="New name for your pet" />
            <button className="sym-btn" disabled={busy || !name.trim()} onClick={doRename}>Save</button></div>
        </section>
        <section className="glass p-3" aria-label="Comfort settings">
          <b>LEO settings</b>
          <Sw label="Show LEO on every page" on={settings.widget_state !== 'hidden'} set={v => setSettings({ widget_state: v ? 'open' : 'hidden' })} />
          <Sw label="Quiet mode (less talking and pop-ups)" on={quiet} set={v => setSettings({ quiet: v })} />
          <Sw label="Sound effects" on={settings.sound} set={v => setSettings({ sound: v })} />
          <Sw label="Calm motion (fewer animations)" on={calm || getPetUi().calm} set={setCalm} />
        </section>
        <section className="glass p-3" aria-label="Roaming companion">
          <b>Roaming companion 🚶</b>
          <Sw label="Show my mini companion on every page" on={settings.companion?.on !== false} set={v => setCompanion({ on: v })} />
          <div className="flex flex-wrap gap-1 mt-1" role="group" aria-label="Companion mode">
            {([['roam', '🚶 Roam'], ['follow', '🧲 Follow me'], ['stay', '📍 Stay'], ['sleep', '😴 Sleep']] as const).map(([m, l]) => <button key={m} className={'pet-chip' + ((settings.companion?.mode ?? 'roam') === m ? ' on' : '')} onClick={() => setCompanion({ mode: m })}>{l}</button>)}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">It turns itself off on slow or low-power devices and never blocks taps, scrolling or loading.</p>
        </section>
        <section className="glass p-3" aria-label="Visitors">
          <b>Visitors</b>
          <Sw label="Let visitors see my room, outfit and pet name" on={settings.show_pet && settings.show_home} set={v => setSettings({ show_pet: v, show_home: v, show_appearance: v, show_name: v, show_items: v })} />
        </section>
        <section className="glass p-3 text-sm"><Link to="/uploads" className="underline">📤 Upload characters, skins, foods or backgrounds</Link></section>
        {isAdmin && <AdminGift note={note} />}
        <section className="glass p-3 text-sm" aria-label="Your data">
          <p className="text-gray-400">Your pet only uses care items and unlocks inside SYMBIOTES. It never changes glory, achievements or rankings.</p>
          {!confirm ? <button className="text-xs underline text-gray-400 mt-2" onClick={() => setConfirm(true)}>Delete my LEO data…</button>
            : <div className="mt-2" role="alertdialog" aria-label="Confirm delete"><p>This removes your pet, items and settings. A fresh LEO will appear next time. Continue?</p>
              <button className="sym-btn !py-1 mr-2" onClick={async () => { const r = await deleteMyData(); setConfirm(false); setTab('home'); note(r.ok ? 'Your LEO data was removed. A fresh LEO is ready.' : r.error ?? 'Could not delete right now.') }}>Yes, delete</button>
              <button className="text-xs underline" onClick={() => setConfirm(false)}>Cancel</button></div>}
        </section>
      </>}

      <p className="text-center"><Link to="/" className="underline text-xs text-gray-400">Back to home</Link></p>
    </div>
  )
}

// small helper so the page title row can show the mascot too
export const LeoSpacePage = () => (
  <div><h1 className="text-xl font-bold mb-2 flex items-center gap-2"><Leo emotion="happy" size={28} /> LEO space</h1><LeoSpace /></div>
)
