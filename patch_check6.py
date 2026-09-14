raw = open('app/AvtogazApp.jsx', 'rb').read()
c = raw.decode('utf-8')

idx = c.find('function WarehouseTab')
print("WarehouseTab boshi:", idx)
# WarehouseTab ichida "role" parametri bormi
print(c[idx:idx+400])
print("...")
# stockOuts joylashgan joy atrofidagi "role" tekshiruvi bormi
idx2 = c.find('Chiqim tarixi')
print()
print("=== role check atrofida ===")
print(c[idx2-600:idx2])
