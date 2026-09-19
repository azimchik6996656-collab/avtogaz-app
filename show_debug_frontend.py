FILE = "app/AvtogazApp.jsx"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''      } else {
        setTestStatus("❌ Xato: " + (result.error || "Noma'lum xato"));
      }'''

NEW = '''      } else {
        const dbg = result.debug ? ` | Header uzunligi: ${result.debug.receivedHeaderLength}, Kutilgan uzunlik: ${result.debug.expectedSecretLength}, Header: "${result.debug.receivedHeader}", Kutilgan boshi/oxiri: ${result.debug.expectedSecretFirst4}...${result.debug.expectedSecretLast4}` : "";
        setTestStatus("❌ Xato: " + (result.error || "Noma'lum xato") + dbg);
      }'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] Frontend debug ko'rsatish qo'shildi")
else:
    print("[XATO] Mos kelmadi")
    idx = c.find("Noma'lum xato")
    print(repr(c[max(0,idx-200):idx+100]) if idx > -1 else "umuman topilmadi")
