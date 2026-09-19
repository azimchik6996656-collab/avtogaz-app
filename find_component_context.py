with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("{rahbar && <DailyReportSettings")
# Shu joydan orqaga qarab eng yaqin "function XxxTab(" ni topamiz
before = c[:idx]
last_func = before.rfind("\nfunction ")
print("=== Komponent nomi va parametrlari ===")
print(before[last_func:last_func+200])
print()
print("=== Muammoli qator konteksti ===")
print(c[idx-300:idx+300])
