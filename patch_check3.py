raw = open('app/AvtogazApp.jsx', 'rb').read()
c = raw.decode('utf-8')

# WorkTimeTab funksiyasini topib, ichidagi UI qismini ko'ramiz
idx = c.find('function WorkTimeTab')
print("=== WorkTimeTab boshlanishi ===")
print(c[idx:idx+3000])
