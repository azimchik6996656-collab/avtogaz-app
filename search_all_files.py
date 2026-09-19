import os

for root, dirs, files in os.walk("."):
    if "node_modules" in root or ".git" in root or ".next" in root:
        continue
    for fn in files:
        if fn.endswith(".js") or fn.endswith(".jsx"):
            path = os.path.join(root, fn)
            try:
                with open(path, "r", encoding="utf-8-sig", errors="ignore") as f:
                    content = f.read()
                if "app_data" in content or "key=appState" in content or "'key'" in content or '"key"' in content:
                    if path not in ["./app/api/data/route.js"]:
                        idx = content.find("app_data") if "app_data" in content else content.find("key")
                        print(f"=== {path} ===")
                        print(content[max(0,idx-100):idx+200])
                        print()
            except Exception as e:
                pass
