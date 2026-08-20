// Theme-aware color helpers.
//
// The app is light-by-default with a `.dark` variant. Colored text/fills written
// only for dark backgrounds (e.g. `text-sky-300`, `bg-sky-500/10`) are near
// invisible on the white light-mode background, so every helper bakes in both a
// light (`text-*-700`, stronger fill) and a `dark:` (lighter text, softer fill)
// set of classes. `cn()`/tailwind-merge treats `dark:` as a variant, so the two
// never conflict.
//
// NOTE: every class must appear here as a complete literal string. Tailwind's
// scanner reads source text and cannot detect classes built via template
// interpolation (`bg-${c}-500/15`), so the full tokens are written out below.

interface ColorSet {
  bg: string
  border: string
  text: string
  badge: string
  card: string
  cardTitle: string
  dot: string
  dotText: string
  dotCircle: string
  header: string
}

const C: Record<string, ColorSet> = {
  sky: {
    bg: 'bg-sky-500/15 dark:bg-sky-500/10',
    border: 'border-sky-500/30',
    text: 'text-sky-700 dark:text-sky-300',
    badge: 'text-sky-700 bg-sky-500/15 border-sky-500/30 dark:text-sky-300 dark:bg-sky-500/10',
    card: 'border-sky-500/20 bg-sky-500/5 dark:border-sky-500/30 dark:bg-sky-500/10',
    cardTitle: 'text-sky-700 dark:text-sky-400',
    dot: 'bg-sky-500 dark:bg-sky-400',
    dotText: 'text-sky-500 dark:text-sky-400',
    dotCircle: 'bg-sky-500/10 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
    header: 'bg-sky-500/5 dark:bg-sky-500/10',
  },
  emerald: {
    bg: 'bg-emerald-500/15 dark:bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'text-emerald-700 bg-emerald-500/15 border-emerald-500/30 dark:text-emerald-300 dark:bg-emerald-500/10',
    card: 'border-emerald-500/20 bg-emerald-500/5 dark:border-emerald-500/30 dark:bg-emerald-500/10',
    cardTitle: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    dotText: 'text-emerald-500 dark:text-emerald-400',
    dotCircle: 'bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    header: 'bg-emerald-500/5 dark:bg-emerald-500/10',
  },
  amber: {
    bg: 'bg-amber-500/15 dark:bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'text-amber-700 bg-amber-500/15 border-amber-500/30 dark:text-amber-300 dark:bg-amber-500/10',
    card: 'border-amber-500/20 bg-amber-500/5 dark:border-amber-500/30 dark:bg-amber-500/10',
    cardTitle: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
    dotText: 'text-amber-500 dark:text-amber-400',
    dotCircle: 'bg-amber-500/10 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
    header: 'bg-amber-500/5 dark:bg-amber-500/10',
  },
  orange: {
    bg: 'bg-orange-500/15 dark:bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-700 dark:text-orange-300',
    badge: 'text-orange-700 bg-orange-500/15 border-orange-500/30 dark:text-orange-300 dark:bg-orange-500/10',
    card: 'border-orange-500/20 bg-orange-500/5 dark:border-orange-500/30 dark:bg-orange-500/10',
    cardTitle: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500 dark:bg-orange-400',
    dotText: 'text-orange-500 dark:text-orange-400',
    dotCircle: 'bg-orange-500/10 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300',
    header: 'bg-orange-500/5 dark:bg-orange-500/10',
  },
  red: {
    bg: 'bg-red-500/15 dark:bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-700 dark:text-red-300',
    badge: 'text-red-700 bg-red-500/15 border-red-500/30 dark:text-red-300 dark:bg-red-500/10',
    card: 'border-red-500/20 bg-red-500/5 dark:border-red-500/30 dark:bg-red-500/10',
    cardTitle: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500 dark:bg-red-400',
    dotText: 'text-red-500 dark:text-red-400',
    dotCircle: 'bg-red-500/10 dark:bg-red-500/10 text-red-700 dark:text-red-300',
    header: 'bg-red-500/5 dark:bg-red-500/10',
  },
  zinc: {
    bg: 'bg-zinc-500/15 dark:bg-zinc-500/10',
    border: 'border-zinc-500/30',
    text: 'text-zinc-700 dark:text-zinc-300',
    badge: 'text-zinc-700 bg-zinc-500/15 border-zinc-500/30 dark:text-zinc-300 dark:bg-zinc-500/10',
    card: 'border-zinc-500/20 bg-zinc-500/5 dark:border-zinc-500/30 dark:bg-zinc-500/10',
    cardTitle: 'text-zinc-700 dark:text-zinc-400',
    dot: 'bg-zinc-500 dark:bg-zinc-400',
    dotText: 'text-zinc-500 dark:text-zinc-400',
    dotCircle: 'bg-zinc-500/10 dark:bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
    header: 'bg-zinc-500/5 dark:bg-zinc-500/10',
  },
  violet: {
    bg: 'bg-violet-500/15 dark:bg-violet-500/10',
    border: 'border-violet-500/30',
    text: 'text-violet-700 dark:text-violet-300',
    badge: 'text-violet-700 bg-violet-500/15 border-violet-500/30 dark:text-violet-300 dark:bg-violet-500/10',
    card: 'border-violet-500/20 bg-violet-500/5 dark:border-violet-500/30 dark:bg-violet-500/10',
    cardTitle: 'text-violet-700 dark:text-violet-400',
    dot: 'bg-violet-500 dark:bg-violet-400',
    dotText: 'text-violet-500 dark:text-violet-400',
    dotCircle: 'bg-violet-500/10 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300',
    header: 'bg-violet-500/5 dark:bg-violet-500/10',
  },
  fuchsia: {
    bg: 'bg-fuchsia-500/15 dark:bg-fuchsia-500/10',
    border: 'border-fuchsia-500/30',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    badge: 'text-fuchsia-700 bg-fuchsia-500/15 border-fuchsia-500/30 dark:text-fuchsia-300 dark:bg-fuchsia-500/10',
    card: 'border-fuchsia-500/20 bg-fuchsia-500/5 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10',
    cardTitle: 'text-fuchsia-700 dark:text-fuchsia-400',
    dot: 'bg-fuchsia-500 dark:bg-fuchsia-400',
    dotText: 'text-fuchsia-500 dark:text-fuchsia-400',
    dotCircle: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
    header: 'bg-fuchsia-500/5 dark:bg-fuchsia-500/10',
  },
  purple: {
    bg: 'bg-purple-500/15 dark:bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-700 dark:text-purple-300',
    badge: 'text-purple-700 bg-purple-500/15 border-purple-500/30 dark:text-purple-300 dark:bg-purple-500/10',
    card: 'border-purple-500/20 bg-purple-500/5 dark:border-purple-500/30 dark:bg-purple-500/10',
    cardTitle: 'text-purple-700 dark:text-purple-400',
    dot: 'bg-purple-500 dark:bg-purple-400',
    dotText: 'text-purple-500 dark:text-purple-400',
    dotCircle: 'bg-purple-500/10 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300',
    header: 'bg-purple-500/5 dark:bg-purple-500/10',
  },
  cyan: {
    bg: 'bg-cyan-500/15 dark:bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-700 dark:text-cyan-300',
    badge: 'text-cyan-700 bg-cyan-500/15 border-cyan-500/30 dark:text-cyan-300 dark:bg-cyan-500/10',
    card: 'border-cyan-500/20 bg-cyan-500/5 dark:border-cyan-500/30 dark:bg-cyan-500/10',
    cardTitle: 'text-cyan-700 dark:text-cyan-400',
    dot: 'bg-cyan-500 dark:bg-cyan-400',
    dotText: 'text-cyan-500 dark:text-cyan-400',
    dotCircle: 'bg-cyan-500/10 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    header: 'bg-cyan-500/5 dark:bg-cyan-500/10',
  },
  teal: {
    bg: 'bg-teal-500/15 dark:bg-teal-500/10',
    border: 'border-teal-500/30',
    text: 'text-teal-700 dark:text-teal-300',
    badge: 'text-teal-700 bg-teal-500/15 border-teal-500/30 dark:text-teal-300 dark:bg-teal-500/10',
    card: 'border-teal-500/20 bg-teal-500/5 dark:border-teal-500/30 dark:bg-teal-500/10',
    cardTitle: 'text-teal-700 dark:text-teal-400',
    dot: 'bg-teal-500 dark:bg-teal-400',
    dotText: 'text-teal-500 dark:text-teal-400',
    dotCircle: 'bg-teal-500/10 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300',
    header: 'bg-teal-500/5 dark:bg-teal-500/10',
  },
  blue: {
    bg: 'bg-blue-500/15 dark:bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    badge: 'text-blue-700 bg-blue-500/15 border-blue-500/30 dark:text-blue-300 dark:bg-blue-500/10',
    card: 'border-blue-500/20 bg-blue-500/5 dark:border-blue-500/30 dark:bg-blue-500/10',
    cardTitle: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500 dark:bg-blue-400',
    dotText: 'text-blue-500 dark:text-blue-400',
    dotCircle: 'bg-blue-500/10 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300',
    header: 'bg-blue-500/5 dark:bg-blue-500/10',
  },
  yellow: {
    bg: 'bg-yellow-500/15 dark:bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-700 dark:text-yellow-300',
    badge: 'text-yellow-700 bg-yellow-500/15 border-yellow-500/30 dark:text-yellow-300 dark:bg-yellow-500/10',
    card: 'border-yellow-500/20 bg-yellow-500/5 dark:border-yellow-500/30 dark:bg-yellow-500/10',
    cardTitle: 'text-yellow-700 dark:text-yellow-400',
    dot: 'bg-yellow-500 dark:bg-yellow-400',
    dotText: 'text-yellow-500 dark:text-yellow-400',
    dotCircle: 'bg-yellow-500/10 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
    header: 'bg-yellow-500/5 dark:bg-yellow-500/10',
  },
  gray: {
    bg: 'bg-gray-500/15 dark:bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-700 dark:text-gray-300',
    badge: 'text-gray-700 bg-gray-500/15 border-gray-500/30 dark:text-gray-300 dark:bg-gray-500/10',
    card: 'border-gray-500/20 bg-gray-500/5 dark:border-gray-500/30 dark:bg-gray-500/10',
    cardTitle: 'text-gray-700 dark:text-gray-400',
    dot: 'bg-gray-500 dark:bg-gray-400',
    dotText: 'text-gray-500 dark:text-gray-400',
    dotCircle: 'bg-gray-500/10 dark:bg-gray-500/10 text-gray-700 dark:text-gray-300',
    header: 'bg-gray-500/5 dark:bg-gray-500/10',
  },
  brown: {
    bg: 'bg-[#8B5A2B]/15 dark:bg-[#8B5A2B]/20',
    border: 'border-[#8B5A2B]/30',
    text: 'text-[#5C3A1E] dark:text-[#D9A066]',
    badge: 'text-[#5C3A1E] bg-[#8B5A2B]/15 border-[#8B5A2B]/30 dark:text-[#D9A066] dark:bg-[#8B5A2B]/20',
    card: 'border-[#8B5A2B]/20 bg-[#8B5A2B]/5 dark:border-[#8B5A2B]/30 dark:bg-[#8B5A2B]/10',
    cardTitle: 'text-[#5C3A1E] dark:text-[#D9A066]',
    dot: 'bg-[#8B5A2B] dark:bg-[#D9A066]',
    dotText: 'text-[#8B5A2B] dark:text-[#D9A066]',
    dotCircle: 'bg-[#8B5A2B]/10 dark:bg-[#8B5A2B]/10 text-[#5C3A1E] dark:text-[#D9A066]',
    header: 'bg-[#8B5A2B]/5 dark:bg-[#8B5A2B]/10',
  },
}

