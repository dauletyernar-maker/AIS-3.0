import json
import re

schedule_7b = {
    "0": {
        "1": {"subject": "Химия", "teacher": "Аманғазы С.", "room": "211"},
        "2": {"subject": "Алгебра", "teacher": "Байдирахманова Б.С.", "room": "311"},
        "3": {"subject": "Орыс тілі", "teacher": "Гореева А.М.", "room": "302"},
        "4": {"subject": "Физика", "teacher": "Сунгариева А.Б.", "room": "211"},
        "5": {"subject": "Қазақ тілі", "teacher": "Утенова К.К.", "room": "311"},
        "6": {"subject": "Дүние жүзі тарихы", "teacher": "Қангерей Қ.", "room": "310"},
        "7": {"subject": "Қытай тілі", "teacher": "Қайржанова А.", "room": "305"},
        "8": {"subject": "Математика (электив)", "teacher": "Байдирахманова Б.С.", "room": "109"}
    },
    "1": {
        "1": {"subject": "География", "teacher": "Жадырасын Е.М.", "room": "309"},
        "2": {"subject": "Қазақ әдебиеті", "teacher": "Утенова К.К.", "room": "311"},
        "3": {"subject": "Көркем еңбек", "teacher": "Қойшан Ы. / Қазиев Н.", "room": "307/123"},
        "4": {"subject": "Ағылшын тілі", "teacher": "Қайыржанова А.", "room": "305"},
        "5": {"subject": "Қазақстан тарихы", "teacher": "Қангерей Қ.", "room": "310"},
        "6": {"subject": "Жаһандық құзыреттілік", "teacher": "Халелова А.Е.", "room": "310"},
        "7": {"subject": "Дене шынықтыру", "teacher": "Қарабай А.Н.", "room": "үлкен спортзал"},
        "8": {"subject": "Химия (электив)", "teacher": "Аманғазы С.", "room": "201"}
    },
    "2": {
        "1": {"subject": "Орыс тілі", "teacher": "Гореева А.М.", "room": "303"},
        "2": {"subject": "Алгебра", "teacher": "Байдирахманова Б.С.", "room": "311"},
        "3": {"subject": "Химия", "teacher": "Аманғазы С.", "room": "201"},
        "4": {"subject": "Биология", "teacher": "Қайырқұлов Н.А.", "room": "203"},
        "5": {"subject": "Қазақ тілі", "teacher": "Утенова К.К.", "room": "311"},
        "6": {"subject": "Дене шынықтыру", "teacher": "Қарабай А.Н.", "room": "үлкен спортзал"},
        "7": {"subject": "Робототехника", "teacher": "Косов М.", "room": "Технопарк"},
        "8": {"subject": "Математика (электив)", "teacher": "Байдирахманова Б.С.", "room": "109"}
    },
    "3": {
        "1": {"subject": "Ағылшын тілі", "teacher": "Қайыржанова А.", "room": "304"},
        "2": {"subject": "Геометрия", "teacher": "Байдирахманова Б.С.", "room": "109"},
        "3": {"subject": "Орыс тілі", "teacher": "Гореева А.М.", "room": "303"},
        "4": {"subject": "Физика", "teacher": "Сунгариева А.Б.", "room": "211"},
        "5": {"subject": "Қазақ әдебиеті", "teacher": "Утенова К.К.", "room": "311"},
        "6": {"subject": "Қазақстан тарихы", "teacher": "Қангерей Қ.", "room": "310"},
        "7": {"subject": "Биология (электив)", "teacher": "Қайырқұлов Н.А.", "room": "203"},
        "8": {"subject": "Физика (электив)", "teacher": "Сунгариева А.Б.", "room": "209"}
    },
    "4": {
        "1": {"subject": "Дене шынықтыру", "teacher": "Қарабай А.Н.", "room": "үлкен спортзал"},
        "2": {"subject": "Биология", "teacher": "Қайырқұлов Н.А.", "room": "203"},
        "3": {"subject": "Ағылшын тілі", "teacher": "Қайыржанова А.", "room": "305"},
        "4": {"subject": "Алгебра", "teacher": "Байдирахманова Б.С.", "room": "109"},
        "5": {"subject": "Информатика", "teacher": "Сапар Е.", "room": "104"},
        "6": {"subject": "География (электив)", "teacher": "Жадырасын Е.", "room": "304"},
        "7": {"subject": "Тәрбие сағаты", "teacher": "Саламатұлы А.", "room": "302"},
        "8": {"subject": "Ағылшын тілі (электив)", "teacher": "Қайыржанова А.", "room": "302"}
    }
}

with open("parsed_schedules.json", "r", encoding="utf-8") as f:
    data = json.load(f)

data["7B"] = schedule_7b

with open("parsed_schedules.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=4)
    
print("Updated parsed_schedules.json")

# Update AIS.JS
with open('parsed_schedules.json', 'r', encoding='utf-8') as f:
    schedule_data = json.load(f)
json_str = json.dumps(schedule_data, ensure_ascii=False, indent=4)
with open('AIS.JS', 'r', encoding='utf-8') as f:
    js_content = f.read()

start_marker = "const SPECIFIC_SCHEDULES ="
end_marker = "function loadScheduleData()"

start_idx = js_content.find(start_marker)
end_idx = js_content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_js = js_content[:start_idx] + "const SPECIFIC_SCHEDULES = " + json_str + ";\n\n    " + js_content[end_idx:]
    with open('AIS.JS', 'w', encoding='utf-8') as f:
        f.write(new_js)
    print("Injected successfully!")
else:
    print("Markers not found.")
