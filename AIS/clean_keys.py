import json

with open('parsed_schedules.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Cyrillic to Latin mapping for A, B, C
cyrillic_map = {'А': 'A', 'В': 'B', 'С': 'C'}

new_data = {}
for k, v in data.items():
    new_k = k
    for cyr, lat in cyrillic_map.items():
        new_k = new_k.replace(cyr, lat)
    # If the converted key is already in new_data, we overwrite it with the latest, usually they should be identical.
    # Wait, the user specifically says "УБЕРИ СТАРЫЙ И ОСТАВЬ НОВЫЙ", so we KEEP the one we just added. We added both.
    new_data[new_k] = v

with open('parsed_schedules.json', 'w', encoding='utf-8') as f:
    json.dump(new_data, f, ensure_ascii=False, indent=4)

# Patch AIS.JS with the new cleaned json
json_str = json.dumps(new_data, ensure_ascii=False, indent=4)
with open('AIS.JS', 'r', encoding='utf-8') as f:
    js_content = f.read()

start_marker = "const SPECIFIC_SCHEDULES ="
end_marker = "    function loadScheduleData()"

start_idx = js_content.find(start_marker)
end_idx = js_content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_js = js_content[:start_idx] + "const SPECIFIC_SCHEDULES = " + json_str + ";\n\n" + js_content[end_idx:]
    with open('AIS.JS', 'w', encoding='utf-8') as f:
        f.write(new_js)
    print("Cleaned JSON injected successfully!")
else:
    print("Markers not found.")
