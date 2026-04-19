import json

with open('AIS.JS', 'r', encoding='utf-8') as f:
    js_content = f.read()

# 1. Add globals
if "let mediaRecorder = null;" not in js_content:
    js_content = js_content.replace(
        "    let finalTranscript = '';",
        "    let finalTranscript = '';\n    let mediaRecorder = null;\n    let audioChunks = [];\n    window.latestVoiceBlob = null;"
    )

# 2. Start MediaRecorder
start_rec = """
            try {
                recognition.start();
            } catch(e) {
                console.error("Ошибка запуска распознавания:", e);
            }
"""
new_start_rec = """
            try {
                recognition.start();
            } catch(e) {
                console.error("Ошибка запуска распознавания:", e);
            }
            
            // Start actual audio recording
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };
                mediaRecorder.onstop = () => {
                    window.latestVoiceBlob = new Blob(audioChunks, { type: 'audio/webm' });
                };
                mediaRecorder.start();
            }).catch(err => console.log('Audio mic error:', err));
"""
js_content = js_content.replace(start_rec, new_start_rec)

# 3. Stop MediaRecorder
stop_rec = """
            isRecording = false;
            recognitionRunning = false;
            try { recognition.stop(); } catch(e) {}
"""
new_stop_rec = """
            isRecording = false;
            recognitionRunning = false;
            try { recognition.stop(); } catch(e) {}
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
"""
js_content = js_content.replace(stop_rec, new_stop_rec)

# 4. In manuallySubmitTask, add logic for "все"
submit_logic = """
            if (foundTeachers.length > 0) {
"""
new_submit_logic = """
            let isAll = text.toLowerCase().match(/^\\s*(всем|все|всё)\\b/);

            if (isAll) {
                promptText.textContent = `🚀 Отправляю голосовое сообщение всем...`;
                if (!window.latestVoiceBlob) {
                    promptText.textContent = `❌ Ошибка: нет аудио для отправки.`;
                    return;
                }
                const formData = new FormData();
                // Send raw blob
                fetch('http://127.0.0.1:8080/send_voice', {
                    method: 'POST',
                    body: window.latestVoiceBlob
                })
                .then(r => r.json())
                .then(res => {
                    if (res.status === 'ok') {
                        promptText.textContent = `✅ Голосовое сообщение отправлено всем сотрудникам!`;
                        const li = document.createElement('li');
                        li.className = 'task-item';
                        li.innerHTML = `
                            <div class="task-icon" style="background: #e0e7ff; color: #4f46e5;"><i class="fa-solid fa-bullhorn"></i></div>
                            <div class="task-details">
                                <span class="task-title" style="color: #4f46e5;">Массовое оповещение (Аудио)</span>
                                <span class="task-meta">Вы: ${text}</span>
                            </div>
                            <span class="task-source ai-source">Общая рассылка</span>
                        `;
                        taskList.prepend(li);
                    } else {
                        promptText.textContent = `❌ Ошибка отправки.`;
                    }
                }).catch(err => {
                    promptText.textContent = '❌ Ошибка: Бот не запущен.';
                });
                
            } else if (foundTeachers.length > 0) {
"""

js_content = js_content.replace(submit_logic, new_submit_logic)

with open('AIS.JS', 'w', encoding='utf-8') as f:
    f.write(js_content)
    
print("AIS.JS updated!")
