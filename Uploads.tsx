import { useEffect, useState } from 'react'
import { supabase } from './lib'
import { useAuth } from './auth'
import { CHARS } from './catalog'

export const UPLOAD_TYPES = [
  { id: 'character', label: 'Character', needsChar: false }, { id: 'top', label: 'T-shirt / Top', needsChar: true }, { id: 'pants', label: 'Pants', needsChar: true },
  { id: 'shoes', label: 'Shoes', needsChar: true }, { id: 'hat', label: 'Hat', needsChar: true }, { id: 'glasses', label: 'Glasses', needsChar: true },
  { id: 'food', label: 'Food', needsChar: false }, { id: 'background', label: 'Background', needsChar: false },
] as const

// ---- the plain-language guide (also shown on the public page)
export function UploadGuide() {
  return (
    <section className="glass p-3 space-y-2" aria-label="Upload guide">
      <h2 className="font-bold text-lg">📤 How to make a good upload</h2>
      <ol className="list-decimal pl-5 space-y-1 text-sm">
        <li>Use PNG only, with a transparent background (no background at all).</li>
        <li>Make the item face front, centered, on a 512x512 canvas.</li>
        <li>Choose the correct type: Character, T-shirt/Top, Pants, Shoes, Hat, Glasses, Food, or Background.</li>
        <li>Foods: one item per file, such as a cake, apple or donut, in cute cartoon style.</li>
        <li>Match the style: chibi, bold black outlines, cel-shaded.</li>
        <li>Backgrounds: 16:9, a wide empty floor in the center for the character to walk on, no characters inside.</li>
        <li>Do not upload copyrighted logos or inappropriate content.</li>
        <li>Wait for admin approval. You’ll be notified.</li>
      </ol>
      <div className="grid grid-cols-2 gap-2 text-center text-xs" aria-label="Good and bad examples">
        <figure><div className="ex ex-good"><img src="/assets/chars/leo/w/hat2.png" alt="Good example: hat on a transparent background" /></div><figcaption className="text-emerald-300 mt-1">✅ Good: transparent background</figcaption></figure>
        <figure><div className="ex ex-bad"><img src="/assets/chars/leo/w/hat2.png" alt="Bad example: hat inside a white box" /></div><figcaption className="text-rose-300 mt-1">❌ Bad: white or colored box</figcaption></figure>
      </div>
      <p className="text-[11px] text-gray-400">Layer order on the 512x512 canvas: Shoes 1 · Pants 2 · Body 3 · Tops 4 · Glasses 5 · Headwear 6. Sprites 512x512, max file size 2 MB. Backgrounds 1920x1080, PNG or JPG.</p>
      <a className="sym-btn inline-block text-center" href="/assets/template-512.png" download="symbiotes-template-512x512.png">⬇️ Download template (512x512 transparent PNG)</a>
    </section>)
}

// ---- automatic checks: format, size, dimensions, transparency
export type Check = { ok: boolean; msgs: string[]; w: number; h: number }
export async function checkFile(f: File, kind: string, maxMb: number): Promise<Check> {
  const msgs: string[] = []; const bg = kind === 'background'
  if (f.size > maxMb * 1048576) msgs.push(`File is ${(f.size / 1048576).toFixed(1)} MB. The limit is ${maxMb} MB.`)
  const head = new Uint8Array(await f.slice(0, 8).arrayBuffer())
  const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47; const jpg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
  if (bg ? !(png || jpg) : !png) msgs.push(bg ? 'Backgrounds must be a real PNG or JPG file.' : 'Use PNG only (a real PNG file, not a renamed picture).')
  const url = URL.createObjectURL(f)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad')); i.src = url })
    const w = img.naturalWidth, h = img.naturalHeight
    if (bg) { if (w !== 1920 || h !== 1080) msgs.push(`Backgrounds must be 1920x1080 (16:9). Yours is ${w}x${h}.`) }
    else {
      if (w !== 512 || h !== 512) msgs.push(`Sprites must be 512x512. Yours is ${w}x${h}.`)
      if (png && w <= 4096 && h <= 4096) {
        const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, 0)
        const d = x.getImageData(0, 0, w, h).data; let clearPx = 0, edge = 0, edgeClear = 0, solid = 0
        for (let py = 0; py < h; py += 2) for (let px = 0; px < w; px += 2) {
          const a = d[(py * w + px) * 4 + 3]; if (a < 12) clearPx++; else solid++
          if (px < 6 || py < 6 || px >= w - 6 || py >= h - 6) { edge++; if (a < 12) edgeClear++ }
        }
        const tot = clearPx + solid
        if (clearPx / tot < 0.08 || edgeClear / edge < 0.9) msgs.push('The background is not transparent. Remove the white or colored box so only the item shows.')
        if (solid / tot < 0.01) msgs.push('The picture looks empty. Is the item on the canvas?')
      }
    }
    return { ok: msgs.length === 0, msgs, w, h }
  } catch { return { ok: false, msgs: [...msgs, 'We could not read that image.'], w: 0, h: 0 } } finally { URL.revokeObjectURL(url) }
}

