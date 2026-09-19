with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = c.find('const allTabs')
print(c[idx:idx+1400])
