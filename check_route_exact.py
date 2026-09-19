with open("app/api/daily-report/route.js", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("JSON.parse(staffData.data)")
print(repr(c[idx-20:idx+250]))
