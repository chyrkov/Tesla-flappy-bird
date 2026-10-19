const BEST_SCORE_COOKIE = 'flappy_tesla_best_score'
const BEST_SCORE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5
const LEGACY_BEST_SCORE_KEY = 'neon-roadster:best-score'
const MUTED_KEY = 'flappy-tesla:muted'

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix))
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`
}

function readLocalValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocalValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in private mode; the game still works without persistence.
  }
}

function parseScore(value: string | null): number {
  const score = Number(value)
  return Number.isFinite(score) && score > 0 ? Math.floor(score) : 0
}

export function loadBestScore(): number {
  const cookieScore = parseScore(readCookie(BEST_SCORE_COOKIE))
  const legacyScore = parseScore(readLocalValue(LEGACY_BEST_SCORE_KEY))
  if (legacyScore > cookieScore) saveBestScore(legacyScore)
  return Math.max(cookieScore, legacyScore)
}

export function saveBestScore(score: number): void {
  writeCookie(BEST_SCORE_COOKIE, String(score), BEST_SCORE_MAX_AGE_SECONDS)
}

export function loadMuted(): boolean {
  return readLocalValue(MUTED_KEY) === 'true'
}

export function saveMuted(isMuted: boolean): void {
  writeLocalValue(MUTED_KEY, String(isMuted))
}
