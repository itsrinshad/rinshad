import { CharSprite, type Wear } from './chars'

// The old SVG pets are gone. LEO is now the first of five PDF characters; every screen still calls <Leo/> with the same props.
export type Look = { w?: Record<string, Wear>; [k: string]: unknown }
export const EMOTIONS = ['idle', 'excited', 'eating', 'sleepy', 'curious', 'sad']
export function Leo({ emotion = 'normal', size = 80, look, char = 'leo', fx = '', label = 'LEO', talking = false }: {
  emotion?: string; size?: number; talking?: boolean; look?: unknown; char?: string; variant?: string; fx?: string; label?: string
}) {
  return <CharSprite ch={char} look={look} emotion={emotion} size={size} fx={fx} label={label} style={talking ? { filter: 'brightness(1.05)' } : undefined} />
}

export const STORY: [string, string][] = [
  ['Every family has a beginning. Every legend has a first chapter.', 'welcoming'],
  ['SYMBIOTES started with an idea, a friendship and a shared passion for gaming.', 'happy'],
  ['The guild was founded by RIN and SHAHIL, alongside the founding members HEMANADH, SHAMMAS and SATHYA.', 'celebrating'],
  ['What started as a small group of players became something bigger: a family built on friendship, teamwork, loyalty and the desire to grow together.', 'very_happy'],
  ['The name SYMBIOTES represents connection. Different players, different personalities, but one united family.', 'thinking'],
  ['The goal was never just to collect players or win matches. It was to create a place where everyone could improve, compete, support each other and make unforgettable memories.', 'excited'],
  ['RIN (RINSHAD), the guild founder, also created the SYMBIOTES website to bring the family closer through technology.', 'winking'],
  ["Today, every new member becomes part of this continuing story. We don't just play together. We grow together.", 'happy'],
  ['WE ARE SYMBIOTES. 🧡', 'celebrating'],
]
