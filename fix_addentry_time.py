FILE = "app/AvtogazApp.jsx"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''      const { debtSettle, ...rest } = entry;
      d.cashflow.unshift({
        id: uid(),
        ...rest,
        note: ((rest.note || "") + noteExtra).trim(),
        debtSettleKind: debtSettle?.kind || undefined,
        debtSettleId: debtSettle?.id || undefined,
      });'''

NEW = '''      const { debtSettle, ...rest } = entry;
      d.cashflow.unshift({
        id: uid(),
        time: rest.time || nowTime(),
        ...rest,
        note: ((rest.note || "") + noteExtra).trim(),
        debtSettleKind: debtSettle?.kind || undefined,
        debtSettleId: debtSettle?.id || undefined,
      });'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: addEntry funksiyasiga vaqt qo'shildi (bu eng ko'p ishlatiladigan joy)")
else:
    print("[XATO] Mos kelmadi")
