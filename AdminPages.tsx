import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib'
import { Avatar } from './ui'
import { CharSprite, wardrobeBuiltin } from './chars'
import { checkFile } from './Uploads'
import { BGS } from './catalog'
import type { SitAnchor, Walk } from './petCore'

const pubUrl = (path: string) => supabase.storage.from('pet-uploads').getPublicUrl(path).data.publicUrl
const Z: Record<string, number> = { shoes: 1, pants: 2, top: 4, glasses: 5, hat: 6 }

// ---- preview on a sample character (wardrobe) or in a sample room (background)
function SamplePreview({ u, meta, setMeta, adding }: { u: any; meta: { walk: Walk; sit: SitAnchor[] }; setMeta: (m: { walk: Walk; sit: SitAnchor[] }) => void; adding: boolean }) {
  const url = pubUrl(u.path)
  if (u.kind === 'background') {
    const w = meta.walk
    return (
      <div className="room16 pet-room" style={{ cursor: adding ? 'crosshair' : 'default' }}
        onClick={e => { if (!adding) return; const r = e.currentTarget.getBoundingClientRect(); setMeta({ ...meta, sit: [...meta.sit, { x: Math.round((e.clientX - r.left) / r.width * 100), y: Math.round((e.clientY - r.top) / r.height * 100), label: 'Seat ' + (meta.sit.length + 1) }] }) }}>
        <img className="room-bg" src={url} alt="Uploaded background preview" />
        <div className="room-zone" style={{ left: w.x0 + '%', top: w.y0 + '%', width: (w.x1 - w.x0) + '%', height: (w.y1 - w.y0) + '%' }} />
        {meta.sit.map((a, i) => <span key={i} className="room-sit" style={{ left: a.x + '%', top: a.y + '%' }} title={a.label} />)}
        <div className="room-pet" style={{ left: (w.x0 + w.x1) / 2 + '%', top: (w.y0 + w.y1) / 2 + '%', width: '24%' }}><CharSprite ch="leo" size={120} /></div>
      </div>)
  }
  if (u.kind === 'character' || u.kind === 'food') return <div className="ex ex-good mx-auto"><img src={url} alt="Uploaded sprite" /></div>
  const ch = u.char_key && u.char_key !== 'all' && !u.char_key.startsWith('up_') ? u.char_key : 'leo'
  const b = `/assets/chars/${ch}`
  const layers = [{ z: 1, s: `${b}/w/shoes1.png` }, { z: 2, s: `${b}/w/pants1.png` }, { z: 4, s: `${b}/w/top1.png` }].filter(l => l.z !== Z[u.kind]).concat([{ z: Z[u.kind], s: url }])
  return (
    <div className="ex ex-sample mx-auto"><span className="cs" style={{ width: 240, height: 240 }}>
      <img src={`${b}/bodycut.png`} alt="" style={{ zIndex: 3 }} />{layers.map((l, i) => <img key={i} src={l.s} alt="" style={{ zIndex: l.z }} />)}</span></div>)
}

function Review({ u, done }: { u: any; done: () => void }) {
  const [reason, setReason] = useState(''); const [msg, setMsg] = useState(''); const [chk, setChk] = useState<string>('checking…'); const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState<{ walk: Walk; sit: SitAnchor[] }>({ walk: { ...BGS[0].walk }, sit: [] }); const [adding, setAdding] = useState(false)
  useEffect(() => { // automatic re-check of the stored file
    (async () => { try { const b = await (await fetch(pubUrl(u.path))).blob(); const f = new File([b], 'x', { type: u.mime })
      const mb = Number((await supabase.from('site_settings').select('value').eq('key', 'pet_upload').maybeSingle()).data?.value?.max_mb ?? 2)
      const r = await checkFile(f, u.kind, mb); setChk(r.ok ? '✅ Format, size and transparency checks pass' : '⚠️ ' + r.msgs.join(' ')) } catch { setChk('⚠️ Could not re-check the file') } })()
  }, [u.id])
  const num = (k: keyof Walk, v: string) => setMeta(m => ({ ...m, walk: { ...m.walk, [k]: Math.max(0, Math.min(100, Number(v) || 0)) } }))
  const act = async (approve: boolean) => {
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('upload_review', { p_id: u.id, p_approve: approve, p_reason: approve ? null : reason, p_meta: u.kind === 'background' ? meta : {} })
    setBusy(false); if (error) setMsg(error.message); else done()
  }
  return (
    <div className="glass p-3 space-y-2">
      <div><b>{u.name}</b> <span className="text-xs text-gray-400">· {u.kind}{u.char_key ? ` · for ${u.char_key}` : ''} · by @{u.profiles?.username}</span>
        {u.description && <p className="text-sm text-gray-300">{u.description}</p>}<p className="text-xs text-gray-400">{u.width}x{u.height} · {(u.bytes / 1024).toFixed(0)} KB · {u.mime}</p></div>
      <SamplePreview u={u} meta={meta} setMeta={setMeta} adding={adding} />
      <p className="text-xs">{chk}</p>
      {u.kind === 'background' && <div className="text-xs space-y-1">
        <b>Walk zone (% of the room) and sit anchors — required</b>
        <div className="grid grid-cols-4 gap-1">{(['x0', 'x1', 'y0', 'y1'] as const).map(k => <label key={k}>{k}<input className="sym-inp !mb-0" type="number" value={meta.walk[k]} onChange={e => num(k, e.target.value)} /></label>)}</div>
        <button className="sym-btn !py-1" onClick={() => setAdding(a => !a)}>{adding ? 'Tap the preview to place…' : '➕ Add sit anchor (then tap the room)'}</button>
        {meta.sit.map((a, i) => <div key={i} className="flex gap-1 items-center"><span>{a.label} ({a.x}%, {a.y}%)</span><button className="underline text-gray-400" onClick={() => setMeta(m => ({ ...m, sit: m.sit.filter((_, j) => j !== i) }))}>remove</button></div>)}
      </div>}
      <input className="sym-inp" placeholder="Reason (required to reject)" value={reason} onChange={e => setReason(e.target.value)} />
      <div className="flex gap-2"><button className="sym-btn flex-1" disabled={busy} onClick={() => act(true)}>✅ Approve</button><button className="sym-btn danger flex-1" disabled={busy || reason.trim().length < 3} onClick={() => act(false)}>❌ Reject</button></div>
      {msg && <p className="text-amber-300 text-sm" role="alert">{msg}</p>}
    </div>)
}

