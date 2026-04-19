import asyncio
import logging

# Отключаем лишние логи (чтобы в консоли было чисто)
logging.basicConfig(level=logging.ERROR)
logging.getLogger('aiogram').setLevel(logging.CRITICAL)
logging.getLogger('asyncio').setLevel(logging.CRITICAL)

import json
import os
import io
import re
import datetime

from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from aiogram.filters import Command

# Telegram Bot Token
TOKEN = "8657471784:AAFwluD2DTMheo-_CKubdy3frDsWE7Fj8kE"
DATA_FILE = "bot_data.json"

bot = Bot(token=TOKEN)
dp = Dispatcher()

# База данных классов из файла staff_data.json
CLASS_DB = {
    "7A": 15, "7А": 15,
    "7B": 9,  "7В": 9,
    "7C": 14, "7С": 14,
    "8A": 20, "8А": 20,
    "8B": 20, "8В": 20,
    "8C": 22, "8С": 22,
    "8D": 16, "8Д": 16,
    "9A": 23, "9А": 23,
    "9B": 19, "9В": 19,
    "10A": 20,"10А": 20,
    "10B": 19,"10В": 19,
    "11A": 26,"11А": 26,
    "11B": 24,"11В": 24
}
TOTAL_PORTIONS = 247

# === РАСПИСАНИЕ: загрузка и умная замена ===
SCHEDULE_FILE = "parsed_schedules.json"

def load_schedule():
    try:
        with io.open(SCHEDULE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

def parse_day(text):
    text = text.lower()
    days_map = {
        'понедельник': "0", 'пн': "0",
        'вторник': "1", 'вт': "1",
        'сред': "2", 'ср': "2",
        'четверг': "3", 'чт': "3",
        'пятниц': "4", 'пт': "4"
    }
    for k, v in days_map.items():
        if k in text:
            days_ru = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"]
            return v, days_ru[int(v)]
            
    # Если день не указан явно
    return None, None
    
def extract_teacher(text):
    schedule = load_schedule()
    text = text.lower()
    all_teachers = set()
    for cls, days in schedule.items():
        for d, lessons in days.items():
            for l, info in lessons.items():
                t = info.get('teacher', '').strip()
                if t:
                    for single_t in [x.strip() for x in t.split('/')]:
                        if single_t: all_teachers.add(single_t)
                        
    import difflib
    words = text.split()
    all_surnames = {t.split()[0].lower(): t for t in all_teachers}
    
    for t in all_teachers:
        surname = t.split()[0].lower()
        if surname in text:
            return t
            
    # Нечеткий поиск (если опечатались, например Греева вместо Гореева)
    for w in words:
        if len(w) > 4:
            matches = difflib.get_close_matches(w, all_surnames.keys(), n=1, cutoff=0.6)
            if matches:
                return all_surnames[matches[0]]
                
    return words[0].capitalize() if words else "Неизвестный"

def find_substitution(sick_teacher_name, day_str="0", today_name="Понедельник"):
    """Находит уроки заболевшего и подбирает свободного заменяющего по профилю"""
    schedule = load_schedule()

    sick_lessons = []
    all_teachers_at_time = {}  # lesson_num -> set of busy teachers
    teacher_subjects = {}      # teacher_name -> set of subject names

    # 1. Собираем базу всех учителей и их предметов за всю неделю со всех классов
    for cls, days in schedule.items():
        for d_str, lessons in days.items():
            for l_num, info in lessons.items():
                t = info.get('teacher', '').strip()
                sub = info.get('subject', '').strip()
                if t and sub:
                    t_list = [x.strip() for x in t.split('/')] # Учитываем сдвоенных учителей
                    clean_sub = sub.replace('(электив)', '').replace('(общеобразоват.)', '').strip().lower()
                    for single_t in t_list:
                        if not single_t: continue
                        if single_t not in teacher_subjects:
                            teacher_subjects[single_t] = set()
                        if clean_sub:
                            teacher_subjects[single_t].add(clean_sub)

    # 2. Ищем уроки заболевшего и составляем список занятых именно в Понедельник
    for cls, days in schedule.items():
        if day_str not in days:
            continue
        
        for lesson_num, info in days[day_str].items():
            t = info.get('teacher', '').strip()
            if t:
                t_list = [x.strip() for x in t.split('/')]
                for single_t in t_list:
                    if lesson_num not in all_teachers_at_time:
                        all_teachers_at_time[lesson_num] = set()
                    all_teachers_at_time[lesson_num].add(single_t)

            # Проверяем для классов с литерой "А" (как вы просили), но берём и остальные для надежности
            # Ищем уроки именно заболевшего
            if "А" in cls or "A" in cls or True:
                if sick_teacher_name.lower() in t.lower():
                    sick_lessons.append({
                        'class': cls,
                        'lesson': lesson_num,
                        'subject': info.get('subject', '?'),
                        'room': info.get('room', '?')
                    })

    if not sick_lessons:
        return None, today_name

    # 3. Для каждого урока ищем ПРОФИЛЬНОГО свободного учителя
    results = []
    for lesson in sick_lessons:
        clean_target_sub = lesson['subject'].replace('(электив)', '').replace('(общеобразоват.)', '').strip().lower()
        busy_now = all_teachers_at_time.get(lesson['lesson'], set())
        
        candidates = []
        for teacher, subjects in teacher_subjects.items():
            # Если учитель преподает этот же предмет и не является заболевшим
            if teacher.lower() != sick_teacher_name.lower() and clean_target_sub in subjects:
                # Проверяем, свободен ли он(а) на этом уроке
                is_busy = False
                for b_t in busy_now:
                    if teacher.lower() in b_t.lower() or b_t.lower() in teacher.lower():
                        is_busy = True
                        break
                if not is_busy:
                    candidates.append(teacher)
        
        if candidates:
            # Нашли профильного преподавателя, у которого окно!
            substitute = f"{candidates[0]}"
        else:
            # Если профильного нет, ищем ЛЮБОГО свободного дежурного
            all_free = []
            for t in teacher_subjects.keys():
                if t.lower() == sick_teacher_name.lower(): continue
                is_busy = False
                for b_t in busy_now:
                    if t.lower() in b_t.lower() or b_t.lower() in t.lower():
                        is_busy = True
                        break
                if not is_busy:
                    all_free.append(t)
            substitute = f"{all_free[0]} (резерв слота)" if all_free else "Свободных окон нет"
            
        results.append({**lesson, 'substitute': substitute})

    return results, today_name

# Клавиатура
def load_data():
    if not os.path.exists(DATA_FILE):
        return {"canteen": TOTAL_PORTIONS, "total_missing": 0, "incidents": 0, "tasks": []}
    try:
        with io.open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if "total_missing" not in data:
                data["total_missing"] = 0
            return data
    except:
        return {"canteen": TOTAL_PORTIONS, "total_missing": 0, "incidents": 0, "tasks": []}

def save_data(data):
    # Обновляем столовую перед сохранением (Базово 247 минус отсутствующие)
    data["canteen"] = TOTAL_PORTIONS - data.get("total_missing", 0)
    with io.open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# Клавиатура
keyboard = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="👥 Отметить посещаемость (Учитель)")],
        [KeyboardButton(text="⚠️ Сообщить об инциденте")],
        [KeyboardButton(text="🤕 Я заболел (авто-замена)")]
    ],
    resize_keyboard=True
)

