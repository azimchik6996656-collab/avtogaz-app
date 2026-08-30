import { verifyGoogleStaff } from "../../../lib/staffAuth";
import { pinsMatch } from "../../../lib/security";
import { issueSession } from "../../../lib/pinSession";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 daqiqa

// Eslatma: /api/login'dagi kabi, xotirada saqlanadigan hisoblagich — asosiy
// himoya vazifasini o'taydi, mutlaq kafolat emas.
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
 * Ikkinchi bosqich (2FA) tekshiruvi — Google orqali kirgan ofis xodimi (azim/
 * rahbar/kassir/sklad) uchun, agar unga shaxsiy PIN o'rnatilgan bo'lsa. Buning
 * sababi: agar kompyuterda Google sessiyasi allaqachon ochiq bo'lsa, boshqa
 * birov "Google orqali kirish" tugmasini bosib, parolsiz to'g'ridan-to'g'ri
 * kirib ketishi mumkin edi. PIN — shu kompyuterni jismonan ishlatayotgan aynan
 * o'sha xodim ekanini tasdiqlaydi.
 *
 * Muvaffaqiyatli tekshiruvdan so'ng, /api/data uchun ishlatiladigan oddiy
 * PIN-sessiya tokeni beriladi (usta/rahbar PIN oqimi bilan bir xil mexanizm).
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const branchId = String(body?.branchId || "main");

    const authHeader = request.headers.get("authorization") || "";
    const googleToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const auth = await verifyGoogleStaff(googleToken, branchId);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

    if (!auth.pinHash) {
      // PIN o'rnatilmagan — 2FA talab qilinmaydi (chaqiruvchi buni ishlatmasligi kerak edi)
      return Response.json({ ok: false, error: "Bu xodim uchun PIN o'rnatilmagan" }, { status: 400 });
    }

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

    const match = await pinsMatch(pin, auth.pinHash);
    if (!match) {
      recordFail(ip);
      return Response.json({ ok: false, error: "PIN xato" }, { status: 401 });
    }

    recordSuccess(ip);
    const token = issueSession({ role: auth.role, name: auth.fullName || null, branchId });
    return Response.json({ ok: true, role: auth.role, name: auth.fullName || null, token });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
