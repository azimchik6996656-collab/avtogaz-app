export const dynamic = "force-dynamic";

// O'zbekiston Markaziy banki rasmiy kurslari — hech qanday kalit talab qilmaydi.
const CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/";

// Xotirada oddiy keshlash — CBU kuni davomida bir marta yangilanadi,
// shuning uchun har so'rovda emas, bir necha soatda bir marta so'raymiz.
let cache = { rate: null, date: null, diff: null, fetchedAt: 0 };
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 soat

export async function GET() {
  const now = Date.now();
  if (cache.rate && now - cache.fetchedAt < CACHE_MS) {
    return Response.json({ ok: true, ...cache, cached: true });
  }

  try {
    const res = await fetch(CBU_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("CBU javobi: " + res.status);
    const list = await res.json();
    const usd = Array.isArray(list) ? list.find((c) => c.Ccy === "USD") : null;
    if (!usd) throw new Error("Ro'yxatda USD topilmadi");

    cache = {
      rate: Math.round(Number(usd.Rate) * 100) / 100,
      diff: Number(usd.Diff) || 0,
      date: usd.Date || null,
      fetchedAt: now,
    };
    return Response.json({ ok: true, ...cache, cached: false });
  } catch (e) {
    // Tarmoq ishlamasa ham — eski keshni (agar bo'lsa) qaytaramiz, aks holda "yo'q" deb belgilaymiz.
    if (cache.rate) return Response.json({ ok: true, ...cache, cached: true, stale: true });
    return Response.json({ ok: false, error: String(e) }, { status: 200 });
  }
}
