// app/api/daily-report/route.js
// Kunlik sklad hisoboti avtomatik yuborish (WhatsApp / Telegram)
// Cron job orqali har kuni 00:30 da ishlaydi

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { SAVINGS_OUT_CAT, SAVINGS_IN_CAT, savingsSummary } from "../../../lib/savings";
import { resolveAuth } from "../../../lib/authRequest";

// Hisobot Vercel Cron (GET) yoki GitHub Actions / tashqi scheduler (POST) orqali ishga tushadi —
// har doim yangi ma'lumot o'qilishi uchun keshlanmaydi.
export const dynamic = "force-dynamic";

// MUHIM: Supabase client endi LAZY (funksiya ichida) yaratiladi.
// Bu build vaqtida (Next.js "Collecting page data" bosqichida) xato
// bermasligi uchun kerak — chunki module-level throw butun build'ni yiqitadi.
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables not found");
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Helper functions
const num = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const formatSum = (n) => {
  if (!n) return "0";
  return new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency: "UZS",
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace("UZS", "so'm");
};

const generateFinancialReport = (data) => {
  const today = new Date().toISOString().slice(0, 10);

  const allFlow = data.cashflow || [];
  // MUHIM: kassa (naqd pul) balansi faqat "Naqd pul" to'lovlarini hisobga oladi.
  // Karta/Bank o'tkazma orqali kelgan pul jismoniy kassada emas, bankda turadi.
  // paymentType ko'rsatilmagan yozuvlar (masalan usta/rahbar haqi) odatda naqd
  // hisoblanadi, shuning uchun default sifatida "naqd" deb olinadi.
  const isCash = (c) => !c.paymentType || c.paymentType === "Naqd pul";

  const todayFlow = allFlow.filter((c) => c.date === today);
  const todayCashFlow = todayFlow.filter(isCash);
  // Jamg'arma o'tkazmalari (kassa <-> jamg'arma) daromad/xarajat EMAS — kirim/chiqim va
  // sof foydaga kirmaydi, lekin kassadagi naqd qoldiqqa ta'sir qiladi (pul jismonan chiqadi).
  const kirimlar = todayCashFlow.filter((c) => c.type === "kirim" && c.category !== SAVINGS_IN_CAT);
  const chiqimlar = todayCashFlow.filter((c) => c.type === "chiqim" && c.category !== SAVINGS_OUT_CAT);
  const savingsOutToday = todayCashFlow
    .filter((c) => c.type === "chiqim" && c.category === SAVINGS_OUT_CAT)
    .reduce((s, c) => s + num(c.amountSum), 0);
  const savingsBackToday = todayCashFlow
    .filter((c) => c.type === "kirim" && c.category === SAVINGS_IN_CAT)
    .reduce((s, c) => s + num(c.amountSum), 0);

  // Ta'minotchiga Click orqali to'langan summa (naqd kassaga ta'sir qilmaydi)
  const clickSupplierPaid = todayFlow
    .filter((c) => c.type === "chiqim" && c.category === "Ta'minotchiga to'lov" && c.paymentType === "Karta (Click/Payme)")
    .reduce((s, c) => s + num(c.amountSum), 0);

  // Naqd bo'lmagan (karta/bank) kirimlar — alohida ko'rsatish uchun
  const nonCashKirim = todayFlow.filter((c) => c.type === "kirim" && !isCash(c))
    .reduce((s, c) => s + num(c.amountSum), 0);

  // Kassa balansi: bugungacha bo'lgan BARCHA NAQD harakatlar yig'indisi = ERTALABKI qoldiq
  const oldingiFlow = allFlow.filter((c) => c.date < today && isCash(c));
  const boshlangichQoldiq = oldingiFlow.reduce(
    (s, c) => s + (c.type === "kirim" ? num(c.amountSum) : -num(c.amountSum)), 0
  );

  const jamiKirim = kirimlar.reduce((s, c) => s + num(c.amountSum), 0);

  // "Rahbarga chiqim" — bu oddiy operatsion xarajat emas, balki rahbarning
  // ALLAQACHON topilgan foydadan shaxsan pul olishi (distribution). Shuning
  // uchun bu sof foyda hisobidan chiqarib tashlanadi, aks holda hisobot
  // noto'g'ri (haqiqatda ijobiy bo'lgan kun) manfiy ko'rsatishi mumkin.
  const chiqimOperatsion = chiqimlar.filter((c) => c.category !== "Rahbarga chiqim");
  const rahbarOlgan = chiqimlar.filter((c) => c.category === "Rahbarga chiqim").reduce((s, c) => s + num(c.amountSum), 0);
  const jamiChiqim = chiqimOperatsion.reduce((s, c) => s + num(c.amountSum), 0);
  const sofFoyda = jamiKirim - jamiChiqim;

  // Kategoriya bo'yicha guruhlash
  const groupByCategory = (arr) => {
    const map = {};
    arr.forEach((c) => {
      const key = c.category || "Boshqa";
      map[key] = (map[key] || 0) + num(c.amountSum);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const kirimByCategory = groupByCategory(kirimlar);
  const chiqimByCategory = groupByCategory(chiqimOperatsion);

  let report = `\ud83d\udcb0 MOLIYAVIY HISOBOT - ${today}\n`;
  report += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n`;

  report += `\ud83c\udfe6 Ertalabki qoldiq: ${formatSum(boshlangichQoldiq)}\n\n`;

  report += `\ud83d\udcc8 KIRIM (${kirimlar.length} ta) \u2014 Jami: ${formatSum(jamiKirim)}\n`;
  if (kirimByCategory.length > 0) {
    kirimByCategory.slice(0, 6).forEach(([cat, sum], idx) => {
      const isLast = idx === Math.min(kirimByCategory.length, 6) - 1;
      report += `${isLast ? "\u2514\u2500" : "\u251c\u2500"} ${cat}: ${formatSum(sum)}\n`;
    });
  }

  if (nonCashKirim > 0) {
    report += `\n\ud83d\udcb3 (Naqd emas — karta/bank): ${formatSum(nonCashKirim)}\n`;
  }
  if (clickSupplierPaid > 0) {
    report += `\ud83d\udcb3 Click orqali ta'minotchiga to'langan: ${formatSum(clickSupplierPaid)}\n`;
  }

  report += `\n\ud83d\udcc9 CHIQIM (${chiqimlar.length} ta) \u2014 Jami: ${formatSum(jamiChiqim)}\n`;
  if (chiqimByCategory.length > 0) {
    chiqimByCategory.slice(0, 6).forEach(([cat, sum], idx) => {
      const isLast = idx === Math.min(chiqimByCategory.length, 6) - 1;
      report += `${isLast ? "\u2514\u2500" : "\u251c\u2500"} ${cat}: ${formatSum(sum)}\n`;
    });
  }

  if (rahbarOlgan > 0) {
    report += `\n\ud83d\udc64 Rahbar shaxsan oldi: ${formatSum(rahbarOlgan)} (sof foydadan, xarajat sifatida hisoblanmaydi)\n`;
  }

  // Jamg'arma bo'limi
  const sv = savingsSummary(data, today.slice(0, 7), today);
  if (sv.balance > 0 || sv.target > 0 || savingsOutToday > 0 || savingsBackToday > 0) {
    report += `\n\ud83d\udd12 JAMG'ARMA\n`;
    report += `\u251c\u2500 Bugun kassadan o'tkazildi: ${formatSum(savingsOutToday)}\n`;
    if (savingsBackToday > 0) report += `\u251c\u2500 Bugun kassaga qaytarildi: ${formatSum(savingsBackToday)}\n`;
    report += `\u251c\u2500 Jamg'arma qoldig'i: ${formatSum(sv.balance)}\n`;
    if (sv.target > 0) {
      report += `\u2514\u2500 Bu oy: ${formatSum(sv.monthNet)} / ${formatSum(sv.target)} (${sv.percent}%)`;
      report += sv.reached ? " \u2705 limit bajarildi\n" : ` \u2014 limitgacha ${formatSum(sv.remaining)} qoldi\n`;
    } else {
      report += `\u2514\u2500 Oylik limit belgilanmagan\n`;
    }
  }

  report += `\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  report += `\ud83d\udcb5 SOF FOYDA (operatsion, Rahbar ulushisiz): ${formatSum(sofFoyda)}\n`;

  const yakuniyQoldiq = boshlangichQoldiq + jamiKirim - jamiChiqim - rahbarOlgan - savingsOutToday + savingsBackToday;
  report += `\ud83c\udfe6 Kechqurungi qoldiq: ${formatSum(yakuniyQoldiq)}\n`;
  report += `\u23f0 ${new Date().toLocaleTimeString("uz-UZ", { timeZone: "Asia/Tashkent" })}\n`;

  return report;
};

const generateStockReport = (data) => {
  const today = new Date().toISOString().slice(0, 10);

  const todayIns = (data.stockIns || []).filter(
    (s) => s.createdAt?.slice(0, 10) === today
  );

  const todayOuts = (data.stockOuts || []).filter(
    (s) => s.date === today || s.createdAt?.slice(0, 10) === today
  );

  const insTotal = todayIns.reduce((sum, s) => sum + (num(s.totalSum) || 0), 0);
  const outsTotal = todayOuts.reduce((sum, s) => sum + (num(s.amountSum) || 0), 0);

  let report = `📦 SKLAD HISOBOTI - ${today}\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  report += `📥 KIRIM (${todayIns.length} ta)\n`;
  report += `├─ Jami: ${formatSum(insTotal)}\n`;
  if (todayIns.length > 0) {
    report += `├─ Mahsulotlar:\n`;
    const bySupplier = {};
    todayIns.forEach((s) => {
      if (!bySupplier[s.supplier]) bySupplier[s.supplier] = [];
      bySupplier[s.supplier].push(s);
    });

    Object.entries(bySupplier).forEach(([supplier, items]) => {
      const supplierSum = items.reduce((sum, s) => sum + num(s.totalSum), 0);
      report += `│  ├─ ${supplier || "Noma'lum"}:\n`;
      items.slice(0, 3).forEach((item, idx) => {
        const isLast = idx === items.length - 1;
        report += `│  │  ${isLast ? "└─" : "├─"} ${item.productName} (${item.qty} ${item.unit}) — ${formatSum(item.totalSum)}\n`;
      });
      if (items.length > 3) report += `│  │  └─ +${items.length - 3} ta boshqa...\n`;
      report += `│  └─ Subtotal: ${formatSum(supplierSum)}\n`;
    });
  } else {
    report += `└─ Kirim yo'q\n`;
  }

  report += `\n`;
  report += `📤 CHIQIM (${todayOuts.length} ta)\n`;
  report += `├─ Jami: ${formatSum(outsTotal)}\n`;
  if (todayOuts.length > 0) {
    report += `├─ Mahsulotlar:\n`;
    todayOuts.slice(0, 5).forEach((s, idx) => {
      const isLast = idx === todayOuts.length - 1;
      const time = s.time ? ` (${s.time})` : "";
      report += `│  ${isLast ? "└─" : "├─"} ${s.productName}${time} (${s.qty}) — ${formatSum(s.amountSum)}\n`;
    });
    if (todayOuts.length > 5) report += `└─ +${todayOuts.length - 5} ta boshqa...\n`;
  } else {
    report += `└─ Chiqim yo'q\n`;
  }

  report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `💰 NET: ${formatSum(insTotal - outsTotal)}\n`;
  report += `⏰ ${new Date().toLocaleTimeString("uz-UZ", { timeZone: "Asia/Tashkent" })}\n`;

  return report;
};

const sendWhatsApp = async (phoneNumber, message) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromPhone) {
    console.log("WhatsApp sozlamalari topilmadi.");
    return false;
  }

  try {
    const encoded = new URLSearchParams();
    encoded.append("From", fromPhone);
    encoded.append("To", `whatsapp:${phoneNumber}`);
    encoded.append("Body", message);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: encoded,
      }
    );

    if (!response.ok) {
      console.error("Twilio xatosi:", await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("WhatsApp yuborishda xato:", error);
    return false;
  }
};

