raw = open('app/AvtogazApp.jsx', 'rb').read()
c = raw.decode('utf-8')

idx = c.find('function WorkTimeTab')
print(c[idx+3000:idx+6000])
