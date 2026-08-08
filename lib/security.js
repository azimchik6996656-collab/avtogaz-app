/**
 * Avtogaz Security helpers (v54)
 * - PIN hash (SHA-256, Web Crypto) — ochiq matn bilan solishtirish o'rniga
 * - Kirish urinishlari limit (brute-force himoya)
 * - Optimistic lock versiya
 *
 * Eslatma: to'liq server-side auth yo'q; bu mijoz + API qatlamini mustahkamlaydi.
 * Keyingi bosqich: Supabase Auth yoki maxfiy service-role API.
 */

const PIN_SALT = "avtogaz-v54-pin-salt-v1"; // ilova ichidagi tuz — serverga ko'chirish tavsiya etiladi
const LOCKOUT_KEY = "avtogaz-pin-lockout";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 daqiqa

export async function hashPin(pin) {
  const raw = `${PIN_SALT}:${String(pin || "")}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback (nodijital muhit) — oddiy hash, faqat zaxira
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "fb_" + (h >>> 0).toString(16);
}

export async function pinsMatch(input, stored) {
  if (!stored) return false;
  // Legacy: ochiq 4/7 xonali kod hali ham ishlaydi (migratsiya)
  if (/^\d{4}$/.test(stored) || /^\d{7}$/.test(stored)) {
    return input === stored;
  }
  const h = await hashPin(input);
  return h === stored;
}

export async function hashPinsObject(pins) {
  const out = {};
  for (const [k, v] of Object.entries(pins || {})) {
    if (!v) continue;
    if (/^\d{4}$/.test(v) || /^\d{7}$/.test(v)) out[k] = await hashPin(v);
    else out[k] = v;
  }
  return out;
}

/** Brute-force: 5 marta xato → 15 daqiqa blok */
export function getLockoutState() {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (!raw) return { locked: false, attempts: 0, until: 0 };
    const s = JSON.parse(raw);
    if (s.until && Date.now() < s.until) {
      return { locked: true, attempts: s.attempts || 0, until: s.until };
    }
    if (s.until && Date.now() >= s.until) {
      localStorage.removeItem(LOCKOUT_KEY);
      return { locked: false, attempts: 0, until: 0 };
    }
    return { locked: false, attempts: s.attempts || 0, until: 0 };
  } catch {
    return { locked: false, attempts: 0, until: 0 };
  }
}

export function recordFailedPinAttempt() {
  const cur = getLockoutState();
  if (cur.locked) return cur;
  const attempts = (cur.attempts || 0) + 1;
  const next = attempts >= MAX_ATTEMPTS
    ? { attempts, until: Date.now() + LOCKOUT_MS }
    : { attempts, until: 0 };
  try { localStorage.setItem(LOCKOUT_KEY, JSON.stringify(next)); } catch {}
  return {
    locked: attempts >= MAX_ATTEMPTS,
    attempts,
    until: next.until,
  };
}

export function clearPinAttempts() {
  try { localStorage.removeItem(LOCKOUT_KEY); } catch {}
}

export function isDefaultPinSet(pins, extraAdminCodes) {
  const defaults = new Set(["0610", "0440", "5959", "0610777", "1111", "2211", "3311"]);
  const vals = Object.values(pins || {});
  (extraAdminCodes || []).forEach((c) => c?.code && vals.push(c.code));
  return vals.some((v) => defaults.has(String(v)));
}

export const SECURITY = {
  MAX_ATTEMPTS,
  LOCKOUT_MS,
  APP_DATA_VERSION_KEY: "dataVersion",
};
