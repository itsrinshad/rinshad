import { type CSSProperties } from 'react'
import { CHARS } from './catalog'
import { supabase } from './lib'
import { usePetSafe } from './PetContext'

// Art helpers for the 5 PDF characters + approved player uploads. All art is a 512x512 transparent PNG; layers share one canvas.
export type Slot = 'top' | 'pants' | 'hat' | 'glasses' | 'shoes'
export type Wear = Partial<Record<Slot, string>>
export const SLOT_LIST: { id: Slot; label: string; icon: string; z: number }[] = [
  { id: 'top', label: 'Tops & Jackets', icon: '👕', z: 4 }, { id: 'pants', label: 'Pants', icon: '👖', z: 2 }, { id: 'hat', label: 'Headwear', icon: '🎩', z: 6 },
  { id: 'glasses', label: 'Glasses', icon: '🕶️', z: 5 }, { id: 'shoes', label: 'Shoes', icon: '👟', z: 1 },
]
export const CHAR_BY = new Map(CHARS.map(c => [c.key, c]))
export const EMO6 = ['idle', 'excited', 'eating', 'sleepy', 'curious', 'sad'] as const
export type Emo = typeof EMO6[number]
const A = '/assets'
export const charCode = (k: string) => (k.startsWith('up_') ? k : 'char_' + k)

// the old mood words used all over the app -> the six emotions on the PDF emotion sheets
const EMO_MAP: Record<string, Emo> = {
  normal: 'idle', happy: 'idle', welcoming: 'idle', winking: 'idle', shy: 'idle', idle: 'idle',
  excited: 'excited', very_happy: 'excited', laughing: 'excited', celebrating: 'excited', surprised: 'excited', shocked: 'excited',
  eating: 'eating', sleepy: 'sleepy', thinking: 'curious', confused: 'curious', curious: 'curious',
  sad: 'sad', crying: 'sad', angry: 'sad', disappointed: 'sad',
}
export const emoOf = (m?: string): Emo => EMO_MAP[m ?? 'idle'] ?? 'idle'

export function imgUrl(img?: string | null): string {
  if (!img) return ''
  if (img.startsWith('sb:')) return supabase.storage.from('pet-uploads').getPublicUrl(img.slice(3)).data.publicUrl
  return img
}
export const wardrobeBuiltin = (code: string): string | null => {
  const m = /^w_([a-z]+)_(top|pants|hat|glasses|shoes)([1-9])$/.exec(code); return m ? `${A}/chars/${m[1]}/w/${m[2]}${m[3]}.png` : null
}
export const FOOD_N: Record<string, number> = { food_biscuit: 1, food_apple: 2, food_milk: 3, food_berries: 4, food_cake: 5, food_gift: 6, food_honey: 7, food_pancakes: 8, food_donut: 9 }
export function foodView(code: string, ch: string, it?: { name: string; img?: string | null }): { name: string; src: string } {
  const n = FOOD_N[code]
  if (!n) return { name: it?.name ?? code, src: imgUrl(it?.img) }
  const own = CHAR_BY.get(ch)?.foodsOwn ? ch : 'leo'
  return { name: CHAR_BY.get(ch)?.foods[n - 1] ?? it?.name ?? code, src: `${A}/foods/${own}${n}.png` }
}
export const charName = (k: string, items?: Map<string, { name: string }>) => { const c = CHAR_BY.get(k); return c ? `${c.first} "${c.nick}" ${c.last}` : items?.get(k)?.name ?? k }
export const charNick = (k: string, items?: Map<string, { name: string }>) => CHAR_BY.get(k)?.nick ?? items?.get(k)?.name ?? 'Pet'
export const wearOf = (look: any, ch: string): Wear => (look?.w?.[ch] ?? {}) as Wear
export const previewCharSrc = (k: string, items?: Map<string, { img?: string | null }>) => CHAR_BY.has(k) ? `${A}/chars/${k}/default.png` : imgUrl(items?.get(k)?.img)

const FX_EMOJI: Record<string, string> = { hearts: '💖', confetti: '🎉', sparkle: '✨' }
const BADGE: Record<Emo, string> = { idle: '', excited: '✨', eating: '🍪', sleepy: '💤', curious: '❓', sad: '💧' }

/** Layered character: Footwear Z1, Pants Z2, Base body Z3, Tops Z4, Glasses Z5, Headwear Z6 on one 512x512 canvas. */
export function CharSprite({ ch = 'leo', look, emotion = 'idle', size = 80, fx = '', label, style, sit }: {
  ch?: string; look?: unknown; emotion?: string; size?: number; fx?: string; label?: string; style?: CSSProperties; sit?: boolean
}) {
  const pet = usePetSafe(); const items = pet?.itemMap
  const e = emoOf(emotion); const builtin = CHAR_BY.has(ch); const w = wearOf(look, ch)
  const src = (code?: string) => { if (!code) return ''; return wardrobeBuiltin(code) ?? imgUrl(items?.get(code)?.img) }
  const dressed = !!(w.top || w.pants || w.shoes)
  const base = `${A}/chars/${ch}`
  const layers: { z: number; s: string }[] = []
  let body = ''
  if (!builtin) body = imgUrl(items?.get(ch)?.img)
  else if (dressed) {
    body = `${base}/bodycut.png`
    layers.push({ z: 1, s: src(w.shoes) || `${base}/w/shoes1.png` }, { z: 2, s: src(w.pants) || `${base}/w/pants1.png` }, { z: 4, s: src(w.top) || `${base}/w/top1.png` })
  } else body = `${base}/e_${e}.png`
  if (w.glasses) layers.push({ z: 5, s: src(w.glasses) }); if (w.hat) layers.push({ z: 6, s: src(w.hat) })
  if (!builtin) { /* uploaded characters are one sprite: worn items sit on top of it */ for (const l of layers) if (l.z < 3) l.z = 3 }
  const badge = (dressed || !builtin) ? BADGE[e] : ''
  return (
    <span className={`cs cs-${e}${sit ? ' cs-sit' : ''}${fx ? ' cs-fx-' + fx : ''}`} style={{ width: size, height: size, ...style }} role="img" aria-label={label ?? charNick(ch)}>
      {body && <img src={body} alt="" style={{ zIndex: 3 }} draggable={false} decoding="async" />}
      {layers.filter(l => l.s).map((l, i) => <img key={i} src={l.s} alt="" style={{ zIndex: l.z }} draggable={false} decoding="async" />)}
      {badge && <i className="cs-badge" style={{ fontSize: Math.max(12, size * 0.22) }}>{badge}</i>}
      {fx && FX_EMOJI[fx] && <i className="cs-fx" style={{ fontSize: Math.max(14, size * 0.3) }}>{FX_EMOJI[fx]}</i>}
    </span>
  )
}