export function AdminUploads() {
  const [rows, setRows] = useState<any[]>([]); const [tab, setTab] = useState<'pending' | 'done'>('pending'); const [mb, setMb] = useState(2); const [note, setNote] = useState('')
  const load = () => supabase.from('pet_uploads').select('*, profiles!pet_uploads_uploader_fkey(username)').order('created_at', { ascending: false }).limit(100).then(r => setRows(r.data ?? []))
  useEffect(() => { load(); supabase.from('site_settings').select('value').eq('key', 'pet_upload').maybeSingle().then(r => r.data?.value?.max_mb && setMb(Number(r.data.value.max_mb))) }, [])
  const list = rows.filter(r => (tab === 'pending') === (r.status === 'pending'))
  const saveMb = async () => { const { error } = await supabase.from('site_settings').upsert({ key: 'pet_upload', value: { max_mb: mb }, updated_at: new Date().toISOString() }); setNote(error ? error.message : `Max upload size is now ${mb} MB`) }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><Link to="/admin" className="text-xs underline text-gray-400">← Admin</Link><h1 className="text-xl font-bold">Upload approvals</h1></div>
      <div className="glass p-3 flex items-center gap-2 text-sm">Max file size (MB) <input className="sym-inp !mb-0 w-20" type="number" min={0.5} max={10} step={0.5} value={mb} onChange={e => setMb(Number(e.target.value))} /><button className="sym-btn !py-1" onClick={saveMb}>Save</button>{note && <span className="text-xs text-amber-300">{note}</span>}</div>
      <div className="flex gap-1"><button className={'pet-chip' + (tab === 'pending' ? ' on' : '')} onClick={() => setTab('pending')}>Waiting ({rows.filter(r => r.status === 'pending').length})</button><button className={'pet-chip' + (tab === 'done' ? ' on' : '')} onClick={() => setTab('done')}>Reviewed</button></div>
      {tab === 'pending' ? list.map(u => <Review key={u.id} u={u} done={load} />) : list.map(u => <div key={u.id} className="glass p-2 text-sm"><b>{u.name}</b> · {u.kind} · @{u.profiles?.username} — {u.status === 'approved' ? '✅ approved' : '❌ rejected'}{u.reason ? ` (${u.reason})` : ''}</div>)}
      {!list.length && <p className="text-sm text-gray-400 text-center">Nothing here.</p>}
    </div>)
}