const POS_BASE: Record<string, string> = {
  QB: 'red',
  RB: 'emerald',
  WR: 'blue',
  TE: 'orange',
  K: 'purple',
  DEF: 'brown',
  LB: 'violet',
  DE: 'fuchsia',
  DT: 'purple',
  CB: 'cyan',
  S: 'teal',
  DB: 'sky',
}

export interface PosStyle {
  bg: string
  border: string
  text: string
}

export function positionStyle(pos: string): PosStyle {
  const c = C[POS_BASE[pos] || 'zinc']
  return { bg: c.bg, border: c.border, text: c.text }
}

// A bordered "event card" panel with a colored title (e.g. best/worst picks).
export function eventPanel(color: string): { card: string; title: string } {
  const c = C[color] || C.zinc
  return { card: c.card, title: c.cardTitle }
}

// --- Tiers (emerald / amber / red) -----------------------------------------

export function confidenceBadge(c: number): string {
  if (c >= 0.66) return C.emerald.badge
  if (c >= 0.33) return C.amber.badge
  return C.red.badge
}

export function sosBadge(f: number): string {
  const pct = Math.round((f - 1) * 100)
  if (Math.abs(pct) < 1) return 'text-muted-foreground/50'
  if (pct > 0) return C.emerald.badge
  return C.red.badge
}

