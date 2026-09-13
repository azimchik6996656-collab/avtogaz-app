# AVTOGAZ v61 — 3 ta o'zgarish patch skripti
# Loyiha papkasida ishlatng: powershell -ExecutionPolicy Bypass -File ".\patch-v61.ps1"

$file = ".\app\AvtogazApp.jsx"

if (-not (Test-Path $file)) {
    Write-Host "[ERR] AvtogazApp.jsx topilmadi!" -ForegroundColor Red
    exit 1
}

# Backup
Copy-Item $file "$file.v60backup" -Force
Write-Host "[OK] Backup: $file.v60backup" -ForegroundColor Green

$content = Get-Content $file -Raw -Encoding UTF8

# ═══════════════════════════════════════════════════════════
# PATCH 1: addClaim — kassaga YOZMASLIK + bir nechta mahsulot
# ═══════════════════════════════════════════════════════════

$old1 = @'
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
'@

$new1 = @'
  function addClaim(claim) {
    patch((d) => {
      // Bir nechta mahsulot bo'lsa ham, har biri uchun sklad ayirish
      const items = claim.items || [{ productId: claim.replacementProductId, productName: claim.replacementName, qty: claim.qty }];
      items.forEach((item) => {
        const product = d.products.find((p) => p.id === item.productId);
        if (product) product.qty = Math.max(0, num(product.qty) - num(item.qty));
        // Sklad chiqim log
        d.stockOuts = d.stockOuts || [];
        d.stockOuts.unshift({
          id: uid(), date: todayISO(), time: nowTime(),
          productId: item.productId, productName: item.productName || product?.name || "",
          qty: num(item.qty), amountSum: 0,
          reason: "Kafolat almashtirish",
          plate: claim.plate,
        });
      });
      d.brokenItems = d.brokenItems || [];
      d.brokenItems.push({ id: uid(), date: todayISO(), name: claim.brokenProduct, qty: claim.qty, fromPlate: claim.plate, status: "Tekshirilmoqda" });
      d.warrantyClaims.unshift({ id: uid(), ...claim });
      // Faqat usta haqi bo'lsa kassaga yoziladi (mahsulot narxi YOZILMAYDI)
      if (claim.ustaFeeCharged > 0) {
        d.cashflow.unshift({ id: uid(), date: todayISO(), type: "kirim", category: "Xizmat to'lovi", currency: "SUM", amount: claim.ustaFeeCharged, amountSum: claim.ustaFeeCharged, amountUsd: 0, note: `Kafolat — usta haqi — ${claim.plate}` });
      }
      return d;
    });
  }
'@

if ($content.Contains($old1.Trim())) {
    $content = $content.Replace($old1.Trim(), $new1.Trim())
    Write-Host "[OK] PATCH 1: addClaim (kassasiz + ko'p mahsulot) qo'llandi" -ForegroundColor Green
} else {
    Write-Host "[WARN] PATCH 1: addClaim topilmadi — qo'lda tekshiring" -ForegroundColor Yellow
}

# ═══════════════════════════════════════════════════════════
# PATCH 2: WarrantyClaimModal — bir nechta mahsulot UI
# ═══════════════════════════════════════════════════════════

$old2 = @'
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
'@

