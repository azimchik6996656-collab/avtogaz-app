with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("Davom ettirish")
print(c[max(0,idx-2800):idx-1500])