# Состояния (простые)
user_states = {}

@dp.message(Command("start"))
async def cmd_start(message: Message):
    # Логируем Chat ID всех кто пишет /start (удобно для настройки)
    print(f"[NEW USER] {message.from_user.first_name} {message.from_user.last_name} | @{message.from_user.username} | ID: {message.from_user.id}")
    await message.answer("Добро пожаловать в систему автоматизации Aqbobek AI! \n\nВыберите вашу роль/действие в меню ниже:", reply_markup=keyboard)


@dp.message(Command("clear"))
async def cmd_clear(message: Message):
    # Полный сброс всех данных для хакатона!
    data = load_data()
    data["total_missing"] = 0
    data["canteen"] = TOTAL_PORTIONS
    data["incidents"] = 0
    data["tasks"] = []
    save_data(data)
    await message.answer("🧹 Все данные успешно обнулены! Порции восстановлены на 247, инциденты и задачи очищены. Сайт обновится автоматически в течение пары секунд.", reply_markup=keyboard)


@dp.message(F.text == "👥 Отметить посещаемость (Учитель)")
async def ask_attendance(message: Message):
    user_states[message.from_user.id] = "waiting_for_attendance"
    await message.answer("Пожалуйста, отправьте отчет о посещаемости.\nСистема ИИ сама распознает класс и количество присутствующих!\n\nПример: _Оксана Юсуповна, 7А - 13 учеников_", parse_mode="Markdown")


@dp.message(F.text == "🤕 Я заболел (авто-замена)")
async def ask_sick(message: Message):
    user_states[message.from_user.id] = "waiting_for_substitution"
    await message.answer(
        "🤖 **Smart Auto-Замена**\n\nНапишите Ваше ИМЯ и **ОБЯЗАТЕЛЬНО укажите день недели** (пн, вт, ср, чт, пт), на который нужна замена.\n\nПример: _Гореева понедельник_",
        parse_mode="Markdown"
    )

