import re

raw = open('app/AvtogazApp.jsx', 'rb').read()
c = raw.decode('utf-8')

print("Fayl uzunligi:", len(c), "belgi")
print()

# Barcha funksiya nomlarini topish
fns = re.findall(r'function ([A-Z]\w+)\(', c)
print("=== KOMPONENTLAR ===")
for f in fns:
    print(" ", f)

print()
print("=== QIDIRUV ===")
for word in ['shifts', 'clockIn', 'WorkTime', 'smena', 'Kafolat', 'kafolat', 'warranty', 'WarrantyClaim', 'stockOut', 'StockOut']:
    idx = c.find(word)
    print(f"  {word}: {idx}")
