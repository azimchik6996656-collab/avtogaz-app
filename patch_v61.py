import re, shutil, sys
from pathlib import Path

FILE = Path("app/AvtogazApp.jsx")
if not FILE.exists():
    print("[ERR] app/AvtogazApp.jsx topilmadi!")
    sys.exit(1)

shutil.copy(FILE, FILE.with_suffix(".jsx.v60backup"))
print("[OK] Backup yaratildi: app/AvtogazApp.jsx.v60backup")

content = FILE.read_text(encoding="utf-8")

# ─── PATCH 1: shiftMinutes — pauza vaqtini ayirish ───
OLD1 = """function shiftMinutes(s) {
  if (!s.clockIn) return 0;
  const [h1, m1] = s.clockIn.split(":").map(Number);
  const end = s.clockOut || nowTime();
  const [h2, m2] = end.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // yarim tundan o'tgan smena
  return mins;
}"""

NEW1 = """function shiftMinutes(s) {
  if (!s.clockIn) return 0;
  const [h1, m1] = s.clockIn.split(":").map(Number);
  const end = s.clockOut || nowTime();
  const [h2, m2] = end.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  const pauses = s.pauses || [];
  const pauseMins = pauses.filter((p) => p.end).reduce((sum, p) => {
    const [ph1, pm1] = p.start.split(":").map(Number);
    const [ph2, pm2] = p.end.split(":").map(Number);
    return sum + Math.max(0, (ph2 * 60 + pm2) - (ph1 * 60 + pm1));
  }, 0);
  return Math.max(0, mins - pauseMins);
}"""

if OLD1 in content:
    content = content.replace(OLD1, NEW1)
    print("[OK] PATCH 1: shiftMinutes pauza hisobi")
else:
    print("[WARN] PATCH 1: topilmadi")

# ─── PATCH 2: clockIn/clockOut/pause funksiyalari ───
OLD2 = """  function clockIn() {
    patch((d) => {
      d.shifts = d.shifts || [];
      d.shifts.unshift({ id: uid(), role, name: myName, date: todayISO(), clockIn: nowTime(), clockOut: null });
      return d;
    });
  }
  function clockOut(id) {
    patch((d) => {
      const s = (d.shifts || []).find((x) => x.id === id);
      if (s && !s.clockOut) s.clockOut = nowTime();
      return d;
    });
  }"""

NEW2 = """  function clockIn() {
    patch((d) => {
      d.shifts = d.shifts || [];
      d.shifts.unshift({ id: uid(), role, name: myName, date: todayISO(), clockIn: nowTime(), clockOut: null, pauses: [] });
      return d;
    });
  }
  function clockOut(id) {
    patch((d) => {
      const s = (d.shifts || []).find((x) => x.id === id);
      if (s && !s.clockOut) {
        if (s.pauses && s.pauses.length > 0) {
          const lp = s.pauses[s.pauses.length - 1];
          if (lp && !lp.end) lp.end = nowTime();
        }
        s.clockOut = nowTime();
      }
      return d;
    });
  }
  function pauseStart(id) {
    patch((d) => {
      const s = (d.shifts || []).find((x) => x.id === id);
      if (s && !s.clockOut) {
        s.pauses = s.pauses || [];
        if (!s.pauses.some((p) => !p.end)) s.pauses.push({ start: nowTime(), end: null });
      }
      return d;
    });
  }
  function pauseEnd(id) {
    patch((d) => {
      const s = (d.shifts || []).find((x) => x.id === id);
      if (s) { s.pauses = s.pauses || []; const p = s.pauses.find((x) => !x.end); if (p) p.end = nowTime(); }
      return d;
    });
  }"""

if OLD2 in content:
    content = content.replace(OLD2, NEW2)
    print("[OK] PATCH 2: clockIn/clockOut/pauseStart/pauseEnd")
else:
    print("[WARN] PATCH 2: clockIn/clockOut topilmadi")

# ─── PATCH 3: Pauza tugmasi UI ───
OLD3 = """              <Btn onClick={() => clockOut(myOpenShift.id)} style={{ background: T.red }}>Ish tugadi</Btn>"""

