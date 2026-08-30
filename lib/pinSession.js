import crypto from "crypto";

/**
 * Usta/ta'minotchi/hamkor shaxsiy kodi bilan kirgandan keyin beriladigan
 * qisqa muddatli, serverda imzolangan sessiya tokeni (HMAC-SHA256).
 * Google/staff tokenidan farqli — bu Supabase Auth emas, faqat shu ilova
 * ichida /api/data'ga murojaat qilish huquqini tasdiqlaydi.
 */
const SECRET = process.env.PIN_SESSION_SECRET || "";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 soat

function signBody(body) {
  return crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
}

export function issueSession({ role, name }) {
  if (!SECRET) throw new Error("PIN_SESSION_SECRET sozlanmagan");
  const payload = { role, name: name || null, exp: Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function verifySession(token) {
  if (!token || typeof token !== "string" || !SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = signBody(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}
