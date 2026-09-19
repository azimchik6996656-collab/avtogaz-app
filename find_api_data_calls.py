with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

idx = 0
count = 0
while True:
    idx = c.find("/api/data", idx)
    if idx == -1 or count > 5:
        break
    print(f"--- topilma #{count+1} (pozitsiya {idx}) ---")
    print(c[idx-100:idx+250])
    print()
    idx += 10
    count += 1