// Draft grade tiers by surplus %, from best to worst.
export function gradeBadge(pct: number | null): { grade: string; text: string; bg: string } {
  if (pct == null) return { grade: 'F', text: 'text-zinc-500/50 dark:text-zinc-500/40', bg: 'bg-zinc-500/10 dark:bg-zinc-500/10' }
  if (pct > 70) return { grade: 'A+', text: C.emerald.text, bg: 'bg-emerald-500/20 dark:bg-emerald-500/10' }
  if (pct > 40) return { grade: 'A', text: C.emerald.text, bg: 'bg-emerald-500/15 dark:bg-emerald-500/10' }
  if (pct > 15) return { grade: 'B', text: C.emerald.text, bg: 'bg-emerald-500/10 dark:bg-emerald-500/10' }
  if (pct > -15) return { grade: 'C', text: 'text-zinc-700 dark:text-zinc-400', bg: 'bg-zinc-500/10 dark:bg-zinc-500/10' }
  if (pct > -50) return { grade: 'D', text: C.red.text, bg: 'bg-red-500/10 dark:bg-red-500/10' }
  return { grade: 'F', text: C.red.text, bg: 'bg-red-500/20 dark:bg-red-500/10' }
}

// A rank tier badge (PlayerDetail overall / position rank).
export function rankTier(rank: number, high: number, low: number): string {
  if (rank <= high) return C.emerald.badge
  if (rank <= low) return C.amber.badge
  return C.red.badge
}

