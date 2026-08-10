import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (SERVICE ROLE kaliti bilan) — API route'lar ichida
 * ishlatiladi, brauzerga hech qachon yuborilmaydi.
 *
 * MUHIM: Next.js o'zining global "fetch" funksiyasini avtomatik "yamaydi" (patch
 * qiladi) va HAR QANDAY fetch so'rovini (shu jumladan supabase-js kutubxonasi
 * ichkarida qiladigan so'rovlarni ham) o'zining SERVER TOMONIDAGI keshiga solib
 * qo'yishi mumkin — "export const dynamic = 'force-dynamic'" faqat route'ning
 * o'zini keshlanishini to'xtatadi, ichkaridagi har bir fetch chaqiruvini emas.
 * Aynan shu sabab "/api/data" versiyani soatlab eski holatda qaytarib turgan edi.
 * Shuning uchun bu yerda supabase-js'ga o'z fetch'ini beramiz — u har doim
 * "no-store" bilan so'raydi, Supabase'dan HAR SAFAR haqiqiy joriy holatni oladi.
 */
export function serverClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    {
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}
