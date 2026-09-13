// app/api/daily-report/route.js
// Kunlik sklad hisoboti avtomatik yuborish (WhatsApp / Telegram)
// Cron job orqali har kuni 00:30 da ishlaydi

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase environment variables not found");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions
const formatSum = (num) => {
  if (!num) return "0";
  return new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency: "UZS",
  })
    .format(num)
    .replace("UZS", "so'm");
};

const generateStockReport = (data) => {
  const today = new Date().toISOString().slice(0, 10);
  
  // Bugun kiritilgan stockIns
  const todayIns = (data.stockIns || []).filter(
    (s) => s.createdAt?.slice(0, 10) === today
  );

  // Bugun chiqarilgan stockOuts
  const todayOuts = (data.stockOuts || []).filter(
    (s) => s.createdAt?.slice(0, 10) === today
  );

  const insTotal = todayIns.reduce((sum, s) => sum + (num(s.totalSum) || 0), 0);
  const outsTotal = todayOuts.reduce((sum, s) => sum + (num(s.amountSum) || 0), 0);

  let report = `📦 SKLAD HISOBOTI - ${today}\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // KIRIM
  report += `📥 KIRIM (${todayIns.length} ta)\n`;
  report += `├─ Jami: ${formatSum(insTotal)}\n`;
  if (todayIns.length > 0) {
    report += `├─ Mahsulotlar:\n`;
    const bySupplier = {};
    todayIns.forEach((s) => {
      if (!bySupplier[s.supplier]) {
        bySupplier[s.supplier] = [];
      }
      bySupplier[s.supplier].push(s);
    });

    Object.entries(bySupplier).forEach(([supplier, items]) => {
      const supplierSum = items.reduce((sum, s) => sum + num(s.totalSum), 0);
      report += `│  ├─ ${supplier || "Noma'lum"}:\n`;
      items.slice(0, 3).forEach((item, idx) => {
        const isLast = idx === items.length - 1;
        report += `│  │  ${isLast ? "└─" : "├─"} ${item.productName} (${item.qty} ${item.unit}) — ${formatSum(item.totalSum)}\n`;
      });
      if (items.length > 3) {
        report += `│  │  └─ +${items.length - 3} ta boshqa...\n`;
      }
      report += `│  └─ Subtotal: ${formatSum(supplierSum)}\n`;
    });
  } else {
    report += `└─ Kirim yo'q\n`;
  }

  report += `\n`;

  // CHIQIM
  report += `📤 CHIQIM (${todayOuts.length} ta)\n`;
  report += `├─ Jami: ${formatSum(outsTotal)}\n`;
  if (todayOuts.length > 0) {
    report += `├─ Mahsulotlar:\n`;
    todayOuts.slice(0, 5).forEach((s, idx) => {
      const isLast = idx === todayOuts.length - 1;
      report += `│  ${isLast ? "└─" : "├─"} ${s.productName} (${s.qty}) — ${formatSum(s.amountSum)}\n`;
    });
    if (todayOuts.length > 5) {
      report += `└─ +${todayOuts.length - 5} ta boshqa...\n`;
    }
  } else {
    report += `└─ Chiqim yo'q\n`;
  }

  report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `💰 NET: ${formatSum(insTotal - outsTotal)}\n`;
  report += `⏰ ${new Date().toLocaleTimeString("uz-UZ")}\n`;

  return report;
};

const sendWhatsApp = async (phoneNumber, message) => {
  // Twilio API orqali WhatsApp yuborish
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_WHATSAPP_FROM; // wa:+998901234567

  if (!accountSid || !authToken || !fromPhone) {
    console.log("WhatsApp sozlamalari topilmadi. Hisobot faqat logga yozildi.");
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
          Authorization:
            "Basic " +
            Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
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
  // Telegram Bot API orqali yuborish
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log("Telegram sozlamalari topilmadi. Hisobot faqat logga yozildi.");
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
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

const num = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

export async function POST(request) {
  try {
    // Vercel Cron orqali chaqirilishi uchun himoya
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Supabase'dan avtogaz ma'lumotlarini olish
    const { data: staffData, error } = await supabase
      .from("staff")
      .select("data")
      .eq("id", "main")
      .single();

    if (error || !staffData?.data) {
      return new Response("Data not found", { status: 404 });
    }

    const appData = JSON.parse(staffData.data);

    // Hisobot yaratish
    const report = generateStockReport(appData);

    // Xabarnoma sozlamalarini olish
    const notificationPhone = appData.settings?.dailyReportPhone || "";
    const notificationChat = appData.settings?.dailyReportChat || "";
    const notificationMethod = appData.settings?.dailyReportMethod || ""; // "whatsapp", "telegram"

    let results = {
      generated: true,
      report: report,
      sentWhatsApp: false,
      sentTelegram: false,
    };

    // WhatsApp orqali yuborish
    if (notificationMethod === "whatsapp" && notificationPhone) {
      results.sentWhatsApp = await sendWhatsApp(notificationPhone, report);
    }

    // Telegram orqali yuborish
    if (notificationMethod === "telegram" && notificationChat) {
      results.sentTelegram = await sendTelegram(notificationChat, report);
    }

    // Agar hech narsa sozlanmagan bo'lsa, faqat logga yozing
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

// Yuborish uchun manual test endpoint
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // POST orqali yuboring
  return new Response("Use POST method", { status: 405 });
}
