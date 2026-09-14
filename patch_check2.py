raw = open('app/AvtogazApp.jsx', 'rb').read()
c = raw.decode('utf-8')

idx = c.find('function clockIn')
if idx == -1:
    idx = c.find('clockIn')
print("=== clockIn atrofi ===")
print(c[idx-50:idx+700])
print()
print("=== shiftMinutes / duration hisoblash ===")
for word in ['shiftMinutes', 'workedMinutes', 'durationMin', 'diffMin', 'elapsedMin']:
    i = c.find(word)
    if i > -1:
        print(f"--- {word} at {i} ---")
        print(c[i-50:i+500])
        print()
