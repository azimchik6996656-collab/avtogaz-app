FILE = "app/AvtogazApp.jsx"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''                : ROLE_LABELS[role]?.toUpperCase() || "—")} · {fmtDate(todayISO())}
            </div>
          </div>'''

NEW = '''                : ROLE_LABELS[role]?.toUpperCase() || "—")} · {fmtDate(todayISO())}
              {" "}[DEBUG role=&quot;{String(role)}&quot;]
            </div>
          </div>'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] Debug qo'shildi")
else:
    print("[XATO] Mos kelmadi")