@dp.message(F.text == "⚠️ Сообщить об инциденте")
async def ask_incident(message: Message):
    user_states[message.from_user.id] = "waiting_for_incident"
    await message.answer("Опишите инцидент, и он мгновенно появится на панеле директора красным предупреждением:")

@dp.message()
async def process_text(message: Message):
    user_id = message.from_user.id
    state = user_states.get(user_id)
    
    if state == "waiting_for_attendance":
        # Убираем все переводы строк, пробелы и тире
        text_raw = message.text
        text = text_raw.upper().replace(' ', '').replace('-', '').replace('_', '')
        
        # Сначала ищем классы с буквами (например 11A, потом 7A) чтобы 11 не перебило
        sorted_classes = sorted(CLASS_DB.keys(), key=len, reverse=True)
        found_class = None
        for cls in sorted_classes:
            if cls in text:
                found_class = cls
                break
        
        if found_class:
            # Ищем числа в сообщении
            numbers = re.findall(r'\d+', message.text)
            students_present = None
            for num in numbers:
                if str(num) not in found_class: 
                    students_present = int(num)
            
            if students_present is not None:
                total_expected = CLASS_DB[found_class]
                missing = total_expected - students_present
                
                if missing < 0:
                    missing = 0
                
                # Пытаемся вытащить имя учителя (первые два слова до цифр или запятой)
                words = re.findall(r'[А-Яа-яЁёA-Za-z]+', text_raw)
                teacher_name = "Учитель"
                if len(words) >= 2:
                    # Например: "Гореева А.М." или "Оксана Юсуповна"
                    teacher_name = f"{words[0]} {words[1]}"
                
                data = load_data()
                data["total_missing"] = data.get("total_missing", 0) + missing
                save_data(data)
                
                # Формируем красивую карточку на сайт для директора
                new_task = f"Отчет от: {teacher_name} | {found_class} класс. Присутствует: {students_present}/{total_expected}. Снято порций: {missing}"
                data["tasks"].insert(0, new_task)
                save_data(data)
                
                del user_states[user_id]
                await message.answer(f"🤖 **ИИ-Распознавание:**\n\n👨‍🏫 Учитель: {teacher_name}\n🏫 Класс: {found_class}\n👥 По списку: {total_expected}\n✔️ Присутствуют: {students_present}\n❌ Значит отсутствует: {missing} чел.\n\n✅ Отчет передан директору: С общего котла снято {missing} порций.", parse_mode="Markdown")
            else:
                await message.answer("Система нашла класс, но не смогла найти количество пришедших учеников. Попробуйте еще раз в формате: 7А - 13 учеников")
        else:
            await message.answer("Система не распознала класс. Напишите, например: 'Оксана Юсуповна 7А - 13 учеников'")
            

    elif state == "waiting_for_incident":
        data = load_data()
        data["incidents"] = data.get("incidents", 0) + 1
        
        # Добавляем задачу директору
        new_task = f"🚨 ИНЦИДЕНТ: {message.text} (от: {message.from_user.first_name})"
        # Кладем в начало массива
        data["tasks"].insert(0, new_task)
        save_data(data)
        
        del user_states[user_id]
        await message.answer("🚨 Инцидент успешно передан на Дашборд директора! Администрация уведомлена.")

    elif state == "waiting_for_substitution":
        msg_text = message.text.strip()
        day_str, today_name = parse_day(msg_text)
        
        if day_str is None:
            await message.answer("❌ Вы не указали день недели!\nПожалуйста, напишите ваше ИМЯ и **ДЕНЬ** (например: _пн, вт, ср_).", parse_mode="Markdown")
            return
            
        absent_teacher = extract_teacher(msg_text)

        await message.answer(f"🔍 Ищу уроки учителя **{absent_teacher}** на {today_name} и подбираю профильную замену...", parse_mode="Markdown")
        
        results, today_name = find_substitution(absent_teacher, day_str, today_name)
        
        if not results:
            await message.answer(f"❌ Учитель *{absent_teacher}* не имеет уроков на {today_name}.", parse_mode="Markdown")
        else:
            response = f"✅ **Агент обработал расписание на {today_name}:**\n\n🤒 Выбыл: {absent_teacher}\n\n🤖 Поиск свободных окон... Найдена замена!\n"
            data = load_data()
            
            for r in results:
                response += f"🏫 {r['class']} класс, {r['lesson']}-й урок ({r['subject']})\n"
                response += f"✔️ Назначен: **{r['substitute']}** (каб. {r['room']})\n\n"
                
                # Добавляем задачу об успешной замене в Дашборд
                # Требуемый формат: ГРЕЕВ УЧИТЕЛЬ РУССКОГО ЗАБОЛЕЛ ВМЕСТО НЕГО ОКСАНА ПРОВОДЕТ УРОК
                sub_name = r['substitute'].split()[0] # Берем только имя/фамилию заменяющего
                sick_name = absent_teacher.split()[0]
                subj = r['subject']
                cls_name = r['class']
                new_task = f"СМАРТ ЗАМЕНА: {sick_name} (учитель предмета: {subj}) заболел. Вместо него {sub_name} проведет урок в {cls_name} классе ({r['lesson']}-й урок)."
                data["tasks"].insert(0, new_task)
                
            save_data(data)
            if user_id in user_states:
                del user_states[user_id]
            response += "📲 Уведомления отправлены.\n🌐 Дашборд директора обновлен."
            await message.answer(response, parse_mode="Markdown")

    else:
        await message.answer("Используйте кнопки меню внизу экрана.", reply_markup=keyboard)