const sendTelegram = async (chatId, message) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log("Telegram sozlamalari topilmadi.");
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });

    if (!response.ok) {
      console.error("Telegram xatosi:", await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Telegram yuborishda xato:", error);
    return false;
  }
};

// Uzun hisobotni qatorlar bo'yicha bo'laklarga ajratish — Telegram (4096) va
// WhatsApp/Twilio (1600) belgi chegarasidan oshsa xabar umuman yuborilmay qolardi.
const chunkText = (text, size) => {
  const chunks = [];
  let cur = "";
  for (const line of String(text).split("\n")) {
    if ((cur + line + "\n").length > size && cur) { chunks.push(cur.trimEnd()); cur = ""; }
    cur += line + "\n";
  }
  if (cur.trim()) chunks.push(cur.trimEnd());
  return chunks;
};

const sendChunks = async (sendFn, target, text, size) => {
  let ok = true;
  for (const part of chunkText(text, size)) {
    ok = (await sendFn(target, part)) && ok;
  }
  return ok;
};

const STORAGE_KEY = "avtogaz-v2";
// AvtogazApp.jsx dagi BRANCH_LABELS bilan bir xil — har bir filialning o'z qatori va o'z sozlamalari bor
const BRANCH_IDS = ["main", "filial2"];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const secretMatches = (header, secret) => {
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

async function buildAndSend(supabase, branchId) {
  // MUHIM: jadval "app_data", id = filial, haqiqiy ilova state'i "data" ustuni ichida
  // STORAGE_KEY ("avtogaz-v2") kaliti ostida saqlanadi.
  const { data: row, error } = await supabase.from("app_data").select("data").eq("id", branchId).single();
  if (error || !row?.data) return { branchId, generated: false, skipped: "Data not found" };

  const wrapper = row.data[STORAGE_KEY];
  const appData = wrapper && wrapper.data;
  if (!appData) return { branchId, generated: false, skipped: "App state not found under STORAGE_KEY" };

  const report = generateFinancialReport(appData) + "\n\n" + generateStockReport(appData);

  const notificationPhone = appData.settings?.dailyReportPhone || "";
  const notificationChat = appData.settings?.dailyReportChat || "";
  const notificationMethod = appData.settings?.dailyReportMethod || "";

  const result = { branchId, generated: true, report, sentWhatsApp: false, sentTelegram: false };

  if (notificationMethod === "whatsapp" && notificationPhone) {
    result.sentWhatsApp = await sendChunks(sendWhatsApp, notificationPhone, report, 1500);
  }
  if (notificationMethod === "telegram" && notificationChat) {
    result.sentTelegram = await sendChunks(sendTelegram, notificationChat, report, 4000);
  }
  if (!notificationMethod || (!notificationPhone && !notificationChat)) {
    console.log(`Kunlik hisobot [${branchId}] (sozlanmagan yuborish):\n` + report);
  }
  return result;
}

// Ruxsat: (1) cron/scheduler — "Authorization: Bearer <CRON_SECRET>" (barcha filiallar), yoki
// (2) ilovaga kirgan Azim/Rahbar sessiyasi (faqat o'z filiali) — "Test" tugmasi shuni ishlatadi.
// CRON_SECRET brauzerga HECH QACHON chiqarilmaydi. Hech biri bo'lmasa — rad etiladi.
async function handle(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    let branches;

    if (secretMatches(authHeader, process.env.CRON_SECRET)) {
      branches = BRANCH_IDS;
    } else {
      const { searchParams } = new URL(request.url);
      const auth = await resolveAuth(request, searchParams.get("branchId"));
      if (!auth.ok || !["azim", "rahbar"].includes(auth.role)) {
        return json({ error: "Unauthorized" }, 401);
      }
      branches = [auth.branchId];
    }

    // Supabase client faqat SHU YERDA, chaqirilganda yaratiladi (build vaqtida emas)
    const supabase = getSupabase();

    const results = [];
    for (const b of branches) {
      try {
        results.push(await buildAndSend(supabase, b));
      } catch (e) {
        console.error(`Daily report error [${b}]:`, e);
        results.push({ branchId: b, generated: false, error: String(e.message || e) });
      }
    }

    const primary = results[0] || {};
    if (branches.length === 1 && primary.generated === false) {
      return json({ error: primary.skipped || primary.error || "Hisobot yaratilmadi" }, primary.error ? 500 : 404);
    }
    // Eski javob shakli (generated/report/sentWhatsApp/sentTelegram) saqlanadi + barcha filiallar natijasi
    return json({ ...primary, branches: results.map(({ report, ...rest }) => rest) });
  } catch (error) {
    console.error("Daily report error:", error);
    return json({ error: error.message }, 500);
  }
}

// Vercel Cron faqat GET yuboradi; GitHub Actions/curl POST yuboradi — ikkalasi ham ishlaydi.
export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }
