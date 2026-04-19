import sys
import codecs
import re

file_path = "c:\\Users\\ASUS\\OneDrive\\Desktop\\AIS\\AIS.JS"
with codecs.open(file_path, "r", "utf-8") as f:
    text = f.read()

# find all keys inside SPECIFIC_SCHEDULES
# looking for pattern: "7A": {
matches = re.findall(r'\s*"([0-9]{1,2}[A-Za-zА-Яа-я])":\s*\{', text)
print("Keys found:")
for m in matches:
    print(m)
