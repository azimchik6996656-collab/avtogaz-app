"use client";
import { storage } from "../lib/supabase";
import { authClient } from "../lib/authClient";
import {
  hashPin, pinsMatch, getLockoutState, recordFailedPinAttempt,
  clearPinAttempts, SECURITY,
} from "../lib/security";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import {
  Package, Wallet, Plus, X, TrendingUp, TrendingDown, ChevronDown, Trash2,
  Loader2, Check, Users, Settings2, ShoppingCart, Download, Upload,
  Car, ShieldCheck, BarChart3, Handshake, RefreshCw, Wrench, Lock,
  LogOut, Delete, KeyRound, Clock, PlayCircle, Phone, PhoneCall,
  Search, Calendar, AlertTriangle, ArrowRight, Zap, Droplets, Star, Pencil, Save, BookOpen, ListTodo
} from "lucide-react";

/* ═══════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════ */
const STORAGE_KEY = "avtogaz-v2";
/* Yuklanish tekshiruvi uchun — sarlavhada ko'rinadi.
   Saytda shu raqam ko'rinsa, demak eng yangi kod ishlayapti. */
const APP_VERSION = "v58";
const ROLE_LABELS = { azim: "Azim Avazovich", kassir: "Kassir", usta: "Usta", rahbar: "Rahbar", sklad: "Sklad" };
// Har bir filial /app/<branchId>/page.js orqali kiriladi — ROW_ID sifatida shu qiymat
// ishlatiladi (Supabase'da mustaqil qator). Yangi filial qo'shilsa, shu yerga ham qo'shiladi.
const BRANCH_LABELS = { main: "Bosh filial", filial2: "2-filial" };

const UNITS = ["dona", "kg", "litr", "metr", "komplekt"];
const SERVICE_TYPES = ["Servis", "Ustanovka", "Detailing", "Moy bo'limi"];
const PAYMENT_TYPES = ["Naqd pul", "Karta (Click/Payme)", "Bank o'tkazma", "Nasiya (qarzga)"];
const SOURCE_TYPES = ["Ta'minotchi", "O'z mahsuloti", "Insider servis"];
const CATEGORIES_DEFAULT = ["Gaz mahsulotlari", "Moy mahsulotlari", "B/U tovarlar", "Boshqa"];

const LEAD_STAGES = [
  { id: "birinchi",   label: "Birinchi qo'ng'iroq", color: "#2979FF" },
  { id: "kelishildi", label: "Kelishildi",          color: "#00BFA5" },
  { id: "nedozvon",   label: "Nedozvon",            color: "#FFB300" },
  { id: "keldi",      label: "Keldi",               color: "#7C4DFF" },
  { id: "ornatildi",  label: "Servisda o'rnatildi", color: "#00C853" },
  { id: "bekor",      label: "Bekor qilindi",       color: "#F44336" },
];

const LEAD_REGIONS = ["Toshkent shahri", "Toshkent viloyati", "Andijon", "Farg'ona", "Namangan", "Sirdaryo", "Jizzax", "Samarqand", "Buxoro", "Navoiy", "Qashqadaryo", "Surxondaryo", "Xorazm", "Qoraqalpog'iston"];
const LEAD_SOURCES = ["Instagram", "Telegram", "Tanish orqali", "Boshqa"];
const CANCEL_REASONS = ["Qimmat", "Uzoq masofa", "Vaqt bo'lmadi", "Boshqa servisdan o'rnatildi", "Fikr o'zgardi", "Boshqa"];

const INCOME_CATEGORIES = ["Xizmat to'lovi", "Erkin savdo", "Qarzdan kirim", "Hamkordan to'lov", "Rahbardan kirim", "Boshqa kirim"];
const EXPENSE_CATEGORIES = [
  "Ta'minotchiga to'lov", "Usta xizmat haqi", "Rahbarga chiqim",
  "Logistika", "Pitaniya", "Karta (Click/Payme) chiqim", "Ijara", "Ish haqi", "Kommunal", "Hujjat xarajati", "Boshqa xarajat"
];

const emptyData = () => ({
  settings: {
    usdRate: 12650,
    // "usta" umumiy PIN'i ataylab yo'q — har bir usta FAQAT shaxsiy kodi (ustaCodes) bilan kiradi,
    // aks holda umumiy kod orqali istalgan usta nomini tanlab, boshqa ustaning daromadini ko'rish mumkin bo'lib qolardi.
    pins: { rahbar: "0610", kassir: "0440", sklad: "5959" },
    extraAdminCodes: [
      { id: "rahbar-default", code: "0610777", label: "Rahbar (standart)" },
    ], // Rahbar (egasi) tomonidan yaratilgan qo'shimcha 7 xonali to'liq huquqli kodlar
    filials: [
      { id: "f1", name: "Asosiy filial" },
      { id: "f2", name: "2-filial (xizmat turlari hali aniqlanmagan)" },
    ],
    azimKpi: 0,
    azimKpiHistory: [], // {id, month, amount, reason, date} — har bir KPI qo'shilishi sababi bilan
    azimEmployeeId: null, // Xodimlar bo'limidagi qaysi xodimga oylik KPI avtomatik qo'shilishi kerak
    ustaCodes: [], // {id, name, code} — har bir ustaning shaxsiy 4 xonali kirish kodi
    supplierCodes: [], // {id, name, code} — ta'minotchining shaxsiy kirish kodi (name = stockIns.supplier bilan bir xil)
    partnerCodes: [], // {id, partnerId, code} — hamkorning shaxsiy kirish kodi
    categories: [...CATEGORIES_DEFAULT],
    branches: [{ id: "main", name: "Bosh filial", openDate: "" }],
    activeBranchId: "main",
  },
  products: [], stockIns: [], stockOuts: [], serviceUsage: [], freeSales: [], cashflow: [],
  apprentices: [], // usta -> shogirt (necha foizi shogirtga ajratilishi) ro'yxati
  serviceCards: [], warrantyClaims: [], partners: [], partnerTx: [],
  ustaLedger: [], leads: [], leadTasks: [],
  bonusRules: [], bonusAwards: [], nasiyaDebts: [],
  employees: [], employeePayments: [],
  personalDebts: [],
  contractedMasters: [], // kelishilgan (oylik) ustalar — ularning haqi servis foydasiga qo'shiladi
  productRequests: [], // ustadan kassirga mahsulot so'rovlari
  warrantyFollowups: [], // kafolat nazorati qo'ng'iroqlari jadvali (5 kun, keyin 1,3,6,9...oy)
  complaints: [], // kafolat nazorati qo'ng'iroqlaridan kelib chiqqan mijoz shikoyatlari
  oldDebtors: [], // eski (tizimdan oldingi) qarzdorlar
  oldSupplierDebts: [], // eski (tizimdan oldingi) biz to'lashimiz kerak bo'lgan qarzlar
  wholesaleDebts: [], // ulgurji savdo — mijozlarning qarzga olgan tovarlari
  inventories: [], // sklad inventarizatsiya yozuvlari
  inventoryRequests: [], // Rahbar <-> Kassir inventarizatsiya kelishuv jarayoni
  currencyExchanges: [], // USD <-> SO'M ayirboshlash yozuvlari (kirim/chiqim umumiy tushum/foydaga qo'shilmaydi — faqat kassa balansiga ta'sir qiladi)
  auditLog: [], // {id, ts, actor, note} — kim, qachon, nima o'zgartirgani (faqat muhim harakatlar, oxirgi 300 tasi)
});

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const addDaysISO = (iso, days) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const addMonthsISO = (iso, months) => { const d = new Date(iso + "T00:00:00"); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); };
const fmtDate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
const num = (v) => Number(v) || 0;
const fmtSum = (n) => Math.round(num(n)).toLocaleString("ru-RU").replace(/,/g, " ") + " so'm";
const fmtUsd = (n) => "$" + (Math.round(num(n) * 100) / 100).toLocaleString("en-US");
const toSum = (a, cur, rate) => (cur === "USD" ? num(a) * rate : num(a));
const toUsd = (a, cur, rate) => (cur === "USD" ? num(a) : rate ? num(a) / rate : 0);

// Audit log uchun: ikkita "data" holati orasidagi FARQNI aniqlaydi va inson o'qiy oladigan
// qisqa xulosa qatorlarini qaytaradi. Har bir alohida patch() chaqiruvi (ya'ni har bir
// foydalanuvchi harakati) uchun bitta marta chaqiriladi — shu tufayli o'nlab turli joyda
// cashflow.unshift(...) chaqirilsa ham, HAR BIRINI alohida "label" bilan belgilash shart
// emas: farq shu yerda, markazlashgan holda, avtomatik aniqlanadi.
function summarizeAuditDiff(before, after) {
  const lines = [];

  const beforeCF = before.cashflow || [], afterCF = after.cashflow || [];
  const beforeCFIds = new Set(beforeCF.map((c) => c.id));
  const afterCFIds = new Set(afterCF.map((c) => c.id));
  const addedCF = afterCF.filter((c) => !beforeCFIds.has(c.id));
  const removedCF = beforeCF.filter((c) => !afterCFIds.has(c.id));
  if (addedCF.length === 1) {
    const c = addedCF[0];
    lines.push(`${c.type === "kirim" ? "Kirim" : "Chiqim"}: ${c.category || "—"} — ${fmtSum(c.amountSum)}${c.note ? ` (${c.note})` : ""}`);
  } else if (addedCF.length > 1) {
    const inc = addedCF.filter((c) => c.type === "kirim").reduce((s, c) => s + num(c.amountSum), 0);
    const exp = addedCF.filter((c) => c.type === "chiqim").reduce((s, c) => s + num(c.amountSum), 0);
    lines.push(`+${addedCF.length} ta kassa yozuvi qo'shildi (kirim ${fmtSum(inc)}, chiqim ${fmtSum(exp)})`);
  }
  if (removedCF.length) lines.push(`${removedCF.length} ta kassa yozuvi o'chirildi`);

  const beforeEx = before.currencyExchanges || [], afterEx = after.currencyExchanges || [];
  if (afterEx.length > beforeEx.length) lines.push(`Valyuta ayirboshlash qo'shildi (+${afterEx.length - beforeEx.length})`);
  if (afterEx.length < beforeEx.length) lines.push(`Valyuta ayirboshlash o'chirildi (-${beforeEx.length - afterEx.length})`);

  const beforeCards = before.serviceCards || [], afterCards = after.serviceCards || [];
  const beforeCardMap = new Map(beforeCards.map((c) => [c.id, c]));
  const afterCardIds = new Set(afterCards.map((c) => c.id));
  afterCards.forEach((c) => {
    const b = beforeCardMap.get(c.id);
    if (b && cardStatus(b) === "ochiq" && cardStatus(c) !== "ochiq") {
      lines.push(`Karta yopildi: ${c.plate || "—"} — ${fmtSum(c.finalTotal)}`);
    }
  });
  const newCards = afterCards.filter((c) => !beforeCardMap.has(c.id));
  if (newCards.length) lines.push(`${newCards.length} ta yangi karta ochildi`);
  const removedCards = beforeCards.filter((c) => !afterCardIds.has(c.id));
  if (removedCards.length) lines.push(`${removedCards.length} ta karta o'chirildi`);

  const beforePins = JSON.stringify((before.settings || {}).pins || {});
  const afterPins = JSON.stringify((after.settings || {}).pins || {});
  if (beforePins !== afterPins) lines.push("PIN kod(lar) o'zgartirildi");

  return lines;
}

// Kirill ismni lotin transliteratsiyasiga o'giradi — xodimlar ismini ba'zan kirillcha,
// ba'zan lotincha yozib qo'yishadi (masalan "Азим" / "Azim"), shu ikkalasini ham
// bir xil deb topish uchun ishlatiladi.
const CYRILLIC_TO_LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
function translitCyrillic(s) {
  return String(s || "").split("").map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch).join("");
}

function cardPartsCost(card) { return (card.parts || []).reduce((s, p) => s + num(p.lineTotal), 0); }
function cardUstaFeeSum(card) { return (card.ustaFeeEntries || []).reduce((s, e) => s + num(e.amount), 0); }
function cardStatus(card) { return card.status || "yakunlangan"; }
// Kafolat nazorati qo'ng'iroq jadvali: 1-oy, keyin har 3 oyda (3,6,9...) kafolat muddati tugagunga qadar.
function kafolatMonthMarks(warrantyMonths) {
  const marks = [1];
  let next = 3;
  while (next <= warrantyMonths) { marks.push(next); next += 3; }
  return marks;
}

function productProfitReport(data) {
  const map = {};
  // Xizmat kartalaridan — faqat mijozga sotish narxida ko'rsatilgan turlarda (Servis, Moy bo'limi)
  data.serviceCards.forEach((c) => {
    if (c.serviceType !== "Servis" && c.serviceType !== "Moy bo'limi") return;
    (c.parts || []).forEach((p) => {
      const profit = (num(p.saleUnit) - num(p.costUnit)) * num(p.qty);
      if (!map[p.name]) map[p.name] = { name: p.name, qty: 0, profit: 0, revenue: 0 };
      map[p.name].qty += num(p.qty);
      map[p.name].profit += profit;
      map[p.name].revenue += num(p.lineTotal);
    });
  });
  // Erkin savdodan
  (data.freeSales || []).forEach((s) => {
    (s.items || []).forEach((it) => {
      const profit = (num(it.saleUnit) - num(it.costUnit)) * num(it.qty);
      if (!map[it.name]) map[it.name] = { name: it.name, qty: 0, profit: 0, revenue: 0 };
      map[it.name].qty += num(it.qty);
      map[it.name].profit += profit;
      map[it.name].revenue += num(it.lineTotalSum);
    });
  });
  return Object.values(map).sort((a, b) => b.profit - a.profit);
}

// Mahsulot chiqimi — barcha manbalardan (xizmat kartalari, ulgurji savdo, hamkorlarga berish)
// birlashtirilgan, "eng ko'p sotilgan" tahlili uchun. Sana oralig'i bo'yicha filtrlash mumkin.
function productOutflowReport(data, fromDate, toDate) {
  const map = {};
  function add(name, qty, source, date, revenue) {
    if (!name || qty <= 0) return;
    if (fromDate && date && date < fromDate) return;
    if (toDate && date && date > toDate) return;
    if (!map[name]) map[name] = { name, servisQty: 0, ulgurjiQty: 0, hamkorQty: 0, totalQty: 0, revenue: 0 };
    map[name][source] += qty;
    map[name].totalQty += qty;
    map[name].revenue += num(revenue);
  }
  data.serviceCards.forEach((c) => {
    (c.parts || []).forEach((p) => add(p.name, num(p.qty), "servisQty", c.date, p.lineTotal));
  });
  (data.freeSales || []).forEach((s) => {
    (s.items || []).forEach((it) => add(it.name, num(it.qty), "ulgurjiQty", s.date, it.lineTotalSum));
  });
  (data.stockOuts || []).forEach((o) => {
    add(o.productName, num(o.qty), "hamkorQty", o.date, o.amountSum);
  });
  return Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
}

function supplierDebts(data) {
  const map = {};
  data.stockIns.filter(s => s.sourceType !== "O'z mahsuloti").forEach((s) => {
    const key = normName(s.supplier || "Noma'lum");
    if (!map[key]) map[key] = { name: (s.supplier || "Noma'lum").trim(), totalSum: 0, paidSum: 0, sourceType: s.sourceType };
    map[key].totalSum += num(s.totalSum);
    map[key].paidSum += num(s.paidSum);
  });
  // Eski (qo'lda kiritilgan) ta'minotchi qarzlarini ham xuddi shu ta'minotchiga birlashtiramiz —
  // shu orqali Kassa va Qarz daftari bir xil, mos summani ko'rsatadi.
  (data.oldSupplierDebts || []).filter((o) => !o.paid).forEach((o) => {
    const key = normName(o.name || "Noma'lum");
    if (!map[key]) map[key] = { name: (o.name || "Noma'lum").trim(), totalSum: 0, paidSum: 0, sourceType: "Ta'minotchi" };
    map[key].totalSum += num(o.amountSum);
    map[key].paidSum += num(o.paidAmount || 0);
  });
  return Object.values(map)
    .map((s) => ({ ...s, debtSum: s.totalSum - s.paidSum }))
    .filter((s) => Math.abs(s.debtSum) > 1);
}

function openStockDebts(data) {
  return data.stockIns.filter(
    (s) => s.sourceType !== "O'z mahsuloti" && num(s.totalSum) - num(s.paidSum) > 1
  );
}

/** Ochiq qarzlar ro'yxati — kassadan "Qarzdan kirim" uchun */
function listCollectableDebts(data) {
  const items = [];
  (data.nasiyaDebts || []).filter((n) => !n.paid).forEach((n) => {
    const remaining = num(n.amountSum) - num(n.paidAmount || 0);
    if (remaining > 0.5) {
      items.push({
        kind: "nasiya", id: n.id,
        label: `Nasiya · ${n.plate || "—"}`,
        sub: `${n.carModel || ""} · ${n.serviceType || ""}`.trim(),
        remaining, name: n.plate || "",
      });
    }
  });
  (data.personalDebts || []).filter((p) => !p.paid).forEach((p) => {
    const remaining = num(p.amountSum) - num(p.paidAmount || 0);
    if (remaining > 0.5) {
      items.push({
        kind: "personal", id: p.id,
        label: `Shaxsiy · ${p.name}`,
        sub: p.note || "Shaxsiy qarz",
        remaining, name: p.name,
      });
    }
  });
  (data.oldDebtors || []).filter((o) => !o.paid).forEach((o) => {
    const remaining = num(o.amountSum) - num(o.paidAmount || 0);
    if (remaining > 0.5) {
      items.push({
        kind: "old", id: o.id,
        label: `Eski · ${o.name}`,
        sub: o.note || "Eski qarzdor",
        remaining, name: o.name,
      });
    }
  });
  (data.wholesaleDebts || []).filter((w) => !w.paid).forEach((w) => {
    const remaining = num(w.amountSum) - num(w.paidAmount || 0);
    if (remaining > 0.5) {
      items.push({
        kind: "wholesale", id: w.id,
        label: `Ulgurji · ${w.customer || "—"}`,
        sub: w.items || "Ulgurji savdo",
        remaining, name: w.customer || "",
      });
    }
  });
  partnerBalances(data).forEach((p) => {
    if (num(p.debtSum) > 0.5) {
      items.push({
        kind: "partner", id: p.id,
        label: `Hamkor · ${p.name}`,
        sub: "Insider / hamkor qarzi",
        remaining: num(p.debtSum), name: p.name,
      });
    }
  });
  return items.sort((a, b) => b.remaining - a.remaining);
}

/**
 * Qarz hisobidan yechish (kassa bilan birga).
 * kind: nasiya | personal | old | wholesale | partner | supplier
 * amountSum — so'm ekvivalenti
 * Mutatsiya: data obyektini o'zgartiradi, cashflow YARATMAYDI (chaqiruvchi qo'shadi).
 */
function applyDebtSettlement(d, settle, amountSum) {
  if (!settle || !amountSum || amountSum <= 0) return { applied: 0, label: "" };
  let remaining = amountSum;
  const kind = settle.kind;
  const id = settle.id;
  const name = settle.name || settle.label || "";

  if (kind === "nasiya") {
    const n = (d.nasiyaDebts || []).find((x) => x.id === id);
    if (n) {
      const debt = num(n.amountSum) - num(n.paidAmount || 0);
      const pay = Math.min(debt, remaining);
      n.paidAmount = num(n.paidAmount || 0) + pay;
      if (n.paidAmount >= num(n.amountSum) - 0.5) n.paid = true;
      remaining -= pay;
      return { applied: amountSum - remaining, label: `Nasiya — ${n.plate || name}` };
    }
  }
  if (kind === "personal") {
    const p = (d.personalDebts || []).find((x) => x.id === id);
    if (p) {
      const debt = num(p.amountSum) - num(p.paidAmount || 0);
      const pay = Math.min(debt, remaining);
      p.paidAmount = num(p.paidAmount || 0) + pay;
      if (p.paidAmount >= num(p.amountSum) - 0.5) p.paid = true;
      p.history = p.history || [];
      p.history.push({ date: todayISO(), time: nowTime(), amount: pay, note: "Kassadan qarzdan kirim" });
      remaining -= pay;
      return { applied: amountSum - remaining, label: `Shaxsiy — ${p.name}` };
    }
  }
  if (kind === "old") {
    const o = (d.oldDebtors || []).find((x) => x.id === id);
    if (o) {
      const debt = num(o.amountSum) - num(o.paidAmount || 0);
      const pay = Math.min(debt, remaining);
      o.paidAmount = num(o.paidAmount || 0) + pay;
      if (o.paidAmount >= num(o.amountSum) - 0.5) o.paid = true;
      o.history = o.history || [];
      o.history.push({ date: todayISO(), time: nowTime(), amount: pay, note: "Kassadan qarzdan kirim" });
      remaining -= pay;
      return { applied: amountSum - remaining, label: `Eski qarzdor — ${o.name}` };
    }
  }
  if (kind === "wholesale") {
    const w = (d.wholesaleDebts || []).find((x) => x.id === id);
    if (w) {
      const debt = num(w.amountSum) - num(w.paidAmount || 0);
      const pay = Math.min(debt, remaining);
      w.paidAmount = num(w.paidAmount || 0) + pay;
      if (w.paidAmount >= num(w.amountSum) - 0.5) w.paid = true;
      remaining -= pay;
      return { applied: amountSum - remaining, label: `Ulgurji — ${w.customer || name}` };
    }
  }
  if (kind === "partner") {
    d.partnerTx = d.partnerTx || [];
    d.partnerTx.unshift({
      id: uid(), partnerId: id, date: todayISO(), type: "tolov",
      amountSum: remaining, currency: "SUM", paymentType: "Naqd pul",
      note: "Kassadan qarzdan kirim",
    });
    return { applied: remaining, label: `Hamkor — ${name}` };
  }
  if (kind === "supplier") {
    const supplierName = name || id;
    const open = (d.stockIns || [])
      .filter((s) => sameName(s.supplier, supplierName) && num(s.totalSum) - num(s.paidSum) > 0.5)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    for (const s of open) {
      if (remaining <= 0) break;
      const debt = num(s.totalSum) - num(s.paidSum);
      const pay = Math.min(debt, remaining);
      s.paidSum = num(s.paidSum) + pay;
      remaining -= pay;
    }
    if (remaining > 0.5) {
      const openOld = (d.oldSupplierDebts || [])
        .filter((o) => sameName(o.name, supplierName) && !o.paid && num(o.amountSum) - num(o.paidAmount || 0) > 0.5)
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      for (const o of openOld) {
        if (remaining <= 0) break;
        const debt = num(o.amountSum) - num(o.paidAmount || 0);
        const pay = Math.min(debt, remaining);
        o.paidAmount = num(o.paidAmount || 0) + pay;
        if (o.paidAmount >= num(o.amountSum) - 0.5) o.paid = true;
        remaining -= pay;
      }
    }
    return { applied: amountSum - remaining, label: `Ta'minotchi — ${supplierName}` };
  }
  return { applied: 0, label: "" };
}

// applyDebtSettlement()ning teskarisi — shu funksiya bilan yozilgan qarz to'lovini
// bekor qilish (kassa yozuvini o'chirishda) uchun. Har bir "kind" o'ziga mos yozuvni
// qanday oshirgan bo'lsa, shuni xuddi shu tartibda (oxirgisidan boshlab) kamaytiradi.
function reverseDebtSettlement(d, kind, id, amountSum) {
  if (!kind || !amountSum) return;
  let remaining = amountSum;

  if (kind === "nasiya") {
    const n = (d.nasiyaDebts || []).find((x) => x.id === id);
    if (n) {
      const undo = Math.min(num(n.paidAmount || 0), remaining);
      n.paidAmount = num(n.paidAmount || 0) - undo;
      if (n.paidAmount < num(n.amountSum) - 0.5) n.paid = false;
    }
    return;
  }
  if (kind === "personal") {
    const p = (d.personalDebts || []).find((x) => x.id === id);
    if (p) {
      const undo = Math.min(num(p.paidAmount || 0), remaining);
      p.paidAmount = num(p.paidAmount || 0) - undo;
      if (p.paidAmount < num(p.amountSum) - 0.5) p.paid = false;
    }
    return;
  }
  if (kind === "old") {
    const o = (d.oldDebtors || []).find((x) => x.id === id);
    if (o) {
      const undo = Math.min(num(o.paidAmount || 0), remaining);
      o.paidAmount = num(o.paidAmount || 0) - undo;
      if (o.paidAmount < num(o.amountSum) - 0.5) o.paid = false;
    }
    return;
  }
  if (kind === "wholesale") {
    const w = (d.wholesaleDebts || []).find((x) => x.id === id);
    if (w) {
      const undo = Math.min(num(w.paidAmount || 0), remaining);
      w.paidAmount = num(w.paidAmount || 0) - undo;
      if (w.paidAmount < num(w.amountSum) - 0.5) w.paid = false;
    }
    return;
  }
  if (kind === "supplier") {
    const supplierName = id;
    // To'lov qo'llanganda avval stockIns (eskisidan), keyin oldSupplierDebts (eskisidan)
    // to'ldirilgan edi — bekor qilishda TESKARI tartibda: avval oldSupplierDebts
    // (yangisidan), keyin stockIns (yangisidan) kamaytiriladi.
    const paidOld = (d.oldSupplierDebts || [])
      .filter((o) => sameName(o.name, supplierName) && num(o.paidAmount || 0) > 0.5)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    for (const o of paidOld) {
      if (remaining <= 0.5) break;
      const undo = Math.min(num(o.paidAmount || 0), remaining);
      o.paidAmount = num(o.paidAmount || 0) - undo;
      if (o.paid && o.paidAmount < num(o.amountSum) - 0.5) o.paid = false;
      remaining -= undo;
    }
    const paidStock = (d.stockIns || [])
      .filter((s) => sameName(s.supplier, supplierName) && num(s.paidSum) > 0.5)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    for (const s of paidStock) {
      if (remaining <= 0.5) break;
      const undo = Math.min(num(s.paidSum), remaining);
      s.paidSum = num(s.paidSum) - undo;
      remaining -= undo;
    }
  }
}

// "Usta xizmat haqi" kassa yozuvi (Usta hisobi'dagi "Yopish" orqali yaratilgan) o'chirilsa —
// ustaning tegishli ustaLedger yozuvlari qaytadan "to'lanmagan" holatga qaytadi. Shogirt bilan
// bo'lingan to'lovda ikki kassa yozuvi ("usta ulushi" + "shogirt ulushi") bir-biriga
// ustaCloseId orqali bog'langan — ikkisidan qay birini o'chirsa, IKKALASI HAM birga
// bekor qilinadi (aks holda faqat bittasi o'chib, ikkinchisi "osilib qolgan" pul bo'lib qolardi).
function reverseUstaClose(d, entry) {
  if (entry.ustaLedgerIds && entry.ustaLedgerIds.length) {
    d.ustaLedger.forEach((e) => { if (entry.ustaLedgerIds.includes(e.id)) e.paid = false; });
  }
  if (entry.shogirtLedgerId) {
    d.ustaLedger = d.ustaLedger.filter((e) => e.id !== entry.shogirtLedgerId);
  }
  if (entry.ustaCloseId) {
    const pair = d.cashflow.find((c) => c.ustaCloseId === entry.ustaCloseId && c.id !== entry.id);
    if (pair) {
      if (pair.ustaLedgerIds && pair.ustaLedgerIds.length) {
        d.ustaLedger.forEach((e) => { if (pair.ustaLedgerIds.includes(e.id)) e.paid = false; });
      }
      if (pair.shogirtLedgerId) {
        d.ustaLedger = d.ustaLedger.filter((e) => e.id !== pair.shogirtLedgerId);
      }
      d.cashflow = d.cashflow.filter((c) => c.id !== pair.id);
    }
  }
}

function partnerBalances(data) {
  return data.partners.map((p) => {
    const tx = data.partnerTx.filter((t) => t.partnerId === p.id);
    const given = tx.filter((t) => t.type === "mahsulot").reduce((s, t) => s + num(t.amountSum), 0);
    const paid = tx.filter((t) => t.type === "tolov").reduce((s, t) => s + num(t.amountSum), 0);
    return { ...p, given, paid, debtSum: given - paid };
  });
}

function ustaNameOptions(data) {
  const names = new Set();
  data.ustaLedger.forEach((e) => e.usta && names.add(e.usta));
  data.serviceCards.forEach((c) => c.usta && names.add(c.usta));
  return Array.from(names).sort();
}

const sameName = (a, b) => normName(a) === normName(b);
const normName = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

// Ikki marta bosishdan himoya — moliyaviy amallar (to'lov, yakunlash) uchun.
// Bir funksiya bir vaqtning o'zida faqat bir marta ishga tushadi (1.5s ichida qayta chaqirilsa e'tiborsiz qoldiriladi).
function useActionLock() {
  const locked = useRef(false);
  return useCallback((fn) => {
    if (locked.current) return;
    locked.current = true;
    try { fn(); } finally {
      setTimeout(() => { locked.current = false; }, 1500);
    }
  }, []);
}

// Usta shogirt (yordamchi) bilan ishlasa — usta hisobi (Kutilayotgan jami) hech qanday
// o'zgarishsiz, to'liq holicha ko'rinadi (usta faqat kuzatadi). Shogirt ulushi FAQAT
// kassir ustaning hisobini "Yopish" bosgan payt — taxminiy % (odatda 20%) sifatida
// TAKLIF qilinadi, so'ngra kassir aniq summani o'zi (ko'proq yoki kamroq) belgilaydi.
function apprenticeFor(apprentices, ustaName) {
  return (apprentices || []).find((a) => sameName(a.usta, ustaName)) || null;
}

function ustaPendingByName(data) {
  const map = {};
  data.ustaLedger.filter((e) => !e.paid).forEach((e) => {
    const key = (e.usta || "").trim().toLowerCase();
    if (!map[key]) map[key] = { usta: (e.usta || "Noma'lum").trim(), amountSum: 0, count: 0, ids: [] };
    map[key].amountSum += num(e.amountSum);
    map[key].count += 1;
    map[key].ids.push(e.id);
  });
  return Object.values(map).sort((a, b) => b.amountSum - a.amountSum);
}

function ustaPendingGrouped(data) {
  const map = {};
  data.ustaLedger.filter((e) => !e.paid).forEach((e) => {
    const nameKey = (e.usta || "").trim().toLowerCase();
    const key = nameKey + "|" + e.date;
    if (!map[key]) map[key] = { key, usta: (e.usta || "Noma'lum").trim(), date: e.date, amountSum: 0, count: 0, ids: [] };
    map[key].amountSum += num(e.amountSum);
    map[key].count += 1;
    map[key].ids.push(e.id);
  });
  return Object.values(map).sort((a, b) => (b.date + b.usta).localeCompare(a.date + a.usta));
}

function tryDownloadFile(filename, content, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) {
    return false;
  }
}

function doExportExcel(data, rate) {
  const wb = XLSX.utils.book_new();
  const sklad = data.products.map((p) => ({
    "Nomi": p.name, "Kategoriya": p.category || "", "Birlik": p.unit,
    "Kelish narxi": p.costSum, "Sotish (so'm)": p.priceSum, "Sotish (USD)": p.priceUsd || 0,
    "Qoldiq": p.qty, "Qiymati": num(p.qty) * num(p.costSum),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sklad), "Sklad");

  const kassa = data.cashflow.map((c) => ({
    "Sana": c.date, "Turi": c.type === "kirim" ? "Kirim" : "Chiqim",
    "Turkum": c.category, "Valyuta": c.currency, "Summa": c.amount,
    "Summa (so'm)": c.amountSum, "Izoh": c.note,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kassa), "Kassa");

  const cards = data.serviceCards.map((c) => ({
    "Sana": c.date, "Holati": cardStatus(c) === "ochiq" ? "Ochiq" : "Yakunlangan",
    "Davlat raqami": c.plate, "Telefon": c.phone, "Mashina": c.carModel,
    "Xizmat turi": c.serviceType, "Usta": c.usta,
    "Tan narx": cardPartsCost(c), "Usta haqi": cardUstaFeeSum(c),
    "Hujjat": c.docFee || 0, "Yakuniy": c.finalTotal || 0, "Foyda": c.profitSum || 0,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cards), "Xizmat kartalari");

  const leads = (data.leads || []).map((l) => ({
    "Sana": l.date, "Vaqt": l.time, "Ism": l.name, "Telefon": l.phone,
    "Mashina": l.carModel, "Muammo": l.issue, "Holat": l.stage,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leads), "Qo'ng'iroqlar");

  const ustaL = data.ustaLedger.map((e) => ({
    "Sana": e.date, "Usta": e.usta, "Summa": e.amountSum,
    "Holati": e.paid ? "To'langan" : "Kutilmoqda",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ustaL), "Usta hisobi");

  const debts = supplierDebts(data).map((d) => ({
    "Ta'minotchi": d.name, "Jami": d.totalSum, "To'landi": d.paidSum, "Qarz": d.debtSum,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(debts), "Taminotchi qarzi");

  try {
    XLSX.writeFile(wb, `avtogaz-hisobot-${todayISO()}.xlsx`);
    return true;
  } catch (e) {
    console.error("Excel export xatosi:", e);
    return false;
  }
}

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════ */
// Grafit (to'q) mavzu — neytral (fon/sirt/matn) tokenlar qorong'i palitraga o'tkazilgan,
// aksent ranglar (flame/gold/teal/red/blue/purple) o'zgarishsiz qoldirilgan — ular allaqachon
// to'q fonda ham yaxshi o'qiladi va SERVICE_COLORS kabi ma'noli (kategoriyaviy) ishlatilishlarga
// ega, shuning uchun butun kod bo'ylab yuzlab alohida joyni o'zgartirmasdan bitta markazdan
// butun ilovaning ko'rinishini yangilash mumkin bo'ldi.
// Faqat LoginScreen uchun — u atayin quyuq (dark) fonda qoladi, chunki
// login sahifasi allaqachon yaxshi ishlangan va o'zgartirish so'ralmagan.
const LOGIN_T = {
  bg: "#11141A", s1: "#171B22", s2: "#1A1F27", s3: "#20262F", s4: "#282F39",
  border: "#2A3038", border2: "#3A424E",
  text: "#E4E7EC", muted: "#8B93A0", muted2: "#B4BBC6",
  flame: "#F17225", flameD: "#F1722522",
  gold: "#C9922A", goldD: "#C9922A22",
  teal: "#14B8A6", tealD: "#14B8A622",
  red: "#F41819", redD: "#F4181922",
  blue: "#2F76B4", blueD: "#2F76B422",
  purple: "#8B5CF6", purpleD: "#8B5CF622",
  ink: "#0F172A", line: "#1E293B",
};

// Kirishdan keyingi butun ilova uchun — yorug' (light) fon, logotipdagi
// ranglarga (oq/ko'k/qizil/olov) mos.
//
// v58 DIZAYN TUZATISHI: ranglar yorug' mavzuga o'tgan bo'lsa-da, soyalar hamon
// qorong'i mavzudan qolgan edi — rgba(0,0,0,.3 … .5). Oq/krem fon ustida qora
// soya "iflos" kulrang dog' bo'lib ko'rinadi va butun interfeysni arzonlashtiradi.
// Endi soyalar iliq siyoh rangida va ko'p qatlamli — aynan shu narsa premium his
// beradi. Chegaralar bir pog'ona ochroq, matn esa bir oz to'yingroq.
const T = {
  bg: "#F4F2ED", s1: "#FFFFFF", s2: "#FBFAF7", s3: "#F3F1EB", s4: "#E9E6DD",
  border: "#E6E2D7", border2: "#D3CCBC",
  text: "#1C1913", muted: "#8B8570", muted2: "#4A4536",
  flame: "#D9591A", flameD: "#D9591A1F",
  gold: "#A6741C", goldD: "#A6741C1F",
  teal: "#0E8C7E", tealD: "#0E8C7E1F",
  red: "#D81315", redD: "#D813151F",
  blue: "#2159A0", blueD: "#2159A01F",
  purple: "#6D3FD1", purpleD: "#6D3FD11F",
  ink: "#0F172A", line: "#1E293B",

  // ── BALANDLIK (elevation) tizimi: iliq siyoh, ko'p qatlamli, past shaffoflik ──
  sh1: "0 1px 2px rgba(62,50,30,.05), 0 1px 3px rgba(62,50,30,.04)",
  sh2: "0 2px 4px rgba(62,50,30,.04), 0 8px 20px rgba(62,50,30,.06)",
  sh3: "0 12px 32px rgba(62,50,30,.10), 0 3px 8px rgba(62,50,30,.05)",
  shPop: "0 16px 40px rgba(40,32,18,.14), 0 4px 12px rgba(40,32,18,.07)",
  shModal: "0 40px 90px rgba(32,25,14,.24), 0 10px 28px rgba(32,25,14,.10)",
  shHead: "0 1px 0 rgba(62,50,30,.07), 0 6px 20px rgba(62,50,30,.045)",
};

const SERVICE_COLORS = {
  "Servis": T.teal, "Ustanovka": T.flame,
  "Detailing": T.purple, "Moy bo'limi": T.gold,
};

// Diqqat: CSS matni <style> tegiga BOLA sifatida ({`...`}) berilsa, React uni server
// tomonida HTML-escape qiladi (apostrof -> &#x27;, & -> &amp;, < -> &lt;), mijozda esa
// yo'q. Bizning CSS'da apostrof bor ("font-family:'Barlow'"), shuning uchun server va
// mijoz HTML'i mos kelmay, React butun sahifani tashlab qaytadan chizardi (konsolda
// "Text content does not match server-rendered HTML"). dangerouslySetInnerHTML esa
// matnni o'zgartirmasdan, ikkala tomonda bir xil chiqaradi.
// Shriftlarning o'zi app/layout.js dagi <link> orqali yuklanadi.
function GlobalStyles() {
  const css = `
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html{-webkit-text-size-adjust:100%}
      body{
        background:${T.bg};
        /* Juda nozik iliq yorug'lik — tekis krem fonni "qog'oz" kabi jonlantiradi */
        background-image:
          radial-gradient(1200px 620px at 12% -8%, rgba(217,89,26,.045), transparent 62%),
          radial-gradient(1000px 560px at 92% 4%, rgba(33,89,160,.035), transparent 58%);
        background-attachment:fixed;
        color:${T.text};font-family:'Barlow',sans-serif;font-size:14px;line-height:1.5;
        -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
        text-rendering:optimizeLegibility;
      }
      .bc{font-family:'Barlow Condensed',sans-serif}
      /* Raqamlar ustunlarda "sakramasligi" uchun — jadval va summalar tekis turadi */
      .mo{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1}
      button,input,select,textarea{font-family:'Barlow',sans-serif;font-size:14px}
      button{-webkit-tap-highlight-color:transparent}
      input,select,textarea{transition:border-color .16s ease, box-shadow .16s ease, background .16s ease}
      input:hover:not(:focus),select:hover:not(:focus),textarea:hover:not(:focus){border-color:${T.border2}}
      input:focus,select:focus,textarea:focus{outline:none;border-color:${T.flame}!important;box-shadow:0 0 0 3px ${T.flame}22;background:${T.s1}}
      input::placeholder,textarea::placeholder{color:${T.muted};opacity:.85}
      /* Klaviatura bilan yurganda ko'rinadigan aniq halqa — sichqoncha bilan chiqmaydi */
      :focus-visible{outline:2px solid ${T.flame}80;outline-offset:2px;border-radius:6px}
      ::selection{background:${T.flame}2E;color:${T.text}}
      ::-webkit-scrollbar{width:9px;height:9px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:${T.border2};border-radius:99px;border:2px solid transparent;background-clip:content-box}
      ::-webkit-scrollbar-thumb:hover{background:${T.muted};background-clip:content-box}
      *{scrollbar-width:thin;scrollbar-color:${T.border2} transparent}
      .rh:hover{background:${T.flameD}!important}
      .stat-card{transition:box-shadow .2s cubic-bezier(.4,0,.2,1), transform .2s cubic-bezier(.4,0,.2,1), border-color .2s ease}
      .stat-card:hover{box-shadow:${T.sh3};transform:translateY(-2px);border-color:${T.flame}45!important}
      .ch{transition:box-shadow .2s cubic-bezier(.4,0,.2,1), transform .2s cubic-bezier(.4,0,.2,1), border-color .2s ease}
      .ch:hover{border-color:${T.flame}80!important;transform:translateY(-2px);box-shadow:${T.sh3}}
      .card-shadow{box-shadow:${T.sh1}}
      .card-shadow:hover{box-shadow:${T.sh2}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
      .fi{animation:fadeUp .26s cubic-bezier(.22,1,.36,1) both}
      .tab-btn{transition:background .16s ease, color .16s ease, box-shadow .16s ease}
      .tab-btn:not(.active):hover{background:${T.s3}!important; color:${T.text}!important}
      .tab-btn.active{box-shadow:inset 0 0 0 1px ${T.flame}2E}
      .spin{animation:spin 1s linear infinite}
      .pulse{animation:pulse 1.5s ease infinite}
      select{appearance:none}
      @media(max-width:640px){.hide-sm{display:none!important}}
      /* Tab lentasining scroll chizig'i ko'rinmasin — chetdagi "so'nish" yetarli */
      .tabs-scroll::-webkit-scrollbar{display:none}
      /* Tugmalar: bosilganda yengil "cho'kish" — teginish sezilarli bo'ladi */
      .btn{transition:filter .15s ease, box-shadow .15s ease, transform .08s ease, background .15s ease}
      .btn:not(:disabled):hover{filter:brightness(1.05)}
      .btn:not(:disabled):active{transform:translateY(1px);filter:brightness(.96)}
      .menu-item{transition:background .14s ease}
      .menu-item:hover{background:${T.s3}!important}
      /* Harakatni kamaytirish so'ralgan qurilmalarda animatsiyalar o'chadi */
      @media(prefers-reduced-motion:reduce){
        *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
      }
      @media print{
        body{background:#fff!important;background-image:none!important}
        .card-shadow,.stat-card{box-shadow:none!important}
      }
    `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/* ═══════════════════════════════════════════════════
   UI PRIMITIVES
═══════════════════════════════════════════════════ */
const iSt = {
  width: "100%", padding: "9px 12px", borderRadius: 9,
  border: `1px solid ${T.border}`, background: T.s2,
  color: T.text, fontSize: 13,
  boxShadow: "inset 0 1px 2px rgba(62,50,30,.04)",
};

function F({ label, children, col }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: col }}>
      <label style={{
        fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
        textTransform: "uppercase", color: T.muted2,
      }}>{label}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options, style: s }) {
  const opts = options.map((o) => (o && typeof o === "object" ? o : { value: o, label: o }));
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={onChange} style={{ ...iSt, paddingRight: 30, ...s }}>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} style={{
        position: "absolute", right: 10, top: "50%",
        transform: "translateY(-50%)", color: T.muted, pointerEvents: "none",
      }} />
    </div>
  );
}

/* Yozib qidirib tanlash — uzun ro'yxatlarda (mahsulotlar) kerakli narsani tez topish uchun.
   options: [{ value, label, sub? }] — sub qidiruvga ham, ko'rsatishga ham qo'shiladi (masalan qoldiq). */
function SearchSelect({ value, onChange, options, placeholder, emptyText }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef(null);

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    function onDocClick(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => (o.label + " " + (o.sub || "")).toLowerCase().includes(q))
    : options;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none" }} />
        <input
          style={{ ...iSt, paddingLeft: 30 }}
          value={open ? query : (current?.label || "")}
          placeholder={placeholder || "Yozib qidiring..."}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {open && (
        <div className="fi" style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: T.s1, border: `1px solid ${T.border2}`, borderRadius: 9,
          boxShadow: T.shPop, maxHeight: 240, overflowY: "auto",
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 12.5, color: T.muted }}>{emptyText || "Topilmadi"}</div>
          ) : filtered.map((o) => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setQuery(""); setOpen(false); }}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                width: "100%", padding: "9px 14px", background: o.value === value ? T.flameD : "none",
                border: "none", borderBottom: `1px solid ${T.border}30`, cursor: "pointer",
                fontSize: 13, textAlign: "left", color: T.text,
              }}>
              <span>{o.label}</span>
              {o.sub && <span className="mo" style={{ fontSize: 11, color: T.muted }}>{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CurrencyToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border2}` }}>
      {["SUM", "USD"].map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} style={{
          flex: 1, padding: "9px", border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 600,
          background: value === c ? T.flame : "transparent",
          color: value === c ? "#fff" : T.muted,
        }}>{c === "SUM" ? "SO'M" : "USD"}</button>
      ))}
    </div>
  );
}

/* Ochiq oynalar "stek"i — bir nechta oyna ustma-ust ochilsa, Esc faqat eng
   yuqoridagini yopadi (aks holda hammasi birdan yopilib ketardi). */
const _modalStack = [];

function Modal({ title, onClose, children, wide, xwide }) {
  // QULAYLIK (v58): Esc bilan yopish + oyna ochiq turganda orqa fon aylanmasin.
  // Ilgari oynani faqat "X" yoki fonni bosib yopish mumkin edi, va oyna ichida
  // pastga tushganda orqadagi sahifa ham birga surilib ketardi.
  useEffect(() => {
    const self = {};
    _modalStack.push(self);
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (_modalStack[_modalStack.length - 1] !== self) return; // eng yuqoridagi emas
      onClose?.();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = _modalStack.indexOf(self);
      if (i > -1) _modalStack.splice(i, 1);
      if (_modalStack.length === 0) document.body.style.overflow = prev;
    };
  }, [onClose]);

  // v58'dagi header/tab panelidagi "blur" effekti (backdrop-filter) endi shu elementlarni
  // pastdagi position:fixed bolalari uchun yangi "containing block" qilib qo'yadi — natijada
  // header ichidan ochilgan oyna (masalan HeaderMenu'dagi Import/Export) butun ekranni emas,
  // balki faqat 54px'lik header qutisini asos qilib joylashib, "yarim ko'rinadigan" bo'lib
  // qolardi. document.body'ga portal orqali chiqarish buni har doim, qayerdan chaqirilishidan
  // qat'i nazar, oldini oladi.
  return typeof document === "undefined" ? null : createPortal(
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(38,31,20,.42)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "18px 14px",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="fi" style={{
        width: "100%", maxWidth: xwide ? 900 : wide ? 680 : 480,
        maxHeight: "calc(100vh - 36px)",
        background: T.s1, border: `1px solid ${T.border}`,
        borderRadius: 16, overflow: "hidden",
        boxShadow: T.shModal,
        display: "flex", flexDirection: "column",
      }}>
        {/* SARLAVHA — doim ko'rinib turadi */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 22px", borderBottom: `1px solid ${T.border}`,
          background: T.s2, flexShrink: 0,
        }}>
          <span className="bc" style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".005em" }}>{title}</span>
          <button onClick={onClose} aria-label="Yopish" className="menu-item" style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: T.muted, width: 30, height: 30, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}><X size={17} /></button>
        </div>
        {/* MAZMUN — faqat shu qism aylanadi (bitta scroll). minHeight:0 shart — aks holda
            ichidagi katta elementlar (masalan qo'lda kattalashtirilgan textarea) flex konteynerni
            o'zi bilan birga cho'zib, sarlavhani ekrandan chiqarib yuborishi mumkin. */}
        <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

function SaveBtn({ onClick, disabled, children = "Saqlash", color }) {
  return (
    <button onClick={onClick} disabled={disabled} type="button" className="btn" style={{
      width: "100%", marginTop: 18, padding: "12px", borderRadius: 10, border: "none",
      background: disabled
        ? T.s3
        : color
          ? `linear-gradient(180deg,${color}F2,${color} 55%,${color}CC)`
          : `linear-gradient(180deg,#E4682A,${T.flame} 55%,#C74E12)`,
      color: disabled ? T.muted : "#fff", fontWeight: 700, fontSize: 13.5,
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: disabled
        ? "none"
        : `inset 0 1px 0 rgba(255,255,255,.22), 0 2px 4px rgba(62,50,30,.10), 0 6px 18px ${(color || T.flame)}38`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    }}>{children}</button>
  );
}

/* ── Global tasdiqlash tizimi — window.confirm sandboxda ishlamaydi ── */
let _confirmSetter = null;
function askConfirm(message) {
  return new Promise((resolve) => {
    if (_confirmSetter) _confirmSetter({ message, resolve });
  });
}
function ConfirmHost() {
  const [state, setState] = useState(null);
  useEffect(() => { _confirmSetter = setState; return () => { _confirmSetter = null; }; }, []);
  if (!state) return null;
  return (
    <Modal title="Tasdiqlash" onClose={() => { state.resolve(false); setState(null); }}>
      <p style={{ fontSize: 13.5, color: T.text, lineHeight: 1.6, whiteSpace: "pre-line" }}>{state.message}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }}
          onClick={() => { state.resolve(false); setState(null); }}>Bekor qilish</Btn>
        <Btn variant="red" style={{ flex: 1, justifyContent: "center" }}
          onClick={() => { state.resolve(true); setState(null); }}>Tasdiqlash</Btn>
      </div>
    </Modal>
  );
}

function Btn({ onClick, children, variant = "primary", size = "md", style: s, disabled, title, type }) {
  const sizes = { sm: "6px 11px", md: "9px 16px", lg: "12px 22px" };
  const variants = {
    // Asosiy tugma: yuqoridan nozik yorug'lik (inset) + o'z rangidagi yumshoq soya —
    // tekis to'ldirilgan tugmadan ko'ra "ko'tarilgan", qimmatroq ko'rinadi.
    primary: {
      background: `linear-gradient(180deg,#E4682A,${T.flame} 55%,#C74E12)`,
      color: "#fff", border: "none",
      boxShadow: `inset 0 1px 0 rgba(255,255,255,.22), 0 1px 2px rgba(62,50,30,.10), 0 4px 12px ${T.flame}33`,
    },
    ghost: { background: T.s1, color: T.muted2, border: `1px solid ${T.border2}`, boxShadow: T.sh1 },
    teal: { background: T.tealD, color: T.teal, border: `1px solid ${T.teal}40` },
    red: { background: T.redD, color: T.red, border: `1px solid ${T.red}40` },
    gold: { background: T.goldD, color: T.gold, border: `1px solid ${T.gold}40` },
    purple: { background: T.purpleD, color: T.purple, border: `1px solid ${T.purple}40` },
  };
  return (
    <button onClick={onClick} disabled={disabled} title={title} type={type || "button"} className="btn" style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: sizes[size], borderRadius: 9, cursor: disabled ? "not-allowed" : "pointer",
      fontSize: size === "sm" ? 11.5 : 13, fontWeight: 600,
      lineHeight: 1.35, whiteSpace: "nowrap",
      opacity: disabled ? .5 : 1,
      ...variants[variant], ...s,
    }}>{children}</button>
  );
}

function Badge({ children, color }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: color + "1A", color, letterSpacing: ".02em",
    }}>{children}</span>
  );
}

/* ── HEADER DROPDOWN MENU — zamonaviy, tor ekranda ham qulay ── */
function JSONExportModal({ data, onClose }) {
  const [copied, setCopied] = useState(false);
  const jsonStr = JSON.stringify(data, null, 2);
  const filename = `avtogaz-backup-${todayISO()}.json`;

  function download() {
    const ok = tryDownloadFile(filename, jsonStr, "application/json");
    if (!ok) copyToClipboard();
  }

  function copyToClipboard() {
    const ta = document.createElement("textarea");
    ta.value = jsonStr;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch (e) { /* jim o'tamiz, matn baribir ko'rinadi textarea'da */ }
    document.body.removeChild(ta);
  }

  return (
    <Modal title="JSON eksport — zaxira nusxa" onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
        Fayl avtomatik yuklab olinadi. Agar yuklab bo'lmasa, "Nusxalash" tugmasini bosib matnni
        oling va <b>{filename}</b> nomi bilan .json fayl sifatida saqlang.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Btn onClick={download}><Download size={14} /> Faylni yuklash</Btn>
        <Btn variant={copied ? "teal" : "ghost"} onClick={copyToClipboard}>
          {copied ? <Check size={14} /> : <Upload size={14} />} {copied ? "Nusxalandi!" : "Nusxalash"}
        </Btn>
      </div>

      <textarea
        readOnly value={jsonStr}
        onClick={(e) => e.target.select()}
        style={{
          width: "100%", height: 260, padding: 12, borderRadius: 8,
          border: `1px solid ${T.border2}`, background: T.s3, color: T.text,
          fontFamily: "monospace", fontSize: 11, resize: "vertical",
        }}
      />
    </Modal>
  );
}

function JSONImportModal({ onClose, onImport }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pendingData, setPendingData] = useState(null); // parse qilingan, tasdiq kutayotgan
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => { setText(r.result); setPendingData(null); };
    r.onerror = () => setError("Faylni o'qib bo'lmadi.");
    r.readAsText(file);
  }

  function checkAndPreview() {
    setError("");
    try {
      const p = JSON.parse(text);
      if (!isValidData(p)) { setError("❌ Fayl noto'g'ri formatda — kerakli maydonlar topilmadi."); return; }
      setPendingData(p);
    } catch (e) {
      setError("❌ Matn to'g'ri JSON formatida emas.");
    }
  }

  function confirmImport() {
    onImport(pendingData);
    onClose();
  }

  if (pendingData) {
    const itemCount = (pendingData.serviceCards?.length || 0) + (pendingData.products?.length || 0);
    return (
      <Modal title="Importni tasdiqlash" onClose={onClose}>
        <div style={{ padding: "14px 16px", background: T.goldD, border: `1px solid ${T.gold}30`, borderRadius: 9, marginBottom: 16 }}>
          <p style={{ fontSize: 13.5, color: T.text, lineHeight: 1.6 }}>
            Joriy barcha ma'lumotlar shu fayldagi <b>{itemCount} ta yozuv</b> bilan almashtiriladi.
            <br /><br />
            <b style={{ color: T.red }}>Bu amalni ortga qaytarib bo'lmaydi.</b> Davom etasizmi?
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setPendingData(null)}>Orqaga</Btn>
          <Btn variant="red" style={{ flex: 1, justifyContent: "center" }} onClick={confirmImport}>
            <Upload size={14} /> Ha, import qilish
          </Btn>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="JSON import — zaxiradan tiklash" onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
        Faylni tanlang yoki JSON matnini pastdagi maydonga to'g'ridan-to'g'ri joylashtiring (Ctrl+V).
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Btn variant="ghost" onClick={() => fileRef.current?.click()}><Upload size={14} /> Fayl tanlash</Btn>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFile} style={{ display: "none" }} />
      </div>

      <textarea
        value={text} onChange={(e) => { setText(e.target.value); setError(""); }}
        placeholder="JSON matnini shu yerga joylang yoki faylni yuqoridan tanlang..."
        style={{
          width: "100%", height: 240, maxHeight: 420, padding: 12, borderRadius: 8,
          border: `1px solid ${error ? T.red : T.border2}`, background: T.s3, color: T.text,
          fontFamily: "monospace", fontSize: 11, resize: "vertical",
        }}
      />
      {error && <p style={{ color: T.red, fontSize: 12, marginTop: 8 }}>{error}</p>}

      <SaveBtn disabled={!text.trim()} onClick={checkAndPreview} color={T.gold}>
        <Upload size={15} /> Import qilish
      </SaveBtn>
    </Modal>
  );
}

function RateChangeModal({ rate, onClose, onSave }) {
  const [val, setVal] = useState(String(rate));
  const num_ = Number(val);
  return (
    <Modal title="USD kursini o'zgartirish" onClose={onClose}>
      <F label="1 USD = ? so'm">
        <input
          type="number" style={iSt} value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus onFocus={(e) => e.target.select()}
        />
      </F>
      <p style={{ fontSize: 11.5, color: T.muted, marginTop: 8 }}>
        Joriy kurs: <b className="mo">{fmtSum(rate)}</b>
      </p>
      <SaveBtn disabled={!num_ || num_ <= 0} onClick={() => { onSave(num_); onClose(); }}>
        Saqlash
      </SaveBtn>
    </Modal>
  );
}

function StaffPinModal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // email
  const [pinInput, setPinInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("kassir");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const authHeader = await authClient.getAuthHeader();
      const res = await fetch(`/api/staff?branchId=${encodeURIComponent(authClient.branchId)}`, { headers: authHeader ? { Authorization: authHeader } : {} });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Ro'yxatni yuklab bo'lmadi");
      setStaff(json.staff || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function savePin(email, pin) {
    setSaving(true);
    setError("");
    try {
      const authHeader = await authClient.getAuthHeader();
      const res = await fetch("/api/staff/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ? { Authorization: authHeader } : {}) },
        body: JSON.stringify({ email, pin, branchId: authClient.branchId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Saqlanmadi");
      setEditing(null);
      setPinInput("");
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function addStaff() {
    setAddError("");
    const email = newEmail.trim().toLowerCase();
    const fullName = newName.trim();
    if (!email || !email.includes("@")) { setAddError("To'g'ri Gmail/email kiriting."); return; }
    if (!fullName) { setAddError("Ismini kiriting."); return; }
    setAdding(true);
    try {
      const authHeader = await authClient.getAuthHeader();
      const res = await fetch("/api/staff/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ? { Authorization: authHeader } : {}) },
        body: JSON.stringify({ email, fullName, role: newRole, branchId: authClient.branchId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Qo'shilmadi");
      setNewEmail(""); setNewName(""); setNewRole("kassir"); setShowAdd(false);
      await load();
    } catch (e) {
      setAddError(String(e?.message || e));
    } finally {
      setAdding(false);
    }
  }

  async function removeStaff(email) {
    if (!(await askConfirm(`"${email}" tizimdan olib tashlansinmi? U endi Google orqali kira olmaydi.`))) return;
    setSaving(true);
    setError("");
    try {
      const authHeader = await authClient.getAuthHeader();
      const res = await fetch("/api/staff/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ? { Authorization: authHeader } : {}) },
        body: JSON.stringify({ email, branchId: authClient.branchId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "O'chirilmadi");
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Xodimlar — Google orqali kirish" onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
        Kassir va sklad endi shu ro'yxatdagi Gmail orqali kiradi (4 xonali kod endi ishlamaydi).
        Google orqali kirgandan keyin, agar xodimga shaxsiy PIN o'rnatilgan bo'lsa, kirish uchun
        yana shu PIN ham so'raladi — bu kompyuterda Google hisobingiz ochiq turgan payt boshqa
        birov ilovaga kirib qolishining oldini oladi.
      </p>

      <div style={{ marginBottom: 16 }}>
        <Btn size="sm" variant={showAdd ? "ghost" : "gold"} onClick={() => setShowAdd((s) => !s)}>
          <Plus size={13} /> {showAdd ? "Bekor qilish" : "Yangi xodim qo'shish"}
        </Btn>
        {showAdd && (
          <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginTop: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input style={{ ...iSt, flex: 2, minWidth: 180 }} placeholder="Gmail manzili"
                value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <input style={{ ...iSt, flex: 1, minWidth: 140 }} placeholder="Ism-familiyasi"
                value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Sel value={newRole} onChange={(e) => setNewRole(e.target.value)} options={[
                { value: "kassir", label: "Kassir" },
                { value: "sklad", label: "Sklad" },
              ]} />
            </div>
            {addError && <p style={{ fontSize: 12, color: T.red, marginBottom: 8 }}>{addError}</p>}
            <Btn size="sm" variant="teal" disabled={adding} onClick={addStaff}>
              {adding ? "Qo'shilmoqda..." : "Qo'shish"}
            </Btn>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 30 }}><Loader2 className="spin" size={22} color={T.flame} /></div>
      ) : error ? (
        <p style={{ fontSize: 12.5, color: T.red }}>{error}</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {staff.map((s) => (
            <div key={s.email} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              background: T.s3, borderRadius: 10, padding: "10px 14px",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.fullName || s.email}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{ROLE_LABELS[s.role] || s.role} · {s.email}</div>
              </div>
              {editing === s.email ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="text" inputMode="numeric" maxLength={8} autoFocus
                    style={{ ...iSt, width: 90 }}
                    value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="4-8 raqam"
                  />
                  <Btn size="sm" variant="teal" disabled={saving || pinInput.length < 4} onClick={() => savePin(s.email, pinInput)}>Saqlash</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => { setEditing(null); setPinInput(""); }}>Bekor</Btn>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Badge color={s.hasPin ? T.teal : T.muted}>{s.hasPin ? "PIN bor" : "PIN yo'q"}</Badge>
                  <Btn size="sm" variant="ghost" onClick={() => { setEditing(s.email); setPinInput(""); }}>
                    {s.hasPin ? "O'zgartirish" : "O'rnatish"}
                  </Btn>
                  {s.hasPin && (
                    <Btn size="sm" variant="red" disabled={saving} onClick={() => savePin(s.email, "")}>PIN o'chirish</Btn>
                  )}
                  {s.role !== "azim" && (
                    <Btn size="sm" variant="red" disabled={saving} onClick={() => removeStaff(s.email)}>Xodimni o'chirish</Btn>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function PinChangeModal({ pins, onClose, onSave }) {
  const [rahbar, setRahbar] = useState(pins.rahbar || "");
  const [error, setError] = useState("");

  function isValid4Digit(v) { return /^\d{4}$/.test(v); }

  function handleSave() {
    if (!isValid4Digit(rahbar)) {
      setError("PIN aynan 4 ta raqamdan iborat bo'lishi kerak.");
      return;
    }
    // Kassir/Sklad PIN'lari endi ishlatilmaydi (ular Google orqali kiradi) — shu ikkalasini
    // eski qiymatida o'zgarmasdan qoldiramiz, faqat Rahbar PIN'ni yangilaymiz.
    onSave({ ...pins, rahbar });
    onClose();
  }

  return (
    <Modal title="PIN kodlarni o'zgartirish" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
        4 ta raqam bo'lishi kerak. O'zgarish darhol kuchga kiradi.
        Usta uchun umumiy PIN yo'q — har bir ustaga "Usta kodlari" bo'limidan shaxsiy kod beriladi.
      </p>
      <div style={{ display: "grid", gap: 14 }}>
        <F label="Rahbar PIN (faqat kuzatish)">
          <input
            type="text" inputMode="numeric" maxLength={4} style={iSt}
            value={rahbar} onChange={(e) => setRahbar(e.target.value.replace(/\D/g, "").slice(0, 4))}
            autoFocus onFocus={(e) => e.target.select()}
          />
        </F>
      </div>
      <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 9, padding: 12, marginTop: 14 }}>
        <p style={{ fontSize: 12, color: T.muted2, lineHeight: 1.6 }}>
          <b>Kassir</b> va <b>Sklad</b> uchun endi 4 xonali kod yo'q — ular faqat <b>Google hisobi</b>
          orqali kiradi. Yangi kassir yoki sklad xodimini qo'shish uchun "Xodimlar — 2-bosqich PIN"
          bo'limiga murojaat qiling.
        </p>
      </div>
      {error && <p style={{ color: T.red, fontSize: 12, marginTop: 10 }}>{error}</p>}
      <SaveBtn color={T.purple} onClick={handleSave}>
        <Lock size={15} /> PIN kodlarni saqlash
      </SaveBtn>
    </Modal>
  );
}

function UstaCodesModal({ codes, data, onClose, onAdd, onRemove }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const knownNames = ustaNameOptions(data);

  // Har bir usta uchun ish samaradorligi (yakunlangan kartalar bo'yicha)
  function statsFor(ustaName) {
    const cards = data.serviceCards.filter((c) => cardStatus(c) !== "ochiq" && sameName(c.usta, ustaName));
    return {
      jobs: cards.length,
      revenue: cards.reduce((s, c) => s + num(c.finalTotal), 0),
      fee: cards.reduce((s, c) => s + num(c.ustaFee), 0),
    };
  }

  function handleAdd() {
    if (!name.trim()) { setError("Usta ismini kiriting."); return; }
    if (!/^\d{4}$/.test(code)) { setError("Kod aynan 4 ta raqamdan iborat bo'lishi kerak."); return; }
    if (codes.some((c) => c.code === code)) { setError("Bu kod allaqachon band."); return; }
    const reserved = [data.settings.pins?.rahbar, data.settings.pins?.kassir, data.settings.pins?.sklad].filter(Boolean);
    if (reserved.includes(code)) { setError("Bu kod umumiy rol PIN kodi sifatida band."); return; }
    if (codes.some((c) => sameName(c.name, name))) { setError("Bu usta uchun kod allaqachon mavjud."); return; }
    onAdd({ name: name.trim(), code });
    setName(""); setCode(""); setError("");
  }

  return (
    <Modal title="Usta kodlari — shaxsiy kirish va samaradorlik" onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
        Har bir ustaga shaxsiy 4 xonali kod bering. Usta shu kod bilan kirganda tizim uni avtomatik
        taniydi va faqat o'ziga tegishli kartalarni ko'radi — bu ish samaradorligini aniq o'lchash imkonini beradi.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input style={{ ...iSt, flex: 1, minWidth: 150 }} placeholder="Usta ismi"
          value={name} list="usta-code-names"
          onChange={(e) => { setName(e.target.value); setError(""); }} />
        <datalist id="usta-code-names">{knownNames.map((n) => <option key={n} value={n} />)}</datalist>
        <input type="text" inputMode="numeric" style={{ ...iSt, width: 110 }} placeholder="4 xonali kod"
          value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} />
        <Btn onClick={handleAdd} color={T.teal}><Plus size={14} /></Btn>
      </div>
      {error && <p style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</p>}

      {codes.length === 0 ? (
        <p style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0" }}>Hali usta kodi qo'shilmagan</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
          {codes.map((c) => {
            const s = statsFor(c.name);
            return (
              <div key={c.id} style={{ background: T.s3, borderRadius: 9, padding: "11px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                    <div className="mo" style={{ fontSize: 12, color: T.teal, letterSpacing: ".14em" }}>{c.code}</div>
                  </div>
                  <button onClick={() => onRemove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}`, fontSize: 11 }}>
                  <span style={{ color: T.muted }}>Ishlar: <b style={{ color: T.text }}>{s.jobs} ta</b></span>
                  <span style={{ color: T.muted }}>Tushum: <b className="mo" style={{ color: T.blue }}>{fmtSum(s.revenue)}</b></span>
                  <span style={{ color: T.muted }}>Olgan haqi: <b className="mo" style={{ color: T.gold }}>{fmtSum(s.fee)}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function OwnerCodesModal({ codes, onClose, onAdd, onRemove }) {
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleAdd() {
    if (!/^\d{7}$/.test(code)) { setError("Kod aynan 7 ta raqamdan iborat bo'lishi kerak."); return; }
    if (codes.some((c) => c.code === code)) { setError("Bu kod allaqachon mavjud."); return; }
    onAdd({ code, label: label.trim() || "Nomsiz" });
    setLabel(""); setCode(""); setError("");
  }

  return (
    <Modal title="Egasi kodlari — 7 xonali, to'liq huquqli" onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
        Bu yerda qo'shimcha 7 xonali kodlar yaratasiz — ular Admin bilan bir xil, to'liq huquqqa ega.
        Masalan boshqa filial yoki ishonchli xodim uchun alohida kod.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input style={{ ...iSt, flex: 1, minWidth: 140 }} placeholder="Kim uchun (masalan: Direktor o'rinbosari)"
          value={label} onChange={(e) => { setLabel(e.target.value); setError(""); }} />
        <input
          type="text" inputMode="numeric" style={{ ...iSt, width: 120 }} placeholder="7 xonali kod"
          value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 7)); setError(""); }}
        />
        <Btn onClick={handleAdd} color={T.gold}><Plus size={14} /></Btn>
      </div>
      {error && <p style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</p>}

      <div style={{ marginTop: 6 }}>
        {codes.length === 0 ? (
          <p style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "16px 0" }}>Hali qo'shimcha kod yo'q</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {codes.map((c) => (
              <div key={c.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: T.s3, borderRadius: 8, padding: "10px 14px",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                  <div className="mo" style={{ fontSize: 12, color: T.gold, letterSpacing: ".1em" }}>{c.code}</div>
                </div>
                <button onClick={() => onRemove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SupplierCodesModal({ codes, data, onClose, onAdd, onRemove }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const knownNames = supplierDebts(data).map((d) => d.name);

  function handleAdd() {
    if (!name.trim()) { setError("Ta'minotchi nomini kiriting."); return; }
    if (!/^\d{4}$/.test(code)) { setError("Kod aynan 4 ta raqamdan iborat bo'lishi kerak."); return; }
    const reserved = [
      ...Object.values(data.settings.pins || {}),
      ...(data.settings.ustaCodes || []).map((c) => c.code),
      ...(data.settings.partnerCodes || []).map((c) => c.code),
      ...codes.map((c) => c.code),
    ];
    if (reserved.includes(code)) { setError("Bu kod allaqachon band."); return; }
    if (codes.some((c) => sameName(c.name, name))) { setError("Bu ta'minotchi uchun kod allaqachon mavjud."); return; }
    onAdd({ name: name.trim(), code });
    setName(""); setCode(""); setError("");
  }

  return (
    <Modal title="Ta'minotchi kodlari — shaxsiy kirish" onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
        Ta'minotchiga shaxsiy 4 xonali kod bering. Shu kod bilan kirib, faqat o'z yetkazmalari va qarzini ko'ra oladi.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input style={{ ...iSt, flex: 1, minWidth: 150 }} placeholder="Ta'minotchi nomi"
          value={name} list="supplier-code-names"
          onChange={(e) => { setName(e.target.value); setError(""); }} />
        <datalist id="supplier-code-names">{knownNames.map((n) => <option key={n} value={n} />)}</datalist>
        <input type="text" inputMode="numeric" style={{ ...iSt, width: 110 }} placeholder="4 xonali kod"
          value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} />
        <Btn onClick={handleAdd} color={T.teal}><Plus size={14} /></Btn>
      </div>
      {error && <p style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</p>}

      {codes.length === 0 ? (
        <p style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0" }}>Hali ta'minotchi kodi qo'shilmagan</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
          {codes.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.s3, borderRadius: 9, padding: "11px 14px" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                <div className="mo" style={{ fontSize: 12, color: T.teal, letterSpacing: ".14em" }}>{c.code}</div>
              </div>
              <button onClick={() => onRemove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function PartnerCodesModal({ codes, data, onClose, onAdd, onRemove }) {
  const [partnerId, setPartnerId] = useState(data.partners[0]?.id || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const available = data.partners.filter((p) => !codes.some((c) => c.partnerId === p.id));

  function handleAdd() {
    if (!partnerId) { setError("Hamkorni tanlang."); return; }
    if (!/^\d{4}$/.test(code)) { setError("Kod aynan 4 ta raqamdan iborat bo'lishi kerak."); return; }
    const reserved = [
      ...Object.values(data.settings.pins || {}),
      ...(data.settings.ustaCodes || []).map((c) => c.code),
      ...(data.settings.supplierCodes || []).map((c) => c.code),
      ...codes.map((c) => c.code),
    ];
    if (reserved.includes(code)) { setError("Bu kod allaqachon band."); return; }
    if (codes.some((c) => c.partnerId === partnerId)) { setError("Bu hamkor uchun kod allaqachon mavjud."); return; }
    onAdd({ partnerId, code });
    setCode(""); setError("");
  }

  return (
    <Modal title="Hamkor kodlari — shaxsiy kirish" onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
        Hamkorga shaxsiy 4 xonali kod bering. Shu kod bilan kirib, faqat o'z olgan mahsuloti va qarzini ko'ra oladi.
      </p>
      {available.length === 0 && data.partners.length === 0 ? (
        <p style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Avval "Hamkorlar" bo'limidan hamkor qo'shing.</p>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <Sel value={partnerId} onChange={(e) => { setPartnerId(e.target.value); setError(""); }}
            options={available.length ? available.map((p) => ({ value: p.id, label: p.name })) : [{ value: "", label: "Barchasiga kod berilgan" }]} />
          <input type="text" inputMode="numeric" style={{ ...iSt, width: 110 }} placeholder="4 xonali kod"
            value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} />
          <Btn onClick={handleAdd} color={T.purple}><Plus size={14} /></Btn>
        </div>
      )}
      {error && <p style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</p>}

      {codes.length === 0 ? (
        <p style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "20px 0" }}>Hali hamkor kodi qo'shilmagan</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
          {codes.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.s3, borderRadius: 9, padding: "11px 14px" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{data.partners.find((p) => p.id === c.partnerId)?.name || "Noma'lum"}</div>
                <div className="mo" style={{ fontSize: 12, color: T.purple, letterSpacing: ".14em" }}>{c.code}</div>
              </div>
              <button onClick={() => onRemove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ResetAllConfirmModal({ data, onClose, onConfirm }) {
  const [step, setStep] = useState(1); // 1: ogohlantirish+eksport, 2: yozib tasdiqlash
  const [typed, setTyped] = useState("");
  const CONFIRM_WORD = "OCHIRISH";

  const counts = {
    cards: data.serviceCards?.length || 0,
    products: data.products?.length || 0,
    cashflow: data.cashflow?.length || 0,
    partners: data.partners?.length || 0,
  };

  function exportBeforeReset() {
    tryDownloadFile(`avtogaz-oxirgi-zaxira-${todayISO()}.json`, JSON.stringify(data, null, 2), "application/json");
  }

  if (step === 1) {
    return (
      <Modal title="⚠️ Barcha ma'lumotni tozalash" onClose={onClose} wide>
        <div style={{ padding: "14px 16px", background: T.redD, border: `1px solid ${T.red}40`, borderRadius: 9, marginBottom: 16 }}>
          <p style={{ fontSize: 13.5, color: T.text, lineHeight: 1.7 }}>
            Bu amal <b style={{ color: T.red }}>BARCHA</b> ma'lumotni butunlay o'chiradi:
          </p>
          <ul style={{ margin: "10px 0 0 18px", fontSize: 12.5, color: T.muted2, lineHeight: 1.9 }}>
            <li>{counts.cards} ta xizmat kartasi</li>
            <li>{counts.products} ta sklad mahsuloti</li>
            <li>{counts.cashflow} ta kassa yozuvi</li>
            <li>{counts.partners} ta hamkor</li>
            <li>Barcha qarzlar, xodimlar, kafolatlar va boshqa yozuvlar</li>
          </ul>
        </div>
        <p style={{ fontSize: 12.5, color: T.gold, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} /> Tavsiya: davom etishdan oldin zaxira nusxa oling.
        </p>
        <Btn variant="ghost" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }} onClick={exportBeforeReset}>
          <Download size={14} /> Avval JSON zaxira yuklab olish
        </Btn>
        <SaveBtn color={T.red} onClick={() => setStep(2)}>
          Tushundim, davom etaman
        </SaveBtn>
      </Modal>
    );
  }

  return (
    <Modal title="Yakuniy tasdiqlash" onClose={onClose}>
      <p style={{ fontSize: 13, color: T.text, marginBottom: 14, lineHeight: 1.6 }}>
        Davom etish uchun pastdagi maydonga aynan <b className="mo" style={{ color: T.red }}>{CONFIRM_WORD}</b> so'zini yozing:
      </p>
      <input
        style={{ ...iSt, textAlign: "center", fontSize: 16, fontWeight: 700, letterSpacing: ".05em" }}
        value={typed} onChange={(e) => setTyped(e.target.value)}
        placeholder={CONFIRM_WORD} autoFocus
      />
      <SaveBtn color={T.red} disabled={typed !== CONFIRM_WORD} onClick={onConfirm}>
        <Trash2 size={15} /> Ha, barcha ma'lumotni butunlay o'chirish
      </SaveBtn>
    </Modal>
  );
}

// Har bir filial /app/<branchId>/page.js orqali, mustaqil manzilda ochiladi (BRANCH_LABELS
// bilan mos). Bu ro'yxat kodda qo'lda yuritiladi — yangi filial qo'shilsa (yangi papka +
// BRANCH_LABELS yozuvi), shu yerga ham bitta qator qo'shiladi.
const BRANCH_LINKS = [
  { id: "main", path: "/" },
  { id: "filial2", path: "/filial2" },
];

function BranchesModal({ currentBranchId, onClose }) {
  return (
    <Modal title="Filiallar" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
        Har bir filial — bosh tizimdan butunlay mustaqil (o'z skladi, kassasi, kartalari,
        xodimlari). Filial almashtirish uchun quyidagi manzilga o'ting.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {BRANCH_LINKS.map((b) => {
          const isCurrent = b.id === currentBranchId;
          return (
            <div key={b.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              background: isCurrent ? T.flameD : T.s3, border: `1px solid ${isCurrent ? T.flame + "40" : T.border}`,
              borderRadius: 10, padding: "11px 15px",
            }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: isCurrent ? T.flame : T.text }}>
                  {BRANCH_LABELS[b.id] || b.id}
                </div>
                <div className="mo" style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{b.path}</div>
              </div>
              {isCurrent ? (
                <Badge color={T.flame}>Hozir shu yerda</Badge>
              ) : (
                <a href={b.path} style={{
                  fontSize: 12, fontWeight: 700, color: T.blue, textDecoration: "none",
                  display: "flex", alignItems: "center", gap: 4,
                }}>O'tish →</a>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: T.muted, marginTop: 14, lineHeight: 1.5 }}>
        Yangi filial ochish uchun (o'z manzili, xodimlari va PIN kodlari bilan) dasturchiga murojaat qiling.
      </p>
    </Modal>
  );
}

function HeaderMenu({ role, rate, patch, data, onImport, onResetAll, branchId }) {
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [excelError, setExcelError] = useState(false);
  const [resetPinOpen, setResetPinOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [ownerCodesOpen, setOwnerCodesOpen] = useState(false);
  const [ustaCodesOpen, setUstaCodesOpen] = useState(false);
  const [supplierCodesOpen, setSupplierCodesOpen] = useState(false);
  const [partnerCodesOpen, setPartnerCodesOpen] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [staff2FAOpen, setStaff2FAOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button onClick={() => setOpen((s) => !s)} style={{
        display: "flex", alignItems: "center", gap: 6,
        background: T.s2, border: `1px solid ${T.border2}`,
        borderRadius: 8, padding: "7px 11px", cursor: "pointer",
      }}>
        <Settings2 size={13} color={T.flame} />
        <span className="mo hide-sm" style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{fmtSum(rate)}</span>
        <ChevronDown size={11} color={T.muted} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 220, background: T.s1, border: `1px solid ${T.border2}`,
          borderRadius: 12, boxShadow: T.shPop,
          overflow: "hidden", zIndex: 300,
        }} className="fi">
          {(role === "azim") && (
            <button onClick={() => { setRateOpen(true); setOpen(false); }}
              className="menu-item" style={menuItemSt}>
              <Settings2 size={14} color={T.flame} /> Kursni o'zgartirish
              <span className="mo" style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>{fmtSum(rate)}</span>
            </button>
          )}
          {role === "azim" && (
            <button onClick={() => { setPinChangeOpen(true); setOpen(false); }}
              className="menu-item" style={menuItemSt}>
              <Lock size={14} color={T.purple} /> PIN kodlarni o'zgartirish
            </button>
          )}
          {role === "azim" && (
            <button onClick={() => { setOwnerCodesOpen(true); setOpen(false); }}
              className="menu-item" style={menuItemSt}>
              <KeyRound size={14} color={T.gold} /> Egasi kodlari (7 xonali)
            </button>
          )}
          {role === "azim" && (
            <button onClick={() => { setUstaCodesOpen(true); setOpen(false); }}
              className="menu-item" style={menuItemSt}>
              <Wrench size={14} color={T.teal} /> Usta kodlari
            </button>
          )}
          {role === "azim" && (
            <button onClick={() => { setSupplierCodesOpen(true); setOpen(false); }}
              className="menu-item" style={menuItemSt}>
              <KeyRound size={14} color={T.blue} /> Ta'minotchi kodlari
            </button>
          )}
          {role === "azim" && (
            <button onClick={() => { setPartnerCodesOpen(true); setOpen(false); }}
              className="menu-item" style={menuItemSt}>
              <KeyRound size={14} color={T.purple} /> Hamkor kodlari
            </button>
          )}
          {role === "azim" && (
            <button onClick={() => { setBranchesOpen(true); setOpen(false); }}
              className="menu-item" style={menuItemSt}>
              <Package size={14} color={T.blue} /> Filiallar
            </button>
          )}
          {role === "azim" && (
            <button onClick={() => { setStaff2FAOpen(true); setOpen(false); }}
              className="menu-item" style={menuItemSt}>
              <ShieldCheck size={14} color={T.flame} /> Xodimlar — 2-bosqich PIN
            </button>
          )}
          {(role === "azim" || role === "kassir") && (
            <>
              <button onClick={() => { setExportOpen(true); setOpen(false); }} className="menu-item" style={menuItemSt}>
                <Download size={14} color={T.blue} /> JSON eksport
              </button>
              <button onClick={() => { const ok = doExportExcel(data, rate); if (!ok) setExcelError(true); setOpen(false); }} className="menu-item" style={menuItemSt}>
                <Download size={14} color={T.teal} /> Excel eksport
              </button>
            </>
          )}
          {(role === "azim") && (
            <button onClick={() => { setImportOpen(true); setOpen(false); }} className="menu-item" style={menuItemSt}>
              <Upload size={14} color={T.gold} /> JSON import
            </button>
          )}
          {role === "azim" && (
            <button onClick={() => { setResetPinOpen(true); setOpen(false); }}
              className="menu-item" style={{ ...menuItemSt, borderTop: `1px solid ${T.border}`, color: T.red }}>
              <Trash2 size={14} color={T.red} /> Barcha ma'lumotni tozalash
            </button>
          )}
        </div>
      )}

      {staff2FAOpen && <StaffPinModal onClose={() => setStaff2FAOpen(false)} />}
      {exportOpen && <JSONExportModal data={data} onClose={() => setExportOpen(false)} />}
      {importOpen && <JSONImportModal onClose={() => setImportOpen(false)} onImport={onImport} />}
      {rateOpen && (
        <RateChangeModal rate={rate} onClose={() => setRateOpen(false)}
          onSave={(v) => patch((d) => { d.settings.usdRate = v; return d; })} />
      )}
      {excelError && (
        <Modal title="Excel eksport muvaffaqiyatsiz" onClose={() => setExcelError(false)}>
          <p style={{ fontSize: 13.5, color: T.text, lineHeight: 1.6, marginBottom: 16 }}>
            Excel faylni yuklab bo'lmadi (brauzer cheklovi bo'lishi mumkin).
            Buning o'rniga <b>JSON eksport</b>dan foydalaning — u orqali ham barcha ma'lumot to'liq saqlanadi.
          </p>
          <Btn onClick={() => { setExcelError(false); setExportOpen(true); }}>
            <Download size={14} /> JSON eksportga o'tish
          </Btn>
        </Modal>
      )}
      {resetPinOpen && (
        <SimplePinModal onClose={() => setResetPinOpen(false)}
          onSuccess={() => { setResetPinOpen(false); setResetConfirmOpen(true); }} />
      )}
      {resetConfirmOpen && (
        <ResetAllConfirmModal data={data} onClose={() => setResetConfirmOpen(false)}
          onConfirm={() => { onResetAll(); setResetConfirmOpen(false); }} />
      )}
      {pinChangeOpen && (
        <PinChangeModal pins={data.settings.pins} onClose={() => setPinChangeOpen(false)}
          onSave={(newPins) => patch((d) => { d.settings.pins = newPins; return d; })} />
      )}
      {ownerCodesOpen && (
        <OwnerCodesModal codes={data.settings.extraAdminCodes || []} onClose={() => setOwnerCodesOpen(false)}
          onAdd={(code) => patch((d) => { d.settings.extraAdminCodes = d.settings.extraAdminCodes || []; d.settings.extraAdminCodes.push({ id: uid(), ...code }); return d; })}
          onRemove={(id) => patch((d) => { d.settings.extraAdminCodes = (d.settings.extraAdminCodes || []).filter((c) => c.id !== id); return d; })}
        />
      )}
      {ustaCodesOpen && (
        <UstaCodesModal codes={data.settings.ustaCodes || []} data={data} onClose={() => setUstaCodesOpen(false)}
          onAdd={(item) => patch((d) => { d.settings.ustaCodes = d.settings.ustaCodes || []; d.settings.ustaCodes.push({ id: uid(), ...item }); return d; })}
          onRemove={(id) => patch((d) => { d.settings.ustaCodes = (d.settings.ustaCodes || []).filter((c) => c.id !== id); return d; })}
        />
      )}
      {supplierCodesOpen && (
        <SupplierCodesModal codes={data.settings.supplierCodes || []} data={data} onClose={() => setSupplierCodesOpen(false)}
          onAdd={(item) => patch((d) => { d.settings.supplierCodes = d.settings.supplierCodes || []; d.settings.supplierCodes.push({ id: uid(), ...item }); return d; })}
          onRemove={(id) => patch((d) => { d.settings.supplierCodes = (d.settings.supplierCodes || []).filter((c) => c.id !== id); return d; })}
        />
      )}
      {partnerCodesOpen && (
        <PartnerCodesModal codes={data.settings.partnerCodes || []} data={data} onClose={() => setPartnerCodesOpen(false)}
          onAdd={(item) => patch((d) => { d.settings.partnerCodes = d.settings.partnerCodes || []; d.settings.partnerCodes.push({ id: uid(), ...item }); return d; })}
          onRemove={(id) => patch((d) => { d.settings.partnerCodes = (d.settings.partnerCodes || []).filter((c) => c.id !== id); return d; })}
        />
      )}
      {branchesOpen && <BranchesModal currentBranchId={branchId} onClose={() => setBranchesOpen(false)} />}
    </div>
  );
}
const menuItemSt = {
  display: "flex", alignItems: "center", gap: 10, width: "100%",
  padding: "11px 14px", background: "none", border: "none", cursor: "pointer",
  fontSize: 12.5, color: "inherit", textAlign: "left", fontFamily: "inherit",
};

/* Raqamli ustunlarni avtomatik o'ngga tekislash — moliyaviy jadvallar standarti */
const NUMERIC_KEYS = /sum|amount|total|qty|price|cost|fee|profit|debt|paid|remaining|balance|revenue|val|count|jobs/i;
function colAlign(c) {
  if (c.a) return c.a;                       // qo'lda belgilangan
  if (!c.h) return "center";                 // sarlavhasiz (tugma) ustun
  return NUMERIC_KEYS.test(c.k) ? "right" : "left";
}

function Tbl({ cols, rows, empty, pageSize = 25, dense = false, maxH = 620 }) {
  const [visible, setVisible] = useState(pageSize);
  if (!rows.length)
    return (
      <div style={{ padding: "44px 20px", textAlign: "center" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, margin: "0 auto 12px",
          background: T.s3, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Search size={17} color={T.border2} />
        </div>
        <div style={{ color: T.muted, fontSize: 13 }}>{empty || "Ma'lumot yo'q"}</div>
      </div>
    );

  const shown = rows.slice(0, visible);
  const hasMore = rows.length > visible;
  const padY = dense ? 8 : 11;

  return (
    <div>
      <div style={{ overflowX: "auto", ...(maxH ? { maxHeight: maxH, overflowY: "auto" } : {}) }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12.5 }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.k} style={{
                  padding: `10px 14px`, textAlign: colAlign(c), color: T.muted,
                  fontWeight: 700, fontSize: 9.5, textTransform: "uppercase",
                  letterSpacing: ".08em", whiteSpace: "nowrap",
                  // Aylantirilganda ostidagi qatorlar "ko'rinib ketmasligi" uchun to'liq
                  // shaffof bo'lmagan fon + nozik soya (avval faqat chegara bor edi).
                  background: T.s2, position: "sticky", top: 0, zIndex: 2,
                  borderBottom: `1px solid ${T.border2}`,
                  boxShadow: "0 1px 0 rgba(62,50,30,.04), 0 4px 8px -6px rgba(62,50,30,.18)",
                }}>{c.h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} className="rh" style={{ background: i % 2 === 1 ? T.s2 : "transparent" }}>
                {cols.map((c) => (
                  <td key={c.k} style={{
                    padding: `${padY}px 14px`, color: T.text, whiteSpace: "nowrap",
                    textAlign: colAlign(c),
                    borderBottom: `1px solid ${T.border}80`,
                    // Raqamli ustunlarda raqamlar bir xil kenglikda — summalar ustunda tekis turadi
                    ...(colAlign(c) === "right" ? { fontVariantNumeric: "tabular-nums" } : {}),
                  }}>
                    {c.r ? c.r(row) : row[c.k]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 16px", borderTop: `1px solid ${T.border}`, background: T.s2,
        }}>
          <span style={{ fontSize: 11, color: T.muted }}>
            {visible} / {rows.length} ta ko'rsatilmoqda
          </span>
          <button onClick={() => setVisible((v) => v + pageSize)} style={{
            background: T.s1, border: `1px solid ${T.border2}`, borderRadius: 7,
            padding: "6px 15px", fontSize: 11.5, fontWeight: 600, color: T.flame, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <ChevronDown size={12} /> Yana {Math.min(pageSize, rows.length - visible)} ta
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Sana bo'yicha panellarga bo'lingan ro'yxat — tepada aniq davr filtri bilan ── */
const UZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

function DateGroupedList({ rows, cols, empty, amountFn }) {
  const [rangeMode, setRangeMode] = useState("hammasi"); // bugun | hafta | oy | yil | erkin | hammasi
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(todayISO());
  const [openYears, setOpenYears] = useState(new Set());
  const [openMonths, setOpenMonths] = useState(new Set());
  const [openDays, setOpenDays] = useState(new Set());

  const now = todayISO();
  const filtered = rows.filter((r) => {
    if (!r.date) return rangeMode === "hammasi";
    if (rangeMode === "hammasi") return true;
    if (rangeMode === "bugun") return r.date === now;
    if (rangeMode === "hafta") { const d = new Date(); d.setDate(d.getDate() - 6); return r.date >= d.toISOString().slice(0, 10); }
    if (rangeMode === "oy") return r.date.startsWith(now.slice(0, 7));
    if (rangeMode === "yil") return r.date.startsWith(now.slice(0, 4));
    return r.date >= from && r.date <= to; // erkin
  });

  // Yil -> Oy -> Kun ierarxiyasi
  const tree = {};
  filtered.forEach((r) => {
    const date = r.date || "0000-00-00";
    const year = date.slice(0, 4);
    const month = date.slice(0, 7);
    tree[year] = tree[year] || {};
    tree[year][month] = tree[year][month] || {};
    tree[year][month][date] = tree[year][month][date] || [];
    tree[year][month][date].push(r);
  });
  const years = Object.keys(tree).sort((a, b) => b.localeCompare(a));

  function toggle(setFn, key) {
    setFn((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }
  function sumRows(arr) { return amountFn ? arr.reduce((s, r) => s + amountFn(r), 0) : null; }
  function countAndSum(obj) {
    let count = 0, sum = 0;
    Object.values(obj).forEach((v) => {
      if (Array.isArray(v)) { count += v.length; sum += sumRows(v); }
      else { const r = countAndSum(v); count += r.count; sum += r.sum; }
    });
    return { count, sum };
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[["hammasi", "Hammasi"], ["bugun", "Bugun"], ["hafta", "Bu hafta"], ["oy", "Bu oy"], ["yil", "Bu yil"], ["erkin", "Erkin oraliq"]].map(([v, l]) => (
          <button key={v} onClick={() => setRangeMode(v)} style={{
            padding: "6px 13px", borderRadius: 20, border: `1px solid ${rangeMode === v ? T.flame : T.border2}`,
            background: rangeMode === v ? T.flameD : T.s1, color: rangeMode === v ? T.flame : T.muted,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{l}</button>
        ))}
        {rangeMode === "erkin" && (
          <>
            <input type="date" style={{ ...iSt, width: 140, padding: "6px 10px" }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <span style={{ color: T.muted }}>—</span>
            <input type="date" style={{ ...iSt, width: 140, padding: "6px 10px" }} value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
      </div>

      {years.length === 0 ? (
        <div style={{ padding: "38px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>{empty || "Ma'lumot yo'q"}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {years.map((year) => {
            const yearOpen = openYears.has(year);
            const { count: yearCount, sum: yearSum } = countAndSum(tree[year]);
            const months = Object.keys(tree[year]).sort((a, b) => b.localeCompare(a));
            return (
              <div key={year} style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                <button onClick={() => toggle(setOpenYears, year)} style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", background: T.flameD, border: "none", cursor: "pointer",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ChevronDown size={14} style={{ transform: yearOpen ? "none" : "rotate(-90deg)", transition: "transform .15s", color: T.flame }} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.flame }}>{year === "0000" ? "Sanasiz" : year}</span>
                    <span style={{ fontSize: 11.5, color: T.muted }}>({yearCount} ta)</span>
                  </span>
                  {yearSum !== null && (
                    <span className="mo" style={{ fontSize: 13, fontWeight: 700, color: yearSum >= 0 ? T.teal : T.red }}>{fmtSum(yearSum)}</span>
                  )}
                </button>
                {yearOpen && (
                  <div style={{ padding: "8px", display: "grid", gap: 8, background: T.s1 }}>
                    {months.map((month) => {
                      const monthOpen = openMonths.has(month);
                      const { count: monthCount, sum: monthSum } = countAndSum(tree[year][month]);
                      const days = Object.keys(tree[year][month]).sort((a, b) => b.localeCompare(a));
                      const monthLabel = year === "0000" ? "Sanasiz" : UZ_MONTHS[parseInt(month.slice(5, 7), 10) - 1];
                      return (
                        <div key={month} style={{ border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden" }}>
                          <button onClick={() => toggle(setOpenMonths, month)} style={{
                            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "10px 14px", background: T.goldD, border: "none", cursor: "pointer",
                          }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <ChevronDown size={12} style={{ transform: monthOpen ? "none" : "rotate(-90deg)", transition: "transform .15s", color: T.gold }} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{monthLabel}</span>
                              <span style={{ fontSize: 11, color: T.muted }}>({monthCount} ta)</span>
                            </span>
                            {monthSum !== null && (
                              <span className="mo" style={{ fontSize: 12.5, fontWeight: 700, color: monthSum >= 0 ? T.teal : T.red }}>{fmtSum(monthSum)}</span>
                            )}
                          </button>
                          {monthOpen && (
                            <div style={{ padding: "7px", display: "grid", gap: 7, background: T.s2 }}>
                              {days.map((day) => {
                                const dayOpen = openDays.has(day);
                                const dayRows = tree[year][month][day];
                                const daySum = sumRows(dayRows);
                                return (
                                  <div key={day} style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", background: T.s1 }}>
                                    <button onClick={() => toggle(setOpenDays, day)} style={{
                                      width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                                      padding: "9px 13px", background: T.s3, border: "none", cursor: "pointer",
                                    }}>
                                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <ChevronDown size={11} style={{ transform: dayOpen ? "none" : "rotate(-90deg)", transition: "transform .15s", color: T.muted }} />
                                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{day === "0000-00-00" ? "Sanasiz" : fmtDate(day)}</span>
                                        <span style={{ fontSize: 11, color: T.muted }}>({dayRows.length} ta)</span>
                                      </span>
                                      {daySum !== null && (
                                        <span className="mo" style={{ fontSize: 12, fontWeight: 700, color: daySum >= 0 ? T.teal : T.red }}>{fmtSum(daySum)}</span>
                                      )}
                                    </button>
                                    {dayOpen && (
                                      <div style={{ background: T.s1 }}>
                                        <Tbl cols={cols} rows={dayRows} pageSize={100} />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Oxirgi N kunlik tendensiyani ko'rsatuvchi mini-chiziq — tashqi kutubxonasiz,
// oddiy inline SVG. Qiymatlar musbat/manfiy bo'lishi mumkin (masalan kunlik sof foyda).
function Sparkline({ values, color }) {
  if (!values || values.length < 2) return null;
  const w = 60, h = 22, pad = 2;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

// Yuqori menyu tor ekranda gorizontal skroll bilan ko'rinadi — bu o'z-o'zidan
// ravshan bo'lmasligi mumkin. Shu sababli hali ko'rinmagan tugmalar borligini
// chetlarda xira "soya" bilan ko'rsatamiz (Gmail/Linear'dagi kabi).
function ScrollableTabs({ tabs, tab, setTab }) {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateFade = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    updateFade();
    window.addEventListener("resize", updateFade);
    return () => window.removeEventListener("resize", updateFade);
  }, [tabs.length]);

  return (
    <div style={{
      position: "sticky", top: 54, zIndex: 90,
      background: "rgba(255,255,255,.82)",
      backdropFilter: "blur(18px) saturate(160%)",
      WebkitBackdropFilter: "blur(18px) saturate(160%)",
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div ref={scrollRef} onScroll={updateFade} className="tabs-scroll" style={{ display: "flex", padding: "8px 20px", overflowX: "auto", gap: 4, scrollbarWidth: "none" }}>
        {tabs.map(({ id, label, Icon }) => {
          const a = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`tab-btn${a ? " active" : ""}`}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", border: "none", borderRadius: 8,
                cursor: "pointer", fontSize: 12.5, fontWeight: a ? 700 : 500,
                color: a ? T.flame : T.muted2,
                background: a ? T.flameD : "transparent",
                whiteSpace: "nowrap",
              }}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>
      {canLeft && <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 36,
        background: "linear-gradient(90deg, rgba(255,255,255,.95), rgba(255,255,255,0))", pointerEvents: "none",
      }} />}
      {canRight && <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 36,
        background: "linear-gradient(270deg, rgba(255,255,255,.95), rgba(255,255,255,0))", pointerEvents: "none",
      }} />}
    </div>
  );
}

function Stat({ label, value, sub, color, Icon, spark }) {
  return (
    <div className="card-shadow stat-card" style={{
      // Yuqoridan pastga juda nozik o'tish — tekis oq emas, "qatlamli" ko'rinadi
      background: `linear-gradient(180deg,#FFFFFF,${T.s2})`,
      border: `1px solid ${T.border}`, borderRadius: 14,
      padding: "16px 18px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: color,
      }} />
      {/* Rangli chiziqdan tarqaladigan zaif shu'la — arzon "rangli chiziq" hissini yo'qotadi */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 90,
        background: `linear-gradient(90deg, ${color}0F, transparent)`,
        pointerEvents: "none",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: ".09em",
          textTransform: "uppercase", color: T.muted, lineHeight: 1.4, paddingRight: 8,
        }}>{label}</span>
        {Icon && <div style={{
          background: color + "14", borderRadius: 8, padding: 6, display: "flex", flexShrink: 0,
        }}>
          <Icon size={13} color={color} />
        </div>}
      </div>
      <div className="mo bc" style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.1, letterSpacing: "-.01em" }}>{value}</div>
      {(sub || spark) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 5 }}>
          {sub && <div style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.4 }}>{sub}</div>}
          {spark && <Sparkline values={spark} color={color} />}
        </div>
      )}
    </div>
  );
}

function Card({ title, children, action, pad = true, accent }) {
  return (
    <div className="card-shadow" style={{
      background: T.s1, border: `1px solid ${T.border}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      {title && (
        <div style={{
          padding: "12px 18px", borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 12, minHeight: 46,
          background: `linear-gradient(180deg,${T.s2},${T.s3})`,
        }}>
          <span className="bc" style={{
            fontSize: 14.5, fontWeight: 700, letterSpacing: ".01em",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {accent && <span style={{ width: 3, height: 15, borderRadius: 99, background: accent, display: "inline-block" }} />}
            {title}
          </span>
          {action}
        </div>
      )}
      <div style={{ padding: pad ? "16px 18px" : 0 }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   IKKINCHI BOSQICH (2FA) — Google tasdiqlangandan keyingi shaxsiy PIN
═══════════════════════════════════════════════════ */
function TwoFactorPinScreen({ pending, onCancel, onSuccess }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockout, setLockout] = useState(() => getLockoutState());

  // Klaviatura tinglovchisi faqat bir marta o'rnatiladi (pastda [] bilan) — shuning
  // uchun press/submit shu yerdagi eng so'nggi digits/busy/lockout qiymatlarini emas,
  // stateRef.current orqali doim eng yangisini o'qishi kerak, aks holda ikkinchi
  // urinishda tugmalar bosilgani sezilmay qolardi (birinchi mount'dagi eski
  // qiymatlarga qarab ishlaydi).
  const stateRef = useRef({ digits, busy, lockout });
  stateRef.current = { digits, busy, lockout };

  useEffect(() => {
    const t = setInterval(() => setLockout(getLockoutState()), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      const s = stateRef.current;
      if (s.busy || s.lockout.locked) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setDigits((s) => s.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (s.digits.length >= 4) submit(s.digits);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function submit(pin) {
    if (stateRef.current.busy) return;
    const lo = getLockoutState();
    if (lo.locked) { setLockout(lo); setError("Juda ko'p urinish"); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pending.token}` },
        body: JSON.stringify({ pin, branchId: authClient.branchId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        clearPinAttempts();
        onSuccess(json.token, json.role, json.name);
        return;
      }
      recordFailedPinAttempt();
      setLockout(getLockoutState());
      setError(json.error || "PIN xato");
      setDigits("");
    } catch (e) {
      setError(String(e?.message || e));
      setDigits("");
    } finally {
      setBusy(false);
    }
  }

  function press(d) {
    const s = stateRef.current;
    if (s.digits.length >= 8 || s.busy || s.lockout.locked) return;
    const next = s.digits + d;
    setDigits(next);
    if (next.length >= 4) submit(next);
  }

  const lockRemainMin = lockout.locked ? Math.max(1, Math.ceil((lockout.until - Date.now()) / 60000)) : 0;

  return (
    <div style={{
      minHeight: "100vh", background: LOGIN_T.bg, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <GlobalStyles />
      <div style={{
        width: "100%", maxWidth: 340,
        background: `linear-gradient(160deg, ${LOGIN_T.s2}, ${LOGIN_T.s1})`,
        border: `1px solid ${LOGIN_T.flame}28`, borderRadius: 22,
        boxShadow: "0 30px 70px rgba(0,0,0,.5)", padding: "30px 30px 26px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <ShieldCheck size={26} color={LOGIN_T.flame} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 800, color: LOGIN_T.text }}>Ikkinchi bosqich</div>
          <div style={{ fontSize: 12, color: LOGIN_T.muted, marginTop: 4 }}>
            {pending.fullName || pending.email} — shaxsiy PIN kodingizni kiriting
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 11, marginBottom: 18, minHeight: 14 }}>
          {Array.from({ length: Math.max(4, digits.length) }).map((_, i) => (
            <span key={i} style={{
              width: 11, height: 11, borderRadius: "50%",
              background: error ? LOGIN_T.red : i < digits.length ? LOGIN_T.flame : "rgba(255,255,255,.14)",
            }} />
          ))}
        </div>

        {lockout.locked && (
          <p style={{ fontSize: 12, color: LOGIN_T.red, textAlign: "center", marginBottom: 14, fontWeight: 600 }}>
            Juda ko'p urinish. {lockRemainMin} daqiqadan keyin qayta urinib ko'ring.
          </p>
        )}
        {!lockout.locked && error && (
          <p style={{ fontSize: 12, color: LOGIN_T.red, textAlign: "center", marginBottom: 14, fontWeight: 600 }}>{error}</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11, marginBottom: 16 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} disabled={busy || lockout.locked} onClick={() => press(String(n))} style={{
              background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 15,
              color: LOGIN_T.text, fontSize: 21, fontWeight: 800, padding: "16px 0", cursor: "pointer",
            }} className="mo">{n}</button>
          ))}
          <button onClick={() => setDigits("")} style={{
            background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 15,
            color: LOGIN_T.muted2, fontSize: 15, fontWeight: 700, padding: "16px 0", cursor: "pointer",
          }}>C</button>
          <button disabled={busy || lockout.locked} onClick={() => press("0")} style={{
            background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 15,
            color: LOGIN_T.text, fontSize: 21, fontWeight: 800, padding: "16px 0", cursor: "pointer",
          }} className="mo">0</button>
          <button onClick={() => setDigits((s) => s.slice(0, -1))} style={{
            background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 15,
            color: LOGIN_T.muted2, padding: "16px 0", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><Delete size={18} /></button>
        </div>

        <button onClick={onCancel} style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          color: LOGIN_T.muted, fontSize: 11.5, fontWeight: 600, textDecoration: "underline",
        }}>
          Boshqa hisob bilan kirish
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LOGIN SCREEN
═══════════════════════════════════════════════════ */
function LoginScreen({ branchId, authError, onSuccess }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lockout, setLockout] = useState(() => getLockoutState());
  const [cbu, setCbu] = useState(null); // { rate, date } yoki null — CBU rasmiy kursi, faqat ma'lumot uchun
  const [now, setNow] = useState(() => new Date());
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Google hisobi bo'lmagan ofis xodimlari uchun — emailga kirish havolasi yuboriladi.
  async function handleEmailSignIn() {
    const email = emailInput.trim();
    if (!email) return;
    setEmailError("");
    setEmailBusy(true);
    try {
      const { error: otpError } = await authClient.signInWithEmail(email);
      if (otpError) setEmailError(otpError.message || "Havola yuborishda xato yuz berdi.");
      else setEmailSent(true);
    } catch (e) {
      setEmailError(String(e?.message || e));
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleError("");
    setGoogleBusy(true);
    try {
      const { error: signInError } = await authClient.signInWithGoogle();
      if (signInError) {
        setGoogleError(signInError.message || "Google orqali kirishda xato yuz berdi.");
        setGoogleBusy(false);
      }
      // Xato bo'lmasa — sahifa Google login sahifasiga yo'naltiriladi.
    } catch (e) {
      setGoogleError(String(e?.message || e));
      setGoogleBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cbu-rate").then((r) => r.json()).then((d) => {
      if (!cancelled && d && d.ok && d.rate) setCbu({ rate: d.rate, date: d.date });
    }).catch(() => {}); // tarmoq bo'lmasa — jim o'tamiz, PIN kiritishga xalaqit bermaydi
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      setLockout(getLockoutState());
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // PIN endi mahalliy ravishda solishtirilmaydi — /api/login orqali SERVERDA
  // tekshiriladi (usta/ta'minotchi/hamkor uchun; ofis xodimlari endi faqat
  // Google orqali kiradi). Bu /api/data'ning har qanday himoyasiz chaqirilishini
  // (masalan curl orqali) to'sadi, chunki server endi haqiqiy kredensial talab qiladi.
  async function checkPin(v) {
    if (busy) return;
    const lo = getLockoutState();
    if (lo.locked) {
      setLockout(lo);
      setError(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: v, branchId: authClient.branchId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        clearPinAttempts();
        authClient.setPinToken(json.token);
        setDigits(""); setError(false);
        onSuccess(json.role, json.name);
        return;
      }
      const next = recordFailedPinAttempt();
      setLockout(next);
      setError(true);
      setTimeout(() => { setDigits(""); setError(false); }, 450);
    } catch (e) {
      setError(true);
      setTimeout(() => { setDigits(""); setError(false); }, 450);
    } finally {
      setBusy(false);
    }
  }
  function press(d) {
    if (digits.length >= 4 || error || lockout.locked || busy) return;
    setDigits((s) => s + d);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (error) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setDigits((s) => s.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (digits.length >= 4) checkPin(digits);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [error, digits]);

  const OY_NOM = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const KUN_NOM = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
  const canEnter = !lockout.locked && !busy && digits.length === 4;
  const lockRemainMin = lockout.locked ? Math.max(1, Math.ceil((lockout.until - Date.now()) / 60000)) : 0;

  return (
    <div style={{ minHeight: "100vh", background: LOGIN_T.bg, display: "flex", position: "relative", overflow: "hidden" }}>
      <GlobalStyles />
      <style>{`
        .login-hero{position:relative;flex:1.15;display:flex;flex-direction:column;justify-content:space-between;
          padding:56px 64px;overflow:hidden;
          background:radial-gradient(circle at 18% 12%, ${LOGIN_T.flame}22, transparent 55%),
                     radial-gradient(circle at 82% 88%, ${LOGIN_T.teal}1c, transparent 50%),
                     linear-gradient(160deg, ${LOGIN_T.s1}, ${LOGIN_T.bg} 75%);
          border-right:1px solid ${LOGIN_T.border}}
        .login-hero-glow{position:absolute;border-radius:50%;filter:blur(130px);pointer-events:none;z-index:0}
        .login-hero-glow-1{width:480px;height:480px;background:${LOGIN_T.flame}26;top:-160px;left:-120px}
        .login-hero-glow-2{width:420px;height:420px;background:${LOGIN_T.teal}20;bottom:-140px;right:-100px}
        .login-hero-top{position:relative;z-index:1;display:flex;align-items:center;gap:7px}
        .login-hero-mid{position:relative;z-index:1}
        .login-hero-stats{position:relative;z-index:1;display:flex;gap:16px}
        .login-hero-stat{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
          border-radius:16px;padding:18px 20px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
        .login-side{flex:none;width:460px;display:flex;align-items:center;justify-content:center;
          padding:40px 20px;position:relative;z-index:2}
        .login-mobile-info{display:none}
        .login-mobile-logo{display:none}
        @media(max-width:960px){
          .login-hero{display:none}
          .login-side{width:100%}
          .login-mobile-logo{display:flex;justify-content:center;margin-bottom:20px}
          .login-mobile-info{display:flex;gap:10px;margin-bottom:18px}
        }
      `}</style>

      <div className="login-hero">
        <div className="login-hero-glow login-hero-glow-1" />
        <div className="login-hero-glow login-hero-glow-2" />
        <div className="login-hero-top">
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: LOGIN_T.teal, boxShadow: `0 0 9px ${LOGIN_T.teal}99` }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: LOGIN_T.muted2, letterSpacing: ".03em" }}>Tizim onlayn</span>
        </div>

        <div className="login-hero-mid" style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="bc" style={{ fontSize: 44, fontWeight: 800, color: LOGIN_T.text, lineHeight: 1.08, maxWidth: 480 }}>
              Xizmat boshqaruv paneli
            </h1>
            <p style={{ fontSize: 14.5, color: LOGIN_T.muted, fontWeight: 600, marginTop: 14, maxWidth: 420, lineHeight: 1.6 }}>
              Servis, moliya, ombor va mijozlar bilan ishlash uchun yagona tizim.
            </p>
          </div>
          <div style={{
            display: "inline-flex", flexShrink: 0, background: "#FBFAF8", borderRadius: 13, padding: "10px 15px",
            boxShadow: "0 10px 26px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.5)",
          }}>
            <img src="/logo.png" alt="AVTOGAZ" style={{ display: "block", height: 50, width: "auto" }} />
          </div>
        </div>

        <div className="login-hero-stats">
          <div className="login-hero-stat">
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: LOGIN_T.muted, marginBottom: 8 }}>
              Vaqt
            </div>
            <div className="mo" style={{ fontSize: 24, fontWeight: 800, color: LOGIN_T.text }}>
              {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
            </div>
            <div style={{ fontSize: 11, color: LOGIN_T.muted, fontWeight: 600, marginTop: 3 }}>
              {now.getDate()}-{OY_NOM[now.getMonth()]}, {KUN_NOM[now.getDay()]}
            </div>
          </div>
          <div className="login-hero-stat">
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: LOGIN_T.muted, marginBottom: 8 }}>
              CBU rasmiy kursi
            </div>
            {cbu ? (
              <>
                <div className="mo" style={{ fontSize: 24, fontWeight: 800, color: LOGIN_T.text }}>{fmtSum(cbu.rate)}</div>
                <div style={{ fontSize: 11, color: LOGIN_T.muted, fontWeight: 600, marginTop: 3 }}>1 USD · {cbu.date}</div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: LOGIN_T.muted, fontWeight: 600 }}>yuklanmoqda…</div>
            )}
          </div>
        </div>
      </div>

      <div className="login-side">
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div className="login-mobile-logo">
            <div style={{
              display: "inline-flex", background: "#FBFAF8", borderRadius: 12, padding: "9px 14px",
              boxShadow: "0 10px 24px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.5)",
            }}>
              <img src="/logo.png" alt="AVTOGAZ" style={{ display: "block", height: 26, width: "auto" }} />
            </div>
          </div>
          <div className="login-mobile-info">
            <div style={{ flex: 1, background: "rgba(255,255,255,.04)", border: `1px solid ${LOGIN_T.border}`, borderRadius: 14, padding: "10px 14px" }}>
              <div className="mo" style={{ fontSize: 16, fontWeight: 800, color: LOGIN_T.text }}>
                {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 10, color: LOGIN_T.muted, fontWeight: 600 }}>{now.getDate()}-{OY_NOM[now.getMonth()]}</div>
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,.04)", border: `1px solid ${LOGIN_T.border}`, borderRadius: 14, padding: "10px 14px" }}>
              <div className="mo" style={{ fontSize: 16, fontWeight: 800, color: LOGIN_T.text }}>{cbu ? fmtSum(cbu.rate) : "…"}</div>
              <div style={{ fontSize: 10, color: LOGIN_T.muted, fontWeight: 600 }}>1 USD kursi</div>
            </div>
          </div>

          <div style={{
            background: `linear-gradient(160deg, ${LOGIN_T.s2}, ${LOGIN_T.s1})`,
            backdropFilter: "blur(28px) saturate(140%)", WebkitBackdropFilter: "blur(28px) saturate(140%)",
            border: `1px solid ${LOGIN_T.flame}28`, borderRadius: 22,
            boxShadow: "0 30px 70px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.05)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "32px 30px 22px", textAlign: "center", position: "relative" }}>
              <div className="mo" style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: LOGIN_T.muted2, marginBottom: 6 }}>
                Xush kelibsiz
              </div>
              <div className="mo" style={{ fontSize: 10, fontWeight: 700, color: LOGIN_T.teal }}>{APP_VERSION}</div>
              {branchId !== "main" && (
                <div style={{
                  display: "inline-flex", marginTop: 10, padding: "4px 12px", borderRadius: 20,
                  background: `${LOGIN_T.flame}22`, border: `1px solid ${LOGIN_T.flame}40`,
                  fontSize: 11, fontWeight: 700, color: LOGIN_T.flame, letterSpacing: ".03em",
                }}>{BRANCH_LABELS[branchId] || branchId}</div>
              )}
            </div>

            <div style={{ padding: "22px 30px 0" }}>
              <button
                onClick={handleGoogleSignIn}
                disabled={googleBusy}
                style={{
                  width: "100%", padding: 13, borderRadius: 14, border: "1px solid rgba(255,255,255,.14)",
                  cursor: googleBusy ? "not-allowed" : "pointer", background: "rgba(255,255,255,.05)",
                  color: LOGIN_T.text, fontWeight: 700, fontSize: 13.5, fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
              >
                {googleBusy ? <Loader2 size={16} className="spin" /> : (
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20.5H24v7h11.3C33.7 32 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.3-.1-2.7-.4-3.5z" />
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.6 5.1 29.6 3 24 3c-7.7 0-14.4 4.3-17.7 11.7z" />
                    <path fill="#4CAF50" d="M24 45c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.6 35.6 26.9 37 24 37c-5.3 0-9.7-3.6-11.3-8.4l-6.7 5.2C9.5 40.6 16.2 45 24 45z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20.5H24v7h11.3c-.8 2.3-2.2 4.3-4.1 5.9l6.6 5.6C41.9 35.5 45 30.1 45 24c0-1.3-.1-2.7-.4-3.5z" />
                  </svg>
                )}
                Google orqali kirish (ofis xodimi)
              </button>
              {(googleError || authError) && (
                <p style={{ fontSize: 12, color: LOGIN_T.red, textAlign: "center", marginTop: 10, fontWeight: 600 }}>
                  {googleError || authError}
                </p>
              )}

              {!emailFormOpen ? (
                <button onClick={() => setEmailFormOpen(true)} style={{
                  display: "block", width: "100%", background: "none", border: "none", cursor: "pointer",
                  color: LOGIN_T.muted, fontSize: 11.5, fontWeight: 600, marginTop: 12, textDecoration: "underline",
                }}>
                  Google hisobim yo'q — email orqali kirish
                </button>
              ) : emailSent ? (
                <p style={{ fontSize: 12, color: LOGIN_T.teal, textAlign: "center", marginTop: 12, fontWeight: 600, lineHeight: 1.5 }}>
                  Havola <span className="mo">{emailInput}</span> manziliga yuborildi — emailingizni ochib, havolani bosing.
                </p>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="sizning@email.com" autoFocus
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${LOGIN_T.border2}`,
                      background: "rgba(255,255,255,.04)", color: LOGIN_T.text, fontSize: 13, marginBottom: 8,
                      fontFamily: "inherit", boxSizing: "border-box",
                    }} />
                  <button onClick={handleEmailSignIn} disabled={emailBusy || !emailInput.trim()} style={{
                    width: "100%", padding: 11, borderRadius: 10, border: "none",
                    cursor: emailBusy || !emailInput.trim() ? "not-allowed" : "pointer",
                    background: emailInput.trim() ? LOGIN_T.teal : "rgba(255,255,255,.06)",
                    color: emailInput.trim() ? "#fff" : LOGIN_T.muted, fontWeight: 700, fontSize: 13, fontFamily: "inherit",
                  }}>
                    {emailBusy ? "Yuborilmoqda..." : "Havola yuborish"}
                  </button>
                  {emailError && (
                    <p style={{ fontSize: 12, color: LOGIN_T.red, textAlign: "center", marginTop: 8, fontWeight: 600 }}>{emailError}</p>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: "18px 30px 30px" }}>
              <div style={{
                fontSize: 10.5, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase",
                color: LOGIN_T.flame, marginBottom: 18, display: "flex", alignItems: "center", gap: 9,
              }}>
                <span style={{ flex: 1, height: 1, background: `${LOGIN_T.flame}30` }} />
                Usta / ta'minotchi / hamkor / rahbar — PIN
                <span style={{ flex: 1, height: 1, background: `${LOGIN_T.flame}30` }} />
              </div>

              <div className={error ? "pulse" : ""} style={{
                display: "flex", justifyContent: "center", gap: 11, marginBottom: 22, minHeight: 14,
              }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <span key={i} style={{
                    width: 11, height: 11, borderRadius: "50%",
                    background: error ? LOGIN_T.red : i < digits.length ? LOGIN_T.flame : "rgba(255,255,255,.14)",
                    boxShadow: !error && i < digits.length ? `0 0 14px ${LOGIN_T.flame}A0` : "none",
                    transition: "background .15s, box-shadow .15s",
                  }} />
                ))}
              </div>
              {lockout.locked && (
                <p style={{ fontSize: 12, color: LOGIN_T.red, textAlign: "center", marginTop: -12, marginBottom: 16, fontWeight: 600 }}>
                  Juda ko'p urinish. {lockRemainMin} daqiqadan keyin qayta urinib ko'ring.
                </p>
              )}
              {!lockout.locked && error && (
                <p style={{ fontSize: 12, color: LOGIN_T.red, textAlign: "center", marginTop: -12, marginBottom: 16, fontWeight: 600 }}>
                  PIN noto'g'ri{lockout.attempts ? ` (${lockout.attempts}/5)` : ""}
                </p>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11, marginBottom: 16 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button key={n} onClick={() => press(String(n))} style={{
                    background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 15,
                    color: LOGIN_T.text, fontSize: 21, fontWeight: 800, padding: "16px 0", cursor: "pointer",
                    fontFamily: "inherit",
                  }} className="mo">{n}</button>
                ))}
                <button onClick={() => setDigits("")} style={{
                  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 15,
                  color: LOGIN_T.muted2, fontSize: 15, fontWeight: 700, padding: "16px 0", cursor: "pointer",
                }}>C</button>
                <button onClick={() => press("0")} style={{
                  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 15,
                  color: LOGIN_T.text, fontSize: 21, fontWeight: 800, padding: "16px 0", cursor: "pointer",
                }} className="mo">0</button>
                <button onClick={() => !error && setDigits((s) => s.slice(0, -1))} style={{
                  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 15,
                  color: LOGIN_T.muted2, padding: "16px 0", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><Delete size={18} /></button>
              </div>

              <button
                onClick={() => canEnter && checkPin(digits)}
                disabled={!canEnter}
                style={{
                  width: "100%", padding: 15, borderRadius: 14, border: "none", cursor: canEnter ? "pointer" : "not-allowed",
                  background: canEnter ? `linear-gradient(135deg, ${LOGIN_T.flame}, #BF360C)` : "rgba(255,255,255,.06)",
                  color: canEnter ? "#fff" : LOGIN_T.muted,
                  fontWeight: 800, fontSize: 14.5, letterSpacing: ".01em",
                  boxShadow: canEnter ? `0 10px 26px ${LOGIN_T.flame}45` : "none",
                }}
              >
                Kirish
              </button>
              <p style={{ fontSize: 10.5, color: LOGIN_T.muted, textAlign: "center", marginTop: 12, fontWeight: 600 }}>
                4 xonali shaxsiy kod — usta, ta'minotchi yoki hamkor uchun
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function SupplierPanelTab({ data, supplierName }) {
  const myStockIns = data.stockIns
    .filter((s) => s.sourceType !== "O'z mahsuloti" && sameName(s.supplier, supplierName))
    .sort((a, b) => b.date.localeCompare(a.date));
  const myOld = (data.oldSupplierDebts || []).filter((o) => sameName(o.name, supplierName));
  const totalSum = myStockIns.reduce((s, r) => s + num(r.totalSum), 0) + myOld.reduce((s, o) => s + num(o.amountSum), 0);
  const paidSum = myStockIns.reduce((s, r) => s + num(r.paidSum), 0) + myOld.reduce((s, o) => s + num(o.paidAmount || 0), 0);
  const debtSum = totalSum - paidSum;

  const myPayments = data.cashflow
    .filter((c) => c.category === "Ta'minotchiga to'lov" && sameName(c.supplier, supplierName))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>{supplierName}</h2>
        <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>Ta'minotchi kabineti — faqat ko'rish</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13, marginBottom: 20 }}>
        <Stat label="Jami yetkazilgan" value={fmtSum(totalSum)} color={T.blue} Icon={Package} />
        <Stat label="To'langan" value={fmtSum(paidSum)} color={T.teal} Icon={Wallet} />
        <Stat label="Qarz" value={fmtSum(debtSum)} color={debtSum > 0 ? T.red : T.teal} Icon={AlertTriangle} />
      </div>

      <Card title={`Yetkazib berish tarixi (${myStockIns.length})`} pad={false}>
        <Tbl
          empty="Hali yetkazmagansiz"
          cols={[
            { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
            { k: "productName", h: "Mahsulot" },
            { k: "qty", h: "Miqdor", r: (r) => `${r.qty} ${r.unit}` },
            { k: "totalSum", h: "Jami", r: (r) => fmtSum(r.totalSum) },
            { k: "paidSum", h: "To'landi", r: (r) => <span style={{ color: T.teal }}>{fmtSum(r.paidSum)}</span> },
            { k: "debt", h: "Qarz", r: (r) => { const d = num(r.totalSum) - num(r.paidSum); return <span style={{ color: d > 0 ? T.red : T.teal, fontWeight: 600 }}>{fmtSum(d)}</span>; } },
          ]}
          rows={myStockIns}
        />
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title={`To'lov tarixi (${myPayments.length})`} pad={false}>
          <Tbl
            empty="To'lov yo'q"
            cols={[
              { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
              { k: "amountSum", h: "Summa", r: (r) => <span style={{ color: T.teal, fontWeight: 600 }}>{fmtSum(r.amountSum)}</span> },
              { k: "paymentType", h: "Usul", r: (r) => r.paymentType || "—" },
            ]}
            rows={myPayments}
          />
        </Card>
      </div>
    </div>
  );
}

function PartnerPanelTab({ data, partnerId }) {
  const partner = data.partners.find((p) => p.id === partnerId);
  const myTx = (data.partnerTx || [])
    .filter((t) => t.partnerId === partnerId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const given = myTx.filter((t) => t.type === "mahsulot").reduce((s, t) => s + num(t.amountSum), 0);
  const paid = myTx.filter((t) => t.type === "tolov").reduce((s, t) => s + num(t.amountSum), 0);
  const debtSum = given - paid;
  const myBonuses = (data.bonusAwards || []).filter((a) => a.partnerId === partnerId);

  if (!partner) return <p style={{ color: T.muted, fontSize: 13 }}>Hamkor topilmadi.</p>;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>{partner.name}</h2>
        <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>Hamkor kabineti — faqat ko'rish</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13, marginBottom: 20 }}>
        <Stat label="Olingan" value={fmtSum(given)} color={T.purple} Icon={Handshake} />
        <Stat label="To'langan" value={fmtSum(paid)} color={T.teal} Icon={Wallet} />
        <Stat label="Qarz" value={fmtSum(debtSum)} color={debtSum > 0 ? T.red : T.teal} Icon={AlertTriangle} />
      </div>

      {myBonuses.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Card title={`Bonuslar (${myBonuses.length})`}>
            <div style={{ display: "grid", gap: 8 }}>
              {myBonuses.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.s3, borderRadius: 8, padding: "9px 13px" }}>
                  <span style={{ fontSize: 12.5 }}>{a.productName} — <span style={{ color: T.gold, fontWeight: 600 }}>{a.bonusText}</span></span>
                  <Badge color={a.claimed ? T.teal : T.gold}>{a.claimed ? "Olingan" : "Kutilmoqda"}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Card title={`Harakatlar tarixi (${myTx.length})`} pad={false}>
        <Tbl
          empty="Hali harakat yo'q"
          cols={[
            { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
            { k: "type", h: "Turi", r: (r) => <Badge color={r.type === "mahsulot" ? T.blue : T.teal}>{r.type === "mahsulot" ? "Mahsulot olindi" : "To'lov"}</Badge> },
            { k: "name", h: "Tafsilot", r: (r) => r.type === "mahsulot" ? `${r.name} x${r.qty}` : (r.paymentType || "—") },
            { k: "amountSum", h: "Summa", r: (r) => <span className="mo" style={{ fontWeight: 600, color: r.type === "mahsulot" ? T.text : T.teal }}>{fmtSum(r.amountSum)}</span> },
          ]}
          rows={myTx}
        />
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════ */
const LOCAL_BACKUP_KEY_BASE = "avtogaz-v2-local-backup";
// Bir xil brauzerda ikkala filial ham ochilishi mumkin (masalan Azim ikkalasini ham
// boshqaradi) — localStorage butun saytga UMUMIY bo'lgani uchun, kalitga filial nomini
// qo'shmasak, filial2'ni ochganda bosh filialning lokal zaxirasi noto'g'ri ishlatilib
// qolardi (yoki aksincha).
function localBackupKey() { return `${LOCAL_BACKUP_KEY_BASE}-${authClient.branchId}`; }

function saveLocalBackup(data) {
  try { localStorage.setItem(localBackupKey(), JSON.stringify({ data, savedAt: Date.now() })); }
  catch (e) { /* localStorage to'liq bo'lishi mumkin, jim o'tamiz */ }
}

function loadLocalBackup() {
  try {
    const raw = localStorage.getItem(localBackupKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed || null; // {data, savedAt} ni to'liq qaytaramiz
  } catch (e) { return null; }
}

function isValidData(p) {
  return p && typeof p === "object" && Array.isArray(p.products) && Array.isArray(p.serviceCards);
}

export default function App({ branchId = "main" }) {
  // Har bir filial (branch) — Supabase'da mustaqil qatorga ega. authClient
  // shu qiymatni saqlab, storage/login/2FA/staff so'rovlariga qo'shib yuboradi
  // (App() qayta chaqirilganda ham xavfsiz — shunchaki qiymatni yangilaydi).
  authClient.setBranchId(branchId);

  const [data, setData] = useState(emptyData());
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error | conflict
  const [tab, setTab] = useState("dashboard");
  const [role, setRole] = useState(null);
  const [ustaName, setUstaName] = useState(null); // usta rolida kim ekanini bilish uchun (sessiya doirasida)
  const [supplierName, setSupplierName] = useState(null); // taminotchi rolida kim ekanini bilish uchun
  const [partnerId, setPartnerId] = useState(null); // hamkor rolida kim ekanini bilish uchun
  const [dataSource, setDataSource] = useState(null); // "server" | "local" | "empty"
  const [dataVersion, setDataVersion] = useState(0); // optimistic lock
  const [authChecked, setAuthChecked] = useState(false); // mavjud Google sessiyasi tekshirilib bo'ldimi
  const [authError, setAuthError] = useState(""); // Google orqali kirgan, lekin staff'da yo'q, va sh.k.
  const [pending2FA, setPending2FA] = useState(null); // Google tasdiqlandi, lekin shaxsiy PIN hali kiritilmagan
  const saveTimer = useRef(null);
  const retryCount = useRef(0);
  const dataVersionRef = useRef(0);
  const dataFetchStarted = useRef(false);

  // ── AVTORIZATSIYA: sahifa ochilganda mavjud Google sessiyasi bor-yo'qligini tekshiramiz.
  // PIN orqali kirish (usta/ta'minotchi/hamkor) shu tekshiruvga bog'liq emas — u har doim
  // LoginScreen'dan /api/login orqali amalga oshadi.
  useEffect(() => {
    (async () => {
      try {
        const session = await authClient.getGoogleSession();
        if (session?.access_token) {
          const res = await fetch(`/api/whoami?branchId=${encodeURIComponent(authClient.branchId)}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const json = await res.json().catch(() => ({}));
          if (json.ok) {
            if (json.requiresPin) {
              setPending2FA({ token: session.access_token, role: json.role, email: json.email, fullName: json.fullName });
            } else {
              setRole(json.role);
            }
          } else {
            await authClient.signOutGoogle();
            setAuthError(json.error || "Ruxsat yo'q");
          }
        }
      } catch (e) {
        console.error("Avtorizatsiyani tekshirish xatosi:", e);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  // ── YUKLASH: server va lokal zaxirani solishtirib, eng so'nggisini olamiz ──
  // Faqat kirish muvaffaqiyatli bo'lgandan keyin (role o'rnatilgandan keyin) ishga tushadi —
  // /api/data endi kredensial talab qiladi, shuning uchun kirishdan oldin so'rov yuborishning
  // ma'nosi yo'q. Bir marta ishga tushgandan keyin qayta ishga tushmaydi (masalan chiqib qayta
  // kirilganda) — bu avvalgi xulq-atvor bilan bir xil.
  useEffect(() => {
    if (!role || dataFetchStarted.current) return;
    dataFetchStarted.current = true;
    (async () => {
      let serverPayload = null; // {data, savedAt}
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          const ver = Number(res.version || 0);
          // Eski format (to'g'ridan-to'g'ri data) yoki yangi format ({data, savedAt}) bo'lishi mumkin
          if (parsed && parsed.data && parsed.savedAt) {
            if (isValidData(parsed.data)) serverPayload = { ...parsed, _version: ver };
          } else if (isValidData(parsed)) {
            serverPayload = { data: parsed, savedAt: 0, _version: ver };
          }
        }
      } catch (e) {
        console.error("Server yuklash xatosi:", e);
      }

      const localPayload = loadLocalBackup(); // {data, savedAt} yoki null

      // MUHIM: "savedAt" har bir qurilmaning O'Z SOATIGA qarab yozilgan client vaqt belgisi —
      // ikki xil qurilma orasida solishtirib bo'lmaydi (soatlar farq qilishi mumkin). Avval bu
      // yerda "vaqti kattarog'i" solishtirilgan edi — bu haqiqiy xatoga olib kelgan: bir qurilma
      // o'zining ESKI lokal nusxasini SERVERdagi yangi ma'lumotdan "yangiroq" deb hisoblab,
      // ko'rsatib qolgan (va keyin uni serverga qayta yozib, boshqa qurilmaning yangilanishini
      // yo'qotish xavfi tug'dirgan). Shuning uchun: server — yagona haqiqat manbai; server
      // muvaffaqiyatli o'qilsa, HAR DOIM u ishlatiladi. Lokal nusxa faqat serverga umuman
      // ulanib bo'lmagan holatda (masalan internet yo'q) zaxira sifatida ishlatiladi.
      let chosen = null, source = "empty";
      if (serverPayload) {
        chosen = serverPayload.data; source = "server";
      } else if (localPayload) {
        chosen = localPayload.data; source = "local";
      }

      if (chosen) {
        const savedExtraCodes = (chosen.settings || {}).extraAdminCodes;
        // Eski bazadagi "admin" PIN kalitini "rahbar"ga ko'chiramiz.
        // Aks holda 0610 bilan kirilganda hech qanday bo'lim ochilmaydi (o'lik rol).
        const savedPins = { ...((chosen.settings || {}).pins || {}) };
        if (savedPins.admin && !savedPins.rahbar) savedPins.rahbar = savedPins.admin;
        delete savedPins.admin;
        // Eski bazada saqlangan umumiy "usta" PIN'ini butunlay bekor qilamiz — u orqali
        // istalgan usta nomini tanlab boshqa ustaning ma'lumotini ko'rish mumkin edi.
        delete savedPins.usta;

        setData({
          ...emptyData(), ...chosen,
          settings: {
            ...emptyData().settings, ...(chosen.settings || {}),
            pins: { ...emptyData().settings.pins, ...savedPins },
            extraAdminCodes: (savedExtraCodes && savedExtraCodes.length > 0)
              ? savedExtraCodes
              : emptyData().settings.extraAdminCodes,
          },
        });
        // Har ikkala joyga ham eng yangi holatni yozib qo'yamiz — sinxronlashtirish
        saveLocalBackup(chosen);
        // MUHIM: versiya har doim SERVERdagi haqiqiy raqamdan olinishi kerak — "source"
        // qaysi kontent ko'rsatilishini tanlaydi (mahalliy nusxa serverdan yangi bo'lsa,
        // mahalliy ko'rsatiladi), lekin bu versiya hisobiga ta'sir qilmasligi kerak.
        // Aks holda: konflikt paytida "Yangilash" bosilganda mahalliy nusxa (yangiroq
        // vaqt tamg'asi bilan) tanlanadi-yu, versiya notoʻgʻri 0 ga tushib qoladi — va
        // keyingi saqlash yana serverning haqiqiy versiyasiga mos kelmay, foydalanuvchi
        // hech qachon saqlay olmaydigan holatga tushib qolishi mumkin edi.
        const ver = Number((serverPayload && serverPayload._version) || 0);
        dataVersionRef.current = ver;
        setDataVersion(ver);
      }
      setDataSource(source);
      setLoaded(true);
    })();
  }, [role]);

  // ── SAQLASH: har o'zgarishda darhol lokal, keyin serverga (retry bilan) ──
  useEffect(() => {
    if (!loaded) return;
    saveLocalBackup(data); // HAR DOIM darhol lokalga — bu hech qachon yo'qolmaydi

    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToServer(data), 500);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded]);

  async function saveToServer(payload, attempt = 0) {
    setSaveState("saving");
    try {
      // Optimistic lock: kutilgan version yuboriladi — boshqa qurilma yozgan bo'lsa CONFLICT
      const res = await storage.set(
        STORAGE_KEY,
        JSON.stringify({ data: payload, savedAt: Date.now() }),
        { expectedVersion: dataVersionRef.current }
      );
      if (res && res.version != null) {
        dataVersionRef.current = res.version;
        setDataVersion(res.version);
      }
      setSaveState("saved");
      retryCount.current = 0;
    } catch (e) {
      console.error("Saqlash xatosi:", e);
      if (e && (e.code === "CONFLICT" || String(e.message || "").includes("CONFLICT"))) {
        setSaveState("conflict");
        // Foydalanuvchiga: boshqa qurilma yangilagan — qayta yuklash kerak
        return;
      }
      if (attempt < 2) {
        setTimeout(() => saveToServer(payload, attempt + 1), 1200 * (attempt + 1));
      } else {
        setSaveState("error");
        retryCount.current += 1;
      }
    }
  }

  // Xavfsizlik uchun himoya: "usta" roliga hech qachon ism tanlamasdan kirib bo'lmasligi kerak
  // (usta faqat shaxsiy kodi bilan kiradi, va u kod ismni avtomatik beradi). Agar biror sabab bilan
  // shu holatga tushib qolinsa — kirishni bekor qilib, login ekraniga qaytaramiz.
  useEffect(() => {
    if (role === "usta" && !ustaName) setRole(null);
    if (role === "taminotchi" && !supplierName) setRole(null);
    if (role === "hamkor" && !partnerId) setRole(null);
  }, [role, ustaName, supplierName, partnerId]);

  const patch = useCallback((fn) => setData((d) => {
    const before = d;
    const next = fn(JSON.parse(JSON.stringify(d)));
    const diffLines = summarizeAuditDiff(before, next);
    if (diffLines.length) {
      const actor = ustaName || supplierName || partnerId || role || "noma'lum";
      const newEntries = diffLines.map((note) => ({ id: uid(), ts: Date.now(), actor, note }));
      next.auditLog = [...(next.auditLog || []), ...newEntries].slice(-300);
    }
    return next;
  }), [role, ustaName, supplierName, partnerId]);
  const rate = data.settings.usdRate || 12650;

  const allTabs = [
    { id: "dashboard", label: "Bosh sahifa",  Icon: Zap,        roles: ["azim", "kassir"] },
    { id: "callcenter",label: "Qo'ng'iroqlar", Icon: PhoneCall,  roles: ["azim", "kassir"] },
    { id: "services",  label: "Kartalar",      Icon: Car,        roles: ["azim", "kassir", "usta", "rahbar", "sklad"] },
    { id: "warehouse", label: "Sklad",         Icon: Package,    roles: ["azim", "kassir", "rahbar"] },
    { id: "cashier",   label: "Kassa",         Icon: Wallet,     roles: ["azim", "kassir", "rahbar"] },
    { id: "ustalar",   label: "Usta hisobi",   Icon: Wrench,     roles: ["azim", "kassir", "usta", "rahbar"] },
    { id: "warranty",  label: "Kafolat",       Icon: ShieldCheck,roles: ["azim", "kassir"] },
    { id: "complaints", label: "Shikoyatlar",  Icon: AlertTriangle, roles: ["azim", "rahbar"] },
    { id: "partners",  label: "Hamkorlar",     Icon: Handshake,  roles: ["azim", "kassir"] },
    { id: "employees", label: "Xodimlar",      Icon: Users,      roles: ["azim"] },
    { id: "debtbook",  label: "Qarz daftari",   Icon: BookOpen,   roles: ["azim", "kassir", "rahbar"] },
    { id: "analytics", label: "Analitika",     Icon: BarChart3,  roles: ["azim", "rahbar"] },
    { id: "rahbarpanel", label: "Rahbar paneli", Icon: Star,     roles: ["azim", "rahbar"] },
    { id: "taminotchipanel", label: "Mening hisobim", Icon: Package,   roles: ["taminotchi"] },
    { id: "hamkorpanel",     label: "Mening hisobim", Icon: Handshake, roles: ["hamkor"] },
  ];
  const tabs = allTabs.filter((t) => role && t.roles.includes(role));

  useEffect(() => {
    if (role && tabs.length && !tabs.some((t) => t.id === tab)) setTab(tabs[0].id);
  }, [role]);

  if (!authChecked)
    return (
      <div style={{
        minHeight: "100vh", background: T.bg, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <GlobalStyles />
        <Loader2 size={30} color={T.flame} className="spin" />
      </div>
    );

  if (pending2FA) return (
    <TwoFactorPinScreen
      pending={pending2FA}
      onCancel={async () => {
        await authClient.signOutGoogle();
        setPending2FA(null);
      }}
      onSuccess={(token, role, name) => {
        authClient.setPinToken(token);
        setPending2FA(null);
        setRole(role);
      }}
    />
  );

  if (!role) return (
    <LoginScreen
      branchId={branchId}
      authError={authError}
      onSuccess={(r, name) => {
        setAuthError("");
        setRole(r);
        if (r === "usta") setUstaName(name);
        else if (r === "taminotchi") setSupplierName(name);
        else if (r === "hamkor") setPartnerId(name);
      }}
    />
  );

  if (!loaded)
    return (
      <div style={{
        minHeight: "100vh", background: T.bg, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <GlobalStyles />
        <Loader2 size={30} color={T.flame} className="spin" />
      </div>
    );

  // Yuqoridagi useEffect bu holatni darhol bekor qiladi (login ekraniga qaytaradi) —
  // bu yerda faqat o'sha bir lahzalik oraliqda bo'sh/insecure interfeys ko'rinmasligi uchun.
  if ((role === "usta" && !ustaName) || (role === "taminotchi" && !supplierName) || (role === "hamkor" && !partnerId)) {
    return (
      <div style={{
        minHeight: "100vh", background: T.bg, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <GlobalStyles />
        <Loader2 size={30} color={T.flame} className="spin" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
      <GlobalStyles />

      {/* HEADER */}
      <header style={{
        background: "rgba(255,255,255,.82)",
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
        borderBottom: `1px solid ${T.border}`,
        padding: "0 20px", height: 54, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: T.shHead,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            background: "#FBFAF8", borderRadius: 8, padding: "5px 9px",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${T.border}`,
            boxShadow: T.sh1, flexShrink: 0,
          }}><img src="/logo.png" alt="AVTOGAZ" style={{ display: "block", height: 15, width: "auto" }} /></div>
          <div>
            <div className="bc" style={{
              fontSize: 11, fontWeight: 800, letterSpacing: ".08em", lineHeight: 1,
              display: "flex", alignItems: "center", gap: 8, color: T.muted2,
              textTransform: "uppercase",
            }}>
              Xizmat paneli
              <span className="mo" style={{
                fontSize: 9, fontWeight: 700, color: T.teal, background: T.tealD,
                border: `1px solid ${T.teal}35`, borderRadius: 5, padding: "2px 6px",
                letterSpacing: 0,
              }}>{APP_VERSION}</span>
              {branchId !== "main" && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: T.flame, background: T.flameD,
                  border: `1px solid ${T.flame}35`, borderRadius: 5, padding: "2px 6px",
                  letterSpacing: 0, textTransform: "none",
                }}>{BRANCH_LABELS[branchId] || branchId}</span>
              )}
            </div>
            <div style={{ fontSize: 9.5, color: T.muted, letterSpacing: ".1em", fontWeight: 600, marginTop: 2 }}>
              {(role === "usta" && ustaName ? ustaName.toUpperCase()
                : role === "taminotchi" && supplierName ? supplierName.toUpperCase()
                : role === "hamkor" && partnerId ? (data.partners.find((p) => p.id === partnerId)?.name || "HAMKOR").toUpperCase()
                : ROLE_LABELS[role]?.toUpperCase() || "—")} · {fmtDate(todayISO())}
            </div>
          </div>
          {role === "rahbar" && (
            <span title="Rahbar rejimi — ma'lumotlarni faqat kuzatish mumkin" style={{
              fontSize: 10, fontWeight: 700, color: T.blue, background: T.blueD || T.s3,
              border: `1px solid ${T.blue}40`, padding: "4px 10px", borderRadius: 20,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <ShieldCheck size={11} /> <span className="hide-sm">Kuzatuv rejimi</span>
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {dataSource === "local" && (
            <span title="Serverdan yuklab bo'lmadi — mahalliy zaxiradan tiklandi" style={{
              fontSize: 10, color: T.gold, display: "flex", alignItems: "center", gap: 4,
              background: T.goldD, padding: "4px 9px", borderRadius: 20, fontWeight: 600,
            }}>
              <AlertTriangle size={10} /> <span className="hide-sm">Lokal zaxira</span>
            </span>
          )}

          <span style={{
            fontSize: 10.5, fontWeight: 600, color: T.muted,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            {saveState === "saving" && <><Loader2 size={11} className="spin" color={T.gold} /> <span className="hide-sm" style={{ color: T.gold }}>Saqlanmoqda</span></>}
            {(saveState === "saved" || saveState === "idle") && <><Check size={11} color={T.teal} /> <span className="hide-sm" style={{ color: T.teal }}>Saqlangan</span></>}
            {saveState === "error" && <><AlertTriangle size={11} color={T.red} /> <span className="hide-sm" style={{ color: T.red }}>Saqlanmadi</span></>}
            {saveState === "conflict" && <><AlertTriangle size={11} color={T.gold} /> <span className="hide-sm" style={{ color: T.gold }}>Konflikt — qayta yuklang</span></>}
          </span>

          <button
            onClick={() => saveToServer(data)}
            type="button"
            className="btn"
            title="Ma'lumotlarni serverga saqlash"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 13px", borderRadius: 9, border: "none", cursor: "pointer",
              background: saveState === "error"
                ? `linear-gradient(180deg,#E4292B,${T.red} 55%,#B71C1C)`
                : `linear-gradient(180deg,#12A08F,${T.teal} 55%,#0A7466)`,
              color: "#fff", fontSize: 12, fontWeight: 700,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,.22), 0 2px 4px rgba(62,50,30,.10), 0 4px 12px ${saveState === "error" ? T.red : T.teal}33`,
            }}
          >
            {saveState === "saving"
              ? <Loader2 size={13} className="spin" />
              : <Save size={13} />}
            <span className="hide-sm">{saveState === "error" ? "Qayta saqlash" : "Saqlash"}</span>
          </button>

          <div style={{ width: 1, height: 22, background: T.border }} className="hide-sm" />

          <HeaderMenu
            role={role} rate={rate} patch={patch} data={data} branchId={branchId}
            onImport={(p) => {
              const next = { ...emptyData(), ...p, settings: { ...emptyData().settings, ...(p.settings || {}) } };
              const actor = ustaName || supplierName || partnerId || role || "noma'lum";
              next.auditLog = [
                ...(data.auditLog || []),
                { id: uid(), ts: Date.now(), actor, note: `JSON import qilindi — HAMMA MA'LUMOT ALMASHTIRILDI (${(p.cashflow || []).length} kassa yozuvi, ${(p.serviceCards || []).length} karta)` },
              ].slice(-300);
              setData(next);
              saveLocalBackup(next);
            }}
            onResetAll={() => {
              const fresh = emptyData();
              const actor = ustaName || supplierName || partnerId || role || "noma'lum";
              fresh.auditLog = [{ id: uid(), ts: Date.now(), actor, note: "Butun tizim tozalandi (reset)" }];
              setData(fresh);
              saveLocalBackup(fresh);
              saveToServer(fresh);
            }}
          />

          <Btn variant="ghost" size="sm" onClick={() => {
            // rahbar endi ham PIN, ham Google/email orqali kirishi mumkin — ikkisini ham tozalaymiz.
            authClient.signOutGoogle();
            authClient.clearPinToken();
            setRole(null); setUstaName(null); setSupplierName(null); setPartnerId(null);
          }} style={{ color: T.red }}>
            <LogOut size={13} />
          </Btn>
        </div>
      </header>

      {/* TABS */}
      <ScrollableTabs tabs={tabs} tab={tab} setTab={setTab} />

      {/* CONTENT */}
      <div key={tab} style={{ padding: "24px 20px 56px", maxWidth: 1400, margin: "0 auto" }} className="fi">
        {tab === "dashboard"  && <DashboardTab  data={data} patch={patch} rate={rate} setTab={setTab} />}
        {tab === "callcenter" && <CallCenterTab data={data} patch={patch} />}
        {tab === "services"   && <ServicesTab   data={data} patch={patch} rate={rate} role={role} ustaName={ustaName} saveState={saveState} />}
        {tab === "warehouse"  && <WarehouseTab  data={data} patch={patch} rate={rate} role={role} />}
        {tab === "cashier"    && <CashierTab    data={data} patch={patch} rate={rate} readOnly={role === "rahbar"} />}
        {tab === "ustalar"    && <UstaTab       data={data} patch={patch} rate={rate} canManage={role === "azim" || role === "kassir"} ustaName={ustaName} />}
        {tab === "warranty"   && <WarrantyTab   data={data} patch={patch} rate={rate} />}
        {tab === "complaints" && <ComplaintsTab data={data} patch={patch} />}
        {tab === "partners"   && <PartnersTab   data={data} patch={patch} rate={rate} />}
        {tab === "employees"  && <EmployeesTab  data={data} patch={patch} rate={rate} />}
        {tab === "debtbook"   && <DebtBookTab   data={data} patch={patch} rate={rate} readOnly={role === "rahbar"} />}
        {tab === "analytics"  && <AnalyticsTab  data={data} patch={patch} rate={rate} readOnly={role === "rahbar"} />}
        {tab === "rahbarpanel" && <RahbarPanelTab data={data} patch={patch} rate={rate} />}
        {tab === "taminotchipanel" && <SupplierPanelTab data={data} supplierName={supplierName} />}
        {tab === "hamkorpanel" && <PartnerPanelTab data={data} partnerId={partnerId} />}
      </div>
      <ConfirmHost />
      {saveState === "conflict" && (
        <div style={{
          // Tab lentasi endi "yopishqoq" (sticky) — xabar uning ostidan chiqadi
          position: "fixed", top: 116, left: "50%", transform: "translateX(-50%)", zIndex: 180,
          background: T.s1, border: `1px solid ${T.gold}60`, borderRadius: 12,
          boxShadow: T.shPop,
          padding: "11px 15px", display: "flex", gap: 10, alignItems: "center",
          maxWidth: "calc(100vw - 32px)",
        }} className="fi">
          <AlertTriangle size={14} color={T.gold} />
          <span style={{ fontSize: 12.5 }}>Boshqa qurilma ma'lumotni yangilagan. Yangilash uchun sahifani qayta yuklang.</span>
          <Btn size="sm" variant="ghost" onClick={() => window.location.reload()}>Yangilash</Btn>
        </div>
      )}
    </div>
  );
}

function Placeholder({ label }) {
  return (
    <div style={{ padding: "70px 20px", textAlign: "center", color: T.muted }}>
      <Wrench size={38} color={T.border2} style={{ marginBottom: 14 }} />
      <div className="bc" style={{ fontSize: 19, fontWeight: 700, color: T.muted2, marginBottom: 6 }}>
        {label}
      </div>
      <p style={{ fontSize: 13 }}>Bu bo'lim 2-qismda qo'shiladi</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DASHBOARD — 1 EKRAN
═══════════════════════════════════════════════════ */
function DashboardTab({ data, patch, rate, setTab }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [closeDayOpen, setCloseDayOpen] = useState(false);

  const todayCards = data.serviceCards.filter((c) => c.date === todayISO());
  const openCards = data.serviceCards.filter((c) => cardStatus(c) === "ochiq");
  const todayCF = data.cashflow.filter((c) => c.date === todayISO());
  const isCashEntry = (c) => c.paymentType !== "Karta (Click/Payme)" && c.paymentType !== "Nasiya (qarzga)";
  const todayIncome = todayCF.filter((c) => c.type === "kirim" && isCashEntry(c)).reduce((s, c) => s + num(c.amountSum), 0);
  const todayExpense = todayCF.filter((c) => c.type === "chiqim" && isCashEntry(c)).reduce((s, c) => s + num(c.amountSum), 0);

  // "Kassa balansi" Kassa bo'limidagi "Kassadagi SO'M" bilan bir xil bo'lishi uchun
  // faqat SO'M valyutasidagi yozuvlarni oladi (USD alohida "Kassadagi USD" sifatida
  // ko'rsatiladi, bu yerga qo'shilmaydi) va valyuta ayirboshlashning SO'M balansiga
  // ta'sirini hisobga oladi.
  const allIncome = data.cashflow.filter((c) => c.type === "kirim" && isCashEntry(c) && c.currency !== "USD").reduce((s, c) => s + num(c.amountSum), 0);
  const allExpense = data.cashflow.filter((c) => c.type === "chiqim" && isCashEntry(c) && c.currency !== "USD").reduce((s, c) => s + num(c.amountSum), 0);
  const dashExchanges = data.currencyExchanges || [];
  const dashExchangeSumNet = dashExchanges.reduce((s, e) => s + (e.direction === "usd_to_sum" ? num(e.sumAmount) : -num(e.sumAmount)), 0);
  const kassaBalance = allIncome - allExpense + dashExchangeSumNet;

  const ustaPending = ustaPendingByName(data);
  const ustaPendingTotal = ustaPending.reduce((s, u) => s + u.amountSum, 0);

  const waitingLeads = (data.leads || []).filter((l) => l.stage === "birinchi" || l.stage === "nedozvon" || l.stage === "kelishildi");
  const supDebt = supplierDebts(data).reduce((s, d) => s + Math.max(0, d.debtSum), 0);
  const pendingConfirmCards = data.serviceCards.filter((c) => c.pendingConfirm && cardStatus(c) === "ochiq");

  // Oxirgi 7 kunlik sof kassa harakati (kunlik kirim - chiqim, naqd, SO'M) — "Kassa balansi"
  // ostidagi mini-grafik uchun. Faqat trend ko'rsatish maqsadida, aniq hisob emas.
  const last7Net = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const dayCF = data.cashflow.filter((c) => c.date === iso && isCashEntry(c) && c.currency !== "USD");
    const inc = dayCF.filter((c) => c.type === "kirim").reduce((s, c) => s + num(c.amountSum), 0);
    const exp = dayCF.filter((c) => c.type === "chiqim").reduce((s, c) => s + num(c.amountSum), 0);
    return inc - exp;
  });

  const attentionItems = [
    pendingConfirmCards.length > 0 && {
      text: `${pendingConfirmCards.length} ta usta ochgan karta tasdiq kutmoqda`,
      color: T.purple, onClick: () => setTab("services"),
    },
    supDebt > 0 && {
      text: `Ta'minotchiga ${fmtSum(supDebt)} qarz bor`,
      color: T.red, onClick: () => setTab("debtbook"),
    },
    waitingLeads.length > 0 && {
      text: `${waitingLeads.length} ta mijoz javob kutmoqda`,
      color: T.gold, onClick: () => setTab("callcenter"),
    },
  ].filter(Boolean);

  function closeDay() {
    patch((d) => {
      const groups = ustaPendingByName(d);
      d.ustaLedger.forEach((e) => { if (!e.paid) e.paid = true; });
      groups.forEach((g) => {
        d.cashflow.unshift({
          id: uid(), date: todayISO(), type: "chiqim", category: "Usta xizmat haqi",
          currency: "SUM", amount: g.amountSum, amountSum: g.amountSum, amountUsd: g.amountSum / rate,
          note: `${g.usta} — kun yakunida to'landi (${g.count} ta xizmat)`,
        });
      });
      return d;
    });
    setCloseDayOpen(false);
  }

  return (
    <div>
      {/* QUICK ACTIONS */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Btn size="lg" onClick={() => setQuickOpen(true)}>
          <Plus size={17} /> Yangi karta ochish
        </Btn>
        <Btn size="lg" variant="ghost" onClick={() => setCallOpen(true)}>
          <PhoneCall size={16} /> Qo'ng'iroq qabul
        </Btn>
        {ustaPendingTotal > 0 && (
          <Btn size="lg" variant="gold" onClick={() => setCloseDayOpen(true)}>
            <Check size={16} /> Kun yakunlash ({fmtSum(ustaPendingTotal)})
          </Btn>
        )}
      </div>

      {attentionItems.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16,
          background: T.s1, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px",
        }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: T.muted, display: "flex", alignItems: "center", gap: 5, marginRight: 4 }}>
            <AlertTriangle size={12} color={T.gold} /> Diqqat talab qiladi
          </span>
          {attentionItems.map((it, i) => (
            <button key={i} onClick={it.onClick} style={{
              background: it.color + "14", border: `1px solid ${it.color}30`, borderRadius: 20,
              padding: "5px 12px", fontSize: 11.5, fontWeight: 600, color: it.color, cursor: "pointer",
            }}>{it.text}</button>
          ))}
        </div>
      )}

      {/* MAIN STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 13, marginBottom: 20 }}>
        <Stat label="Bugungi kartalar" value={todayCards.length + " ta"}
          sub={`${openCards.length} ta ochiq`} color={T.flame} Icon={Car} />
        <Stat label="Bugungi kirim" value={fmtSum(todayIncome)}
          sub={`Chiqim: ${fmtSum(todayExpense)}`} color={T.teal} Icon={TrendingUp} />
        <Stat label="Kassa balansi" value={fmtSum(kassaBalance)}
          sub={fmtUsd(kassaBalance / rate)} color={T.gold} Icon={Wallet} spark={last7Net} />
        <Stat label="Usta haqi (to'lanmagan)" value={fmtSum(ustaPendingTotal)}
          sub={`${ustaPending.length} ta usta`} color={T.red} Icon={Wrench} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* OCHIQ KARTALAR */}
        <Card title={`Ochiq kartalar (${openCards.length})`} pad={false}
          action={<Btn size="sm" variant="ghost" onClick={() => setTab("services")}>Barchasi <ArrowRight size={11} /></Btn>}>
          {openCards.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>
              Ochiq karta yo'q
            </div>
          ) : (
            <div style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
              {openCards.slice(0, 5).map((c) => (
                <div key={c.id} style={{
                  background: T.s3, borderRadius: 9, padding: "11px 14px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderLeft: `3px solid ${SERVICE_COLORS[c.serviceType] || T.flame}`,
                }}>
                  <div>
                    <div className="mo" style={{ fontSize: 14, fontWeight: 700, color: T.flame }}>
                      {c.plate}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                      {c.carModel} · {c.serviceType} {c.usta && `· ${c.usta}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mo" style={{ fontSize: 12, color: T.muted2 }}>
                      {fmtSum(cardPartsCost(c) + cardUstaFeeSum(c))}
                    </div>
                    <div style={{ fontSize: 10, color: T.muted }}>hozircha</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* KUTILAYOTGAN QO'NG'IROQLAR */}
        <Card title={`Kutilmoqda (${waitingLeads.length})`} pad={false}
          action={<Btn size="sm" variant="ghost" onClick={() => setTab("callcenter")}>Barchasi <ArrowRight size={11} /></Btn>}>
          {waitingLeads.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>
              Kutilayotgan mijoz yo'q
            </div>
          ) : (
            <div style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
              {waitingLeads.slice(0, 5).map((l) => {
                const stage = LEAD_STAGES.find((s) => s.id === l.stage);
                return (
                  <div key={l.id} style={{
                    background: T.s3, borderRadius: 9, padding: "10px 13px",
                    borderLeft: `3px solid ${stage?.color}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{l.name || "Nomsiz"}</span>
                      <Badge color={stage?.color}>{stage?.label}</Badge>
                    </div>
                    <div className="mo" style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                      {l.phone} {l.carModel && `· ${l.carModel}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* BOTTOM ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <Card title="Usta haqi — bugun">
          {ustaPending.length === 0 ? (
            <div style={{ color: T.teal, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={14} /> Hammasi to'langan
            </div>
          ) : ustaPending.map((u) => (
            <div key={u.usta} style={{
              display: "flex", justifyContent: "space-between", padding: "7px 0",
              borderBottom: `1px solid ${T.border}25`,
            }}>
              <span style={{ fontSize: 12.5, color: T.muted2 }}>{u.usta} ({u.count})</span>
              <span className="mo" style={{ fontSize: 12.5, fontWeight: 700, color: T.red }}>
                {fmtSum(u.amountSum)}
              </span>
            </div>
          ))}
        </Card>

        <Card title="Bugungi xizmatlar">
          {SERVICE_TYPES.map((t) => {
            const n = todayCards.filter((c) => c.serviceType === t).length;
            return (
              <div key={t} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "7px 0", borderBottom: `1px solid ${T.border}25`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: SERVICE_COLORS[t] }} />
                  <span style={{ fontSize: 12.5, color: T.muted2 }}>{t}</span>
                </div>
                <span className="mo" style={{ fontSize: 13, fontWeight: 700, color: n ? SERVICE_COLORS[t] : T.muted }}>
                  {n} ta
                </span>
              </div>
            );
          })}
        </Card>

        <Card title="Qarzlar">
          {[
            ["Ta'minotchiga", supDebt, T.red],
            ["Hamkorlardan", partnerBalances(data).reduce((s, p) => s + Math.max(0, p.debtSum), 0), T.teal],
          ].map(([l, v, c]) => (
            <div key={l} style={{
              display: "flex", justifyContent: "space-between", padding: "9px 0",
              borderBottom: `1px solid ${T.border}25`,
            }}>
              <span style={{ fontSize: 12.5, color: T.muted2 }}>{l}</span>
              <span className="mo" style={{ fontSize: 13, fontWeight: 700, color: c }}>{fmtSum(v)}</span>
            </div>
          ))}
        </Card>
      </div>

      {quickOpen && <NewCardModal data={data} onClose={() => setQuickOpen(false)}
        onSave={(base) => { patch((d) => { d.serviceCards.unshift({ id: uid(), status: "ochiq", parts: [], ustaFeeEntries: [], ...base }); return d; }); setQuickOpen(false); }} />}
      {callOpen && <NewLeadModal onClose={() => setCallOpen(false)}
        onSave={(lead) => { patch((d) => { d.leads.unshift({ id: uid(), ...lead }); return d; }); setCallOpen(false); }} />}
      {closeDayOpen && (
        <Modal title="Kun yakunlash — usta haqi to'lash" onClose={() => setCloseDayOpen(false)}>
          <p style={{ color: T.muted, fontSize: 13, marginBottom: 14 }}>
            Quyidagi summalar to'landi deb belgilanadi va kassaga chiqim yoziladi:
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {ustaPending.map((u) => (
              <div key={u.usta} style={{
                display: "flex", justifyContent: "space-between",
                padding: "11px 14px", background: T.s3, borderRadius: 8,
              }}>
                <span style={{ fontWeight: 600 }}>{u.usta} <span style={{ color: T.muted, fontWeight: 400 }}>({u.count} ta)</span></span>
                <span className="mo" style={{ color: T.flame, fontWeight: 700 }}>{fmtSum(u.amountSum)}</span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 12, padding: "12px 14px", background: T.redD,
            borderRadius: 8, display: "flex", justifyContent: "space-between",
          }}>
            <span style={{ fontWeight: 700 }}>JAMI</span>
            <span className="mo" style={{ color: T.red, fontWeight: 800, fontSize: 16 }}>{fmtSum(ustaPendingTotal)}</span>
          </div>
          <SaveBtn onClick={closeDay} color={T.teal}>
            <Check size={16} /> To'landi — kunni yopish
          </SaveBtn>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CALL CENTER — CRM VORONKA
═══════════════════════════════════════════════════ */
function CallCenterTab({ data, patch }) {
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("hammasi");
  const [cancelLead, setCancelLead] = useState(null);
  const [dealLead, setDealLead] = useState(null);
  const [subTab, setSubTab] = useState("calls"); // calls | tasks | kafolat | analytics
  const [kafolatCallOpen, setKafolatCallOpen] = useState(null);

  const kafolatFollowups = (data.warrantyFollowups || [])
    .filter((f) => f.status === "kutilmoqda" && f.dueDate <= todayISO())
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const trackedCardIds = new Set((data.warrantyFollowups || []).filter((f) => f.cardId).map((f) => f.cardId));
  const trackedManualIds = new Set((data.warrantyFollowups || []).filter((f) => f.manualId).map((f) => f.manualId));
  const untrackedOldWarranties =
    (data.serviceCards || []).filter((c) => c.hasWarranty && num(c.warrantyMonths) > 0 && cardStatus(c) !== "ochiq" && !trackedCardIds.has(c.id)).length +
    (data.warranty || []).filter((w) => w.hasWarranty && num(w.warrantyMonths) > 0 && !trackedManualIds.has(w.id)).length;

  function kafolatStageFor(closedDate, warrantyMonths) {
    const today = todayISO();
    const marks = kafolatMonthMarks(warrantyMonths);
    let best = { stage: "5kun", monthIndex: -1, dueDate: addDaysISO(closedDate, 5) };
    if (today >= best.dueDate) {
      for (let i = 0; i < marks.length; i++) {
        const due = addMonthsISO(closedDate, marks[i]);
        if (due <= today) best = { stage: `${marks[i]}oy`, monthIndex: i, dueDate: due };
        else break;
      }
    }
    return best;
  }
  function backfillOldWarranties() {
    patch((d) => {
      d.warrantyFollowups = d.warrantyFollowups || [];
      const haveCard = new Set(d.warrantyFollowups.filter((f) => f.cardId).map((f) => f.cardId));
      const haveManual = new Set(d.warrantyFollowups.filter((f) => f.manualId).map((f) => f.manualId));
      (d.serviceCards || []).forEach((card) => {
        if (!card.hasWarranty || num(card.warrantyMonths) <= 0) return;
        if (cardStatus(card) === "ochiq") return;
        if (haveCard.has(card.id)) return;
        const st = kafolatStageFor(card.date, num(card.warrantyMonths));
        d.warrantyFollowups.push({
          id: uid(), cardId: card.id, plate: card.plate, phone: card.phone, carModel: card.carModel,
          serviceType: card.serviceType, warrantyMonths: num(card.warrantyMonths),
          closedDate: card.date, status: "kutilmoqda", history: [], ...st,
        });
      });
      (d.warranty || []).forEach((w) => {
        if (!w.hasWarranty || num(w.warrantyMonths) <= 0) return;
        if (haveManual.has(w.id)) return;
        const st = kafolatStageFor(w.date, num(w.warrantyMonths));
        d.warrantyFollowups.push({
          id: uid(), manualId: w.id, plate: w.plate, phone: w.phone, carModel: w.carModel,
          serviceType: w.product || "", warrantyMonths: num(w.warrantyMonths),
          closedDate: w.date, status: "kutilmoqda", history: [], ...st,
        });
      });
      return d;
    });
  }

  const leads = (data.leads || [])
    .filter((l) => stageFilter === "hammasi" || l.stage === stageFilter)
    .filter((l) => (l.name + l.phone + l.carModel + l.plate).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  const pendingTasks = (data.leadTasks || []).filter((t) => !t.done)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const overdueCount = pendingTasks.filter((t) => t.dueDate < todayISO()).length;

  function moveStage(id, stage, extra = {}) {
    patch((d) => {
      const l = d.leads.find((x) => x.id === id);
      if (l) { l.stage = stage; l.updatedAt = todayISO(); Object.assign(l, extra); }
      d.leadTasks = d.leadTasks || [];
      if (stage === "nedozvon") {
        // Shu lead uchun hali bajarilmagan vazifa bo'lmasa — yangi vazifa yaratamiz
        const existing = d.leadTasks.find((t) => t.leadId === id && !t.done);
        if (!existing) {
          const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
          d.leadTasks.push({
            id: uid(), leadId: id, title: `Qayta qo'ng'iroq: ${l?.name || l?.phone || ""}`,
            dueDate: tomorrow, done: false, createdAt: todayISO(),
          });
        }
      } else {
        // Boshqa bosqichga o'tsa — shu leadga tegishli ochiq vazifa avtomatik yopiladi
        d.leadTasks.forEach((t) => { if (t.leadId === id && !t.done) t.done = true; });
      }
      return d;
    });
  }
  async function deleteLead(id) {
    if (!(await askConfirm("Bu qo'ng'iroq yozuvi o'chirilsinmi?"))) return;
    patch((d) => { d.leads = d.leads.filter((l) => l.id !== id); return d; });
  }
  function toggleTask(taskId) {
    patch((d) => {
      const t = (d.leadTasks || []).find((x) => x.id === taskId);
      if (t) t.done = !t.done;
      return d;
    });
  }
  function handleKafolatCall(followup, result, note) {
    patch((d) => {
      const f = (d.warrantyFollowups || []).find((x) => x.id === followup.id);
      if (!f) return d;
      f.history = f.history || [];
      f.history.push({ date: todayISO(), result, note: note || "" });
      const marks = kafolatMonthMarks(f.warrantyMonths);
      const nextIndex = f.monthIndex + 1;
      if (nextIndex < marks.length) {
        f.monthIndex = nextIndex;
        f.stage = `${marks[nextIndex]}oy`;
        f.dueDate = addMonthsISO(f.closedDate, marks[nextIndex]);
        f.status = "kutilmoqda";
      } else {
        f.status = "tugadi";
      }
      if (result === "muammo") {
        d.complaints = d.complaints || [];
        d.complaints.push({
          id: uid(), followupId: f.id, cardId: f.cardId, plate: f.plate, phone: f.phone,
          carModel: f.carModel, date: todayISO(), note: note || "", status: "yangi",
        });
      }
      return d;
    });
  }

  const counts = LEAD_STAGES.map((s) => ({
    ...s, n: (data.leads || []).filter((l) => l.stage === s.id).length,
  }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Qo'ng'iroqlar markazi</h2>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>
            Jami {(data.leads || []).length} ta qo'ng'iroq
          </p>
        </div>
        <Btn onClick={() => setAddOpen(true)}><Plus size={15} /> Qo'ng'iroq qabul qilish</Btn>
      </div>

      {/* ICHKI BO'LIMLAR */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[
          ["calls", "Qo'ng'iroqlar", Phone],
          ["tasks", `Vazifalar${overdueCount > 0 ? ` (${overdueCount})` : ""}`, ListTodo],
          ["kafolat", `Kafolat nazorati${kafolatFollowups.length > 0 ? ` (${kafolatFollowups.length})` : ""}`, ShieldCheck],
          ["analytics", "Tahlil", BarChart3],
        ].map(([v, l, Icon]) => (
          <button key={v} onClick={() => setSubTab(v)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9, border: `1px solid ${subTab === v ? T.flame : T.border2}`,
            background: subTab === v ? T.flameD : T.s1, color: subTab === v ? T.flame : T.muted,
            fontWeight: 600, fontSize: 12.5, cursor: "pointer",
          }}>
            <Icon size={13} /> {l}
            {v === "tasks" && overdueCount > 0 && subTab !== v && (
              <span style={{ background: T.red, color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", marginLeft: 2 }}>{overdueCount}</span>
            )}
          </button>
        ))}
      </div>

      {subTab === "calls" && (
        <>
      {/* VORONKA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 18 }}>
        {counts.map((s) => (
          <div key={s.id} onClick={() => setStageFilter(stageFilter === s.id ? "hammasi" : s.id)} style={{
            background: stageFilter === s.id ? s.color + "18" : T.s1,
            border: `1px solid ${stageFilter === s.id ? s.color : T.border}`,
            borderRadius: 11, padding: "13px 14px", cursor: "pointer",
            borderTop: `3px solid ${s.color}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: T.muted, marginBottom: 6, lineHeight: 1.3 }}>
              {s.label}
            </div>
            <div className="mo bc" style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.n}</div>
          </div>
        ))}
      </div>

      {/* SEARCH */}
      <div style={{ position: "relative", marginBottom: 14, maxWidth: 340 }}>
        <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Telefon, ism, mashina..."
          style={{ ...iSt, paddingLeft: 32 }} />
      </div>

      {/* LEAD CARDS */}
      {leads.length === 0 ? (
        <div style={{ padding: "50px 20px", textAlign: "center", color: T.muted, background: T.s1, borderRadius: 12, border: `1px solid ${T.border}` }}>
          <Phone size={32} color={T.border2} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13 }}>Qo'ng'iroq yo'q</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 12 }}>
          {leads.map((l) => {
            const stage = LEAD_STAGES.find((s) => s.id === l.stage) || LEAD_STAGES[0];
            return (
              <div key={l.id} className="ch" style={{
                background: T.s1, border: `1px solid ${T.border}`,
                borderRadius: 12, overflow: "hidden",
                borderLeft: `3px solid ${stage.color}`,
                transition: "all .15s",
              }}>
                <div style={{ padding: "13px 15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{l.name || "Nomsiz"}</div>
                      <a href={`tel:${l.phone}`} className="mo" style={{
                        fontSize: 13, color: T.flame, textDecoration: "none",
                        display: "flex", alignItems: "center", gap: 5, marginTop: 3,
                      }}>
                        <Phone size={11} /> {l.phone}
                      </a>
                    </div>
                    <Badge color={stage.color}>{stage.label}</Badge>
                  </div>

                  {(l.carModel || l.plate) && (
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>
                      🚗 {l.carModel} {l.plate && <span className="mo">· {l.plate}</span>}
                    </div>
                  )}
                  {(l.region || l.source) && (
                    <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>
                      {l.region && <span>📍 {l.region}</span>}
                      {l.region && l.source && <span> · </span>}
                      {l.source && <span>{l.source}</span>}
                    </div>
                  )}
                  {l.issue && (
                    <div style={{
                      fontSize: 12, color: T.muted2, background: T.s3,
                      borderRadius: 7, padding: "8px 11px", marginBottom: 8,
                    }}>{l.issue}</div>
                  )}
                  {l.stage === "kelishildi" && num(l.dealValue) > 0 && (
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.teal, marginBottom: 6 }}>
                      💰 {fmtSum(l.dealValue)}
                    </div>
                  )}
                  {l.stage === "bekor" && l.cancelReason && (
                    <div style={{ fontSize: 11.5, color: T.red, marginBottom: 6 }}>
                      ✕ Sabab: {l.cancelReason}
                    </div>
                  )}
                  <div className="mo" style={{ fontSize: 10.5, color: T.muted, display: "flex", alignItems: "center", gap: 5 }}>
                    <Clock size={10} /> {fmtDate(l.date)} {l.time}
                    {l.serviceType && <span style={{ color: SERVICE_COLORS[l.serviceType] }}>· {l.serviceType}</span>}
                  </div>
                </div>

                <div style={{
                  display: "flex", gap: 6, padding: "10px 14px",
                  borderTop: `1px solid ${T.border}`, background: T.s2, flexWrap: "wrap",
                }}>
                  {l.stage === "birinchi" && (
                    <>
                      <Btn size="sm" variant="teal" onClick={() => setDealLead(l)}>Kelishildi</Btn>
                      <Btn size="sm" variant="gold" onClick={() => moveStage(l.id, "nedozvon")}>Nedozvon</Btn>
                      <Btn size="sm" variant="red" onClick={() => setCancelLead(l)}>Bekor</Btn>
                    </>
                  )}
                  {l.stage === "nedozvon" && (
                    <>
                      <Btn size="sm" variant="teal" onClick={() => setDealLead(l)}>Kelishildi</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => moveStage(l.id, "birinchi")}>Qayta urinish</Btn>
                      <Btn size="sm" variant="red" onClick={() => setCancelLead(l)}>Bekor</Btn>
                    </>
                  )}
                  {l.stage === "kelishildi" && (
                    <>
                      <Btn size="sm" variant="purple" onClick={() => moveStage(l.id, "keldi")}>Keldi</Btn>
                      <Btn size="sm" variant="red" onClick={() => setCancelLead(l)}>Bekor</Btn>
                    </>
                  )}
                  {l.stage === "keldi" && (
                    <>
                      <Btn size="sm" variant="teal" onClick={() => moveStage(l.id, "ornatildi")}>
                        <Check size={11} /> O'rnatildi
                      </Btn>
                      <Btn size="sm" variant="red" onClick={() => setCancelLead(l)}>Bekor</Btn>
                    </>
                  )}
                  {(l.stage === "ornatildi" || l.stage === "bekor") && (
                    <Btn size="sm" variant="ghost" onClick={() => moveStage(l.id, "birinchi")}>
                      <RefreshCw size={11} /> Qayta ochish
                    </Btn>
                  )}
                  <button onClick={() => deleteLead(l.id)} style={{
                    marginLeft: "auto", background: "none", border: "none",
                    cursor: "pointer", color: T.muted, padding: 4,
                  }}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {subTab === "tasks" && (
        <div>
          {pendingTasks.length === 0 ? (
            <div style={{ padding: "50px 20px", textAlign: "center", color: T.muted, background: T.s1, borderRadius: 12, border: `1px solid ${T.border}` }}>
              <ListTodo size={32} color={T.border2} style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 13 }}>Bajarilishi kerak bo'lgan vazifa yo'q</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {pendingTasks.map((t) => {
                const lead = (data.leads || []).find((l) => l.id === t.leadId);
                const isOverdue = t.dueDate < todayISO();
                const isToday = t.dueDate === todayISO();
                return (
                  <div key={t.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: T.s1, border: `1px solid ${isOverdue ? T.red + "50" : T.border}`,
                    borderLeft: `3px solid ${isOverdue ? T.red : isToday ? T.gold : T.border2}`,
                    borderRadius: 10, padding: "13px 16px", flexWrap: "wrap", gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{t.title}</div>
                      <div style={{ fontSize: 11.5, color: isOverdue ? T.red : T.muted, display: "flex", alignItems: "center", gap: 6 }}>
                        <Clock size={11} /> {fmtDate(t.dueDate)}
                        {isOverdue && <span style={{ fontWeight: 700 }}>· Muddati o'tgan</span>}
                        {isToday && <span style={{ color: T.gold, fontWeight: 700 }}>· Bugun</span>}
                        {lead?.phone && <span className="mo"> · {lead.phone}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {lead && (
                        <Btn size="sm" variant="ghost" onClick={() => { setStageFilter(lead.stage); setSubTab("calls"); }}>
                          Ko'rish
                        </Btn>
                      )}
                      <Btn size="sm" variant="teal" onClick={() => toggleTask(t.id)}>
                        <Check size={12} /> Bajarildi
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === "kafolat" && (
        <div>
          {untrackedOldWarranties > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
              background: T.s1, border: `1px solid ${T.gold}40`, borderRadius: 10, padding: "12px 16px", marginBottom: 14,
            }}>
              <span style={{ fontSize: 12.5, color: T.muted2 }}>
                Bu funksiyadan oldin yopilgan {untrackedOldWarranties} ta kafolatli karta hali nazorat jadvaliga qo'shilmagan.
              </span>
              <Btn size="sm" variant="gold" onClick={backfillOldWarranties}>
                <RefreshCw size={12} /> Eski kafolatlarni qo'shish
              </Btn>
            </div>
          )}
          {kafolatFollowups.length === 0 ? (
            <div style={{ padding: "50px 20px", textAlign: "center", color: T.muted, background: T.s1, borderRadius: 12, border: `1px solid ${T.border}` }}>
              <ShieldCheck size={32} color={T.border2} style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 13 }}>Hozircha qo'ng'iroq qilish kerak bo'lgan kafolat yo'q</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {kafolatFollowups.map((f) => {
                const isOverdue = f.dueDate < todayISO();
                return (
                  <div key={f.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: T.s1, border: `1px solid ${isOverdue ? T.red + "50" : T.border}`,
                    borderLeft: `3px solid ${isOverdue ? T.red : T.teal}`,
                    borderRadius: 10, padding: "13px 16px", flexWrap: "wrap", gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
                        {f.carModel || "Mashina"} {f.plate && <span className="mo">· {f.plate}</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: isOverdue ? T.red : T.muted, display: "flex", alignItems: "center", gap: 6 }}>
                        <Clock size={11} /> {fmtDate(f.dueDate)}
                        <span>· {f.stage === "5kun" ? "Birinchi (qoniqish) qo'ng'irog'i" : `${f.stage} nazorat qo'ng'irog'i`}</span>
                        {f.phone && <span className="mo"> · {f.phone}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {f.phone && (
                        <a href={`tel:${f.phone}`} style={{ textDecoration: "none" }}>
                          <Btn size="sm" variant="ghost"><Phone size={12} /></Btn>
                        </a>
                      )}
                      <Btn size="sm" variant="teal" onClick={() => setKafolatCallOpen(f)}>
                        <Check size={12} /> Qo'ng'iroq natijasi
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === "analytics" && <CallCenterAnalytics data={data} />}

      {kafolatCallOpen && (
        <KafolatCallModal followup={kafolatCallOpen} onClose={() => setKafolatCallOpen(null)}
          onSave={(result, note) => { handleKafolatCall(kafolatCallOpen, result, note); setKafolatCallOpen(null); }} />
      )}

      {addOpen && <NewLeadModal onClose={() => setAddOpen(false)}
        onSave={(lead) => { patch((d) => { d.leads.unshift({ id: uid(), ...lead }); return d; }); setAddOpen(false); }} />}
      {cancelLead && (
        <LeadCancelModal lead={cancelLead} onClose={() => setCancelLead(null)}
          onSave={(reason) => { moveStage(cancelLead.id, "bekor", { cancelReason: reason }); setCancelLead(null); }} />
      )}
      {dealLead && (
        <LeadDealModal lead={dealLead} onClose={() => setDealLead(null)}
          onSave={(value) => { moveStage(dealLead.id, "kelishildi", { dealValue: value }); setDealLead(null); }} />
      )}
    </div>
  );
}

function LeadCancelModal({ lead, onClose, onSave }) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  return (
    <Modal title={`Bekor qilish — ${lead.name || lead.phone}`} onClose={onClose}>
      <F label="Bekor qilinish sababi">
        <Sel value={reason} onChange={(e) => setReason(e.target.value)} options={CANCEL_REASONS} />
      </F>
      <SaveBtn color={T.red} onClick={() => onSave(reason)}>
        <X size={15} /> Bekor qilish
      </SaveBtn>
    </Modal>
  );
}

function LeadDealModal({ lead, onClose, onSave }) {
  const [value, setValue] = useState(lead.dealValue || "");
  return (
    <Modal title={`Kelishildi — ${lead.name || lead.phone}`} onClose={onClose}>
      <F label="Kelishuv summasi (so'm, ixtiyoriy)">
        <input type="number" style={iSt} value={value} onChange={(e) => setValue(e.target.value)} autoFocus placeholder="Masalan: 3500000" />
      </F>
      <SaveBtn color={T.teal} onClick={() => onSave(num(value))}>
        <Check size={15} /> Kelishildi deb belgilash
      </SaveBtn>
    </Modal>
  );
}

function KafolatCallModal({ followup, onClose, onSave }) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const script = `Assalomu alaykum! Siz ${followup.carModel || "mashinangiz"}${followup.plate ? " (" + followup.plate + ")" : ""} uchun bizning servisimizdan xizmat olgan edingiz. Bugun shu xizmat natijasini bilish uchun qo'ng'iroq qilyapman — hammasi yaxshimi, biror kamchilik yo'qmi?`;
  return (
    <Modal title="Kafolat nazorati qo'ng'irog'i" onClose={onClose}>
      <div style={{ background: T.s3, borderRadius: 9, padding: "12px 14px", fontSize: 13, color: T.muted2, marginBottom: 16, lineHeight: 1.5 }}>
        {script}
      </div>
      {!showNote ? (
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="teal" onClick={() => onSave("yaxshi", "")} style={{ flex: 1 }}>
            <Check size={15} /> Yaxshi
          </Btn>
          <Btn variant="red" onClick={() => setShowNote(true)} style={{ flex: 1 }}>
            <AlertTriangle size={15} /> Muammo bor
          </Btn>
        </div>
      ) : (
        <>
          <F label="Shikoyat / kamchilik matni">
            <textarea style={{ ...iSt, minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} autoFocus
              placeholder="Mijoz aytgan muammoni yozing..." />
          </F>
          <SaveBtn color={T.red} disabled={!note.trim()} onClick={() => onSave("muammo", note)}>
            <AlertTriangle size={15} /> Shikoyat sifatida yuborish
          </SaveBtn>
        </>
      )}
    </Modal>
  );
}

function ComplaintsTab({ data, patch }) {
  const complaints = (data.complaints || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const newCount = complaints.filter((c) => c.status === "yangi").length;

  function resolve(id) {
    patch((d) => {
      const c = (d.complaints || []).find((x) => x.id === id);
      if (c) c.status = "hal_qilindi";
      return d;
    });
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Shikoyatlar</h2>
        <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>
          Jami {complaints.length} ta, {newCount} ta yangi
        </p>
      </div>
      {complaints.length === 0 ? (
        <div style={{ padding: "50px 20px", textAlign: "center", color: T.muted, background: T.s1, borderRadius: 12, border: `1px solid ${T.border}` }}>
          <AlertTriangle size={32} color={T.border2} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13 }}>Shikoyat yo'q</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {complaints.map((c) => (
            <div key={c.id} style={{
              background: T.s1, border: `1px solid ${c.status === "yangi" ? T.red + "50" : T.border}`,
              borderLeft: `3px solid ${c.status === "yangi" ? T.red : T.teal}`,
              borderRadius: 10, padding: "13px 16px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
                    {c.carModel || "Mashina"} {c.plate && <span className="mo">· {c.plate}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.muted, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Clock size={11} /> {fmtDate(c.date)}
                    {c.phone && <span className="mo"> · {c.phone}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: T.muted2 }}>{c.note}</div>
                </div>
                {c.status === "yangi" ? (
                  <Btn size="sm" variant="teal" onClick={() => resolve(c.id)}>
                    <Check size={12} /> Hal qilindi
                  </Btn>
                ) : (
                  <Badge color={T.teal}>Hal qilindi</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CallCenterAnalytics({ data }) {
  const [days, setDays] = useState(14);
  const leads = data.leads || [];
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const inRange = leads.filter((l) => l.date >= since);

  const total = inRange.length;
  const kelishildi = inRange.filter((l) => l.stage === "kelishildi" || l.stage === "keldi" || l.stage === "ornatildi").length;
  const ornatildi = inRange.filter((l) => l.stage === "ornatildi").length;
  const bekor = inRange.filter((l) => l.stage === "bekor").length;
  const conv = total > 0 ? Math.round((ornatildi / total) * 100) : 0;
  const totalDeal = inRange.filter((l) => num(l.dealValue) > 0).reduce((s, l) => s + num(l.dealValue), 0);

  // Kunlik dinamika
  const byDay = {};
  inRange.forEach((l) => { byDay[l.date] = (byDay[l.date] || 0) + 1; });
  const dailyRows = Object.entries(byDay).map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date));
  const maxDaily = Math.max(1, ...dailyRows.map((r) => r.n));

  // Viloyat va manba bo'yicha
  function breakdown(key) {
    const map = {};
    inRange.forEach((l) => { const k = l[key] || "Aniqlanmagan"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 8);
  }
  const regionRows = breakdown("region");
  const sourceRows = breakdown("source");
  const maxRegion = Math.max(1, ...regionRows.map((r) => r.n));
  const maxSource = Math.max(1, ...sourceRows.map((r) => r.n));

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[[7, "7 kun"], [14, "14 kun"], [30, "30 kun"], [90, "90 kun"]].map(([d, l]) => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: "6px 13px", borderRadius: 20, border: `1px solid ${days === d ? T.flame : T.border2}`,
            background: days === d ? T.flameD : T.s1, color: days === d ? T.flame : T.muted,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label="Jami qo'ng'iroq" value={total + " ta"} color={T.blue} Icon={Phone} />
        <Stat label="O'rnatildi" value={ornatildi + " ta"} color={T.teal} Icon={Check} />
        <Stat label="Bekor qilingan" value={bekor + " ta"} color={T.red} Icon={X} />
        <Stat label="Konversiya" value={conv + "%"} color={T.gold} Icon={TrendingUp} />
        <Stat label="Kelishuv summasi" value={fmtSum(totalDeal)} color={T.purple} Icon={Wallet} />
      </div>

      <Card title="Kunlik qo'ng'iroqlar dinamikasi">
        {dailyRows.length === 0 ? (
          <p style={{ fontSize: 12, color: T.muted }}>Ma'lumot yo'q</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {dailyRows.map((r) => (
              <div key={r.date} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mo" style={{ fontSize: 11, color: T.muted, width: 70, flexShrink: 0 }}>{fmtDate(r.date)}</span>
                <div style={{ flex: 1, height: 16, background: T.s3, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(r.n / maxDaily * 100).toFixed(0)}%`, height: "100%", background: T.flame, borderRadius: 4 }} />
                </div>
                <span className="mo" style={{ fontSize: 12, fontWeight: 700, width: 24, textAlign: "right" }}>{r.n}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Card title="Viloyat bo'yicha (top 8)">
          {regionRows.length === 0 ? <p style={{ fontSize: 12, color: T.muted }}>Ma'lumot yo'q</p> : (
            <div style={{ display: "grid", gap: 8 }}>
              {regionRows.map((r) => (
                <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11.5, color: T.muted2, width: 100, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  <div style={{ flex: 1, height: 14, background: T.s3, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(r.n / maxRegion * 100).toFixed(0)}%`, height: "100%", background: T.blue, borderRadius: 4 }} />
                  </div>
                  <span className="mo" style={{ fontSize: 11.5, fontWeight: 700, width: 20, textAlign: "right" }}>{r.n}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Manba bo'yicha">
          {sourceRows.length === 0 ? <p style={{ fontSize: 12, color: T.muted }}>Ma'lumot yo'q</p> : (
            <div style={{ display: "grid", gap: 8 }}>
              {sourceRows.map((r) => (
                <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11.5, color: T.muted2, width: 100, flexShrink: 0 }}>{r.name}</span>
                  <div style={{ flex: 1, height: 14, background: T.s3, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(r.n / maxSource * 100).toFixed(0)}%`, height: "100%", background: T.purple, borderRadius: 4 }} />
                  </div>
                  <span className="mo" style={{ fontSize: 11.5, fontWeight: 700, width: 20, textAlign: "right" }}>{r.n}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function NewLeadModal({ onClose, onSave }) {
  const [f, setF] = useState({
    date: todayISO(), time: nowTime(), name: "", phone: "",
    carModel: "", plate: "", serviceType: "", issue: "", stage: "birinchi",
    region: "", source: LEAD_SOURCES[0],
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target?.value ?? e }));

  return (
    <Modal title="Qo'ng'iroq qabul qilish" onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Mijoz ismi"><input style={iSt} value={f.name} onChange={set("name")} placeholder="Ism" autoFocus /></F>
        <F label="Telefon raqami *"><input style={iSt} value={f.phone} onChange={set("phone")} placeholder="+998 90 000 00 00" /></F>
        <F label="Avtomobil modeli"><input style={iSt} value={f.carModel} onChange={set("carModel")} placeholder="Nexia, Cobalt..." /></F>
        <F label="Davlat raqami"><input style={iSt} value={f.plate} onChange={set("plate")} placeholder="01 A 123 BC" /></F>
        <F label="Xizmat turi">
          <Sel value={f.serviceType} onChange={set("serviceType")}
            options={[{ value: "", label: "Aniqlanmagan" }, ...SERVICE_TYPES]} />
        </F>
        <F label="Manba">
          <Sel value={f.source} onChange={set("source")} options={LEAD_SOURCES} />
        </F>
        <F label="Viloyat">
          <Sel value={f.region} onChange={set("region")}
            options={[{ value: "", label: "Aniqlanmagan" }, ...LEAD_REGIONS]} />
        </F>
        <F label="Sana / vaqt">
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" style={iSt} value={f.date} onChange={set("date")} />
            <input type="time" style={{ ...iSt, width: 100 }} value={f.time} onChange={set("time")} />
          </div>
        </F>
        <F label="Muammo / izoh" col="1/-1">
          <textarea rows={2} style={iSt} value={f.issue} onChange={set("issue")}
            placeholder="Mijoz nima dedi..." />
        </F>
      </div>
      <SaveBtn disabled={!f.phone.trim()} onClick={() => onSave(f)}>
        <PhoneCall size={15} /> Saqlash
      </SaveBtn>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   SERVICES TAB
═══════════════════════════════════════════════════ */
function ServicesTab({ data, patch, rate, role, ustaName, saveState }) {
  const [newOpen, setNewOpen] = useState(false);
  const [workCard, setWorkCard] = useState(null);
  const [search, setSearch] = useState("");
  const [editPinOpen, setEditPinOpen] = useState(null); // card pending PIN check
  const [editCard, setEditCard] = useState(null); // card being edited after PIN ok
  const [viewCard, setViewCard] = useState(null); // to'liq tafsilotni ko'rish uchun
  const isUsta = role === "usta";
  const isSklad = role === "sklad"; // Sklad — usta kabi ko'radi/mahsulot biriktiradi, lekin narx/foydani ko'rmaydi va yakunlay olmaydi
  const isReadOnly = role === "rahbar"; // Rahbar faqat kuzatadi
  const hideFinance = isUsta || isSklad;

  const allCards = data.serviceCards;
  // Usta faqat o'ziga (o'z ismiga) tegishli kartalarni ko'radi
  const cards = isUsta ? allCards.filter((c) => sameName(c.usta, ustaName)) : allCards;
  const openCards = cards.filter((c) => cardStatus(c) === "ochiq");
  const closedCards = cards
    .filter((c) => cardStatus(c) !== "ochiq")
    .filter((c) => (c.plate + c.carModel + c.phone).toLowerCase().includes(search.toLowerCase()));

  // Barcha kartalardagi usta izohlarini yig'amiz — takroriy yozmaslik uchun tavsiya ro'yxati
  const noteSuggestions = [...new Set(
    cards.flatMap((c) => (c.ustaFeeEntries || []).map((e) => e.note).filter(Boolean))
  )];

  const totalRevenue = closedCards.reduce((s, c) => s + num(c.finalTotal), 0);
  const totalProfit = closedCards.reduce((s, c) => s + num(c.profitSum), 0);

  function createCard(base) {
    patch((d) => {
      d.serviceCards.unshift({
        id: uid(), status: "ochiq", parts: [], ustaFeeEntries: [],
        partsCost: 0, ustaFee: 0, finalTotal: 0, profitSum: 0,
        pendingConfirm: isUsta, createdByUsta: isUsta ? base.usta : undefined,
        ...base,
      });
      return d;
    });
    setNewOpen(false);
  }

  function addPart(cardId, part) {
    patch((d) => {
      const card = d.serviceCards.find((c) => c.id === cardId);
      const product = d.products.find((p) => p.id === part.productId);
      if (product) product.qty = Math.max(0, num(product.qty) - part.qty);
      if (card) { card.parts = card.parts || []; card.parts.push(part); }
      return d;
    });
  }

  function addNewProductAndPart(cardId, newProd, qty, useSale) {
    patch((d) => {
      const card = d.serviceCards.find((c) => c.id === cardId);
      const product = {
        id: uid(), name: newProd.name, unit: newProd.unit || "dona",
        category: newProd.category || (data.settings.categories || CATEGORIES_DEFAULT)[0],
        costSum: num(newProd.costSum), priceSum: num(newProd.priceSum), priceUsd: 0,
        qty: 0, // darhol shu kartaga sarflanadi, sklad qoldig'i 0 qoladi (agar keyin kirim qilinmasa)
      };
      d.products.push(product);
      // Agar "hozir sotib olindi" summasi kiritilgan bo'lsa — stockIn sifatida ham yozamiz (ixtiyoriy, hozircha yo'q)
      const unit = useSale ? num(newProd.priceSum) : num(newProd.costSum);
      const part = {
        productId: product.id, name: product.name, qty: num(qty),
        unitCost: unit, lineTotal: num(qty) * unit,
        costUnit: num(newProd.costSum), saleUnit: num(newProd.priceSum),
      };
      if (card) { card.parts = card.parts || []; card.parts.push(part); }
      return d;
    });
  }
  function removePart(cardId, idx) {
    patch((d) => {
      const card = d.serviceCards.find((c) => c.id === cardId);
      if (!card) return d;
      const part = card.parts[idx];
      if (part) {
        const product = d.products.find((p) => p.id === part.productId);
        if (product) product.qty = num(product.qty) + part.qty;
      }
      card.parts = card.parts.filter((_, i) => i !== idx);
      return d;
    });
  }
  function addFee(cardId, amount, note) {
    patch((d) => {
      const card = d.serviceCards.find((c) => c.id === cardId);
      if (card) {
        card.ustaFeeEntries = card.ustaFeeEntries || [];
        card.ustaFeeEntries.push({ id: uid(), amount, note, date: todayISO() });
      }
      return d;
    });
  }
  function removeFee(cardId, feeId) {
    patch((d) => {
      const card = d.serviceCards.find((c) => c.id === cardId);
      if (card) card.ustaFeeEntries = (card.ustaFeeEntries || []).filter((e) => e.id !== feeId);
      return d;
    });
  }
  function closeCard(cardId, fin) {
    patch((d) => {
      const card = d.serviceCards.find((c) => c.id === cardId);
      if (!card) return d;
      Object.assign(card, fin, { status: "yakunlangan" });
      card.cashflowIds = []; // yakunlashda yaratilgan kassa yozuvlarini kuzatish — o'chirishda kerak

      // Kafolat berilgan bo'lsa — kafolat nazorati qo'ng'iroqlari jadvalini boshlaymiz:
      // birinchi (qoniqish) qo'ng'irog'i 5 kundan keyin, so'ngra 1,3,6,9...oylarda.
      if (card.hasWarranty && num(card.warrantyMonths) > 0) {
        d.warrantyFollowups = d.warrantyFollowups || [];
        d.warrantyFollowups.push({
          id: uid(), cardId: card.id, plate: card.plate, phone: card.phone, carModel: card.carModel,
          serviceType: card.serviceType, warrantyMonths: num(card.warrantyMonths),
          closedDate: todayISO(), stage: "5kun", monthIndex: -1,
          dueDate: addDaysISO(todayISO(), 5), status: "kutilmoqda", history: [],
        });
      }

      const isNasiya = card.paymentType === "Nasiya (qarzga)";
      const isContracted = (d.contractedMasters || []).some((m) => sameName(m.name, card.usta));
      card.ustaIsContracted = isContracted;

      if (fin.payLines && fin.payLines.length > 0) {
        // To'lov bir necha usul/valyutada bo'lingan — har biri alohida yoziladi
        fin.payLines.forEach((line) => {
          if (line.paymentType === "Nasiya (qarzga)") {
            d.nasiyaDebts = d.nasiyaDebts || [];
            d.nasiyaDebts.push({
              id: uid(), date: todayISO(), cardId: card.id,
              plate: card.plate, phone: card.phone, carModel: card.carModel,
              serviceType: card.serviceType, amountSum: line.amountSum, paidAmount: 0, paid: false,
            });
          } else {
            d.cashflow.unshift({
              id: (() => { const _cfid = uid(); card.cashflowIds.push(_cfid); return _cfid; })(), date: todayISO(), type: "kirim", category: "Xizmat to'lovi",
              currency: line.currency, amount: line.amount, amountSum: line.amountSum,
              amountUsd: line.currency === "USD" ? line.amount : line.amountSum / rate,
              paymentType: line.paymentType,
              note: `${card.serviceType} — ${card.carModel || ""} (${card.plate})`,
            });
          }
        });
      } else if (fin.finalTotal > 0 && !isNasiya) {
        d.cashflow.unshift({
          id: (() => { const _cfid = uid(); card.cashflowIds.push(_cfid); return _cfid; })(), date: todayISO(), type: "kirim", category: "Xizmat to'lovi",
          currency: "SUM", amount: fin.finalTotal, amountSum: fin.finalTotal,
          amountUsd: fin.finalTotal / rate, paymentType: card.paymentType,
          note: `${card.serviceType} — ${card.carModel || ""} (${card.plate})`,
        });
      } else if (fin.finalTotal > 0 && isNasiya) {
        d.nasiyaDebts = d.nasiyaDebts || [];
        d.nasiyaDebts.push({
          id: uid(), date: todayISO(), cardId: card.id,
          plate: card.plate, phone: card.phone, carModel: card.carModel,
          serviceType: card.serviceType, amountSum: fin.finalTotal, paidAmount: 0, paid: false,
        });
      }
      if (fin.docFee > 0) {
        d.cashflow.unshift({
          id: (() => { const _cfid = uid(); card.cashflowIds.push(_cfid); return _cfid; })(), date: todayISO(), type: "chiqim", category: "Hujjat xarajati",
          currency: "SUM", amount: fin.docFee, amountSum: fin.docFee, amountUsd: fin.docFee / rate,
          note: `${card.plate} — hujjat xarajati`,
        });
      }
      if (fin.ustaFee > 0 && !isContracted) {
        // Oddiy usta — kunlik/xizmat bo'yicha haq, kassadan to'lanadi.
        // Detailing bo'limida — usta haqi "pot"ining 80%i + material summasi ustaga beriladi,
        // 20% servis foydasi sifatida kassada qoladi (profitSum'da allaqachon hisoblangan).
        const isDetailing = card.serviceType === "Detailing";
        const ustaLedgerAmount = isDetailing ? num(fin.ustaTakeHome) : num(fin.ustaFee);
        d.ustaLedger.unshift({
          id: uid(), date: todayISO(), usta: card.usta || "Noma'lum",
          cardId: card.id, amountSum: ustaLedgerAmount, paid: false,
          note: isDetailing ? `Material + usta haqining 80%i (jami pot: ${fmtSum(fin.ustaFee)})` : undefined,
        });
      }
      // Kelishilgan (oylik) usta bo'lsa — fin.ustaFee kassaga chiqim yozilmaydi,
      // profitSum hisobida allaqachon ayirilgan, lekin bu holda uni QAYTA qo'shib,
      // servis foydasiga aylantiramiz (chunki ustaga pul chiqmaydi).
      if (fin.ustaFee > 0 && isContracted) {
        card.profitSum = num(card.profitSum) + num(fin.ustaFee);
        card.contractedUstaBonus = num(fin.ustaFee); // hisobot uchun — qancha "qaytdi"
      }
      // Mijozdan B/U tovar qabul qilingan bo'lsa (chegirma evaziga) — bu tovar
      // hech qayerda ko'rinmay qolmasligi uchun skladga "B/U tovarlar" sifatida kiritamiz.
      (fin.buItems || []).forEach((b) => {
        const price = num(b.price);
        d.products.push({
          id: uid(), name: b.name, unit: "dona", category: "B/U tovarlar",
          costSum: price, priceSum: price, priceUsd: 0, qty: 1,
        });
      });
      return d;
    });
    setWorkCard(null);
  }
  async function deleteCard(id) {
    if (!(await askConfirm(
      "Karta o'chirilsinmi?\n\n" +
      "• Ishlatilgan mahsulotlar skladga QAYTARILADI\n" +
      "• To'lanmagan usta haqi yozuvlari o'chiriladi\n" +
      "• Kassaga yozilgan kirim/chiqimlar ham o'chiriladi\n\n" +
      "Bu amalni ortga qaytarib bo'lmaydi."
    ))) return;
    patch((d) => {
      const card = d.serviceCards.find((c) => c.id === id);
      if (card) {
        // Mahsulotlarni skladga qaytaramiz — karta OCHIQ yoki YAKUNLANGAN bo'lishidan qat'i nazar.
        // Aks holda o'chirib qayta kiritilganda mahsulot ikki marta ayrilib ketadi.
        (card.parts || []).forEach((p) => {
          const prod = d.products.find((x) => x.id === p.productId);
          if (prod) prod.qty = num(prod.qty) + p.qty;
        });
        // Yakunlashda yaratilgan kassa yozuvlarini ham olib tashlaymiz (id'lari kartada saqlangan)
        if (card.cashflowIds && card.cashflowIds.length) {
          d.cashflow = d.cashflow.filter((c) => !card.cashflowIds.includes(c.id));
        }
      }
      d.serviceCards = d.serviceCards.filter((x) => x.id !== id);
      d.ustaLedger = d.ustaLedger.filter((x) => !(x.cardId === id && !x.paid));
      return d;
    });
  }

  function saveEditedCard(cardId, updated) {
    patch((d) => {
      const card = d.serviceCards.find((c) => c.id === cardId);
      if (!card) return d;

      // Usta bu karta uchun ALLAQACHON TO'LANGAN bo'lsa, buni bilib qo'yamiz —
      // aks holda pastda yana bir "to'lanmagan" yozuv yaratib, ustaga ikki marta
      // haq to'lash xavfini keltirib chiqaramiz.
      const ustaAlreadyPaid = d.ustaLedger.some((x) => x.cardId === cardId && x.paid);
      // Eski yakunlash yozuvlarini (kassa, usta hisobi, nasiya) bekor qilamiz —
      // faqat hali to'lanmagan (paid=false) izlarni, chunki to'langanini o'zgartirish
      // moliyaviy tarixni buzadi.
      d.ustaLedger = d.ustaLedger.filter((x) => !(x.cardId === cardId && !x.paid));
      d.nasiyaDebts = (d.nasiyaDebts || []).filter((n) => !(n.cardId === cardId && !n.paid));
      // Eski "Xizmat to'lovi" kassa yozuvlarini olib tashlaymiz (closeCard yoki
      // oldingi tahrirlashda yaratilgan, card.cashflowIds'da saqlangan) — aks
      // holda mijoz to'lovi eski va yangi summa bo'lib ikki marta hisoblanib
      // qolardi. Faqat shu texnik yozuvlarni o'chiramiz, boshqasiga tegmaymiz.
      d.cashflow = d.cashflow.filter((c) => !(card.cashflowIds || []).includes(c.id));
      card.cashflowIds = [];

      Object.assign(card, updated);

      const isNasiya = card.paymentType === "Nasiya (qarzga)";
      const isContracted = (d.contractedMasters || []).some((m) => sameName(m.name, card.usta));
      card.ustaIsContracted = isContracted;

      if (num(updated.finalTotal) > 0 && !isNasiya) {
        const _cfid = uid();
        card.cashflowIds.push(_cfid);
        d.cashflow.unshift({
          id: _cfid, date: card.date || todayISO(), type: "kirim", category: "Xizmat to'lovi",
          currency: "SUM", amount: updated.finalTotal, amountSum: updated.finalTotal,
          amountUsd: updated.finalTotal / rate, paymentType: card.paymentType,
          note: `${card.serviceType} — ${card.carModel || ""} (${card.plate}) — tahrirlangan`,
        });
      }
      if (num(updated.finalTotal) > 0 && isNasiya) {
        d.nasiyaDebts = d.nasiyaDebts || [];
        d.nasiyaDebts.push({
          id: uid(), date: card.date || todayISO(), cardId: card.id,
          plate: card.plate, phone: card.phone, carModel: card.carModel,
          serviceType: card.serviceType, amountSum: updated.finalTotal, paidAmount: 0, paid: false,
        });
      }
      if (num(updated.ustaFee) > 0 && !isContracted && !ustaAlreadyPaid) {
        d.ustaLedger.unshift({
          id: uid(), date: card.date || todayISO(), usta: card.usta || "Noma'lum",
          cardId: card.id, amountSum: updated.ustaFee, paid: false,
        });
      }
      if (num(updated.ustaFee) > 0 && isContracted) {
        card.profitSum = num(card.profitSum) + num(updated.ustaFee);
        card.contractedUstaBonus = num(updated.ustaFee);
      }
      return d;
    });
    setEditCard(null);
  }

  function sendProductRequest(cardId, req) {
    patch((d) => {
      d.productRequests = d.productRequests || [];
      d.productRequests.push({
        id: uid(), cardId, date: todayISO(), time: new Date().toTimeString().slice(0, 5),
        usta: req.usta, plate: req.plate, productName: req.productName,
        qty: req.qty, note: req.note, status: "kutilmoqda",
      });
      return d;
    });
  }

  function resolveRequest(reqId) {
    patch((d) => {
      d.productRequests = (d.productRequests || []).filter((r) => r.id !== reqId);
      return d;
    });
  }

  function openCardForRequest(req) {
    const card = data.serviceCards.find((c) => c.id === req.cardId);
    if (card) setWorkCard(card);
    resolveRequest(req.id);
  }

  const pendingRequests = (data.productRequests || []).slice().reverse();
  const pendingConfirmCards = data.serviceCards.filter((c) => c.pendingConfirm && cardStatus(c) === "ochiq");

  // Oxirgi 7 kunlik kunlik foyda tendensiyasi — "Jami foyda" mini-grafigi uchun.
  const last7Profit = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    return closedCards.filter((c) => c.date === iso).reduce((s, c) => s + num(c.profitSum), 0);
  });

  function confirmCard(cardId) {
    patch((d) => {
      const card = d.serviceCards.find((c) => c.id === cardId);
      if (card) card.pendingConfirm = false;
      return d;
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Xizmat kartalari</h2>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>
            {openCards.length} ta ochiq · {closedCards.length} ta yakunlangan
          </p>
        </div>
        {!isReadOnly && !isSklad && <Btn onClick={() => setNewOpen(true)}><Plus size={15} /> Yangi karta</Btn>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13, marginBottom: 20 }}>
        <Stat label="Ochiq kartalar" value={openCards.length + " ta"} color={T.gold} Icon={Clock} />
        <Stat label="Yakunlangan" value={closedCards.length + " ta"} color={T.blue} Icon={Car} />
        {!hideFinance && <Stat label="Jami tushum" value={fmtSum(totalRevenue)} sub={fmtUsd(totalRevenue / rate)} color={T.teal} Icon={Wallet} />}
        {!hideFinance && <Stat label="Jami foyda" value={fmtSum(totalProfit)} color={T.flame} Icon={TrendingUp} spark={last7Profit} />}
      </div>

      {/* USTA YARATGAN, TASDIQ KUTAYOTGAN KARTALAR — faqat Admin/Kassir ko'radi */}
      {!isUsta && !isSklad && pendingConfirmCards.length > 0 && (
        <div style={{
          background: T.purpleD, border: `1px solid ${T.purple}40`, borderRadius: 11,
          padding: "14px 16px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Car size={15} color={T.purple} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.purple }}>
              {pendingConfirmCards.length} ta usta ochgan karta — tasdiqlash kutilmoqda
            </span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {pendingConfirmCards.map((c) => (
              <div key={c.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: T.s1, borderRadius: 8, padding: "10px 14px", flexWrap: "wrap", gap: 8,
              }}>
                <div style={{ fontSize: 12.5 }}>
                  <b>{c.createdByUsta || c.usta}</b> ochdi — <span className="mo" style={{ color: T.flame }}>{c.plate}</span>
                  <span style={{ color: T.muted }}> ({c.carModel || "mashina"}, {c.serviceType})</span>
                  <span style={{ marginLeft: 8 }}>
                    Mahsulot: <b>{fmtSum(cardPartsCost(c))}</b> · Usta haqi: <b style={{ color: T.gold }}>{fmtSum(cardUstaFeeSum(c))}</b>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn size="sm" variant="teal" onClick={() => confirmCard(c.id)}>Tasdiqlash</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setWorkCard(c)}>Ko'rish</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* USTALARDAN MAHSULOT SO'ROVLARI — faqat Admin/Kassir ko'radi */}
      {!isUsta && pendingRequests.length > 0 && (
        <div style={{
          background: T.goldD, border: `1px solid ${T.gold}40`, borderRadius: 11,
          padding: "14px 16px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <PhoneCall size={15} color={T.gold} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>
              {pendingRequests.length} ta usta mahsulot so'rovi
            </span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {pendingRequests.map((r) => (
              <div key={r.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: T.s1, borderRadius: 8, padding: "10px 14px", flexWrap: "wrap", gap: 8,
              }}>
                <div style={{ fontSize: 12.5 }}>
                  <b>{r.usta}</b> — <span className="mo" style={{ color: T.flame }}>{r.plate}</span> uchun:
                  <span style={{ fontWeight: 600 }}> {r.productName} × {r.qty}</span>
                  {r.note && <span style={{ color: T.muted }}> ({r.note})</span>}
                  <span style={{ color: T.muted, fontSize: 11, marginLeft: 8 }}>{r.time}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn size="sm" variant="teal" onClick={() => openCardForRequest(r)}>Kartaga o'tish</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => resolveRequest(r.id)}>Bajarildi</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OCHIQ KARTALAR */}
      {openCards.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="bc" style={{ fontSize: 15, fontWeight: 700, color: T.gold, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
            <Clock size={15} /> Ochiq kartalar
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 12 }}>
            {openCards.map((c) => (
              <div key={c.id} className="ch" onClick={() => setWorkCard(c)} style={{
                background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12,
                cursor: "pointer", overflow: "hidden", transition: "all .15s",
                borderLeft: `3px solid ${SERVICE_COLORS[c.serviceType] || T.flame}`,
              }}>
                <div style={{ padding: "13px 15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div className="mo" style={{ fontSize: 15, fontWeight: 700, color: T.flame }}>{c.plate}</div>
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{c.carModel || "—"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {c.pendingConfirm && !isUsta && <Badge color={T.purple}>Tasdiq kutmoqda</Badge>}
                      <Badge color={SERVICE_COLORS[c.serviceType] || T.flame}>{c.serviceType}</Badge>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T.muted, marginBottom: 8 }}>
                    <span>👤 {c.usta || "Usta yo'q"}</span>
                    <span className="mo">{fmtDate(c.date)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, paddingTop: 9, borderTop: `1px solid ${T.border}` }}>
                    <div>
                      <div style={{ fontSize: 9.5, color: T.muted }}>MAHSULOT</div>
                      <div className="mo" style={{ fontSize: 12, fontWeight: 600 }}>{fmtSum(cardPartsCost(c))}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, color: T.muted }}>USTA HAQI</div>
                      <div className="mo" style={{ fontSize: 12, fontWeight: 600, color: T.gold }}>{fmtSum(cardUstaFeeSum(c))}</div>
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: "9px 15px", background: T.s2,
                  borderTop: `1px solid ${T.border}`, display: "flex",
                  alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 11.5, color: T.flame, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                    <PlayCircle size={12} /> Davom ettirish
                  </span>
                  {!isUsta && !isSklad && (
                    <button onClick={(e) => { e.stopPropagation(); deleteCard(c.id); }} style={{
                      background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 3,
                    }}><Trash2 size={12} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEARCH + CLOSED */}
      <div style={{ position: "relative", marginBottom: 12, maxWidth: 320 }}>
        <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Raqam, mashina, telefon..." style={{ ...iSt, paddingLeft: 32 }} />
      </div>

      <Card title={`Yakunlangan kartalar (${closedCards.length})`} pad={false}>
        <div style={{ padding: "14px 18px" }}>
        <DateGroupedList
          empty="Yakunlangan karta yo'q"
          amountFn={hideFinance ? null : (r) => num(r.profitSum)}
          cols={[
            { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
            { k: "plate", h: "Raqam", r: (r) => <span className="mo" style={{ fontWeight: 700, color: T.flame }}>{r.plate}</span> },
            ...(!isUsta ? [
              { k: "phone", h: "Telefon", r: (r) => <span className="mo" style={{ fontSize: 12 }}>{r.phone || "—"}</span> },
            ] : []),
            { k: "carModel", h: "Mashina" },
            { k: "serviceType", h: "Xizmat", r: (r) => <Badge color={SERVICE_COLORS[r.serviceType] || T.blue}>{r.serviceType}</Badge> },
            { k: "usta", h: "Usta", r: (r) => r.usta || "—" },
            ...(!hideFinance ? [
              { k: "partsCost", h: "Tan narx", r: (r) => <span style={{ color: T.muted2 }}>{fmtSum(cardPartsCost(r))}</span> },
            ] : []),
            { k: "ustaFee", h: "Usta haqi", r: (r) => <span style={{ color: T.gold }}>{fmtSum(cardUstaFeeSum(r))}</span> },
            ...(!hideFinance ? [
              { k: "finalTotal", h: "Yakuniy", r: (r) => <span className="mo" style={{ fontWeight: 700 }}>{fmtSum(r.finalTotal)}</span> },
              { k: "profitSum", h: "Foyda", r: (r) => <span className="mo" style={{ fontWeight: 700, color: num(r.profitSum) >= 0 ? T.teal : T.red }}>{fmtSum(r.profitSum)}</span> },
            ] : []),
            { k: "view", h: "", r: (r) => <button onClick={() => setViewCard(r)} style={{ background: "none", border: "none", cursor: "pointer", color: T.blue }}><Search size={13} /></button> },
            ...(!hideFinance ? [
              { k: "edit", h: "", r: (r) => <button onClick={() => setEditPinOpen(r)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}><Pencil size={13} /></button> },
              { k: "del", h: "", r: (r) => <button onClick={() => deleteCard(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}><Trash2 size={13} /></button> },
            ] : []),
          ]}
          rows={closedCards}
        />
        </div>
      </Card>

      {viewCard && <CardDetailModal card={viewCard} isUsta={hideFinance} onClose={() => setViewCard(null)} />}

      {newOpen && <NewCardModal data={data} isUsta={isUsta} ustaName={ustaName} onClose={() => setNewOpen(false)} onSave={createCard} />}
      {workCard && (
        <CardWorkspace
          card={data.serviceCards.find((c) => c.id === workCard.id) || workCard}
          products={data.products}
          role={role}
          rate={rate}
          saveState={saveState}
          noteSuggestions={noteSuggestions}
          onClose={() => setWorkCard(null)}
          onAddPart={(p) => addPart(workCard.id, p)}
          onAddNewProduct={(prod, qty, useSale) => addNewProductAndPart(workCard.id, prod, qty, useSale)}
          onRemovePart={(i) => removePart(workCard.id, i)}
          onAddFee={(a, n) => addFee(workCard.id, a, n)}
          onRemoveFee={(id) => removeFee(workCard.id, id)}
          onFinalize={(fin) => closeCard(workCard.id, fin)}
          onProductRequest={(req) => sendProductRequest(workCard.id, req)}
        />
      )}
      {editPinOpen && !hideFinance && (
        <SimplePinModal onClose={() => setEditPinOpen(null)}
          onSuccess={() => { setEditCard(editPinOpen); setEditPinOpen(null); }} />
      )}
      {editCard && !hideFinance && (
        <EditFinishedCardModal
          card={editCard} products={data.products} ustaNames={ustaNameOptions(data)}
          onClose={() => setEditCard(null)}
          onSave={(updated) => saveEditedCard(editCard.id, updated)}
        />
      )}
    </div>
  );
}

function NewCardModal({ data, isUsta, ustaName, onClose, onSave }) {
  const ustaNames = ustaNameOptions(data);
  const [f, setF] = useState({
    date: todayISO(), plate: "", phone: "", carModel: "", usta: isUsta ? (ustaName || "") : "",
    serviceType: "Servis", paymentType: PAYMENT_TYPES[0],
    hasWarranty: false, warrantyMonths: 6, oneTime: false,
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target?.value ?? e }));
  const canSave = f.oneTime || f.plate.trim();

  return (
    <Modal title="Yangi xizmat kartasi" onClose={onClose} wide>
      <label style={{
        display: "flex", alignItems: "center", gap: 9, marginBottom: 14,
        padding: "11px 14px", background: T.s3, borderRadius: 9, cursor: "pointer", fontSize: 13,
      }}>
        <input type="checkbox" checked={f.oneTime}
          onChange={(e) => setF((s) => ({ ...s, oneTime: e.target.checked }))}
          style={{ accentColor: T.flame, width: 15, height: 15 }} />
        Bir martalik mijoz (davlat raqami shart emas)
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Sana"><input type="date" style={iSt} value={f.date} onChange={set("date")} /></F>
        <F label={f.oneTime ? "Davlat raqami" : "Davlat raqami *"}>
          <input style={iSt} value={f.plate} onChange={set("plate")} placeholder="01 A 123 BC" />
        </F>
        <F label="Telefon"><input style={iSt} value={f.phone} onChange={set("phone")} placeholder="+998 90 000 00 00" /></F>
        <F label="Avtomobil modeli"><input style={iSt} value={f.carModel} onChange={set("carModel")} /></F>
        <F label="Xizmat turi"><Sel value={f.serviceType} onChange={set("serviceType")} options={SERVICE_TYPES} /></F>
        <F label="To'lov turi"><Sel value={f.paymentType} onChange={set("paymentType")} options={PAYMENT_TYPES} /></F>
        <F label="Usta ismi" col="1/-1">
          {isUsta ? (
            <input style={{ ...iSt, background: T.s3, color: T.muted }} value={f.usta} disabled readOnly />
          ) : (
            <>
              <input style={iSt} value={f.usta} onChange={set("usta")} list="usta-list" placeholder="Usta ismi" />
              <datalist id="usta-list">{ustaNames.map((n) => <option key={n} value={n} />)}</datalist>
            </>
          )}
        </F>
      </div>

      <label style={{
        display: "flex", alignItems: "center", gap: 9, marginTop: 14,
        paddingTop: 14, borderTop: `1px solid ${T.border}`, cursor: "pointer", fontSize: 13,
      }}>
        <input type="checkbox" checked={f.hasWarranty}
          onChange={(e) => setF((s) => ({ ...s, hasWarranty: e.target.checked }))}
          style={{ accentColor: T.teal, width: 15, height: 15 }} />
        <ShieldCheck size={14} color={T.teal} /> Kafolat berilsin
        {f.hasWarranty && (
          <input type="number" style={{ ...iSt, width: 80, marginLeft: 8 }}
            value={f.warrantyMonths} onChange={set("warrantyMonths")} placeholder="oy" />
        )}
      </label>

      <p style={{ fontSize: 11.5, color: T.muted, marginTop: 12 }}>
        Karta "ochiq" holatda ochiladi. Ish davomida mahsulot va usta haqini qo'shib borasiz.
      </p>

      <SaveBtn disabled={!canSave} onClick={() => onSave({ ...f, usta: f.usta.trim(), plate: f.plate.trim() || "Bir martalik" })}>
        <Plus size={15} /> Kartani ochish
      </SaveBtn>
    </Modal>
  );
}

function CardDetailModal({ card, isUsta, onClose }) {
  const parts = card.parts || [];
  const fees = card.ustaFeeEntries || [];
  const buItems = card.buItems || [];
  const payLines = card.payLines || [];
  const partsCost = cardPartsCost(card);
  const feeSum = cardUstaFeeSum(card);

  return (
    <Modal title={`To'liq tafsilot — ${card.plate}`} onClose={onClose} wide>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16, flexWrap: "wrap" }}>
        <Badge color={T.blue}>YAKUNLANGAN</Badge>
        <Badge color={SERVICE_COLORS[card.serviceType] || T.blue}>{card.serviceType}</Badge>
        <span style={{ fontSize: 12, color: T.muted }}>{fmtDate(card.date)}</span>
        {card.pendingConfirm && <Badge color={T.purple}>Tasdiq kutmoqda</Badge>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: T.s3, borderRadius: 8, padding: "9px 13px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase" }}>Mashina</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{card.carModel || "—"} <span className="mo" style={{ color: T.flame }}>{card.plate}</span></div>
        </div>
        <div style={{ background: T.s3, borderRadius: 8, padding: "9px 13px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase" }}>Telefon</div>
          <div className="mo" style={{ fontSize: 13, fontWeight: 600 }}>{isUsta ? "Berkitilgan" : (card.phone || "—")}</div>
        </div>
        <div style={{ background: T.s3, borderRadius: 8, padding: "9px 13px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase" }}>Usta</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{card.usta || "—"} {card.ustaIsContracted && <Badge color={T.purple}>Kelishilgan</Badge>}</div>
        </div>
        <div style={{ background: T.s3, borderRadius: 8, padding: "9px 13px" }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase" }}>To'lov turi</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{card.paymentType || "—"}</div>
        </div>
      </div>

      {parts.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted2, marginBottom: 8 }}>
            Ishlatilgan mahsulotlar
          </div>
          {parts.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: T.s3, borderRadius: 7, marginBottom: 5 }}>
              <span style={{ fontSize: 12.5 }}>{p.name} × {p.qty}</span>
              <span className="mo" style={{ fontSize: 12.5, color: T.muted2 }}>{fmtSum(p.lineTotal)}</span>
            </div>
          ))}
        </div>
      )}

      {fees.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.gold, marginBottom: 8 }}>
            Usta xizmat haqi yozuvlari
          </div>
          {fees.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: T.goldD, borderRadius: 7, marginBottom: 5 }}>
              <span style={{ fontSize: 12.5 }}>{e.note || "(izohsiz)"}</span>
              <span className="mo" style={{ fontSize: 12.5, color: T.gold, fontWeight: 600 }}>{fmtSum(e.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {buItems.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.purple, marginBottom: 8 }}>
            B/U tovar qabul qilingan
          </div>
          {buItems.map((b, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: T.purpleD, borderRadius: 7, marginBottom: 5 }}>
              <span style={{ fontSize: 12.5 }}>{b.name}</span>
              <span className="mo" style={{ fontSize: 12.5, color: T.purple }}>−{fmtSum(b.price)}</span>
            </div>
          ))}
        </div>
      )}

      {!isUsta && payLines.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.teal, marginBottom: 8 }}>
            To'lov taqsimoti
          </div>
          {payLines.map((l, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: T.tealD, borderRadius: 7, marginBottom: 5 }}>
              <span style={{ fontSize: 12.5 }}>{l.paymentType} {l.currency === "USD" && <span style={{ color: T.gold }}>(USD)</span>}</span>
              <span className="mo" style={{ fontSize: 12.5, color: T.teal, fontWeight: 600 }}>{l.currency === "USD" ? fmtUsd(l.amount) : fmtSum(l.amountSum)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: T.s2, borderRadius: 10, padding: "14px 16px", marginTop: 8 }}>
        {[
          !isUsta && ["Tan narx", partsCost, T.muted2],
          ["Usta haqi", feeSum, T.gold],
          !isUsta && card.docFee > 0 && ["Hujjat xarajati", card.docFee, T.red],
          !isUsta && ["━ Yakuniy summa", card.finalTotal, T.flame],
          !isUsta && ["Servis foydasi", card.profitSum, num(card.profitSum) >= 0 ? T.teal : T.red],
        ].filter(Boolean).map(([l, v, c]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}25` }}>
            <span style={{ fontSize: 12.5, fontWeight: String(l).includes("━") ? 700 : 400, color: String(l).includes("━") ? T.text : T.muted }}>{String(l).replace("━ ", "")}</span>
            <span className="mo" style={{ fontSize: String(l).includes("━") ? 14 : 12.5, fontWeight: 700, color: c }}>{fmtSum(v)}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function EditFinishedCardModal({ card, products, ustaNames, onClose, onSave }) {
  const [f, setF] = useState({
    plate: card.plate || "", phone: card.phone || "", carModel: card.carModel || "",
    usta: card.usta || "", serviceType: card.serviceType, paymentType: card.paymentType,
    ustaFee: String(Math.round(num(card.ustaFee))),
    finalTotal: String(Math.round(num(card.finalTotal))),
    docFee: String(Math.round(num(card.docFee || 0))),
    hasWarranty: !!card.hasWarranty, warrantyMonths: card.warrantyMonths || 6,
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target?.value ?? e }));

  const partsCost = cardPartsCost(card);
  const profitSum = num(f.finalTotal) - partsCost - num(f.ustaFee) - num(f.docFee);

  return (
    <Modal title={`Kartani tahrirlash — ${card.plate}`} onClose={onClose} wide>
      <div style={{ padding: "10px 14px", background: T.goldD, border: `1px solid ${T.gold}30`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: T.gold, display: "flex", alignItems: "center", gap: 8 }}>
        <Lock size={13} /> Bu karta allaqachon yakunlangan. O'zgarishlar moliyaviy yozuvlarni yangilaydi.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Davlat raqami"><input style={iSt} value={f.plate} onChange={set("plate")} /></F>
        <F label="Telefon"><input style={iSt} value={f.phone} onChange={set("phone")} /></F>
        <F label="Avtomobil modeli"><input style={iSt} value={f.carModel} onChange={set("carModel")} /></F>
        <F label="Usta ismi">
          <input style={iSt} value={f.usta} onChange={set("usta")} list="edit-usta-list" />
          <datalist id="edit-usta-list">{ustaNames.map((n) => <option key={n} value={n} />)}</datalist>
        </F>
        <F label="Xizmat turi"><Sel value={f.serviceType} onChange={set("serviceType")} options={SERVICE_TYPES} /></F>
        <F label="To'lov turi"><Sel value={f.paymentType} onChange={set("paymentType")} options={PAYMENT_TYPES} /></F>
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
          Mahsulotlar (tan narx: {fmtSum(partsCost)}) — bu qismni o'zgartirish uchun avval kartani ochib qayta ishlang
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <F label="Usta xizmat haqi"><input type="number" style={iSt} value={f.ustaFee} onChange={set("ustaFee")} /></F>
          <F label="Hujjat xarajati"><input type="number" style={iSt} value={f.docFee} onChange={set("docFee")} /></F>
          <F label="Yakuniy summa"><input type="number" style={iSt} value={f.finalTotal} onChange={set("finalTotal")} /></F>
        </div>
      </div>

      <label style={{
        display: "flex", alignItems: "center", gap: 9, marginTop: 14,
        paddingTop: 14, borderTop: `1px solid ${T.border}`, cursor: "pointer", fontSize: 13,
      }}>
        <input type="checkbox" checked={f.hasWarranty}
          onChange={(e) => setF((s) => ({ ...s, hasWarranty: e.target.checked }))}
          style={{ accentColor: T.teal, width: 15, height: 15 }} />
        <ShieldCheck size={14} color={T.teal} /> Kafolat berilsin
        {f.hasWarranty && (
          <input type="number" style={{ ...iSt, width: 80, marginLeft: 8 }}
            value={f.warrantyMonths} onChange={set("warrantyMonths")} placeholder="oy" />
        )}
      </label>

      <div style={{ marginTop: 14, padding: "12px 14px", background: T.s3, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, color: T.muted }}>Yangi hisoblangan foyda</span>
        <span className="mo" style={{ fontWeight: 700, color: profitSum >= 0 ? T.teal : T.red }}>{fmtSum(profitSum)}</span>
      </div>

      <SaveBtn color={T.gold} onClick={() => onSave({
        plate: f.plate.trim(), phone: f.phone.trim(), carModel: f.carModel.trim(),
        usta: f.usta.trim(), serviceType: f.serviceType, paymentType: f.paymentType,
        ustaFee: num(f.ustaFee), docFee: num(f.docFee), finalTotal: num(f.finalTotal),
        profitSum, hasWarranty: f.hasWarranty, warrantyMonths: num(f.warrantyMonths),
      })}>
        <Save size={15} /> O'zgarishlarni saqlash
      </SaveBtn>
    </Modal>
  );
}

function CardWorkspace({ card, products, role, rate, saveState, noteSuggestions, onClose, onAddPart, onAddNewProduct, onRemovePart, onAddFee, onRemoveFee, onFinalize, onProductRequest }) {
  const isUsta = role === "usta";
  const isSklad = role === "sklad";
  const hideFinance = isUsta || isSklad; // Sklad ham narx/foyda va yakunlashni ko'rmaydi, faqat mahsulot biriktiradi
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [qty, setQty] = useState(1);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeNote, setFeeNote] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqQty, setReqQty] = useState(1);
  const [reqNote, setReqNote] = useState("");
  const [showNewProd, setShowNewProd] = useState(false);
  const [npName, setNpName] = useState("");
  const [npCost, setNpCost] = useState("");
  const [npPrice, setNpPrice] = useState("");
  const [npQty, setNpQty] = useState(1);
  const [reqSent, setReqSent] = useState(false);
  const [addPartError, setAddPartError] = useState("");
  const [addFeeError, setAddFeeError] = useState("");

  const parts = card.parts || [];
  const fees = card.ustaFeeEntries || [];
  const partsCost = cardPartsCost(card);
  const feeSum = cardUstaFeeSum(card);

  // Servis / Moy → sotish narxi; Ustanovka → tan narx
  const useSalePrice = card.serviceType === "Servis" || card.serviceType === "Moy bo'limi";

  function add() {
    setAddPartError("");
    const p = products.find((x) => x.id === productId);
    if (!p) { setAddPartError("Mahsulot tanlanmagan — ro'yxatdan tanlang."); return; }
    const q = num(qty);
    if (q <= 0) { setAddPartError("Miqdorni to'g'ri kiriting."); return; }
    if (q > num(p.qty)) {
      setAddPartError(`Skladda yetarli emas: "${p.name}" — bor-yo'g'i ${p.qty} ${p.unit}. Kamroq son kiriting yoki "Skladda yo'q mahsulot" orqali qo'shing.`);
      return;
    }
    const unit = useSalePrice ? num(p.priceSum) : num(p.costSum);
    onAddPart({
      productId: p.id, name: p.name, qty: q,
      unitCost: unit, lineTotal: q * unit,
      costUnit: num(p.costSum), saleUnit: num(p.priceSum),
    });
    setQty(1);
  }

  function addNewProd() {
    if (!npName.trim() || !onAddNewProduct) return;
    onAddNewProduct(
      { name: npName.trim(), costSum: num(npCost), priceSum: num(npPrice) },
      num(npQty), useSalePrice
    );
    setNpName(""); setNpCost(""); setNpPrice(""); setNpQty(1);
    setShowNewProd(false);
  }

  function addFeeFn() {
    setAddFeeError("");
    const a = num(feeAmount);
    if (a <= 0) { setAddFeeError("Summani to'g'ri kiriting (masalan: 50000)."); return; }
    onAddFee(a, feeNote.trim());
    setFeeAmount(""); setFeeNote("");
  }

  function sendRequest() {
    if (!reqName.trim()) return;
    onProductRequest({
      usta: card.usta || "Noma'lum", plate: card.plate,
      productName: reqName.trim(), qty: num(reqQty), note: reqNote.trim(),
    });
    setReqName(""); setReqQty(1); setReqNote("");
    setReqSent(true);
    setTimeout(() => setReqSent(false), 2500);
  }

  if (finalizing)
    return <FinalizeModal card={card} partsCost={partsCost} feeSum={feeSum} rate={rate}
      onBack={() => setFinalizing(false)} onClose={onClose} onSave={onFinalize} />;

  return (
    <Modal title={`${card.plate} — ${card.carModel || ""}`} onClose={onClose} wide>
      {(saveState === "error" || saveState === "conflict") && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14,
          background: T.redD, border: `1px solid ${T.red}60`, borderRadius: 9, padding: "10px 13px",
        }}>
          <AlertTriangle size={15} color={T.red} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12.5, color: T.red, lineHeight: 1.5 }}>
            {saveState === "conflict"
              ? "Diqqat: ma'lumotlar serverga saqlanmayapti (boshqa qurilma yangilagan). Sahifani qayta yuklang, aks holda bu yozuvlar yo'qolishi mumkin."
              : "Diqqat: internet aloqasi yo'q yoki server bilan bog'lanib bo'lmadi — o'zgarishlar hali saqlanmadi. Internetni tekshiring."}
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16, flexWrap: "wrap" }}>
        <Badge color={T.gold}>OCHIQ</Badge>
        <Badge color={SERVICE_COLORS[card.serviceType]}>{card.serviceType}</Badge>
        <span style={{ fontSize: 12, color: T.muted }}>
          {card.usta ? `👤 ${card.usta}` : "Usta belgilanmagan"} · {fmtDate(card.date)}
        </span>
      </div>

      {/* MAHSULOT — Detailing bo'limida ko'rinmaydi, chunki usta o'z materialidan foydalanadi */}
      {card.serviceType !== "Detailing" ? (
      <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 11, padding: 15, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted2 }}>
            Mahsulot qo'shish — {useSalePrice ? "sotish narxida" : "tan narxida"}
          </div>
          {onAddNewProduct && (
            <button onClick={() => setShowNewProd((s) => !s)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: T.gold, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
            }}>
              <Plus size={12} /> {showNewProd ? "Bekor qilish" : "Skladda yo'q — yangi mahsulot"}
            </button>
          )}
        </div>

        {showNewProd && (
          <div style={{ background: T.goldD, border: `1px solid ${T.gold}30`, borderRadius: 9, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input style={{ ...iSt, flex: 2, minWidth: 140 }} placeholder="Mahsulot nomi"
                value={npName} onChange={(e) => setNpName(e.target.value)} />
              <input type="number" style={{ ...iSt, width: 65 }} placeholder="Soni"
                value={npQty} onChange={(e) => setNpQty(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <input type="number" style={{ ...iSt, flex: 1 }} placeholder="Tannarx (kelish narxi)"
                value={npCost} onChange={(e) => setNpCost(e.target.value)} />
              <input type="number" style={{ ...iSt, flex: 1 }} placeholder="Sotish narxi"
                value={npPrice} onChange={(e) => setNpPrice(e.target.value)} />
            </div>
            <Btn onClick={addNewProd} color={T.gold} style={{ width: "100%", justifyContent: "center" }}>
              <Plus size={13} /> Qo'shish va biriktirish
            </Btn>
            <p style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>
              Bu mahsulot skladga ham avtomatik kiritiladi (keyingi safar ro'yxatdan tanlash mumkin).
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: parts.length ? 12 : 0, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 170 }}>
            {products.length ? (
              <SearchSelect value={productId} onChange={setProductId} placeholder="Mahsulot nomini yozing..."
                options={products.map((p) => ({ value: p.id, label: p.name, sub: `${p.qty} ${p.unit}` }))} />
            ) : (
              <Sel value="" onChange={() => {}} options={[{ value: "", label: "Sklad bo'sh" }]} />
            )}
          </div>
          <input type="number" style={{ ...iSt, width: 72 }} value={qty} onChange={(e) => setQty(e.target.value)} />
          <Btn onClick={add} size="md"><Plus size={14} /></Btn>
        </div>
        {addPartError && (
          <div style={{ fontSize: 11.5, color: T.red, marginBottom: parts.length ? 10 : 2, lineHeight: 1.5 }}>
            ⚠ {addPartError}
          </div>
        )}
        {parts.map((p, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: T.s3, borderRadius: 8, padding: "9px 13px", marginBottom: 6,
          }}>
            <span style={{ fontSize: 13 }}>{p.name} × {p.qty}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="mo" style={{ fontSize: 12.5, color: T.muted2 }}>{fmtSum(p.lineTotal)}</span>
              <button onClick={() => onRemovePart(i)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 11, marginTop: 6, borderTop: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 12.5, color: T.muted }}>Jami mahsulot</span>
          <span className="mo" style={{ fontSize: 13, fontWeight: 700, color: T.flame }}>{fmtSum(partsCost)}</span>
        </div>
      </div>
      ) : (
        <div style={{ background: T.goldD, border: `1px solid ${T.gold}30`, borderRadius: 11, padding: 15, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, color: T.muted2, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <AlertTriangle size={15} color={T.gold} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              <b>Detailing — sklad mahsuloti biriktirilmaydi.</b> Usta o'z materialidan foydalanadi.
              Material xarajati va usta haqi — kartani yakunlashda kiritiladi, va ikkalasi ham
              kun oxirida ustaning o'ziga to'liq beriladi. Servis faqat usta haqidan 20% ushlab qoladi.
            </span>
          </div>
        </div>
      )}
      {/* USTA UCHUN QO'SHIMCHA — skladda yo'q mahsulot uchun so'rov */}
      {isUsta && (
        <div style={{ background: T.goldD, border: `1px solid ${T.gold}30`, borderRadius: 11, padding: 15, marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.gold, marginBottom: 10 }}>
            Skladda yo'q mahsulot — Kassirga so'rov
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input style={{ ...iSt, flex: 2, minWidth: 140 }} placeholder="Ehtiyot qism nomi"
              value={reqName} onChange={(e) => setReqName(e.target.value)} />
            <input type="number" style={{ ...iSt, width: 70 }} placeholder="Soni"
              value={reqQty} onChange={(e) => setReqQty(e.target.value)} />
          </div>
          <input style={{ ...iSt, marginBottom: 10 }} placeholder="Izoh (ixtiyoriy)"
            value={reqNote} onChange={(e) => setReqNote(e.target.value)} />
          <Btn onClick={sendRequest} color={T.gold} style={{ width: "100%", justifyContent: "center" }}>
            <PhoneCall size={14} /> {reqSent ? "Yuborildi ✓" : "Kassirga yuborish"}
          </Btn>
        </div>
      )}

      {/* USTA HAQI — hamma rol uchun ochiq, lekin Detailingda ko'rinmaydi (kelishuv summasidan hisoblanadi) */}
      {card.serviceType !== "Detailing" ? (
      <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 11, padding: 15, marginBottom: 16 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted2, marginBottom: 10 }}>
          Usta xizmat haqi
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: fees.length ? 12 : 0, flexWrap: "wrap" }}>
          <input type="number" style={{ ...iSt, flex: 1, minWidth: 110 }} placeholder="Summa"
            value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
          <input style={{ ...iSt, flex: 1, minWidth: 130 }} placeholder="Izoh (masalan: Filtr almashtirish)"
            list="usta-note-list"
            value={feeNote} onChange={(e) => setFeeNote(e.target.value)} />
          <datalist id="usta-note-list">
            {(noteSuggestions || []).map((n) => <option key={n} value={n} />)}
          </datalist>
          <Btn onClick={addFeeFn} size="md"><Plus size={14} /></Btn>
        </div>
        {addFeeError && (
          <div style={{ fontSize: 11.5, color: T.red, marginBottom: fees.length ? 10 : 2, lineHeight: 1.5 }}>
            ⚠ {addFeeError}
          </div>
        )}
        {fees.map((e) => (
          <div key={e.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: T.s3, borderRadius: 8, padding: "9px 13px", marginBottom: 6,
          }}>
            <span style={{ fontSize: 13 }}>{e.note || "Usta xizmat haqi"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="mo" style={{ fontSize: 12.5, color: T.gold }}>{fmtSum(e.amount)}</span>
              <button onClick={() => onRemoveFee(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 11, marginTop: 6, borderTop: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 12.5, color: T.muted }}>Jami usta haqi</span>
          <span className="mo" style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{fmtSum(feeSum)}</span>
        </div>
      </div>
      ) : (
        <div style={{ background: T.purpleD, border: `1px solid ${T.purple}30`, borderRadius: 11, padding: 15, marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: T.muted2, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <AlertTriangle size={15} color={T.purple} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              <b>Detailing — usta haqi bu yerda kiritilmaydi.</b> Mijoz bilan <b>kelishilgan summa</b>
              va <b>material xarajati</b> kartani yakunlashda kiritiladi — usta haqi shulardan
              avtomatik hisoblanadi (kelishuv − material).
            </span>
          </div>
        </div>
      )}

      {!hideFinance ? (
        <>
          <SaveBtn onClick={() => setFinalizing(true)} color={T.teal}>
            <Check size={16} /> Kartani yakunlash
          </SaveBtn>
          <p style={{ fontSize: 11, color: T.muted, textAlign: "center", marginTop: 9 }}>
            Yopsangiz ham ma'lumotlar saqlanadi — keyinroq davom ettirasiz
          </p>
        </>
      ) : (
        <p style={{ fontSize: 12, color: T.muted, textAlign: "center", marginTop: 9, padding: "10px 14px", background: T.s3, borderRadius: 8 }}>
          {isSklad
            ? "Mahsulot biriktirildi. Narxlash va yakunlash uchun kartani Kassaga yuboring — Kassir/Admin yakunlaydi."
            : "Xizmat haqingiz yozildi. Kartani yakunlash uchun Kassir/Adminga murojaat qiling."}
        </p>
      )}
    </Modal>
  );
}

function FinalizeModal({ card, partsCost, feeSum, rate, onBack, onClose, onSave }) {
  const [submitted, setSubmitted] = useState(false);
  const [agreedSum, setAgreedSum] = useState("");
  const [percent, setPercent] = useState(20);
  const [discount, setDiscount] = useState(0);
  const [docFee, setDocFee] = useState("");
  const [ustaFee, setUstaFee] = useState(String(Math.round(feeSum)));
  const [materialCost, setMaterialCost] = useState("");
  const [buItems, setBuItems] = useState([]);
  const [payLines, setPayLines] = useState([
    { id: uid(), paymentType: card.paymentType || PAYMENT_TYPES[0], currency: "SUM", amount: "" },
  ]);

  const uf = num(ustaFee);
  const disc = num(discount);
  const doc = num(docFee);
  const buTotal = buItems.reduce((s, b) => s + num(b.price), 0);

  // Mahsulotning haqiqiy tannarxi (kelish narxi) — foyda hisobida shu ishlatiladi,
  // sotish narxi emas, aks holda mahsulot foydasi umuman hisobga kirmay qoladi.
  const partsCostBuy = (card.parts || []).reduce((s, p) => s + num(p.qty) * num(p.costUnit ?? p.unitCost ?? 0), 0);

  let finalTotal = 0, effectiveParts = partsCost, realPartsCost = partsCostBuy;
  let ustaTakeHome = 0; // Detailing uchun — ustaga kun oxirida beriladigan (material + 80% usta haqi)

  if (card.serviceType === "Ustanovka") {
    // Ustanovkada mahsulot allaqachon tan narxida hisoblangan (mijozga ko'rinmaydi)
    finalTotal = num(agreedSum);
    realPartsCost = partsCost; // partsCost bu yerda allaqachon tan narx
  } else if (card.serviceType === "Servis") {
    // ustama faqat usta haqiga, mahsulot mijozga sotish narxida ko'rsatiladi
    finalTotal = Math.max(0, partsCost + uf * (1 + num(percent) / 100) - disc);
    realPartsCost = partsCostBuy; // foyda hisobida — haqiqiy tannarx
  } else if (card.serviceType === "Detailing") {
    // Kelishuv summasi kiritiladi → mahsulot summasi ayriladi → qolgani "usta haqi pot"i.
    // Shundan 20% servis foydasi, 80% ustaga beriladi (material bilan birga).
    effectiveParts = num(materialCost);
    finalTotal = Math.max(0, num(agreedSum) - disc);
    realPartsCost = effectiveParts;
  } else {
    // Moy bo'limi — mahsulot sotish narxida, foyda = sotish − tannarx
    finalTotal = Math.max(0, partsCost - disc);
    realPartsCost = partsCostBuy;
  }

  finalTotal = Math.max(0, finalTotal - buTotal);

  // Detailing — usta haqi "pot"i va 80/20 taqsimoti finalTotal to'liq aniqlangandan keyin hisoblanadi
  let ustaFeePot = uf;
  let profitSum;
  if (card.serviceType === "Detailing") {
    ustaFeePot = Math.max(0, finalTotal - effectiveParts);
    const servisCut = ustaFeePot * 0.2;
    ustaTakeHome = effectiveParts + ustaFeePot * 0.8;
    profitSum = servisCut - doc;
  } else {
    profitSum = finalTotal - realPartsCost - uf - doc;
  }
  const productProfit = card.serviceType !== "Ustanovka" && card.serviceType !== "Detailing" ? partsCost - partsCostBuy : 0;

  return (
    <Modal title={`Yakunlash — ${card.plate}`} onClose={onClose} wide>
      <button onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer",
        color: T.muted, fontSize: 12, marginBottom: 14, padding: 0,
      }}>← Orqaga (davom ettirish)</button>

      <div style={{
        display: "flex", justifyContent: "space-between",
        padding: "11px 14px", background: T.s3, borderRadius: 8, marginBottom: 14,
      }}>
        <span style={{ fontSize: 12.5, color: T.muted }}>Jami mahsulot</span>
        <span className="mo" style={{ fontWeight: 700, color: T.flame }}>{fmtSum(partsCost)}</span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted2 }}>
            To'lov taqsimoti — mijoz qanday to'laydi
          </span>
          <button onClick={() => setPayLines((s) => [...s, { id: uid(), paymentType: PAYMENT_TYPES[0], currency: "SUM", amount: "" }])}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.gold, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={12} /> Yana bir usul (bo'lib to'lash)
          </button>
        </div>

        {payLines.map((line, i) => {
          const lineSum = toSum(line.amount, line.currency, rate);
          return (
            <div key={line.id} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 2, minWidth: 140 }}>
                <Sel value={line.paymentType} onChange={(e) => setPayLines((s) => s.map((l) => l.id === line.id ? { ...l, paymentType: e.target.value } : l))} options={PAYMENT_TYPES} />
              </div>
              <div style={{ width: 90 }}>
                <CurrencyToggle value={line.currency} onChange={(c) => setPayLines((s) => s.map((l) => l.id === line.id ? { ...l, currency: c } : l))} />
              </div>
              <input type="number" style={{ ...iSt, flex: 1, minWidth: 110 }} placeholder="Summa"
                value={line.amount} onChange={(e) => setPayLines((s) => s.map((l) => l.id === line.id ? { ...l, amount: e.target.value } : l))} />
              {payLines.length > 1 && (
                <button onClick={() => setPayLines((s) => s.filter((l) => l.id !== line.id))} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: "8px 4px" }}>
                  <X size={15} />
                </button>
              )}
            </div>
          );
        })}
        {payLines.some((l) => l.paymentType === "Nasiya (qarzga)") && (
          <p style={{ fontSize: 11.5, color: T.gold, marginTop: 2 }}>
            ⚠ "Nasiya" qismi kassaga yozilmaydi — Nasiya qarzdorlar ro'yxatiga tushadi.
          </p>
        )}
        {payLines.some((l) => l.paymentType === "Karta (Click/Payme)") && (
          <p style={{ fontSize: 11.5, color: T.purple, marginTop: 2 }}>
            ℹ "Click" qismi kassa balansiga kirmaydi — alohida statistikada ko'rinadi.
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {(card.serviceType === "Ustanovka" || card.serviceType === "Detailing") && (
          <F label={card.serviceType === "Detailing" ? "Kelishuv summasi (mijozdan) *" : "Kelishilgan summa *"}>
            <input type="number" style={iSt} value={agreedSum} onChange={(e) => setAgreedSum(e.target.value)} autoFocus />
          </F>
        )}
        {card.serviceType === "Detailing" && (
          <F label="Material xarajati (usta o'z materialidan)">
            <input type="number" style={iSt} value={materialCost} onChange={(e) => setMaterialCost(e.target.value)} />
          </F>
        )}
        {card.serviceType !== "Moy bo'limi" && card.serviceType !== "Detailing" && (
          <F label="Usta xizmat haqi">
            <input type="number" style={iSt} value={ustaFee} onChange={(e) => setUstaFee(e.target.value)} />
          </F>
        )}
        {card.serviceType === "Servis" && (
          <F label="Ustama % (usta haqiga)">
            <input type="number" style={iSt} value={percent} onChange={(e) => setPercent(e.target.value)} />
          </F>
        )}
        <F label="Hujjat xarajati">
          <input type="number" style={iSt} value={docFee} onChange={(e) => setDocFee(e.target.value)} placeholder="0" />
        </F>
        <F label="Skidka (so'm)">
          <input type="number" style={iSt} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </F>
      </div>

      {card.serviceType === "Detailing" && (
        <div style={{ marginTop: 12, padding: "11px 14px", background: T.purpleD, border: `1px solid ${T.purple}30`, borderRadius: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
            <span style={{ color: T.muted2 }}>Usta haqi (kelishuv − material)</span>
            <span className="mo" style={{ fontWeight: 700, color: T.purple }}>{fmtSum(ustaFeePot)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginTop: 4 }}>
            <span style={{ color: T.muted }}>— shundan servis oladi (20%)</span>
            <span className="mo" style={{ color: T.gold }}>{fmtSum(ustaFeePot * 0.2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
            <span style={{ color: T.muted }}>— ustaga beriladi (material + 80%)</span>
            <span className="mo" style={{ color: T.teal }}>{fmtSum(ustaTakeHome)}</span>
          </div>
        </div>
      )}

      {/* B/U TOVAR — endi barcha xizmat turlarida ochiq */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.gold }}>
            Mijozdan B/U tovar qabul qilish
          </span>
          <Btn size="sm" variant="ghost" onClick={() => setBuItems((s) => [...s, { name: "", price: "" }])}>
            <Plus size={11} /> Qo'shish
          </Btn>
        </div>
        <p style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
          Mijoz eski/ishlatilgan tovarni bersa, shu yerga kiriting — narxi yakuniy summadan chegirma sifatida ayiriladi.
        </p>
        {buItems.map((b, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
            <input style={{ ...iSt, flex: 2 }} placeholder="Mahsulot nomi" value={b.name}
              onChange={(e) => setBuItems((s) => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <input type="number" style={{ ...iSt, flex: 1 }} placeholder="Qabul narxi" value={b.price}
              onChange={(e) => setBuItems((s) => s.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
            <button onClick={() => setBuItems((s) => s.filter((_, j) => j !== i))} style={{
              background: "none", border: "none", cursor: "pointer", color: T.red, padding: "0 6px",
            }}><X size={15} /></button>
          </div>
        ))}
      </div>

      {/* SUMMARY */}
      <div style={{ background: T.s2, borderRadius: 10, padding: "14px 16px", marginTop: 16 }}>
        {[
          ["Mahsulot (mijozga)", effectiveParts, T.muted2],
          productProfit !== 0 && ["Mahsulot foydasi", productProfit, T.teal],
          ["Usta haqi", card.serviceType === "Detailing" ? ustaFeePot : uf, T.gold],
          ["Hujjat xarajati", doc, T.red],
          buTotal > 0 && ["B/U tovar chegirma", -buTotal, T.gold],
          ["━ YAKUNIY SUMMA", finalTotal, T.flame],
          ["Servis foydasi", profitSum, profitSum >= 0 ? T.teal : T.red],
        ].filter(Boolean).map(([l, v, c]) => (
          <div key={l} style={{
            display: "flex", justifyContent: "space-between", padding: "7px 0",
            borderBottom: `1px solid ${T.border}25`,
          }}>
            <span style={{
              fontSize: 12.5, color: String(l).includes("━") ? T.text : T.muted,
              fontWeight: String(l).includes("━") ? 700 : 400,
            }}>{String(l).replace("━ ", "")}</span>
            <span className="mo" style={{
              fontSize: String(l).includes("━") ? 15 : 12.5,
              fontWeight: 700, color: c,
            }}>{fmtSum(v)}</span>
          </div>
        ))}
        {(() => {
          const paidTotal = payLines.reduce((s, l) => s + toSum(l.amount, l.currency, rate), 0);
          const remaining = finalTotal - paidTotal;
          if (Math.abs(remaining) < 1) return null;
          return (
            <div style={{
              display: "flex", justifyContent: "space-between", padding: "8px 0 0",
              marginTop: 4,
            }}>
              <span style={{ fontSize: 12, color: remaining > 0 ? T.gold : T.red, fontWeight: 600 }}>
                {remaining > 0 ? "To'lov qatorlarida yetishmayapti" : "To'lov qatorlari ortiqcha"}
              </span>
              <span className="mo" style={{ fontSize: 12, fontWeight: 700, color: remaining > 0 ? T.gold : T.red }}>{fmtSum(Math.abs(remaining))}</span>
            </div>
          );
        })()}
      </div>

      <SaveBtn color={T.teal}
        disabled={submitted || (Math.abs(finalTotal - payLines.reduce((s, l) => s + toSum(l.amount, l.currency, rate), 0)) > 1 && finalTotal > 0)}
        onClick={() => {
          if (submitted) return;
          setSubmitted(true);
          onSave({
            partsCost: effectiveParts, ustaFee: card.serviceType === "Detailing" ? ustaFeePot : uf, docFee: doc,
            ustaTakeHome: card.serviceType === "Detailing" ? ustaTakeHome : undefined,
            finalTotal, profitSum, productProfit, discount: disc,
            paymentType: payLines[0]?.paymentType || PAYMENT_TYPES[0], // asosiy tur — eski maydonlar bilan moslik uchun
            payLines: payLines.filter((l) => num(l.amount) > 0).map((l) => ({
              paymentType: l.paymentType, currency: l.currency, amount: num(l.amount),
              amountSum: toSum(l.amount, l.currency, rate),
            })),
            buItems: buItems.filter((b) => b.name.trim()),
          });
        }}>
        <Check size={16} /> {submitted ? "Saqlanmoqda..." : "Yakunlash va yopish"}
      </SaveBtn>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   AVTOGAZ v2 — QISM 2
   Part 1 fayliga shu komponentlarni qo'shing (App() dagi
   Placeholder qatorlarini shular bilan almashtiring):
   tab === "warehouse" -> <WarehouseTab .../>
   tab === "cashier"   -> <CashierTab .../>
   tab === "ustalar"   -> <UstaTab .../>
   tab === "warranty"  -> <WarrantyTab .../>
   tab === "partners"  -> <PartnersTab .../>
   tab === "analytics" -> <AnalyticsTab .../>
═══════════════════════════════════════════════════ */

/* ─── WAREHOUSE TAB — manba turi bilan ─── */
function WarehouseTab({ data, patch, rate, role }) {
  const isReadOnly = role === "rahbar"; // Rahbar faqat kuzatadi
  const [stockOpen, setStockOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [invReqOpen, setInvReqOpen] = useState(false);
  const [respondReq, setRespondReq] = useState(null);
  const [catFilter, setCatFilter] = useState("barchasi");
  const [search, setSearch] = useState("");

  const categories = ["barchasi", ...(data.settings.categories || CATEGORIES_DEFAULT)];
  const products = data.products
    .filter((p) => catFilter === "barchasi" || p.category === catFilter)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const totalValueSum = data.products.reduce((s, p) => s + num(p.qty) * num(p.costSum), 0);
  const pendingInvReq = (data.inventoryRequests || []).filter((r) => r.status === "kutilmoqda");

  function scheduleInventory(scheduledDate, note) {
    patch((d) => {
      d.inventoryRequests = d.inventoryRequests || [];
      d.inventoryRequests.push({
        id: uid(), scheduledDate, note, createdAt: todayISO(),
        status: "kutilmoqda", responseNote: "", proposedDate: "",
      });
      return d;
    });
  }

  function respondToInventory(reqId, agree, responseNote, proposedDate) {
    patch((d) => {
      const r = (d.inventoryRequests || []).find((x) => x.id === reqId);
      if (r) {
        r.status = agree ? "tasdiqlandi" : "rad_etildi";
        r.responseNote = responseNote || "";
        r.proposedDate = proposedDate || "";
      }
      return d;
    });
  }

  function saveInventory(items, note) {
    patch((d) => {
      let totalDiffValue = 0;
      items.forEach((it) => {
        const p = d.products.find((x) => x.id === it.productId);
        if (p) {
          const diff = num(it.actualQty) - num(p.qty);
          totalDiffValue += diff * num(p.costSum);
          p.qty = num(it.actualQty); // haqiqiy sanoq bilan yangilanadi
        }
      });
      d.inventories = d.inventories || [];
      d.inventories.push({
        id: uid(), date: todayISO(), note,
        items: items.map((it) => ({ ...it })), totalDiffValue,
      });
      return d;
    });
  }

  function addStock(entry) {
    patch((d) => {
      let product = d.products.find((p) => p.id === entry.productId);
      const prevCost = product ? num(product.costSum) : 0;
      if (!product) {
        product = { id: uid(), name: entry.productName, unit: entry.unit, category: entry.category, costSum: 0, priceSum: entry.priceSum || 0, priceUsd: entry.priceUsd || 0, qty: 0, convUnit: entry.convUnit, convFactor: entry.convFactor };
        d.products.push(product);
      }
      const prevQty = num(product.qty);
      const newQty = prevQty + entry.qty;
      product.costSum = newQty > 0 ? Math.round((prevQty * prevCost + entry.qty * entry.unitCostSum) / newQty) : entry.unitCostSum;
      product.qty = newQty;
      if (entry.updatePrice) { product.priceSum = entry.priceSum; product.priceUsd = entry.priceUsd; }

      d.stockIns.unshift({
        id: uid(), date: entry.date, productId: product.id, productName: product.name, qty: entry.qty, unit: product.unit,
        currency: entry.currency, unitCostSum: entry.unitCostSum, totalSum: entry.totalSum,
        unitCostOriginal: entry.unitCostOriginal, totalOriginal: entry.totalOriginal, paidOriginal: entry.paidOriginal,
        convQty: entry.convQty, convUnitUsed: entry.convUnitUsed,
        supplier: entry.supplier, paidSum: entry.paidSum, sourceType: entry.sourceType,
      });

      if (entry.sourceType === "Ta'minotchi" && entry.paidSum > 0) {
        d.cashflow.unshift({ id: uid(), date: entry.date, type: "chiqim", category: "Ta'minotchiga to'lov", currency: "SUM", amount: entry.paidSum, amountSum: entry.paidSum, amountUsd: entry.paidSum / rate, supplier: entry.supplier, note: `${product.name} x${entry.qty} — kirim to'lovi` });
      }
      return d;
    });
  }

  // Xizmat (servis) o'zining ehtiyoji uchun skladdan mahsulot/instrument olsa (masalan
  // jgut, umumiy foydalaniladigan asbob) — biror mijoz kartasiga bog'lanmagani uchun
  // avval hech qayerda qayd etilmasdi, sklad qoldig'i kamayib ketib "kamomad" chiqardi.
  // Bu yozuv sklad qoldig'ini kamaytiradi VA sababini saqlaydi — inventarizatsiyada
  // farq chiqmasligi uchun.
  function addServiceUsage(entry) {
    patch((d) => {
      const product = d.products.find((p) => p.id === entry.productId);
      if (!product) return d;
      const qty = Math.min(num(entry.qty), num(product.qty));
      product.qty = Math.max(0, num(product.qty) - qty);
      d.serviceUsage = d.serviceUsage || [];
      d.serviceUsage.unshift({
        id: uid(), date: todayISO(), productId: product.id, productName: product.name,
        qty, unit: product.unit, costSum: num(product.costSum) * qty,
        usta: (entry.usta || "").trim(), note: (entry.note || "").trim(),
      });
      return d;
    });
  }

  function saveEdit(prod, log) {
    patch((d) => {
      d.editLog = d.editLog || [];
      d.editLog.push({ id: uid(), date: todayISO(), ...log });
      const idx = d.products.findIndex((p) => p.id === prod.id);
      if (idx >= 0) d.products[idx] = prod;
      return d;
    });
  }

  // Kirim yozuvini tahrirlash — xato kiritilgan miqdor/summa uchun. Miqdor o'zgarsa,
  // farqi mahsulot qoldig'iga ham qo'shiladi/ayiriladi (aks holda sklad qoldig'i
  // kirim tarixidan uzilib qolar edi). To'langan summa bu yerda tahrirlanmaydi —
  // u kassa yozuvlari bilan bog'liq, xato to'lovni "Kassa" bo'limidan o'chirish kerak.
  function saveStockInEdit(stockInId, updated, reason) {
    patch((d) => {
      const idx = (d.stockIns || []).findIndex((s) => s.id === stockInId);
      if (idx < 0) return d;
      const before = d.stockIns[idx];
      const qtyDelta = num(updated.qty) - num(before.qty);
      if (qtyDelta !== 0) {
        const product = d.products.find((p) => p.id === before.productId);
        if (product) product.qty = Math.max(0, num(product.qty) + qtyDelta);
      }
      const after = { ...before, ...updated };
      d.stockIns[idx] = after;
      d.editLog = d.editLog || [];
      d.editLog.push({ id: uid(), date: todayISO(), before, after, reason, user: "Kassir" });
      return d;
    });
  }

  function addFreeSale(sale) {
    patch((d) => {
      sale.items.forEach((it) => {
        const product = d.products.find((p) => p.id === it.productId);
        if (product) product.qty = Math.max(0, num(product.qty) - it.qty);
      });
      d.freeSales = d.freeSales || [];
      d.freeSales.push({ id: uid(), ...sale });

      const itemsLabel = sale.items.map((i) => `${i.name} x${i.qty}`).join(", ");

      if (sale.paidSum > 0) {
        d.cashflow.unshift({
          id: uid(), date: sale.date, type: "kirim", category: "Ulgurji savdo",
          currency: "SUM", amount: sale.paidSum, amountSum: sale.paidSum, amountUsd: sale.paidSum / rate,
          paymentType: sale.paymentType === "Nasiya (qarzga)" ? "Naqd pul" : sale.paymentType,
          note: `${itemsLabel} — ${sale.customer}`,
        });
      }
      if (sale.debtSum > 0.5) {
        d.wholesaleDebts = d.wholesaleDebts || [];
        d.wholesaleDebts.push({
          id: uid(), date: sale.date, customer: sale.customer, items: itemsLabel,
          amountSum: sale.totalSum, paidAmount: sale.paidSum, paid: false,
        });
      }
      return d;
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Sklad</h2>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>
            Qiymati: <span style={{ color: T.gold, fontWeight: 600 }}>{fmtSum(totalValueSum)}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!isReadOnly && <Btn variant="ghost" onClick={() => setSaleOpen(true)}><ShoppingCart size={14} /> Ulgurji savdo</Btn>}
          {!isReadOnly && <Btn variant="ghost" onClick={() => setUsageOpen(true)}><Wrench size={14} /> Xizmat ehtiyoji uchun chiqarish</Btn>}
          {role === "azim" && (
            <Btn variant="gold" onClick={() => setInvReqOpen(true)}><Calendar size={14} /> Inventarizatsiya so'rovi (kassirga)</Btn>
          )}
          {(role === "azim" || role === "kassir") && (
            <Btn variant="ghost" onClick={() => setInvOpen(true)}><ShieldCheck size={14} /> Inventarizatsiya qilish (hozir)</Btn>
          )}
          {!isReadOnly && <Btn onClick={() => setStockOpen(true)}><Plus size={15} /> Kirim qilish</Btn>}
        </div>
      </div>

      {/* Rahbar tomonidan rejalashtirilgan inventarizatsiya — Kassir/Admin tasdiqlashi kerak */}
      {(role === "kassir" || role === "azim") && pendingInvReq.length > 0 && (
        <div style={{
          background: T.goldD, border: `1px solid ${T.gold}40`, borderRadius: 11,
          padding: "14px 16px", marginBottom: 18,
        }}>
          {pendingInvReq.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={14} /> Rahbar {fmtDate(r.scheduledDate)} kuni inventarizatsiya qilmoqchi
                </div>
                {r.note && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{r.note}</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn size="sm" variant="teal" onClick={() => respondToInventory(r.id, true)}><Check size={12} /> Tasdiqlash</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setRespondReq(r)}>Bosh tortish</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Rahbar — javob berilgan so'rovlar holati */}
      {role === "azim" && (data.inventoryRequests || []).some((r) => r.status !== "kutilmoqda") && (
        <div style={{ marginBottom: 18, display: "grid", gap: 8 }}>
          {(data.inventoryRequests || []).filter((r) => r.status !== "kutilmoqda").slice(-3).reverse().map((r) => (
            <div key={r.id} style={{
              background: r.status === "tasdiqlandi" ? T.tealD : T.redD,
              border: `1px solid ${r.status === "tasdiqlandi" ? T.teal : T.red}30`,
              borderRadius: 9, padding: "11px 15px", fontSize: 12.5,
            }}>
              {r.status === "tasdiqlandi" ? (
                <span style={{ color: T.teal, fontWeight: 700 }}>✓ Rozimiz — {fmtDate(r.scheduledDate)} kuni inventarizatsiya tasdiqlandi</span>
              ) : (
                <span style={{ color: T.red }}>
                  <b>Rad etildi:</b> {r.responseNote || "sabab ko'rsatilmagan"}
                  {r.proposedDate && <> — taklif qilingan sana: <b>{fmtDate(r.proposedDate)}</b></>}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13, marginBottom: 18 }}>
        <Stat label="Mahsulot turlari" value={data.products.length + " ta"} color={T.blue} Icon={Package} />
        <Stat label="Sklad qiymati" value={fmtSum(totalValueSum)} sub={fmtUsd(totalValueSum / rate)} color={T.gold} Icon={Wallet} />
        <Stat label="Kam qolgan (5<)" value={data.products.filter((p) => num(p.qty) < 5).length + " ta"} color={T.red} Icon={AlertTriangle} />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulot qidirish..." style={{ ...iSt, paddingLeft: 32 }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {categories.map((c) => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: "7px 12px", borderRadius: 7, cursor: "pointer", fontSize: 11.5, fontWeight: 500,
              border: `1px solid ${catFilter === c ? T.flame : T.border2}`,
              background: catFilter === c ? T.flameD : "transparent",
              color: catFilter === c ? T.flame : T.muted,
            }}>{c === "barchasi" ? "Barchasi" : c}</button>
          ))}
        </div>
      </div>

      <Card title={`Mahsulotlar (${products.length})`} pad={false}>
        <Tbl
          empty="Mahsulot yo'q"
          cols={[
            { k: "name", h: "Nomi", r: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
            { k: "category", h: "Kategoriya", r: (r) => <Badge color={T.blue}>{r.category || "—"}</Badge> },
            { k: "costSum", h: "Kelish narxi", r: (r) => fmtSum(r.costSum) },
            { k: "price", h: "Sotish narxi", r: (r) => <span className="mo" style={{ color: T.teal, fontSize: 12 }}>{fmtSum(r.priceSum)}{r.priceUsd ? ` · ${fmtUsd(r.priceUsd)}` : ""}</span> },
            { k: "qty", h: "Qoldiq", r: (r) => <span className="mo" style={{ fontWeight: 700, color: num(r.qty) < 5 ? T.red : T.text }}>{r.qty} {r.unit}</span> },
            { k: "val", h: "Qiymati", r: (r) => <span style={{ color: T.gold }}>{fmtSum(num(r.qty) * num(r.costSum))}</span> },
            { k: "edit", h: "", r: (r) => <PinGuardEdit item={r} onSave={saveEdit} /> },
          ]}
          rows={products}
        />
      </Card>

      <div style={{ marginTop: 16 }}>
        <ProductOutflowCard data={data} />
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title={`Kirim tarixi (${data.stockIns.length})`} pad={false}>
          <div style={{ padding: "14px 18px" }}>
            <DateGroupedList
              empty="Kirim yo'q"
              amountFn={(r) => num(r.totalSum)}
              cols={[
                { k: "productName", h: "Mahsulot" },
                { k: "qty", h: "Miqdor", r: (r) => <span>{r.qty} {r.unit}{r.convQty ? <span style={{ color: T.muted, fontSize: 11 }}> ({r.convQty} {r.convUnitUsed})</span> : null}</span> },
                { k: "sourceType", h: "Manba", r: (r) => <Badge color={r.sourceType === "Ta'minotchi" ? T.red : r.sourceType === "Insider servis" ? T.purple : T.teal}>{r.sourceType || "Ta'minotchi"}</Badge> },
                { k: "totalSum", h: "Jami", r: (r) => (
                    <span>
                      <span style={{ color: T.flame, fontWeight: 600 }}>{fmtSum(r.totalSum)}</span>
                      {r.currency === "USD" && num(r.totalOriginal) > 0 && (
                        <span className="mo" style={{ color: T.gold, fontSize: 11, marginLeft: 6 }}>({fmtUsd(r.totalOriginal)})</span>
                      )}
                    </span>
                  ) },
                { k: "supplier", h: "Ta'minotchi" },
                { k: "debt", h: "Qarz", r: (r) => {
                    if (r.sourceType === "O'z mahsuloti") return <span style={{ color: T.teal }}>Qarzsiz</span>;
                    const d = num(r.totalSum) - num(r.paidSum);
                    return <span style={{ color: d > 0 ? T.red : T.teal, fontWeight: 600 }}>{fmtSum(d)}</span>;
                  } },
                { k: "edit", h: "", r: (r) => <PinGuardEditStockIn item={r} rate={rate} onSave={saveStockInEdit} /> },
              ]}
              rows={data.stockIns}
            />
          </div>
        </Card>
      </div>

      {(data.stockOuts || []).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card title={`Chiqim tarixi — Insider servis (${data.stockOuts.length})`} pad={false}>
            <div style={{ padding: "14px 18px" }}>
              <DateGroupedList
                empty="Chiqim yo'q"
                amountFn={(r) => -num(r.amountSum)}
                cols={[
                  { k: "productName", h: "Mahsulot" },
                  { k: "qty", h: "Miqdor", r: (r) => <span className="mo">{r.qty}</span> },
                  { k: "partnerName", h: "Insider servis", r: (r) => <span style={{ fontWeight: 600 }}>{r.partnerName}</span> },
                  { k: "amountSum", h: "Qiymati", r: (r) => <span style={{ color: T.purple, fontWeight: 600 }}>{fmtSum(r.amountSum)}</span> },
                  { k: "reason", h: "Sabab", r: (r) => <span style={{ color: T.muted, fontSize: 12 }}>{r.reason}</span> },
                ]}
                rows={data.stockOuts}
              />
            </div>
          </Card>
        </div>
      )}

      {(data.serviceUsage || []).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card title={`Chiqim tarixi — Xizmat ehtiyoji (${data.serviceUsage.length})`} pad={false}>
            <div style={{ padding: "14px 18px" }}>
              <DateGroupedList
                empty="Chiqim yo'q"
                amountFn={(r) => -num(r.costSum)}
                cols={[
                  { k: "productName", h: "Mahsulot" },
                  { k: "qty", h: "Miqdor", r: (r) => <span className="mo">{r.qty} {r.unit}</span> },
                  { k: "usta", h: "Kim oldi", r: (r) => r.usta || "—" },
                  { k: "costSum", h: "Qiymati", r: (r) => <span style={{ color: T.gold, fontWeight: 600 }}>{fmtSum(r.costSum)}</span> },
                  { k: "note", h: "Sabab", r: (r) => <span style={{ color: T.muted, fontSize: 12 }}>{r.note || "—"}</span> },
                ]}
                rows={data.serviceUsage}
              />
            </div>
          </Card>
        </div>
      )}

      {stockOpen && <StockInModal data={data} rate={rate} onClose={() => setStockOpen(false)} onSave={(e) => { addStock(e); setStockOpen(false); }} />}
      {saleOpen && <FreeSaleModal products={data.products} data={data} rate={rate} onClose={() => setSaleOpen(false)} onSave={(s) => { addFreeSale(s); setSaleOpen(false); }} />}
      {usageOpen && <ServiceUsageModal products={data.products} ustaNames={ustaNameOptions(data)} onClose={() => setUsageOpen(false)} onSave={(e) => { addServiceUsage(e); setUsageOpen(false); }} />}
      {invReqOpen && (
        <InventoryScheduleModal onClose={() => setInvReqOpen(false)}
          onSave={(date, note) => { scheduleInventory(date, note); setInvReqOpen(false); }} />
      )}
      {respondReq && (
        <InventoryDeclineModal onClose={() => setRespondReq(null)}
          onSave={(note, date) => { respondToInventory(respondReq.id, false, note, date); setRespondReq(null); }} />
      )}
      {invOpen && (
        <InventoryCountModal products={data.products} onClose={() => setInvOpen(false)}
          onSave={(items, note) => { saveInventory(items, note); setInvOpen(false); }} />
      )}
    </div>
  );
}

function InventoryScheduleModal({ onClose, onSave }) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [date, setDate] = useState(tomorrow);
  const [note, setNote] = useState("");
  return (
    <Modal title="Inventarizatsiya rejalash" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
        Kassirga xabarnoma yuboriladi. U tasdiqlashi yoki boshqa sana taklif qilishi mumkin.
      </p>
      <F label="Sana"><input type="date" style={iSt} value={date} onChange={(e) => setDate(e.target.value)} autoFocus /></F>
      <div style={{ marginTop: 12 }}>
        <F label="Izoh (ixtiyoriy)"><input style={iSt} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: choraklik hisobot uchun" /></F>
      </div>
      <SaveBtn color={T.gold} onClick={() => onSave(date, note.trim())}>
        <Calendar size={15} /> Xabarnoma yuborish
      </SaveBtn>
    </Modal>
  );
}

function InventoryDeclineModal({ onClose, onSave }) {
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  return (
    <Modal title="Bosh tortish — sabab va taklif" onClose={onClose}>
      <F label="Sabab *"><input style={iSt} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nima uchun bo'lmaydi?" autoFocus /></F>
      <div style={{ marginTop: 12 }}>
        <F label="Boshqa sana taklif qilish"><input type="date" style={iSt} value={date} onChange={(e) => setDate(e.target.value)} /></F>
      </div>
      <SaveBtn disabled={!note.trim()} color={T.red} onClick={() => onSave(note.trim(), date)}>
        Yuborish
      </SaveBtn>
    </Modal>
  );
}

function InventoryCountModal({ products, onClose, onSave }) {
  const [counts, setCounts] = useState(() => Object.fromEntries(products.map((p) => [p.id, String(p.qty)])));
  const [note, setNote] = useState("");

  const items = products.map((p) => ({
    productId: p.id, name: p.name, systemQty: num(p.qty),
    actualQty: num(counts[p.id] ?? p.qty),
  }));
  const diffItems = items.filter((it) => it.actualQty !== it.systemQty);

  return (
    <Modal title="Inventarizatsiya — haqiqiy sanoq" onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
        Har bir mahsulot uchun haqiqiy (sanab chiqilgan) miqdorni kiriting. Farq bo'lsa, tizim avtomatik to'g'irlaydi.
      </p>
      <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 9 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: T.s3 }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: T.muted }}>Mahsulot</th>
              <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, color: T.muted }}>Tizimda</th>
              <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, color: T.muted }}>Haqiqiy</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ padding: "8px 12px", fontSize: 12.5 }}>{p.name}</td>
                <td style={{ padding: "8px 12px", textAlign: "right" }} className="mo">{p.qty}</td>
                <td style={{ padding: "6px 12px", textAlign: "right" }}>
                  <input type="number" style={{ ...iSt, width: 80, textAlign: "right", padding: "6px 8px" }}
                    value={counts[p.id] ?? ""} onChange={(e) => setCounts((s) => ({ ...s, [p.id]: e.target.value }))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {diffItems.length > 0 && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: T.goldD, borderRadius: 8 }}>
          <span style={{ fontSize: 12.5, color: T.gold, fontWeight: 600 }}>{diffItems.length} ta mahsulotda farq topildi</span>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <F label="Izoh (ixtiyoriy)"><input style={iSt} value={note} onChange={(e) => setNote(e.target.value)} /></F>
      </div>

      <SaveBtn color={T.teal} onClick={() => onSave(items, note.trim())}>
        <Check size={15} /> Inventarizatsiyani yakunlash
      </SaveBtn>
    </Modal>
  );
}

function ProductOutflowCard({ data }) {
  const [period, setPeriod] = useState("hammasi"); // hafta | oy | yil | hammasi

  const now = todayISO();
  let fromDate = null;
  if (period === "hafta") { const d = new Date(); d.setDate(d.getDate() - 6); fromDate = d.toISOString().slice(0, 10); }
  if (period === "oy") fromDate = now.slice(0, 7) + "-01";
  if (period === "yil") fromDate = now.slice(0, 4) + "-01-01";

  const rows = productOutflowReport(data, fromDate, null);
  const maxQty = Math.max(1, ...rows.map((r) => r.totalQty));

  return (
    <Card title={`Eng ko'p sotilgan mahsulotlar (${rows.length})`} pad={false}>
      <div style={{ padding: "14px 18px 0", display: "flex", gap: 6 }}>
        {[["hafta", "Bu hafta"], ["oy", "Bu oy"], ["yil", "Bu yil"], ["hammasi", "Hammasi"]].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} style={{
            padding: "6px 13px", borderRadius: 20, border: `1px solid ${period === v ? T.flame : T.border2}`,
            background: period === v ? T.flameD : T.s1, color: period === v ? T.flame : T.muted,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>
      <div style={{ padding: "14px 18px" }}>
        {rows.length === 0 ? (
          <p style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: "20px 0" }}>Tanlangan davrda chiqim yo'q</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.slice(0, 15).map((r, i) => (
              <div key={r.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    {i === 0 && <Star size={13} color={T.gold} />} {r.name}
                  </span>
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="mo" style={{ fontSize: 12.5, fontWeight: 700 }}>{r.totalQty} dona</span>
                    <span className="mo" style={{ fontSize: 11, color: T.muted }}>({fmtSum(r.revenue)})</span>
                  </span>
                </div>
                <div style={{ height: 6, background: T.s3, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(r.totalQty / maxQty * 100).toFixed(0)}%`, height: "100%", background: i === 0 ? T.gold : T.flame, borderRadius: 3 }} />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 10.5, color: T.muted }}>
                  {r.servisQty > 0 && <span>Xizmatda: <b className="mo">{r.servisQty}</b></span>}
                  {r.ulgurjiQty > 0 && <span>Ulgurji: <b className="mo">{r.ulgurjiQty}</b></span>}
                  {r.hamkorQty > 0 && <span>Hamkorga: <b className="mo">{r.hamkorQty}</b></span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function PinGuardEdit({ item, onSave }) {
  const [pinOpen, setPinOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <button onClick={() => setPinOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4 }}>
        <Pencil size={13} />
      </button>
      {pinOpen && <SimplePinModal onClose={() => setPinOpen(false)} onSuccess={() => { setPinOpen(false); setEditOpen(true); }} />}
      {editOpen && <EditProductModal item={item} onClose={() => setEditOpen(false)} onSave={(p, log) => { onSave(p, log); setEditOpen(false); }} />}
    </>
  );
}

function SimplePinModal({ onClose, onSuccess }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  function check() { if (pin === "9999") onSuccess(); else { setErr(true); setPin(""); } }
  return (
    <Modal title="🔐 Tasdiqlash kodi" onClose={onClose}>
      <p style={{ color: T.muted, fontSize: 13, marginBottom: 14 }}>Tahrirlash uchun kodni kiriting:</p>
      <F label="Kod">
        <input type="password" style={iSt} value={pin}
          onChange={(e) => { setPin(e.target.value); setErr(false); }}
          onKeyDown={(e) => e.key === "Enter" && check()} autoFocus />
      </F>
      {err && <p style={{ color: T.red, fontSize: 12, marginTop: 8 }}>Noto'g'ri kod</p>}
      <SaveBtn onClick={check} disabled={!pin}>Tasdiqlash</SaveBtn>
    </Modal>
  );
}

function EditProductModal({ item, onClose, onSave }) {
  const [f, setF] = useState({ ...item });
  const [reason, setReason] = useState("");
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const convUnitOptions = [{ value: "", label: "Yo'q — bir xil birlikda kiritiladi" }, ...UNITS.filter((u) => u !== f.unit).map((u) => ({ value: u, label: u }))];
  return (
    <Modal title={`Tahrirlash — ${item.name}`} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Nomi" col="1/-1"><input style={iSt} value={f.name} onChange={set("name")} /></F>
        <F label="Kelish narxi"><input type="number" style={iSt} value={f.costSum} onChange={set("costSum")} /></F>
        <F label="Sotish (so'm)"><input type="number" style={iSt} value={f.priceSum} onChange={set("priceSum")} /></F>
        <F label="Sotish (USD)"><input type="number" style={iSt} value={f.priceUsd || 0} onChange={set("priceUsd")} /></F>
        <F label="Qoldiq"><input type="number" style={iSt} value={f.qty} onChange={set("qty")} /></F>
        <F label="Xarid birligi (ixtiyoriy)">
          <Sel value={f.convUnit || ""} onChange={(e) => setF((s) => ({ ...s, convUnit: e.target.value || undefined }))} options={convUnitOptions} />
        </F>
        {f.convUnit && (
          <F label={`1 ${f.convUnit} = necha ${f.unit}?`}>
            <input type="number" style={iSt} value={f.convFactor || ""} onChange={(e) => setF((s) => ({ ...s, convFactor: e.target.value }))} placeholder="masalan 120" />
          </F>
        )}
        <F label="Sabab *" col="1/-1"><input style={iSt} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Narx oshdi, xato tuzatildi..." /></F>
      </div>
      <SaveBtn disabled={!reason.trim()} onClick={() => onSave({ ...f, convFactor: f.convUnit ? num(f.convFactor) : undefined }, { before: item, after: f, reason, user: "Kassir" })}>Saqlash</SaveBtn>
    </Modal>
  );
}

function PinGuardEditStockIn({ item, rate, onSave }) {
  const [pinOpen, setPinOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <button onClick={() => setPinOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4 }}>
        <Pencil size={13} />
      </button>
      {pinOpen && <SimplePinModal onClose={() => setPinOpen(false)} onSuccess={() => { setPinOpen(false); setEditOpen(true); }} />}
      {editOpen && <EditStockInModal item={item} rate={rate} onClose={() => setEditOpen(false)} onSave={(updated, reason) => { onSave(item.id, updated, reason); setEditOpen(false); }} />}
    </>
  );
}

function EditStockInModal({ item, rate, onClose, onSave }) {
  const [currency, setCurrency] = useState(item.currency || "SUM");
  const [qty, setQty] = useState(String(item.qty));
  // Maydonlar tanlangan valyutada ko'rsatiladi (USD bo'lsa — dollarda). Boshlang'ich qiymat
  // yozuv qaysi valyutada kiritilgan bo'lsa, shundan olinadi.
  const [unitCost, setUnitCost] = useState(String(
    (item.currency === "USD" ? item.unitCostOriginal : item.unitCostSum) || ""
  ));
  const [totalAmt, setTotalAmt] = useState(String(
    (item.currency === "USD" ? item.totalOriginal : item.totalSum) || ""
  ));
  const [supplier, setSupplier] = useState(item.supplier || "");
  const [reason, setReason] = useState("");

  function handleQtyOrUnit(nextQty, nextUnitCost) {
    setQty(nextQty);
    setUnitCost(nextUnitCost);
    const q = num(nextQty), u = num(nextUnitCost);
    if (q > 0 && u > 0) setTotalAmt(String(Math.round(q * u * 100) / 100));
  }

  function handleCurrency(next) {
    // Valyuta almashtirilganda maydonlarni bo'sh qilamiz — SUM<->USD orasida noto'g'ri
    // (eski kursdagi) raqamni qoldirib, chalkashtirib yubormaslik uchun.
    setCurrency(next);
    setUnitCost("");
    setTotalAmt("");
  }

  return (
    <Modal title={`Kirimni tahrirlash — ${item.productName}`} onClose={onClose}>
      <F label="Valyuta" col="1/-1">
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border2}` }}>
          {[["SUM", "So'm"], ["USD", "Dollar"]].map(([id, l]) => (
            <button key={id} onClick={() => handleCurrency(id)} type="button" style={{
              flex: 1, padding: "9px", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 500,
              background: currency === id ? T.flame : "transparent", color: currency === id ? "#fff" : T.muted,
            }}>{l}</button>
          ))}
        </div>
      </F>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <F label={`Miqdor (${item.unit})`}>
          <input type="number" style={iSt} value={qty} onChange={(e) => handleQtyOrUnit(e.target.value, unitCost)} />
        </F>
        <F label={`Birlik narxi (${currency === "USD" ? "$" : "so'm"})`}>
          <input type="number" style={iSt} value={unitCost} onChange={(e) => handleQtyOrUnit(qty, e.target.value)} />
        </F>
        <F label={`Jami summa (${currency === "USD" ? "$" : "so'm"})`} col="1/-1">
          <input type="number" style={iSt} value={totalAmt} onChange={(e) => setTotalAmt(e.target.value)} />
        </F>
        {currency === "USD" && num(totalAmt) > 0 && (
          <p style={{ fontSize: 12, color: T.muted, gridColumn: "1/-1", marginTop: -6 }}>
            ≈ {fmtSum(toSum(num(totalAmt), "USD", rate))} so'm (joriy kurs {fmtSum(rate)})
          </p>
        )}
        <F label="Ta'minotchi" col="1/-1">
          <input style={iSt} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </F>
        <F label="Sabab *" col="1/-1">
          <input style={iSt} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Xato kiritilgan summa tuzatildi..." />
        </F>
      </div>
      <p style={{ fontSize: 11.5, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>
        Miqdor o'zgartirilsa, farqi sklad qoldig'iga qo'shiladi/ayiriladi. To'langan summa bu yerdan
        o'zgartirilmaydi — agar noto'g'ri to'lov kiritilgan bo'lsa, uni Kassa bo'limidan o'chiring.
      </p>
      <SaveBtn disabled={!reason.trim() || !num(qty) || !num(totalAmt)} onClick={() => onSave({
        qty: num(qty), supplier: supplier.trim(), currency,
        unitCostSum: toSum(num(unitCost), currency, rate),
        totalSum: toSum(num(totalAmt), currency, rate),
        unitCostOriginal: currency === "USD" ? num(unitCost) : undefined,
        totalOriginal: currency === "USD" ? num(totalAmt) : undefined,
      }, reason)}>Saqlash</SaveBtn>
    </Modal>
  );
}

function StockInModal({ data, rate, onClose, onSave }) {
  const [mode, setMode] = useState("existing");
  const [sourceType, setSourceType] = useState("Ta'minotchi");
  const [productId, setProductId] = useState(data.products[0]?.id || "");
  const [newName, setNewName] = useState("");
  const [unit, setUnit] = useState(UNITS[0]);
  const [category, setCategory] = useState((data.settings.categories || CATEGORIES_DEFAULT)[0]);
  const [newConvUnit, setNewConvUnit] = useState("");
  const [newConvFactor, setNewConvFactor] = useState("");
  const [qty, setQty] = useState(1);
  const [unitCost, setUnitCost] = useState("");
  const [priceSum, setPriceSum] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [updatePrice, setUpdatePrice] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [paid, setPaid] = useState(0);
  const [currency, setCurrency] = useState("SUM");
  const [convMode, setConvMode] = useState(false);
  const [convQty, setConvQty] = useState(1);

  const existingProd = data.products.find((p) => p.id === productId);
  const activeUnit = mode === "existing" ? existingProd?.unit : unit;
  const activeConvUnit = mode === "existing" ? existingProd?.convUnit : newConvUnit;
  const activeConvFactor = num(mode === "existing" ? existingProd?.convFactor : newConvFactor);
  const hasConv = !!activeConvUnit && activeConvFactor > 0;
  const useConv = hasConv && convMode;

  const effectiveQty = useConv ? num(convQty) * activeConvFactor : num(qty);
  const effectiveUnitCost = useConv ? (num(unitCost) / activeConvFactor) : num(unitCost);

  const unitCostSum = toSum(effectiveUnitCost, currency, rate);
  const totalSum = unitCostSum * effectiveQty;
  const paidSum = toSum(paid, currency, rate);
  const debt = totalSum - paidSum;

  const prevCost = existingProd ? num(existingProd.costSum) : 0;
  const priceRose = prevCost > 0 && unitCostSum > prevCost;

  const canSave = (mode === "existing" ? !!productId : !!newName.trim())
    && (sourceType === "O'z mahsuloti" || sourceType === "Insider servis" || supplier.trim())
    && effectiveQty > 0 && unitCostSum >= 0;

  return (
    <Modal title="Skladga kirim" onClose={onClose} wide>
      <F label="Mahsulot manbai" col="1/-1">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {SOURCE_TYPES.map((s) => (
            <button key={s} onClick={() => setSourceType(s)} style={{
              padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${sourceType === s ? T.flame : T.border2}`,
              background: sourceType === s ? T.flameD : T.s3,
              color: sourceType === s ? T.flame : T.muted2,
            }}>{s}</button>
          ))}
        </div>
        {sourceType === "O'z mahsuloti" && <p style={{ fontSize: 11, color: T.teal, marginTop: 6 }}>✓ Qarz hosil bo'lmaydi</p>}
        {sourceType === "Insider servis" && <p style={{ fontSize: 11, color: T.purple, marginTop: 6 }}>↔ Tovar bilan hisob-kitob</p>}
      </F>

      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border2}`, margin: "14px 0" }}>
        {[["existing", "Mavjud mahsulot"], ["new", "Yangi mahsulot"]].map(([id, l]) => (
          <button key={id} onClick={() => setMode(id)} style={{ flex: 1, padding: "9px", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 500, background: mode === id ? T.flame : "transparent", color: mode === id ? "#fff" : T.muted }}>{l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {mode === "existing" ? (
          <div style={{ gridColumn: "1/-1" }}>
            <F label="Mahsulot">
              {data.products.length ? (
                <SearchSelect value={productId} onChange={setProductId} placeholder="Mahsulot nomini yozing..."
                  options={data.products.map((p) => ({ value: p.id, label: p.name, sub: `${p.qty} ${p.unit}` }))} />
              ) : (
                <Sel value="" onChange={() => {}} options={[{ value: "", label: "Mahsulot yo'q" }]} />
              )}
            </F>
          </div>
        ) : (
          <>
            <F label="Nomi" col="1/-1"><input style={iSt} value={newName} onChange={(e) => setNewName(e.target.value)} /></F>
            <F label="Birlik (sotish)"><Sel value={unit} onChange={(e) => { setUnit(e.target.value); setNewConvUnit(""); }} options={UNITS} /></F>
            <F label="Kategoriya"><Sel value={category} onChange={(e) => setCategory(e.target.value)} options={data.settings.categories || CATEGORIES_DEFAULT} /></F>
            <F label="Xarid birligi (ixtiyoriy)">
              <Sel value={newConvUnit} onChange={(e) => setNewConvUnit(e.target.value)}
                options={[{ value: "", label: "Yo'q — bir xil birlik" }, ...UNITS.filter((u) => u !== unit).map((u) => ({ value: u, label: u }))]} />
            </F>
            {newConvUnit && (
              <F label={`1 ${newConvUnit} = necha ${unit}?`}>
                <input type="number" style={iSt} value={newConvFactor} onChange={(e) => setNewConvFactor(e.target.value)} placeholder="masalan 120" />
              </F>
            )}
          </>
        )}
        {hasConv ? (
          <>
            <F label="Kirim birligi">
              <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border2}` }}>
                <button type="button" onClick={() => setConvMode(false)} style={{ flex: 1, padding: "8px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: !convMode ? T.flame : "transparent", color: !convMode ? "#fff" : T.muted }}>{activeUnit}</button>
                <button type="button" onClick={() => setConvMode(true)} style={{ flex: 1, padding: "8px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: convMode ? T.flame : "transparent", color: convMode ? "#fff" : T.muted }}>{activeConvUnit}</button>
              </div>
            </F>
            <F label={convMode ? `Necha ${activeConvUnit}` : `Necha ${activeUnit}`}>
              <input type="number" min="0" style={iSt} value={convMode ? convQty : qty} onChange={(e) => convMode ? setConvQty(e.target.value) : setQty(e.target.value)} />
            </F>
          </>
        ) : (
          <F label="Miqdor"><input type="number" min="1" style={iSt} value={qty} onChange={(e) => setQty(e.target.value)} /></F>
        )}
        <F label="Valyuta"><CurrencyToggle value={currency} onChange={setCurrency} /></F>
        <F label={`Kelish narxi (1 ${convMode ? activeConvUnit : activeUnit}, ${currency})`}><input type="number" style={iSt} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></F>
        {useConv && num(convQty) > 0 && activeConvFactor > 0 && (
          <p style={{ gridColumn: "1/-1", fontSize: 11.5, color: T.muted, margin: 0 }}>
            ≈ {effectiveQty} {activeUnit} · 1 {activeUnit} narxi {fmtSum(unitCostSum)}
          </p>
        )}
        <F label="Sotish narxi (SO'M)"><input type="number" style={iSt} value={priceSum} onChange={(e) => setPriceSum(e.target.value)} /></F>
        <F label="Sotish narxi (USD)"><input type="number" style={iSt} value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} /></F>
        {sourceType !== "O'z mahsuloti" && (
          <F label={sourceType === "Insider servis" ? "Insider servis nomi" : "Ta'minotchi"}>
            <input style={iSt} value={supplier} onChange={(e) => setSupplier(e.target.value)} list="supplier-name-list" placeholder="Nomi yozing yoki ro'yxatdan tanlang" />
            <datalist id="supplier-name-list">
              {[...new Set(data.stockIns.map((s) => s.supplier).filter(Boolean))].map((s) => <option key={s} value={s} />)}
            </datalist>
          </F>
        )}
        {sourceType === "Ta'minotchi" && (
          <F label="Hozir to'landi"><input type="number" style={iSt} value={paid} onChange={(e) => setPaid(e.target.value)} /></F>
        )}
      </div>

      {priceRose && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: T.goldD, border: `1px solid ${T.gold}30`, borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.gold, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={13} /> Narx oshgan! {fmtSum(prevCost)} → {fmtSum(unitCostSum)}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, cursor: "pointer", fontSize: 12 }}>
            <input type="checkbox" checked={updatePrice} onChange={(e) => setUpdatePrice(e.target.checked)} style={{ accentColor: T.gold }} />
            Sotish narxini ham yangilash
          </label>
        </div>
      )}

      {sourceType === "Ta'minotchi" && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: T.s3, borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ fontSize: 12, color: T.muted }}>Jami</span>
            <span className="mo" style={{ fontSize: 12, fontWeight: 600 }}>{fmtSum(totalSum)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ fontSize: 12, color: T.muted }}>Qarz</span>
            <span className="mo" style={{ fontSize: 12, fontWeight: 600, color: debt > 0 ? T.red : T.teal }}>{fmtSum(debt)}</span>
          </div>
        </div>
      )}

      <SaveBtn disabled={!canSave} onClick={() => onSave({
        productId: mode === "existing" ? productId : null,
        productName: mode === "existing" ? existingProd?.name : newName.trim(),
        unit: activeUnit,
        convUnit: mode === "existing" ? existingProd?.convUnit : (newConvUnit || undefined),
        convFactor: mode === "existing" ? existingProd?.convFactor : (newConvUnit ? num(newConvFactor) : undefined),
        category, qty: effectiveQty, currency, unitCostSum, totalSum,
        convQty: useConv ? num(convQty) : undefined,
        convUnitUsed: useConv ? activeConvUnit : undefined,
        unitCostOriginal: num(effectiveUnitCost), totalOriginal: num(effectiveUnitCost) * effectiveQty, // asl valyutadagi summa — kelajakda ko'rsatish uchun
        priceSum: num(priceSum), priceUsd: num(priceUsd), updatePrice,
        supplier: supplier.trim() || (sourceType === "O'z mahsuloti" ? "—" : "Noma'lum"),
        paidSum: sourceType === "Ta'minotchi" ? paidSum : totalSum,
        paidOriginal: sourceType === "Ta'minotchi" ? num(paid) : num(effectiveUnitCost) * effectiveQty,
        sourceType, date: todayISO(),
      })}>Kirim qilish</SaveBtn>
    </Modal>
  );
}

function ServiceUsageModal({ products, ustaNames, onClose, onSave }) {
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [qty, setQty] = useState(1);
  const [usta, setUsta] = useState("");
  const [note, setNote] = useState("");

  const product = products.find((p) => p.id === productId);
  const q = num(qty);
  const overStock = product && q > num(product.qty);
  const canSave = product && q > 0 && !overStock;

  return (
    <Modal title="Xizmat ehtiyoji uchun chiqarish" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14, lineHeight: 1.6 }}>
        Mijoz kartasiga emas, servisning o'z ehtiyojiga (masalan umumiy foydalaniladigan
        jgut, asbob) ketgan mahsulot — shu orqali sklad qoldig'i to'g'ri kamayadi va
        inventarizatsiyada kamomad chiqmaydi.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        <F label="Mahsulot / instrument">
          {products.length ? (
            <SearchSelect value={productId} onChange={setProductId} placeholder="Mahsulot nomini yozing..."
              options={products.map((p) => ({ value: p.id, label: p.name, sub: `${p.qty} ${p.unit}` }))} />
          ) : (
            <Sel value="" onChange={() => {}} options={[{ value: "", label: "Sklad bo'sh" }]} />
          )}
        </F>
        <F label={`Miqdor${product ? ` (${product.unit}, qoldiq: ${product.qty})` : ""}`}>
          <input type="number" style={iSt} value={qty} onChange={(e) => setQty(e.target.value)} />
        </F>
        <F label="Kim oldi (ixtiyoriy)">
          <input style={iSt} value={usta} onChange={(e) => setUsta(e.target.value)} placeholder="Usta ismi"
            list="usage-usta-list" />
          <datalist id="usage-usta-list">
            {ustaNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </F>
        <F label="Sababi / izoh">
          <input style={iSt} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: umumiy jgut, sexda ishlatildi" />
        </F>
      </div>
      {overStock && <p style={{ color: T.red, fontSize: 12, marginTop: 10 }}>Skladda yetarli emas — bor-yo'g'i {product.qty} {product.unit}.</p>}
      <SaveBtn disabled={!canSave} onClick={() => onSave({ productId, qty: q, usta, note })}>
        Chiqarish
      </SaveBtn>
    </Modal>
  );
}

function FreeSaleModal({ products, data, rate, onClose, onSave }) {
  const [customer, setCustomer] = useState("");
  const [cart, setCart] = useState([]);
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [qty, setQty] = useState(1);
  const [currency, setCurrency] = useState("SUM");
  const [saleUnit, setSaleUnit] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentType, setPaymentType] = useState("Naqd pul");
  const [paidNow, setPaidNow] = useState("");

  const product = products.find((p) => p.id === productId);
  const prevCustomers = [...new Set((data?.freeSales || []).map((s) => s.customer).filter(Boolean))];
  const [stockError, setStockError] = useState("");

  useEffect(() => {
    if (!product) { setSaleUnit(""); return; }
    setSaleUnit(currency === "USD" ? (product.priceUsd || (rate ? (num(product.priceSum) / rate).toFixed(2) : "")) : product.priceSum || "");
  }, [productId, currency]); // eslint-disable-line

  function add() {
    if (!product) return;
    const q = num(qty); if (q <= 0) return;
    const alreadyInCart = cart.filter((i) => i.productId === product.id).reduce((s, i) => s + i.qty, 0);
    if (alreadyInCart + q > num(product.qty)) {
      setStockError(`Skladda faqat ${num(product.qty) - alreadyInCart} ${product.unit} qoldi`);
      return;
    }
    setStockError("");
    const unitPriceSum = toSum(saleUnit, currency, rate);
    const costUnitSum = num(product.costSum);
    setCart((s) => [...s, {
      productId: product.id, name: product.name, qty: q,
      currency, saleUnit: num(saleUnit), unitPriceSum, costUnit: costUnitSum,
      lineTotalSum: q * unitPriceSum,
      lineProfitSum: (unitPriceSum - costUnitSum) * q,
    }]);
    setQty(1);
  }
  function removeRow(idx) { setCart((s) => s.filter((_, i) => i !== idx)); }

  const grossTotal = cart.reduce((s, i) => s + i.lineTotalSum, 0);
  const grossProfit = cart.reduce((s, i) => s + i.lineProfitSum, 0);
  const discountSum = grossTotal * (num(discountPercent) / 100);
  const total = Math.max(0, grossTotal - discountSum);
  const netProfit = grossProfit - discountSum;

  const paidSum = paymentType === "Nasiya (qarzga)" ? Math.min(toSum(paidNow || 0, currency, rate), total) : total;
  const debtSum = Math.max(0, total - paidSum);

  const canSave = cart.length > 0 && customer.trim().length > 0;

  return (
    <Modal title="Ulgurji savdo" onClose={onClose} wide>
      <F label="Mijoz">
        <input style={iSt} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Mijoz / do'kon nomi" list="wholesale-customer-list" />
        <datalist id="wholesale-customer-list">{prevCustomers.map((c) => <option key={c} value={c} />)}</datalist>
      </F>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 0.9fr 1fr auto", gap: 8, marginTop: 14, alignItems: "end" }}>
        <div>
          {products.length ? (
            <SearchSelect value={productId} onChange={setProductId} placeholder="Mahsulot nomini yozing..."
              options={products.map((p) => ({ value: p.id, label: p.name, sub: String(p.qty) }))} />
          ) : (
            <Sel value="" onChange={() => {}} options={[{ value: "", label: "Sklad bo'sh" }]} />
          )}
        </div>
        <F label="Miqdor"><input type="number" style={iSt} value={qty} onChange={(e) => { setQty(e.target.value); setStockError(""); }} /></F>
        <F label="Valyuta"><CurrencyToggle value={currency} onChange={setCurrency} /></F>
        <F label={`Narx (${currency}) — erkin`}>
          <input type="number" style={iSt} value={saleUnit} onChange={(e) => setSaleUnit(e.target.value)} />
        </F>
        <Btn onClick={add}><Plus size={14} /></Btn>
      </div>
      {stockError && <p style={{ color: T.red, fontSize: 11.5, marginTop: 6 }}>{stockError}</p>}

      {product && (
        <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
          Kelish (tannarx): <b className="mo">{fmtSum(product.costSum)}</b> · Standart sotish narxi: <b className="mo">{fmtSum(product.priceSum)}{product.priceUsd ? ` · ${fmtUsd(product.priceUsd)}` : ""}</b>
          {saleUnit !== "" && (
            <> · Bu savdodagi birlik foyda: <b className="mo" style={{ color: toSum(saleUnit, currency, rate) - num(product.costSum) >= 0 ? T.teal : T.red }}>
              {fmtSum(toSum(saleUnit, currency, rate) - num(product.costSum))}
            </b></>
          )}
        </p>
      )}

      {cart.map((i, idx) => (
        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.s3, borderRadius: 7, padding: "8px 12px", marginTop: 8, gap: 8 }}>
          <span style={{ fontSize: 13 }}>{i.name} x{i.qty} <span style={{ color: T.muted }}>@ {i.currency === "USD" ? fmtUsd(i.saleUnit) : fmtSum(i.saleUnit)}</span></span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mo">{fmtSum(i.lineTotalSum)}</span>
            <span className="mo" style={{ fontSize: 11.5, color: i.lineProfitSum >= 0 ? T.teal : T.red }}>foyda {fmtSum(i.lineProfitSum)}</span>
            <button onClick={() => removeRow(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, display: "flex" }}><X size={14} /></button>
          </div>
        </div>
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <F label="Chegirma (%)"><input type="number" style={iSt} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} /></F>
        <F label="To'lov turi">
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border2}` }}>
            {["Naqd pul", "Nasiya (qarzga)"].map((pt) => (
              <button key={pt} onClick={() => setPaymentType(pt)} style={{ flex: 1, padding: "9px 6px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, background: paymentType === pt ? T.flame : "transparent", color: paymentType === pt ? "#fff" : T.muted }}>{pt === "Nasiya (qarzga)" ? "Qarzga" : "Naqd"}</button>
            ))}
          </div>
        </F>
      </div>

      {paymentType === "Nasiya (qarzga)" && (
        <F label="Hozir to'landi (ixtiyoriy, qisman bo'lishi mumkin)">
          <input type="number" style={iSt} value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder="0" />
        </F>
      )}

      <div style={{ marginTop: 14, padding: "12px 14px", background: T.s3, borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
          <span style={{ fontSize: 12, color: T.muted }}>Jami (chegirmasiz)</span>
          <span className="mo" style={{ fontSize: 12.5 }}>{fmtSum(grossTotal)}</span>
        </div>
        {discountSum > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span style={{ fontSize: 12, color: T.gold }}>Chegirma (-{discountPercent}%)</span>
            <span className="mo" style={{ fontSize: 12.5, color: T.gold }}>-{fmtSum(discountSum)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: `1px solid ${T.border}`, marginTop: 4, paddingTop: 8 }}>
          <span style={{ fontWeight: 700 }}>Jami to'lov</span>
          <span className="mo" style={{ color: T.teal, fontWeight: 700 }}>{fmtSum(total)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
          <span style={{ fontSize: 12.5, color: T.muted }}>Sof foyda (chegirmadan keyin)</span>
          <span className="mo" style={{ color: netProfit >= 0 ? T.purple : T.red, fontWeight: 600 }}>{fmtSum(netProfit)}</span>
        </div>
        {paymentType === "Nasiya (qarzga)" && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span style={{ fontSize: 12.5, color: T.red }}>Qarz qoladi</span>
            <span className="mo" style={{ color: T.red, fontWeight: 700 }}>{fmtSum(debtSum)}</span>
          </div>
        )}
      </div>

      <SaveBtn disabled={!canSave} onClick={() => onSave({
        date: todayISO(), customer: customer.trim(), items: cart, currency,
        grossTotal, discountPercent: num(discountPercent), discountSum, totalSum: total,
        profitSum: netProfit, paymentType, paidSum, debtSum,
      })}>Saqlash</SaveBtn>
    </Modal>
  );
}

/* ─── CASHIER TAB — qarz turi + muddat eslatma + Click alohida ─── */
const DEBT_TX_TYPES = ["Ta'minotchi to'lovi", "Mahsulot uchun", "Xizmat uchun", "Avans", "Boshqa"];

function CashierTab({ data, patch, rate, readOnly = false }) {
  const runLocked = useActionLock();
  const [open, setOpen] = useState(false);
  const [cashPreset, setCashPreset] = useState(null); // { type, category } — tezkor qarz tugmalari
  const [payStockIn, setPayStockIn] = useState(null);
  const [historySupplier, setHistorySupplier] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [payNasiya, setPayNasiya] = useState(null);
  const [givePersonalOpen, setGivePersonalOpen] = useState(false);
  const [payPersonal, setPayPersonal] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [cfSearch, setCfSearch] = useState("");

  const exchanges = data.currencyExchanges || [];
  // Ayirboshlash — umumiy tushum/foydaga (Analitika) qo'shilmaydi, faqat kassadagi
  // naqd SO'M/USD balansiga ta'sir qiladi (pul bir valyutadan ikkinchisiga o'tadi, xolos).
  const exchangeSumNet = exchanges.reduce((s, e) => s + (e.direction === "usd_to_sum" ? num(e.sumAmount) : -num(e.sumAmount)), 0);
  const exchangeUsdNet = exchanges.reduce((s, e) => s + (e.direction === "usd_to_sum" ? -num(e.usdAmount) : num(e.usdAmount)), 0);

  const cf = data.cashflow;
  const clickEntries = cf.filter((c) => c.paymentType === "Karta (Click/Payme)");
  const clickIncome = clickEntries.filter((c) => c.type === "kirim").reduce((s, c) => s + num(c.amountSum), 0);
  const clickExpense = clickEntries.filter((c) => c.type === "chiqim").reduce((s, c) => s + num(c.amountSum), 0);
  const clickTotal = clickIncome - clickExpense;

  // Nasiya (kassadan tashqari) — kassa yozuvlaridan + xizmat kartalaridan
  const nasiyaCashEntries = cf.filter((c) => c.paymentType === "Nasiya (qarzga)");
  const nasiyaDebts = data.nasiyaDebts || [];
  const unpaidNasiya = nasiyaDebts.filter((n) => !n.paid);
  const nasiyaRemainingTotal = unpaidNasiya.reduce((s, n) => s + (num(n.amountSum) - num(n.paidAmount || 0)), 0);
  const nasiyaTotal = nasiyaCashEntries.reduce((s, c) => s + num(c.amountSum), 0) + nasiyaRemainingTotal;

  const cashFlow = cf.filter((c) => c.paymentType !== "Karta (Click/Payme)" && c.paymentType !== "Nasiya (qarzga)");
  const incomeSUM = cashFlow.filter((c) => c.type === "kirim" && c.currency !== "USD").reduce((s, c) => s + num(c.amountSum), 0);
  const expenseSUM = cashFlow.filter((c) => c.type === "chiqim" && c.currency !== "USD").reduce((s, c) => s + num(c.amountSum), 0);
  const incomeUSD = cashFlow.filter((c) => c.type === "kirim" && c.currency === "USD").reduce((s, c) => s + num(c.amount), 0);
  const expenseUSD = cashFlow.filter((c) => c.type === "chiqim" && c.currency === "USD").reduce((s, c) => s + num(c.amount), 0);

  const debts = supplierDebts(data);
  const totalDebt = debts.reduce((s, d) => s + Math.max(0, d.debtSum), 0);

  // Oxirgi 7 kunlik sof kassa harakati (naqd, SO'M) — "Kassadagi SO'M" mini-grafigi uchun.
  const last7NetKassa = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const dayCF = cashFlow.filter((c) => c.date === iso && c.currency !== "USD");
    const inc = dayCF.filter((c) => c.type === "kirim").reduce((s, c) => s + num(c.amountSum), 0);
    const exp = dayCF.filter((c) => c.type === "chiqim").reduce((s, c) => s + num(c.amountSum), 0);
    return inc - exp;
  });

  const cfSearchNorm = cfSearch.trim().toLowerCase();
  const cfFiltered = cfSearchNorm
    ? cf.filter((c) => [c.note, c.category, c.supplier, c.paymentType, fmtDate(c.date)].filter(Boolean).some((v) => String(v).toLowerCase().includes(cfSearchNorm)))
    : cf;

  const dueSoon = (data.debtReminders || []).filter((r) => {
    const days = Math.ceil((new Date(r.dueDate) - new Date()) / 86400000);
    return days <= 2 && !r.resolved;
  });

  function addEntry(entry) {
    runLocked(() => patch((d) => {
      // Qarz hisobidan yechish (kirim: qarzdor; chiqim: ta'minotchi)
      let noteExtra = "";
      if (entry.debtSettle && entry.debtSettle.kind) {
        const res = applyDebtSettlement(d, entry.debtSettle, num(entry.amountSum));
        if (res.applied > 0) {
          noteExtra = ` · qarz yechildi: ${res.label} (${fmtSum(res.applied)})`;
        }
      } else if (entry.type === "chiqim" && entry.category === "Ta'minotchiga to'lov" && entry.supplier) {
        // Eski interfeys: faqat ta'minotchi nomi berilgan
        const res = applyDebtSettlement(d, { kind: "supplier", id: entry.supplier, name: entry.supplier }, num(entry.amountSum));
        if (res.applied > 0) noteExtra = ` · qarz yechildi: ${res.label} (${fmtSum(res.applied)})`;
      }

      const { debtSettle, ...rest } = entry;
      d.cashflow.unshift({
        id: uid(),
        ...rest,
        note: ((rest.note || "") + noteExtra).trim(),
        debtSettleKind: debtSettle?.kind || undefined,
        debtSettleId: debtSettle?.id || undefined,
      });
      if (entry.reminderDate) {
        d.debtReminders = d.debtReminders || [];
        d.debtReminders.push({ id: uid(), dueDate: entry.reminderDate, note: entry.note, amountSum: entry.amountSum, txType: entry.debtTxType, resolved: false });
      }
      return d;
    }));
  }

  function payDebt(supplierName, amountSum, meta = {}) {
    runLocked(() => patch((d) => {
      const res = applyDebtSettlement(d, { kind: "supplier", id: supplierName, name: supplierName }, amountSum);
      d.cashflow.unshift({
        id: uid(), date: todayISO(), type: "chiqim", category: "Ta'minotchiga to'lov",
        currency: meta.currency || "SUM", amount: meta.amountOriginal ?? amountSum, amountSum,
        amountUsd: (meta.currency === "USD" ? meta.amountOriginal : amountSum / rate) || amountSum / rate,
        paymentType: meta.paymentType, supplier: supplierName,
        note: `Qarz to'lovi — ${supplierName}${meta.paymentType ? ` (${meta.paymentType})` : ""}${res.applied ? ` · yechildi ${fmtSum(res.applied)}` : ""}`,
        debtSettleKind: "supplier",
        debtSettleId: supplierName,
      });
      return d;
    }));
  }

  function receiveNasiyaPayment(nasiyaId, amountSum) {
    runLocked(() => patch((d) => {
      const n = (d.nasiyaDebts || []).find((x) => x.id === nasiyaId);
      if (n) {
        n.paidAmount = num(n.paidAmount) + amountSum;
        if (n.paidAmount >= num(n.amountSum) - 0.5) n.paid = true;
      }
      d.cashflow.unshift({
        id: uid(), date: todayISO(), type: "kirim", category: "Xizmat to'lovi",
        currency: "SUM", amount: amountSum, amountSum, amountUsd: amountSum / rate,
        paymentType: "Naqd pul",
        note: `Nasiya to'lovi (${n?.paid ? "to'liq" : "qisman"}) — ${n?.plate || ""} (${n?.serviceType || ""})`,
      });
      return d;
    }));
  }

  function givePersonalDebt(item) {
    runLocked(() => patch((d) => {
      d.personalDebts = d.personalDebts || [];
      const existing = d.personalDebts.find((p) => p.name.trim().toLowerCase() === item.name.trim().toLowerCase() && !p.paid);
      const historyItem = { date: todayISO(), time: nowTime(), amount: item.amountSum, note: item.note };
      if (existing) {
        existing.amountSum = num(existing.amountSum) + item.amountSum;
        existing.history = [...(existing.history || []), historyItem];
      } else {
        d.personalDebts.push({
          id: uid(), date: todayISO(), time: nowTime(), name: item.name, note: item.note,
          amountSum: item.amountSum, paidAmount: 0, paid: false, history: [historyItem],
        });
      }
      d.cashflow.unshift({
        id: uid(), date: todayISO(), type: "chiqim", category: "Shaxsiy qarz berildi",
        currency: item.currency || "SUM", amount: item.amountOriginal ?? item.amountSum, amountSum: item.amountSum,
        amountUsd: item.currency === "USD" ? item.amountOriginal : item.amountSum / rate,
        note: `${item.name} — naqd qarz${item.note ? ` (${item.note})` : ""}`,
      });
      return d;
    }));
  }

  function receivePersonalPayment(debtId, amountSum) {
    runLocked(() => patch((d) => {
      const p = (d.personalDebts || []).find((x) => x.id === debtId);
      if (p) {
        p.paidAmount = num(p.paidAmount) + amountSum;
        if (p.paidAmount >= num(p.amountSum) - 0.5) p.paid = true;
      }
      d.cashflow.unshift({
        id: uid(), date: todayISO(), type: "kirim", category: "Shaxsiy qarz qaytdi",
        currency: "SUM", amount: amountSum, amountSum, amountUsd: amountSum / rate,
        note: `${p?.name || ""} — qarz qaytdi (${p?.paid ? "to'liq" : "qisman"})`,
      });
      return d;
    }));
  }

  function addExchange(item) {
    runLocked(() => patch((d) => {
      d.currencyExchanges = d.currencyExchanges || [];
      d.currencyExchanges.push({
        id: uid(), date: todayISO(), time: nowTime(),
        direction: item.direction, usdAmount: item.usdAmount, sumAmount: item.sumAmount,
        officialRate: rate, note: item.note,
      });
      return d;
    }));
  }

  async function deleteExchange(id) {
    if (!(await askConfirm("Ayirboshlash yozuvi o'chirilsinmi? Kassa balansi qayta hisoblanadi."))) return;
    patch((d) => {
      d.currencyExchanges = (d.currencyExchanges || []).filter((e) => e.id !== id);
      return d;
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Kassa</h2>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>Naqd pul harakati va qarzlar</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setReportOpen(true)}><Calendar size={14} /> Kun hisoboti</Btn>
          {!readOnly && <Btn variant="teal" onClick={() => { setCashPreset({ type: "kirim", category: "Qarzdan kirim" }); setOpen(true); }}><Wallet size={14} /> Qarzdan kirim</Btn>}
          {!readOnly && <Btn variant="red" onClick={() => { setCashPreset({ type: "chiqim", category: "Ta'minotchiga to'lov" }); setOpen(true); }}><AlertTriangle size={14} /> Ta'minotchiga to'lov</Btn>}
          {!readOnly && <Btn variant="gold" onClick={() => setGivePersonalOpen(true)}><Users size={14} /> Shaxsiy qarz berish</Btn>}
          {!readOnly && <Btn variant="gold" onClick={() => setExchangeOpen(true)}><RefreshCw size={14} /> Ayirboshlash</Btn>}
          {!readOnly && <Btn onClick={() => { setCashPreset(null); setOpen(true); }}><Plus size={15} /> Yozuv qo'shish</Btn>}
        </div>
      </div>

      {dueSoon.length > 0 && (
        <div style={{ background: T.redD, border: `1px solid ${T.red}40`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={16} color={T.red} />
          <span style={{ fontSize: 13, color: T.red, fontWeight: 600 }}>{dueSoon.length} ta qarz muddati yaqinlashmoqda yoki o'tgan!</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13, marginBottom: 20 }}>
        <Stat label="Kassadagi SO'M" value={fmtSum(incomeSUM - expenseSUM + exchangeSumNet)} color={T.flame} Icon={Wallet} spark={last7NetKassa} />
        <Stat label="Kassadagi USD" value={fmtUsd(incomeUSD - expenseUSD + exchangeUsdNet)} color={T.gold} Icon={Wallet} />
        <Stat label="Click/Payme savdosi" value={fmtSum(clickTotal)} sub={`Kirim: ${fmtSum(clickIncome)} · Chiqim: ${fmtSum(clickExpense)} · balansdan tashqari`} color={T.purple} Icon={TrendingUp} />
        <Stat label="Nasiya qarz (qolgan)" value={fmtSum(nasiyaTotal)} sub={`${unpaidNasiya.length} ta to'lanmagan · balansdan tashqari`} color={T.gold} Icon={Clock} />
        <Stat label="Ta'minotchi qarzi" value={fmtSum(totalDebt)} color={T.red} Icon={AlertTriangle} />
      </div>

      {exchanges.length > 0 && (
        <Card title={`Valyuta ayirboshlash (${exchanges.length})`} pad={false}>
          <Tbl
            dense
            empty="Ayirboshlash yozuvi yo'q"
            cols={[
              { k: "date", h: "Sana", r: (r) => <span>{fmtDate(r.date)} <span style={{ color: T.muted }}>{r.time}</span></span> },
              { k: "direction", h: "Yo'nalish", r: (r) => (
                  <Badge color={r.direction === "usd_to_sum" ? T.gold : T.teal}>
                    {r.direction === "usd_to_sum" ? "USD → SO'M" : "SO'M → USD"}
                  </Badge>
                ) },
              { k: "usdAmount", h: "USD summasi", r: (r) => <span className="mo">{fmtUsd(r.usdAmount)}</span> },
              { k: "sumAmount", h: "SO'M summasi (haqiqiy)", r: (r) => <span className="mo" style={{ fontWeight: 700 }}>{fmtSum(r.sumAmount)}</span> },
              { k: "diff", h: "Rasmiy kursdan farqi", r: (r) => {
                  const official = num(r.usdAmount) * num(r.officialRate);
                  const diff = r.direction === "usd_to_sum" ? num(r.sumAmount) - official : official - num(r.sumAmount);
                  return <span className="mo" style={{ color: diff >= 0 ? T.teal : T.red, fontWeight: 600 }}>{diff >= 0 ? "+" : ""}{fmtSum(diff)}</span>;
                } },
              { k: "note", h: "Izoh", r: (r) => <span style={{ fontSize: 11.5, color: T.muted }}>{r.note || "—"}</span> },
              ...(!readOnly ? [
                { k: "del", h: "", r: (r) => <button onClick={() => deleteExchange(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}><Trash2 size={13} /></button> },
              ] : []),
            ]}
            rows={exchanges}
          />
        </Card>
      )}

      <Card
        title={`Kassa harakati (${cfSearchNorm ? cfFiltered.length : cf.length})`}
        pad={false}
        action={
          <div style={{ position: "relative", width: 240 }}>
            <Search size={14} color={T.muted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text" value={cfSearch} onChange={(e) => setCfSearch(e.target.value)}
              placeholder="Kimga, qachon, izoh bo'yicha qidirish..."
              style={{ ...iSt, padding: "8px 10px 8px 30px", fontSize: 12.5 }}
            />
          </div>
        }
      >
        <div style={{ padding: "14px 18px" }}>
          <DateGroupedList
            empty={cfSearchNorm ? "Hech narsa topilmadi" : "Yozuv yo'q"}
            amountFn={(r) => (r.type === "kirim" ? 1 : -1) * (r.currency === "USD" ? num(r.amount) * rate : num(r.amountSum))}
            cols={[
              { k: "type", h: "Turi", r: (r) => <Badge color={r.type === "kirim" ? T.teal : T.red}>{r.type === "kirim" ? "Kirim" : "Chiqim"}</Badge> },
              { k: "paymentType", h: "To'lov", r: (r) => {
                  if (r.paymentType === "Karta (Click/Payme)") return <Badge color={T.purple}>Click</Badge>;
                  if (r.paymentType === "Nasiya (qarzga)") return <Badge color={T.gold}>Nasiya</Badge>;
                  return <span style={{ fontSize: 11, color: T.muted }}>{r.paymentType || "Naqd"}</span>;
                } },
              { k: "category", h: "Turkum" },
              { k: "currency", h: "Val", r: (r) => <span style={{ fontSize: 11, color: T.muted }}>{r.currency === "USD" ? "USD" : "SUM"}</span> },
              { k: "amount", h: "Summa", r: (r) => <span className="mo" style={{ fontWeight: 700, color: r.type === "kirim" ? T.teal : T.red }}>{r.type === "kirim" ? "+" : "-"}{r.currency === "USD" ? fmtUsd(r.amount) : fmtSum(r.amountSum)}</span> },
              { k: "note", h: "Izoh", r: (r) => <span style={{ color: T.muted, fontSize: 12 }}>{r.note || "—"}</span> },
              ...(!readOnly ? [
                { k: "edit", h: "", r: (r) => <button onClick={() => setEditEntry(r)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}><Pencil size={13} /></button> },
                { k: "del", h: "", r: (r) => (
                  <button
                    onClick={async () => {
                      // Eski (fix'dan oldingi) "Qarz to'lovi" yozuvlarida debtSettleId
                      // yozilmagan bo'lishi mumkin — supplier kind uchun r.supplier
                      // maydoniga qaytamiz, aks holda bunday eski yozuvlar hech qachon
                      // qarzni to'g'ri qaytarolmaydi.
                      const settleId = r.debtSettleId || (r.debtSettleKind === "supplier" ? r.supplier : undefined);
                      const isUstaClose = r.category === "Usta xizmat haqi" && (r.ustaLedgerIds?.length || r.ustaCloseId);
                      const msg = r.debtSettleKind
                        ? `Bu yozuv o'chirilsinmi?\n\n"${r.note || r.category}" — ${fmtSum(r.amountSum)}\n\nBu yozuv qarzga bog'langan — o'chirilganda tegishli qarz ("${settleId || ""}") ham shu summaga qaytariladi.`
                        : isUstaClose
                        ? `Bu yozuv o'chirilsinmi?\n\n"${r.note || r.category}" — ${fmtSum(r.amountSum)}\n\nBu — usta hisobini yopish yozuvi. O'chirilganda ustaning (va shogirt bo'lgan bo'lsa, uning ham) hisobi qaytadan "to'lanmagan" holatga qaytadi.`
                        : `Bu yozuv o'chirilsinmi?\n\n"${r.note || r.category}" — ${fmtSum(r.amountSum)}`;
                      if (!(await askConfirm(msg))) return;
                      patch((d) => {
                        if (r.debtSettleKind) reverseDebtSettlement(d, r.debtSettleKind, settleId, num(r.amountSum));
                        if (isUstaClose) reverseUstaClose(d, r);
                        d.cashflow = d.cashflow.filter((x) => x.id !== r.id);
                        return d;
                      });
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}
                  ><Trash2 size={13} /></button>
                ) },
              ] : []),
            ]}
            rows={cfSearchNorm ? cfFiltered : cf}
          />
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title="Ta'minotchi qarzlari" pad={false} accent={T.red}>
          <Tbl
            empty="Qarz yo'q"
            cols={[
              { k: "name", h: "Ta'minotchi", r: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
              { k: "totalSum", h: "Jami olindi", r: (r) => <span className="mo" style={{ color: T.muted2 }}>{fmtSum(r.totalSum)}</span> },
              { k: "paidSum", h: "To'landi", r: (r) => <span className="mo" style={{ color: T.teal }}>{fmtSum(r.paidSum)}</span> },
              { k: "debtSum", h: "Qolgan qarz", r: (r) => <span className="mo" style={{ color: T.red, fontWeight: 700 }}>{fmtSum(r.debtSum)}</span> },
              { k: "act", h: "", r: (r) => (
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <Btn size="sm" variant="ghost" onClick={() => setHistorySupplier(r)}>
                      <Clock size={11} /> Tarix
                    </Btn>
                    {!readOnly && <Btn size="sm" variant="teal" onClick={() => setPayStockIn(r)}>To'lov</Btn>}
                  </div>
                ) },
            ]}
            rows={debts}
          />
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title={`Nasiya qarzdorlar (${unpaidNasiya.length})`} pad={false}>
          <Tbl
            empty="Nasiya qarzdorlik yo'q"
            cols={[
              { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
              { k: "plate", h: "Raqam", r: (r) => <span className="mo" style={{ fontWeight: 700, color: T.flame }}>{r.plate}</span> },
              { k: "phone", h: "Telefon", r: (r) => <span className="mo" style={{ fontSize: 12 }}>{r.phone || "—"}</span> },
              { k: "carModel", h: "Mashina" },
              { k: "serviceType", h: "Xizmat", r: (r) => <Badge color={SERVICE_COLORS[r.serviceType] || T.blue}>{r.serviceType}</Badge> },
              { k: "amountSum", h: "Jami summa", r: (r) => <span className="mo" style={{ color: T.muted2 }}>{fmtSum(r.amountSum)}</span> },
              { k: "paidAmount", h: "To'langan", r: (r) => <span style={{ color: T.teal }}>{fmtSum(r.paidAmount || 0)}</span> },
              { k: "remaining", h: "Qolgan qarz", r: (r) => <span style={{ color: T.gold, fontWeight: 700 }}>{fmtSum(num(r.amountSum) - num(r.paidAmount || 0))}</span> },
              { k: "act", h: "", r: (r) => <Btn size="sm" variant="teal" onClick={() => setPayNasiya(r)}>To'lov qabul</Btn> },
            ]}
            rows={unpaidNasiya}
          />
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title={`Shaxsiy qarzdorlar (${(data.personalDebts || []).filter((p) => !p.paid).length})`} pad={false}>
          <Tbl
            empty="Shaxsiy qarzdorlik yo'q"
            cols={[
              { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
              { k: "name", h: "Ismi", r: (r) => <span style={{ fontWeight: 700 }}>{r.name}</span> },
              { k: "note", h: "Izoh", r: (r) => <span style={{ color: T.muted, fontSize: 12 }}>{r.note || "—"}</span> },
              { k: "amountSum", h: "Jami summa", r: (r) => <span className="mo" style={{ color: T.muted2 }}>{fmtSum(r.amountSum)}</span> },
              { k: "paidAmount", h: "To'langan", r: (r) => <span style={{ color: T.teal }}>{fmtSum(r.paidAmount || 0)}</span> },
              { k: "remaining", h: "Qolgan qarz", r: (r) => <span style={{ color: T.red, fontWeight: 700 }}>{fmtSum(num(r.amountSum) - num(r.paidAmount || 0))}</span> },
              { k: "act", h: "", r: (r) => <Btn size="sm" variant="teal" onClick={() => setPayPersonal(r)}>To'lov qabul</Btn> },
            ]}
            rows={(data.personalDebts || []).filter((p) => !p.paid).sort((a, b) => b.date.localeCompare(a.date))}
          />
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <DocFeesSection data={data} />
      </div>

      {open && (
        <NewCashflowModal
          data={data}
          debts={debts}
          rate={rate}
          initialType={cashPreset?.type || "kirim"}
          initialCategory={cashPreset?.category}
          onClose={() => { setOpen(false); setCashPreset(null); }}
          onSave={(e) => { addEntry(e); setOpen(false); setCashPreset(null); }}
        />
      )}
      {historySupplier && (
        <SupplierHistoryModal supplier={historySupplier} data={data} patch={patch} onClose={() => setHistorySupplier(null)} />
      )}
      {payStockIn && (
        <Modal title={`To'lov — ${payStockIn.name}`} onClose={() => setPayStockIn(null)}>
          <PaySupplierForm supplier={payStockIn} rate={rate}
            onSave={(amountSum, meta) => { payDebt(payStockIn.name, amountSum, meta); setPayStockIn(null); }} />
        </Modal>
      )}
      {payNasiya && (
        <NasiyaPayModal nasiya={payNasiya} rate={rate} onClose={() => setPayNasiya(null)}
          onSave={(amountSum) => { receiveNasiyaPayment(payNasiya.id, amountSum); setPayNasiya(null); }} />
      )}
      {givePersonalOpen && (
        <GivePersonalDebtModal rate={rate}
          existingNames={[...new Set((data.personalDebts || []).map((p) => p.name))]}
          onClose={() => setGivePersonalOpen(false)}
          onSave={(item) => { givePersonalDebt(item); setGivePersonalOpen(false); }} />
      )}
      {payPersonal && (
        <PayPersonalDebtModal debt={payPersonal} rate={rate} onClose={() => setPayPersonal(null)}
          onSave={(amountSum) => { receivePersonalPayment(payPersonal.id, amountSum); setPayPersonal(null); }} />
      )}
      {editEntry && (
        <EditCashEntryModal entry={editEntry} rate={rate} onClose={() => setEditEntry(null)}
          onSave={(updated) => {
            patch((d) => {
              const idx = d.cashflow.findIndex((c) => c.id === editEntry.id);
              if (idx >= 0) d.cashflow[idx] = { ...d.cashflow[idx], ...updated };
              return d;
            });
            setEditEntry(null);
          }} />
      )}
      {reportOpen && <DailyReport data={data} onClose={() => setReportOpen(false)} />}
      {exchangeOpen && (
        <ExchangeModal rate={rate} onClose={() => setExchangeOpen(false)}
          onSave={(item) => { addExchange(item); setExchangeOpen(false); }} />
      )}
    </div>
  );
}

function ExchangeModal({ rate, onClose, onSave }) {
  const [direction, setDirection] = useState("usd_to_sum");
  const [usdAmount, setUsdAmount] = useState("");
  const [sumAmount, setSumAmount] = useState("");
  const [note, setNote] = useState("");

  const officialEquivalent = num(usdAmount) * rate;
  const diff = usdAmount && sumAmount
    ? (direction === "usd_to_sum" ? num(sumAmount) - officialEquivalent : officialEquivalent - num(sumAmount))
    : 0;
  const canSave = num(usdAmount) > 0 && num(sumAmount) > 0;

  return (
    <Modal title="Valyuta ayirboshlash" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
        Ko'cha (bozor) kursi rasmiy kursdan farq qilishi mumkin — olingan/berilgan SO'M summasini
        <b> aynan qanday bo'lsa shundayligicha</b> kiriting, tizim uni qayta hisoblab qo'ymaydi.
      </p>
      <F label="Yo'nalish">
        <Sel value={direction} onChange={(e) => setDirection(e.target.value)} options={[
          { value: "usd_to_sum", label: "USD berildi → SO'M olindi" },
          { value: "sum_to_usd", label: "SO'M berildi → USD olindi" },
        ]} />
      </F>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <F label="USD summasi">
          <input type="number" style={iSt} value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)}
            placeholder="masalan: 100" autoFocus />
        </F>
        <F label="SO'M summasi (haqiqiy olingan/berilgan)">
          <input type="number" style={iSt} value={sumAmount} onChange={(e) => setSumAmount(e.target.value)}
            placeholder={officialEquivalent ? String(Math.round(officialEquivalent)) : "masalan: 1 260 000"} />
        </F>
      </div>
      <F label="Izoh (ixtiyoriy)">
        <input style={iSt} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: ayirboshlash punkti" />
      </F>
      {num(usdAmount) > 0 && (
        <div style={{ background: T.s3, borderRadius: 8, padding: "10px 14px", marginTop: 12, fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: T.muted }}>
            <span>Rasmiy kursda ({fmtSum(rate)}/$)</span>
            <span className="mo">{fmtSum(officialEquivalent)}</span>
          </div>
          {num(sumAmount) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontWeight: 700, color: diff >= 0 ? T.teal : T.red }}>
              <span>Kurs farqi</span>
              <span className="mo">{diff >= 0 ? "+" : ""}{fmtSum(diff)}</span>
            </div>
          )}
        </div>
      )}
      <SaveBtn color={T.gold} disabled={!canSave} onClick={() => onSave({
        direction, usdAmount: num(usdAmount), sumAmount: num(sumAmount), note: note.trim(),
      })}>
        <RefreshCw size={15} /> Ayirboshlashni saqlash
      </SaveBtn>
    </Modal>
  );
}

function EditCashEntryModal({ entry, rate, onClose, onSave }) {
  const [type, setType] = useState(entry.type);
  const cats = type === "kirim" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [category, setCategory] = useState(cats.includes(entry.category) ? entry.category : cats[0]);
  const [currency, setCurrency] = useState(entry.currency || "SUM");
  const [amount, setAmount] = useState(String(entry.currency === "USD" ? entry.amount : Math.round(entry.amountSum)));
  const [paymentType, setPaymentType] = useState(entry.paymentType || "Naqd pul");
  const [note, setNote] = useState(entry.note || "");

  useEffect(() => {
    if (!cats.includes(category)) setCategory(cats[0]);
  }, [type]);

  const amountSum = toSum(amount, currency, rate);

  return (
    <Modal title="Kassa yozuvini tahrirlash" onClose={onClose} wide>
      <div style={{ padding: "10px 14px", background: T.goldD, border: `1px solid ${T.gold}30`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: T.gold }}>
        Sana: {fmtDate(entry.date)} — asl yozuv o'zgartiriladi
      </div>

      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border2}`, marginBottom: 14 }}>
        <button onClick={() => setType("kirim")} style={{ flex: 1, padding: 9, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: type === "kirim" ? T.teal : "transparent", color: type === "kirim" ? "#fff" : T.muted }}>Kirim</button>
        <button onClick={() => setType("chiqim")} style={{ flex: 1, padding: 9, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: type === "chiqim" ? T.red : "transparent", color: type === "chiqim" ? "#fff" : T.muted }}>Chiqim</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Turkum"><Sel value={category} onChange={(e) => setCategory(e.target.value)} options={cats} /></F>
        <F label="To'lov usuli"><Sel value={paymentType} onChange={(e) => setPaymentType(e.target.value)} options={PAYMENT_TYPES} /></F>
        <F label="Valyuta"><CurrencyToggle value={currency} onChange={setCurrency} /></F>
        <F label={`Summa (${currency})`}><input type="number" style={iSt} value={amount} onChange={(e) => setAmount(e.target.value)} /></F>
        <F label="Izoh" col="1/-1"><input style={iSt} value={note} onChange={(e) => setNote(e.target.value)} /></F>
      </div>

      <div style={{ marginTop: 14, padding: "10px 14px", background: T.s3, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: T.muted }}>Yangi summa (so'm)</span>
        <span className="mo" style={{ fontWeight: 700 }}>{fmtSum(amountSum)}</span>
      </div>

      <SaveBtn color={T.gold} onClick={() => onSave({
        type, category, currency, amount: num(amount), amountSum, amountUsd: amountSum / rate,
        paymentType, note: note.trim(),
      })}>
        <Save size={15} /> O'zgarishlarni saqlash
      </SaveBtn>
    </Modal>
  );
}

function GivePersonalDebtModal({ rate, existingNames, onClose, onSave }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState("SUM");
  const [amount, setAmount] = useState("");
  const amtNum = num(amount);
  const amountSum = toSum(amount, currency, rate);
  const isExisting = (existingNames || []).some((n) => n.trim().toLowerCase() === name.trim().toLowerCase());

  return (
    <Modal title="Shaxsiy qarz berish" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
        Istalgan odamga (usta, ishchi, tanish) naqd pul berilganda shu yerdan kiriting.
        Summa darhol kassadan ayiriladi va qarzdorlar ro'yxatiga tushadi.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        <F label="Ismi *">
          <input style={iSt} value={name} onChange={(e) => setName(e.target.value)}
            list="personal-debtor-list" autoFocus />
          <datalist id="personal-debtor-list">
            {(existingNames || []).map((n) => <option key={n} value={n} />)}
          </datalist>
        </F>
        {isExisting && (
          <p style={{ fontSize: 11.5, color: T.gold, marginTop: -6 }}>
            ℹ Bu ism allaqachon mavjud — summa uning joriy qarziga qo'shiladi.
          </p>
        )}
        <F label="Izoh (ixtiyoriy)">
          <input style={iSt} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: avans, shaxsiy ehtiyoj uchun..." />
        </F>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <F label="Valyuta"><CurrencyToggle value={currency} onChange={setCurrency} /></F>
          <F label={`Summa (${currency}) *`}>
            <input type="number" style={iSt} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </F>
        </div>
      </div>
      {amtNum > 0 && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: T.redD, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: T.red }}>Kassadan ayiriladi</span>
          <span className="mo" style={{ fontWeight: 700, color: T.red }}>{fmtSum(amountSum)}</span>
        </div>
      )}
      <SaveBtn disabled={!name.trim() || !amtNum} color={T.gold}
        onClick={() => onSave({ name: name.trim(), note: note.trim(), amountSum, currency, amountOriginal: amtNum })}>
        <Users size={15} /> Qarz berish
      </SaveBtn>
    </Modal>
  );
}

function PayPersonalDebtModal({ debt, rate, onClose, onSave }) {
  const remaining = num(debt.amountSum) - num(debt.paidAmount || 0);
  const [currency, setCurrency] = useState("SUM");
  const [amt, setAmt] = useState(String(Math.round(remaining)));
  const amountSum = toSum(amt, currency, rate);
  const after = Math.max(0, remaining - amountSum);

  return (
    <Modal title={`Qarz qaytarish — ${debt.name}`} onClose={onClose}>
      <div style={{ marginBottom: 14, padding: "10px 14px", background: T.redD, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: T.red }}>Qolgan qarz</span>
        <span className="mo" style={{ fontWeight: 700, color: T.red }}>{fmtSum(remaining)}</span>
      </div>
      {debt.note && <p style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>{debt.note}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Valyuta"><CurrencyToggle value={currency} onChange={setCurrency} /></F>
        <F label={`To'lov summasi (${currency})`}>
          <input type="number" style={iSt} value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
        </F>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn variant="ghost" size="sm" onClick={() => { setCurrency("SUM"); setAmt(String(Math.round(remaining))); }}>To'liq summa</Btn>
        <Btn variant="ghost" size="sm" onClick={() => { setCurrency("SUM"); setAmt(String(Math.round(remaining / 2))); }}>Yarmi</Btn>
      </div>

      <div style={{ marginTop: 14, padding: "10px 14px", background: T.s3, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: T.muted }}>To'lovdan keyin qoladigan qarz</span>
        <span className="mo" style={{ fontWeight: 700, color: after > 0 ? T.red : T.teal }}>{fmtSum(after)}</span>
      </div>

      <SaveBtn disabled={!amountSum || amountSum <= 0} color={T.teal}
        onClick={() => onSave(Math.min(amountSum, remaining))}>
        <Check size={15} /> To'lovni qabul qilish
      </SaveBtn>
    </Modal>
  );
}

function NasiyaPayModal({ nasiya, rate, onClose, onSave }) {
  const remaining = num(nasiya.amountSum) - num(nasiya.paidAmount || 0);
  const [currency, setCurrency] = useState("SUM");
  const [amt, setAmt] = useState(String(Math.round(remaining)));
  const amountSum = toSum(amt, currency, rate);
  const isFull = amountSum >= remaining - 0.5;
  const after = Math.max(0, remaining - amountSum);

  return (
    <Modal title={`Nasiya to'lovi — ${nasiya.plate}`} onClose={onClose}>
      <div style={{ marginBottom: 14, padding: "10px 14px", background: T.goldD, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: T.gold }}>Qolgan qarz</span>
        <span className="mo" style={{ fontWeight: 700, color: T.gold }}>{fmtSum(remaining)}</span>
      </div>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
        {nasiya.carModel} · {nasiya.serviceType} · {fmtDate(nasiya.date)}
        {num(nasiya.paidAmount) > 0 && <> · avval to'langan: <b>{fmtSum(nasiya.paidAmount)}</b></>}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Valyuta"><CurrencyToggle value={currency} onChange={setCurrency} /></F>
        <F label={`To'lov summasi (${currency})`}>
          <input type="number" style={iSt} value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
        </F>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn variant="ghost" size="sm" onClick={() => { setCurrency("SUM"); setAmt(String(Math.round(remaining))); }}>To'liq summa</Btn>
        <Btn variant="ghost" size="sm" onClick={() => { setCurrency("SUM"); setAmt(String(Math.round(remaining / 2))); }}>Yarmi</Btn>
      </div>

      <div style={{ marginTop: 14, padding: "10px 14px", background: T.s3, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: T.muted }}>To'lovdan keyin qoladigan qarz</span>
        <span className="mo" style={{ fontWeight: 700, color: after > 0 ? T.red : T.teal }}>{fmtSum(after)}</span>
      </div>

      <SaveBtn disabled={!amountSum || amountSum <= 0} color={T.teal}
        onClick={() => onSave(Math.min(amountSum, remaining))}>
        <Check size={15} /> {isFull ? "To'liq to'lov qabul qilindi" : "Qisman to'lov qabul qilindi"}
      </SaveBtn>
    </Modal>
  );
}

/* ─── HUJJAT XARAJATLARI — alohida jadval ─── */
function DocFeesSection({ data }) {
  const [monthFilter, setMonthFilter] = useState("hammasi");

  const docRows = data.serviceCards
    .filter((c) => num(c.docFee) > 0)
    .map((c) => ({
      id: c.id, date: c.date, plate: c.plate, carModel: c.carModel,
      serviceType: c.serviceType, docFee: num(c.docFee),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const months = ["hammasi", ...new Set(docRows.map((r) => r.date.slice(0, 7)))].sort().reverse();
  const filtered = monthFilter === "hammasi" ? docRows : docRows.filter((r) => r.date.startsWith(monthFilter));
  const total = filtered.reduce((s, r) => s + r.docFee, 0);

  return (
    <Card title={`Hujjat xarajatlari (${filtered.length})`} pad={false}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {months.length > 1 && (
            <Sel value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
              style={{ padding: "5px 8px", fontSize: 11.5, width: 130 }}
              options={months.map((m) => ({ value: m, label: m === "hammasi" ? "Barcha oylar" : m }))} />
          )}
          <span className="mo" style={{ fontSize: 13, fontWeight: 700, color: T.flame }}>{fmtSum(total)}</span>
        </div>
      }>
      <Tbl
        empty="Hujjat xarajati kiritilmagan"
        cols={[
          { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
          { k: "plate", h: "Raqam", r: (r) => <span className="mo" style={{ fontWeight: 700, color: T.flame }}>{r.plate}</span> },
          { k: "carModel", h: "Mashina" },
          { k: "serviceType", h: "Xizmat", r: (r) => <Badge color={SERVICE_COLORS[r.serviceType] || T.blue}>{r.serviceType}</Badge> },
          { k: "docFee", h: "Summa", r: (r) => <span className="mo" style={{ fontWeight: 700, color: T.red }}>{fmtSum(r.docFee)}</span> },
        ]}
        rows={filtered}
      />
    </Card>
  );
}

function SupplierHistoryModal({ supplier, data, patch, onClose }) {
  const name = supplier.name;

  // 1) Qarz oshishi — mahsulot kirimi (stockIns)
  const srcStockIns = (data.stockIns || [])
    .filter((s) => sameName(s.supplier, name) && s.sourceType !== "O'z mahsuloti");
  const purchases = srcStockIns.map((s) => ({
    date: s.date, time: s.time || "", kind: "olindi",
    label: `${s.productName} × ${s.qty}` + (s.currency === "USD" && num(s.totalOriginal) > 0 ? ` — ${fmtUsd(s.totalOriginal)}` : ""),
    change: +num(s.totalSum),
  }));

  // 2) Qarz oshishi — qo'lda kiritilgan eski qarzlar (har biri o'chirilishi/tuzatilishi mumkin)
  const srcOld = (data.oldSupplierDebts || []).filter((o) => sameName(o.name, name));
  const oldDebts = srcOld.map((o) => ({
    id: o.id, date: o.date, time: o.time || "", kind: "eski",
    label: o.note || "Eski qarz (qo'lda kiritilgan)",
    change: +num(o.amountSum),
  }));

  // 3) Qarz kamayishi — kassadagi to'lovlar
  const payments = (data.cashflow || [])
    .filter((c) => sameName(c.supplier, name) && c.type === "chiqim")
    .map((c) => ({
      date: c.date, time: c.time || "", kind: "tolov",
      label: c.note || "To'lov",
      change: -num(c.amountSum),
      paymentType: c.paymentType,
    }));

  // MUHIM: paidSum ichida kassadagi to'lovlar HAM bor (FIFO taqsimlangan).
  // Ikki marta hisoblamaslik uchun faqat FARQNI — kassada aks etmagan
  // (masalan kirim paytida darhol berilgan) qismni alohida qator qilamiz.
  const totalPaidOnRecords =
    srcStockIns.reduce((s, r) => s + num(r.paidSum), 0) +
    srcOld.reduce((s, r) => s + num(r.paidAmount || 0), 0);
  const totalCashflowPaid = payments.reduce((s, p) => s + Math.abs(p.change), 0);
  const untracked = totalPaidOnRecords - totalCashflowPaid;
  const prepaidRows = untracked > 0.5 ? [{
    date: srcStockIns[0]?.date || srcOld[0]?.date || todayISO(), time: "", kind: "tolov",
    label: "Kirim paytida / avval to'langan (kassada aks etmagan)",
    change: -untracked,
  }] : [];

  const all = [...purchases, ...oldDebts, ...payments, ...prepaidRows]
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

  // Yugurib boruvchi qoldiq
  let running = 0;
  const rows = all.map((r) => {
    running += r.change;
    return { ...r, balance: running };
  }).reverse(); // eng yangisi tepada

  const totalTaken = purchases.reduce((s, r) => s + r.change, 0) + oldDebts.reduce((s, r) => s + r.change, 0);
  const totalPaid = -(payments.reduce((s, r) => s + r.change, 0) + prepaidRows.reduce((s, r) => s + r.change, 0));

  // Kassa/Qarz daftaridagi asosiy balans (supplierDebts()) har bir yozuvning o'z paidSum
  // maydonidan hisoblanadi. Agar avvalgi xato (ism yozilishi farqi) tufayli biror to'lov
  // noto'g'ri yozuvga qo'llangan bo'lsa, ikkalasi mos kelmay qolishi mumkin.
  const mismatch = Math.abs((totalTaken - totalPaid) - (
    srcStockIns.reduce((s, r) => s + (num(r.totalSum) - num(r.paidSum)), 0) +
    srcOld.reduce((s, r) => s + (num(r.amountSum) - num(r.paidAmount || 0)), 0)
  )) > 1;

  function recalcBalance() {
    patch((d) => {
      const stockRows = (d.stockIns || [])
        .filter((s) => sameName(s.supplier, name) && s.sourceType !== "O'z mahsuloti")
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const oldRows = (d.oldSupplierDebts || [])
        .filter((o) => sameName(o.name, name))
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      // Haqiqatda kassadan chiqqan pul — "Ta'minotchiga to'lov" yozuvlari (yagona ishonchli manba,
      // chunki har bir to'lov yo'li — kirimda darhol yoki keyinroq — shu yerga ham yoziladi).
      const totalCashflowPaid = (d.cashflow || [])
        .filter((c) => sameName(c.supplier, name) && c.type === "chiqim")
        .reduce((s, c) => s + num(c.amountSum), 0);
      let remaining = totalCashflowPaid;
      stockRows.forEach((s) => {
        const pay = Math.min(num(s.totalSum), remaining);
        s.paidSum = pay;
        remaining -= pay;
      });
      oldRows.forEach((o) => {
        const pay = Math.min(num(o.amountSum), remaining);
        o.paidAmount = pay;
        o.paid = pay >= num(o.amountSum) - 0.5;
        remaining -= pay;
      });
      return d;
    });
  }

  return (
    <Modal title={`${name} — qarz harakati tarixi`} onClose={onClose} xwide>
      {mismatch && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          background: T.goldD, border: `1px solid ${T.gold}40`, borderRadius: 9, padding: "11px 15px", marginBottom: 14,
        }}>
          <span style={{ fontSize: 12, color: T.gold }}>
            <b>Diqqat:</b> bu yerdagi hisob-kitob bilan Kassa/Qarz daftaridagi balans mos kelmayapti
            (ehtimol, avval nomi biroz boshqacha yozilgan holatda to'lov noto'g'ri yozuvga tushib qolgan).
          </span>
          <Btn size="sm" variant="gold" onClick={async () => {
            if (await askConfirm(
              "Balans qayta hisoblansinmi?\n\n" +
              "Haqiqiy to'langan pul (kassa yozuvlari) asosida har bir yozuvning to'langan qismi qaytadan taqsimlanadi.\n" +
              "Kassadagi yozuvlarning o'ziga tegilmaydi — faqat ushbu ta'minotchining ichki hisob-kitobi to'g'rilanadi."
            )) recalcBalance();
          }}>
            <RefreshCw size={12} /> Balansni qayta hisoblash
          </Btn>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11, marginBottom: 18 }}>
        <div style={{ background: T.s3, borderRadius: 9, padding: "12px 15px" }}>
          <div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 6 }}>Jami olindi</div>
          <div className="mo" style={{ fontSize: 16, fontWeight: 700, color: T.muted2 }}>{fmtSum(totalTaken)}</div>
        </div>
        <div style={{ background: T.tealD, borderRadius: 9, padding: "12px 15px" }}>
          <div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 6 }}>Jami to'landi</div>
          <div className="mo" style={{ fontSize: 16, fontWeight: 700, color: T.teal }}>{fmtSum(totalPaid)}</div>
        </div>
        <div style={{ background: T.redD, borderRadius: 9, padding: "12px 15px" }}>
          <div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 6 }}>Qolgan qarz</div>
          <div className="mo" style={{ fontSize: 16, fontWeight: 700, color: T.red }}>{fmtSum(totalTaken - totalPaid)}</div>
        </div>
      </div>

      <Tbl
        empty="Harakat yo'q"
        pageSize={40}
        maxH={0}
        cols={[
          { k: "date", h: "Sana", r: (r) => (
              <span style={{ fontSize: 12 }}>{fmtDate(r.date)}{r.time && <span style={{ color: T.muted }}> · {r.time}</span>}</span>
            ) },
          { k: "kind", h: "Amal", r: (r) => (
              r.kind === "tolov"
                ? <Badge color={T.teal}>To'lov</Badge>
                : r.kind === "eski"
                  ? <Badge color={T.gold}>Eski qarz</Badge>
                  : <Badge color={T.red}>Mahsulot olindi</Badge>
            ) },
          { k: "label", h: "Tafsilot", r: (r) => (
              <span style={{ color: T.muted2, fontSize: 12 }}>
                {r.label}
                {r.paymentType && <span style={{ color: T.muted }}> ({r.paymentType})</span>}
              </span>
            ) },
          { k: "change", h: "O'zgarish", r: (r) => (
              <span className="mo" style={{ fontWeight: 700, color: r.change > 0 ? T.red : T.teal }}>
                {r.change > 0 ? "+" : "−"}{fmtSum(Math.abs(r.change))}
              </span>
            ) },
          { k: "balance", h: "Qoldiq qarz", r: (r) => (
              <span className="mo" style={{ fontWeight: 700, color: r.balance > 0.5 ? T.red : T.teal }}>{fmtSum(r.balance)}</span>
            ) },
          { k: "act", h: "", r: (r) => (
              r.kind === "eski" && r.id ? (
                <button onClick={async () => {
                  if (!(await askConfirm(`Bu yozuv o'chirilsinmi?\n\n"${r.label}" — ${fmtSum(r.change)}\n\nAgar bu xato/takroriy kiritilgan bo'lsa, o'chiring.`))) return;
                  patch((d) => { d.oldSupplierDebts = (d.oldSupplierDebts || []).filter((o) => o.id !== r.id); return d; });
                }} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: 4 }}>
                  <Trash2 size={13} />
                </button>
              ) : null
            ) },
        ]}
        rows={rows}
      />

      <p style={{ fontSize: 11, color: T.muted, marginTop: 14, textAlign: "center" }}>
        "Qoldiq qarz" — har bir amaldan keyingi holat. Eng yangi yozuv yuqorida.
      </p>
    </Modal>
  );
}

function PaySupplierForm({ supplier, rate, onSave }) {
  const [currency, setCurrency] = useState("SUM");
  const [paymentType, setPaymentType] = useState("Naqd pul");
  const [amt, setAmt] = useState(String(Math.round(supplier.debtSum)));
  const amountSum = toSum(amt, currency, rate);

  return (
    <div>
      <div style={{ marginBottom: 14, padding: "10px 14px", background: T.redD, borderRadius: 8 }}>
        <span style={{ fontSize: 12, color: T.red }}>Joriy qarz: <b>{fmtSum(supplier.debtSum)}</b></span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Valyuta"><CurrencyToggle value={currency} onChange={setCurrency} /></F>
        <F label="To'lov turi"><Sel value={paymentType} onChange={(e) => setPaymentType(e.target.value)} options={PAYMENT_TYPES} /></F>
      </div>

      <div style={{ marginTop: 12 }}>
        <F label={`Summa (${currency})`}>
          <input type="number" style={iSt} value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus />
        </F>
      </div>

      {currency === "USD" && (
        <div style={{ marginTop: 10, padding: "9px 13px", background: T.s3, borderRadius: 7, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11.5, color: T.muted }}>Ekvivalenti (so'm)</span>
          <span className="mo" style={{ fontSize: 12, fontWeight: 700 }}>{fmtSum(amountSum)}</span>
        </div>
      )}

      <SaveBtn disabled={!amt} onClick={() => onSave(amountSum, { currency, paymentType, amountOriginal: num(amt) })}>
        To'lovni saqlash
      </SaveBtn>
    </div>
  );
}

function NewCashflowModal({ data, debts, rate, onClose, onSave, initialType = "kirim", initialCategory }) {
  const [type, setType] = useState(initialType || "kirim");
  const cats = type === "kirim" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [category, setCategory] = useState(initialCategory || cats[0]);
  const [currency, setCurrency] = useState("SUM");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("Naqd pul");
  const [supplier, setSupplier] = useState(debts[0]?.name || "");
  const [debtTxType, setDebtTxType] = useState(DEBT_TX_TYPES[0]);
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [note, setNote] = useState("");
  // Qarzdan kirim / ta'minotchi to'lovi — qaysi hisobdan yechiladi
  const collectable = useMemo(() => listCollectableDebts(data), [data]);
  const [debtKey, setDebtKey] = useState(""); // "kind|id"

  useEffect(() => {
    const nextCats = type === "kirim" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setCategory(nextCats[0]);
    setDebtKey("");
  }, [type]);

  useEffect(() => {
    // Turkum o'zgarganda mos birinchi qarzni tanlash
    if (category === "Qarzdan kirim") {
      setDebtKey(collectable[0] ? `${collectable[0].kind}|${collectable[0].id}` : "");
    } else if (category === "Ta'minotchiga to'lov") {
      setSupplier(debts[0]?.name || "");
      setDebtKey(debts[0] ? `supplier|${debts[0].name}` : "");
    } else if (category === "Hamkordan to'lov") {
      const partners = collectable.filter((c) => c.kind === "partner");
      setDebtKey(partners[0] ? `${partners[0].kind}|${partners[0].id}` : "");
    } else {
      setDebtKey("");
    }
  }, [category]);

  const amountSum = toSum(amount, currency, rate);
  const isSupplierPay = type === "chiqim" && category === "Ta'minotchiga to'lov";
  const isDebtCollect = type === "kirim" && (category === "Qarzdan kirim" || category === "Hamkordan to'lov");
  const isDebtRelated = isSupplierPay || category === "Rahbarga chiqim" || category === "Rahbardan kirim" || isDebtCollect;

  const selectedDebt = useMemo(() => {
    if (!debtKey) return null;
    const [kind, ...rest] = debtKey.split("|");
    const id = rest.join("|");
    if (kind === "supplier") {
      const s = debts.find((d) => d.name === id);
      return s ? { kind: "supplier", id: s.name, name: s.name, label: s.name, remaining: s.debtSum } : null;
    }
    return collectable.find((c) => c.kind === kind && String(c.id) === id) || null;
  }, [debtKey, collectable, debts]);

  const maxDebt = selectedDebt ? num(selectedDebt.remaining) : 0;
  const overDebt = isDebtCollect || isSupplierPay ? (selectedDebt && amountSum > maxDebt + 0.5) : false;

  function fillFull() {
    if (!selectedDebt) return;
    setCurrency("SUM");
    setAmount(String(Math.round(selectedDebt.remaining)));
  }

  function handleSave() {
    if (!amountSum || amountSum <= 0) return;
    if ((isDebtCollect || isSupplierPay) && !selectedDebt) return;
    const paySum = (isDebtCollect || isSupplierPay) && selectedDebt
      ? Math.min(amountSum, num(selectedDebt.remaining))
      : amountSum;

    const debtSettle = (isDebtCollect || isSupplierPay) && selectedDebt
      ? { kind: selectedDebt.kind, id: selectedDebt.id, name: selectedDebt.name || selectedDebt.label }
      : undefined;

    let autoNote = note.trim();
    if (isDebtCollect && selectedDebt && !autoNote) {
      autoNote = `Qarzdan kirim — ${selectedDebt.label}`;
    }
    if (isSupplierPay && selectedDebt && !autoNote) {
      autoNote = `Qarz to'lovi — ${selectedDebt.name || selectedDebt.label}`;
    }

    onSave({
      date: todayISO(),
      type,
      category: isDebtCollect && category === "Hamkordan to'lov" ? "Hamkordan to'lov"
        : isDebtCollect ? "Qarzdan kirim"
        : category,
      currency,
      amount: currency === "USD" ? num(amount) : paySum,
      amountSum: paySum,
      amountUsd: paySum / rate,
      paymentType,
      supplier: isSupplierPay ? (selectedDebt?.name || supplier) : undefined,
      debtTxType: isDebtRelated ? debtTxType : undefined,
      reminderDate: reminderOn ? reminderDate : undefined,
      note: autoNote,
      debtSettle,
    });
  }

  const debtOptions = isSupplierPay
    ? debts.map((d) => ({ value: `supplier|${d.name}`, label: `${d.name} — qarz: ${fmtSum(d.debtSum)}` }))
    : category === "Hamkordan to'lov"
      ? collectable.filter((c) => c.kind === "partner").map((c) => ({
          value: `${c.kind}|${c.id}`,
          label: `${c.label} — ${fmtSum(c.remaining)}`,
        }))
      : collectable.map((c) => ({
          value: `${c.kind}|${c.id}`,
          label: `${c.label} — ${fmtSum(c.remaining)}`,
        }));

  return (
    <Modal title="Kassa yozuvi" onClose={onClose} wide>
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border2}`, marginBottom: 14 }}>
        <button type="button" onClick={() => setType("kirim")} style={{ flex: 1, padding: 9, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: type === "kirim" ? T.teal : "transparent", color: type === "kirim" ? "#fff" : T.muted }}>Kirim</button>
        <button type="button" onClick={() => setType("chiqim")} style={{ flex: 1, padding: 9, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: type === "chiqim" ? T.red : "transparent", color: type === "chiqim" ? "#fff" : T.muted }}>Chiqim</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Turkum"><Sel value={category} onChange={(e) => setCategory(e.target.value)} options={cats} /></F>
        <F label="To'lov usuli"><Sel value={paymentType} onChange={(e) => setPaymentType(e.target.value)} options={PAYMENT_TYPES} /></F>
        <F label="Valyuta"><CurrencyToggle value={currency} onChange={setCurrency} /></F>
        <F label={`Summa (${currency})`}>
          <input type="number" style={iSt} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </F>

        {(isDebtCollect || isSupplierPay) && (
          <F label={isSupplierPay ? "Ta'minotchi (qarzimiz)" : "Qarzdor / hisob (bizga qarz)"} col="1/-1">
            {debtOptions.length ? (
              <Sel value={debtKey} onChange={(e) => setDebtKey(e.target.value)} options={debtOptions} />
            ) : (
              <p style={{ fontSize: 12.5, color: T.muted, padding: "8px 0" }}>
                {isSupplierPay ? "Ochiq ta'minotchi qarzi yo'q" : "Ochiq qarzdorlik yo'q — avval Qarz daftariga qo'shing"}
              </p>
            )}
          </F>
        )}

        {selectedDebt && (isDebtCollect || isSupplierPay) && (
          <div style={{ gridColumn: "1/-1", background: T.s3, borderRadius: 9, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: T.muted }}>Tanlangan qarz qoldig'i</span>
              <span className="mo" style={{ fontWeight: 700, color: isSupplierPay ? T.red : T.gold }}>{fmtSum(selectedDebt.remaining)}</span>
            </div>
            {selectedDebt.sub && <div style={{ fontSize: 11.5, color: T.muted2, marginBottom: 8 }}>{selectedDebt.sub}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn size="sm" variant="ghost" onClick={fillFull}>To'liq summa</Btn>
              <Btn size="sm" variant="ghost" onClick={() => { setCurrency("SUM"); setAmount(String(Math.round(selectedDebt.remaining / 2))); }}>Yarmi</Btn>
            </div>
            {overDebt && (
              <p style={{ fontSize: 11.5, color: T.red, marginTop: 8 }}>
                Summa qarzdan katta — saqlashda qarz qoldig'igacha cheklanadi ({fmtSum(maxDebt)}).
              </p>
            )}
            <p style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
              {isSupplierPay
                ? "Chiqim kassaga yoziladi va ta'minotchi qarzi (kirim / eski qarz) avtomatik kamayadi."
                : "Kirim kassaga yoziladi va tanlangan qarzdor hisobi avtomatik kamayadi."}
            </p>
          </div>
        )}

        {isDebtRelated && (
          <F label="Qarz amali turi" col="1/-1">
            <Sel value={debtTxType} onChange={(e) => setDebtTxType(e.target.value)} options={DEBT_TX_TYPES} />
          </F>
        )}
      </div>

      {isDebtRelated && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.muted2, cursor: "pointer", marginBottom: 8 }}>
            <input type="checkbox" checked={reminderOn} onChange={(e) => setReminderOn(e.target.checked)} />
            Eslatma qo'yish (qarz muddati)
          </label>
          {reminderOn && (
            <F label="Qachongacha to'lash kerak"><input type="date" style={iSt} value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} /></F>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <F label="Izoh">
          <input style={iSt} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ixtiyoriy izoh" />
        </F>
      </div>

      {paymentType === "Karta (Click/Payme)" && (
        <p style={{ fontSize: 11.5, color: T.purple, marginTop: 10 }}>
          ℹ Bu yozuv kassa balansiga kirmaydi — faqat Click/Payme savdosi sifatida hisoblanadi.
        </p>
      )}

      <SaveBtn
        disabled={!amountSum || amountSum <= 0 || ((isDebtCollect || isSupplierPay) && !selectedDebt)}
        color={type === "kirim" ? T.teal : T.red}
        onClick={handleSave}
      >
        Saqlash
      </SaveBtn>
    </Modal>
  );
}

function DailyReport({ data, onClose }) {
  const todayCF = data.cashflow.filter((c) => c.date === todayISO());
  const todaySC = data.serviceCards.filter((c) => c.date === todayISO());
  const income = todayCF.filter((c) => c.type === "kirim" && c.paymentType !== "Karta (Click/Payme)").reduce((s, c) => s + num(c.amountSum), 0);
  const expense = todayCF.filter((c) => c.type === "chiqim" && c.paymentType !== "Karta (Click/Payme)").reduce((s, c) => s + num(c.amountSum), 0);
  const clickInc = todayCF.filter((c) => c.paymentType === "Karta (Click/Payme)" && c.type === "kirim").reduce((s, c) => s + num(c.amountSum), 0);
  const clickExp = todayCF.filter((c) => c.paymentType === "Karta (Click/Payme)" && c.type === "chiqim").reduce((s, c) => s + num(c.amountSum), 0);
  const kunBalansi = income - expense;

  return (
    <Modal title={`Kun hisoboti — ${fmtDate(todayISO())}`} onClose={onClose} wide>
      <div style={{ display: "grid", gap: 7, marginBottom: 16 }}>
        {[
          ["Jami kartalar", todaySC.length + " ta", T.text],
          ["Servis", todaySC.filter((c) => c.serviceType === "Servis").length + " ta", T.teal],
          ["Ustanovka", todaySC.filter((c) => c.serviceType === "Ustanovka").length + " ta", T.flame],
          ["Detailing", todaySC.filter((c) => c.serviceType === "Detailing").length + " ta", T.purple],
          ["Moy bo'limi", todaySC.filter((c) => c.serviceType === "Moy bo'limi").length + " ta", T.gold],
        ].map(([l, v, c]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 13px", borderRadius: 7, background: T.s3 }}>
            <span style={{ fontSize: 12.5, color: T.muted }}>{l}</span>
            <span className="mo" style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</span>
          </div>
        ))}
      </div>

      {/* NAQD KASSA — balansga ta'sir qiluvchi haqiqiy pul */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted2, marginBottom: 8 }}>
          Naqd kassa (bugungi haqiqiy pul harakati)
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 13px", borderRadius: 7, background: T.tealD }}>
            <span style={{ fontSize: 12.5, color: T.muted2 }}>Bugungi naqd kirim</span>
            <span className="mo" style={{ fontSize: 13, fontWeight: 700, color: T.teal }}>+{fmtSum(income)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 13px", borderRadius: 7, background: T.redD }}>
            <span style={{ fontSize: 12.5, color: T.muted2 }}>Bugungi naqd chiqim</span>
            <span className="mo" style={{ fontSize: 13, fontWeight: 700, color: T.red }}>−{fmtSum(expense)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 13px", borderRadius: 7, background: T.flameD, marginTop: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.flame }}>= Kun balansi (kirim − chiqim)</span>
            <span className="mo" style={{ fontSize: 15, fontWeight: 800, color: kunBalansi >= 0 ? T.teal : T.red }}>{fmtSum(kunBalansi)}</span>
          </div>
        </div>
        {kunBalansi < 0 && (
          <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
            ℹ Manfiy balans — bugun xarajat (masalan qarz to'lovi yoki katta xarid) kirimdan ko'p bo'lgan. Bu xato emas, umumiy kassa qoldig'iga (barcha kunlar yig'indisiga) qarang.
          </p>
        )}
      </div>

      {/* CLICK/PAYME — alohida, balansga kirmaydi */}
      <div style={{ padding: "12px 14px", background: T.purpleD, border: `1px solid ${T.purple}30`, borderRadius: 9 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.purple, marginBottom: 8 }}>
          Click / Payme — kassa balansiga kirmaydi (alohida hisoblanadi)
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
          <span style={{ color: T.muted2 }}>Kirim: <b style={{ color: T.teal }}>{fmtSum(clickInc)}</b></span>
          <span style={{ color: T.muted2 }}>Chiqim: <b style={{ color: T.red }}>{fmtSum(clickExp)}</b></span>
        </div>
      </div>

      <p style={{ fontSize: 11, color: T.muted, textAlign: "center", marginTop: 14 }}>Skrinshot qilib rahbarga yuboring</p>
    </Modal>
  );
}

/* ─── USTA HISOB-KITOBI TAB ─── */
function UstaTab({ data, patch, rate, canManage = true, ustaName }) {
  const [addContractedOpen, setAddContractedOpen] = useState(false);
  const [addApprenticeOpen, setAddApprenticeOpen] = useState(false);
  const [closeSplitGroup, setCloseSplitGroup] = useState(null);
  const isSelf = !canManage; // usta o'zi kirgan — faqat o'ziga tegishlisini ko'radi
  const pendingByName = isSelf
    ? ustaPendingByName(data).filter((u) => sameName(u.usta, ustaName))
    : ustaPendingByName(data);
  const pendingGrouped = isSelf
    ? ustaPendingGrouped(data).filter((g) => sameName(g.usta, ustaName))
    : ustaPendingGrouped(data);
  const totalPending = pendingByName.reduce((s, u) => s + u.amountSum, 0);
  const paidHistory = data.ustaLedger
    .filter((e) => e.paid)
    .filter((e) => !isSelf || sameName(e.usta, ustaName))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const contractedMasters = data.contractedMasters || [];

  const closeGroupLock = useRef(false);
  function closeGroup(g) {
    if (closeGroupLock.current) return;
    // Shogirti bor usta bo'lsa — to'g'ridan-to'g'ri yopmasdan, kassirga shogirt ulushini
    // ko'rsatib tasdiqlash oynasini ochamiz (u xohlagancha o'zgartirishi mumkin).
    const appr = apprenticeFor(apprentices, g.usta);
    if (appr) { setCloseSplitGroup(g); return; }
    closeGroupLock.current = true;
    setTimeout(() => { closeGroupLock.current = false; }, 1500);
    patch((d) => {
      d.ustaLedger.forEach((e) => { if (g.ids.includes(e.id)) e.paid = true; });
      d.cashflow.unshift({
        id: uid(), date: todayISO(), type: "chiqim", category: "Usta xizmat haqi", currency: "SUM",
        amount: g.amountSum, amountSum: g.amountSum, amountUsd: g.amountSum / rate,
        note: g.date ? `${g.usta} — ${fmtDate(g.date)} (${g.count} ta)` : `${g.usta} — (${g.count} ta)`,
        ustaLedgerIds: g.ids,
      });
      return d;
    });
  }

  // Kassir shogirt ulushini tasdiqlagach — ustaning hisobi yopiladi, LEKIN pul ikkiga
  // bo'lib kassadan chiqadi: qolgan qism ustaga, ajratilgan qism shogirtga. Shogirt
  // tomoni darhol "to'langan" deb yoziladi — bu faqat hisobot uchun (usta shogirtga
  // qancha berganini ko'rishi uchun), shogirtning o'zi uchun alohida kutish/yopish yo'q.
  function confirmCloseWithSplit(g, shogirtName, shogirtAmount) {
    patch((d) => {
      d.ustaLedger.forEach((e) => { if (g.ids.includes(e.id)) e.paid = true; });
      const amt = Math.max(0, Math.min(num(shogirtAmount), g.amountSum));
      const ustaAmt = g.amountSum - amt;
      const label = g.date ? `${g.usta} — ${fmtDate(g.date)} (${g.count} ta)` : `${g.usta} — (${g.count} ta)`;
      // ustaCloseId ikkala yozuvni ("usta ulushi" + "shogirt ulushi") bir-biriga bog'laydi —
      // biri o'chirilsa, ikkinchisi ham avtomatik o'chadi va usta hisobi qaytadan
      // "to'lanmagan" holatga qaytadi (Kassadagi oddiy o'chirish tugmasi orqali).
      const closeId = uid();
      const shogirtLedgerId = amt > 0 ? uid() : undefined;
      d.cashflow.unshift({
        id: uid(), date: todayISO(), type: "chiqim", category: "Usta xizmat haqi", currency: "SUM",
        amount: ustaAmt, amountSum: ustaAmt, amountUsd: ustaAmt / rate,
        note: amt > 0 ? `${label} — shogirt (${shogirtName}) uchun ${fmtSum(amt)} ajratildi` : label,
        ustaLedgerIds: g.ids, ustaCloseId: closeId,
      });
      if (amt > 0) {
        d.cashflow.unshift({
          id: uid(), date: todayISO(), type: "chiqim", category: "Usta xizmat haqi", currency: "SUM",
          amount: amt, amountSum: amt, amountUsd: amt / rate,
          note: `${shogirtName} — ${g.usta} shogirt ulushi`,
          ustaCloseId: closeId, shogirtLedgerId,
        });
        d.ustaLedger.unshift({
          id: shogirtLedgerId, date: todayISO(), usta: shogirtName, amountSum: amt, paid: true,
          shogirtSourceUsta: g.usta, note: `${g.usta} shogirt ulushi`,
        });
      }
      return d;
    });
    setCloseSplitGroup(null);
  }

  function addContractedMaster(name) {
    patch((d) => {
      d.contractedMasters = d.contractedMasters || [];
      if (!d.contractedMasters.some((m) => m.name === name)) {
        d.contractedMasters.push({ id: uid(), name });
      }
      return d;
    });
  }

  function removeContractedMaster(id) {
    patch((d) => { d.contractedMasters = (d.contractedMasters || []).filter((m) => m.id !== id); return d; });
  }

  const apprentices = data.apprentices || [];
  function addApprentice(usta, shogirt, percent) {
    patch((d) => {
      d.apprentices = d.apprentices || [];
      // Har bir ustaga bitta shogirt — eskisi bo'lsa almashtiramiz (chalkashmasin)
      d.apprentices = d.apprentices.filter((a) => !sameName(a.usta, usta));
      d.apprentices.push({ id: uid(), usta, shogirt, percent: num(percent) || 20 });
      return d;
    });
  }
  function removeApprentice(id) {
    patch((d) => { d.apprentices = (d.apprentices || []).filter((a) => a.id !== id); return d; });
  }

  // Har bir usta o'z shogirtiga jami qancha berganini (kassir har yopishda tasdiqlagan
  // summalar bo'yicha) ko'radi
  const shogirtTotals = {};
  data.ustaLedger.filter((e) => e.shogirtSourceUsta).forEach((e) => {
    const key = e.shogirtSourceUsta + "→" + e.usta;
    if (!shogirtTotals[key]) shogirtTotals[key] = { usta: e.shogirtSourceUsta, shogirt: e.usta, total: 0 };
    shogirtTotals[key].total += num(e.amountSum);
  });
  const shogirtTotalsList = Object.values(shogirtTotals)
    .filter((s) => !isSelf || sameName(s.usta, ustaName))
    .sort((a, b) => b.total - a.total);

  // shu ustalarning bu oyda servisga qo'shgan foydasi (bonus)
  const contractedBonusThisMonth = data.serviceCards
    .filter((c) => c.ustaIsContracted && (c.date || "").startsWith(currentMonthKey()))
    .reduce((s, c) => s + num(c.contractedUstaBonus), 0);

  return (
    <div>
      {!canManage && (
        <div style={{ background: T.s2, border: `1px solid ${T.border2}`, borderRadius: 10, padding: "11px 15px", marginBottom: 16, fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 8 }}>
          <Lock size={13} color={T.flame} /> Faqat ko'rish — to'lovlarni yopish uchun Kassirga murojaat qiling
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13, marginBottom: 20 }}>
        <Stat label="Kutilayotgan jami" value={fmtSum(totalPending)} sub={fmtUsd(totalPending / rate)} color={T.gold} Icon={Wrench} />
        <Stat label="Qarzdor ustalar" value={pendingByName.length + " ta"} color={T.blue} Icon={Users} />
        <Stat label="To'langan yozuvlar" value={paidHistory.length + " ta"} color={T.teal} Icon={Check} />
        {canManage && <Stat label="Kelishilgan bonus (bu oy)" value={fmtSum(contractedBonusThisMonth)} sub="servis foydasiga qo'shildi" color={T.purple} Icon={Star} />}
      </div>

      {canManage && (
        <div style={{ marginBottom: 16 }}>
          <Card title="Kelishilgan (oylik) ustalar"
            action={<Btn size="sm" onClick={() => setAddContractedOpen(true)}><Plus size={12} /> Qo'shish</Btn>}>
            <p style={{ fontSize: 12, color: T.muted, marginBottom: contractedMasters.length ? 12 : 0 }}>
              Bu ro'yxatdagi ustalarning xizmat haqi kassadan to'lanmaydi — <b>servis foydasi</b> sifatida hisoblanadi
              (chunki ular oylik maosh oladi, kunlik emas).
            </p>
            {contractedMasters.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {contractedMasters.map((m) => (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: T.purpleD, border: `1px solid ${T.purple}30`,
                    borderRadius: 20, padding: "6px 8px 6px 14px", fontSize: 12.5, fontWeight: 600,
                  }}>
                    {m.name}
                    <button onClick={() => removeContractedMaster(m.id)} style={{
                      background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 2, display: "flex",
                    }}><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {canManage && (
        <div style={{ marginBottom: 16 }}>
          <Card title="Shogirtlar"
            action={<Btn size="sm" onClick={() => setAddApprenticeOpen(true)}><Plus size={12} /> Qo'shish</Btn>}>
            <p style={{ fontSize: 12, color: T.muted, marginBottom: apprentices.length ? 12 : 0 }}>
              Usta shogirt bilan ishlasa — ustaning hisobi ("Kutilayotgan jami") to'liq ko'rinishda
              qoladi, usta faqat kuzatadi. Kassir shu ustani "Yopish" bosganda, belgilangan foiz
              (odatda 20%) shogirt ulushi sifatida taklif etiladi — kassir aniq summani o'zi
              (kamroq yoki ko'proq) belgilab, ikkalasiga alohida to'laydi.
            </p>
            {apprentices.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {apprentices.map((a) => (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    background: T.s3, borderRadius: 10, padding: "9px 13px",
                  }}>
                    <span style={{ fontSize: 12.5 }}>
                      <b>{a.usta}</b> <span style={{ color: T.muted }}>→</span> <b>{a.shogirt}</b>
                      <span style={{ color: T.gold, marginLeft: 8 }}>({a.percent}%)</span>
                    </span>
                    <button onClick={() => removeApprentice(a.id)} style={{
                      background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 2, display: "flex",
                    }}><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {shogirtTotalsList.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Card title="Shogirt ulushlari (jami ajratilgan)" pad={false}>
            <Tbl
              cols={[
                { k: "usta", h: "Usta", r: (r) => <span style={{ fontWeight: 600 }}>{r.usta}</span> },
                { k: "shogirt", h: "Shogirt", r: (r) => r.shogirt },
                { k: "total", h: "Jami ajratilgan", r: (r) => <span style={{ color: T.gold, fontWeight: 700 }}>{fmtSum(r.total)}</span> },
              ]}
              rows={shogirtTotalsList}
            />
          </Card>
        </div>
      )}

      <Card title="Usta bo'yicha holat" pad={false}>
        <Tbl
          empty="Kutilayotgan to'lov yo'q"
          cols={[
            { k: "usta", h: "Usta", r: (r) => <span style={{ fontWeight: 600 }}>{r.usta}</span> },
            { k: "count", h: "Xizmatlar" },
            { k: "amountSum", h: "Jami", r: (r) => <span style={{ color: T.flame, fontWeight: 700 }}>{fmtSum(r.amountSum)}</span> },
            ...(canManage ? [{ k: "act", h: "", r: (r) => <Btn size="sm" variant="teal" onClick={() => closeGroup(r)}>Yopish</Btn> }] : []),
          ]}
          rows={pendingByName}
        />
      </Card>

      <div style={{ marginTop: 16 }}>
        <UstaWorkHistory data={data} lockedUsta={isSelf ? ustaName : null} />
      </div>
      <div style={{ marginTop: 16 }}>
        <Card title="Kun bo'yicha yig'ilgan" pad={false}>
          <Tbl
            empty="Yozuv yo'q"
            cols={[
              { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
              { k: "usta", h: "Usta" },
              { k: "count", h: "Soni" },
              { k: "amountSum", h: "Summa", r: (r) => <span style={{ fontWeight: 700 }}>{fmtSum(r.amountSum)}</span> },
              ...(canManage ? [{ k: "act", h: "", r: (r) => <Btn size="sm" variant="gold" onClick={() => closeGroup(r)}>Kunni yopish</Btn> }] : []),
            ]}
            rows={pendingGrouped}
          />
        </Card>
      </div>
      <div style={{ marginTop: 16 }}>
        <Card title="To'langan tarix" pad={false}>
          <Tbl
            empty="Ma'lumot yo'q"
            cols={[
              { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
              { k: "usta", h: "Usta" },
              { k: "amountSum", h: "Summa", r: (r) => <span style={{ color: T.teal, fontWeight: 700 }}>{fmtSum(r.amountSum)}</span> },
            ]}
            rows={paidHistory}
          />
        </Card>
      </div>

      {addContractedOpen && (
        <AddContractedMasterModal ustaNames={ustaNameOptions(data)}
          onClose={() => setAddContractedOpen(false)}
          onSave={(name) => { addContractedMaster(name); setAddContractedOpen(false); }} />
      )}
      {addApprenticeOpen && (
        <AddApprenticeModal ustaNames={ustaNameOptions(data)}
          onClose={() => setAddApprenticeOpen(false)}
          onSave={(usta, shogirt, percent) => { addApprentice(usta, shogirt, percent); setAddApprenticeOpen(false); }} />
      )}
      {closeSplitGroup && (
        <CloseUstaWithApprenticeModal group={closeSplitGroup} apprentice={apprenticeFor(apprentices, closeSplitGroup.usta)}
          onClose={() => setCloseSplitGroup(null)}
          onConfirm={(shogirtAmount) => confirmCloseWithSplit(closeSplitGroup, apprenticeFor(apprentices, closeSplitGroup.usta).shogirt, shogirtAmount)} />
      )}
    </div>
  );
}

function CloseUstaWithApprenticeModal({ group, apprentice, onClose, onConfirm }) {
  const suggested = Math.round(num(group.amountSum) * (num(apprentice.percent) || 20) / 100);
  const [shogirtAmount, setShogirtAmount] = useState(String(suggested));
  const ustaAmount = Math.max(0, num(group.amountSum) - num(shogirtAmount));
  return (
    <Modal title={`${group.usta} — hisobni yopish`} onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
        Jami hisob: <b className="mo">{fmtSum(group.amountSum)}</b>. Shogirt (<b>{apprentice.shogirt}</b>)
        ulushi taklif etilgan {apprentice.percent}% — xohlasangiz o'zgartiring.
      </p>
      <F label={`Shogirt (${apprentice.shogirt}) ulushi`}>
        <input type="number" style={iSt} value={shogirtAmount} onChange={(e) => setShogirtAmount(e.target.value)} autoFocus />
      </F>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 2px 0", fontSize: 13 }}>
        <span style={{ color: T.muted }}>{group.usta}ga qoladi</span>
        <span className="mo" style={{ fontWeight: 700, color: T.flame }}>{fmtSum(ustaAmount)}</span>
      </div>
      <SaveBtn color={T.teal} onClick={() => onConfirm(num(shogirtAmount))}>
        <Check size={15} /> Tasdiqlash va yopish
      </SaveBtn>
    </Modal>
  );
}

function AddApprenticeModal({ ustaNames, onClose, onSave }) {
  const [usta, setUsta] = useState("");
  const [shogirt, setShogirt] = useState("");
  const [percent, setPercent] = useState(20);
  return (
    <Modal title="Shogirt qo'shish" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
        Bu ustaning xizmat haqidan belgilangan foizi endi avtomatik shogirtga ajratiladi
        (usta karta yakunlaganda). Har bir ustaga bitta shogirt biriktirish mumkin.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        <F label="Usta ismi">
          <input style={iSt} value={usta} onChange={(e) => setUsta(e.target.value)}
            list="apprentice-usta-list" placeholder="Masalan: Umarxon" autoFocus />
          <datalist id="apprentice-usta-list">{ustaNames.map((n) => <option key={n} value={n} />)}</datalist>
        </F>
        <F label="Shogirt ismi">
          <input style={iSt} value={shogirt} onChange={(e) => setShogirt(e.target.value)} placeholder="Masalan: Sardor" />
        </F>
        <F label="Shogirt ulushi (%)">
          <input type="number" style={iSt} value={percent} onChange={(e) => setPercent(e.target.value)} min={1} max={100} />
        </F>
      </div>
      <SaveBtn disabled={!usta.trim() || !shogirt.trim() || !num(percent)} color={T.purple}
        onClick={() => onSave(usta.trim(), shogirt.trim(), num(percent))}>
        <Plus size={15} /> Qo'shish
      </SaveBtn>
    </Modal>
  );
}

function AddContractedMasterModal({ ustaNames, onClose, onSave }) {
  const [name, setName] = useState("");
  return (
    <Modal title="Kelishilgan usta qo'shish" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
        Usta ismini kiriting yoki mavjud ustalar ro'yxatidan tanlang. Bu usta uchun xizmat haqi
        endi kassadan to'lanmaydi — servis foydasiga qo'shiladi.
      </p>
      <F label="Usta ismi">
        <input style={iSt} value={name} onChange={(e) => setName(e.target.value)}
          list="contracted-usta-list" placeholder="Masalan: Ravshan aka" autoFocus />
        <datalist id="contracted-usta-list">{ustaNames.map((n) => <option key={n} value={n} />)}</datalist>
      </F>
      <SaveBtn disabled={!name.trim()} color={T.purple} onClick={() => onSave(name.trim())}>
        <Plus size={15} /> Qo'shish
      </SaveBtn>
    </Modal>
  );
}

/* ─── USTA ISH TARIXI — kim, qaysi bo'limda, nima ish qildi ─── */
function UstaWorkHistory({ data, lockedUsta }) {
  const [ustaFilter, setUstaFilter] = useState(lockedUsta || "hammasi");
  const [typeFilter, setTypeFilter] = useState("hammasi");

  // Barcha kartalardan usta xizmat haqi yozuvlarini yig'amiz — izoh bilan
  const rows = data.serviceCards.flatMap((c) =>
    (c.ustaFeeEntries || []).map((e) => ({
      id: e.id, date: c.date, usta: c.usta || "Noma'lum",
      serviceType: c.serviceType, plate: c.plate,
      note: e.note || "(izohsiz)", amount: num(e.amount),
    }))
  ).filter((r) => !lockedUsta || sameName(r.usta, lockedUsta))
   .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const ustaNames = [...new Set(rows.map((r) => r.usta))];

  const filtered = rows
    .filter((r) => ustaFilter === "hammasi" || r.usta === ustaFilter)
    .filter((r) => typeFilter === "hammasi" || r.serviceType === typeFilter);

  const total = filtered.reduce((s, r) => s + r.amount, 0);

  // Izoh (ish turi) bo'yicha guruhlash — shaffoflik va tahlil uchun
  const byNote = {};
  filtered.forEach((r) => {
    if (!byNote[r.note]) byNote[r.note] = { note: r.note, count: 0, total: 0 };
    byNote[r.note].count += 1;
    byNote[r.note].total += r.amount;
  });
  const noteStats = Object.values(byNote).sort((a, b) => b.total - a.total);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {!lockedUsta && (
          <Sel value={ustaFilter} onChange={(e) => setUstaFilter(e.target.value)}
            style={{ width: 170 }}
            options={[{ value: "hammasi", label: "Barcha ustalar" }, ...ustaNames.map((n) => ({ value: n, label: n }))]} />
        )}
        <Sel value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          style={{ width: 170 }}
          options={[{ value: "hammasi", label: "Barcha bo'limlar" }, ...SERVICE_TYPES.map((t) => ({ value: t, label: t }))]} />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: T.muted }}>Jami:</span>
          <span className="mo" style={{ fontSize: 14, fontWeight: 700, color: T.flame }}>{fmtSum(total)}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <Card title={`Ish tarixi (${filtered.length})`} pad={false}>
          <div style={{ padding: "14px 18px" }}>
            <DateGroupedList
              empty="Yozuv yo'q"
              amountFn={(r) => num(r.amount)}
              cols={[
                { k: "usta", h: "Usta", r: (r) => <span style={{ fontWeight: 600 }}>{r.usta}</span> },
                { k: "serviceType", h: "Bo'lim", r: (r) => <Badge color={SERVICE_COLORS[r.serviceType] || T.blue}>{r.serviceType}</Badge> },
                { k: "plate", h: "Mashina", r: (r) => <span className="mo" style={{ fontSize: 12 }}>{r.plate}</span> },
                { k: "note", h: "Nima ish qildi", r: (r) => <span style={{ color: T.muted2 }}>{r.note}</span> },
                { k: "amount", h: "Summa", r: (r) => <span className="mo" style={{ fontWeight: 700, color: T.gold }}>{fmtSum(r.amount)}</span> },
              ]}
              rows={filtered}
            />
          </div>
        </Card>
        <Card title="Ish turi bo'yicha yig'indi">
          {noteStats.length === 0 ? (
            <p style={{ fontSize: 12, color: T.muted }}>Ma'lumot yo'q</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {noteStats.slice(0, 10).map((n) => (
                <div key={n.note} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}25` }}>
                  <span style={{ fontSize: 12, color: T.muted2 }}>{n.note} <span style={{ color: T.muted, fontSize: 10.5 }}>({n.count} marta)</span></span>
                  <span className="mo" style={{ fontSize: 12.5, fontWeight: 700 }}>{fmtSum(n.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ─── WARRANTY TAB ─── */
function warrantyStatus(card) {
  if (!card.hasWarranty) return null;
  const expiry = new Date(card.date);
  expiry.setMonth(expiry.getMonth() + num(card.warrantyMonths));
  return { expiryISO: expiry.toISOString().slice(0, 10), active: expiry >= new Date(todayISO()) };
}

function WarrantyTab({ data, patch, rate }) {
  const [claimOpen, setClaimOpen] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);

  const cards = data.serviceCards.filter((c) => c.hasWarranty).map((c) => ({ ...c, w: warrantyStatus(c) }));
  const manual = (data.warranty || []).map((w) => ({ ...w, w: warrantyStatus(w) }));
  const all = [...cards, ...manual];
  const active = all.filter((c) => c.w?.active).length;

  function addClaim(claim) {
    patch((d) => {
      const product = d.products.find((p) => p.id === claim.replacementProductId);
      // Almashtirilib beriladigan mahsulotning haqiqiy tan narxi — mijozdan pul
      // olinmaydi, lekin bu sklad uchun real xarajat, shuning uchun kassaga yozamiz.
      const replacementCost = product ? num(product.costSum) * num(claim.qty) : 0;
      if (product) product.qty = Math.max(0, num(product.qty) - claim.qty);
      d.brokenItems = d.brokenItems || [];
      d.brokenItems.push({ id: uid(), date: todayISO(), name: claim.brokenProduct, qty: claim.qty, fromPlate: claim.plate, status: "Tekshirilmoqda" });
      d.warrantyClaims.unshift({ id: uid(), ...claim });
      if (claim.ustaFeeCharged > 0) {
        d.cashflow.unshift({ id: uid(), date: todayISO(), type: "kirim", category: "Xizmat to'lovi", currency: "SUM", amount: claim.ustaFeeCharged, amountSum: claim.ustaFeeCharged, amountUsd: 0, note: `Kafolat — usta haqi — ${claim.plate}` });
      }
      if (replacementCost > 0) {
        d.cashflow.unshift({
          id: uid(), date: todayISO(), type: "chiqim", category: "Kafolat xarajati",
          currency: "SUM", amount: replacementCost, amountSum: replacementCost, amountUsd: replacementCost / rate,
          note: `Kafolat almashtirish — ${claim.replacementName || ""} x${claim.qty} — ${claim.plate}`,
        });
      }
      return d;
    });
  }

  function saveManual(w) {
    patch((d) => { d.warranty = d.warranty || []; d.warranty.push({ id: uid(), isManual: true, ...w }); return d; });
  }

  const broken = data.brokenItems || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Kafolat</h2>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>{active} ta faol</p>
        </div>
        <Btn variant="ghost" onClick={() => setManualOpen(true)}><Plus size={14} /> Eski mijoz kafolati</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13, marginBottom: 20 }}>
        <Stat label="Faol kafolatlar" value={active + " ta"} color={T.teal} Icon={ShieldCheck} />
        <Stat label="Jami kafolatlangan" value={all.length + " ta"} color={T.blue} Icon={ShieldCheck} />
        <Stat label="Almashtirishlar" value={data.warrantyClaims.length + " ta"} color={T.red} Icon={AlertTriangle} />
      </div>

      <Card title="Kafolatlangan kartalar" pad={false}>
        <Tbl
          empty="Karta yo'q"
          cols={[
            { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
            { k: "plate", h: "Raqam", r: (r) => <span className="mo" style={{ fontWeight: 700, color: T.flame }}>{r.plate}</span> },
            { k: "carModel", h: "Mashina" },
            { k: "warrantyMonths", h: "Muddat", r: (r) => `${r.warrantyMonths} oy` },
            { k: "expiry", h: "Tugaydi", r: (r) => fmtDate(r.w?.expiryISO) },
            { k: "active", h: "Holat", r: (r) => <Badge color={r.w?.active ? T.teal : T.muted}>{r.w?.active ? "Faol" : "Tugagan"}</Badge> },
            { k: "manual", h: "", r: (r) => r.isManual ? <Badge color={T.gold}>Eski</Badge> : null },
            { k: "act", h: "", r: (r) => <Btn size="sm" variant="ghost" onClick={() => setClaimOpen(r)}>Almashtirish</Btn> },
          ]}
          rows={all}
        />
      </Card>

      {broken.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card title={`Yaroqsiz tovarlar (${broken.length})`} pad={false}>
            <Tbl
              empty=""
              cols={[
                { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
                { k: "name", h: "Mahsulot" },
                { k: "qty", h: "Miqdor" },
                { k: "fromPlate", h: "Manba" },
                { k: "status", h: "Holat", r: (r) => <Badge color={T.gold}>{r.status}</Badge> },
              ]}
              rows={broken}
            />
          </Card>
        </div>
      )}

      {claimOpen && <WarrantyClaimModal card={claimOpen} products={data.products} onClose={() => setClaimOpen(null)} onSave={(c) => { addClaim(c); setClaimOpen(null); }} />}
      {manualOpen && <ManualWarrantyModal onClose={() => setManualOpen(false)} onSave={(w) => { saveManual(w); setManualOpen(false); }} />}
    </div>
  );
}

function WarrantyClaimModal({ card, products, onClose, onSave }) {
  const [brokenProduct, setBrokenProduct] = useState("");
  const [replId, setReplId] = useState(products[0]?.id || "");
  const [qty, setQty] = useState(1);
  const [chargeUsta, setChargeUsta] = useState(false);
  const [ustaFee, setUstaFee] = useState(0);
  const [docConfirmed, setDocConfirmed] = useState(false);
  const repl = products.find((p) => p.id === replId);

  return (
    <Modal title={`Kafolat almashtirish — ${card.plate}`} onClose={onClose} wide>
      <F label="Brak mahsulot"><input style={iSt} value={brokenProduct} onChange={(e) => setBrokenProduct(e.target.value)} /></F>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <F label="O'rniga beriladigan"><Sel value={replId} onChange={(e) => setReplId(e.target.value)} options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.qty})` }))} /></F>
        <F label="Miqdor"><input type="number" style={iSt} value={qty} onChange={(e) => setQty(e.target.value)} /></F>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer", fontSize: 13 }}>
        <input type="checkbox" checked={docConfirmed} onChange={(e) => setDocConfirmed(e.target.checked)} style={{ accentColor: T.teal }} />
        Kafolat hujjati ko'rsatildi
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer", fontSize: 13 }}>
        <input type="checkbox" checked={chargeUsta} onChange={(e) => setChargeUsta(e.target.checked)} style={{ accentColor: T.flame }} />
        Usta xizmat haqi olinsin
      </label>
      {chargeUsta && <F label="Summa"><input type="number" style={iSt} value={ustaFee} onChange={(e) => setUstaFee(e.target.value)} /></F>}
      <SaveBtn disabled={!brokenProduct.trim()} onClick={() => onSave({ date: todayISO(), plate: card.plate, brokenProduct: brokenProduct.trim(), replacementProductId: replId, replacementName: repl?.name, qty: num(qty), ustaFeeCharged: chargeUsta ? num(ustaFee) : 0, docConfirmed })}>Saqlash</SaveBtn>
    </Modal>
  );
}

function ManualWarrantyModal({ onClose, onSave }) {
  const [f, setF] = useState({ plate: "", phone: "", carModel: "", date: "", warrantyMonths: 12, product: "" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal title="Eski mijoz kafolati" onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Davlat raqami"><input style={iSt} value={f.plate} onChange={set("plate")} /></F>
        <F label="Telefon"><input style={iSt} value={f.phone} onChange={set("phone")} /></F>
        <F label="Mashina"><input style={iSt} value={f.carModel} onChange={set("carModel")} /></F>
        <F label="O'rnatilgan sana"><input type="date" style={iSt} value={f.date} onChange={set("date")} /></F>
        <F label="Muddat (oy)"><input type="number" style={iSt} value={f.warrantyMonths} onChange={set("warrantyMonths")} /></F>
        <F label="Mahsulot" col="1/-1"><input style={iSt} value={f.product} onChange={set("product")} /></F>
      </div>
      <SaveBtn disabled={!f.plate.trim() || !f.date} onClick={() => onSave({ ...f, hasWarranty: true })}>Saqlash</SaveBtn>
    </Modal>
  );
}

/* ─── PARTNERS TAB ─── */
function PartnersTab({ data, patch, rate }) {
  const [addOpen, setAddOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(null);
  const [payOpen, setPayOpen] = useState(null);
  const [bonusRulesOpen, setBonusRulesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(null);

  const balances = partnerBalances(data);
  const totalDebt = balances.reduce((s, p) => s + Math.max(0, p.debtSum), 0);
  const bonusRules = data.bonusRules || [];

  function addPartner(p) { patch((d) => { d.partners.unshift({ id: uid(), ...p }); return d; }); }

  function giveProduct(partnerId, item) {
    patch((d) => {
      const product = d.products.find((p) => p.id === item.productId);
      if (product) product.qty = Math.max(0, num(product.qty) - item.qty);
      d.partnerTx.unshift({ id: uid(), partnerId, date: todayISO(), type: "mahsulot", ...item });

      // Sklad harakati — insider servisga qarzga berilgan mahsulot (chiqim)
      const partnerObj = d.partners.find((p) => p.id === partnerId);
      d.stockOuts = d.stockOuts || [];
      d.stockOuts.unshift({
        id: uid(), date: todayISO(), productId: item.productId, productName: item.name,
        qty: item.qty, amountSum: item.amountSum, reason: "Insider servisga qarzga berildi",
        partnerId, partnerName: partnerObj?.name || "Noma'lum",
      });

      // Bonus limit tekshiruvi — shu mahsulot bo'yicha jami olingan miqdor
      const rule = (d.bonusRules || []).find((r) => r.productId === item.productId);
      if (rule) {
        const totalTaken = d.partnerTx
          .filter((t) => t.partnerId === partnerId && t.type === "mahsulot" && t.productId === item.productId)
          .reduce((s, t) => s + num(t.qty), 0);
        const alreadyEarned = (d.bonusAwards || []).filter(
          (a) => a.partnerId === partnerId && a.ruleId === rule.id
        ).length;
        const earnedCount = Math.floor(totalTaken / rule.limitQty);
        if (earnedCount > alreadyEarned) {
          d.bonusAwards = d.bonusAwards || [];
          for (let i = alreadyEarned; i < earnedCount; i++) {
            d.bonusAwards.push({
              id: uid(), partnerId, ruleId: rule.id, date: todayISO(),
              productName: rule.productName, bonusText: rule.bonusText,
              claimed: false,
            });
          }
        }
      }
      return d;
    });
  }

  function receivePay(partnerId, payment) {
    patch((d) => {
      d.partnerTx.unshift({ id: uid(), partnerId, date: todayISO(), type: "tolov", amountSum: payment.amountSum, currency: payment.currency, paymentType: payment.paymentType });
      d.cashflow.unshift({
        id: uid(), date: todayISO(), type: "kirim", category: "Hamkordan to'lov",
        currency: payment.currency, amount: payment.amount, amountSum: payment.amountSum,
        amountUsd: payment.currency === "USD" ? payment.amount : payment.amountSum / rate,
        paymentType: payment.paymentType,
        note: `Insider servis to'lovi — ${payment.paymentType}`,
      });
      return d;
    });
  }

  function claimBonus(awardId) {
    patch((d) => {
      const a = (d.bonusAwards || []).find((x) => x.id === awardId);
      if (a) a.claimed = true;
      return d;
    });
  }

  const unclaimedBonuses = (data.bonusAwards || []).filter((a) => !a.claimed);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Hamkorlar</h2>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>Jami qarz: <span style={{ color: T.red, fontWeight: 600 }}>{fmtSum(totalDebt)}</span></p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="gold" onClick={() => setBonusRulesOpen(true)}>
            <Star size={14} /> Bonus qoidalari {bonusRules.length > 0 && `(${bonusRules.length})`}
          </Btn>
          <Btn onClick={() => setAddOpen(true)}><Plus size={15} /> Hamkor qo'shish</Btn>
        </div>
      </div>

      {unclaimedBonuses.length > 0 && (
        <div style={{
          background: T.goldD, border: `1px solid ${T.gold}40`, borderRadius: 10,
          padding: "13px 16px", marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Star size={15} color={T.gold} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>
              {unclaimedBonuses.length} ta hamkor bonus olishga haqli!
            </span>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {unclaimedBonuses.map((a) => {
              const partner = data.partners.find((p) => p.id === a.partnerId);
              return (
                <div key={a.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: T.s1, borderRadius: 7, padding: "9px 13px",
                }}>
                  <span style={{ fontSize: 12.5 }}>
                    <b>{partner?.name || "Noma'lum"}</b> — {a.productName} limitiga yetdi:
                    <span style={{ color: T.gold, fontWeight: 600 }}> {a.bonusText}</span>
                  </span>
                  <Btn size="sm" variant="gold" onClick={() => claimBonus(a.id)}>
                    <Check size={11} /> Berildi
                  </Btn>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Card title={`Hamkorlar (${balances.length})`} pad={false}>
        <Tbl
          empty="Hamkor yo'q"
          cols={[
            { k: "name", h: "Nomi", r: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
            { k: "phone", h: "Telefon" },
            { k: "given", h: "Olingan", r: (r) => fmtSum(r.given) },
            { k: "paid", h: "To'langan", r: (r) => <span style={{ color: T.teal }}>{fmtSum(r.paid)}</span> },
            { k: "debtSum", h: "Qarz", r: (r) => <span style={{ fontWeight: 700, color: r.debtSum > 0 ? T.red : T.teal }}>{fmtSum(r.debtSum)}</span> },
            { k: "act", h: "", r: (r) => (
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn size="sm" variant="ghost" onClick={() => setHistoryOpen(r)}>Tarix</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setGiveOpen(r)}>Berish</Btn>
                  <Btn size="sm" variant="teal" onClick={() => setPayOpen(r)}>To'lov</Btn>
                </div>
              ) },
          ]}
          rows={balances}
        />
      </Card>

      {bonusRules.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card title="Bonus limit qoidalari" pad={false}>
            <Tbl
              empty=""
              cols={[
                { k: "productName", h: "Mahsulot" },
                { k: "limitQty", h: "Limit", r: (r) => <span className="mo">{r.limitQty} dona</span> },
                { k: "bonusText", h: "Bonus", r: (r) => <span style={{ color: T.gold, fontWeight: 600 }}>{r.bonusText}</span> },
                { k: "del", h: "", r: (r) => (
                    <button onClick={() => patch((d) => { d.bonusRules = d.bonusRules.filter((x) => x.id !== r.id); return d; })}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}>
                      <Trash2 size={13} />
                    </button>
                  ) },
              ]}
              rows={bonusRules}
            />
          </Card>
        </div>
      )}

      {addOpen && <NewPartnerModal onClose={() => setAddOpen(false)} onSave={(p) => { addPartner(p); setAddOpen(false); }} />}
      {giveOpen && (
        <GiveProductModal
          partner={giveOpen} products={data.products} data={data}
          onClose={() => setGiveOpen(null)}
          onSave={(item) => { giveProduct(giveOpen.id, item); setGiveOpen(null); }}
        />
      )}
      {payOpen && (
        <Modal title={`${payOpen.name} — to'lov qabul qilish`} onClose={() => setPayOpen(null)}>
          <PaySupplierForm supplier={{ name: payOpen.name, debtSum: payOpen.debtSum }} rate={rate}
            onSave={(amountSum, meta) => { receivePay(payOpen.id, { ...meta, amountSum, amount: meta.amountOriginal }); setPayOpen(null); }} />
        </Modal>
      )}
      {bonusRulesOpen && (
        <BonusRulesModal data={data} onClose={() => setBonusRulesOpen(false)}
          onAdd={(rule) => patch((d) => { d.bonusRules = d.bonusRules || []; d.bonusRules.push({ id: uid(), ...rule }); return d; })}
        />
      )}
      {historyOpen && (
        <PartnerHistoryModal partner={historyOpen} data={data} onClose={() => setHistoryOpen(null)} />
      )}
    </div>
  );
}

function PartnerHistoryModal({ partner, data, onClose }) {
  const tx = data.partnerTx.filter((t) => t.partnerId === partner.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const given = tx.filter((t) => t.type === "mahsulot").reduce((s, t) => s + num(t.amountSum), 0);
  const paid = tx.filter((t) => t.type === "tolov").reduce((s, t) => s + num(t.amountSum), 0);

  return (
    <Modal title={`${partner.name} — to'liq tarix`} onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: T.s3, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>Jami olingan</div>
          <div className="mo" style={{ fontSize: 15, fontWeight: 700, color: T.muted2 }}>{fmtSum(given)}</div>
        </div>
        <div style={{ background: T.tealD, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>Jami to'langan</div>
          <div className="mo" style={{ fontSize: 15, fontWeight: 700, color: T.teal }}>{fmtSum(paid)}</div>
        </div>
        <div style={{ background: T.redD, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>Joriy qarz</div>
          <div className="mo" style={{ fontSize: 15, fontWeight: 700, color: T.red }}>{fmtSum(given - paid)}</div>
        </div>
      </div>
      <Tbl
        empty="Hali tranzaksiya yo'q"
        cols={[
          { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
          { k: "type", h: "Turi", r: (r) => <Badge color={r.type === "mahsulot" ? T.gold : T.teal}>{r.type === "mahsulot" ? "Mahsulot berildi" : "To'lov qabul"}</Badge> },
          { k: "name", h: "Nima", r: (r) => r.type === "mahsulot" ? `${r.name} × ${r.qty}` : (r.paymentType || "—") },
          { k: "amountSum", h: "Summa", r: (r) => <span className="mo" style={{ fontWeight: 700, color: r.type === "mahsulot" ? T.red : T.teal }}>{r.type === "mahsulot" ? "+" : "−"}{fmtSum(r.amountSum)}</span> },
        ]}
        rows={tx}
      />
    </Modal>
  );
}

function BonusRulesModal({ data, onClose, onAdd }) {
  const [productId, setProductId] = useState(data.products[0]?.id || "");
  const [limitQty, setLimitQty] = useState(60);
  const [bonusText, setBonusText] = useState("");
  const product = data.products.find((p) => p.id === productId);

  return (
    <Modal title="Bonus limit qoidasi qo'shish" onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
        Insider servis (hamkor) belgilangan mahsulotdan jami necha dona olganida bonus/sovg'a berilishini belgilang.
        Masalan: <b>60 dona moy</b> olganda → <b>"Kalit to'plami"</b> bonus.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Mahsulot" col="1/-1">
          <Sel value={productId} onChange={(e) => setProductId(e.target.value)}
            options={data.products.length ? data.products.map((p) => ({ value: p.id, label: p.name })) : [{ value: "", label: "Mahsulot yo'q" }]} />
        </F>
        <F label="Limit (necha dona)">
          <input type="number" style={iSt} value={limitQty} onChange={(e) => setLimitQty(e.target.value)} />
        </F>
        <F label="Bonus / sovg'a matni">
          <input style={iSt} value={bonusText} onChange={(e) => setBonusText(e.target.value)} placeholder="Masalan: Kalit to'plami" />
        </F>
      </div>
      <p style={{ fontSize: 11.5, color: T.muted, marginTop: 12 }}>
        Har {limitQty || "?"} donadan keyin (ya'ni {limitQty}, {num(limitQty) * 2}, {num(limitQty) * 3}...) tizim avtomatik bonusni ko'rsatadi.
      </p>
      <SaveBtn disabled={!product || !bonusText.trim() || !num(limitQty)} color={T.gold}
        onClick={() => { onAdd({ productId, productName: product.name, limitQty: num(limitQty), bonusText: bonusText.trim() }); onClose(); }}>
        <Star size={15} /> Qoidani saqlash
      </SaveBtn>
    </Modal>
  );
}

function NewPartnerModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <Modal title="Yangi hamkor" onClose={onClose}>
      <F label="Nomi"><input style={iSt} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></F>
      <div style={{ marginTop: 12 }}>
        <F label="Telefon"><input style={iSt} value={phone} onChange={(e) => setPhone(e.target.value)} /></F>
      </div>
      <SaveBtn disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), phone: phone.trim() })}>Saqlash</SaveBtn>
    </Modal>
  );
}

function GiveProductModal({ partner, products, data, onClose, onSave }) {
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [qty, setQty] = useState(1);
  const product = products.find((p) => p.id === productId);
  const total = num(product?.priceSum) * num(qty);

  // Shu mahsulot uchun bonus qoidasi bormi va progress qancha
  const rule = (data.bonusRules || []).find((r) => r.productId === productId);
  const alreadyTaken = rule
    ? data.partnerTx.filter((t) => t.partnerId === partner.id && t.type === "mahsulot" && t.productId === productId).reduce((s, t) => s + num(t.qty), 0)
    : 0;
  const afterTaken = alreadyTaken + num(qty);
  const progress = rule ? Math.min(100, ((afterTaken % rule.limitQty) / rule.limitQty) * 100) : 0;
  const willEarnBonus = rule && Math.floor(afterTaken / rule.limitQty) > Math.floor(alreadyTaken / rule.limitQty);

  return (
    <Modal title={`${partner.name} — mahsulot berish`} onClose={onClose}>
      <F label="Mahsulot">
        <SearchSelect value={productId} onChange={setProductId} placeholder="Mahsulot nomini yozing..."
          options={products.map((p) => ({ value: p.id, label: p.name, sub: String(p.qty) }))} />
      </F>
      <div style={{ marginTop: 12 }}>
        <F label="Miqdor"><input type="number" style={iSt} value={qty} onChange={(e) => setQty(e.target.value)} /></F>
      </div>

      {rule && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: T.goldD, border: `1px solid ${T.gold}30`, borderRadius: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 7 }}>
            <span style={{ color: T.muted2 }}>Bonus: <b style={{ color: T.gold }}>{rule.bonusText}</b> — har {rule.limitQty} donada</span>
            <span className="mo" style={{ color: T.gold, fontWeight: 700 }}>{afterTaken} / {Math.ceil(afterTaken / rule.limitQty) * rule.limitQty || rule.limitQty}</span>
          </div>
          <div style={{ height: 6, background: T.s3, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: T.gold, borderRadius: 3, transition: "width .3s" }} />
          </div>
          {willEarnBonus && (
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: T.gold, display: "flex", alignItems: "center", gap: 6 }}>
              <Star size={13} /> Bu yuk bilan limitga yetadi — bonus avtomatik qo'shiladi!
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, padding: "10px 14px", background: T.s3, borderRadius: 8 }}>
        <span style={{ fontSize: 12, color: T.muted }}>Qarzga qo'shiladi</span>
        <span className="mo" style={{ color: T.red, fontWeight: 700 }}>{fmtSum(total)}</span>
      </div>
      <SaveBtn disabled={!product} onClick={() => onSave({ productId, name: product.name, qty: num(qty), amountSum: total })}>Berish</SaveBtn>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   XODIMLAR TAB — erkin lavozim, moslashuvchan oylik
═══════════════════════════════════════════════════ */
function currentMonthKey() { return todayISO().slice(0, 7); }

function EmployeesTab({ data, patch, rate }) {
  const runLocked = useActionLock();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(null);
  const [payOpen, setPayOpen] = useState(null);
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());

  const employeesRaw = data.employees || [];
  const payments = data.employeePayments || [];

  const monthPayments = payments.filter((p) => p.month === monthFilter);
  const totalPaidThisMonth = monthPayments.reduce((s, p) => s + num(p.amountSum), 0);

  function paidThisMonthAmount(employeeId) {
    return monthPayments.filter((p) => p.employeeId === employeeId).reduce((s, p) => s + num(p.amountSum), 0);
  }

  const months = [...new Set([currentMonthKey(), ...payments.map((p) => p.month)])].sort().reverse();

  // "Analitika" bo'limidagi Azim KPI shu oyda qo'shilgan bo'lsa — KPI'ga "ulangan"
  // xodimning shu oygi oyligiga qo'shib ko'rsatamiz. Haqiqiy standardSalary o'zgarmaydi,
  // faqat shu oy uchun hisob-kitobda (to'lash/qolgan) hisobga olinadi.
  const azimEmployeeId = data.settings.azimEmployeeId;
  const monthKpiTotal = (data.settings.azimKpiHistory || [])
    .filter((h) => h.month === monthFilter)
    .reduce((s, h) => s + num(h.amount), 0);
  const employees = employeesRaw.map((e) =>
    e.id === azimEmployeeId && monthKpiTotal > 0
      ? { ...e, standardSalary: num(e.standardSalary) + monthKpiTotal, kpiBonus: monthKpiTotal }
      : e
  );

  // Azim Kassadan vaqti-vaqti bilan avans sifatida shaxsan pul olib turadi — bular "Ish haqi"
  // toifasida, izohida ismi ko'rsatilgan holda yoziladi ("Rahbarga chiqim" toifasi bunga
  // aloqasi yo'q — u boshqa maqsad uchun ishlatiladi). Bular rasmiy "Oylik to'lash" orqali
  // emas, shuning uchun KPI'ga ulangan xodim uchun bu yozuvlar ham "to'langan" deb
  // hisoblanishi kerak, aks holda ikki marta hisoblanib qolardi.
  // Bir martalik istisno: oylik 25-kuni yopilgani uchun 27-28 iyuldagi yozuvlar aslida
  // avgust davriga tegishli — shuning uchun avgust oynasi 27-iyuldan boshlanadi.
  //
  // MUHIM: iyul oynasi ham aynan shu kundan OLDIN tugashi shart. Aks holda 27-28 iyul
  // ikkala oynaga ham tushib, bir xil pul iyulda ham, avgustda ham "olingan" deb
  // ko'rsatiladi (bu yerda 1 500 000 so'm shunday ikki marta hisoblangan edi).
  const AUG_PERIOD_START = "2026-07-27";
  const prevDay = (iso) => {
    const t = new Date(iso + "T00:00:00Z");
    t.setUTCDate(t.getUTCDate() - 1);
    return t.toISOString().slice(0, 10);
  };
  const drawFrom = monthFilter === "2026-08" ? AUG_PERIOD_START : monthFilter + "-01";
  const drawTo =
    monthFilter === "2026-08" ? "2026-08-31"
    : monthFilter === AUG_PERIOD_START.slice(0, 7) ? prevDay(AUG_PERIOD_START)
    : monthFilter + "-31";
  const azimEmp = employeesRaw.find((e) => e.id === azimEmployeeId);
  const azimNameRaw = (azimEmp?.name || "").split(" ")[0].toLowerCase();
  const azimNameKeys = azimNameRaw ? [...new Set([azimNameRaw, translitCyrillic(azimNameRaw)])] : [];
  // "Oylik to'lash" tugmasi (payEmployee) bosilganda xuddi shu ismni o'z ichiga olgan
  // "Ish haqi" yozuvi avtomatik yaratiladi: "<ism> — <lavozim> oyligi (<oy>)". U
  // allaqachon d.employeePayments orqali paidThisMonthAmount()'da hisoblangan — shu
  // yerga ham tushib qolsa, bir xil to'lov ikki marta ayirilib ketardi.
  //
  // Yangi yozuvlarda buni employeePaymentId bog'lanishi aniq ajratadi. Undan oldin
  // yaratilgan (bog'lanishsiz) yozuvlar uchun matn naqshiga qaraymiz: aynan
  // "<ism> — <lavozim> oyligi (" bilan BOSHLANISHI shart. Shunchaki "oyligi (" so'zini
  // qidirish yaramaydi — haqiqiy avans yozuvi ham shu so'zni o'z ichiga olishi mumkin
  // ("Sales manager oyligi (2026-07)"), u holda haqiqiy avans noto'g'ri chiqib ketardi.
  const azimFormalPayNotePrefix = azimEmp ? `${azimEmp.name} — ${azimEmp.position} oyligi (`.toLowerCase() : null;
  const isFormalSalaryPayment = (c) =>
    c.employeePaymentId
      ? true
      : !!(azimFormalPayNotePrefix && (c.note || "").toLowerCase().startsWith(azimFormalPayNotePrefix));
  const azimDrawEntries = azimNameKeys.length
    ? (data.cashflow || [])
        .filter((c) => c.category === "Ish haqi" && c.date >= drawFrom && c.date <= drawTo
          && azimNameKeys.some((k) => (c.note || "").toLowerCase().includes(k))
          // "... kassa iyulgacha yopildi" — bu iyul oyini yopish (eski hisob) yozuvi,
          // yangi avgust avansi emas, shuning uchun bu yerga hisoblanmaydi.
          && !(c.note || "").toLowerCase().includes("йопилди")
          && !isFormalSalaryPayment(c))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const monthAzimDraws = azimDrawEntries.reduce((s, c) => s + num(c.amountSum), 0);

  function effectivePaidThisMonthAmount(employeeId) {
    const base = paidThisMonthAmount(employeeId);
    return employeeId === azimEmployeeId ? base + monthAzimDraws : base;
  }

  function addEmployee(emp) {
    patch((d) => { d.employees.push({ id: uid(), ...emp }); return d; });
  }

  function editEmployee(id, updates) {
    patch((d) => {
      const e = d.employees.find((x) => x.id === id);
      if (e) Object.assign(e, updates);
      return d;
    });
  }

  function payEmployee(employeeId, amountSum, month, note) {
    runLocked(() => patch((d) => {
      d.employeePayments = d.employeePayments || [];
      const paymentId = uid();
      d.employeePayments.push({ id: paymentId, employeeId, month, date: todayISO(), amountSum, note });
      d.cashflow.unshift({
        id: uid(), date: todayISO(), type: "chiqim", category: "Ish haqi",
        currency: "SUM", amount: amountSum, amountSum, amountUsd: amountSum / rate,
        // Bu yozuv rasmiy "Oylik to'lash" natijasi — u allaqachon employeePayments'da
        // hisoblangan. Avans qidiruvi (azimDrawEntries) uni matn bo'yicha emas, aynan
        // shu bog'lanish orqali ajratadi: xodim ismi yoki lavozimi keyin o'zgartirilsa
        // ham bog'lanish buzilmaydi.
        employeePaymentId: paymentId,
        note: `${d.employees.find((e) => e.id === employeeId)?.name || ""} — ${d.employees.find((e) => e.id === employeeId)?.position || ""} oyligi (${month})`,
      });
      return d;
    }));
  }

  function deleteEmployee(id) {
    patch((d) => { d.employees = d.employees.filter((e) => e.id !== id); return d; });
  }

  function isPaidThisMonth(employeeId) {
    return monthPayments.some((p) => p.employeeId === employeeId) || effectivePaidThisMonthAmount(employeeId) > 0;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Xodimlar</h2>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>Erkin lavozim va moslashuvchan oylik</p>
        </div>
        <Btn onClick={() => setAddOpen(true)}><Plus size={15} /> Xodim qo'shish</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13, marginBottom: 20 }}>
        <Stat label="Jami xodimlar" value={employees.length + " ta"} color={T.blue} Icon={Users} />
        <Stat label={`To'langan (${monthFilter})`} value={fmtSum(totalPaidThisMonth)} color={T.teal} Icon={Check} />
        <Stat label="Bu oy to'lanmagan" value={employees.filter((e) => !isPaidThisMonth(e.id)).length + " ta"} color={T.gold} Icon={Clock} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Oy:</span>
        <Sel value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
          style={{ width: 150 }}
          options={months.map((m) => ({ value: m, label: m }))} />
      </div>

      <Card title={`Xodimlar ro'yxati (${employees.length})`} pad={false}>
        <Tbl
          empty="Hali xodim qo'shilmagan"
          cols={[
            { k: "name", h: "Ismi", r: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
            { k: "position", h: "Lavozim", r: (r) => <Badge color={T.purple}>{r.position}</Badge> },
            { k: "phone", h: "Telefon", r: (r) => <span className="mo" style={{ fontSize: 12 }}>{r.phone || "—"}</span> },
            { k: "standardSalary", h: "Standart oylik", r: (r) => (
                <span className="mo" style={{ color: T.muted2 }}>
                  {fmtSum(r.standardSalary)}
                  {r.kpiBonus > 0 && (
                    <span style={{ display: "block", fontSize: 10, color: T.gold, marginTop: 2 }}>
                      + KPI {fmtSum(r.kpiBonus)}
                    </span>
                  )}
                </span>
              ) },
            { k: "paidAmt", h: `To'langan (${monthFilter})`, r: (r) => <span className="mo" style={{ color: T.teal, fontWeight: 600 }}>{fmtSum(effectivePaidThisMonthAmount(r.id))}</span> },
            { k: "remaining", h: "Qolgan", r: (r) => {
                const rem = Math.max(0, num(r.standardSalary) - effectivePaidThisMonthAmount(r.id));
                return <span className="mo" style={{ fontWeight: 700, color: rem > 0 ? T.gold : T.teal }}>{fmtSum(rem)}</span>;
              } },
            {
              k: "status", h: `Holat`,
              r: (r) => {
                const paid = effectivePaidThisMonthAmount(r.id);
                if (paid <= 0) return <Badge color={T.red}>Kutilmoqda</Badge>;
                if (paid < num(r.standardSalary) - 0.5) return <Badge color={T.gold}>Qisman to'langan</Badge>;
                return <Badge color={T.teal}>✓ To'langan</Badge>;
              },
            },
            {
              k: "act", h: "",
              r: (r) => (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Btn size="sm" variant="teal" onClick={() => setPayOpen(r)}>Oylik to'lash</Btn>
                  <button
                    title={r.id === azimEmployeeId ? "Azim KPI'ga ulangan — bosib uzish" : "Analitikadagi Azim KPI shu xodimga qo'shilsin"}
                    onClick={() => patch((d) => {
                      d.settings.azimEmployeeId = d.settings.azimEmployeeId === r.id ? null : r.id;
                      return d;
                    })}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: r.id === azimEmployeeId ? T.gold : T.muted,
                    }}>
                    <Star size={13} fill={r.id === azimEmployeeId ? T.gold : "none"} />
                  </button>
                  <button onClick={() => setEditOpen(r)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={async () => {
                    const hasHistory = payments.some((p) => p.employeeId === r.id);
                    const msg = hasHistory
                      ? `${r.name} o'chirilsinmi?\nBu xodimning o'tgan to'lovlar tarixidagi ismi "Noma'lum" bo'lib qoladi.`
                      : `${r.name} o'chirilsinmi?`;
                    if (await askConfirm(msg)) deleteEmployee(r.id);
                  }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ),
            },
          ]}
          rows={employees}
        />
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title={`To'lovlar tarixi — ${monthFilter}`} pad={false}>
          <Tbl
            empty="Bu oyda to'lov yo'q"
            cols={[
              { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
              { k: "employeeId", h: "Xodim", r: (r) => {
                  const e = employees.find((x) => x.id === r.employeeId);
                  return e ? `${e.name} (${e.position})` : "Noma'lum";
                } },
              { k: "amountSum", h: "Summa", r: (r) => <span style={{ color: T.teal, fontWeight: 700 }}>{fmtSum(r.amountSum)}</span> },
              { k: "note", h: "Izoh", r: (r) => <span style={{ color: T.muted, fontSize: 12 }}>{r.note || "—"}</span> },
            ]}
            rows={monthPayments}
          />
        </Card>
      </div>

      {azimEmployeeId && (
        <div style={{ marginTop: 16 }}>
          <Card title={`Avans tarixi — ${monthFilter} (${fmtSum(monthAzimDraws)})`} pad={false}>
            <Tbl
              empty="Bu oyda avans yozuvi topilmadi"
              cols={[
                { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
                { k: "amountSum", h: "Summa", r: (r) => <span style={{ color: T.gold, fontWeight: 700 }}>{fmtSum(r.amountSum)}</span> },
                { k: "paymentType", h: "Turi", r: (r) => r.paymentType || "—" },
                { k: "note", h: "Izoh", r: (r) => <span style={{ color: T.muted, fontSize: 12 }}>{r.note || "—"}</span> },
              ]}
              rows={azimDrawEntries}
            />
          </Card>
        </div>
      )}

      {addOpen && <AddEmployeeModal onClose={() => setAddOpen(false)} onSave={(emp) => { addEmployee(emp); setAddOpen(false); }} />}
      {editOpen && (
        <AddEmployeeModal
          employee={editOpen} onClose={() => setEditOpen(null)}
          onSave={(emp) => { editEmployee(editOpen.id, emp); setEditOpen(null); }}
        />
      )}
      {payOpen && (
        <PayEmployeeModal
          employee={payOpen} month={monthFilter} alreadyPaid={effectivePaidThisMonthAmount(payOpen.id)}
          onClose={() => setPayOpen(null)}
          onSave={(amountSum, note) => { payEmployee(payOpen.id, amountSum, monthFilter, note); setPayOpen(null); }}
        />
      )}
    </div>
  );
}

function AddEmployeeModal({ employee, onClose, onSave }) {
  const [name, setName] = useState(employee?.name || "");
  const [position, setPosition] = useState(employee?.position || "");
  const [phone, setPhone] = useState(employee?.phone || "");
  const [standardSalary, setStandardSalary] = useState(employee ? String(employee.standardSalary || "") : "");

  return (
    <Modal title={employee ? `Xodimni tahrirlash — ${employee.name}` : "Yangi xodim qo'shish"} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <F label="Ismi *"><input style={iSt} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></F>
        <F label="Lavozim *">
          <input style={iSt} value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Masalan: Oshpaz, SMM, Tozalash xodimi..." />
        </F>
        <F label="Telefon"><input style={iSt} value={phone} onChange={(e) => setPhone(e.target.value)} /></F>
        <F label="Standart oylik (so'm)">
          <input type="number" style={iSt} value={standardSalary} onChange={(e) => setStandardSalary(e.target.value)} placeholder="Kelishilgan summa" />
        </F>
      </div>
      <p style={{ fontSize: 11.5, color: T.muted, marginTop: 10 }}>
        Bu — standart oylik. Har oy to'lov paytida bu summani xohlagancha o'zgartirish mumkin.
      </p>
      <SaveBtn disabled={!name.trim() || !position.trim()} onClick={() => onSave({ name: name.trim(), position: position.trim(), phone: phone.trim(), standardSalary: num(standardSalary) })}>
        Saqlash
      </SaveBtn>
    </Modal>
  );
}

function PayEmployeeModal({ employee, month, alreadyPaid = 0, onClose, onSave }) {
  const remaining = Math.max(0, num(employee.standardSalary || 0) - alreadyPaid);
  const [amount, setAmount] = useState(String(Math.round(remaining || employee.standardSalary || 0)));
  const [note, setNote] = useState("");
  const amtNum = num(amount);
  const diff = (alreadyPaid + amtNum) - num(employee.standardSalary || 0);

  return (
    <Modal title={`Oylik to'lash — ${employee.name}`} onClose={onClose}>
      <div style={{ marginBottom: 14, padding: "10px 14px", background: T.s3, borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: T.muted }}>Lavozim</span>
          <Badge color={T.purple}>{employee.position}</Badge>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
          <span style={{ color: T.muted }}>Standart oylik</span>
          <span className="mo">{fmtSum(employee.standardSalary)}</span>
        </div>
        {alreadyPaid > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
            <span style={{ color: T.muted }}>Shu oyda avval to'langan</span>
            <span className="mo" style={{ color: T.teal }}>{fmtSum(alreadyPaid)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
          <span style={{ color: T.muted }}>Qolgan (standartdan)</span>
          <span className="mo" style={{ color: remaining > 0 ? T.gold : T.teal, fontWeight: 700 }}>{fmtSum(remaining)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
          <span style={{ color: T.muted }}>Oy</span>
          <span className="mo">{month}</span>
        </div>
      </div>

      <F label="To'lov summasi (so'm) — o'zgartirish mumkin">
        <input type="number" style={iSt} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
      </F>

      {diff !== 0 && (
        <p style={{ fontSize: 11.5, color: diff > 0 ? T.teal : T.gold, marginTop: 8 }}>
          {diff > 0 ? `+${fmtSum(diff)} standartdan ko'p (bonus)` : `${fmtSum(Math.abs(diff))} hali standartdan kam`}
        </p>
      )}

      <div style={{ marginTop: 12 }}>
        <F label="Izoh (ixtiyoriy)">
          <input style={iSt} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: bonus qo'shildi, kechikish uchun kamaytirildi..." />
        </F>
      </div>

      <SaveBtn disabled={!amtNum || amtNum <= 0} color={T.teal} onClick={() => onSave(amtNum, note.trim())}>
        <Check size={15} /> Oylikni to'lash
      </SaveBtn>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   QARZ DAFTARI — sodda, birlashtirilgan qarz kitobi
   Bizga qarz (Nasiya + Shaxsiy) va Bizning qarzimiz (Ta'minotchi)
═══════════════════════════════════════════════════ */
function DebtBookTab({ data, patch, rate, readOnly = false }) {
  const runLocked = useActionLock();
  const [tab, setTab] = useState("bizga"); // bizga | bizdan
  const [addOldOpen, setAddOldOpen] = useState(false);
  const [payItem, setPayItem] = useState(null); // { kind, id, name, remaining, note }
  const [historyItem, setHistoryItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [manageSupplier, setManageSupplier] = useState(null);

  // ── BIZGA QARZ (bizga qaytarishi kerak bo'lganlar) ──
  const nasiyaRows = (data.nasiyaDebts || []).filter((n) => !n.paid).map((n) => ({
    kind: "nasiya", id: n.id, name: n.plate, sub: `${n.carModel || ""} · ${n.serviceType || ""}`,
    date: n.date, time: n.time || "", total: num(n.amountSum), paid: num(n.paidAmount || 0),
    src: n,
  }));
  const personalRows = (data.personalDebts || []).filter((p) => !p.paid).map((p) => ({
    kind: "personal", id: p.id, name: p.name, sub: p.note || "Shaxsiy qarz",
    date: p.date, time: p.time || "", total: num(p.amountSum), paid: num(p.paidAmount || 0),
    historyCount: (p.history || []).length, src: p,
  }));
  const oldDebtRows = (data.oldDebtors || []).filter((o) => !o.paid).map((o) => ({
    kind: "old", id: o.id, name: o.name, sub: o.note || "Eski qarzdor",
    date: o.date, time: o.time || "", total: num(o.amountSum), paid: num(o.paidAmount || 0),
    historyCount: (o.history || []).length, src: o,
  }));
  const wholesaleRows = (data.wholesaleDebts || []).filter((w) => !w.paid).map((w) => ({
    kind: "wholesale", id: w.id, name: w.customer, sub: `Ulgurji — ${w.items || ""}`,
    date: w.date, time: w.time || "", total: num(w.amountSum), paid: num(w.paidAmount || 0),
    src: w,
  }));
  const bizgaRows = [...nasiyaRows, ...personalRows, ...oldDebtRows, ...wholesaleRows]
    .map((r) => ({ ...r, remaining: r.total - r.paid }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const bizgaTotal = bizgaRows.reduce((s, r) => s + r.remaining, 0);

  // ── BIZNING QARZIMIZ (ta'minotchilarga — stockIns + eski qarzlar birlashtirilgan) ──
  const supDebts = supplierDebts(data);
  const bizdanRows = supDebts.map((s) => ({
    kind: "supplier", id: s.name, name: s.name, sub: "Ta'minotchi",
    date: "", time: "", total: s.totalSum, paid: s.paidSum, remaining: s.debtSum,
  })).filter((r) => r.remaining > 0.5);
  const bizdanTotal = bizdanRows.reduce((s, r) => s + r.remaining, 0);

  function addOldDebtor(item) {
    patch((d) => {
      d.oldDebtors = d.oldDebtors || [];
      const existing = d.oldDebtors.find((o) => o.name.trim().toLowerCase() === item.name.trim().toLowerCase() && !o.paid);
      const historyItem = { date: item.date, time: nowTime(), amount: item.amountSum, note: item.note };
      if (existing) {
        existing.amountSum = num(existing.amountSum) + item.amountSum;
        existing.history = [...(existing.history || []), historyItem];
      } else {
        d.oldDebtors.push({
          id: uid(), date: item.date, time: nowTime(), name: item.name, note: item.note,
          amountSum: item.amountSum, paidAmount: 0, paid: false, history: [historyItem],
        });
      }
      return d;
    });
  }

  function updateOldDebtor(id, name, amountSum) {
    patch((d) => {
      const rec = (d.oldDebtors || []).find((o) => o.id === id);
      if (rec) { rec.name = name; rec.amountSum = amountSum; }
      return d;
    });
  }

  function addOldSupplierDebt(item) {
    patch((d) => {
      d.oldSupplierDebts = d.oldSupplierDebts || [];
      const existing = d.oldSupplierDebts.find((o) => o.name.trim().toLowerCase() === item.name.trim().toLowerCase() && !o.paid);
      const historyItem = { date: item.date, time: nowTime(), amount: item.amountSum, note: item.note };
      if (existing) {
        existing.amountSum = num(existing.amountSum) + item.amountSum;
        existing.history = [...(existing.history || []), historyItem];
      } else {
        d.oldSupplierDebts.push({
          id: uid(), date: item.date, time: nowTime(), name: item.name, note: item.note,
          amountSum: item.amountSum, paidAmount: 0, paid: false, history: [historyItem],
        });
      }
      return d;
    });
  }

  function updateOldSupplierDebtEntry(id, name, amountSum) {
    patch((d) => {
      const rec = (d.oldSupplierDebts || []).find((o) => o.id === id);
      if (rec) { rec.name = name; rec.amountSum = amountSum; }
      return d;
    });
  }

  function deleteOldSupplierDebtEntry(id) {
    patch((d) => { d.oldSupplierDebts = (d.oldSupplierDebts || []).filter((o) => o.id !== id); return d; });
  }

  function makePayment(item, amountSum) {
    // Har bir to'lovni qarz yozuvining o'ziga ham qo'shamiz — aniq tarix uchun
    const recordPayment = (rec) => {
      if (!rec) return;
      rec.payments = rec.payments || [];
      rec.payments.push({ id: uid(), date: todayISO(), time: nowTime(), amount: amountSum });
    };

    runLocked(() => patch((d) => {
      if (item.kind === "nasiya") {
        const n = (d.nasiyaDebts || []).find((x) => x.id === item.id);
        if (n) {
          n.paidAmount = num(n.paidAmount) + amountSum;
          if (n.paidAmount >= num(n.amountSum) - 0.5) n.paid = true;
          recordPayment(n);
        }
        d.cashflow.unshift({ id: uid(), date: todayISO(), type: "kirim", category: "Xizmat to'lovi", currency: "SUM", amount: amountSum, amountSum, amountUsd: amountSum / rate, paymentType: "Naqd pul", note: `Nasiya to'lovi — ${item.name}` });
      } else if (item.kind === "personal") {
        const p = (d.personalDebts || []).find((x) => x.id === item.id);
        if (p) {
          p.paidAmount = num(p.paidAmount) + amountSum;
          if (p.paidAmount >= num(p.amountSum) - 0.5) p.paid = true;
          recordPayment(p);
        }
        d.cashflow.unshift({ id: uid(), date: todayISO(), type: "kirim", category: "Shaxsiy qarz qaytdi", currency: "SUM", amount: amountSum, amountSum, amountUsd: amountSum / rate, note: `${item.name} — qarz qaytdi` });
      } else if (item.kind === "old") {
        const o = (d.oldDebtors || []).find((x) => x.id === item.id);
        if (o) {
          o.paidAmount = num(o.paidAmount) + amountSum;
          if (o.paidAmount >= num(o.amountSum) - 0.5) o.paid = true;
          recordPayment(o);
        }
        d.cashflow.unshift({ id: uid(), date: todayISO(), type: "kirim", category: "Boshqa kirim", currency: "SUM", amount: amountSum, amountSum, amountUsd: amountSum / rate, note: `${item.name} — eski qarz qaytdi` });
      } else if (item.kind === "wholesale") {
        const w = (d.wholesaleDebts || []).find((x) => x.id === item.id);
        if (w) {
          w.paidAmount = num(w.paidAmount) + amountSum;
          if (w.paidAmount >= num(w.amountSum) - 0.5) w.paid = true;
          recordPayment(w);
        }
        d.cashflow.unshift({ id: uid(), date: todayISO(), type: "kirim", category: "Ulgurji savdo", currency: "SUM", amount: amountSum, amountSum, amountUsd: amountSum / rate, note: `Ulgurji qarz to'lovi — ${item.name}` });
      } else if (item.kind === "supplier") {
        let remaining = amountSum;
        const open = d.stockIns.filter((s) => sameName(s.supplier, item.name) && num(s.totalSum) - num(s.paidSum) > 0.5).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        for (const s of open) {
          if (remaining <= 0) break;
          const debt = num(s.totalSum) - num(s.paidSum);
          const pay = Math.min(debt, remaining);
          s.paidSum = num(s.paidSum) + pay;
          remaining -= pay;
        }
        // stockIns to'liq to'langandan keyin qolgan summa — eski (qo'lda kiritilgan) qarzlarga qo'llaniladi
        if (remaining > 0.5) {
          const openOld = (d.oldSupplierDebts || [])
            .filter((o) => sameName(o.name, item.name) && !o.paid && num(o.amountSum) - num(o.paidAmount || 0) > 0.5)
            .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
          for (const o of openOld) {
            if (remaining <= 0) break;
            const debt = num(o.amountSum) - num(o.paidAmount || 0);
            const pay = Math.min(debt, remaining);
            o.paidAmount = num(o.paidAmount || 0) + pay;
            if (o.paidAmount >= num(o.amountSum) - 0.5) o.paid = true;
            remaining -= pay;
          }
        }
        d.cashflow.unshift({ id: uid(), date: todayISO(), type: "chiqim", category: "Ta'minotchiga to'lov", currency: "SUM", amount: amountSum, amountSum, amountUsd: amountSum / rate, supplier: item.name, note: `Qarz to'lovi — ${item.name}` });
      }
      return d;
    }));
  }

  const rows = tab === "bizga" ? bizgaRows : bizdanRows;
  const total = tab === "bizga" ? bizgaTotal : bizdanTotal;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Qarz daftari</h2>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>Barcha qarzlar — bitta joyda</p>
        </div>
        {!readOnly && (
          <Btn onClick={() => setAddOldOpen(true)}>
            <Plus size={15} /> {tab === "bizga" ? "Eski qarzdor qo'shish" : "Eski qarz qo'shish (ta'minotchi)"}
          </Btn>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 18 }}>
        <div onClick={() => setTab("bizga")} style={{
          cursor: "pointer", background: T.s1, border: `1px solid ${tab === "bizga" ? T.teal : T.border}`,
          borderRadius: 12, padding: "16px 18px", borderTop: `2px solid ${T.teal}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
            Bizga qarz (bizga qaytarishi kerak)
          </div>
          <div className="mo bc" style={{ fontSize: 22, fontWeight: 700, color: T.teal }}>{fmtSum(bizgaTotal)}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{bizgaRows.length} ta qarzdor</div>
        </div>
        <div onClick={() => setTab("bizdan")} style={{
          cursor: "pointer", background: T.s1, border: `1px solid ${tab === "bizdan" ? T.red : T.border}`,
          borderRadius: 12, padding: "16px 18px", borderTop: `2px solid ${T.red}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
            Bizning qarzimiz (biz to'lashimiz kerak)
          </div>
          <div className="mo bc" style={{ fontSize: 22, fontWeight: 700, color: T.red }}>{fmtSum(bizdanTotal)}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{bizdanRows.length} ta qarz</div>
        </div>
      </div>

      <Card title={tab === "bizga" ? `Bizga qarz (${rows.length})` : `Bizning qarzimiz (${rows.length})`} pad={false}>
        <Tbl
          empty="Qarz yo'q"
          cols={[
            { k: "date", h: "Sana / Vaqt", r: (r) => r.date ? (
                <span style={{ fontSize: 12 }}>
                  {fmtDate(r.date)}{r.time && <span style={{ color: T.muted }}> · {r.time}</span>}
                </span>
              ) : <span style={{ color: T.muted }}>—</span> },
            { k: "name", h: "Ism / Mashina", r: (r) => (
                <span style={{ fontWeight: 700 }}>
                  {r.name}
                  {r.historyCount > 1 && (
                    <span style={{ marginLeft: 6, fontSize: 10.5, color: T.gold, fontWeight: 600 }}>
                      ({r.historyCount} marta qo'shilgan)
                    </span>
                  )}
                </span>
              ) },
            { k: "sub", h: "Izoh", r: (r) => <span style={{ color: T.muted, fontSize: 12 }}>{r.sub}</span> },
            { k: "total", h: "Jami", r: (r) => <span className="mo" style={{ color: T.muted2 }}>{fmtSum(r.total)}</span> },
            { k: "paid", h: "To'langan", r: (r) => <span className="mo" style={{ color: T.teal }}>{fmtSum(r.paid)}</span> },
            { k: "remaining", h: "Qolgan", r: (r) => <span className="mo" style={{ fontWeight: 700, color: tab === "bizga" ? T.teal : T.red }}>{fmtSum(r.remaining)}</span> },
            { k: "act", h: "", r: (r) => (
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <Btn size="sm" variant="ghost" onClick={() => setHistoryItem(r)}>
                    <Clock size={11} /> Tarix
                  </Btn>
                  {!readOnly && r.kind === "old" && (
                    <Btn size="sm" variant="gold" onClick={() => setEditItem(r)}>
                      <Pencil size={11} />
                    </Btn>
                  )}
                  {!readOnly && r.kind === "supplier" && (
                    <Btn size="sm" variant="gold" onClick={() => setManageSupplier(r)}>
                      <Pencil size={11} /> Eski qarzni tuzatish
                    </Btn>
                  )}
                  {!readOnly && (
                    <Btn size="sm" variant={tab === "bizga" ? "teal" : "red"} onClick={() => setPayItem(r)}>To'lov</Btn>
                  )}
                </div>
              ) },
          ]}
          rows={rows}
        />
      </Card>

      {addOldOpen && (
        <AddOldDebtorModal
          title={tab === "bizga" ? "Eski qarzdor qo'shish" : "Eski qarz qo'shish (biz to'lashimiz kerak)"}
          rate={rate}
          existingNames={tab === "bizga"
            ? [...new Set([...(data.oldDebtors || []).map((o) => o.name), ...(data.personalDebts || []).map((p) => p.name)])]
            : [...new Set([...(data.oldSupplierDebts || []).map((o) => o.name), ...supplierDebts(data).map((s) => s.name)])]}
          onClose={() => setAddOldOpen(false)}
          onSave={(item) => {
            if (tab === "bizga") addOldDebtor(item); else addOldSupplierDebt(item);
            setAddOldOpen(false);
          }} />
      )}
      {payItem && (
        <SimpleDebtPayModal item={payItem} rate={rate} onClose={() => setPayItem(null)}
          onSave={(amt) => { makePayment(payItem, amt); setPayItem(null); }} />
      )}
      {historyItem && (
        historyItem.kind === "supplier"
          ? <SupplierHistoryModal supplier={historyItem} data={data} patch={patch} onClose={() => setHistoryItem(null)} />
          : <DebtorHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />
      )}
      {editItem && (
        <EditOldDebtorModal item={editItem} onClose={() => setEditItem(null)}
          onSave={(name, amountSum) => { updateOldDebtor(editItem.id, name, amountSum); setEditItem(null); }} />
      )}
      {manageSupplier && (
        <ManageSupplierOldDebtsModal supplierName={manageSupplier.name} data={data} onClose={() => setManageSupplier(null)}
          onUpdate={updateOldSupplierDebtEntry} onDelete={deleteOldSupplierDebtEntry} />
      )}
    </div>
  );
}

/* Qarzdor tarixi — "Karta tafsiloti" uslubida, qoldiq harakati bilan */
function DebtorHistoryModal({ item, onClose }) {
  const src = item.src || {};
  const KIND_LABELS = {
    nasiya: "Nasiya (xizmat)", personal: "Shaxsiy qarz",
    old: "Eski qarzdor", wholesale: "Ulgurji savdo",
  };
  const KIND_COLORS = { nasiya: T.gold, personal: T.blue, old: T.purple, wholesale: T.teal };

  // 1) Qarz oshishi — qo'shilgan summalar
  const additions = (src.history || []).length > 0
    ? src.history.map((h) => ({
        date: h.date, time: h.time || "", kind: "qarz",
        label: h.note || "Qarz qo'shildi", change: +num(h.amount),
      }))
    : [{ // history yo'q bo'lsa — asosiy summani bitta yozuv sifatida ko'rsatamiz
        date: src.date || item.date, time: src.time || item.time || "", kind: "qarz",
        label: item.sub || "Qarz olindi", change: +num(item.total),
      }];

  // 2) Qarz kamayishi — to'lovlar
  const payments = (src.payments || []).map((p) => ({
    date: p.date, time: p.time || "", kind: "tolov",
    label: "To'lov qabul qilindi", change: -num(p.amount),
  }));

  // Eski yozuvlar uchun (payments massivi yo'q, lekin paidAmount bor)
  const recordedPaid = payments.reduce((s, p) => s + Math.abs(p.change), 0);
  const untracked = num(item.paid) - recordedPaid;
  if (untracked > 0.5) {
    payments.unshift({
      date: src.date || item.date, time: "", kind: "tolov",
      label: "Avvalgi to'lov (tafsilotsiz)", change: -untracked,
    });
  }

  const all = [...additions, ...payments]
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

  let running = 0;
  const rows = all.map((r) => { running += r.change; return { ...r, balance: running }; }).reverse();

  return (
    <Modal title={`${item.name} — qarz harakati tarixi`} onClose={onClose} xwide>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16, flexWrap: "wrap" }}>
        <Badge color={KIND_COLORS[item.kind] || T.blue}>{KIND_LABELS[item.kind] || item.kind}</Badge>
        <span style={{ fontSize: 12, color: T.muted }}>{item.sub}</span>
        {item.date && <span style={{ fontSize: 12, color: T.muted }}>· Boshlangan: {fmtDate(item.date)}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11, marginBottom: 18 }}>
        <div style={{ background: T.s3, borderRadius: 9, padding: "12px 15px" }}>
          <div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 6 }}>Jami qarz</div>
          <div className="mo" style={{ fontSize: 16, fontWeight: 700, color: T.muted2 }}>{fmtSum(item.total)}</div>
        </div>
        <div style={{ background: T.tealD, borderRadius: 9, padding: "12px 15px" }}>
          <div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 6 }}>To'langan</div>
          <div className="mo" style={{ fontSize: 16, fontWeight: 700, color: T.teal }}>{fmtSum(item.paid)}</div>
        </div>
        <div style={{ background: T.redD, borderRadius: 9, padding: "12px 15px" }}>
          <div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 6 }}>Qolgan</div>
          <div className="mo" style={{ fontSize: 16, fontWeight: 700, color: T.red }}>{fmtSum(item.remaining)}</div>
        </div>
      </div>

      <Tbl
        empty="Harakat yo'q"
        pageSize={40}
        maxH={0}
        cols={[
          { k: "date", h: "Sana", r: (r) => (
              <span style={{ fontSize: 12 }}>{fmtDate(r.date)}{r.time && <span style={{ color: T.muted }}> · {r.time}</span>}</span>
            ) },
          { k: "kind", h: "Amal", r: (r) => (
              r.kind === "tolov"
                ? <Badge color={T.teal}>To'lov</Badge>
                : <Badge color={T.red}>Qarz qo'shildi</Badge>
            ) },
          { k: "label", h: "Tafsilot", r: (r) => <span style={{ color: T.muted2, fontSize: 12 }}>{r.label}</span> },
          { k: "change", h: "O'zgarish", r: (r) => (
              <span className="mo" style={{ fontWeight: 700, color: r.change > 0 ? T.red : T.teal }}>
                {r.change > 0 ? "+" : "−"}{fmtSum(Math.abs(r.change))}
              </span>
            ) },
          { k: "balance", h: "Qoldiq qarz", r: (r) => (
              <span className="mo" style={{ fontWeight: 700, color: r.balance > 0.5 ? T.red : T.teal }}>{fmtSum(r.balance)}</span>
            ) },
        ]}
        rows={rows}
      />

      <p style={{ fontSize: 11, color: T.muted, marginTop: 14, textAlign: "center" }}>
        "Qoldiq qarz" — har bir amaldan keyingi holat. Eng yangi yozuv yuqorida.
      </p>
    </Modal>
  );
}

/* Ta'minotchining qo'lda kiritilgan "eski qarz" yozuvlarini boshqarish — har birini alohida
   tahrirlash yoki o'chirish (xato/takroriy kiritilganlarni tuzatish uchun). */
function ManageSupplierOldDebtsModal({ supplierName, data, onClose, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const entries = (data.oldSupplierDebts || [])
    .filter((o) => sameName(o.name, supplierName))
    .sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));

  function startEdit(e) {
    setEditingId(e.id); setName(e.name); setAmount(String(Math.round(num(e.amountSum))));
  }

  return (
    <Modal title={`${supplierName} — eski qarz yozuvlarini boshqarish`} onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
        Qo'lda kiritilgan har bir eski qarz yozuvi shu yerda. Xato yoki takroriy kiritilganlarni
        tahrirlang yoki o'chiring.
      </p>
      {entries.length === 0 ? (
        <p style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: "20px 0" }}>
          Qo'lda kiritilgan eski qarz yozuvi yo'q — bu ta'minotchining qarzi to'liq sklad kirimlaridan hosil bo'lgan.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ background: T.s3, borderRadius: 9, padding: "12px 14px" }}>
              {editingId === e.id ? (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <F label="Ism"><input style={iSt} value={name} onChange={(ev) => setName(ev.target.value)} autoFocus /></F>
                    <F label="Summa (so'm)"><input type="number" style={iSt} value={amount} onChange={(ev) => setAmount(ev.target.value)} /></F>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn size="sm" color={T.teal} onClick={() => {
                      if (!name.trim() || !num(amount)) return;
                      onUpdate(e.id, name.trim(), num(amount));
                      setEditingId(null);
                    }}><Check size={12} /> Saqlash</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setEditingId(null)}>Bekor</Btn>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e.note || "Eski qarz (qo'lda kiritilgan)"}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                      {fmtDate(e.date)}{e.time && ` · ${e.time}`}
                      {num(e.paidAmount) > 0 && <> · to'langan: <b className="mo" style={{ color: T.teal }}>{fmtSum(e.paidAmount)}</b></>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="mo" style={{ fontWeight: 700, color: T.red }}>{fmtSum(e.amountSum)}</span>
                    <Btn size="sm" variant="gold" onClick={() => startEdit(e)}><Pencil size={11} /></Btn>
                    <button onClick={async () => {
                      if (!(await askConfirm(`Bu yozuv o'chirilsinmi?\n\n"${e.note || "Eski qarz"}" — ${fmtSum(e.amountSum)}\n\nAgar xato/takroriy kiritilgan bo'lsa, o'chiring.`))) return;
                      onDelete(e.id);
                    }} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function EditOldDebtorModal({ item, onClose, onSave }) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(Math.round(item.total)));

  return (
    <Modal title={`Tahrirlash — ${item.name}`} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <F label="Ism / Tashkilot *">
          <input style={iSt} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </F>
        <F label="Jami qarz summasi (so'm) *">
          <input type="number" style={iSt} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </F>
        {item.paid > 0 && (
          <p style={{ fontSize: 11.5, color: T.muted }}>
            Diqqat: bu odam allaqachon <b className="mo">{fmtSum(item.paid)}</b> to'lagan — yangi summa shundan katta bo'lishi kerak.
          </p>
        )}
      </div>
      <SaveBtn color={T.gold} disabled={!name.trim() || !num(amount)}
        onClick={() => onSave(name.trim(), num(amount))}>
        <Save size={15} /> Saqlash
      </SaveBtn>
    </Modal>
  );
}

function AddOldDebtorModal({ title, rate, existingNames, onClose, onSave }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const isExisting = (existingNames || []).some((n) => n.trim().toLowerCase() === name.trim().toLowerCase());

  return (
    <Modal title={title || "Eski qarzdor qo'shish"} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <F label="Ism / Tashkilot *">
          <input style={iSt} value={name} onChange={(e) => setName(e.target.value)}
            list="debtor-name-list" placeholder="Nomi yozing yoki ro'yxatdan tanlang" autoFocus />
          <datalist id="debtor-name-list">
            {(existingNames || []).map((n) => <option key={n} value={n} />)}
          </datalist>
        </F>
        {isExisting && (
          <p style={{ fontSize: 11.5, color: T.gold, marginTop: -6 }}>
            ℹ Bu ism allaqachon mavjud — summa uning joriy qarziga qo'shiladi.
          </p>
        )}
        <F label="Qarz summasi (so'm) *">
          <input type="number" style={iSt} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </F>
      </div>
      <SaveBtn disabled={!name.trim() || !num(amount)} onClick={() => onSave({
        name: name.trim(), amountSum: num(amount), currency: "SUM", amountOriginal: num(amount),
        note: "", date: todayISO(),
      })}>
        <Plus size={15} /> Qo'shish
      </SaveBtn>
    </Modal>
  );
}

function SimpleDebtPayModal({ item, rate, onClose, onSave }) {
  const [currency, setCurrency] = useState("SUM");
  const [amt, setAmt] = useState(String(Math.round(item.remaining)));
  const amountSum = toSum(amt, currency, rate);
  const after = Math.max(0, item.remaining - amountSum);

  return (
    <Modal title={`To'lov — ${item.name}`} onClose={onClose}>
      <div style={{ marginBottom: 14, padding: "10px 14px", background: T.s3, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: T.muted }}>Qolgan qarz</span>
        <span className="mo" style={{ fontWeight: 700 }}>{fmtSum(item.remaining)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <F label="Valyuta"><CurrencyToggle value={currency} onChange={setCurrency} /></F>
        <F label={`To'lov summasi (${currency})`}>
          <input type="number" style={iSt} value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
        </F>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn variant="ghost" size="sm" onClick={() => { setCurrency("SUM"); setAmt(String(Math.round(item.remaining))); }}>To'liq summa</Btn>
        <Btn variant="ghost" size="sm" onClick={() => { setCurrency("SUM"); setAmt(String(Math.round(item.remaining / 2))); }}>Yarmi</Btn>
      </div>
      <div style={{ marginTop: 14, padding: "10px 14px", background: T.s3, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: T.muted }}>To'lovdan keyin qoladi</span>
        <span className="mo" style={{ fontWeight: 700, color: after > 0 ? T.red : T.teal }}>{fmtSum(after)}</span>
      </div>
      <SaveBtn disabled={!amountSum || amountSum <= 0} color={T.teal}
        onClick={() => onSave(Math.min(amountSum, item.remaining))}>
        <Check size={15} /> To'lovni saqlash
      </SaveBtn>
    </Modal>
  );
}

/* ─── ANALYTICS TAB ─── */
/* ═══════════════════════════════════════════════════
   RAHBAR PANELI — qisqa, muhim ko'rsatkichlar
═══════════════════════════════════════════════════ */
function RahbarPanelTab({ data, patch, rate }) {
  const [period, setPeriod] = useState("bugun"); // bugun | oy | yil | erkin
  const [customFrom, setCustomFrom] = useState(todayISO());
  const [customTo, setCustomTo] = useState(todayISO());

  const cf = data.cashflow || [];
  const now = todayISO();
  const monthKey = now.slice(0, 7);
  const yearKey = now.slice(0, 4);

  const inPeriod = (date) => {
    if (!date) return false;
    if (period === "bugun") return date === now;
    if (period === "oy") return date.startsWith(monthKey);
    if (period === "yil") return date.startsWith(yearKey);
    return date >= customFrom && date <= customTo; // erkin oraliq
  };

  const isCash = (c) => c.paymentType !== "Karta (Click/Payme)" && c.paymentType !== "Nasiya (qarzga)";
  const income = cf.filter((c) => c.type === "kirim" && isCash(c) && inPeriod(c.date)).reduce((s, c) => s + num(c.amountSum), 0);
  const expense = cf.filter((c) => c.type === "chiqim" && isCash(c) && inPeriod(c.date)).reduce((s, c) => s + num(c.amountSum), 0);
  const rahbarExpense = cf.filter((c) => c.category === "Rahbarga chiqim" && inPeriod(c.date)).reduce((s, c) => s + num(c.amountSum), 0);
  const logistikaExpense = cf.filter((c) => c.category === "Logistika" && inPeriod(c.date)).reduce((s, c) => s + num(c.amountSum), 0);
  const pitaniyaExpense = cf.filter((c) => c.category === "Pitaniya" && inPeriod(c.date)).reduce((s, c) => s + num(c.amountSum), 0);
  const clickTotal = cf.filter((c) => c.paymentType === "Karta (Click/Payme)" && inPeriod(c.date))
    .reduce((s, c) => s + (c.type === "kirim" ? num(c.amountSum) : -num(c.amountSum)), 0);

  const cardsInPeriod = data.serviceCards.filter((c) => inPeriod(c.date) && cardStatus(c) !== "ochiq");
  const totalProfit = cardsInPeriod.reduce((s, c) => s + num(c.profitSum), 0);
  const cardProductProfit = cardsInPeriod.reduce((s, c) => s + num(c.productProfit), 0);
  const freeSalesInPeriod = (data.freeSales || []).filter((s) => inPeriod(s.date));
  const freeSalesProfit = freeSalesInPeriod.reduce((s, sale) => s + num(sale.profitSum), 0);
  const totalProductProfit = cardProductProfit + freeSalesProfit;

  const supDebts = supplierDebts(data);
  const supTotal = supDebts.reduce((s, d) => s + Math.max(0, d.debtSum), 0);
  const partnerBal = partnerBalances(data);
  const partnerTotal = partnerBal.reduce((s, p) => s + Math.max(0, p.debtSum), 0);
  const ustaPending = ustaPendingByName(data).reduce((s, u) => s + u.amountSum, 0);
  const nasiyaTotal = (data.nasiyaDebts || []).filter((n) => !n.paid).reduce((s, n) => s + (num(n.amountSum) - num(n.paidAmount || 0)), 0);
  const personalTotal = (data.personalDebts || []).filter((p) => !p.paid).reduce((s, p) => s + (num(p.amountSum) - num(p.paidAmount || 0)), 0);

  const pendingInvReq = (data.inventoryRequests || []).filter((r) => r.status === "kutilmoqda");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Rahbar paneli</h2>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>Biznesning umumiy ko'rinishi</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["bugun", "Bugun"], ["oy", "Bu oy"], ["yil", "Bu yil"], ["erkin", "Erkin oraliq"]].map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              padding: "7px 14px", borderRadius: 8, border: `1px solid ${period === v ? T.flame : T.border2}`,
              background: period === v ? T.flameD : T.s1, color: period === v ? T.flame : T.muted,
              fontWeight: 600, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}>{v === "erkin" && <Calendar size={12} />}{l}</button>
          ))}
        </div>
      </div>

      {period === "erkin" && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap",
          background: T.s1, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px",
        }}>
          <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Muddat:</span>
          <input type="date" style={{ ...iSt, width: 150 }} value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)} />
          <span style={{ color: T.muted }}>—</span>
          <input type="date" style={{ ...iSt, width: 150 }} value={customTo}
            onChange={(e) => setCustomTo(e.target.value)} />
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <Btn size="sm" variant="ghost" onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 6);
              setCustomFrom(d.toISOString().slice(0, 10)); setCustomTo(todayISO());
            }}>7 kun</Btn>
            <Btn size="sm" variant="ghost" onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 29);
              setCustomFrom(d.toISOString().slice(0, 10)); setCustomTo(todayISO());
            }}>30 kun</Btn>
            <Btn size="sm" variant="ghost" onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 89);
              setCustomFrom(d.toISOString().slice(0, 10)); setCustomTo(todayISO());
            }}>90 kun</Btn>
          </div>
        </div>
      )}

      {pendingInvReq.length > 0 && (
        <div style={{ background: T.goldD, border: `1px solid ${T.gold}40`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12.5, color: T.gold }}>
          ⏳ {pendingInvReq.length} ta inventarizatsiya so'rovi javob kutmoqda (Sklad bo'limida)
        </div>
      )}

      {(() => {
        const d = new Date();
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const isMonthEnd = d.getDate() >= lastDay - 4; // oxirgi 5 kun
        const hasKpiThisMonth = (data.settings.azimKpiHistory || []).some((h) => h.month === currentMonthKey());
        if (!isMonthEnd || hasKpiThisMonth) return null;
        return (
          <div style={{ background: T.purpleD, border: `1px solid ${T.purple}40`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12.5, color: T.purple }}>
            📌 Oy yakunlanmoqda — Azim Avazovich uchun bu oyga hali KPI kiritilmagan. "Analitika" bo'limida kiritish mumkin.
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13, marginBottom: 14 }}>
        <Stat label="Naqd kirim" value={fmtSum(income)} color={T.teal} Icon={TrendingUp} />
        <Stat label="Naqd chiqim" value={fmtSum(expense)} color={T.red} Icon={TrendingDown} />
        <Stat label="Sof foyda" value={fmtSum(income - expense)} sub={fmtUsd((income - expense) / rate)} color={T.flame} Icon={Wallet} />
        <Stat label="Click balans" value={fmtSum(clickTotal)} sub="balansdan tashqari" color={T.purple} Icon={TrendingUp} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13, marginBottom: 14 }}>
        <Stat label="Rahbar olgan chiqim" value={fmtSum(rahbarExpense)} color={T.gold} Icon={Wallet} />
        <Stat label="Logistika xarajati" value={fmtSum(logistikaExpense)} color={T.red} Icon={TrendingDown} />
        <Stat label="Pitaniya xarajati" value={fmtSum(pitaniyaExpense)} color={T.red} Icon={TrendingDown} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13, marginBottom: 20 }}>
        <Stat label="Xizmatlardan foyda" value={fmtSum(totalProfit)} sub={`${cardsInPeriod.length} ta xizmat`} color={T.teal} Icon={Car} />
        <Stat label="— shundan mahsulotdan" value={fmtSum(totalProductProfit)} sub="tannarx va sotish narxi farqi" color={T.purple} Icon={Package} />
        <Stat label="Ta'minotchi qarzi" value={fmtSum(supTotal)} color={T.red} Icon={AlertTriangle} />
        <Stat label="Hamkor qarzi" value={fmtSum(partnerTotal)} color={T.gold} Icon={Handshake} />
        <Stat label="Usta kutilayotgan haqi" value={fmtSum(ustaPending)} color={T.blue} Icon={Wrench} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13, marginBottom: 20 }}>
        <Stat label="Nasiya (bizga qarz)" value={fmtSum(nasiyaTotal)} color={T.teal} Icon={Clock} />
        <Stat label="Shaxsiy qarzlar" value={fmtSum(personalTotal)} color={T.teal} Icon={Users} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <UstaRankingCard cards={cardsInPeriod} />
      </div>

      <OwnerMonthlyReport data={data} rate={rate} />

      <div style={{ marginTop: 18 }}>
        <AuditLogCard auditLog={data.auditLog} />
      </div>
    </div>
  );
}

function UstaRankingCard({ cards }) {
  const map = {};
  cards.forEach((c) => {
    const name = c.usta || "Noma'lum";
    if (!map[name]) map[name] = { name, jobs: 0, revenue: 0, fee: 0, cancelled: 0 };
    map[name].jobs += 1;
    map[name].revenue += num(c.finalTotal);
    map[name].fee += num(c.ustaFee);
  });
  const rows = Object.values(map).sort((a, b) => b.revenue - a.revenue);
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));

  return (
    <Card title={`Usta reytingi (${rows.length})`} pad={false}>
      {rows.length === 0 ? (
        <div style={{ padding: "24px 20px", textAlign: "center", color: T.muted, fontSize: 12.5 }}>
          Tanlangan davrda yakunlangan ish yo'q
        </div>
      ) : (
        <div style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
          {rows.map((r, i) => (
            <div key={r.name}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {i === 0 && <Star size={13} color={T.gold} />} {r.name}
                  <span style={{ color: T.muted, fontWeight: 400 }}>({r.jobs} ta ish)</span>
                </span>
                <span style={{ display: "flex", gap: 10 }}>
                  <span className="mo" style={{ fontSize: 12, fontWeight: 700 }}>{fmtSum(r.revenue)}</span>
                  <span className="mo" style={{ fontSize: 11, color: T.gold }}>haq: {fmtSum(r.fee)}</span>
                </span>
              </div>
              <div style={{ height: 6, background: T.s3, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(r.revenue / maxRevenue * 100).toFixed(0)}%`, height: "100%", background: i === 0 ? T.gold : T.flame, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Yengil ichki SVG diagrammalar — tashqi kutubxonasiz ── */

/* ═══════════════════════════════════════════════════
   PROFESSIONAL ANALYTICS CHARTS (v54)
   Dunyo tadbirkorlari / SaaS dashboard uslubi:
   - Dual-axis trend (revenue bars + profit line)
   - Donut / composition
   - Waterfall (P&L bridge)
   - Funnel (lead conversion)
   - Pareto 80/20 (mahsulot)
═══════════════════════════════════════════════════ */
function MonthlyTrendChart({ months, height = 200 }) {
  const w = 720, padL = 42, padR = 16, padT = 16, baseY = height - 28;
  const maxVal = Math.max(1, ...months.map((m) => m.revenue), ...months.map((m) => Math.abs(m.profit)));
  const n = months.length || 1;
  const gap = (w - padL - padR) / n;
  const barW = Math.max(8, Math.min(36, gap * 0.48));
  const scale = (v) => ((baseY - padT) * Math.max(0, v)) / maxVal;
  const linePts = months.map((m, i) => {
    const x = padL + i * gap + gap / 2;
    return `${x},${baseY - scale(m.profit)}`;
  }).join(" ");
  // Grid lines (25/50/75%)
  const grids = [0.25, 0.5, 0.75, 1].map((f) => baseY - (baseY - padT) * f);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="xMidYMid meet">
      {grids.map((y, i) => (
        <line key={i} x1={padL} y1={y} x2={w - padR} y2={y} stroke={T.border} strokeWidth="1" strokeDasharray="3 4" />
      ))}
      <line x1={padL} y1={baseY} x2={w - padR} y2={baseY} stroke={T.border2} strokeWidth="1.2" />
      {months.map((m, i) => {
        const x = padL + i * gap + gap / 2 - barW / 2;
        const barH = scale(m.revenue);
        return (
          <g key={m.key}>
            <rect x={x} y={baseY - barH} width={barW} height={barH} rx="3" fill={T.teal} opacity="0.82" />
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="9.5" fill={T.muted} fontFamily="Barlow,sans-serif">{m.label}</text>
          </g>
        );
      })}
      {months.length > 1 && (
        <polyline points={linePts} fill="none" stroke={T.flame} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {months.map((m, i) => {
        const x = padL + i * gap + gap / 2;
        return <circle key={"d" + m.key} cx={x} cy={baseY - scale(m.profit)} r="3.8" fill={T.flame} stroke={T.s1} strokeWidth="1.5" />;
      })}
      <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize="9" fill={T.muted}>{fmtSum(maxVal).replace(" so'm", "")}</text>
    </svg>
  );
}

function DonutChart({ segments, size = 140, thickness = 22 }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.s3} strokeWidth={thickness} />
      {total > 0 && segments.map((s, i) => {
        const frac = Math.max(0, s.value) / total;
        const dash = frac * circumference;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`} />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="11" fontWeight="700" fill={T.text} fontFamily="JetBrains Mono,monospace">
        {total > 0 ? Math.round((segments[0]?.value || 0) / total * 100) + "%" : "—"}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill={T.muted}>asosiy</text>
    </svg>
  );
}

/** Waterfall — kirim → xarajatlar → sof foyda (P&L bridge) */
function WaterfallChart({ steps, height = 200 }) {
  // steps: [{ label, value, type: 'total'|'positive'|'negative' }]
  const w = 680, pad = 36, baseY = height - 30;
  const absMax = Math.max(1, ...steps.map((s) => Math.abs(s.value)));
  const scale = (v) => ((baseY - 20) * Math.abs(v)) / absMax;
  let running = 0;
  const cols = steps.map((s, i) => {
    const start = running;
    if (s.type === "total") {
      running = s.value;
    } else {
      running += s.value;
    }
    const end = running;
    const y1 = baseY - scale(Math.max(start, end, 0));
    const y0 = baseY - scale(Math.min(start, end, 0) === 0 && start >= 0 && end >= 0 ? Math.min(start, end) : Math.min(start, end));
    // simplify for mostly positive business cashflows
    const top = baseY - scale(Math.max(start, end));
    const bot = baseY - scale(Math.min(start, end));
    const h = Math.max(2, bot - top);
    const gap = (w - pad * 2) / steps.length;
    const x = pad + i * gap + gap * 0.18;
    const bw = gap * 0.64;
    const color = s.type === "total" ? T.blue : s.value >= 0 ? T.teal : T.red;
    return { ...s, x, bw, top, h, color, end };
  });
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1={pad} y1={baseY} x2={w - pad} y2={baseY} stroke={T.border2} strokeWidth="1" />
      {cols.map((c, i) => (
        <g key={i}>
          {i > 0 && (
            <line x1={cols[i - 1].x + cols[i - 1].bw / 2} y1={cols[i - 1].top}
              x2={c.x + c.bw / 2} y2={c.top} stroke={T.border2} strokeWidth="1" strokeDasharray="3 3" />
          )}
          <rect x={c.x} y={c.top} width={c.bw} height={c.h} rx="3" fill={c.color} opacity="0.9" />
          <text x={c.x + c.bw / 2} y={height - 10} textAnchor="middle" fontSize="9" fill={T.muted}>{c.label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Lead funnel — konversiya bosqichlari */
function FunnelChart({ stages, height = 210 }) {
  const max = Math.max(1, ...(stages.map((s) => s.count)));
  const w = 560, pad = 12;
  const rowH = (height - pad * 2) / Math.max(1, stages.length);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {stages.map((s, i) => {
        const frac = s.count / max;
        const bw = Math.max(40, (w - 160) * frac);
        const x = (w - 160 - bw) / 2 + 8;
        const y = pad + i * rowH;
        const rate = i === 0 ? 100 : (stages[0].count ? Math.round(s.count / stages[0].count * 100) : 0);
        return (
          <g key={s.id || i}>
            <rect x={x} y={y + 4} width={bw} height={rowH - 10} rx="6" fill={s.color || T.blue} opacity={0.85 - i * 0.08} />
            <text x={x + bw / 2} y={y + rowH / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
              {s.label}: {s.count}
            </text>
            <text x={w - 8} y={y + rowH / 2 + 4} textAnchor="end" fontSize="10" fill={T.muted}>{rate}%</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Pareto — 80/20 mahsulot foydasi */
function ParetoChart({ rows, height = 200 }) {
  // rows: [{ name, profit }] sorted desc
  const top = rows.slice(0, 8);
  if (!top.length) return <p style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: 24 }}>Ma'lumot yo'q</p>;
  const total = top.reduce((s, r) => s + Math.max(0, r.profit), 0) || 1;
  let cum = 0;
  const w = 680, padL = 40, padR = 20, baseY = height - 36, padT = 12;
  const maxBar = Math.max(1, ...top.map((r) => Math.max(0, r.profit)));
  const gap = (w - padL - padR) / top.length;
  const barW = gap * 0.55;
  const pts = [];
  top.forEach((r, i) => {
    cum += Math.max(0, r.profit);
    const x = padL + i * gap + gap / 2;
    const y = padT + (baseY - padT) * (1 - cum / total);
    pts.push(`${x},${y}`);
  });
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1={padL} y1={baseY} x2={w - padR} y2={baseY} stroke={T.border2} strokeWidth="1" />
      {/* 80% reference */}
      <line x1={padL} y1={padT + (baseY - padT) * 0.2} x2={w - padR} y2={padT + (baseY - padT) * 0.2}
        stroke={T.gold} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
      <text x={w - padR} y={padT + (baseY - padT) * 0.2 - 4} textAnchor="end" fontSize="9" fill={T.gold}>80%</text>
      {top.map((r, i) => {
        const h = ((baseY - padT) * Math.max(0, r.profit)) / maxBar;
        const x = padL + i * gap + gap / 2 - barW / 2;
        return (
          <g key={i}>
            <rect x={x} y={baseY - h} width={barW} height={h} rx="3" fill={T.purple} opacity="0.85" />
            <text x={x + barW / 2} y={height - 12} textAnchor="middle" fontSize="8.5" fill={T.muted}>
              {(r.name || "").slice(0, 8)}
            </text>
          </g>
        );
      })}
      {pts.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke={T.gold} strokeWidth="2" />}
      {pts.map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="3" fill={T.gold} />;
      })}
    </svg>
  );
}

function AnalyticsTab({ data, patch, rate, readOnly = false }) {
  const [openStat, setOpenStat] = useState(null);
  const toggleStat = (key) => setOpenStat((s) => (s === key ? null : key));

  const cards = (data.serviceCards || []).filter((c) => cardStatus(c) !== "ochiq");
  const sumF = (arr, k) => arr.reduce((s, c) => s + num(c[k]), 0);
  const totalRevenue = sumF(cards, "finalTotal");
  const totalProfit = sumF(cards, "profitSum");
  const totalProductProfit = productProfitReport(data).reduce((s, r) => s + r.profit, 0);
  const azimKpi = num(data.settings.azimKpi);

  // KPI kartochkalar bosilganda ochiladigan tafsilot ro'yxatlari — eng katta
  // summadan boshlab, shu raqam qaysi yozuvlardan yig'ilganini ko'rsatadi.
  const cardsByRevenue = [...cards].sort((a, b) => num(b.finalTotal) - num(a.finalTotal));
  const cardsByProfit = [...cards].sort((a, b) => num(b.profitSum) - num(a.profitSum));
  const kpiHistorySorted = [...(data.settings.azimKpiHistory || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Oylik dinamika
  const byMonth = {};
  cards.forEach((c) => {
    const key = (c.date || "").slice(0, 7);
    if (!key) return;
    if (!byMonth[key]) byMonth[key] = { key, label: key.slice(5), revenue: 0, profit: 0, count: 0 };
    byMonth[key].revenue += num(c.finalTotal);
    byMonth[key].profit += num(c.profitSum);
    byMonth[key].count += 1;
  });
  const monthlyStats = Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key)).slice(-8);

  // Xizmat turlari
  const typeMap = {};
  SERVICE_TYPES.forEach((t) => { typeMap[t] = { label: t, revenue: 0, profit: 0, count: 0, color: SERVICE_COLORS[t] || T.blue }; });
  cards.forEach((c) => {
    const t = c.serviceType || "Servis";
    if (!typeMap[t]) typeMap[t] = { label: t, revenue: 0, profit: 0, count: 0, color: T.blue };
    typeMap[t].revenue += num(c.finalTotal);
    typeMap[t].profit += num(c.profitSum);
    typeMap[t].count += 1;
  });
  const rows = Object.values(typeMap).filter((r) => r.count > 0);
  const maxRev = Math.max(1, ...rows.map((r) => r.revenue));

  // Valyuta
  const incomeEntries = (data.cashflow || []).filter((c) => c.type === "kirim" && c.paymentType !== "Karta (Click/Payme)" && c.paymentType !== "Nasiya (qarzga)");
  const incomeSUMTotal = incomeEntries.filter((c) => c.currency !== "USD").reduce((s, c) => s + num(c.amountSum), 0);
  const incomeUSDTotalRaw = incomeEntries.filter((c) => c.currency === "USD").reduce((s, c) => s + num(c.amount), 0);
  const incomeUSDTotalAsSum = incomeEntries.filter((c) => c.currency === "USD").reduce((s, c) => s + num(c.amountSum), 0);
  const currencySegments = [
    { label: "SO'M", value: incomeSUMTotal, color: T.teal },
    { label: "USD", value: incomeUSDTotalAsSum, color: T.gold },
  ].filter((s) => s.value > 0);

  // Waterfall — joriy oy
  const mk = (new Date()).toISOString().slice(0, 7);
  const monthCF = (data.cashflow || []).filter((c) => (c.date || "").startsWith(mk));
  const mInc = monthCF.filter((c) => c.type === "kirim" && c.paymentType !== "Karta (Click/Payme)" && c.paymentType !== "Nasiya (qarzga)").reduce((s, c) => s + num(c.amountSum), 0);
  const mSup = monthCF.filter((c) => c.category === "Ta'minotchiga to'lov").reduce((s, c) => s + num(c.amountSum), 0);
  const mUsta = monthCF.filter((c) => c.category === "Usta xizmat haqi").reduce((s, c) => s + num(c.amountSum), 0);
  const mOther = monthCF.filter((c) => c.type === "chiqim" && !["Ta'minotchiga to'lov", "Usta xizmat haqi"].includes(c.category)).reduce((s, c) => s + num(c.amountSum), 0);
  const mNet = mInc - mSup - mUsta - mOther;
  const waterfallSteps = [
    { label: "Kirim", value: mInc, type: "total" },
    { label: "Ta'minot", value: -mSup, type: "negative" },
    { label: "Usta", value: -mUsta, type: "negative" },
    { label: "Boshqa", value: -mOther, type: "negative" },
    { label: "Sof", value: mNet, type: "total" },
  ];

  // Lead funnel
  const leads = data.leads || [];
  const funnelStages = LEAD_STAGES.map((st) => ({
    id: st.id,
    label: st.label,
    color: st.color,
    count: leads.filter((l) => l.stage === st.id).length,
  })).filter((s) => s.count > 0);
  // Agar stage id emas label saqlangan bo'lsa
  if (!funnelStages.length && leads.length) {
    LEAD_STAGES.forEach((st) => {
      const c = leads.filter((l) => l.stage === st.id || l.stage === st.label).length;
      if (c) funnelStages.push({ id: st.id, label: st.label, color: st.color, count: c });
    });
  }

  const productProfitRows = productProfitReport(data).slice(0, 12);
  const marginPct = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0;

  return (
    <div className="fi" style={{ padding: "8px 0 40px" }}>
      <div style={{ marginBottom: 18 }}>
        <h2 className="bc" style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.02em" }}>Analitika</h2>
        <p style={{ fontSize: 12.5, color: T.muted }}>
          Executive dashboard — tushum, foyda, konversiya va 80/20 mahsulot tahlili
        </p>
      </div>

      {/* KPI scorecards — Stripe / Linear uslubi. Har biri (Marjadan tashqari) bosilsa,
          shu raqam qaysi yozuvlardan yig'ilgani pastda ochiladi. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: openStat ? 10 : 18 }}>
        <div onClick={() => toggleStat("tushum")} style={{ cursor: "pointer" }}>
          <Stat label="Jami tushum" value={fmtSum(totalRevenue)} color={T.blue} Icon={TrendingUp} />
        </div>
        <div onClick={() => toggleStat("foyda")} style={{ cursor: "pointer" }}>
          <Stat label="Jami foyda" value={fmtSum(totalProfit)} color={T.teal} Icon={TrendingUp} />
        </div>
        <Stat label="Marja" value={marginPct + "%"} sub="foyda / tushum" color={marginPct >= 20 ? T.teal : T.gold} Icon={BarChart3} />
        <div onClick={() => toggleStat("mahsulot")} style={{ cursor: "pointer" }}>
          <Stat label="Mahsulot foydasi" value={fmtSum(totalProductProfit)} sub="tannarx farqi" color={T.purple} Icon={Package} />
        </div>
        {readOnly ? (
          <div onClick={() => toggleStat("kpi")} style={{ cursor: "pointer" }}>
            <Stat label="Azim KPI" value={fmtSum(azimKpi)} color={T.gold} Icon={Star} />
          </div>
        ) : (
          <KpiEditCard value={azimKpi} history={data.settings.azimKpiHistory}
            onAdd={(amount, reason) => patch((d) => {
              d.settings.azimKpiHistory = d.settings.azimKpiHistory || [];
              d.settings.azimKpiHistory.push({ id: uid(), month: (new Date()).toISOString().slice(0, 7), amount, reason, date: todayISO() });
              d.settings.azimKpi = (d.settings.azimKpiHistory || []).reduce((s, h) => s + num(h.amount), 0);
              return d;
            })} />
        )}
      </div>

      {openStat && (
        <Card
          title={
            openStat === "tushum" ? `Jami tushum — ${cardsByRevenue.length} ta karta`
            : openStat === "foyda" ? `Jami foyda — ${cardsByRevenue.length} ta karta`
            : openStat === "mahsulot" ? `Mahsulot foydasi — ${productProfitRows.length} ta mahsulot`
            : `Azim KPI tarixi — ${kpiHistorySorted.length} ta yozuv`
          }
          pad={false}
        >
          <div style={{ maxHeight: 320, overflowY: "auto" }} className="fi">
            {(openStat === "tushum" || openStat === "foyda") && (
              cardsByRevenue.length === 0 ? (
                <p style={{ padding: 16, fontSize: 12.5, color: T.muted }}>Yakunlangan karta yo'q</p>
              ) : (openStat === "tushum" ? cardsByRevenue : cardsByProfit).map((c) => (
                <div key={c.id} style={{
                  display: "flex", justifyContent: "space-between", gap: 12,
                  padding: "9px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12.5,
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="mo" style={{ color: T.muted, marginRight: 8 }}>{c.date}</span>
                    {c.carModel || c.plate || "—"} <span style={{ color: T.muted }}>· {c.serviceType || "—"}</span>
                  </span>
                  <span className="mo" style={{ fontWeight: 700, color: openStat === "tushum" ? T.blue : T.teal, flexShrink: 0 }}>
                    {fmtSum(openStat === "tushum" ? c.finalTotal : c.profitSum)}
                  </span>
                </div>
              ))
            )}
            {openStat === "mahsulot" && (
              productProfitRows.length === 0 ? (
                <p style={{ padding: 16, fontSize: 12.5, color: T.muted }}>Ma'lumot yo'q</p>
              ) : productProfitRows.map((r) => (
                <div key={r.name} style={{
                  display: "flex", justifyContent: "space-between", gap: 12,
                  padding: "9px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12.5,
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{r.name} <span style={{ color: T.muted }}>· {r.qty} dona</span></span>
                  <span className="mo" style={{ fontWeight: 700, color: T.purple, flexShrink: 0 }}>{fmtSum(r.profit)}</span>
                </div>
              ))
            )}
            {openStat === "kpi" && (
              kpiHistorySorted.length === 0 ? (
                <p style={{ padding: 16, fontSize: 12.5, color: T.muted }}>Hali KPI yozuvi yo'q</p>
              ) : kpiHistorySorted.map((h) => (
                <div key={h.id} style={{
                  display: "flex", justifyContent: "space-between", gap: 12,
                  padding: "9px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12.5,
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="mo" style={{ color: T.muted, marginRight: 8 }}>{h.date}</span>
                    {h.reason || <span style={{ color: T.muted, fontStyle: "italic" }}>izohsiz</span>}
                  </span>
                  <span className="mo" style={{ fontWeight: 700, color: T.gold, flexShrink: 0 }}>{fmtSum(h.amount)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
      <div style={{ marginBottom: openStat ? 18 : 0 }} />

      <Card title="Xizmat turlari — tushum va foyda">
        <div style={{ display: "grid", gap: 14 }}>
          {rows.length === 0 && <p style={{ fontSize: 12, color: T.muted, textAlign: "center" }}>Hali ma'lumot yo'q</p>}
          {rows.map((r) => (
            <div key={r.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.label} <span style={{ color: T.muted, fontWeight: 400 }}>({r.count})</span></span>
                <span style={{ display: "flex", gap: 10 }}>
                  <span className="mo" style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtSum(r.revenue)}</span>
                  <span className="mo" style={{ fontSize: 12, color: r.profit >= 0 ? T.teal : T.red }}>(foyda: {fmtSum(r.profit)})</span>
                </span>
              </div>
              <div style={{ height: 6, background: T.s3, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(r.revenue / maxRev * 100).toFixed(0)}%`, height: "100%", background: r.color, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
        <Card title="Oylik dinamika — tushum (ustun) · foyda (chiziq)">
          {monthlyStats.length > 0 ? <MonthlyTrendChart months={monthlyStats} /> : (
            <p style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "30px 0" }}>Hali yakunlangan karta yo'q</p>
          )}
        </Card>
        <Card title="Kirim — valyuta tarkibi">
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <DonutChart segments={currencySegments.length ? currencySegments : [{ label: "—", value: 1, color: T.s3 }]} />
            <div style={{ display: "grid", gap: 8 }}>
              {currencySegments.map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  <span style={{ color: T.muted }}>{s.label}</span>
                </div>
              ))}
              <div className="mo" style={{ fontSize: 12.5, fontWeight: 700, color: T.teal }}>{fmtSum(incomeSUMTotal)}</div>
              <div className="mo" style={{ fontSize: 12.5, fontWeight: 700, color: T.gold }}>{fmtUsd(incomeUSDTotalRaw)} <span style={{ fontWeight: 400, color: T.muted }}>({fmtSum(incomeUSDTotalAsSum)})</span></div>
            </div>
          </div>
        </Card>
      </div>

      {/* Entrepreneur charts row */}
      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
        <Card title={`P&L bridge — ${mk} (waterfall)`}>
          <p style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>Kirimdan sof foydagacha — qayerda pul qolmoqda</p>
          <WaterfallChart steps={waterfallSteps} />
        </Card>
        <Card title="Lead funnel — konversiya">
          <p style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>Qo'ng'iroqdan o'rnatishgacha bosqichlar</p>
          {funnelStages.length > 0 ? <FunnelChart stages={funnelStages} /> : (
            <p style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: 24 }}>Lead ma'lumoti yo'q</p>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card title="Pareto 80/20 — mahsulot foydasi">
          <p style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
            Qaysi mahsulotlar foydaning asosiy qismini beradi (oltin chiziq = kumulativ ulush)
          </p>
          <ParetoChart rows={productProfitRows} />
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card title={`Mahsulot bo'yicha foyda (${productProfitRows.length})`} pad={false}>
          <p style={{ fontSize: 11.5, color: T.muted, padding: "12px 18px 0" }}>
            Xizmat kartalari (Servis, Moy bo'limi) va Erkin savdodan
          </p>
          <Tbl
            empty="Ma'lumot yo'q"
            cols={[
              { k: "name", h: "Mahsulot", r: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
              { k: "qty", h: "Sotilgan", r: (r) => <span className="mo">{r.qty}</span> },
              { k: "revenue", h: "Daromad", r: (r) => <span className="mo" style={{ color: T.muted2 }}>{fmtSum(r.revenue)}</span> },
              { k: "profit", h: "Foyda", r: (r) => <span className="mo" style={{ fontWeight: 700, color: r.profit >= 0 ? T.teal : T.red }}>{fmtSum(r.profit)}</span> },
            ]}
            rows={productProfitRows}
          />
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <OwnerMonthlyReport data={data} rate={rate} />
      </div>
    </div>
  );
}

function AuditLogCard({ auditLog }) {
  const [expanded, setExpanded] = useState(false);
  const entries = [...(auditLog || [])].reverse();
  const visible = expanded ? entries : entries.slice(0, 15);

  return (
    <Card title={`Faoliyat tarixi (${entries.length})`} pad={false}>
      {entries.length === 0 ? (
        <p style={{ padding: 16, fontSize: 12.5, color: T.muted }}>Hali yozuv yo'q.</p>
      ) : (
        <>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {visible.map((e) => (
              <div key={e.id} style={{
                display: "flex", justifyContent: "space-between", gap: 12,
                padding: "10px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12.5,
              }}>
                <span style={{ flex: 1 }}>{e.note}</span>
                <span style={{ color: T.muted, whiteSpace: "nowrap" }}>
                  {e.actor} · {new Date(e.ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
          {entries.length > 15 && (
            <button onClick={() => setExpanded((s) => !s)} style={{
              width: "100%", padding: 11, background: "none", border: "none", cursor: "pointer",
              color: T.flame, fontSize: 12.5, fontWeight: 600,
            }}>
              {expanded ? "Kamroq ko'rsatish" : `Barchasini ko'rsatish (${entries.length})`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

function OwnerMonthlyReport({ data, rate }) {
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const [openRows, setOpenRows] = useState(() => new Set());
  const toggleRow = (label) => setOpenRows((s) => {
    const next = new Set(s);
    next.has(label) ? next.delete(label) : next.add(label);
    return next;
  });

  const cf = data.cashflow || [];
  const monthCF = cf.filter((c) => (c.date || "").startsWith(monthFilter));

  // MUHIM: kirim CHIQIM bilan bir xil qoidada hisoblanishi kerak — pastdagi chiqim
  // (supplierPay, ustaPay va h.k.) to'lov turidan qat'i nazar TO'LIQ hisoblanadi.
  // Avval kirim esa Karta/Nasiya to'lovlarini chiqarib tashlagan edi — natijada shu
  // turdagi chiqimlar to'liq ayirilib, ularga mos kirim esa umuman qo'shilmagan,
  // "Sof foyda" haqiqiydan sezilarli darajada past (yolg'on minus) chiqib qolgan edi.
  const monthIncomeEntries = monthCF.filter((c) => c.type === "kirim");
  const monthIncome = monthIncomeEntries.reduce((s, c) => s + num(c.amountSum), 0);
  // Valyuta bo'yicha ajratib ko'rsatish uchun — SOF FOYDA hisobiga ta'sir qilmaydi (u SO'M ekvivalentda hisoblanadi)
  const monthIncomeSUM = monthIncomeEntries.filter((c) => c.currency !== "USD").reduce((s, c) => s + num(c.amountSum), 0);
  const monthIncomeUSDRaw = monthIncomeEntries.filter((c) => c.currency === "USD").reduce((s, c) => s + num(c.amount), 0);
  const monthIncomeUSDAsSum = monthIncomeEntries.filter((c) => c.currency === "USD").reduce((s, c) => s + num(c.amountSum), 0);

  const monthExpenseEntries = monthCF.filter((c) => c.type === "chiqim");
  const monthExpenseSUM = monthExpenseEntries.filter((c) => c.currency !== "USD").reduce((s, c) => s + num(c.amountSum), 0);
  const monthExpenseUSDRaw = monthExpenseEntries.filter((c) => c.currency === "USD").reduce((s, c) => s + num(c.amount), 0);
  const monthExpenseUSDAsSum = monthExpenseEntries.filter((c) => c.currency === "USD").reduce((s, c) => s + num(c.amountSum), 0);

  const supplierEntries = monthCF.filter((c) => c.category === "Ta'minotchiga to'lov");
  const ustaEntries = monthCF.filter((c) => c.category === "Usta xizmat haqi");
  const docFeeEntries = monthCF.filter((c) => c.category === "Hujjat xarajati");
  const employeeEntries = monthCF.filter((c) => c.category === "Ish haqi");
  const rahbarEntries = monthCF.filter((c) => c.category === "Rahbarga chiqim");
  const logistikaEntries = monthCF.filter((c) => c.category === "Logistika");
  const pitaniyaEntries = monthCF.filter((c) => c.category === "Pitaniya");
  const NAMED_EXPENSE_CATEGORIES = ["Ta'minotchiga to'lov", "Usta xizmat haqi", "Hujjat xarajati", "Ish haqi", "Rahbarga chiqim", "Logistika", "Pitaniya"];
  const otherExpenseEntries = monthCF.filter((c) => c.type === "chiqim" && !NAMED_EXPENSE_CATEGORIES.includes(c.category));

  const supplierPay = supplierEntries.reduce((s, c) => s + num(c.amountSum), 0);
  const ustaPay = ustaEntries.reduce((s, c) => s + num(c.amountSum), 0);
  const docFeePay = docFeeEntries.reduce((s, c) => s + num(c.amountSum), 0);
  const employeePay = employeeEntries.reduce((s, c) => s + num(c.amountSum), 0);
  const rahbarPay = rahbarEntries.reduce((s, c) => s + num(c.amountSum), 0);
  const logistikaPay = logistikaEntries.reduce((s, c) => s + num(c.amountSum), 0);
  const pitaniyaPay = pitaniyaEntries.reduce((s, c) => s + num(c.amountSum), 0);
  const otherExpense = otherExpenseEntries.reduce((s, c) => s + num(c.amountSum), 0);

  // MUHIM: "Rahbarga chiqim" — bu rahbarning ALLAQACHON topilgan foydadan shaxsan
  // olgan puli, biznes xarajati emas (ijaraga, ta'minotchiga to'lov kabi emas).
  // Shuning uchun u "Sof foyda"ni HISOBLASHDA emas — undan keyin, alohida
  // "qancha olindi" sifatida ko'rsatiladi. Aks holda rahbar o'z puliga tegishi
  // biznesning haqiqiy foydasi kamaygandek ko'rsatib qo'yardi.
  const businessExpense = supplierPay + ustaPay + docFeePay + employeePay + logistikaPay + pitaniyaPay + otherExpense;
  const netProfit = monthIncome - businessExpense;
  const afterOwnerDraw = netProfit - rahbarPay;

  const months = [...new Set([currentMonthKey(), ...cf.map((c) => (c.date || "").slice(0, 7)).filter(Boolean)])].sort().reverse();

  // Har bir qatorga tegishli xom yozuvlar — bosilganda shular ro'yxati ochiladi.
  // "Boshqa xarajatlar" bir nechta toifani birlashtirgani uchun har bir yozuv
  // oldida o'z toifasi ham ko'rsatiladi (renderda ko'rinadi).
  const rows = [
    ["Jami kirim (naqd)", monthIncome, T.teal, false, monthIncomeEntries],
    ["Ta'minotchi to'lovlari", -supplierPay, T.red, false, supplierEntries],
    ["Usta xizmat haqi", -ustaPay, T.red, false, ustaEntries],
    ["Xodimlar oyligi", -employeePay, T.red, false, employeeEntries],
    ["Logistika", -logistikaPay, T.red, false, logistikaEntries],
    ["Pitaniya", -pitaniyaPay, T.red, false, pitaniyaEntries],
    ["Hujjat xarajatlari", -docFeePay, T.red, false, docFeeEntries],
    ["Boshqa xarajatlar", -otherExpense, T.red, false, otherExpenseEntries],
    ["SOF FOYDA (biznes)", netProfit, netProfit >= 0 ? T.teal : T.red, true, null],
    ["— shundan Rahbar oldi", -rahbarPay, T.gold, false, rahbarEntries],
    ["Qolgan foyda", afterOwnerDraw, afterOwnerDraw >= 0 ? T.teal : T.red, true, null],
  ];

  return (
    <Card
      title="Rahbar oylik hisoboti"
      action={
        <Sel value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
          style={{ width: 150 }}
          options={months.map((m) => ({ value: m, label: m }))} />
      }
    >
      <div style={{ display: "grid", gap: 2 }}>
        {rows.map(([label, val, color, isBold, entries]) => {
          const isMixed = label === "Boshqa xarajatlar";
          const isOpenable = !!entries;
          const isOpen = openRows.has(label);
          const sorted = entries ? [...entries].sort((a, b) => num(b.amountSum) - num(a.amountSum)) : [];
          return (
            <React.Fragment key={label}>
              <div
                onClick={isOpenable ? () => toggleRow(label) : undefined}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: isBold ? "14px 14px" : "9px 14px",
                  marginTop: isBold ? 8 : 0,
                  borderRadius: 8,
                  background: isBold ? T.flameD : "transparent",
                  borderTop: isBold ? `2px solid ${T.flame}` : "none",
                  cursor: isOpenable ? "pointer" : "default",
                }}
                className={isOpenable ? "rh" : ""}
              >
                <span style={{
                  fontSize: isBold ? 14 : 12.5, fontWeight: isBold ? 800 : 400, color: isBold ? T.text : T.muted,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  {label}
                  {isOpenable && entries.length > 0 && (
                    <ChevronDown size={12} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                  )}
                </span>
                <span className="mo" style={{ fontSize: isBold ? 18 : 13, fontWeight: isBold ? 800 : 600, color }}>
                  {val < 0 ? "−" : ""}{fmtSum(Math.abs(val))}
                </span>
              </div>
              {isOpenable && isOpen && (
                <div style={{ padding: "2px 14px 10px 26px", display: "grid", gap: 5 }} className="fi">
                  {sorted.length === 0 ? (
                    <div style={{ fontSize: 12, color: T.muted, padding: "6px 0" }}>Bu oyda yozuv yo'q</div>
                  ) : sorted.map((c) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                      <span style={{ color: T.muted2, minWidth: 0 }}>
                        <span className="mo" style={{ color: T.muted, marginRight: 7 }}>{c.date}</span>
                        {isMixed && <span style={{ color: T.gold }}>{c.category} · </span>}
                        {c.note || <span style={{ color: T.muted, fontStyle: "italic" }}>izohsiz</span>}
                      </span>
                      <span className="mo" style={{ color: c.type === "kirim" ? T.teal : T.red, fontWeight: 600, flexShrink: 0 }}>
                        {fmtSum(c.amountSum)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted2, marginBottom: 10 }}>
          Valyuta bo'yicha ajratilgan (naqd kassa harakati)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: T.tealD, borderRadius: 9, padding: "10px 13px" }}>
            <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>KIRIM</div>
            <div className="mo" style={{ fontSize: 13, fontWeight: 700, color: T.teal }}>{fmtSum(monthIncomeSUM)} <span style={{ fontWeight: 400, color: T.muted }}>so'mda</span></div>
            <div className="mo" style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginTop: 2 }}>{fmtUsd(monthIncomeUSDRaw)} <span style={{ fontWeight: 400, color: T.muted }}>dollarda ({fmtSum(monthIncomeUSDAsSum)})</span></div>
          </div>
          <div style={{ background: T.redD, borderRadius: 9, padding: "10px 13px" }}>
            <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>CHIQIM</div>
            <div className="mo" style={{ fontSize: 13, fontWeight: 700, color: T.red }}>{fmtSum(monthExpenseSUM)} <span style={{ fontWeight: 400, color: T.muted }}>so'mda</span></div>
            <div className="mo" style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginTop: 2 }}>{fmtUsd(monthExpenseUSDRaw)} <span style={{ fontWeight: 400, color: T.muted }}>dollarda ({fmtSum(monthExpenseUSDAsSum)})</span></div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11, color: T.muted, marginTop: 14, textAlign: "center" }}>
        USD ekvivalenti: {fmtUsd(netProfit / rate)} · Click/Payme va Nasiya bu hisobga kirmaydi (alohida kuzatiladi)
      </p>
    </Card>
  );
}

function KpiEditCard({ value, history, onAdd }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const total = (history || []).reduce((s, h) => s + num(h.amount), 0);

  if (editing) return (
    <div style={{ background: T.s1, border: `1px solid ${T.flame}60`, borderRadius: 12, padding: "15px 17px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 8, textTransform: "uppercase" }}>Azim Avazovich — KPI qo'shish</div>
      <input autoFocus type="number" style={{ ...iSt, marginBottom: 8 }} placeholder="Summa" value={val} onChange={(e) => setVal(e.target.value)} />
      <input style={{ ...iSt, marginBottom: 8 }} placeholder="Sababi (masalan: sentabr sotuvi uchun bonus)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <Btn size="sm" disabled={!num(val) || !reason.trim()} onClick={() => {
          onAdd(num(val), reason.trim());
          setVal(""); setReason(""); setEditing(false);
        }}>✓ Qo'shish</Btn>
        <Btn size="sm" variant="ghost" onClick={() => { setEditing(false); setVal(""); setReason(""); }}>Bekor</Btn>
      </div>
    </div>
  );
  return (
    <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "15px 17px", borderTop: `2px solid ${T.gold}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 8, textTransform: "uppercase" }}>Azim Avazovich KPI</div>
        {(history || []).length > 0 && (
          <button onClick={() => setShowHistory((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 10 }}>
            {showHistory ? "Yopish" : "Tarix"}
          </button>
        )}
      </div>
      <div className="mo bc" style={{ fontSize: 19, fontWeight: 700, color: T.gold }} onClick={() => setEditing(true)}>{fmtSum(total || value)}</div>
      <div onClick={() => setEditing(true)} style={{ fontSize: 10.5, color: T.muted, marginTop: 4, cursor: "pointer" }}>+ Yangi KPI qo'shish</div>
      {showHistory && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}`, display: "grid", gap: 5 }}>
          {(history || []).slice().reverse().map((h) => (
            <div key={h.id} style={{ fontSize: 10.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: T.muted }}>{fmtDate(h.date)}</span>
                <span className="mo" style={{ color: T.gold, fontWeight: 600 }}>{fmtSum(h.amount)}</span>
              </div>
              <div style={{ color: T.muted2 }}>{h.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
