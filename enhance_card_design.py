FILE = "app/AvtogazApp.jsx"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''              <div key={c.id} className="ch" onClick={() => setWorkCard(c)} style={{
                background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12,
                cursor: "pointer", overflow: "hidden", transition: "all .15s",
                borderLeft: `3px solid ${SERVICE_COLORS[c.serviceType] || T.flame}`,
              }}>
                <div style={{ padding: "13px 15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div className="mo" style={{ fontSize: 15, fontWeight: 700, color: T.flame }}>{c.plate}</div>
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{c.carModel || "—"}</div>
                    </div>'''

NEW = '''              <div key={c.id} className="ch" onClick={() => setWorkCard(c)} style={{
                background: T.s1, border: `1px solid ${T.border}`, borderRadius: 14,
                cursor: "pointer", overflow: "hidden", transition: "all .15s",
                borderLeft: `3px solid ${SERVICE_COLORS[c.serviceType] || T.flame}`,
                boxShadow: T.sh1,
              }}>
                <div style={{ padding: "13px 15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div className="mo" style={{
                        fontSize: 14, fontWeight: 700, color: T.flame,
                        display: "inline-block", padding: "3px 9px", borderRadius: 7,
                        background: T.flameD, letterSpacing: ".02em",
                      }}>{c.plate}</div>
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 5 }}>{c.carModel || "—"}</div>
                    </div>'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: Ochiq kartalarga soya (statik) va plate 'chip' dizayni qo'shildi")
else:
    print("[XATO] Mos kelmadi")
