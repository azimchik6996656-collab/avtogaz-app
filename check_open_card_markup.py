with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find("function ServicesTab")
segment = c[idx:idx+8000]

# "Davom ettirish" tugmasi atrofidagi kartani topamiz
btn_idx = segment.find("Davom ettirish")
print(segment[max(0,btn_idx-1500):btn_idx+300])
