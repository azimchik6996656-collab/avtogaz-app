FILE = "app/api/daily-report/route.js"

with open(FILE, "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

OLD = '''    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }'''

NEW = '''    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // VAQTINCHA DEBUG — muammo topilgach olib tashlanadi
      return new Response(JSON.stringify({
        error: "Unauthorized",
        debug: {
          receivedHeader: authHeader || "(bo'sh)",
          receivedHeaderLength: (authHeader || "").length,
          expectedSecretLength: cronSecret.length,
          expectedSecretFirst4: cronSecret.slice(0, 4),
          expectedSecretLast4: cronSecret.slice(-4),
        }
      }), { status: 401, headers: { "Content-Type": "application/json" } });
    }'''

if OLD in c:
    c = c.replace(OLD, NEW)
    with open(FILE, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(c)
    print("[OK] Debug qo'shildi")
else:
    print("[XATO] Mos kelmadi, joriy holat:")
    idx = c.find("Unauthorized")
    print(repr(c[max(0,idx-300):idx+200]))
