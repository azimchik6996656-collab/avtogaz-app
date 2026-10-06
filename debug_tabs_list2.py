FILE = "app/AvtogazApp.jsx"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''              {" "}[DEBUG role=&quot;{String(role)}&quot;]
            </div>
          </div>'''

NEW = '''              {" "}[DEBUG role=&quot;{String(role)}&quot; tabs={tabs.map(t=>t.id).join(",")}]
            </div>
          </div>'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] Tabs debug qo'shildi")
else:
    print("[XATO] Mos kelmadi")
    idx = c.find('[DEBUG role')
    print(repr(c[max(0,idx-50):idx+200]) if idx > -1 else "topilmadi")
