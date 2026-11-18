import { createRoot } from 'react-dom/client'
import './index.css'
import { PetRoom } from './PetRoom'
const look = { w: { sakura: { top: 'w_sakura_top5', pants: 'w_sakura_pants7', shoes: 'w_sakura_shoes1', hat: 'w_sakura_hat8', glasses: 'w_sakura_glasses3' } } }
createRoot(document.getElementById('r')!).render(<div style={{ width: 390, padding: 6, display: 'grid', gap: 8 }}>
  <PetRoom background="bg01" items={[{ code: 'furn_sofa', x: 28, y: 62 }, { code: 'deco_plant', x: 8, y: 70 }]} emojiOf={c => c === 'furn_sofa' ? '🛋️' : '🪴'} char="sakura" look={look} mood="happy" />
  <PetRoom background="bg03" items={[]} emojiOf={() => ''} char="gojo" look={{}} mood="happy" />
  <PetRoom background="bg05" items={[]} emojiOf={() => ''} char="levi" look={{}} mood="sleepy" />
</div>)
