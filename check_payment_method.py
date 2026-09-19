with open("app/AvtogazApp.jsx", "r", encoding="utf-8-sig", newline=None) as f:
    c = f.read()

# cashflow yozuvlarida "paymentType" yoki "method" borligini tekshiramiz
idx = c.find('d.cashflow.push')
if idx == -1:
    idx = c.find('cashflow.unshift({ id: uid(), date: todayISO(), type: "kirim"')
print(c[max(0,idx-100):idx+500])
print()
print("=== PAYMENT_TYPES ===")
idx2 = c.find("PAYMENT_TYPES =")
print(c[idx2:idx2+150])
