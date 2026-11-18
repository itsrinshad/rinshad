import { Link } from 'react-router-dom'
import { BGS, CHARS } from './catalog'
import { DeadlineBanner } from './deadline'
import { UploadGuide } from './Uploads'
import { GuildLinks } from './Home'
import { Logo } from './Symbiote'

const FEATURES: [string, string, string][] = [
  ['🏆', 'Leaderboards & glory', 'Weekly and lifetime rankings, a personal glory tracker and a weekly deadline countdown.'],
  ['💬', 'Guild chat', 'Group chats and direct messages with your teammates.'],
  ['📣', 'News & polls', 'Announcements from the admins and polls everyone can vote in.'],
  ['🏅', 'Achievements', 'Badges for the Glory Champion, Weekly MVP, Most Active and more.'],
  ['🧑‍🎤', '5 characters & wardrobe', 'Pick a chibi companion, dress it with 45 skins each and feed it 9 foods.'],
  ['🏠', 'Your own room', 'A live 16:9 profile room with 5 backgrounds and up to 14 decorations.'],
  ['🚶', 'Roaming companion', 'Your mini character walks, sits and naps across every page.'],
  ['📤', 'Player uploads', 'Make your own characters, skins, foods and backgrounds for everyone.'],
  ['📡', 'Activity tab', 'See who is active and inactive today.'],
  ['📜', 'Rules & feedback', 'Clear guild rules and a place for ideas and bug reports.'],
]
const BENEFITS = ['Be part of a friendly, active guild family', 'Earn weekly rewards: 3,000 glory = a new skin, 5,000 glory = a new character', 'Climb the leaderboard and collect badges', 'Decorate a room and show it off to visitors', 'Get help, tips and teammates for every game night']
const STEPS = ['Ask an admin for an account (use the Join button below). Accounts are created by the admin.', 'Log in with your username and password, then open My Profile and add your game name and photo.', 'Meet your companion on the LEO page: feed it, dress it and pick a background.', 'Play with the guild. Admins record glory every evening (10–11 PM IST); the week closes Sunday 11:59 PM IST.', 'Reach 3,000 or 5,000 glory in a week and claim your reward in LEO → Rewards.', 'Make your own art on the Upload page. Admins approve it and you get a notification.']

// Public page: no login needed.
export function Welcome() {
  return (
    <div className="space-y-4">
      <section className="glass p-5 text-center"><div className="sym-title flex justify-center"><Logo size={30} /></div>
        <h1 className="text-2xl font-bold mt-2">Welcome to SYMBIOTES</h1><p className="text-gray-300 text-sm mt-1">A gaming guild family. Different players, one united team. 🧡</p>
        <div className="flex gap-2 justify-center mt-3"><a href="#join" className="sym-btn">✨ Join</a><Link to="/login" className="sym-btn">🔑 Login</Link></div></section>
      <section aria-label="Guild features"><h2 className="font-bold text-lg mb-2">What you get</h2>
        <div className="grid gap-2 sm:grid-cols-2">{FEATURES.map(([i, t, d]) => <div key={t} className="glass p-3 flex gap-3"><span className="text-2xl" aria-hidden="true">{i}</span><div><b>{t}</b><p className="text-xs text-gray-300">{d}</p></div></div>)}</div></section>
      <section className="glass p-3"><h2 className="font-bold text-lg">Why join?</h2><ul className="list-disc pl-5 text-sm space-y-1 mt-1">{BENEFITS.map(b => <li key={b}>{b}</li>)}</ul></section>
      <section className="glass p-3"><h2 className="font-bold text-lg">How to use the site</h2><ol className="list-decimal pl-5 text-sm space-y-1 mt-1">{STEPS.map(b => <li key={b}>{b}</li>)}</ol></section>
      <DeadlineBanner compact />
      <section aria-label="Characters"><h2 className="font-bold text-lg mb-2">Meet the 5 characters</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">{CHARS.map(c => <figure key={c.key} className="glass p-2 min-w-[130px] text-center"><img src={`/assets/chars/${c.key}/default.png`} alt={`${c.nick} character`} loading="lazy" className="w-28 h-28 mx-auto" /><figcaption className="text-xs"><b>#{String(c.num).padStart(2, '0')} {c.nick}</b><br />{c.first} {c.last}</figcaption></figure>)}</div></section>
      <section aria-label="Backgrounds"><h2 className="font-bold text-lg mb-2">5 cozy rooms</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">{BGS.map(b => <figure key={b.code} className="glass p-2 min-w-[220px]"><img src={`/assets/bg/${b.code}_t.jpg`} alt={b.name} loading="lazy" className="rounded w-full aspect-video object-cover" /><figcaption className="text-xs mt-1"><b>{b.name}</b><br />{b.unlock}</figcaption></figure>)}</div></section>
      <UploadGuide />
      <section id="join" className="glass p-4 text-center"><h2 className="font-bold text-lg">Ready to join?</h2><p className="text-sm text-gray-300 mt-1">Message an admin to get your account, then log in.</p>
        <div className="my-3"><GuildLinks /></div><Link to="/login" className="sym-btn inline-block">🔑 Login</Link></section>
    </div>)
}
