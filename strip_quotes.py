with open('.env', 'r', encoding='utf-8') as f:
    lines = f.readlines()

cleaned_lines = []
for line in lines:
    if line.startswith('VITE_FIREBASE_'):
        line = line.replace('"', '').replace("'", "")
    cleaned_lines.append(line)

with open('.env', 'w', encoding='utf-8') as f:
    f.writelines(cleaned_lines)
