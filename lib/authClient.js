import { createClient } from "@supabase/supabase-js";

/**
 * Brauzer tomonidagi autentifikatsiya yordamchisi.
 *  - Google (Supabase Auth): supabase-js anon kalit bilan — bu xavfsiz, chunki
 *    anon kalit faqat Auth uchun ishlatiladi, ma'lumot so'rovlari hamon
 *    /api/data orqali (SERVICE ROLE bilan, serverda) boradi.
 *  - PIN-sessiya: /api/login orqali olingan token, faqat xotirada (modul
 *    darajasida) saqlanadi — sahifa yangilansa yo'qoladi, aynan hozirgi
 *    PIN xulq-atvoriga mos ("har safar qayta kirish kerak").
 *
 * MUHIM (v58 tuzatishi): createClient() modul yuklangan zahoti chaqiriladi.
 * Agar muhit o'zgaruvchilari (env) bo'lmasa — build paytidagi "prerender"
 * bosqichida yoki Vercel'da o'zgaruvchi noto'g'ri nomlangan bo'lsa — u
 * "supabaseUrl is required" xatosini otadi va BUTUN sahifa ishga tushmaydi
 * (oq ekran / 500 xato). Endi mavjudligini tekshiramiz: bo'lmasa ilova baribir
 * ochiladi, faqat Google orqali kirish tushunarli xabar bilan to'xtaydi.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON) : null;

const NOT_CONFIGURED = {
  message:
    "Server sozlamalari to'liq emas (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Administratorga murojaat qiling.",
};

let pinToken = null;
let branchId = "main";

export const authClient = {
  supabase,

  /** Joriy filial (branch) — App() ildiz komponenti mount bo'lganda o'rnatiladi
   * (URL manziliga qarab), va storage/login/staff so'rovlarida ishlatiladi. */
  get branchId() { return branchId; },
  setBranchId(id) { branchId = id || "main"; },

  /** Google/email kirish umuman sozlanganmi — LoginScreen shu bilan tugmani bloklaydi. */
  isConfigured: Boolean(supabase),

  async getGoogleSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  },

  onGoogleAuthChange(cb) {
    if (!supabase) return { unsubscribe() {} };
    const { data } = supabase.auth.onAuthStateChange(cb);
    return data.subscription;
  },

  signInWithGoogle() {
    if (!supabase) return Promise.resolve({ data: null, error: NOT_CONFIGURED });
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
  },

  // Google hisobi bo'lmagan ofis xodimlari uchun — emailga "sehrli havola" yuboriladi.
  // Havolani bosgach xuddi Google bilan kirgandagidek sessiya ochiladi (server tomon
  // farqlamaydi — /api/whoami faqat email staff jadvalida bor-yo'qligini tekshiradi).
  signInWithEmail(email) {
    if (!supabase) return Promise.resolve({ data: null, error: NOT_CONFIGURED });
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
  },

  async signOutGoogle() {
    if (!supabase) return;
    try { await supabase.auth.signOut(); } catch {}
  },

  setPinToken(token) {
    pinToken = token || null;
  },

  clearPinToken() {
    pinToken = null;
  },

  async getAuthHeader() {
    if (pinToken) return `Bearer ${pinToken}`;
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const at = data?.session?.access_token;
    return at ? `Bearer ${at}` : null;
  },
};
