import json
import re

def parse_schedule():
    with open('raw_10_9.txt', 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')
        
    classes = {}
    current_class = None
    current_day = None
    
    day_map = {
        "ДҮЙСЕНБІ": "0", "ПОНЕДЕЛЬНИК": "0", "ДҮЙСЕНБІ (ПОНЕДЕЛЬНИК)": "0",
        "СЕЙСЕНБІ": "1", "ВТОРНИК": "1", "СЕЙСЕНБІ (ВТОРНИК)": "1",
        "СӘРСЕНБІ": "2", "СРЕДА": "2", "СӘРСЕНБІ (СРЕДА)": "2",
        "БЕЙСЕНБІ": "3", "ЧЕТВЕРГ": "3", "БЕЙСЕНБІ (ЧЕТВЕРГ)": "3",
        "ЖҰМА": "4", "ПЯТНИЦА": "4", "ЖҰМА (ПЯТНИЦА)": "4"
    }
    
    for line in lines:
        line = line.strip()
        if not line: continue
        
        # Check Class Header
        line_upper = line.upper()
        if 'СЫНЫБЫНЫҢ САБАҚ КЕСТЕСІ' in line_upper or 'КЛАСС:' in line_upper:
            if '10 «В»' in line_upper or '10 В' in line_upper:
                current_class = "10B"
            elif '10 «А»' in line_upper or '10 А' in line_upper:
                current_class = "10A"
            elif '9В' in line_upper or '9 В' in line_upper:
                current_class = "9B"
            elif '9А' in line_upper or '9 А' in line_upper:
                current_class = "9A"
            
            if current_class not in classes:
                classes[current_class] = {}
            continue
            
        # Check Day
        matched_day = False
        for dz, dnum in day_map.items():
            if line_upper.startswith(dz):
                current_day = dnum
                if current_day not in classes[current_class]:
                    classes[current_class][current_day] = {}
                matched_day = True
                break
        if matched_day:
            continue
            
        if not current_class or not current_day:
            continue
            
        # Parse 10th grade pattern
        m10 = re.match(r'^(\d+)\.\s+[\d\.\–\-]+\s+—\s+(.*)$', line)
        if m10:
            num = str(int(m10.group(1)))
            content = m10.group(2)
            
            if ' — каб. ' in content:
                subj_teach, room = content.split(' — каб. ')
            else:
                subj_teach = content
                room = "-"
                
            subject_parts = []
            teacher_parts = []
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
            
            # special overrides
            if 'География' in subj_teach and 'ДЖТ' in subj_teach and 'Физика' in subj_teach:
                final_subject = "География / ДЖТ / Физика / Информатика / Биология"
                final_teacher = "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н."
            elif 'Үй жұмысы' in subj_teach:
                final_subject = "Үй жұмысы"
                final_teacher = "-"

            classes[current_class][current_day][num] = {
                "subject": final_subject,
                "teacher": final_teacher,
                "room": room
            }
            continue
            
        # Parse 9th grade pattern
        if '|' in line and ('сабақ' in line):
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 2:
                # time = parts[0]
                m_lesson = re.match(r'(\d+)\s+сабақ:\s+(.*)', parts[1])
                if m_lesson:
                    num = str(int(m_lesson.group(1)))
                    subj = m_lesson.group(2)
                    
                    if '— (Обед/Перерыв)' in subj or '— (Перерыв)' in subj:
                        continue # Skip breaks modeled as lessons
                        
                    tch = ""
                    room = "-"
                    
                    if len(parts) == 4:
                        tch = parts[2]
                        if parts[3].startswith('Каб:'):
                            room = parts[3].replace('Каб:', '').strip()
                        else:
                            room = parts[3]
                    elif len(parts) == 3:
                        if parts[2].startswith('Каб:'):
                            room = parts[2].replace('Каб:', '').strip()
                        else:
                            tch = parts[2]
                    
                    classes[current_class][current_day][num] = {
                        "subject": subj,
                        "teacher": tch,
                        "room": room
                    }

    return classes

parsed = parse_schedule()

with open('parsed_schedules.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for k, v in parsed.items():
    data[k] = v

with open('parsed_schedules.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

json_str = json.dumps(data, ensure_ascii=False, indent=4)
with open('AIS.JS', 'r', encoding='utf-8') as f:
    js_content = f.read()

start_idx = js_content.find("const SPECIFIC_SCHEDULES =")
end_idx = js_content.find("    function loadScheduleData()")

if start_idx != -1 and end_idx != -1:
    new_js = js_content[:start_idx] + "const SPECIFIC_SCHEDULES = " + json_str + ";\n\n" + js_content[end_idx:]
    with open('AIS.JS', 'w', encoding='utf-8') as f:
        f.write(new_js)
    print("9th and 10th grades updated!")
else:
    print("Markers not found")
