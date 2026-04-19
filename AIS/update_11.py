import json
import re

def parse_schedule(text):
    classes = {}
    current_class = None
    current_day = None
    
    day_map = {
        "Дүйсенбі": "0",
        "Сейсенбі": "1",
        "Сәрсенбі": "2",
        "Бейсенбі": "3",
        "Жұма": "4"
    }
    
    lines = text.strip().split('\n')
    for line in lines:
        line = line.strip()
        if not line: continue
        
        if 'сыныбының сабақ кестесі' in line:
            if '11 «А»' in line:
                current_class = "11А"
            elif '11 «В»' in line:
                current_class = "11В"
            classes[current_class] = {}
            continue
            
        if line in day_map:
            current_day = day_map[line]
            classes[current_class][current_day] = {}
            continue
            
        m = re.match(r'^(\d+)\.\s+[\d\.\–\-]+\s+—\s+(.*)$', line)
        if m:
            num = int(m.group(1))
            actual_lesson = str(num + 1) # 1->2, 2->3, etc.
            content = m.group(2)
            
            # parts separated by ' — каб. '
            if ' — каб. ' in content:
                subj_teach, room = content.split(' — каб. ')
            else:
                subj_teach = content
                room = "-"
                
            # Teacher is inside () but there might be multiple. 
            # E.g. "Математика / Жаһандық құзыреттілік / Химия" -> no teacher
            # E.g. "Тарих (Балтабай Ж.) / Мат. сауаттылық (Есалина А.)"
            # General generic parse: string matching
            # We'll just separate everything before the first '(' if it's simple, but since there are many, we can just dump it as subject. Wait, dashboard splits subject and teacher!
            # Let's extract all text outside of parenthesis as subject, all text inside as teacher.
            subject_parts = []
            teacher_parts = []
            # Find all A (B) pattern
            matches = re.finditer(r'([^\(\)]+)(?:\(([^\(\)]+)\))?', subj_teach)
            for mat in matches:
                subj = mat.group(1).strip()
                tch = mat.group(2)
                if subj and subj != '/': 
                    subject_parts.append(subj.strip(' /'))
                if tch:
                    teacher_parts.append(tch.strip())
            
            if len(teacher_parts) > 0:
                final_subject = ' / '.join([s for s in subject_parts if s])
                final_teacher = ' / '.join(teacher_parts)
            else:
                final_subject = subj_teach
                final_teacher = ""
            
            # specific fix for long mixed ones:
            if 'География' in subj_teach and 'ДЖТ' in subj_teach and 'Физика' in subj_teach:
                final_subject = "География / ДЖТ / Физика / Информатика / Биология"
                final_teacher = "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А."
            elif 'Геометрия (Мат. сауат.) / Химия' in subj_teach:
                final_subject = "Геометрия / Химия"
                tc = re.search(r'\(([^)]+)\)$', subj_teach)
                final_teacher = tc.group(1) if tc else "Есалина А."
            elif 'Алгебра (Мат. сауат.) / Химия' in subj_teach:
                final_subject = "Алгебра / Химия"
                tc = re.search(r'\(([^)]+)\)$', subj_teach)
                final_teacher = tc.group(1) if tc else "Есалина А."
                
            if num == 8 and 'ҰБТ дайындық' in subj_teach:
                final_subject = "ҰБТ дайындық"
                final_teacher = "-"

            classes[current_class][current_day][actual_lesson] = {
                "subject": final_subject,
                "teacher": final_teacher,
                "room": room
            }
            
    return classes

with open('raw_11.txt', 'r', encoding='utf-8') as f:
    text = f.read()
    
parsed = parse_schedule(text)

with open('parsed_schedules.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# The loaded data has keys. The Cyrillic ones are "11А" and "11В".
# We will just set them directly. We can also set "11A" and "11B" (Latin) just to be absolutely safe.
for k in parsed:
    data[k] = parsed[k]
    latin_k = k.replace('А', 'A').replace('В', 'B')
    data[latin_k] = parsed[k]

with open('parsed_schedules.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

# Update AIS.JS
json_str = json.dumps(data, ensure_ascii=False, indent=4)
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
    print("Injected successfully!")
else:
    print("Markers not found.")