NEW3 = """              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(() => {
                  const pauses = myOpenShift.pauses || [];
                  const onPause = pauses.some((p) => !p.end);
                  const pauseMins = pauses.filter((p) => p.end).reduce((s, p) => {
                    const [h1,m1] = p.start.split(":").map(Number);
                    const [h2,m2] = p.end.split(":").map(Number);
                    return s + Math.max(0, (h2*60+m2)-(h1*60+m1));
                  }, 0);
                  return (<>
                    {pauseMins > 0 && <span style={{ fontSize: 12, color: T.muted, alignSelf: "center" }}>Pauza: {fmtDuration(pauseMins)}</span>}
                    {onPause
                      ? <Btn onClick={() => pauseEnd(myOpenShift.id)} style={{ background: T.teal }}>Davom etish</Btn>
                      : <Btn onClick={() => pauseStart(myOpenShift.id)} style={{ background: T.gold }}>Pauza</Btn>
                    }
                  </>);
                })()}
                <Btn onClick={() => clockOut(myOpenShift.id)} style={{ background: T.red }}>Ish tugadi</Btn>
              </div>"""

if OLD3 in content:
    content = content.replace(OLD3, NEW3)
    print("[OK] PATCH 3: Pauza tugmasi UI")
else:
    print("[WARN] PATCH 3: Pauza tugmasi joyi topilmadi")

# ─── PATCH 4: addClaim — kassaga yozmaslik ───
OLD4 = """      // Almashtirilib beriladigan mahsulotning haqiqiy tan narxi — mijozdan pul
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
      }"""

NEW4 = """      // Bir nechta mahsulot — har biri uchun sklad ayirish (kassaga YOZILMAYDI)
      const items = claim.items || [{ productId: claim.replacementProductId, productName: claim.replacementName, qty: claim.qty }];
      items.forEach((item) => {
        const prod = d.products.find((p) => p.id === item.productId);
        if (prod) prod.qty = Math.max(0, num(prod.qty) - num(item.qty));
        d.stockOuts = d.stockOuts || [];
        d.stockOuts.unshift({
          id: uid(), date: todayISO(), time: nowTime(),
          productId: item.productId, productName: item.productName || prod?.name || "",
          qty: num(item.qty), amountSum: 0,
          reason: "Kafolat almashtirish", plate: claim.plate,
        });
      });
      d.brokenItems = d.brokenItems || [];
      d.brokenItems.push({ id: uid(), date: todayISO(), name: claim.brokenProduct, qty: claim.qty, fromPlate: claim.plate, status: "Tekshirilmoqda" });
      d.warrantyClaims.unshift({ id: uid(), ...claim });
      // Faqat usta haqi bo'lsa kassaga yoziladi
      if (claim.ustaFeeCharged > 0) {
        d.cashflow.unshift({ id: uid(), date: todayISO(), type: "kirim", category: "Xizmat to'lovi", currency: "SUM", amount: claim.ustaFeeCharged, amountSum: claim.ustaFeeCharged, amountUsd: 0, note: `Kafolat — usta haqi — ${claim.plate}` });
      }"""

if OLD4 in content:
    content = content.replace(OLD4, NEW4)
    print("[OK] PATCH 4: addClaim kassasiz + ko'p mahsulot")
else:
    print("[WARN] PATCH 4: addClaim ichki kod topilmadi")

# ─── PATCH 5: WarrantyClaimModal — ko'p mahsulot UI ───
OLD5 = """  const [replId, setReplId] = useState(products[0]?.id || "");
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
  );"""