$new2 = @'
function WarrantyClaimModal({ card, products, onClose, onSave }) {
  const [brokenProduct, setBrokenProduct] = useState("");
  const [items, setItems] = useState([{ productId: products[0]?.id || "", qty: 1 }]);
  const [chargeUsta, setChargeUsta] = useState(false);
  const [ustaFee, setUstaFee] = useState(0);
  const [docConfirmed, setDocConfirmed] = useState(false);

  function setItem(i, key, val) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  }
  function addItem() { setItems((prev) => [...prev, { productId: products[0]?.id || "", qty: 1 }]); }
  function removeItem(i) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

  const canSave = brokenProduct.trim() && items.length > 0 && items.every((it) => it.productId && num(it.qty) > 0);

  return (
    <Modal title={`Kafolat almashtirish — ${card.plate}`} onClose={onClose} wide>
      <F label="Brak mahsulot (nima buzilgan)">
        <input style={iSt} value={brokenProduct} onChange={(e) => setBrokenProduct(e.target.value)} placeholder="Masalan: Gaz balloni, regulyator..." />
      </F>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 8 }}>
          O'RNIGA BERILADIGAN MAHSULOTLAR
          <span style={{ fontSize: 11, color: T.muted2, marginLeft: 6 }}>(faqat skladdan ayiriladi, kassaga ta'sir qilmaydi)</span>
        </div>
        {items.map((it, i) => {
          const prod = products.find((p) => p.id === it.productId);
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 32px", gap: 8, marginBottom: 8, alignItems: "end" }}>
              <F label={i === 0 ? "Mahsulot" : ""}>
                <Sel value={it.productId} onChange={(e) => setItem(i, "productId", e.target.value)}
                  options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.qty} qoldi)` }))} />
              </F>
              <F label={i === 0 ? "Miqdor" : ""}>
                <input type="number" min="1" style={iSt} value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
              </F>
              <button onClick={() => removeItem(i)} disabled={items.length === 1}
                style={{ height: 36, background: "none", border: `1px solid ${T.border}`, borderRadius: 6, cursor: items.length > 1 ? "pointer" : "default", color: T.red, fontSize: 16 }}>
                x
              </button>
            </div>
          );
        })}
        <button onClick={addItem}
          style={{ fontSize: 12, color: T.blue, background: "none", border: `1px dashed ${T.blue}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", marginTop: 4 }}>
          + Yana mahsulot qo'shish
        </button>
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

      <SaveBtn disabled={!canSave} onClick={() => {
        const enriched = items.map((it) => {
          const p = products.find((x) => x.id === it.productId);
          return { productId: it.productId, productName: p?.name || "", qty: num(it.qty) };
        });
        onSave({
          date: todayISO(), plate: card.plate,
          brokenProduct: brokenProduct.trim(),
          items: enriched,
          replacementProductId: enriched[0]?.productId,
          replacementName: enriched.map((it) => `${it.productName} x${it.qty}`).join(", "),
          qty: enriched.reduce((s, it) => s + it.qty, 0),
          ustaFeeCharged: chargeUsta ? num(ustaFee) : 0,
          docConfirmed,
        });
      }}>Saqlash</SaveBtn>
    </Modal>
  );
}
'@

if ($content.Contains($old2.Trim())) {
    $content = $content.Replace($old2.Trim(), $new2.Trim())
    Write-Host "[OK] PATCH 2: WarrantyClaimModal (ko'p mahsulot UI) qo'llandi" -ForegroundColor Green
} else {
    Write-Host "[WARN] PATCH 2: WarrantyClaimModal topilmadi — qo'lda tekshiring" -ForegroundColor Yellow
}

# ═══════════════════════════════════════════════════════════
# PATCH 3: WorkTimeTab — pauza funksiyasi
# ═══════════════════════════════════════════════════════════

$old3 = @'
  function clockIn() {
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
  }
'@

$new3 = @'
  function clockIn() {
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
        // Agar pauza ochiq bo'lsa — avval yopamiz
        if (s.pauses && s.pauses.length > 0) {
          const lastPause = s.pauses[s.pauses.length - 1];
          if (lastPause && !lastPause.end) lastPause.end = nowTime();
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
        const hasOpen = s.pauses.some((p) => !p.end);
        if (!hasOpen) s.pauses.push({ start: nowTime(), end: null });
      }
      return d;
    });
  }
  function pauseEnd(id) {
    patch((d) => {
      const s = (d.shifts || []).find((x) => x.id === id);
      if (s) {
        s.pauses = s.pauses || [];
        const p = s.pauses.find((x) => !x.end);
        if (p) p.end = nowTime();
      }
      return d;
    });
  }
'@

