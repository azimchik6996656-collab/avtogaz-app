with open("app/api/login/route.js", "r", encoding="utf-8-sig", errors="ignore") as f:
    c = f.read()

idx = c.find("STORAGE_KEY")
print(c[max(0,idx-100):idx+300])
