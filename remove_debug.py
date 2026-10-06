FILE = "app/AvtogazApp.jsx"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''              {" "}[DEBUG role=&quot;{String(role)}&quot; tabs={tabs.map(t=>t.id).join(",")}]
            </div>
          </div>'''

NEW = '''            </div>
          </div>'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: debug matni olib tashlandi")
else:
    print("[XATO] Mos kelmadi")