export function trendBadge(dir: 'up' | 'down' | 'stable'): string {
  if (dir === 'up') return C.emerald.badge
  if (dir === 'down') return C.red.badge
  return C.amber.badge
}

// --- Medals (gold / silver / bronze) ---------------------------------------

export function rankMedal(i: number): string {
  if (i === 0) return 'text-yellow-500 dark:text-yellow-400'
  if (i === 1) return 'text-gray-500 dark:text-gray-400'
  return 'text-amber-700 dark:text-amber-600'
}

// --- Win / loss / diff -----------------------------------------------------

export function diffColor(n: number): string {
  if (n > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (n < 0) return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

// --- League status badge ---------------------------------------------------

export interface StatusStyle {
  dot: string
  badge: string
}

const STATUS_COLOR: Record<string, string> = {
  complete: 'emerald',
  in_season: 'amber',
  pre_draft: 'blue',
  drafting: 'blue',
  pre_season: 'blue',
  post_season: 'blue',
}

export function statusBadge(status: string): StatusStyle {
  const c = C[STATUS_COLOR[status] || 'blue']
  return { dot: c.dotText, badge: c.badge }
}

// --- Transaction type accents ----------------------------------------------

export interface TxnAccent {
  accentText: string
  dot: string
  dotCircle: string
  header: string
}

const TXN_COLOR: Record<string, string> = {
  trade: 'violet',
  waiver: 'amber',
  free_agent: 'sky',
}

export function txnAccent(type: string): TxnAccent {
  const c = C[TXN_COLOR[type] || 'sky']
  return {
    accentText: c.text,
    dot: c.dot,
    dotCircle: c.dotCircle,
    header: c.header,
  }
}