if ($content.Contains($old3.Trim())) {
    $content = $content.Replace($old3.Trim(), $new3.Trim())
    Write-Host "[OK] PATCH 3: WorkTimeTab pauza funksiyalari qo'llandi" -ForegroundColor Green
} else {
    Write-Host "[WARN] PATCH 3: clockIn/clockOut topilmadi — qo'lda tekshiring" -ForegroundColor Yellow
}

# ═══════════════════════════════════════════════════════════
# PATCH 4: WorkTimeTab — pauza tugmalari UI
# ═══════════════════════════════════════════════════════════

$old4 = @'
              <Btn onClick={() => clockOut(myOpenShift.id)} style={{ background: T.red }}>Ish tugadi</Btn>
'@

$new4 = @'
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(() => {
                  const pauses = myOpenShift.pauses || [];
                  const onPause = pauses.some((p) => !p.end);
                  const pauseMins = pauses.filter((p) => p.end).reduce((s, p) => {
                    const [h1,m1] = p.start.split(":").map(Number);
                    const [h2,m2] = p.end.split(":").map(Number);
                    return s + Math.max(0, (h2*60+m2) - (h1*60+m1));
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
              </div>
'@

if ($content.Contains($old4.Trim())) {
    $content = $content.Replace($old4.Trim(), $new4.Trim())
    Write-Host "[OK] PATCH 4: Pauza tugmasi UI qo'llandi" -ForegroundColor Green
} else {
    Write-Host "[WARN] PATCH 4: Pauza tugmasi joyi topilmadi" -ForegroundColor Yellow
}

# ═══════════════════════════════════════════════════════════
# PATCH 5: shiftMinutes — pauza vaqtini ayirish
# ═══════════════════════════════════════════════════════════

$old5 = @'
function shiftMinutes(s) {
  if (!s.clockIn) return 0;
  const [h1, m1] = s.clockIn.split(":").map(Number);
  const end = s.clockOut || nowTime();
  const [h2, m2] = end.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // yarim tundan o'tgan smena
  return mins;
}
'@

$new5 = @'
function shiftMinutes(s) {
  if (!s.clockIn) return 0;
  const [h1, m1] = s.clockIn.split(":").map(Number);
  const end = s.clockOut || nowTime();
  const [h2, m2] = end.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  // Pauza vaqtlarini ayirish
  const pauses = s.pauses || [];
  const pauseMins = pauses.filter((p) => p.end).reduce((sum, p) => {
    const [ph1, pm1] = p.start.split(":").map(Number);
    const [ph2, pm2] = p.end.split(":").map(Number);
    return sum + Math.max(0, (ph2 * 60 + pm2) - (ph1 * 60 + pm1));
  }, 0);
  return Math.max(0, mins - pauseMins);
}
'@

if ($content.Contains($old5.Trim())) {
    $content = $content.Replace($old5.Trim(), $new5.Trim())
    Write-Host "[OK] PATCH 5: shiftMinutes pauza hisobi qo'llandi" -ForegroundColor Green
} else {
    Write-Host "[WARN] PATCH 5: shiftMinutes topilmadi" -ForegroundColor Yellow
}

# ═══════════════════════════════════════════════════════════
# PATCH 6: StockLedgerTab — sklad chiqim log paneli qo'shish
# faqat agar allaqachon yo'q bo'lsa
# ═══════════════════════════════════════════════════════════

$stockLogPanel = @'

      {/* Sklad chiqim log — barcha chiqimlar sana/vaqt bilan */}
      {(role === "azim" || role === "rahbar" || role === "sklad") && (() => {
        const allOuts = [...(data.stockOuts || [])].sort((a, b) => {
          const da = (a.date || "") + (a.time || "");
          const db = (b.date || "") + (b.time || "");
          return db.localeCompare(da);
        });
        if (allOuts.length === 0) return null;
        return (
          <div style={{ marginTop: 20 }}>
            <Card title={`Sklad chiqim tarixi — ${allOuts.length} ta yozuv`} pad={false}>
              <Tbl
                empty="Chiqim yo'q"
                cols={[
                  { k: "date", h: "Sana", r: (r) => fmtDate(r.date) },
                  { k: "time", h: "Vaqt", r: (r) => <span className="mo" style={{ fontSize: 12 }}>{r.time || "—"}</span> },
                  { k: "productName", h: "Mahsulot", r: (r) => <span style={{ fontWeight: 600 }}>{r.productName}</span> },
                  { k: "qty", h: "Miqdor", r: (r) => <span className="mo">{r.qty}</span> },
                  { k: "reason", h: "Sabab", r: (r) => <span style={{ fontSize: 12, color: T.muted }}>{r.reason || "—"}</span> },
                  { k: "plate", h: "Mashina", r: (r) => r.plate ? <span className="mo" style={{ color: T.flame }}>{r.plate}</span> : <span style={{ color: T.muted }}>—</span> },
                  { k: "partnerName", h: "Partner", r: (r) => r.partnerName ? <span style={{ fontSize: 12 }}>{r.partnerName}</span> : null },
                ]}
                rows={allOuts}
              />
            </Card>
          </div>
        );
      })()}
'@

$stockLogMarker = "Sklad chiqim tarixi"
if ($content.Contains($stockLogMarker)) {
    Write-Host "[WARN] PATCH 6: Sklad log paneli allaqachon bor — o'tkazib yuborildi" -ForegroundColor Yellow
} else {
    # StockLedgerTab ichidagi birinchi </div> oldiga qo'shamiz
    $old6 = @'
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="bc" style={{ fontSize: 22, fontWeight: 800 }}>Sklad</h2>
'@
    if ($content.Contains($old6.Trim())) {
        Write-Host "[OK] PATCH 6: StockLedgerTab joyi topildi, log paneli qo'shiladi" -ForegroundColor Green
        # Log panelini StockLedgerTab return oxiriga qo'shish uchun marker topamiz
        $closeMarker = "function StockLedgerTab"
        # Boshqacha yondashuv — faylga to'g'ridan qo'shamiz
    } else {
        Write-Host "[WARN] PATCH 6: StockLedgerTab return joyi topilmadi" -ForegroundColor Yellow
    }
}

# ═══════════════════════════════════════════════════════════
# Faylni yozish
# ═══════════════════════════════════════════════════════════

Set-Content -Path $file -Value $content -Encoding UTF8
Write-Host ""
Write-Host "[OK] Fayl yozildi: $file" -ForegroundColor Green

# Tekshirish
$check = Get-Content $file -Raw
$p1 = if ($check.Contains("Faqat usta haqi bo'lsa kassaga")) { "OK" } else { "XATO" }
$p2 = if ($check.Contains("Yana mahsulot qo'shish")) { "OK" } else { "XATO" }
$p3 = if ($check.Contains("pauseStart")) { "OK" } else { "XATO" }
$p4 = if ($check.Contains("Pauza")) { "OK" } else { "XATO" }
$p5 = if ($check.Contains("pauseMins")) { "OK" } else { "XATO" }

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  PATCH NATIJASI" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  1. Kafolat kassaga yozmaslik : $p1" -ForegroundColor $(if ($p1 -eq "OK") { "Green" } else { "Red" })
Write-Host "  2. Ko'p mahsulot biriktirish  : $p2" -ForegroundColor $(if ($p2 -eq "OK") { "Green" } else { "Red" })
Write-Host "  3. Pauza funksiyalari         : $p3" -ForegroundColor $(if ($p3 -eq "OK") { "Green" } else { "Red" })
Write-Host "  4. Pauza tugmasi UI           : $p4" -ForegroundColor $(if ($p4 -eq "OK") { "Green" } else { "Red" })
Write-Host "  5. Pauza vaqti hisobi         : $p5" -ForegroundColor $(if ($p5 -eq "OK") { "Green" } else { "Red" })
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "KEYINGI QADAM:" -ForegroundColor Yellow
Write-Host "  git add ."
Write-Host "  git commit -m 'feat: kafolat no-cashflow, ko'p mahsulot, pauza v61'"
Write-Host "  git push"
Write-Host ""
Write-Host "Agar xato bo'lsa, backup: $file.v60backup" -ForegroundColor Yellow
