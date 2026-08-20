import { serverClient } from "../../../lib/supabaseServer";
import { resolveAuth } from "../../../lib/authRequest";

export const dynamic = "force-dynamic";

// Bu route optimistic-lock versiyasiga tayanadi — javob HECH QACHON keshlanmasligi
// kerak, aks holda brauzer/CDN eski versiyani qaytarib, saqlashda doimiy
// "Konflikt" xatosiga olib kelishi mumkin.
const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };
function json(body, init) {
  return Response.json(body, { ...init, headers: { ...NO_STORE, ...(init && init.headers) } });
}

/**
 * MUHIM: bu route SERVICE ROLE kaliti bilan ishlaydi (RLS'ni chetlab o'tadi),
 * shuning uchun ruxsat tekshiruvi shu yerda, qo'lda amalga oshiriladi
 * (resolveAuth — PIN-sessiya yoki Google/staff tokeni). Har bir FILIAL
 * (branch) o'zining `app_data` qatoriga ega — auth.branchId shu qatorni
 * belgilaydi (PIN-sessiyada tokendan, Google oqimida mijoz so'ragan va
 * staff jadvalida tasdiqlangan filialdan).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const auth = await resolveAuth(request, searchParams.get("branchId"));
  if (!auth.ok) return json({ ok: false, error: auth.error }, { status: auth.status });

  const key = searchParams.get("key");
  if (!key) return json({ ok: false, error: "key kerak" }, { status: 400 });

  try {
    const supabase = serverClient();
    const { data, error } = await supabase
      .from("app_data")
      .select("data, updated_at")
      .eq("id", auth.branchId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    const bag = data?.data || {};
    const value = bag[key];
    const version = Number(bag.__version || 0);

    return json({
      ok: true,
      value: value === undefined ? null : (typeof value === "string" ? value : JSON.stringify(value)),
      version,
      updatedAt: data?.updated_at || null,
    });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}

/**
 * PUT body: { key, valueStr, expectedVersion, branchId }
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
  try {
    const body = await request.json();
    const { key, valueStr, expectedVersion, branchId } = body || {};

    const auth = await resolveAuth(request, branchId);
    if (!auth.ok) return json({ ok: false, error: auth.error }, { status: auth.status });

    if (!key || valueStr === undefined) {
      return json({ ok: false, error: "key va valueStr kerak" }, { status: 400 });
    }

    const parsed = JSON.parse(valueStr);
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("save_app_data", {
      p_id: auth.branchId,
      p_key: key,
      p_value: parsed,
      p_expected_version:
        expectedVersion === undefined || expectedVersion === null ? null : Number(expectedVersion),
    });
    if (error) throw error;

    if (result?.conflict) {
      return json(
        {
          ok: false,
          conflict: true,
          serverVersion: result.serverVersion,
          message: "Boshqa qurilma ma'lumotni yangilagan. Qayta yuklang.",
        },
        { status: 409 }
      );
    }

    return json({ ok: true, version: result.version });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
