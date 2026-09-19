with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find('id: "services"')
print("=== NAVIGATSIYA RO'YXATI (joriy holat) ===")
print(c[idx-10:idx+600])
