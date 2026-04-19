import os

with open('ais.py', 'r', encoding='utf-8') as f:
    py_content = f.read()

do_options_and_post = """
    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-type")
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
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
"""

if 'def do_POST' not in py_content:
    py_content = py_content.replace(
        "    def do_GET(self):",
        do_options_and_post + "\n    def do_GET(self):"
    )

with open('ais.py', 'w', encoding='utf-8') as f:
    f.write(py_content)
    
print("ais.py updated!")