// ---- Admin info panel: who visited today, who is absent, 30-day attendance (sort + filter to spot inactive players)
type Row = { member_id: string; username: string; display_name: string | null; avatar_url: string | null; role: string; joined_at: string; last_seen: string | null; visited: string[] }
const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10)
export function AdminInfo() {
  const [rows, setRows] = useState<Row[]>([]); const [err, setErr] = useState(''); const [q, setQ] = useState(''); const [sort, setSort] = useState('absent'); const [only, setOnly] = useState('all'); const [loading, setLoading] = useState(true)
  const load = () => { setLoading(true); supabase.rpc('admin_attendance', { p_days: 30 }).then(r => { setLoading(false); if (r.error) setErr(r.error.message + ' — run SYMBIOTES_PHASE4.sql in Supabase.'); else setRows((r.data ?? []) as Row[]) }) }
  useEffect(() => { load() }, [])
  const today = istDay(); const days = useMemo(() => Array.from({ length: 30 }, (_, i) => istDay(new Date(Date.now() - (29 - i) * 86400e3))), [today])
  const data = useMemo(() => rows.map(r => {
    const set = new Set(r.visited); const cnt = days.filter(d => set.has(d)).length; let streak = 0
    for (let i = 29; i >= 0 && !set.has(days[i]); i--) streak++
    return { ...r, set, cnt, streak, here: set.has(today) }
  }), [rows, days, today])
  const here = data.filter(r => r.here); const gone = data.filter(r => !r.here)
  const list = data.filter(r => (r.username + (r.display_name ?? '')).toLowerCase().includes(q.toLowerCase()) && (only === 'all' || (only === 'inactive7' && r.streak >= 7) || (only === 'inactive14' && r.streak >= 14) || (only === 'never' && r.cnt === 0) || (only === 'today' && r.here) || (only === 'absent' && !r.here)))
    .sort((a, b) => sort === 'absent' ? b.streak - a.streak : sort === 'least' ? a.cnt - b.cnt : sort === 'most' ? b.cnt - a.cnt : sort === 'seen' ? String(b.last_seen ?? '').localeCompare(String(a.last_seen ?? '')) : a.username.localeCompare(b.username))
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><Link to="/admin" className="text-xs underline text-gray-400">← Admin</Link><h1 className="text-xl font-bold">Admin info</h1><button className="ml-auto sym-btn !py-1 text-xs" onClick={load}>↻ Refresh</button></div>
      {err && <p className="glass p-3 text-amber-300 text-sm" role="alert">{err}</p>}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="glass p-2"><b className="text-2xl text-emerald-300">{here.length}</b><div className="text-xs text-gray-400">Visited today</div></div>
        <div className="glass p-2"><b className="text-2xl text-rose-300">{gone.length}</b><div className="text-xs text-gray-400">Absent today</div></div>
        <div className="glass p-2"><b className="text-2xl">{data.filter(r => r.streak >= 7).length}</b><div className="text-xs text-gray-400">Away 7+ days</div></div>
      </div>
      <details className="glass p-3" open><summary className="cursor-pointer font-semibold">✅ Visited today ({here.length})</summary>{here.map(r => <div key={r.member_id} className="flex items-center gap-2 py-1 text-sm"><Avatar src={r.avatar_url} name={r.display_name || r.username} size={26} ring={false} />{r.display_name || r.username}</div>)}</details>
      <details className="glass p-3"><summary className="cursor-pointer font-semibold">🚫 Absent today ({gone.length})</summary>{gone.map(r => <div key={r.member_id} className="flex items-center gap-2 py-1 text-sm"><Avatar src={r.avatar_url} name={r.display_name || r.username} size={26} ring={false} />{r.display_name || r.username}<small className="ml-auto text-gray-500">{r.streak >= 30 ? '30+ days' : r.streak + 'd'}</small></div>)}</details>
      <section className="glass p-3" aria-label="30-day attendance">
        <b>30-day attendance</b>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input className="sym-inp !mb-0" placeholder="🔍 Find a player" value={q} onChange={e => setQ(e.target.value)} />
          <select className="sym-inp !mb-0" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="absent">Longest absent first</option><option value="least">Fewest days</option><option value="most">Most days</option><option value="seen">Last seen</option><option value="name">Name A–Z</option></select>
          <select className="sym-inp !mb-0 col-span-2" value={only} onChange={e => setOnly(e.target.value)} aria-label="Filter"><option value="all">Show everyone</option><option value="today">Visited today</option><option value="absent">Absent today</option><option value="inactive7">Inactive 7+ days</option><option value="inactive14">Inactive 14+ days</option><option value="never">No visits in 30 days</option></select>
        </div>
        {loading && <p className="text-xs text-gray-400 mt-2">Loading…</p>}
        <div className="mt-2 space-y-2">{list.map(r => (
          <div key={r.member_id} className="py-1.5 border-t border-white/10 first:border-0">
            <div className="flex items-center gap-2 text-sm"><Avatar src={r.avatar_url} name={r.display_name || r.username} size={26} ring={false} /><b className="truncate">{r.display_name || r.username}</b>
              <span className="ml-auto text-xs"><b className={r.cnt < 5 ? 'text-rose-300' : 'text-emerald-300'}>{r.cnt}/30</b> days</span></div>
            <div className="att-strip" role="img" aria-label={`${r.cnt} of 30 days visited`}>{days.map(d => <i key={d} className={r.set.has(d) ? 'on' : ''} title={d} />)}</div>
            <div className="text-[11px] text-gray-500">Last seen {r.last_seen ? new Date(r.last_seen).toLocaleDateString() : 'never'} · absent {r.streak >= 30 ? '30+' : r.streak} day{r.streak === 1 ? '' : 's'} in a row</div>
          </div>))}{!list.length && !loading && <p className="text-xs text-gray-400">No players match.</p>}</div>
      </section>
    </div>)
}
