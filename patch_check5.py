raw = open('app/AvtogazApp.jsx', 'rb').read()
c = raw.decode('utf-8')

idx = c.find('Chiqim tarixi')
print("=== 'Chiqim tarixi' atrofi ===")
print(c[idx-200:idx+1500])
