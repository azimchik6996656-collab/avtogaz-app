import shutil

FILE = "app/AvtogazApp.jsx"
shutil.copy(FILE, FILE + ".v61backup")
print("[OK] Backup: " + FILE + ".v61backup")

c = open(FILE, "rb").read().decode("utf-8")

OLD = '''      {(data.stockOuts || []).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card title={`Chiqim tarixi \u2014 Insider servis (${data.stockOuts.length})`} pad={false}>
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
      )}'''

NEW = '''      {(data.stockOuts || []).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card title={`Sklad chiqim tarixi \u2014 barcha chiqimlar (${data.stockOuts.length})`} pad={false}>
            <div style={{ padding: "14px 18px" }}>
              <DateGroupedList
                empty="Chiqim yo'q"
                amountFn={(r) => -num(r.amountSum)}
                cols={[
                  { k: "time", h: "Vaqt", r: (r) => <span className="mo" style={{ fontSize: 12, color: T.muted }}>{r.time || "\u2014"}</span> },
                  { k: "productName", h: "Mahsulot" },
                  { k: "qty", h: "Miqdor", r: (r) => <span className="mo">{r.qty}</span> },
                  { k: "dest", h: "Qayerga", r: (r) => r.partnerName
                      ? <span style={{ fontWeight: 600 }}>{r.partnerName}</span>
                      : r.plate
                      ? <span style={{ fontWeight: 600, color: T.flame }} className="mo">{r.plate}</span>
                      : <span style={{ color: T.muted }}>\u2014</span> },
                  { k: "amountSum", h: "Qiymati", r: (r) => num(r.amountSum) > 0 ? <span style={{ color: T.purple, fontWeight: 600 }}>{fmtSum(r.amountSum)}</span> : <span style={{ color: T.muted }}>\u2014</span> },
                  { k: "reason", h: "Sabab", r: (r) => <span style={{ color: T.muted, fontSize: 12 }}>{r.reason || "Insider servis"}</span> },
                ]}
                rows={data.stockOuts}
              />
            </div>
          </Card>
        </div>
      )}'''

if OLD in c:
    c = c.replace(OLD, NEW)
    open(FILE, "w", encoding="utf-8").write(c)
    print("[OK] PATCH: Sklad chiqim jadvaliga vaqt ustuni va universal 'Qayerga' ustuni qo'shildi")
else:
    print("[WARN] Aniq mos kelmadi - qo'lda tekshiring")
    # Diagnostika
    idx = c.find("Chiqim tarixi")
    if idx > -1:
        print("Haqiqiy matn (600 belgi):")
        print(repr(c[idx-30:idx+600]))
