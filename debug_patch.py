import shutil

FILE = "lib/authClient.js"
shutil.copy(FILE, FILE + ".debugbackup")
print("[OK] Backup:", FILE + ".debugbackup")

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON) : null;'''

NEW = '''const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// VAQTINCHA DEBUG — muammoni topgach olib tashlanadi
if (typeof window !== "undefined") {
  console.log("[DEBUG] SUPABASE_URL =", JSON.stringify(SUPABASE_URL));
  console.log("[DEBUG] SUPABASE_ANON (first 20) =", SUPABASE_ANON ? SUPABASE_ANON.slice(0, 20) + "..." : "YO'Q");
}

const supabase =
  SUPABASE_URL && SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON) : null;'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] Debug log qo'shildi")
else:
    print("[XATO] Mos kelmadi")
