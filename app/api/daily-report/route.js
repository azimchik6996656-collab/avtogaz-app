// app/api/daily-report/route.js
// Kunlik sklad hisoboti avtomatik yuborish (WhatsApp / Telegram)
// Cron job orqali har kuni 00:30 da ishlaydi

import { createClient } from "@supabase/supabase-js";

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
  const kirimlar = todayCashFlow.filter((c) => c.type === "kirim");
  const chiqimlar = todayCashFlow.filter((c) => c.type === "chiqim");

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

  report += `\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  report += `\ud83d\udcb5 SOF FOYDA (operatsion, Rahbar ulushisiz): ${formatSum(sofFoyda)}\n`;

  const yakuniyQoldiq = boshlangichQoldiq + jamiKirim - jamiChiqim - rahbarOlgan;
  report += `\ud83c\udfe6 Kechqurungi qoldiq: ${formatSum(yakuniyQoldiq)}\n`;
  report += `\u23f0 ${new Date().toLocaleTimeString("uz-UZ")}\n`;

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
  report += `⏰ ${new Date().toLocaleTimeString("uz-UZ")}\n`;

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
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
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

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // VAQTINCHA DEBUG — muammo topilgach olib tashlanadi
      return new Response(JSON.stringify({
        error: "Unauthorized",
        debug: {
          receivedHeader: authHeader || "(bo'sh)",
          receivedHeaderLength: (authHeader || "").length,
          expectedSecretLength: cronSecret.length,
          expectedSecretFirst4: cronSecret.slice(0, 4),
          expectedSecretLast4: cronSecret.slice(-4),
        }
      }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    // Supabase client faqat SHU YERDA, chaqirilganda yaratiladi (build vaqtida emas)
    const supabase = getSupabase();

    // MUHIM: jadval "app_data", id = filial ("main"), haqiqiy ilova state'i
    // "data" ustuni ichida STORAGE_KEY ("avtogaz-v2") kaliti ostida saqlanadi.
    const STORAGE_KEY = "avtogaz-v2";
    const branchId = "main";

    const { data: row, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("id", branchId)
      .single();

    if (error || !row?.data) {
      return new Response(JSON.stringify({ error: "Data not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const bag = row.data || {};
    const wrapper = bag[STORAGE_KEY];
    const appData = wrapper && wrapper.data;

    if (!appData) {
      return new Response(JSON.stringify({ error: "App state not found under STORAGE_KEY" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stockReport = generateStockReport(appData);
    const financialReport = generateFinancialReport(appData);
    const report = financialReport + "\n\n" + stockReport;

    const notificationPhone = appData.settings?.dailyReportPhone || "";
    const notificationChat = appData.settings?.dailyReportChat || "";
    const notificationMethod = appData.settings?.dailyReportMethod || "";

    let results = { generated: true, report, sentWhatsApp: false, sentTelegram: false };

    if (notificationMethod === "whatsapp" && notificationPhone) {
      results.sentWhatsApp = await sendWhatsApp(notificationPhone, report);
    }
    if (notificationMethod === "telegram" && notificationChat) {
      results.sentTelegram = await sendTelegram(notificationChat, report);
    }
    if (!notificationMethod || (!notificationPhone && !notificationChat)) {
      console.log("Kunlik hisobot (sozlanmagan yuborish):\n" + report);
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Daily report error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response("Use POST method", { status: 405 });
}
