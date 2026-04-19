import re

file_path = r"c:\Users\ASUS\OneDrive\Desktop\AIS\AIS.JS"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacement = '''    "7A": {
        "0": {
            "1": { "subject": "Орыс тілі", "teacher": "Гореева А.М.", "room": "303" },
            "2": { "subject": "Химия", "teacher": "Аманғазы С.", "room": "211" },
            "3": { "subject": "Алгебра", "teacher": "Арыстанғалиқызы А.", "room": "110" },
            "4": { "subject": "Қазақ тілі", "teacher": "Утенова К.К.", "room": "311" },
            "5": { "subject": "Тәрбие сағаты", "teacher": "Саламатұлы А.", "room": "109" },
            "6": { "subject": "Ағылшын тілі", "teacher": "Қайыржанова А.", "room": "304" },
            "7": { "subject": "Дене шынықтыру", "teacher": "Қарабай А.Н.", "room": "үлкен спортзал" },
            "8": { "subject": "Физика (электив)", "teacher": "Сунгариева А.Б.", "room": "209" }
        },
        "1": {
            "1": { "subject": "Физика", "teacher": "Сунгариева А.Б.", "room": "209" },
            "2": { "subject": "Көркем еңбек", "teacher": "Қойшан Ы.А / Қазиев Н.", "room": "307/123" },
            "3": { "subject": "Орыс тілі", "teacher": "Гореева А.М.", "room": "302" },
            "4": { "subject": "Дүние жүзі тарихы", "teacher": "Қангерей Қ.", "room": "310" },
            "5": { "subject": "Қазақ әдебиеті", "teacher": "Утенова К.К.", "room": "311" },
            "6": { "subject": "Ағылшын тілі", "teacher": "Қайыржанова А.", "room": "206" },
            "7": { "subject": "Қазақстан тарихы", "teacher": "Қангерей Қ.", "room": "310" },
            "8": { "subject": "Математика (электив)", "teacher": "Арыстанғалиқызы А.", "room": "110" }
        },
        "2": {
            "1": { "subject": "Биология", "teacher": "Қайырқұлов Н.А.", "room": "203" },
            "2": { "subject": "Химия", "teacher": "Аманғазы С.", "room": "201" },
            "3": { "subject": "Алгебра", "teacher": "Арыстанғалиқызы А.", "room": "110" },
            "4": { "subject": "Қазақ тілі", "teacher": "Утенова К.К.", "room": "311" },
            "5": { "subject": "Дене шынықтыру", "teacher": "Қарабай А.Н.", "room": "үлкен спортзал" },
            "6": { "subject": "Қытай тілі", "teacher": "Қайыржанова А.", "room": "304" },
            "7": { "subject": "Биология (электив)", "teacher": "Қайырқұлов Н.А.", "room": "203" },
            "8": { "subject": "География (электив)", "teacher": "Жадырасын Е.", "room": "309" }
        },
        "3": {
            "1": { "subject": "Физика", "teacher": "Сунгариева А.Б.", "room": "209" },
            "2": { "subject": "Орыс тілі", "teacher": "Гореева А.М.", "room": "303" },
            "3": { "subject": "Геометрия", "teacher": "Арыстанғалиқызы А.", "room": "110" },
            "4": { "subject": "Жаһандық құзыреттілік", "teacher": "Халелова А.Е.", "room": "310" },
            "5": { "subject": "Қазақстан тарихы", "teacher": "Қангерей Қ.", "room": "310" },
            "6": { "subject": "Қазақ әдебиеті", "teacher": "Утенова К.К.", "room": "311" },
            "7": { "subject": "Ағылшын тілі (электив)", "teacher": "Қайыржанова А.", "room": "305" },
            "8": { "subject": "Химия (электив)", "teacher": "Аманғазы С.", "room": "211" }
        },
        "4": {
            "1": { "subject": "Ағылшын тілі", "teacher": "Қайыржанова А.", "room": "304" },
            "2": { "subject": "Алгебра", "teacher": "Арыстанғалиқызы А.", "room": "110" },
            "3": { "subject": "География", "teacher": "Жадырасын Е.", "room": "309" },
            "4": { "subject": "Информатика", "teacher": "Сапар Е.", "room": "104" },
            "5": { "subject": "Биология", "teacher": "Қайырқұлов Н.А.", "room": "203" },
            "6": { "subject": "Дене шынықтыру", "teacher": "Қарабай А.Н.", "room": "үлкен спортзал" },
            "7": { "subject": "Робототехника", "teacher": "Косов М.", "room": "технопарк" },
            "8": { "subject": "Математика (электив)", "teacher": "Арыстанғалиқызы А.", "room": "110" }
        }
    },'''

# Regex to find "7A": { ... } up to the beginning of "7B": {
pattern = re.compile(r'(\s*"7A":\s*\{.*?\n)(\s*"7B":\s*\{)', re.DOTALL)
new_content = re.sub(pattern, replacement + r'\2', content)

if new_content == content:
    print("Error: Could not find strict 7A to 7B pattern. Trying alternative approach.")
    # Maybe 7B is formatted differently, let's just do an index-based replacement manually if needed
else:
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Successfully replaced class 7A schedule in AIS.JS")
