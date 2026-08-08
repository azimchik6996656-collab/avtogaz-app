import { serverClient } from "../../../lib/supabaseServer";
import { pinsMatch } from "../../../lib/security";
import { issueSession } from "../../../lib/pinSession";

export const dynamic = "force-dynamic";

const ROW_ID = "main";
const STORAGE_KEY = "avtogaz-v2";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 daqiqa

// Eslatma: bu hisoblagich xotirada saqlanadi — serverless funksiya qayta ishga tushsa
// tozalanadi. Asosiy himoya vazifasini o'taydi, lekin mutlaq kafolat emas.
const attempts = new Map();

function getIp(request) {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || "unknown";
}

function checkLockout(ip) {
  const s = attempts.get(ip);
  if (!s) return { locked: false };
  if (s.until && Date.now() < s.until) return { locked: true, until: s.until };
  if (s.until && Date.now() >= s.until) attempts.delete(ip);
  return { locked: false };
}

function recordFail(ip) {
  const cur = attempts.get(ip) || { count: 0 };
  const count = cur.count + 1;
  attempts.set(ip, count >= MAX_ATTEMPTS ? { count, until: Date.now() + LOCKOUT_MS } : { count });
}

function recordSuccess(ip) {
  attempts.delete(ip);
}

/**
 * Faqat tashqi rollar (usta/ta'minotchi/hamkor) uchun — ofis xodimlari
 * (azim/rahbar/kassir/sklad) endi FAQAT Google orqali kiradi, PIN'lari
 * bu endpoint'da ataylab tekshirilmaydi.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pin = String(body?.pin || "");
    if (!pin) return Response.json({ ok: false, error: "PIN kerak" }, { status: 400 });

    const ip = getIp(request);
    const lo = checkLockout(ip);
    if (lo.locked) {
      const remainMin = Math.max(1, Math.ceil((lo.until - Date.now()) / 60000));
      return Response.json(
        { ok: false, error: `Juda ko'p urinish. ${remainMin} daqiqadan keyin qayta urinib ko'ring.`, locked: true },
        { status: 429 }
      );
    }

    const supabase = serverClient();
    const { data, error } = await supabase.from("app_data").select("data").eq("id", ROW_ID).single();
    if (error && error.code !== "PGRST116") throw error;

    const bag = data?.data || {};
    const wrapper = bag[STORAGE_KEY];
    const settings = (wrapper && wrapper.data && wrapper.data.settings) || {};
    const ustaCodes = settings.ustaCodes || [];
    const supplierCodes = settings.supplierCodes || [];
    const partnerCodes = settings.partnerCodes || [];

    for (const u of ustaCodes) {
      if (u?.code && (await pinsMatch(pin, u.code))) {
        recordSuccess(ip);
        return Response.json({ ok: true, role: "usta", name: u.name, token: issueSession({ role: "usta", name: u.name }) });
      }
    }
    for (const s of supplierCodes) {
      if (s?.code && (await pinsMatch(pin, s.code))) {
        recordSuccess(ip);
        return Response.json({ ok: true, role: "taminotchi", name: s.name, token: issueSession({ role: "taminotchi", name: s.name }) });
      }
    }
    for (const p of partnerCodes) {
      if (p?.code && (await pinsMatch(pin, p.code))) {
        recordSuccess(ip);
        return Response.json({ ok: true, role: "hamkor", name: p.partnerId, token: issueSession({ role: "hamkor", name: p.partnerId }) });
      }
    }

    recordFail(ip);
    return Response.json({ ok: false, error: "Kod xato" }, { status: 401 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
