import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PetRoom, type Placed } from './PetRoom'
import { usePetSafe } from './PetContext'
import { supabase } from './lib'
import { bgCode } from './petCore'

type Pub = { char_key: string; name: string | null; appearance: any; home: { background?: string; items?: Placed[] } | null; glory: number; rank: number | null; mood: string; show_items: boolean; owner: { display_name: string | null; username: string } }

/** Live 16:9 room behind the profile header. Owner: their active pet, fully interactive. Visitor: read-only (Say Hi / Wave sparkle, tap furniture for rank + glory). */
export function ProfileRoom({ userId, username, mine, header }: { userId: string; username: string; mine: boolean; header: ReactNode }) {
  const pet = usePetSafe(); const [pub, setPub] = useState<Pub | null | undefined>(mine ? null : undefined); const [spark, setSpark] = useState(''); const [tip, setTip] = useState('')
  useEffect(() => { if (mine) return; setPub(undefined); supabase.rpc('pet_public', { p_username: username }).then(r => setPub((r.data as Pub) ?? null)) }, [username, mine, userId])
  const items = pet?.itemMap
  const emojiOf = (c: string) => items?.get(c)?.emoji ?? '🎁'; const nameOf = (c: string) => items?.get(c)?.name ?? c
  const react = (k: string) => { setSpark(k); window.setTimeout(() => setSpark(''), 1400) }

  if (mine) {
    const a = pet?.active
    if (!a || pet?.status === 'off') return <div className="prof-hero prof-noroom">{header}</div>
    return (
      <div className="prof-hero">
        <PetRoom background={a.home?.background} items={a.home?.items ?? []} emojiOf={emojiOf} nameOf={nameOf} look={a.appearance} char={a.char_key} mood={pet!.mood} petName={a.name} calm={pet!.calm} fx={pet!.fx} />
        <div className="prof-over">{header}</div>
        <Link to="/leo" className="prof-edit sym-btn !py-1 text-xs">🛋️ Decorate room</Link>
      </div>)
  }
  if (!pub) return <div className="prof-hero prof-noroom">{header}{pub === undefined && <p className="text-xs text-gray-500 p-2">Loading room…</p>}</div>
  const home = pub.home ?? {}; const list = pub.show_items ? (home.items ?? []) : []
  return (
    <div className="prof-hero">
      <PetRoom background={bgCode(home.background)} items={list} emojiOf={emojiOf} nameOf={nameOf} look={pub.appearance} char={pub.char_key} mood={spark ? 'excited' : pub.mood} petName={pub.name ?? 'Pet'}
        visitor reaction={spark} onFurniture={c => { setTip(`${nameOf(c)} · ${pub.owner.display_name || pub.owner.username}: ${pub.rank ? 'Rank #' + pub.rank : 'Unranked'} · ${pub.glory.toLocaleString()} glory`); window.setTimeout(() => setTip(''), 3500) }}>
        {spark && <span className="room-spark" aria-hidden="true">{spark}</span>}
      </PetRoom>
      <div className="prof-over">{header}</div>
      <div className="prof-visit" role="group" aria-label="Visitor reactions">
        <button className="sym-btn !py-1 text-xs" onClick={() => react('✨')}>👋 Say Hi</button>
        <button className="sym-btn !py-1 text-xs" onClick={() => react('🌟')}>🙌 Wave</button>
      </div>
      {tip && <div className="prof-tip glass" role="status">{tip}</div>}
    </div>)
}
