FILE = "app/AvtogazApp.jsx"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''            cols={[
              { k: "type", h: "Turi", r: (r) => <Badge color={r.type === "kirim" ? T.teal : T.red}>{r.type === "kirim" ? "Kirim" : "Chiqim"}</Badge> },
              { k: "paymentType", h: "To'lov", r: (r) => {
                  if (r.paymentType === "Karta (Click/Payme)") return <Badge color={T.purple}>Click</Badge>;
                  if (r.paymentType === "Nasiya (qarzga)") return <Badge color={T.gold}>Nasiya</Badge>;
                  return <span style={{ fontSize: 11, color: T.muted }}>{r.paymentType || "Naqd"}</span>;
                } },
              { k: "category", h: "Turkum" },'''

NEW = '''            cols={[
              { k: "time", h: "Vaqt", r: (r) => <span className="mo" style={{ fontSize: 11, color: T.muted }}>{r.time || "\u2014"}</span> },
              { k: "type", h: "Turi", r: (r) => <Badge color={r.type === "kirim" ? T.teal : T.red}>{r.type === "kirim" ? "Kirim" : "Chiqim"}</Badge> },
              { k: "paymentType", h: "To'lov", r: (r) => {
                  if (r.paymentType === "Karta (Click/Payme)") return <Badge color={T.purple}>Click</Badge>;
                  if (r.paymentType === "Nasiya (qarzga)") return <Badge color={T.gold}>Nasiya</Badge>;
                  return <span style={{ fontSize: 11, color: T.muted }}>{r.paymentType || "Naqd"}</span>;
                } },
              { k: "category", h: "Turkum" },'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: Kassa jadvaliga 'Vaqt' ustuni qo'shildi")
else:
    print("[XATO] Mos kelmadi")