NEW5 = """  const [items, setItems] = useState([{ productId: products[0]?.id || "", qty: 1 }]);
  const [chargeUsta, setChargeUsta] = useState(false);
  const [ustaFee, setUstaFee] = useState(0);
  const [docConfirmed, setDocConfirmed] = useState(false);

  function setItem(i, key, val) { setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it)); }
  function addItem() { setItems((prev) => [...prev, { productId: products[0]?.id || "", qty: 1 }]); }
  function removeItem(i) { if (items.length > 1) setItems((prev) => prev.filter((_, idx) => idx !== i)); }
  const canSave = brokenProduct.trim() && items.every((it) => it.productId && num(it.qty) > 0);

  return (
    <Modal title={`Kafolat almashtirish — ${card.plate}`} onClose={onClose} wide>
      <F label="Brak mahsulot (nima buzilgan)">
        <input style={iSt} value={brokenProduct} onChange={(e) => setBrokenProduct(e.target.value)} placeholder="Masalan: Gaz balloni, regulyator..." />
      </F>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 8 }}>
          O'RNIGA BERILADIGAN
          <span style={{ fontSize: 11, fontWeight: 400, color: T.muted2, marginLeft: 6 }}>faqat skladdan ayiriladi — kassaga ta'sir qilmaydi</span>
        </div>
        {items.map((it, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 32px", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <F label={i === 0 ? "Mahsulot" : ""}>
              <Sel value={it.productId} onChange={(e) => setItem(i, "productId", e.target.value)}
                options={products.map((p) => ({ value: p.id, label: p.name + " (" + p.qty + " ta)" }))} />
            </F>
            <F label={i === 0 ? "Miqdor" : ""}>
              <input type="number" min="1" style={iSt} value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
            </F>
            <button onClick={() => removeItem(i)}
              style={{ height: 36, marginTop: i === 0 ? 18 : 0, background: "none", border: "1px solid " + T.border, borderRadius: 6, cursor: "pointer", color: T.red }}>
              x
            </button>
          </div>
        ))}
        <button onClick={addItem}
          style={{ fontSize: 12, color: T.blue, background: "none", border: "1px dashed " + T.blue, borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
          + Yana mahsulot
        </button>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer", fontSize: 13 }}>
        <input type="checkbox" checked={docConfirmed} onChange={(e) => setDocConfirmed(e.target.checked)} style={{ accentColor: T.teal }} />
        Kafolat hujjati ko\'rsatildi
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer", fontSize: 13 }}>
        <input type="checkbox" checked={chargeUsta} onChange={(e) => setChargeUsta(e.target.checked)} style={{ accentColor: T.flame }} />
        Usta xizmat haqi olinsin
      </label>
      {chargeUsta && <F label="Summa"><input type="number" style={iSt} value={ustaFee} onChange={(e) => setUstaFee(e.target.value)} /></F>}
      <SaveBtn disabled={!canSave} onClick={() => {
        const enriched = items.map((it) => { const p = products.find((x) => x.id === it.productId); return { productId: it.productId, productName: p?.name || "", qty: num(it.qty) }; });
        onSave({ date: todayISO(), plate: card.plate, brokenProduct: brokenProduct.trim(), items: enriched, replacementProductId: enriched[0]?.productId, replacementName: enriched.map((it) => it.productName + " x" + it.qty).join(", "), qty: enriched.reduce((s, it) => s + it.qty, 0), ustaFeeCharged: chargeUsta ? num(ustaFee) : 0, docConfirmed });
      }}>Saqlash</SaveBtn>
    </Modal>
  );"""

if OLD5 in content:
    content = content.replace(OLD5, NEW5)
    print("[OK] PATCH 5: WarrantyClaimModal ko'p mahsulot UI")
else:
    print("[WARN] PATCH 5: WarrantyClaimModal ichki kod topilmadi")

FILE.write_text(content, encoding="utf-8")
print("\n[OK] Fayl saqlandi!")

# Tekshirish
c = FILE.read_text(encoding="utf-8")
checks = [
    ("Pauza vaqti hisobi",        "pauseMins" in c),
    ("pauseStart/pauseEnd",        "pauseStart" in c),
    ("Pauza tugmasi UI",           "Davom etish" in c),
    ("Kassasiz kafolat",           "kassaga ta'sir qilmaydi" in c),
    ("Ko'p mahsulot UI",           "Yana mahsulot" in c),
]
print("\n=== NATIJA ===")
for name, ok in checks:
    status = "OK" if ok else "XATO"
    sym = "+" if ok else "!"
    print(f"  [{sym}] {name}: {status}")

all_ok = all(ok for _, ok in checks)
if all_ok:
    print("\n  Barcha patchlar muvaffaqiyatli! Deploy qiling:")
    print("  git add . && git commit -m 'feat: v61 kafolat+pauza' && git push")
else:
    print("\n  Ba'zi patchlar topilmadi. Backup: app/AvtogazApp.jsx.v60backup")
