with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("Davom ettirish")
print("Pozitsiya:", idx)
print(c[max(0,idx-1500):idx+300])