const badge = (s: string) => s === 'approved' ? '✅ Approved' : s === 'rejected' ? '❌ Not approved' : '⏳ Waiting for admin'
export function UploadPage() {
  const { session } = useAuth(); const uid = session!.user.id
  const [kind, setKind] = useState<string>('top'); const [name, setName] = useState(''); const [ch, setCh] = useState('leo'); const [desc, setDesc] = useState('')
  const [file, setFile] = useState<File | null>(null); const [chk, setChk] = useState<Check | null>(null); const [prev, setPrev] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const [maxMb, setMaxMb] = useState(2); const [mine, setMine] = useState<any[]>([]); const [upChars, setUpChars] = useState<any[]>([])
  const t = UPLOAD_TYPES.find(x => x.id === kind)!
  const load = () => supabase.from('pet_uploads').select('id,kind,name,status,reason,created_at').eq('uploader', uid).order('created_at', { ascending: false }).limit(30).then(r => setMine(r.data ?? []))
  useEffect(() => { load(); supabase.from('site_settings').select('value').eq('key', 'pet_upload').maybeSingle().then(r => r.data?.value?.max_mb && setMaxMb(Number(r.data.value.max_mb)))
    supabase.from('pet_items').select('code,name').eq('kind', 'character').like('code', 'up\\_%').then(r => setUpChars(r.data ?? [])) }, [])
  useEffect(() => { if (file) checkFile(file, kind, maxMb).then(setChk); else setChk(null) }, [kind, maxMb])
  const pick = async (f?: File) => {
    setMsg(''); setFile(f ?? null); setChk(null); if (prev) URL.revokeObjectURL(prev); setPrev(f ? URL.createObjectURL(f) : '')
    if (f) setChk(await checkFile(f, kind, maxMb))
  }
  const send = async () => {
    if (!file || !chk?.ok) return; setBusy(true); setMsg('')
    const ext = file.type === 'image/jpeg' ? 'jpg' : 'png'; const path = `${uid}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('pet-uploads').upload(path, file, { contentType: file.type, upsert: false })
    if (up.error) { setBusy(false); return setMsg('Upload failed: ' + up.error.message) }
    const r = await supabase.rpc('upload_submit', { p_kind: kind, p_name: name, p_char: t.needsChar ? ch : null, p_desc: desc, p_path: path, p_w: chk.w, p_h: chk.h, p_bytes: file.size, p_mime: file.type })
    if (r.error) { await supabase.storage.from('pet-uploads').remove([path]); setMsg(r.error.message) }
    else { setMsg('Sent! ✅ Wait for admin approval. You’ll be notified.'); setName(''); setDesc(''); pick(undefined); load() }
    setBusy(false)
  }
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">📤 Upload</h1>
      <UploadGuide />
      <section className="glass p-3" aria-label="Upload form">
        <label className="text-xs text-gray-400">Type</label>
        <select className="sym-inp" value={kind} onChange={e => setKind(e.target.value)}>{UPLOAD_TYPES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
        <label className="text-xs text-gray-400">Name</label>
        <input className="sym-inp" value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="e.g. Blue Star Hoodie" />
        {t.needsChar && <><label className="text-xs text-gray-400">Character it belongs to</label>
          <select className="sym-inp" value={ch} onChange={e => setCh(e.target.value)}>
            {CHARS.map(c => <option key={c.key} value={c.key}>{c.nick} ({c.first} {c.last})</option>)}{upChars.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}<option value="all">Any character</option></select></>}
        <label className="text-xs text-gray-400">Description</label>
        <textarea className="sym-inp" rows={2} maxLength={300} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Short description" />
        <label className="upload-box !p-3 text-sm block">🖼️ Choose file ({kind === 'background' ? 'PNG or JPG, 1920x1080' : 'PNG, 512x512, transparent'}, max {maxMb} MB)
          <input type="file" accept={kind === 'background' ? 'image/png,image/jpeg' : 'image/png'} className="hidden" onChange={e => pick(e.target.files?.[0])} /></label>
        {prev && <div className={kind === 'background' ? 'mt-2' : 'ex ex-good mt-2 mx-auto'}><img src={prev} alt="Preview of your file" className="max-w-full rounded" /></div>}
        {chk && <ul className="text-sm mt-2" role="status">{chk.ok ? <li className="text-emerald-300">✅ All checks passed ({chk.w}x{chk.h}).</li> : chk.msgs.map((m, i) => <li key={i} className="text-rose-300">❌ {m}</li>)}</ul>}
        <button className="sym-btn w-full mt-2" disabled={busy || !chk?.ok || name.trim().length < 2} onClick={send}>{busy ? 'Sending…' : 'Send for approval'}</button>
        {msg && <p className="text-amber-300 text-sm mt-2" role="status">{msg}</p>}
      </section>
      <section className="glass p-3" aria-label="My uploads"><b>My uploads</b>
        {!mine.length && <p className="text-xs text-gray-400 mt-1">Nothing yet.</p>}
        {mine.map(u => <div key={u.id} className="py-1.5 border-t border-white/10 text-sm first:border-0"><b>{u.name}</b> <span className="text-xs text-gray-400">· {u.kind}</span><div className="text-xs">{badge(u.status)}{u.reason ? ` — ${u.reason}` : ''}</div></div>)}
      </section>
    </div>)
}
