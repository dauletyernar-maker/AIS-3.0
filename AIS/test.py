import sys

file_path = "c:\\Users\\ASUS\\OneDrive\\Desktop\\AIS\\AIS.JS"
with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find('"7A": {')
if idx == -1:
    print("7A not found")
else:
    print(text[max(0, idx-100):idx+300])

print("---------")
idx2 = text.find('"7B": {')
if idx2 != -1:
    print(text[max(0, idx2-100):idx2+200])
