import os

with open('ais.py', 'r', encoding='utf-8') as f:
    py_content = f.read()

# Add logging override
if 'import logging' not in py_content:
    py_content = py_content.replace(
        "import asyncio",
        "import asyncio\nimport logging\n\n# Отключаем лишние логи (чтобы в консоли было чисто)\nlogging.getLogger('aiogram').setLevel(logging.ERROR)\nlogging.getLogger('asyncio').setLevel(logging.ERROR)\n"
    )

with open('ais.py', 'w', encoding='utf-8') as f:
    f.write(py_content)
    
print("Added logging suppression!")
