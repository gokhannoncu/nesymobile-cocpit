// Product alanı ortak ton sistemi — flow.tsx paletiyle uyumlu, genişletilmiş.
// Her ton: tint kart zemini, ikon rengi, vurgu metni, nokta/şerit rengi.

export type Tone =
  | 'purple'
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'amber'
  | 'teal'
  | 'indigo'
  | 'gray'

export const toneCard: Record<Tone, string> = {
  purple: 'bg-purple-50/70 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/60',
  blue: 'bg-blue-50/70 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/60',
  green: 'bg-green-50/70 border-green-200 dark:bg-green-950/30 dark:border-green-900/60',
  orange: 'bg-orange-50/70 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900/60',
  red: 'bg-red-50/70 border-red-200 dark:bg-red-950/30 dark:border-red-900/60',
  amber: 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/60',
  teal: 'bg-teal-50/70 border-teal-200 dark:bg-teal-950/30 dark:border-teal-900/60',
  indigo: 'bg-indigo-50/70 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/60',
  gray: 'bg-muted/40 border-border',
}

export const toneIcon: Record<Tone, string> = {
  purple: 'text-purple-600 dark:text-purple-400',
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  orange: 'text-orange-600 dark:text-orange-400',
  red: 'text-red-600 dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
  teal: 'text-teal-600 dark:text-teal-400',
  indigo: 'text-indigo-600 dark:text-indigo-400',
  gray: 'text-muted-foreground',
}

export const toneText: Record<Tone, string> = {
  purple: 'text-purple-700 dark:text-purple-300',
  blue: 'text-blue-700 dark:text-blue-300',
  green: 'text-green-700 dark:text-green-300',
  orange: 'text-orange-700 dark:text-orange-300',
  red: 'text-red-700 dark:text-red-300',
  amber: 'text-amber-700 dark:text-amber-300',
  teal: 'text-teal-700 dark:text-teal-300',
  indigo: 'text-indigo-700 dark:text-indigo-300',
  gray: 'text-muted-foreground',
}

export const toneDot: Record<Tone, string> = {
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  green: 'bg-green-600',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
  gray: 'bg-muted-foreground',
}

/** İkon squircle zemini (hero, kart başlıkları). */
export const toneIconBox: Record<Tone, string> = {
  purple: 'bg-purple-100 dark:bg-purple-900/40',
  blue: 'bg-blue-100 dark:bg-blue-900/40',
  green: 'bg-green-100 dark:bg-green-900/40',
  orange: 'bg-orange-100 dark:bg-orange-900/40',
  red: 'bg-red-100 dark:bg-red-900/40',
  amber: 'bg-amber-100 dark:bg-amber-900/40',
  teal: 'bg-teal-100 dark:bg-teal-900/40',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/40',
  gray: 'bg-muted',
}

/** Hero arkaplan degrade tonu. */
export const toneHero: Record<Tone, string> = {
  purple:
    'from-purple-50 via-background to-background dark:from-purple-950/40 border-purple-200/70 dark:border-purple-900/50',
  blue: 'from-blue-50 via-background to-background dark:from-blue-950/40 border-blue-200/70 dark:border-blue-900/50',
  green:
    'from-green-50 via-background to-background dark:from-green-950/40 border-green-200/70 dark:border-green-900/50',
  orange:
    'from-orange-50 via-background to-background dark:from-orange-950/40 border-orange-200/70 dark:border-orange-900/50',
  red: 'from-red-50 via-background to-background dark:from-red-950/40 border-red-200/70 dark:border-red-900/50',
  amber:
    'from-amber-50 via-background to-background dark:from-amber-950/40 border-amber-200/70 dark:border-amber-900/50',
  teal: 'from-teal-50 via-background to-background dark:from-teal-950/40 border-teal-200/70 dark:border-teal-900/50',
  indigo:
    'from-indigo-50 via-background to-background dark:from-indigo-950/40 border-indigo-200/70 dark:border-indigo-900/50',
  gray: 'from-muted/60 via-background to-background border-border',
}

// Yumuşak geçiş — ease-out, yaylanma yok
export const EASE = [0.25, 0.1, 0.25, 1] as const