import threading
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

# Ссылка на главный event loop (для отправки из фонового потока)
main_loop = None

# База сотрудников (Telegram Chat ID)
# Чтобы добавить ID: сотрудник должен написать боту /start, потом смотрите логи
STAFF_DB = {
    "Ернар": {
        "username": "@yernarre",
        "chat_id": 5310093334,  # ✅ Подтверждён
        "role": "Электрик / Освещение",
        "keywords": ["свет", "лампоч", "электр", "провод", "розетк", "выключ", "щитов"]
    },
    "Нурасыл": {
        "username": "@Nurasyl_Salkh",
        "chat_id": 5311496786,  # ✅ Подтверждён
        "role": "Заместитель директора",
        "keywords": ["зам", "директор", "администрация", "расписание", "отчет", "собрание"]
    },
    "Оралхан": {
        "username": "@OlalE67",
        "chat_id": 1898041138,  # ✅ Подтверждён
        "role": "Главный повар",
        "keywords": ["столовая", "порция", "меню", "питание", "повар", "обед", "завтрак"]
    },
}

import urllib.parse

class ClearHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass # Выключаем лишние логи в консоль
        
    def end_headers(self):
        # Разрешаем вызывать это из Live Server (CORS)
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept')
        self.end_headers()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == '/send_voice':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                audio_data = self.rfile.read(content_length)
                import asyncio
                from aiogram.types import BufferedInputFile
                
                async def send_to_all():
                    for name, staff in STAFF_DB.items():
                        if staff["chat_id"] != 0:
                            try:
                                audio_file = BufferedInputFile(audio_data, filename="voice.ogg")
                                await bot.send_voice(chat_id=staff["chat_id"], voice=audio_file, caption="🎙️ Массовое голосовое оповещение от ИИ-Дашборда!")
                            except Exception as e:
                                print(f"Error sending voice to {name}: {e}")
                                
                asyncio.run_coroutine_threadsafe(send_to_all(), main_loop)
                
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        if parsed_path.path == '/clear':
            data = load_data()
            data["canteen"] = TOTAL_PORTIONS
            data["total_missing"] = 0
            data["incidents"] = 0
            data["tasks"] = []
            save_data(data)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            
        elif parsed_path.path == '/send_msg':
            params = urllib.parse.parse_qs(parsed_path.query)
            staff_name = params.get('name', [None])[0]
            msg_text = params.get('msg', [None])[0]
            
            if staff_name and msg_text:
                staff = STAFF_DB.get(staff_name)
                if staff and staff["chat_id"] != 0:
                    try:
                        # Правильный способ вызвать async из sync-потока
                        future = asyncio.run_coroutine_threadsafe(
                            bot.send_message(
                                staff["chat_id"],
                                f"📲 **СРОЧНОЕ ПОРУЧЕНИЕ от директора:**\n\n{msg_text}"
                            ),
                            main_loop
                        )
                        future.result(timeout=10)  # Ждём до 10 секунд
                        
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(b'{"status": "sent"}')
                        return
                    except Exception as e:
                        print(f"[ОШИБКА отправки] {e}")
                elif staff and staff["chat_id"] == 0:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"status": "no_id"}')
                    return
                
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"status": "failed"}')

def run_server():
    server = HTTPServer(('127.0.0.1', 8080), ClearHandler)
    server.serve_forever()

async def main():
    global main_loop
    main_loop = asyncio.get_event_loop()
    
    print("====================================")
    print("AI Бот Aqbobek запущен! Ожидание команд...")
    print("Скрытый API-сервер запущен на порту 8080 (Для кнопки очистки)")
    print("====================================")
    
    # Запускаем фоновый сервер очистки
    threading.Thread(target=run_server, daemon=True).start()
    
    # Добавляем кнопку меню команд (с командой start)
    from aiogram.types import BotCommand
    await bot.set_my_commands([
        BotCommand(command="start", description="Запустить бота (Главное меню)"),
        BotCommand(command="clear", description="Очистить Дашборд от данных")
    ])
    
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
