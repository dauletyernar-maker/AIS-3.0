import sys
import codecs

file_path = "c:\\Users\\ASUS\\OneDrive\\Desktop\\AIS\\AIS.JS"
with codecs.open(file_path, "r", "utf-8") as f:
    text = f.read()

schedule_10c = '''    "10C": {
        "0": {
            "1": { "subject": "Каз яз и лит", "teacher": "Арыстанбек С.", "room": "Т-106(16Т)" },
            "2": { "subject": "Каз яз и лит", "teacher": "Арыстанбек С.", "room": "Т-106(16Т)" },
            "3": { "subject": "Биология", "teacher": "Ахметкалиева А.", "room": "ХВ-203(16И)" },
            "4": { "subject": "Биология", "teacher": "Ахметкалиева А.", "room": "ХВ-203(16И)" },
            "5": { "subject": "Матем", "teacher": "Кайырбеков А.", "room": "FM-305(16И)" },
            "6": { "subject": "Матем", "teacher": "Кайырбеков А.", "room": "FM-305(16И)" },
            "7": { "subject": "История Каз", "teacher": "Байтуреев Д.", "room": "ХВ-104(28И)" },
            "8": { "subject": "История Каз", "teacher": "Байтуреев Д.", "room": "ХВ-104(28И)" },
            "9": { "subject": "Выбор Электив + Олимпиада", "teacher": "-", "room": "-" },
            "10": { "subject": "Выбор Электив + Олимпиада", "teacher": "-", "room": "-" }
        },
        "1": {
            "1": { "subject": "Химия / Каз яз и лит", "teacher": "Асылбекова А. / Арыстанбек С.", "room": "ХВ-204(16И) / Т-106(16Т)" },
            "2": { "subject": "Химия / Каз яз и лит", "teacher": "Асылбекова А. / Арыстанбек С.", "room": "ХВ-204(16И) / Т-106(16Т)" },
            "3": { "subject": "Матем", "teacher": "Кайырбеков А.", "room": "FM-305(16И)" },
            "4": { "subject": "Матем", "teacher": "Кайырбеков А.", "room": "FM-305(16И)" },
            "5": { "subject": "English", "teacher": "Гайнакова В.", "room": "Т-305(16И)" },
            "6": { "subject": "English", "teacher": "Гайнакова В.", "room": "Т-305(16И)" },
            "7": { "subject": "Информатика", "teacher": "Нурмуханбетова О.М.", "room": "FM-202(26И)" },
            "8": { "subject": "Информатика", "teacher": "Нурмуханбетова О.М.", "room": "FM-202(26И)" },
            "9": { "subject": "Под. к СО (Рус яз)", "teacher": "Хакимова Б.", "room": "Т-205(16Т)" },
            "10": { "subject": "Под. к СО (Рус яз)", "teacher": "Хакимова Б.", "room": "Т-205(16Т)" }
        },
        "2": {
            "1": { "subject": "Химия", "teacher": "Асылбекова А.", "room": "ХВ-204(16И)" },
            "2": { "subject": "Химия", "teacher": "Асылбекова А.", "room": "ХВ-204(16И)" },
            "3": { "subject": "Рус яз и лит", "teacher": "Хакимова Б.", "room": "Т-205(16Т)" },
            "4": { "subject": "Физика", "teacher": "Жаулыбеков А.", "room": "216(16И)" },
            "5": { "subject": "Каз яз и лит", "teacher": "Арыстанбек С.", "room": "Т-106(16Т)" },
            "6": { "subject": "Каз яз и лит", "teacher": "Арыстанбек С.", "room": "Т-106(16Т)" },
            "7": { "subject": "Физкультура", "teacher": "Гасанов Н.", "room": "Big Sports Hall" },
            "8": { "subject": "Физкультура", "teacher": "Гасанов Н.", "room": "Big Sports Hall" },
            "9": { "subject": "Матем (электив)", "teacher": "Кайырбеков А.", "room": "FM-305(16И)" },
            "10": { "subject": "Матем (электив)", "teacher": "Кайырбеков А.", "room": "FM-305(16И)" }
        },
        "3": {
            "1": { "subject": "Матем", "teacher": "Кайырбеков А.", "room": "FM-305(16И)" },
            "2": { "subject": "Матем", "teacher": "Кайырбеков А.", "room": "FM-305(16И)" },
            "3": { "subject": "Всемир ист", "teacher": "Иван О.А.", "room": "219(28И)" },
            "4": { "subject": "Час развития", "teacher": "Аширбекова А.Н / Гуляева Е.А", "room": "Т-104(16Т)" },
            "5": { "subject": "Физика", "teacher": "Жаулыбеков А.", "room": "216(16И)" },
            "6": { "subject": "Физика", "teacher": "Жаулыбеков А.", "room": "216(16И)" },
            "7": { "subject": "Рус яз и лит", "teacher": "Хакимова Б.", "room": "Т-205(16Т)" },
            "8": { "subject": "Рус яз и лит", "teacher": "Хакимова Б.", "room": "Т-205(16Т)" },
            "9": { "subject": "Под. к СО (История)", "teacher": "Байтуреев Д.", "room": "ХВ-104(28И)" },
            "10": { "subject": "Под. к СО (каз яз)", "teacher": "Арыстанбек С.", "room": "Т-106(16Т)" }
        },
        "4": {
            "1": { "subject": "Искусство", "teacher": "Тулеева Ж.", "room": "213(Оранж)" },
            "2": { "subject": "Искусство", "teacher": "Тулеева Ж.", "room": "213(Оранж)" },
            "3": { "subject": "География", "teacher": "Есентаев Е.", "room": "ХВ-103(28И)" },
            "4": { "subject": "География", "teacher": "Есентаев Е.", "room": "ХВ-103(28И)" },
            "5": { "subject": "Биология", "teacher": "Ахметкалиева А.", "room": "ХВ-203(16И)" },
            "6": { "subject": "English", "teacher": "Гайнакова В.", "room": "Т-305(16И)" },
            "7": { "subject": "English", "teacher": "Гайнакова В.", "room": "Т-305(16И)" }
        }
    },
'''

if '"10C": {' not in text:
    new_text = text.replace("const SPECIFIC_SCHEDULES = {", "const SPECIFIC_SCHEDULES = {\n" + schedule_10c)
    with codecs.open(file_path, "w", "utf-8") as f:
        f.write(new_text)
    print("Added 10C format to AIS.JS")
else:
    print("10C already exists in AIS.JS")
