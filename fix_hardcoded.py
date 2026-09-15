import shutil

FILE = "lib/authClient.js"
shutil.copy(FILE, FILE + ".hardcoded_backup")
print("[OK] Backup:", FILE + ".hardcoded_backup")

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''const SUPABASE_URL = "https://supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrcmpib3BxeWFtc2F1bm95ZHJ2YSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzg4MzU2MTkyLCJleHAiOjIxMDM5MzIxOTJ9.e6dW-Qarz9suNw0vSMg3H3ERNLE1IIyT5T1hCuCogFk";


const supabase =
  SUPABASE_URL && SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON) : null;'''

NEW = '''const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON) : null;'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] TUZATILDI: hardcoded noto'g'ri qiymatlar olib tashlandi, env var'ga qaytarildi")
else:
    print("[XATO] Hali ham mos kelmadi, aniq matn kerak")
    idx = c.find("SUPABASE_URL")
    print(repr(c[idx-20:idx+500]))
