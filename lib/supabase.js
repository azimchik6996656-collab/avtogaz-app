/**
 * Brauzer tomonidagi wrapper — endi Supabase'ga TO'G'RIDAN-TO'G'RI ulanmaydi.
 * Buning o'rniga /api/data server route'iga murojaat qiladi — u yerda maxfiy
 * "service role" kaliti ishlatiladi (brauzerga hech qachon yuborilmaydi).
 *
 * Sabab: avvalgi versiya anon kalit bilan Supabase'ga to'g'ridan-to'g'ri
 * ulanar edi — RLS yoqilmagan holatda bu kalitni DevTools'dan ko'rgan har kim
 * ilovaning PIN tizimini butunlay chetlab o'tib, bazaga to'g'ridan-to'g'ri
 * kirishi mumkin edi.
 *
 * Interfeys avvalgidek: get(key) → { value, version } | null
 *                       set(key, valueStr, { expectedVersion }) → { key, value, version } | CONFLICT xatosi
 */
export const storage = {
  async get(key) {
    const res = await fetch(`/api/data?key=${encodeURIComponent(key)}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || "Ma'lumot o'qishda xato");
    if (json.value === null || json.value === undefined) return null;
    return { value: json.value, version: json.version, updatedAt: json.updatedAt };
  },

  /**
   * @param {string} key
   * @param {string} valueStr — JSON string
   * @param {{ expectedVersion?: number }} opts
   */
  async set(key, valueStr, opts = {}) {
    const res = await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, valueStr, expectedVersion: opts.expectedVersion }),
    });
    const json = await res.json().catch(() => ({}));

    if (res.status === 409 || json.conflict) {
      const err = new Error("CONFLICT");
      err.code = "CONFLICT";
      err.serverVersion = json.serverVersion;
      throw err;
    }
    if (!res.ok || !json.ok) throw new Error(json.error || "Saqlashda xato");

    return { key, value: valueStr, version: json.version };
  },
};
