import { createClient } from "@supabase/supabase-js";

/**
 * Brauzer tomonidagi autentifikatsiya yordamchisi.
 *  - Google (Supabase Auth): supabase-js anon kalit bilan — bu xavfsiz, chunki
 *    anon kalit faqat Auth uchun ishlatiladi, ma'lumot so'rovlari hamon
 *    /api/data orqali (SERVICE ROLE bilan, serverda) boradi.
 *  - PIN-sessiya: /api/login orqali olingan token, faqat xotirada (modul
 *    darajasida) saqlanadi — sahifa yangilansa yo'qoladi, aynan hozirgi
 *    PIN xulq-atvoriga mos ("har safar qayta kirish kerak").
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

let pinToken = null;

export const authClient = {
  supabase,

  async getGoogleSession() {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  },

  onGoogleAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange(cb);
    return data.subscription;
  },

  signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
  },

  async signOutGoogle() {
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
    const { data } = await supabase.auth.getSession();
    const at = data?.session?.access_token;
    return at ? `Bearer ${at}` : null;
  },
};
