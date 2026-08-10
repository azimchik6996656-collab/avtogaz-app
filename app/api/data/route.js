import { serverClient } from "../../../lib/supabaseServer";
import { verifySession } from "../../../lib/pinSession";
import { verifyGoogleStaff } from "../../../lib/staffAuth";

export const dynamic = "force-dynamic";

const ROW_ID = "main";

/**
 * MUHIM: bu route SERVICE ROLE kaliti bilan ishlaydi (RLS'ni chetlab o'tadi),
 * shuning uchun ruxsat tekshiruvi shu yerda, qo'lda amalga oshiriladi:
 *  - PIN-sessiya tokeni (usta/ta'minotchi/hamkor, /api/login orqali olingan), YOKI
 *  - Google (Supabase Auth) access_token + `staff` jadvalida ro'yxatdan o'tgan email
 * Ikkisidan biri ham to'g'ri kelmasa — so'rov rad etiladi.
 */
async function authorize(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, status: 401, error: "Avtorizatsiya kerak" };

  const pinPayload = verifySession(token);
  if (pinPayload) return { ok: true, role: pinPayload.role };

  return await verifyGoogleStaff(token);
}

export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) return Response.json({ ok: false, error: "key kerak" }, { status: 400 });

  try {
    const supabase = serverClient();
    const { data, error } = await supabase
      .from("app_data")
      .select("data, updated_at")
      .eq("id", ROW_ID)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    const bag = data?.data || {};
    const value = bag[key];
    const version = Number(bag.__version || 0);

    return Response.json({
      ok: true,
      value: value === undefined ? null : (typeof value === "string" ? value : JSON.stringify(value)),
      version,
      updatedAt: data?.updated_at || null,
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}

/**
 * PUT body: { key, valueStr, expectedVersion }
 * Optimistic lock: expectedVersion serverdagi bilan mos kelmasa 409 (conflict).
 *
 * MUHIM: tekshirish va yozish "save_app_data" SQL funksiyasi ichida, "for update"
 * satr qulfi bilan, BIR TRANZAKSIYADA amalga oshadi. Avval bu yerda alohida
 * SELECT so'ngra alohida UPSERT bo'lgan — ular orasida boshqa so'rov kirib qolsa
 * (masalan avtomatik saqlash va qo'lda "Saqlash" tugmasi bir vaqtda bosilsa),
 * ikkisi ham bir xil eski versiyani "joriy" deb o'qib, versiya raqami joyida
 * qolib, biri ikkinchisining yozganini sezmasdan bosib yuborishi mumkin edi.
 */
export async function PUT(request) {
  const auth = await authorize(request);
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { key, valueStr, expectedVersion } = body || {};
    if (!key || valueStr === undefined) {
      return Response.json({ ok: false, error: "key va valueStr kerak" }, { status: 400 });
    }

    const parsed = JSON.parse(valueStr);
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("save_app_data", {
      p_id: ROW_ID,
      p_key: key,
      p_value: parsed,
      p_expected_version:
        expectedVersion === undefined || expectedVersion === null ? null : Number(expectedVersion),
    });
    if (error) throw error;

    if (result?.conflict) {
      return Response.json(
        {
          ok: false,
          conflict: true,
          serverVersion: result.serverVersion,
          message: "Boshqa qurilma ma'lumotni yangilagan. Qayta yuklang.",
        },
        { status: 409 }
      );
    }

    return Response.json({ ok: true, version: result.version });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
