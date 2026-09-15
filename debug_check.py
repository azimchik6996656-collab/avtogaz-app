with open("lib/authClient.js", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("SUPABASE_URL")
print(repr(c[idx-20:idx+400]))
