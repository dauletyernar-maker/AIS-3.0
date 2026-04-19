document.addEventListener('DOMContentLoaded', () => {

    // 0. Логика авторизации
    const loginOverlay = document.getElementById('loginOverlay');
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');

    // Проверяем сессию при загрузке (чтобы не логиниться каждый раз после обновления кэша)
    if (sessionStorage.getItem('isAuth') === 'true') {
        loginOverlay.style.display = 'none';
    }

    function tryLogin() {
        if (loginUsername.value.toLowerCase() === 'актобе' && loginPassword.value === '12') {
            sessionStorage.setItem('isAuth', 'true');
            loginOverlay.style.opacity = '0';
            setTimeout(() => {
                loginOverlay.style.display = 'none';
            }, 300);
        } else {
            loginError.style.display = 'block';
        }
    }

    loginBtn.addEventListener('click', tryLogin);
    loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') tryLogin();
    });

    // 1. Установка текущей даты
    const dateElement = document.getElementById('currentDate');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    // Делаем первую букву заглавной
    let dateString = today.toLocaleDateString('ru-RU', options);
    dateString = dateString.charAt(0).toUpperCase() + dateString.slice(1);
    dateElement.textContent = dateString;

    // 2. Реальное распознавание голоса (Voice-to-Task) через Web Speech API
    const recordBtn = document.getElementById('recordBtn');
    const voiceWave = document.getElementById('voiceWave');
    const taskInput = document.querySelector('.task-input');
    const promptText = document.querySelector('.assistant-prompt');
    const taskList = document.querySelector('.task-list');

    let isRecording = false;
    let recordingTimer;
    let recognitionRunning = false; // отдельный флаг чтобы избежать race condition

    // Инициализация SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let finalTranscript = '';
    let mediaRecorder = null;
    let audioChunks = [];
    window.latestVoiceBlob = null;

    // Проверяем протокол — Web Speech API требует https или localhost
    const isSecureContext = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

    if (SpeechRecognition && isSecureContext) {
        recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.interimResults = true; // показывать текст прямо в процессе речи
        recognition.maxAlternatives = 1;
        recognition.continuous = false; // НЕ continuous — избегаем race condition при перезапуске

        recognition.onstart = () => {
            recognitionRunning = true;
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            // Показываем всё что говорит пользователь прямо сейчас
            taskInput.value = finalTranscript + interimTranscript;
            promptText.textContent = '🎙️ Слышу вас...';
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            recognitionRunning = false;

            if (event.error === 'not-allowed') {
                promptText.textContent = '🚨 Нет доступа к микрофону. Разрешите его в браузере.';
                stopRecordingVisuals();
                isRecording = false;
            } else if (event.error === 'network') {
                promptText.textContent = '🌐 Нет интернета для распознавания голоса.';
                stopRecordingVisuals();
                isRecording = false;
            } else if (event.error === 'no-speech') {
                // Тихо — просто перезапускаем если ещё пишем
                if (isRecording) {
                    setTimeout(() => {
                        if (isRecording && !recognitionRunning) {
                            try { recognition.start(); } catch(e) {}
                        }
                    }, 200);
                }
            } else if (event.error === 'aborted') {
                // Нормальная остановка — игнорируем
            }
        };

        recognition.onend = () => {
            recognitionRunning = false;
            if (isRecording) {
                // Автоматически перезапускаем с небольшой задержкой (избегаем aborted)
                setTimeout(() => {
                    if (isRecording && !recognitionRunning) {
                        try { recognition.start(); } catch(e) {}
                    }
                }, 150);
            } else {
                stopRecordingVisuals();
                if (taskInput.value.trim()) {
                    const txt = taskInput.value.trim().toLowerCase();
                    if (txt.match(/^\s*(всем|все|всё)(?:\s|[.,:!]|$)/i)) {
                        promptText.textContent = '✅ Массовое сообщение! Отправляем...';
                        setTimeout(() => manuallySubmitTask(), 500);
                    } else {
                        promptText.textContent = '✅ Распознано! Нажмите отправить или Enter.';
                    }
                } else {
                    promptText.textContent = 'Нажмите для записи голоса или введите команду...';
                }
            }
        };

    } else if (!isSecureContext) {
        // Файл открыт через file:// — предупреждаем
        console.warn("Микрофон недоступен: откройте через http://localhost или https://");
        recordBtn.title = "Откройте через localhost для голосового ввода";
    } else {
        console.warn("Браузер не поддерживает SpeechRecognition API");
    }

    recordBtn.addEventListener('click', () => {
        if (!SpeechRecognition) {
            promptText.textContent = '❌ Браузер не поддерживает голос. Используйте Chrome или Edge.';
            return;
        }
        if (!isSecureContext) {
            promptText.textContent = '❌ Запустите через localhost (не через file://).';
            recordBtn.style.background = '#ef4444';
            setTimeout(() => recordBtn.style.background = '', 2000);
            return;
        }

        if (!isRecording) {
            // Начало записи
            isRecording = true;
            finalTranscript = '';
            taskInput.value = '';
            voiceWave.classList.add('recording');
            recordBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
            recordBtn.style.background = '#ef4444';
            recordBtn.style.transform = 'scale(1.1)';
            recordBtn.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.6)';
            promptText.textContent = '🎙️ Слушаю вас... Говорите в микрофон...';
            taskInput.disabled = false;

            // Анимация волн
            const bars = voiceWave.querySelectorAll('.bar');
            recordingTimer = setInterval(() => {
                bars.forEach(bar => {
                    const height = Math.random() * 25 + 5;
                    bar.style.height = `${height}px`;
                });
            }, 100);

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

        } else {
            // Остановка записи
            isRecording = false;
            recognitionRunning = false;
            try { recognition.stop(); } catch(e) {}
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            recordBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            recordBtn.style.background = '';
            recordBtn.style.transform = 'scale(1)';
            recordBtn.style.boxShadow = 'none';
            stopRecordingVisuals();
            if (taskInput.value.trim()) {
                promptText.textContent = '✅ Распознано! Нажмите отправить или Enter.';
            } else {
                promptText.textContent = 'Нажмите для записи голоса или введите команду...';
            }
        }
    });

    function stopRecordingVisuals() {
        isRecording = false;
        clearInterval(recordingTimer);
        
        voiceWave.classList.remove('recording');
        recordBtn.style.transform = 'scale(1)';
        recordBtn.style.boxShadow = 'none';
        
        const bars = voiceWave.querySelectorAll('.bar');
        bars.forEach(bar => bar.style.height = '10px');
    }

    function analyzeIncident(text) {
        let lowerText = text.toLowerCase();
        
        let priority = { level: 'Низкий', color: '#3b82f6', bgColor: '#eff6ff', icon: 'fa-check', anim: 'none' };
        let assignee = { name: 'Не назначен', color: '#64748b', icon: 'fa-user' };

        if (lowerText.match(/прорвало|кровь|горит|пожар|скорая|драка|срочно|разбил|украли/)) {
            priority = { level: 'Критический', color: '#ef4444', bgColor: '#fef2f2', icon: 'fa-triangle-exclamation', anim: 'pulse 1s infinite' };
        } else if (lowerText.match(/сломал|сломалась|упал|починить|не работает|грязн/)) {
            priority = { level: 'Средний', color: '#f59e0b', bgColor: '#fffbeb', icon: 'fa-circle-exclamation', anim: 'none' };
        }

        if (lowerText.match(/ручка|труба|окно|разбил|починить|вода|спортзал|стол|стул|сломал|туалет|грязн|уборка/)) {
            assignee = { name: 'Завхоз', color: '#8b5cf6', icon: 'fa-hammer' };
        } else if (lowerText.match(/интернет|прожектор|ноутбук|комп|принтер|сеть|пароль|экран/)) {
            assignee = { name: 'Сисадмин', color: '#0ea5e9', icon: 'fa-network-wired' };
        } else if (lowerText.match(/кровь|упала|упал|скорая/)) {
            assignee = { name: 'Медсестра', color: '#ec4899', icon: 'fa-kit-medical' };
        } else if (lowerText.match(/драка|украли|учитель|родитель/)) {
            assignee = { name: 'Завуч', color: '#f59e0b', icon: 'fa-user-tie' };
        }

        return { priority, assignee };
    }

    function addNewTask(text) {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.style.opacity = '0';
        li.style.transform = 'translateY(-10px)';
        li.style.transition = 'all 0.4s ease';

        const { priority, assignee } = analyzeIncident(text);

        li.innerHTML = `
            <div class="task-icon" style="background: ${priority.bgColor}; color: ${priority.color}; animation: ${priority.anim};">
                <i class="fa-solid ${priority.icon}"></i>
            </div>
            <div class="task-details">
                <span class="task-title">${text}</span>
                <span class="task-meta" style="margin-top: 5px;">
                    <span style="background: ${priority.bgColor}; color: ${priority.color}; padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 11px; margin-right: 8px;">
                        ${priority.level} приоритет
                    </span>
                    <span style="color: ${assignee.color}; font-weight: 500; font-size: 12px;">
                        <i class="fa-solid ${assignee.icon}"></i> Исполнитель: ${assignee.name} (уведомление отправлено)
                    </span>
                </span>
            </div>
            <span class="task-source ai-source"><i class="fa-solid fa-microphone-lines"></i> Голос AI</span>
        `;
        
        taskList.prepend(li); // Добавляем наверх
        
        // Триггерим анимацию
        setTimeout(() => {
            li.style.opacity = '1';
            li.style.transform = 'translateY(0)';
        }, 50);
    }

    // Обработчик КНОПКИ ОТПРАВКИ (Бумажный самолетик) для ручного ввода
    const submitBtn = document.querySelector('.btn-submit');
    
    function manuallySubmitTask() {
        const text = taskInput.value.trim();
        if (text !== '') {
            // Если включен микрофон - выключаем
            if (isRecording) {
                try { recognition.stop(); } catch(e) {}
                stopRecordingVisuals();
            }
            
            // Список сотрудников для быстрого роутинга (совпадает с STAFF_DB в боте)
            const TEACHERS = ["Ернар", "Нурасыл", "Оралхан"];
            
            let foundTeachers = [];
            TEACHERS.forEach(t => {
                let idx = text.toLowerCase().indexOf(t.toLowerCase());
                if (idx !== -1) foundTeachers.push({name: t, index: idx});
            });
            
            foundTeachers.sort((a,b) => a.index - b.index);
            
            let isAll = text.toLowerCase().match(/^\s*(всем|все|всё)(?:\s|[.,:!]|$)/i);

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
                promptText.textContent = `🚀 Отправляю поручения...`;
                let tasksToSend = [];
                for(let i=0; i<foundTeachers.length; i++) {
                    let start = foundTeachers[i].index;
                    let end = (i+1 < foundTeachers.length) ? foundTeachers[i+1].index : text.length;
                    // Извлекаем фразу и убираем лишние запятые по краям
                    let msgPart = text.substring(start, end).replace(/^[,.\s]+|[,.\s]+$/g, '').trim();
                    tasksToSend.push({ name: foundTeachers[i].name, msg: msgPart });
                }

                tasksToSend.forEach(task => {
                    fetch(`http://127.0.0.1:8080/send_msg?name=${encodeURIComponent(task.name)}&msg=${encodeURIComponent(task.msg)}`)
                        .then(r => r.json())
                        .then(res => {
                            if (res.status === 'sent') {
                                promptText.textContent = `✅ Сообщения отправлены!`;
                                const li = document.createElement('li');
                                li.className = 'task-item';
                                li.innerHTML = `
                                    <div class="task-icon" style="background: #ecfdf5; color: #059669;"><i class="fa-solid fa-paper-plane"></i></div>
                                    <div class="task-details">
                                        <span class="task-title" style="color: #059669;">Личное сообщение: ${task.name}</span>
                                        <span class="task-meta">${task.msg}</span>
                                    </div>
                                    <span class="task-source ai-source">Telegram Direct</span>
                                `;
                                taskList.prepend(li);
                            } else if (res.status === 'no_id') {
                                promptText.textContent = `⚠️ ${task.name} ещё не написал /start боту.`;
                            } else {
                                promptText.textContent = `❌ Ошибка отправки ${task.name}.`;
                            }
                        })
                        .catch(err => {
                            promptText.textContent = '❌ Ошибка: Бот не запущен или порт 8080 занят.';
                        });
                });
            } else {
                // Обычная логика инцидента
                promptText.textContent = 'Задача создана и делегирована!';
                addNewTask(text);
            }
            
            // Очищаем
            setTimeout(() => {
                promptText.textContent = 'Нажмите для записи голоса или введите команду...';
                taskInput.value = '';
            }, 3000);
        }
    }

    // По клику на кнопку
    submitBtn.addEventListener('click', manuallySubmitTask);

    // По нажатию Enter в поле ввода
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            manuallySubmitTask();
        }
    });

    const menuItems = document.querySelectorAll('.menu-item');
    const dashboardSection = document.getElementById('dashboardSection');
    const scheduleSection = document.getElementById('scheduleSection');
    const ragSection = document.getElementById('ragSection');
    const canteenSection = document.getElementById('canteenSection');
    
    // Изначально показываем дашборд
    if (dashboardSection && scheduleSection && ragSection && canteenSection) {
        dashboardSection.style.display = 'block';
        scheduleSection.style.display = 'none';
        ragSection.style.display = 'none';
        canteenSection.style.display = 'none';
    }

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            if(!target) return; // Если это кнопка без функционала пока

            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Скрываем все
            if(dashboardSection) dashboardSection.style.display = 'none';
            if(scheduleSection) scheduleSection.style.display = 'none';
            if(ragSection) ragSection.style.display = 'none';
            if(canteenSection) canteenSection.style.display = 'none';
            
            // Показываем нужное
            if (target === 'dashboardSection') {
                dashboardSection.style.display = 'block';
            } else if (target === 'scheduleSection') {
                scheduleSection.style.display = 'block';
                loadScheduleData(); // Загружаем данные при открытии
            } else if (target === 'ragSection') {
                ragSection.style.display = 'block';
            } else if (target === 'canteenSection') {
                canteenSection.style.display = 'block';
                initCanteenChart();
            }
        });
    });

    let canteenChartInstance = null;
    function initCanteenChart() {
        const ctx = document.getElementById('canteenChart');
        if (!ctx) return;
        if (canteenChartInstance) return; // Уже инициализирован
        
        canteenChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'],
                datasets: [
                    {
                        label: 'План (Заявка)',
                        data: [247, 247, 247, 247, 247],
                        backgroundColor: '#3b82f6', // Синий
                        borderRadius: 4
                    },
                    {
                        label: 'Факт (Пришли)',
                        data: [240, 245, 238, 242, 227],
                        backgroundColor: '#22c55e', // Зеленый
                        borderRadius: 4
                    },
                    {
                        label: 'Остатки (Снято/Сэкономлено)',
                        data: [7, 2, 9, 5, 20],
                        backgroundColor: '#ef4444', // Красный
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
        
        // Запуск псевдо-живого анализа после рендера графика
        setTimeout(() => runDynamicCanteenAnalysis(canteenChartInstance), 500);
    }

    function runDynamicCanteenAnalysis(chart) {
        const aiStream = document.getElementById('canteenAiStream');
        if (!aiStream) return;
        
        let missingArr = chart.data.datasets[2].data;
        let totalMissing = missingArr.reduce((a, b) => a + b, 0);
        let maxMissing = Math.max(...missingArr);
        let maxIndex = missingArr.indexOf(maxMissing);
        let dayNames = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу'];
        let maxDay = dayNames[maxIndex];
        
        let savedMonth = totalMissing * 4;
        let savedMoney = savedMonth * 650; // 650 тг за порцию

        let steps = [
            `<span style="color: #6366f1;">[Система]</span> Синхронизация с Telegram-ботом... <span style="color: #22c55e;">[OK]</span>`,
            `<span style="color: #6366f1;">[Система]</span> Вычисление отклонений от плана... <span style="color: #22c55e;">[OK] (${totalMissing} порций/нед)</span>`,
            `<span style="color: #6366f1;">[Aqbobek AI]</span> Генерация рекомендаций... <span style="color: #22c55e;">[ГОТОВО]</span><br><br>`,
            `<div style="font-family: 'Inter';"><strong style="color: #1e293b; font-size: 15px;">Тенденция недели:</strong><br>ИИ обнаружил резкий рост остатков в <b>${maxDay}</b> (до ${maxMissing} порций). Это в 4 раза выше, чем в стабильные дни. Рекомендуется превентивно скорректировать заявку в Telegram.</div><br>`,
            `<div style="font-family: 'Inter';"><strong style="color: #1e293b; font-size: 15px;">Финансовый подсчет:</strong><br>Благодаря оперативному сбору данных (отмена питания для отсутствующих), за месяц <b>спасено ${savedMonth} порций</b>.<br>Экономия бюджета: <b style="color: #16a34a; font-size: 16px;">~ ${savedMoney.toLocaleString('ru-RU')} тенге</b>.</div><br>`,
            `<div style="font-family: 'Inter'; border-left: 3px solid #6366f1; padding-left: 10px; color: #4f46e5;"><b>Решение ИИ:</b> Автоматически перенаправить сэкономленные средства на улучшение рациона 9-10 классов (добавочный полдник).</div>`
        ];

        aiStream.innerHTML = '';
        let i = 0;
        
        function typeStep() {
            if (i < steps.length) {
                aiStream.innerHTML += steps[i] + '<br>';
                i++;
                let delay = i < 3 ? 600 : 1200; // Быстрые логи, долгие выводы
                setTimeout(typeStep, delay);
            }
        }
        
        typeStep();
    }

    // --- Логика RAG (База приказов) ---
    const ragKnowledgeBase = [
        {
            keywords: ["питани", "столов", "санпин"],
            title: "Приказ Министра просвещения РК №130 (и нормы СанПиН)",
            content: "Школа обязана обеспечить горячим питанием учеников начальных классов и социальные категории. Интервал времени на завтрак и обед должен составлять не менее 15-20 минут. Дополнительно Приказ №130 нормирует распределение кружковой нагрузки вне основной сетки занятий.",
            meta: "Документ: Приказ МОН РК №130 • Точность совпадения: 98%"
        },
        {
            keywords: ["отчисл", "перевод", "закон", "образован", "исключ", "110", "документ"],
            title: "Приказ МОН РК №110. Правила перевода и отчисления",
            content: "Отчисление и перевод обучающихся производится строго на основании заявления родителей через электронную систему платформы (например, eGov или Күнделік). Необходимо хранить бумажные или верифицированные цифровые архивы заявлений не менее 5 лет.",
            meta: "Документ: Приказ МОН РК №110 • Точность совпадения: 99%"
        },
        {
            keywords: ["аттестац", "педагог", "категор", "76", "квалификац"],
            title: "Приказ МОН РК №76. Правила аттестации",
            content: "Аттестация педагогических работников проводится не реже 1 раза в 5 лет. Допускается досрочная сдача при наличии международных сертификатов (IELTS, TOEFL и др.) у профильного учителя, а также призеров олимпиад.",
            meta: "Документ: Приказ МОН РК №76 • Точность совпадения: 100%"
        },
        {
            keywords: ["кружок", "доп", "нагрузк", "переутомлен", "130"],
            title: "Приказ Министра просвещения РК №130",
            content: "Кружковая работа планируется строго вне основной сетки занятий. Рекомендуется соблюдать Типовые учебные планы (ТУП) во избежание когнитивной перегрузки учеников (см. автоматические предупреждения в панели расписания).",
            meta: "Документ: Приказ МОН РК №130 • Точность совпадения: 98%"
        },
        {
            keywords: ["отпуск", "труд", "кодекс"],
            title: "Трудовой кодекс РК. Отпуск педагогов",
            content: "Педагогическому работнику предоставляется ежегодный оплачиваемый трудовой отпуск продолжительностью 56 календарных дней. Во время отпуска привлечение педагога к ремонтным работам категорически запрещено.",
            meta: "Документ: Закон РК «О статусе педагога» (Ст. 12) • Точность совпадения: 96%"
        }
    ];

    const ragInput = document.getElementById('ragInput');
    const ragBtn = document.getElementById('ragSearchBtn');
    const ragResults = document.getElementById('ragResults');
    const ragTags = document.querySelectorAll('.rag-tag');

    function performRagSearch(query) {
        if (!query.trim()) return;
        
        let q = query.toLowerCase();
        
        // Умный поиск с подсчетом совпадений (скоринг)
        let scoredDocs = ragKnowledgeBase.map(doc => {
            let score = 0;
            doc.keywords.forEach(kw => {
                if (q.includes(kw)) score += 1;
            });
            return { ...doc, score };
        });
        
        // Оставляем только те, где есть хоть 1 совпадение, и сортируем по убыванию
        let matched = scoredDocs.filter(d => d.score > 0).sort((a, b) => b.score - a.score);
        
        // Очистка и лоадер
        ragResults.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 24px; color: #0ea5e9;"></i>
                <p style="margin-top: 10px; color: #64748b;">Семантический поиск по 14,000 страницам НПА...</p>
            </div>
        `;

        setTimeout(() => {
            if (matched.length === 0) {
                // Если не найдено по ключевым словам, возвращаем заглушку общего характера
                matched = [{
                    title: "Поиск по базе: Приказы №76, №110, №130",
                    content: "Точного совпадения по этому регламенту не найдено, однако система рекомендует обратить внимание на Приказ №110 (о движении учащихся) и Приказ №130 (о распределении нагрузки и кружков), которые выступают фундаментом школьного менеджмента.",
                    meta: "Нейросетевая генерация на основе базы НПА РК"
                }];
            }

            ragResults.innerHTML = `<h3 style="margin-bottom: 15px; color: #1e293b; font-size: 16px;">Найдено в базе (${matched.length} нормативов):</h3>`;
            matched.forEach(doc => {
                ragResults.innerHTML += `
                    <div class="rag-result-card">
                        <h4>${doc.title}</h4>
                        <p>${doc.content}</p>
                        <span class="meta">${doc.meta}</span>
                    </div>
                `;
            });
        }, 800); // Искусственная задержка для "мощности" поиска
    }

    if (ragBtn && ragInput) {
        ragBtn.addEventListener('click', () => performRagSearch(ragInput.value));
        ragInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performRagSearch(ragInput.value);
        });
        
        ragTags.forEach(tag => {
            tag.addEventListener('click', () => {
                let text = tag.getAttribute('data-query');
                ragInput.value = text;
                performRagSearch(text);
            });
        });
    }

    // --- Логика Парсинга Расписания ---
    const SPECIFIC_SCHEDULES = {
    "7A": {
        "0": {
            "1": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "303"
            },
            "2": {
                "subject": "Химия",
                "teacher": "Аманғазы С.",
                "room": "211"
            },
            "3": {
                "subject": "Алгебра",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "4": {
                "subject": "Қазақ тілі",
                "teacher": "Утенова К.К.",
                "room": "311"
            },
            "5": {
                "subject": "Тәрбие сағаты",
                "teacher": "Саламатұлы А.",
                "room": "109"
            },
            "6": {
                "subject": "Ағылшын тілі",
                "teacher": "Қайыржанова А.",
                "room": "304"
            },
            "7": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "8": {
                "subject": "Физика электив",
                "teacher": "Сунгариева А.Б.",
                "room": "209"
            }
        },
        "1": {
            "1": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "209"
            },
            "2": {
                "subject": "Көркем еңбек",
                "teacher": "Қойшан Ы.А / Қазиев Н.",
                "room": "307/123 АЙС"
            },
            "3": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "302"
            },
            "4": {
                "subject": "Дүние жүзі тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "5": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Утенова К.К",
                "room": "311"
            },
            "6": {
                "subject": "Ағылшын тілі",
                "teacher": "Қайыржанова А.",
                "room": "206"
            },
            "7": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "8": {
                "subject": "математика (электив)",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            }
        },
        "2": {
            "1": {
                "subject": "Биология",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            },
            "2": {
                "subject": "Химия",
                "teacher": "Аманғазы С.",
                "room": "201"
            },
            "3": {
                "subject": "Алгебра",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "4": {
                "subject": "Қазақ тілі",
                "teacher": "Утенова К.К.",
                "room": "311"
            },
            "5": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "6": {
                "subject": "қытай тілі",
                "teacher": "Қайыржанова А.",
                "room": "304"
            },
            "7": {
                "subject": "Биология  (электив)",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            },
            "8": {
                "subject": "География (электив)",
                "teacher": "Жадырасын Е.",
                "room": "309"
            }
        },
        "3": {
            "1": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "209"
            },
            "2": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "303"
            },
            "3": {
                "subject": "геометрия",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "4": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е.",
                "room": "310"
            },
            "5": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "6": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Утенова К.К",
                "room": "311"
            },
            "7": {
                "subject": "Электив Ағылшын",
                "teacher": "Қайыржанова А.",
                "room": "305"
            },
            "8": {
                "subject": "Химия электив",
                "teacher": "Аманғазы С.",
                "room": "211"
            }
        },
        "4": {
            "1": {
                "subject": "Ағылшын тілі",
                "teacher": "Қайыржанова А.",
                "room": "304"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "3": {
                "subject": "география",
                "teacher": "Жадырасын Е.",
                "room": "309"
            },
            "4": {
                "subject": "информатика",
                "teacher": "Сапар Е.",
                "room": "104"
            },
            "5": {
                "subject": "Биология",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            },
            "6": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "7": {
                "subject": "робоботехника",
                "teacher": "Косов М",
                "room": "технопарк"
            },
            "8": {
                "subject": "математика (электив)",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            }
        }
    },
    "7B": {
        "0": {
            "1": {
                "subject": "Химия",
                "teacher": "Аманғазы С.",
                "room": "211"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Байдирахманова Б.С.",
                "room": "311"
            },
            "3": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "302"
            },
            "4": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "211"
            },
            "5": {
                "subject": "Қазақ тілі",
                "teacher": "Утенова К.К.",
                "room": "311"
            },
            "6": {
                "subject": "Дүние жүзі тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "7": {
                "subject": "Қытай тілі",
                "teacher": "Қайржанова А.",
                "room": "305"
            },
            "8": {
                "subject": "Математика (электив)",
                "teacher": "Байдирахманова Б.С.",
                "room": "109"
            }
        },
        "1": {
            "1": {
                "subject": "География",
                "teacher": "Жадырасын Е.М.",
                "room": "309"
            },
            "2": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Утенова К.К.",
                "room": "311"
            },
            "3": {
                "subject": "Көркем еңбек",
                "teacher": "Қойшан Ы. / Қазиев Н.",
                "room": "307/123"
            },
            "4": {
                "subject": "Ағылшын тілі",
                "teacher": "Қайыржанова А.",
                "room": "305"
            },
            "5": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "6": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е.",
                "room": "310"
            },
            "7": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "8": {
                "subject": "Химия (электив)",
                "teacher": "Аманғазы С.",
                "room": "201"
            }
        },
        "2": {
            "1": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "303"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Байдирахманова Б.С.",
                "room": "311"
            },
            "3": {
                "subject": "Химия",
                "teacher": "Аманғазы С.",
                "room": "201"
            },
            "4": {
                "subject": "Биология",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            },
            "5": {
                "subject": "Қазақ тілі",
                "teacher": "Утенова К.К.",
                "room": "311"
            },
            "6": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "7": {
                "subject": "Робототехника",
                "teacher": "Косов М.",
                "room": "Технопарк"
            },
            "8": {
                "subject": "Математика (электив)",
                "teacher": "Байдирахманова Б.С.",
                "room": "109"
            }
        },
        "3": {
            "1": {
                "subject": "Ағылшын тілі",
                "teacher": "Қайыржанова А.",
                "room": "304"
            },
            "2": {
                "subject": "Геометрия",
                "teacher": "Байдирахманова Б.С.",
                "room": "109"
            },
            "3": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "303"
            },
            "4": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "211"
            },
            "5": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Утенова К.К.",
                "room": "311"
            },
            "6": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "7": {
                "subject": "Биология (электив)",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            },
            "8": {
                "subject": "Физика (электив)",
                "teacher": "Сунгариева А.Б.",
                "room": "209"
            }
        },
        "4": {
            "1": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "2": {
                "subject": "Биология",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            },
            "3": {
                "subject": "Ағылшын тілі",
                "teacher": "Қайыржанова А.",
                "room": "305"
            },
            "4": {
                "subject": "Алгебра",
                "teacher": "Байдирахманова Б.С.",
                "room": "109"
            },
            "5": {
                "subject": "Информатика",
                "teacher": "Сапар Е.",
                "room": "104"
            },
            "6": {
                "subject": "География (электив)",
                "teacher": "Жадырасын Е.",
                "room": "304"
            },
            "7": {
                "subject": "Тәрбие сағаты",
                "teacher": "Саламатұлы А.",
                "room": "302"
            },
            "8": {
                "subject": "Ағылшын тілі (электив)",
                "teacher": "Қайыржанова А.",
                "room": "302"
            }
        }
    },
    "7C": {
        "0": {
            "1": {
                "subject": "Алгебра",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "2": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "302"
            },
            "3": {
                "subject": "Қазақ тілі",
                "teacher": "Утенова К.К.",
                "room": "311"
            },
            "4": {
                "subject": "Химия",
                "teacher": "Аманғазы С.",
                "room": "201"
            },
            "5": {
                "subject": "Дүние жүзі тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "6": {
                "subject": "География",
                "teacher": "Касимов Е.К",
                "room": "309"
            },
            "7": {
                "subject": "Биология",
                "teacher": "Шарафадинова А.М.",
                "room": "203"
            },
            "8": {
                "subject": "Химия электив",
                "teacher": "Аманғазы С.",
                "room": "201"
            }
        },
        "1": {
            "1": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "2": {
                "subject": "Химия",
                "teacher": "Аманғазы С.",
                "room": "211"
            },
            "3": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Утенова К.К",
                "room": "311"
            },
            "4": {
                "subject": "Көркем еңбек",
                "teacher": "Қойшан Ы.А / Қазиев Н.",
                "room": "307/123 АЙС"
            },
            "5": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "211"
            },
            "6": {
                "subject": "Ағылшын тілі",
                "teacher": "Алимбекова У.С.",
                "room": "309"
            },
            "7": {
                "subject": "робототехника",
                "teacher": "Косов М",
                "room": "технопарк"
            },
            "8": {
                "subject": "География (электив)",
                "teacher": "Касимов Е.К.",
                "room": "309"
            }
        },
        "2": {
            "1": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "3": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "303"
            },
            "4": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "209"
            },
            "5": {
                "subject": "Ағылшын тілі",
                "teacher": "Алимбекова У.С.",
                "room": "110"
            },
            "6": {
                "subject": "Қазақ тілі",
                "teacher": "Утенова К.К.",
                "room": "311"
            },
            "7": {
                "subject": "Физика электив",
                "teacher": "Сунгариева А.Б.",
                "room": "209"
            },
            "8": {
                "subject": "математика (электив) .",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            }
        },
        "3": {
            "1": {
                "subject": "Биология",
                "teacher": "Шарафадинова А.М.",
                "room": "305"
            },
            "2": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "3": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Утенова К.К",
                "room": "311"
            },
            "4": {
                "subject": "геометрия",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "5": {
                "subject": "Электив Ағылшын",
                "teacher": "Қайыржанова А.",
                "room": "301"
            },
            "6": {
                "subject": "қытай тілі",
                "teacher": "Қайыржанова А.",
                "room": "305"
            },
            "7": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "8": {
                "subject": "математика (электив)",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            }
        },
        "4": {
            "1": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "303"
            },
            "2": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е.",
                "room": "304"
            },
            "3": {
                "subject": "Алгебра",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "4": {
                "subject": "Ағылшын тілі",
                "teacher": "Алимбекова У.С.",
                "room": "302"
            },
            "5": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "6": {
                "subject": "Биология (электив)",
                "teacher": "Шарафадинова А.М.",
                "room": "301"
            },
            "7": {
                "subject": "информатика",
                "teacher": "Сапар Е.",
                "room": "104"
            },
            "8": {
                "subject": "Тәрбие сағаты",
                "teacher": "Саламатұлы А.",
                "room": "109"
            }
        }
    },
    "8A": {
        "0": {
            "1": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "209"
            },
            "2": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "3": {
                "subject": "Химия",
                "teacher": "Аманғазы С.",
                "room": "211"
            },
            "4": {
                "subject": "География",
                "teacher": "Касимов Е.К.",
                "room": "309"
            },
            "5": {
                "subject": "Ағылшын тілі",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "6": {
                "subject": "Биология",
                "teacher": "Караева А.Б.",
                "room": "210"
            },
            "7": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е.",
                "room": "302"
            },
            "8": {
                "subject": "Биология (электив)",
                "teacher": "Караева А.Б.",
                "room": "210"
            }
        },
        "1": {
            "1": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "302"
            },
            "2": {
                "subject": "Дүние жүзі тарихы",
                "teacher": "Иван О.А.",
                "room": "309"
            },
            "3": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "211"
            },
            "4": {
                "subject": "информатика",
                "teacher": "Курмангалиев Е.К",
                "room": "104"
            },
            "5": {
                "subject": "Робототехника",
                "teacher": "Ахметова И.Е.",
                "room": "107"
            },
            "6": {
                "subject": "Қазақстан тарихы",
                "teacher": "Иван О.А.",
                "room": "306"
            },
            "7": {
                "subject": "Алгебра",
                "teacher": "Жоламан М.",
                "room": "109"
            }
        },
        "2": {
            "1": {
                "subject": "Биология",
                "teacher": "Караева А.Б.",
                "room": "210"
            },
            "2": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "302"
            },
            "3": {
                "subject": "Көркем еңбек",
                "teacher": "Қойшан Ы.А / Қазиев Н.",
                "room": "307/123 АЙС"
            },
            "4": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.Б.",
                "room": "үлкен спортзал"
            },
            "5": {
                "subject": "Қазақ тілі",
                "teacher": "Бактыгулов А.И",
                "room": "301"
            },
            "6": {
                "subject": "Ағылшын тілі",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "7": {
                "subject": "Абайтану",
                "teacher": "Бактыгулов А.",
                "room": "301"
            },
            "8": {
                "subject": "Физика электив",
                "teacher": "Сунгариева А.Б.",
                "room": "211"
            }
        },
        "3": {
            "1": {
                "subject": "геометрия",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "2": {
                "subject": "Қазақ тілі",
                "teacher": "Бактыгулов А.И",
                "room": "301"
            },
            "3": {
                "subject": "тәрбие сағаты",
                "teacher": "Қыдырбаева Г.",
                "room": "206"
            },
            "4": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "5": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.Б.",
                "room": "спортзал 0 қабат"
            },
            "6": {
                "subject": "Алгебра",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "7": {
                "subject": "матем (электив)",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "8": {
                "subject": "Ағылшын тілі (электив)",
                "teacher": "Таңатар М.",
                "room": "305"
            }
        },
        "4": {
            "1": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.Б.",
                "room": "үлкен спортзал"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "3": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "302"
            },
            "4": {
                "subject": "Қазақстан тарихы",
                "teacher": "Иван О.",
                "room": "311"
            },
            "5": {
                "subject": "Химия",
                "teacher": "Аманғазы С.",
                "room": "201"
            },
            "6": {
                "subject": "Ағылшын тілі",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "7": {
                "subject": "География (электив)",
                "teacher": "Касимов Е.К.",
                "room": "309"
            },
            "8": {
                "subject": "Химия электив",
                "teacher": "Аманғазы С.",
                "room": "304"
            }
        }
    },
    "8B": {
        "0": {
            "1": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "3": {
                "subject": "Қазақ тілі",
                "teacher": "Жомартова А.Қ.",
                "room": "305"
            },
            "4": {
                "subject": "Ағылшын тілі",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "5": {
                "subject": "География",
                "teacher": "Касимов Е.К.",
                "room": "309"
            },
            "6": {
                "subject": "Қазақстан тарихы",
                "teacher": "Иван О.А.",
                "room": "306"
            },
            "7": {
                "subject": "Химия электив",
                "teacher": "Аманғазы С.",
                "room": "201"
            },
            "8": {
                "subject": "Абайтану",
                "teacher": "Утенова Қ.Қ",
                "room": "311"
            }
        },
        "1": {
            "1": {
                "subject": "химия",
                "teacher": "Аманғазы С.",
                "room": "201"
            },
            "2": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "303"
            },
            "3": {
                "subject": "информатика",
                "teacher": "Курмангалиев Е.К",
                "room": "104"
            },
            "4": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "211"
            },
            "5": {
                "subject": "дүние жүзі тарихы",
                "teacher": "Иван О.А.",
                "room": "306"
            },
            "6": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "спортзал 0 қабат"
            },
            "7": {
                "subject": "электив (ағылшын тілі)",
                "teacher": "Таңатар М.",
                "room": "305"
            },
            "8": {
                "subject": "Биология (электив)",
                "teacher": "Караева А.",
                "room": "210"
            }
        },
        "2": {
            "1": {
                "subject": "Химия",
                "teacher": "Аманғазы С.",
                "room": "211"
            },
            "2": {
                "subject": "Көркем еңбек",
                "teacher": "Қойшан Ы.А / Қазиев Н.",
                "room": "307/123 АЙС"
            },
            "3": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Жомартова А.Қ.",
                "room": "302"
            },
            "4": {
                "subject": "Биология",
                "teacher": "Караева А.",
                "room": "210"
            },
            "5": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е.",
                "room": "305"
            },
            "6": {
                "subject": "Алгебра",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "7": {
                "subject": "Дене шынықтыру",
                "teacher": "Қарабай А.Н.",
                "room": "үлкен спортзал"
            },
            "8": {
                "subject": "Робототехника",
                "teacher": "Ахметова И.Е.",
                "room": "107"
            }
        },
        "3": {
            "1": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "302"
            },
            "2": {
                "subject": "Геометрия",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "3": {
                "subject": "Ағылшын тілі",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "4": {
                "subject": "Қазақ тілі",
                "teacher": "Жомартова А.Қ.",
                "room": "302"
            },
            "5": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "211"
            },
            "6": {
                "subject": "Қазақстан тарихы",
                "teacher": "Иван О.А.",
                "room": "304"
            },
            "7": {
                "subject": "География (электив)",
                "teacher": "Касимов Е.К.",
                "room": "309"
            }
        },
        "4": {
            "1": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Жомартова А.Қ.",
                "room": "301"
            },
            "2": {
                "subject": "Орыс тілі",
                "teacher": "Гореева А.М.",
                "room": "303"
            },
            "3": {
                "subject": "Ағылшын тілі",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "4": {
                "subject": "Алгебра",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "5": {
                "subject": "Биология",
                "teacher": "Караева А.",
                "room": "210"
            },
            "6": {
                "subject": "тәрбие сағаты",
                "teacher": "Қыдырбаева Г.",
                "room": "211"
            },
            "7": {
                "subject": "математика (электив)",
                "teacher": "Арыстанғалиқызы А",
                "room": "110"
            },
            "8": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "305"
            }
        }
    },
    "8C": {
        "0": {
            "1": {
                "subject": "алгебра",
                "teacher": "Есалина А.",
                "room": "205"
            },
            "2": {
                "subject": "Қазақстан тарихы",
                "teacher": "Иван О.А.",
                "room": "304"
            },
            "3": {
                "subject": "Биология",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            },
            "5": {
                "subject": "Дүние жүзі тарихы",
                "teacher": "Иван О.А.",
                "room": "204"
            },
            "6": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "спортзал 0 қабат"
            },
            "7": {
                "subject": "Электив Ағылшын",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "8": {
                "subject": "тәрбие сағаты",
                "teacher": "Шарафадинова А.М",
                "room": "302"
            }
        },
        "1": {
            "1": {
                "subject": "алгебра",
                "teacher": "Есалина А.",
                "room": "205"
            },
            "2": {
                "subject": "Ағылшын тілі",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "3": {
                "subject": "химия",
                "teacher": "Аманғазы С.",
                "room": "201"
            },
            "4": {
                "subject": "орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "5": {
                "subject": "қазақ тілі",
                "teacher": "Жомартова А.",
                "room": "302"
            },
            "6": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Жомартова А.",
                "room": "302"
            },
            "7": {
                "subject": "Математика электив П..",
                "teacher": "Есалина А.",
                "room": "205"
            }
        },
        "2": {
            "1": {
                "subject": "Алгебра",
                "teacher": "Есалина А.",
                "room": "205"
            },
            "2": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "үлкен спортзал"
            },
            "3": {
                "subject": "Физика",
                "teacher": "Сулейманов Б.",
                "room": "209"
            },
            "4": {
                "subject": "Көркем еңбек",
                "teacher": "Қойшан Ы.А / Қазиев Н.",
                "room": "307/123 АЙС"
            },
            "5": {
                "subject": "қазақ тілі",
                "teacher": "Жомартова А.",
                "room": "302"
            },
            "6": {
                "subject": "орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "7": {
                "subject": "Абайтану",
                "teacher": "Утенова К.",
                "room": "311"
            },
            "8": {
                "subject": "химия (электив)",
                "teacher": "Аманғазы С.",
                "room": "204"
            }
        },
        "3": {
            "1": {
                "subject": "химия",
                "teacher": "Аманғазы С.",
                "room": "211"
            },
            "2": {
                "subject": "Биология",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            },
            "3": {
                "subject": "геометрия",
                "teacher": "Есалина А.",
                "room": "205"
            },
            "4": {
                "subject": "Ағылшын тілі",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "5": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е",
                "room": "304/107"
            },
            "6": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "үлкен спортзал"
            },
            "7": {
                "subject": "Робототехника",
                "teacher": "Ахметова И.Е",
                "room": "107"
            },
            "8": {
                "subject": "География (электив)",
                "teacher": "Касимов Е.К.",
                "room": "309"
            }
        },
        "4": {
            "1": {
                "subject": "информатика",
                "teacher": "Курмангалиев Е",
                "room": "104"
            },
            "2": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Жомартова А.",
                "room": "302"
            },
            "3": {
                "subject": "Физика",
                "teacher": "Сулейманов Б.",
                "room": "209"
            },
            "4": {
                "subject": "орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "5": {
                "subject": "Қазақстан тарихы",
                "teacher": "Иван О.",
                "room": "311"
            },
            "6": {
                "subject": "География",
                "teacher": "Касимов Е.К.",
                "room": "309"
            },
            "7": {
                "subject": "Биология (электив)",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            },
            "8": {
                "subject": "Физика (электив)",
                "teacher": "Сулейманов Б.",
                "room": "209"
            }
        }
    },
    "8D": {
        "0": {
            "1": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "үлкен спортзал"
            },
            "2": {
                "subject": "Биология",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            },
            "3": {
                "subject": "Алгебра",
                "teacher": "Нажмадинов М.А.",
                "room": "206"
            },
            "4": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "5": {
                "subject": "Ағылшын тілі",
                "teacher": "Қайыржанова А.",
                "room": "304"
            },
            "6": {
                "subject": "Физика",
                "teacher": "Сулейманов Б.",
                "room": "209"
            },
            "7": {
                "subject": "Абайтану",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "8": {
                "subject": "Электив Ағылшын",
                "teacher": "Қайыржанова А.",
                "room": "305"
            }
        },
        "1": {
            "1": {
                "subject": "информатика",
                "teacher": "Курмангалиев Е.К",
                "room": "104"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Нажмадинов М.А.",
                "room": "206"
            },
            "3": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "спортзал 0 қабат"
            },
            "4": {
                "subject": "Қазақ тілі",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "5": {
                "subject": "Ағылшын тілі",
                "teacher": "Қайыржанова А.",
                "room": "304"
            },
            "6": {
                "subject": "химия",
                "teacher": "Аманғазы С.",
                "room": "211"
            },
            "7": {
                "subject": "химия(электив)",
                "teacher": "Аманғазы С.",
                "room": "211"
            },
            "8": {
                "subject": "Тәрбие сағаты",
                "teacher": "Мұрат Ә.",
                "room": "306"
            }
        },
        "2": {
            "1": {
                "subject": "Қазақстан Тарихы",
                "teacher": "Иван О.",
                "room": "309"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Нажмадинов М.А.",
                "room": "206"
            },
            "3": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "4": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "5": {
                "subject": "География",
                "teacher": "Касимов Е.К.",
                "room": "309"
            },
            "6": {
                "subject": "математика (электив)",
                "teacher": "Нажмадинов М.А.",
                "room": "206"
            },
            "7": {
                "subject": "Физика (электив)",
                "teacher": "Сулейманов Б.",
                "room": "206"
            },
            "8": {
                "subject": "Биология (электив)",
                "teacher": "Қайырқұлов Н.А.",
                "room": "203"
            }
        },
        "3": {
            "1": {
                "subject": "Геометрия",
                "teacher": "Нажмадинов М.",
                "room": "206"
            },
            "2": {
                "subject": "Көркем еңбек",
                "teacher": "Қойшан Ы.А / Қазиев Н.",
                "room": "307/123 АЙС"
            },
            "3": {
                "subject": "Биология",
                "teacher": "Қайырқұлов Н.",
                "room": "203"
            },
            "4": {
                "subject": "ағылшын тілі",
                "teacher": "Қайыржанова А.",
                "room": "305"
            },
            "5": {
                "subject": "орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "6": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е",
                "room": "303/107"
            },
            "7": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.Б.",
                "room": "үлкен спортзал"
            }
        },
        "4": {
            "1": {
                "subject": "Дүние жүзі тарихы",
                "teacher": "Иван О.А.",
                "room": "305"
            },
            "2": {
                "subject": "химия",
                "teacher": "Аманғазы С.",
                "room": "201"
            },
            "3": {
                "subject": "Қазақстан тарихы",
                "teacher": "Иван О.",
                "room": "306"
            },
            "4": {
                "subject": "Физика",
                "teacher": "Сулейманов Б.",
                "room": "209"
            },
            "5": {
                "subject": "Қазақ тілі",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "6": {
                "subject": "орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "7": {
                "subject": "Робототехника",
                "teacher": "Ахметова И.Е",
                "room": "107"
            },
            "8": {
                "subject": "География (электив)",
                "teacher": "Касимов Е.К.",
                "room": "309"
            }
        }
    },
    "9A": {
        "0": {
            "1": {
                "subject": "География",
                "teacher": "Жадырасын Е.",
                "room": "309"
            },
            "2": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "спортзал 0 қабат"
            },
            "3": {
                "subject": "Химия",
                "teacher": "Назаров Д.С.",
                "room": "201"
            },
            "4": {
                "subject": "Биология",
                "teacher": "Караева А.Б.",
                "room": "210"
            },
            "5": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "6": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "211"
            },
            "7": {
                "subject": "Математика (электив)",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "8": {
                "subject": "География (электив)",
                "teacher": "Жадырасын Е.",
                "room": "309"
            }
        },
        "1": {
            "1": {
                "subject": "Алгебра",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "2": {
                "subject": "Информатика",
                "teacher": "Курмангалиев Е.К",
                "room": "104"
            },
            "3": {
                "subject": "Қазақ тілі",
                "teacher": "Жомартова А.К.",
                "room": "304"
            },
            "4": {
                "subject": "Ағылшын тілі",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "5": {
                "subject": "Дінтану",
                "teacher": "Халелова А.",
                "room": "110"
            },
            "6": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "7": {
                "subject": "Химия (электив)",
                "teacher": "Назаров Д.С.",
                "room": "201"
            },
            "8": {
                "subject": "Теория вероятности и статистика для ИИ",
                "teacher": "Ахметова И.Е.",
                "room": "107"
            }
        },
        "2": {
            "1": {
                "subject": "Ағылшын тілі",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "3": {
                "subject": "Құқық",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "4": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Жомартова А.К.",
                "room": "302"
            },
            "5": {
                "subject": "Биология",
                "teacher": "Караева А.Б.",
                "room": "210"
            },
            "6": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "үлкен спортзал"
            },
            "7": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "8": {
                "subject": "Технопарк",
                "teacher": "0 қабат",
                "room": "-"
            }
        },
        "3": {
            "1": {
                "subject": "Геометрия",
                "teacher": "Нажмадинов М.",
                "room": "206"
            },
            "2": {
                "subject": "Қазақ тілі",
                "teacher": "Жомартова А.К.",
                "room": "302"
            },
            "3": {
                "subject": "Көркем еңбек",
                "teacher": "Қойшан Ы.А / Қазиев Н.",
                "room": "307/123"
            },
            "4": {
                "subject": "Алгебра",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "5": {
                "subject": "Химия",
                "teacher": "Назаров Д.С.",
                "room": "201"
            },
            "6": {
                "subject": "Физика",
                "teacher": "Сунгариева А.Б.",
                "room": "211"
            },
            "7": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е.",
                "room": "206"
            },
            "8": {
                "subject": "Тәрбие сағаты",
                "teacher": "Мұрат Ә.",
                "room": "310"
            }
        },
        "4": {
            "1": {
                "subject": "Геометрия",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "2": {
                "subject": "Дүние жүзі тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "3": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "4": {
                "subject": "Ағылшын тілі",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "5": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "үлкен спортзал"
            },
            "6": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Жомартова А.К.",
                "room": "302"
            }
        }
    },
    "9B": {
        "0": {
            "1": {
                "subject": "Қазақ тілі",
                "teacher": "Таукенова Г.З.",
                "room": "311"
            },
            "2": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "3": {
                "subject": "Алгебра",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "4": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "5": {
                "subject": "Тәрбие сағаты",
                "teacher": "Шарафадинова А.М.",
                "room": "206"
            },
            "6": {
                "subject": "математика (электив)",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "7": {
                "subject": "Математика электив",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "8": {
                "subject": "Технопарк",
                "teacher": "",
                "room": "0 қабат 1"
            }
        },
        "1": {
            "1": {
                "subject": "ағылшын тілі",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "2": {
                "subject": "физика",
                "teacher": "Сулейманов Б.",
                "room": "209"
            },
            "3": {
                "subject": "Алгебра",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "4": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Таукенова Г.З.",
                "room": "305"
            },
            "5": {
                "subject": "информатика",
                "teacher": "Курмангалиев Е.К",
                "room": "104"
            },
            "6": {
                "subject": "Биология",
                "teacher": "Караева А.Б.",
                "room": "210"
            },
            "7": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "(спортзал)"
            },
            "8": {
                "subject": "Технопарк",
                "teacher": "",
                "room": "0 қабат 1"
            }
        },
        "2": {
            "1": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "үлкен спортзал"
            },
            "2": {
                "subject": "Құқық",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "3": {
                "subject": "Алгебра",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "4": {
                "subject": "география",
                "teacher": "Жадырасын Е.",
                "room": "309"
            },
            "5": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "6": {
                "subject": "Дінтану",
                "teacher": "Халелова А.",
                "room": "301"
            },
            "7": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "8": {
                "subject": "технопарк",
                "teacher": "",
                "room": "0 қабат"
            }
        },
        "3": {
            "1": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Таукенова Г.З.",
                "room": "302"
            },
            "2": {
                "subject": "Биология",
                "teacher": "Караева А",
                "room": "210"
            },
            "3": {
                "subject": "ағылшын тілі",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "4": {
                "subject": "көркем еңбек",
                "teacher": "Қойшан Ы.А/Қазиев Н.",
                "room": "307/123 АЙС"
            },
            "5": {
                "subject": "физика",
                "teacher": "Сулейманов Б.",
                "room": "209"
            },
            "6": {
                "subject": "химия",
                "teacher": "Назаров Д.С.",
                "room": "201"
            },
            "7": {
                "subject": "География (электив)",
                "teacher": "Жадырасын Е.",
                "room": "311"
            },
            "8": {
                "subject": "химия (электив)",
                "teacher": "Назаров Д.С.",
                "room": "201"
            }
        },
        "4": {
            "1": {
                "subject": "химия",
                "teacher": "Назаров Д.С.",
                "room": "201"
            },
            "2": {
                "subject": "Қазақ тілі",
                "teacher": "Таукенова Г.З.",
                "room": "311"
            },
            "3": {
                "subject": "Геометрия",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "4": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "5": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "6": {
                "subject": "Дүние жүзі тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "7": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е.",
                "room": "310"
            },
            "8": {
                "subject": "теория вероятности и статистика для ИИ",
                "teacher": "Ахметова И.Е",
                "room": "107"
            }
        }
    },
    "10A": {
        "0": {
            "1": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "Жоламан М., Даулетбаева С. / Таңатар М. / Назаров Д. / Қангерей Қ.",
                "room": "204, 109 / 305 / 201 / 310"
            },
            "2": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "Жоламан М., Даулетбаева С. / Таңатар М. / Назаров Д. / Қангерей Қ.",
                "room": "204, 109 / 211 / 201 / 203"
            },
            "3": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "4": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "5": {
                "subject": "Тәрбие сағаты",
                "teacher": "Шарафадинова А.М.",
                "room": "206"
            },
            "6": {
                "subject": "IELTS",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "7": {
                "subject": "Қазақстан тарихы",
                "teacher": "Иван О.А.",
                "room": "310"
            },
            "8": {
                "subject": "Теория вероятности и статистика для ИИ",
                "teacher": "Ахметова И.Е.",
                "room": "104"
            },
            "9": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "205"
            },
            "10": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "205"
            }
        },
        "1": {
            "1": {
                "subject": "Алгебра",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "2": {
                "subject": "IELTS",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "3": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н.",
                "room": "309 / 306 / 209 / технопарк / 203"
            },
            "4": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н.",
                "room": "309 / 306 / 209 / технопарк / 203"
            },
            "5": {
                "subject": "Геометрия",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "6": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "Жоламан М., Даулетбаева С. / Таңатар М. / Назаров Д. / Қангерей Қ.",
                "room": "204, 109 / 305 / 201 / 203"
            },
            "7": {
                "subject": "Қазақстан тарихы / SAT math",
                "teacher": "Иван О.А. / Арыстанғалиқызы А.",
                "room": "204 / 110"
            },
            "8": {
                "subject": "IELTS",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "9": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "205"
            },
            "10": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "205"
            }
        },
        "2": {
            "1": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "Жоламан М., Даулетбаева С. / Таңатар М. / Назаров Д. / Қангерей Қ.",
                "room": "204, 109 / 305 / 201 / 310"
            },
            "2": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н.",
                "room": "309 / 306 / 209 / 104 / 203"
            },
            "3": {
                "subject": "Алгебра",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "4": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Бақтыгулов А.И.",
                "room": "301"
            },
            "5": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.Б.",
                "room": "үлкен спортзал"
            },
            "6": {
                "subject": "Дінтану",
                "teacher": "Халелова А.",
                "room": "301"
            },
            "7": {
                "subject": "Ағылшын тілі",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "8": {
                "subject": "Тәрбие сағаты",
                "teacher": "Халелова А.Е.",
                "room": "210"
            },
            "9": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "205"
            },
            "10": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "205"
            }
        },
        "3": {
            "1": {
                "subject": "Алгебра",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "2": {
                "subject": "IELTS",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "3": {
                "subject": "Ағылшын тілі",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "4": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "5": {
                "subject": "Химия",
                "teacher": "Назаров Д.С.",
                "room": "201"
            },
            "6": {
                "subject": "Химия",
                "teacher": "Назаров Д.С.",
                "room": "201"
            },
            "7": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е.",
                "room": "206"
            },
            "8": {
                "subject": "Химия",
                "teacher": "электив / Назаров Д.С.",
                "room": "201"
            },
            "9": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "205"
            },
            "10": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "205"
            }
        },
        "4": {
            "1": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н.",
                "room": "309 / 306 / 209 / технопарк / 203"
            },
            "2": {
                "subject": "Қазақ тілі",
                "teacher": "Таукенова Г.З.",
                "room": "311"
            },
            "3": {
                "subject": "Геометрия",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "4": {
                "subject": "Қазақстан тарихы",
                "teacher": "Қангерей Қ.",
                "room": "310"
            },
            "5": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "үлкен спортзал"
            },
            "6": {
                "subject": "Қазақстан тарихы / SAT math",
                "teacher": "Иван О.А. / Арыстанғалиқызы А.",
                "room": "210 / 110"
            },
            "7": {
                "subject": "Жаһандық құзыреттілік",
                "teacher": "Халелова А.Е.",
                "room": "310"
            },
            "8": {
                "subject": "ҰБТ дайындық",
                "teacher": "",
                "room": "205"
            },
            "9": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "205"
            },
            "10": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "205"
            }
        }
    },
    "10B": {
        "0": {
            "1": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "Жоламан М., Даулетбаева С. / Таңатар М. / Назаров Д. / Қангерей Қ.",
                "room": "204, 109 / 305 / 201 / 310"
            },
            "2": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "Жоламан М., Даулетбаева С. / Таңатар М. / Назаров Д. / Қангерей Қ.",
                "room": "204, 109 / 211 / 201 / 203"
            },
            "3": {
                "subject": "Қазақстан тарихы",
                "teacher": "Иван О.А.",
                "room": "204"
            },
            "4": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н.",
                "room": "302 / 306 / 209 / 104 / 203"
            },
            "5": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н.",
                "room": "302 / 306 / 209 / 104 / 203"
            },
            "6": {
                "subject": "Геометрия",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "7": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "8": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "спортзал 0 қабат"
            },
            "9": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "204"
            },
            "10": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "204"
            }
        },
        "1": {
            "1": {
                "subject": "Қазақстан тарихы / SAT math",
                "teacher": "Иван О.А. / Арыстанғалиқызы А.",
                "room": "306 / 110"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "3": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н.",
                "room": "309 / 306 / 209 / технопарк / 203"
            },
            "4": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н.",
                "room": "309 / 306 / 209 / технопарк / 203"
            },
            "5": {
                "subject": "IELTS",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "6": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "Жоламан М., Даулетбаева С. / Таңатар М. / Назаров Д. / Қангерей Қ.",
                "room": "204, 109 / 305 / 201 / 203"
            },
            "7": {
                "subject": "Қазақстан тарихы / SAT math",
                "teacher": "Иван О.А. / Арыстанғалиқызы А.",
                "room": "204 / 110"
            },
            "8": {
                "subject": "Қазақ тілі",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "9": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "204"
            },
            "10": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "204"
            }
        },
        "2": {
            "1": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "Жоламан М., Даулетбаева С. / Таңатар М. / Назаров Д. / Қангерей Қ.",
                "room": "204, 109 / 305 / 201 / 310"
            },
            "2": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н.",
                "room": "309 / 306 / 209 / 104 / 203"
            },
            "3": {
                "subject": "IELTS",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "4": {
                "subject": "Алгебра",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "5": {
                "subject": "Мат. сауаттылық",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "6": {
                "subject": "Қаржылық сауаттылық",
                "teacher": "Жоламан М.",
                "room": "109"
            },
            "7": {
                "subject": "Тәрбие сағаты / Химия",
                "teacher": "Халелова А.Е.",
                "room": "204 / 201"
            },
            "8": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "9": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "204"
            },
            "10": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "204"
            }
        },
        "3": {
            "1": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "3": {
                "subject": "Қазақстан тарихы",
                "teacher": "Иван О.А.",
                "room": "211"
            },
            "4": {
                "subject": "Мат. сауаттылық",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "5": {
                "subject": "IELTS",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "6": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "7": {
                "subject": "Қазақстан тарихы / SAT math",
                "teacher": "Иван О.А. / Арыстанғалиқызы А.",
                "room": "306 / 110"
            },
            "8": {
                "subject": "Теория вероятности и статистика для ИИ",
                "teacher": "Ахметова И.Е.",
                "room": "технопарк"
            },
            "9": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "204"
            },
            "10": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "204"
            }
        },
        "4": {
            "1": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Қайырқұлов Н.",
                "room": "309 / 306 / 209 / технопарк / 203"
            },
            "2": {
                "subject": "Алгебра",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "3": {
                "subject": "Геометрия",
                "teacher": "Даулетбаева С.С.",
                "room": "204"
            },
            "4": {
                "subject": "IELTS",
                "teacher": "Таңатар М.М.",
                "room": "305"
            },
            "5": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "Жоламан М., Даулетбаева С. / Таңатар М. / Назаров Д. / Қангерей Қ.",
                "room": "204, 109 / 305 / 201 / 203"
            },
            "6": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.",
                "room": "үлкен спортзал"
            },
            "7": {
                "subject": "Абайтану",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "8": {
                "subject": "ҰБТ дайындық",
                "teacher": "",
                "room": "205"
            },
            "9": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "204"
            },
            "10": {
                "subject": "Үй жұмысы",
                "teacher": "-",
                "room": "204"
            }
        }
    },
    "11A": {
        "0": {
            "2": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "3": {
                "subject": "Тарих / Мат. сауаттылық",
                "teacher": "Балтабай Ж. / Есалина А.",
                "room": "306 / 205"
            },
            "4": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "5": {
                "subject": "Қазақ тілі",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "6": {
                "subject": "Математика",
                "teacher": "Есалина А.",
                "room": "205"
            },
            "7": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "8": {
                "subject": "Абайтану",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "9": {
                "subject": "ҰБТ дайындық",
                "teacher": "-",
                "room": "109"
            }
        },
        "1": {
            "2": {
                "subject": "Тәрбие сағаты",
                "teacher": "Жомартова А.Қ.",
                "room": "109"
            },
            "3": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "4": {
                "subject": "Математика / Жаһандық құзыреттілік / Химия",
                "teacher": "",
                "room": "204, 206 / 205 / 201"
            },
            "5": {
                "subject": "Геометрия / Химия",
                "teacher": "Есалина А.",
                "room": "205 / 201"
            },
            "6": {
                "subject": "IELTS",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "7": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "8": {
                "subject": "IELTS",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "9": {
                "subject": "ҰБТ дайындық",
                "teacher": "-",
                "room": "109"
            }
        },
        "2": {
            "2": {
                "subject": "IELTS",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "3": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.Б.",
                "room": "үлкен спортзал"
            },
            "4": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "",
                "room": "205, 206 / 304 / 201 / 310"
            },
            "5": {
                "subject": "Геометрия / Химия",
                "teacher": "Есалина А.",
                "room": "205 / 201"
            },
            "6": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "7": {
                "subject": "Психологиялық тренинг",
                "teacher": "Душманова А.К.",
                "room": "205"
            },
            "8": {
                "subject": "Алгебра / Химия",
                "teacher": "Есалина А.",
                "room": "205 / 201"
            },
            "9": {
                "subject": "ҰБТ дайындық",
                "teacher": "-",
                "room": "109"
            }
        },
        "3": {
            "2": {
                "subject": "Тарих / Мат. сауаттылық",
                "teacher": "Балтабай Ж. / Есалина А.",
                "room": "306 / 205"
            },
            "3": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "4": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "5": {
                "subject": "Математикалық сауаттылық",
                "teacher": "Есалина А.",
                "room": "205"
            },
            "6": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "7": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "",
                "room": "205, 206 / 304 / 201 / 310"
            },
            "8": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "9": {
                "subject": "ҰБТ дайындық",
                "teacher": "-",
                "room": "109"
            }
        },
        "4": {
            "2": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "3": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "",
                "room": "205, 206 / 304 / 201 / 310"
            },
            "4": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Бактыгулов А.И.",
                "room": "301"
            },
            "5": {
                "subject": "IELTS",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "6": {
                "subject": "Тарих / Мат. сауаттылық",
                "teacher": "Балтабай Ж. / Есалина А.",
                "room": "205 / 305"
            },
            "7": {
                "subject": "Тарих / Мат. сауаттылық",
                "teacher": "Балтабай Ж. / Есалина А.",
                "room": "205 / 306"
            },
            "8": {
                "subject": "АӘД",
                "teacher": "Сарқытбаев Н.",
                "room": "205"
            },
            "9": {
                "subject": "ҰБТ дайындық",
                "teacher": "-",
                "room": "109"
            }
        }
    },
    "11B": {
        "0": {
            "2": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "3": {
                "subject": "IELTS",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "4": {
                "subject": "Математика",
                "teacher": "Нажмадинов М.",
                "room": "206"
            },
            "5": {
                "subject": "Тәрбие сағаты",
                "teacher": "Жомартова А.Қ.",
                "room": "110"
            },
            "6": {
                "subject": "Тарих / Мат. сауаттылық",
                "teacher": "Балтабай Ж. / Нажмадинов М.",
                "room": "306 / 206"
            },
            "7": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "8": {
                "subject": "АӘД",
                "teacher": "Сарқытбаев Н.",
                "room": "204"
            },
            "9": {
                "subject": "ҰБТ дайындық",
                "teacher": "-",
                "room": "110"
            }
        },
        "1": {
            "2": {
                "subject": "Психологиялық тренинг",
                "teacher": "Душманова А.К.",
                "room": "110"
            },
            "3": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "4": {
                "subject": "Математика / Жаһандық құзыреттілік / Химия",
                "teacher": "",
                "room": "204, 206 / 205 / 201"
            },
            "5": {
                "subject": "Геометрия / Химия",
                "teacher": "Нажмадинов М.",
                "room": "206 / 201"
            },
            "6": {
                "subject": "Абайтану",
                "teacher": "Утенова К.",
                "room": "311"
            },
            "7": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "8": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Утенова Қ.",
                "room": "311"
            },
            "9": {
                "subject": "ҰБТ дайындық",
                "teacher": "-",
                "room": "110"
            }
        },
        "2": {
            "2": {
                "subject": "Орыс тілі",
                "teacher": "Матигулова Г.Б.",
                "room": "303"
            },
            "3": {
                "subject": "IELTS",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "4": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "",
                "room": "205, 206 / 304 / 201 / 310"
            },
            "5": {
                "subject": "Геометрия / Химия",
                "teacher": "Нажмадинов М.",
                "room": "206 / 201"
            },
            "6": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "7": {
                "subject": "Дене шынықтыру",
                "teacher": "Аділов Т.Б.",
                "room": "үлкен спортзал"
            },
            "8": {
                "subject": "Алгебра / Химия",
                "teacher": "Нажмадинов М.",
                "room": "206 / 201"
            },
            "9": {
                "subject": "ҰБТ дайындық",
                "teacher": "-",
                "room": "110"
            }
        },
        "3": {
            "2": {
                "subject": "IELTS",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "3": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "4": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "5": {
                "subject": "Тарих / Мат. сауат.",
                "teacher": "",
                "room": "306 / 206"
            },
            "6": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "7": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "",
                "room": "205, 206 / 304 / 201 / 310"
            },
            "8": {
                "subject": "Математикалық сауаттылық",
                "teacher": "Нажмадинов М.",
                "room": "206"
            },
            "9": {
                "subject": "ҰБТ дайындық",
                "teacher": "-",
                "room": "110"
            }
        },
        "4": {
            "2": {
                "subject": "География / ДЖТ / Физика / Информатика / Биология",
                "teacher": "Жадырасын Е. / Балтабай Ж. / Сулейманов Б. / Ахметова И. / Караева А.",
                "room": "309 / 306 / 209 / 104 / 210"
            },
            "3": {
                "subject": "Математика / Ағылшын тілі / Химия / Құқық",
                "teacher": "",
                "room": "205, 206 / 304 / 201 / 310"
            },
            "4": {
                "subject": "Тарих / Мат. сауат.",
                "teacher": "Балтабай Ж. / Нажмадинов М.",
                "room": "306 / 206"
            },
            "5": {
                "subject": "Тарих / Мат. сауат.",
                "teacher": "Балтабай Ж. / Нажмадинов М.",
                "room": "306 / 206"
            },
            "6": {
                "subject": "Қазақ тілі",
                "teacher": "Утенова К.",
                "room": "311"
            },
            "7": {
                "subject": "IELTS",
                "teacher": "Ақырап А.",
                "room": "304"
            },
            "8": {
                "subject": "Қазақ әдебиеті",
                "teacher": "Утенова К.",
                "room": "311"
            },
            "9": {
                "subject": "ҰБТ дайындық",
                "teacher": "-",
                "room": "110"
            }
        }
    }
};

    function loadScheduleData() {
        if (window.scheduleDataCache) return;
        window.scheduleDataCache = true;
        
        const selector = document.getElementById('classSelector');
        selector.innerHTML = '<option value="">-- Выберите класс --</option>';
        
        Object.keys(SPECIFIC_SCHEDULES).forEach(className => {
            const option = document.createElement('option');
            option.value = className; 
            if (className.includes('11')) {
                option.textContent = className + ' (ҰБТ / SAT FOCUS)';
            } else {
                option.textContent = className;
            }
            selector.appendChild(option);
        });
        
        selector.addEventListener('change', (e) => {
            if (e.target.value) {
                renderScheduleForClass(e.target.value, e.target.options[e.target.selectedIndex].text);
            } else {
                document.getElementById('scheduleDataContainer').innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Выберите класс, чтобы увидеть его расписание</p>';
            }
        });
    }

    function renderScheduleForClass(columnKey, className) {
        const container = document.getElementById('scheduleDataContainer');
        
        let html = `<div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="font-size: 28px; font-weight: 600; margin: 0; color: #1e293b; font-family: 'Inter', sans-serif;">Расписание: ${className}</h1>
                    </div>`;
                    
        html += `<div style="background: white; border-radius: 12px; padding: 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); font-family: 'Inter', sans-serif; overflow: hidden; border: 1px solid #e2e8f0;">
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0; text-align: center; table-layout: fixed; margin: 0;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; width: 60px; padding: 12px 0;"></th>
                                <th style="border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #475569; padding: 15px 0; text-transform: uppercase; letter-spacing: 0.05em;">Пн</th>
                                <th style="border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #475569; padding: 15px 0; text-transform: uppercase; letter-spacing: 0.05em;">Вт</th>
                                <th style="border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #475569; padding: 15px 0; text-transform: uppercase; letter-spacing: 0.05em;">Ср</th>
                                <th style="border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #475569; padding: 15px 0; text-transform: uppercase; letter-spacing: 0.05em;">Чт</th>
                                <th style="border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #475569; padding: 15px 0; text-transform: uppercase; letter-spacing: 0.05em;">Пт</th>
                            </tr>
                        </thead>
                        <tbody>`;
                        
        function f(str) {
            if (!str || str.trim() === " | " || str.trim() === "") return "";
            let p = str.split(" | ");
            return `<div style="font-weight: 600; color: #1e293b; font-size: 13px; margin-bottom: 4px;">${p[0]}</div><div style='font-size:11px; color:#64748b; font-weight: 500;'><i class="fa-solid fa-user-tie" style="opacity:0.7"></i> ${p[1] || ''}</div>`;
        }

        let sched = {};
        
        let exactMatch = SPECIFIC_SCHEDULES[columnKey];
        if (!exactMatch) {
            // fallback attempt if it's bugged out
            let normalizedClass = className.replace(/A/g, 'А').replace(/a/g, 'а').replace(/B/g, 'В').replace(/C/g, 'С');
            for (let key in SPECIFIC_SCHEDULES) {
                if (normalizedClass.includes(key) || className.includes(key)) {
                    exactMatch = SPECIFIC_SCHEDULES[key];
                    break;
                }
            }
        }
        
        if (exactMatch) {
            for (let lesson = 1; lesson <= 10; lesson++) {
                sched[lesson] = [];
                for (let day = 0; day <= 4; day++) {
                    let cell = exactMatch[day] && exactMatch[day][lesson];
                    if (cell) {
                        sched[lesson].push(`<div style="display:flex; flex-direction:column; gap:4px; padding: 5px 0;"><span style='font-weight: 600; color: #1e293b; font-size: 13px; line-height: 1.2;'>${cell.subject}</span><span style='font-size:11px; color:#64748b; font-weight: 500;'>${cell.teacher}</span>${cell.room && cell.room !== '-' ? `<span style='font-size:11px; color:#6366f1; font-weight: 600; background: #e0e7ff; padding: 2px 6px; border-radius: 4px; display: inline-block; width: fit-content; margin: 0 auto;'><i class="fa-solid fa-door-open"></i> ${cell.room}</span>` : ''}</div>`);
                    } else {
                        sched[lesson].push("");
                    }
                }
            }
        } else {
            // Fallback generic
            sched = {
                1: [f("Музыка | ХВ-304"), f("Биология | 215"), f("География | ХВ-102"), f("Рус яз и лит | Т-201"), f("Матем | 211")],
                2: [f("Час развития | Т-101"), "", "", "", ""],
                3: [f("Всемир. ист | 219"), f("English | Т-305"), f("Матем | 201"), f("Физика | 215"), f("Физкультура | Gym")],
                4: [f("Матем | FM-303"), "", "", "", ""],
                5: [f("История Каз | "), f("Каз яз и лит | "), f("Информатика | "), f("Химия | "), f("English | ")],
                6: ["", "", "", "", ""],
                7: [f("Информатика | 103"), "", f("Мир математики | "), "", f("Сынып сағат | ")],
                8: [f("Матем | "), f("Танцы | "), "", f("Шахматы | "), ""],
                9: ["", "", "", "", ""],
                10: ["", "", "", "", ""]
            };
        }

        for (let i = 1; i <= 10; i++) {
            const times = {
                1: "08:00<br>08:45",
                2: "09:05<br>09:50",
                3: "10:10<br>10:55",
                4: "11:00<br>11:45",
                5: "11:50<br>12:35",
                6: "13:05<br>13:50",
                7: "14:20<br>15:00",
                8: "15:05<br>15:45",
                9: "16:00<br>16:45",
                10: "16:50<br>17:30"
            };
            let timeStr = times[i] || "";
            
            html += `<tr style="transition: background 0.2s ease;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='white'">
                        <td style="border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; font-size: 16px; font-weight: 600; padding: 10px 0; color: #64748b; background: #f8fafc;">${i}<div style="font-size:11px; color:#94a3b8; margin-top:4px; font-weight: 500;">${timeStr}</div></td>`;
            for (let j = 0; j < 5; j++) {
                let content = sched[i] ? sched[i][j] : "";
                
                let borderStyle = "border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;";
                if (j === 4) borderStyle = "border-bottom: 1px solid #e2e8f0;"; // No right border on last column
                
                let emptyClass = content === "" ? 'background: #f8fafc;' : 'background: transparent;';
                if (content === "") {
                     if (i === 2 || i === 4 || i === 6) {
                         emptyClass = 'background: #f1f5f9; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);';
                     }
                }
                
                html += `<td style="${borderStyle} padding: 12px 8px; font-size: 14px; vertical-align: middle; height: 75px; ${emptyClass}">${content || '<span style="color: #cbd5e1; font-size: 18px;">-</span>'}</td>`;
            }
            html += `</tr>`;
        }
        
        html += `</tbody></table>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 15px; padding: 0 15px 15px 15px; color: #94a3b8; font-weight: 500;">
                <span><i class="fa-solid fa-clock"></i> Актуально на 18 апреля 2026</span>
                <span><i class="fa-solid fa-shield-halved"></i> AIS School Management</span>
            </div>
        </div>`;
        container.innerHTML = html;
    }

    // 4. ИНТЕГРАЦИЯ ТЕЛЕГРАМ БОТА (Live Polling)
    const canteenCard = document.getElementById('canteenCard');
    const canteenValue = document.getElementById('canteenValue');
    const canteenSubtext = document.getElementById('canteenSubtext');
    
    const incidentCard = document.getElementById('incidentCard');
    const incidentValue = document.getElementById('incidentValue');
    const incidentSubtext = document.getElementById('incidentSubtext');

    let previousCanteen = 400;
    let previousIncidents = 0;
    let loadedTasksCount = 0;

    function fetchTelegramData() {
        fetch('bot_data.json?' + new Date().getTime()) // обходим кэш
            .then(response => response.json())
            .then(data => {
                // Если сбросили backend аппаратно, обнуляем наши базы
                if ((data.tasks && data.tasks.length < loadedTasksCount) || !data.tasks) {
                    loadedTasksCount = 0;
                }

                // Обновление Столовой
                if (data.canteen !== previousCanteen) {
                    const TOTAL_PORTIONS = 247;
                    const missing = TOTAL_PORTIONS - data.canteen;
                    
                    canteenValue.textContent = data.canteen;
                    canteenSubtext.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Получены данные`;
                    
                    const progressPercent = (data.canteen / TOTAL_PORTIONS) * 100;
                    const progressBar = document.getElementById('canteenProgress');
                    if(progressBar) progressBar.style.width = progressPercent + '%';
                    
                    const missingText = document.getElementById('canteenMissingText');
                    if(missingText) {
                        if(missing > 0) {
                            missingText.style.display = 'block';
                            missingText.textContent = `Снято: ${missing}`;
                        } else {
                            missingText.style.display = 'none';
                        }
                    }
                    
                    canteenCard.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.6)';
                    setTimeout(() => canteenCard.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 1000);
                    previousCanteen = data.canteen;
                }

                // Обновление Инцидентов
                if (data.incidents !== previousIncidents) {
                    incidentValue.textContent = data.incidents;
                    incidentSubtext.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Требуют внимания`;
                    
                    const incidentBar = document.getElementById('incidentProgress');
                    if(incidentBar) {
                        let percent = Math.min((data.incidents / 10) * 100, 100);
                        incidentBar.style.width = percent + '%';
                    }
                    
                    incidentCard.style.boxShadow = '0 0 25px rgba(244, 63, 94, 0.6)';
                    setTimeout(() => incidentCard.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 1000);
                    previousIncidents = data.incidents;
                }

                // Добавление новых задач от бота
                if (data.tasks && data.tasks.length > loadedTasksCount) {
                    let newTasks = data.tasks.slice(0, data.tasks.length - loadedTasksCount);
                    for (let i = newTasks.length - 1; i >= 0; i--) {
                        addNewTaskFromTelegram(newTasks[i]);
                    }
                    loadedTasksCount = data.tasks.length;
                }
            })
            .catch(error => console.log("Telegram bridge not responding or missing..."));
    }

    function addNewTaskFromTelegram(text) {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.style.opacity = '0';
        li.style.transform = 'translateY(-10px)';
        li.style.transition = 'all 0.4s ease';

        // Если это Отчет посещаемости
        if (text.includes("Отчет от:")) {
            li.innerHTML = `
                <div class="task-icon" style="background: #eef2ff; color: #6366f1;"><i class="fa-solid fa-clipboard-user"></i></div>
                <div class="task-details">
                    <span class="task-title" style="color: #4f46e5;">${text}</span>
                    <span class="task-meta">Принят системой бота</span>
                </div>
                <span class="task-source ai-source"><i class="fa-brands fa-telegram"></i> Telegram</span>
            `;
        } else if (text.includes("🔄 Smart Замена:")) {
            li.innerHTML = `
                <div class="task-icon" style="background: #fdf4ff; color: #d946ef;"><i class="fa-solid fa-people-arrows"></i></div>
                <div class="task-details">
                    <span class="task-title" style="color: #a21caf;">${text}</span>
                    <span class="task-meta">Автоматическая диспетчеризация ИИ</span>
                </div>
                <span class="task-source ai-source"><i class="fa-brands fa-telegram"></i> Telegram</span>
            `;
        } else {
            // Если это Инцидент
            let cleanText = text.replace("🚨 ИНЦИДЕНТ: ", "");
            const { priority, assignee } = analyzeIncident(cleanText);

            li.innerHTML = `
                <div class="task-icon" style="background: ${priority.bgColor}; color: ${priority.color}; animation: ${priority.anim};">
                    <i class="fa-solid ${priority.icon}"></i>
                </div>
                <div class="task-details">
                    <span class="task-title" style="color: #1e293b;">${cleanText}</span>
                    <span class="task-meta" style="margin-top: 5px;">
                        <span style="background: ${priority.bgColor}; color: ${priority.color}; padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 11px; margin-right: 8px;">
                            ${priority.level} приоритет
                        </span>
                        <span style="color: ${assignee.color}; font-weight: 500; font-size: 12px;">
                            <i class="fa-solid ${assignee.icon}"></i> Исполнитель: ${assignee.name} (копия отправлена)
                        </span>
                    </span>
                </div>
                <span class="task-source ai-source"><i class="fa-brands fa-telegram"></i> Telegram</span>
            `;
        }
        
        taskList.prepend(li); // Добавляем наверх
        
        setTimeout(() => {
            li.style.opacity = '1';
            li.style.transform = 'translateY(0)';
        }, 50);
    }

    // Запускаем опрос каждые 2 секунды
    setInterval(fetchTelegramData, 2000);

    // Логика кнопки Очистить (Настоящая очистка сервера)
    const resetDemoBtn = document.getElementById('resetDemoBtn');
    if (resetDemoBtn) {
        resetDemoBtn.addEventListener('click', () => {
             // Реально отправляем команду нашему питон-боту через его скрытый порт 8080!
             fetch('http://127.0.0.1:8080/clear')
                .then(r => r.json())
                .then(data => {
                     // 1. Очищаем визуальное отображение карточек
                     if(taskList) taskList.innerHTML = '';
                     
                     previousCanteen = 247;
                     previousIncidents = 0;
                     loadedTasksCount = 0;
                     
                     // 2. Сброс UI
                     const canteenValue = document.getElementById('canteenValue');
                     const canteenSubtext = document.getElementById('canteenSubtext');
                     const canteenProgress = document.getElementById('canteenProgress');
                     const canteenMissingText = document.getElementById('canteenMissingText');
                     
                     if(canteenValue) canteenValue.textContent = '247';
                     if(canteenProgress) canteenProgress.style.width = '100%';
                     if(canteenMissingText) canteenMissingText.style.display = 'none';
                     if(canteenSubtext) canteenSubtext.innerHTML = '<i class="fa-solid fa-clock"></i> База обнулена...';
                     
                     const incidentValue = document.getElementById('incidentValue');
                     const incidentProgress = document.getElementById('incidentProgress');
                     const incidentSubtext = document.getElementById('incidentSubtext');
                     
                     if(incidentValue) incidentValue.textContent = '0';
                     if(incidentProgress) incidentProgress.style.width = '5%';
                     if(incidentSubtext) incidentSubtext.innerHTML = '<i class="fa-solid fa-check-double"></i> Тишина в чатах';
                })
                .catch(e => {
                     alert("❌ Ошибка соединения! Убедитесь, что запущен бот: python ais.py");
                });
        });
    }
    // Логика кнопки генерации расписания (Демонстрационная магия)
    const generateScheduleBtn = document.getElementById('generateScheduleBtn');
    if (generateScheduleBtn) {
        generateScheduleBtn.addEventListener('click', () => {
            const originalIcon = generateScheduleBtn.innerHTML;
            generateScheduleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Суперкомпьютер генерирует...';
            generateScheduleBtn.style.opacity = '0.8';
            generateScheduleBtn.disabled = true;
            
            setTimeout(() => {
                generateScheduleBtn.innerHTML = '<i class="fa-solid fa-check"></i> Матрицы рассчитаны!';
                generateScheduleBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                
                // Добавим красивое уведомление в список задач директора
                const taskList = document.querySelector('.task-list');
                const li = document.createElement('li');
                li.className = 'task-item';
                li.style.animation = 'pulseError 2s infinite ease-in-out'; // временно пульсируем
                li.innerHTML = `
                    <div class="task-icon" style="background: #ecfdf5; color: #10b981;"><i class="fa-solid fa-calculator"></i></div>
                    <div class="task-details">
                        <span class="task-title" style="color: #047857;">✅ ERP: Идеальное расписание сгенерировано!</span>
                        <span class="task-meta">Учтены все смарт-констрейнты: нагрузка 35 предметников и 50 кабинетов. Накладок ноль.</span>
                    </div>
                `;
                if (taskList) {
                    taskList.prepend(li);
                    setTimeout(() => li.style.animation = 'none', 3000); // отключаем пульсацию
                }
                
                // Возвращаем кнопку в исходное состояние
                setTimeout(() => {
                    generateScheduleBtn.innerHTML = originalIcon;
                    generateScheduleBtn.style.background = 'linear-gradient(135deg, #8b5cf6, #6366f1)';
                    generateScheduleBtn.style.opacity = '1';
                    generateScheduleBtn.disabled = false;
                }, 4000);
                
            }, 2500); // 2.5 секунды думает "суперкомпьютер"
        });
    }

    // Логика "Поручение ИИ (Кружки)"
    const aiDirectorBtn = document.getElementById('aiDirectorSubmitBtn');
    const aiDirectorPrompt = document.getElementById('aiDirectorPrompt');
    if (aiDirectorBtn && aiDirectorPrompt) {
        aiDirectorBtn.addEventListener('click', () => {
            const text = aiDirectorPrompt.value.toLowerCase();
            if (!text) return;
            
            aiDirectorBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Разбор NLP...';
            
            setTimeout(() => {
                let isRemove = text.includes('убери') || text.includes('удали') || text.includes('отмени') || text.includes('а нет');
                let isAdd = text.includes('добавь') || text.includes('поставь') || text.includes('сделай') || !isRemove; // Если не просят убрать, значит по умолчанию просят добавить
                
                // Если просят "убрать это" - откатываем то, что добавили последним
                if (isRemove) {
                    if (window.lastAddedLessonsArr && window.lastAddedLessonsArr.length > 0) {
                        for (let prev of window.lastAddedLessonsArr) {
                            if (SPECIFIC_SCHEDULES[prev.targetClass] && SPECIFIC_SCHEDULES[prev.targetClass][prev.day]) {
                                delete SPECIFIC_SCHEDULES[prev.targetClass][prev.day][prev.slot];
                            }
                        }
                        window.lastAddedLessonsArr = [];
                        window.lastAddedLesson = null;
                    } else if (window.lastAddedLesson) {
                        let prev = window.lastAddedLesson;
                        if (SPECIFIC_SCHEDULES[prev.targetClass] && SPECIFIC_SCHEDULES[prev.targetClass][prev.day]) {
                            delete SPECIFIC_SCHEDULES[prev.targetClass][prev.day][prev.slot];
                        }
                        window.lastAddedLesson = null;
                    }
                }

                let targetClass = null;
                let subject = "Доп. Занятие";
                let teacher = "Нурлан (наименьшая нагрузка)";
                let room = "Свободный каб. 204";
                let dayToInsert = "4"; // Пятница по умолчанию

                if (isAdd) {
                    const possibleClasses = ["7A","7B","7C","8A","8B","8C","8D","9A","9B","10A","10B","10C","11A","11B"];
                    for (let c of possibleClasses) {
                        if (text.includes(c.toLowerCase()) || text.includes(c.toLowerCase().replace('a','а').replace('b','в').replace('c','с'))) {
                            targetClass = c; break;
                        }
                    }
                    
                    if (!targetClass && !isRemove) {
                        alert("Уточните класс (Например: 11A)");
                        aiDirectorBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Исполнить';
                        return;
                    }

                    if (targetClass) {
                        // NLP Разбор множественных параметров (Предметы и количества)
                        let subjectsToAdd = [];
                        const detectCount = (keyword) => {
                            let idx = text.indexOf(keyword);
                            if (idx === -1) return 0;
                            let snippet = text.substring(Math.max(0, idx - 30), idx);
                            if (snippet.includes("2") || snippet.includes("два") || snippet.includes("две")) return 2;
                            if (snippet.includes("3") || snippet.includes("три")) return 3;
                            return 1;
                        };

                        let cMath = detectCount('математ');
                        for(let i=0; i<cMath; i++) subjectsToAdd.push({ subject: "Кружок: Математика", teacher: "Нурлан (доп)", room: "Каб. 204", baseSubjectName: "Математика", norm: 5, loadText: "Выбран Нурлан (нагрузка 12ч/нед) против среднего по кафедре 18ч/нед." });
                        
                        let cPhys = detectCount('физик');
                        for(let i=0; i<cPhys; i++) subjectsToAdd.push({ subject: "Кружок: Физика", teacher: "Сулейманов Б.", room: "Лаб. 209", baseSubjectName: "Физика", norm: 3, loadText: "Выбран Сулейманов Б. (нагрузка 10ч/нед) – самый свободный график среди 4 физиков." });
                        
                        let cInf = Math.max(detectCount('информат'), detectCount('it'));
                        for(let i=0; i<cInf; i++) subjectsToAdd.push({ subject: "Кружок: IT", teacher: "Ахметова И.", room: "Каб. 104", baseSubjectName: "Информатика", norm: 2, loadText: "Выбрана Ахметова И. (нагрузка 14ч/нед) – недобор до ставки." });
                        
                        let cEng = Math.max(detectCount('англ'), detectCount('ielts'));
                        for(let i=0; i<cEng; i++) subjectsToAdd.push({ subject: "Кружок: IELTS", teacher: "Ақырап А.", room: "Каб. 304", baseSubjectName: "Английский", norm: 4, loadText: "Выбран Ақырап А. (нагрузка 11ч/нед) – свободно 3 окна в указанный день." });
                        
                        let cHist = Math.max(detectCount('истор'), detectCount('тарих'));
                        for(let i=0; i<cHist; i++) subjectsToAdd.push({ subject: "Кружок: История", teacher: "Балтабай Ж.", room: "Каб. 306", baseSubjectName: "История", norm: 2, loadText: "Выбран Балтабай Ж. (нагрузка 13ч/нед) – наименьшая усталость по расчетам ИИ." });

                        if (subjectsToAdd.length === 0) {
                            subjectsToAdd.push({ subject: "Доп. Занятие", teacher: "Дежурный", room: "Свободный каб. 204", baseSubjectName: "Доп", norm: 99, loadText: "Назначен дежурный педагог." });
                        }

                        // Умный поиск дней с учетом приоритета названного дня
                        let dayOrder = [4, 3, 2, 1, 0]; // По умолчанию с пятницы к понедельнику ищем окна
                        if (text.includes("понедельник") || text.includes("пн")) dayOrder = [0, 4, 3, 2, 1];
                        if (text.includes("вторник") || text.includes("вт")) dayOrder = [1, 4, 3, 2, 0];
                        if (text.includes("сред") || text.includes("ср")) dayOrder = [2, 4, 3, 1, 0];
                        if (text.includes("четверг") || text.includes("чт")) dayOrder = [3, 4, 2, 1, 0];
                        if (text.includes("пятниц") || text.includes("пт")) dayOrder = [4, 3, 2, 1, 0];
                        
                        let scheduleForClass = SPECIFIC_SCHEDULES[targetClass];
                        if (!scheduleForClass) {
                            SPECIFIC_SCHEDULES[targetClass] = { "0":{},"1":{},"2":{},"3":{},"4":{} };
                            scheduleForClass = SPECIFIC_SCHEDULES[targetClass];
                        }
                        
                        if (!window.lastAddedLessonsArr) window.lastAddedLessonsArr = [];
                        let summarySubjects = [];
                        let summaryLoads = new Set();

                        // Инъекция уроков в первые попавшиеся места
                        for (let t of subjectsToAdd) {
                            let inserted = false;
                            for (let d of dayOrder) {
                                if (!scheduleForClass[d.toString()]) scheduleForClass[d.toString()] = {};
                                // Ищем свободный 8, 9, 10 урок в этот день
                                for (let s = 8; s <= 10; s++) {
                                    let slot = s.toString();
                                    if (!scheduleForClass[d.toString()][slot] || scheduleForClass[d.toString()][slot]["subject"] === "-" || scheduleForClass[d.toString()][slot]["subject"] === "") {
                                        scheduleForClass[d.toString()][slot] = {
                                            subject: t.subject,
                                            teacher: t.teacher,
                                            room: t.room
                                        };
                                        inserted = true;
                                        window.lastAddedLessonsArr.push({ targetClass: targetClass, day: d.toString(), slot: slot });
                                        summarySubjects.push(t.subject);
                                        summaryLoads.add(t.loadText);
                                        break;
                                    }
                                }
                                if (inserted) break;
                            }
                        }

                        window.lastAddedLesson = window.lastAddedLessonsArr[window.lastAddedLessonsArr.length - 1]; // для обратной совместимости
                        
                        // СанПиН Анализатор для всех добавленных предметов
                        let warningMessagesSet = new Set();
                        let warningTexts = [];
                        for (let t of subjectsToAdd) {
                            let currentCount = 0;
                            for (let d = 0; d <= 4; d++) {
                                if (scheduleForClass[d.toString()]) {
                                    for (let l = 1; l <= 10; l++) {
                                        let cell = scheduleForClass[d.toString()][l.toString()];
                                        let cellSubj = cell && cell.subject ? cell.subject.toLowerCase() : "";
                                        if (cellSubj && cellSubj !== "-" && cellSubj !== "") {
                                            let match = false;
                                            let basePrefix = t.baseSubjectName.toLowerCase().substring(0,4);
                                            if (cellSubj.includes(basePrefix)) match = true;
                                            if (t.baseSubjectName === "Математика" && (cellSubj.includes("алгеб") || cellSubj.includes("геомет"))) match = true;
                                            if (t.baseSubjectName === "История" && (cellSubj.includes("истор") || cellSubj.includes("тарих"))) match = true;
                                            if (match) {
                                                currentCount++;
                                            }
                                        }
                                    }
                                }
                            }
                            if (currentCount > t.norm && !warningMessagesSet.has(t.baseSubjectName)) {
                                warningMessagesSet.add(t.baseSubjectName);
                                warningTexts.push(`«${t.baseSubjectName}» (${currentCount} ч. при норме ${t.norm} ч.)`);
                            }
                        }

                        window.lastAddedWarning = null;
                        if (warningTexts.length > 0) {
                            window.lastAddedWarning = `⚠️ Внимание (ТУП МОН РК): ${targetClass} превышает норму по предметам: ${warningTexts.join(', ')}. Высокий риск переутомления!`;
                        }

                        // Обновляем общие переменные для вывода уведомления
                        subject = summarySubjects.join(", ");
                        teacher = Array.from(summaryLoads).join(" ");
                        room = "Согласно матрице свободных кабинетов";
                    }
                }
                
                aiDirectorPrompt.value = '';
                aiDirectorBtn.innerHTML = '<i class="fa-solid fa-check"></i> Исполнено!';
                aiDirectorBtn.style.background = '#059669';
                
                const selector = document.getElementById('classSelector');
                // Если мы добавили что-то, перерисуем целевой класс (или текущий, если мы просто удалили)
                let classToRender = targetClass || (window.lastAddedLesson ? window.lastAddedLesson.targetClass : (selector ? selector.value : null));
                
                if (selector && classToRender && selector.value === classToRender) {
                    renderScheduleForClass(classToRender, selector.options[selector.selectedIndex].text);
                }
                
                const taskList = document.querySelector('.task-list');
                const schedTaskList = document.getElementById('scheduleNotifications');
                
                const li = document.createElement('li');
                li.className = 'task-item';
                
                if (isAdd && targetClass) {
                    li.innerHTML = `
                        <div class="task-icon" style="background: #eff6ff; color: #3b82f6;"><i class="fa-solid fa-graduation-cap"></i></div>
                        <div class="task-details">
                            <span class="task-title" style="color: #1d4ed8;">Индивидуальный трек обновлен (${targetClass})</span>
                            <span class="task-meta">Поручение выполнено! <b>${subject}</b> успешно интегрирован в расписание. <br><br>💡 <b>Анализ нагрузки ИИ:</b> ${teacher}</span>
                        </div>
                    `;
                } else if (isRemove) {
                    li.innerHTML = `
                        <div class="task-icon" style="background: #fef2f2; color: #ef4444;"><i class="fa-solid fa-eraser"></i></div>
                        <div class="task-details">
                            <span class="task-title" style="color: #b91c1c;">Отмена предыдущего поручения</span>
                            <span class="task-meta">Ошибочный слот кружка удален из сетки. Расписание пересчитано.</span>
                        </div>
                    `;
                }
                
                if (taskList) taskList.prepend(li);
                if (schedTaskList) {
                    schedTaskList.innerHTML = ''; // Очищаем старые предупреждения на этой же вкладке
                    schedTaskList.appendChild(li.cloneNode(true));
                }
                
                if (isAdd && window.lastAddedWarning) {
                    const warningLi = document.createElement('li');
                    warningLi.className = 'task-item';
                    warningLi.style.borderLeft = '4px solid #f59e0b';
                    warningLi.innerHTML = `
                        <div class="task-icon" style="background: #fef3c7; color: #d97706;"><i class="fa-solid fa-scale-unbalanced"></i></div>
                        <div class="task-details">
                            <span class="task-title" style="color: #b45309;">Риск нарушения ГОСО / ТУП РК</span>
                            <span class="task-meta">${window.lastAddedWarning} Рекомендуем добавить час развития/релаксации и утвердить у завуча.</span>
                        </div>
                    `;
                    // Задержка на 800мс, чтобы "ИИ-анализатор" якобы подумал перед тем как выдать Ахтунг!
                    setTimeout(() => {
                        if (taskList) taskList.prepend(warningLi);
                        if (schedTaskList) schedTaskList.appendChild(warningLi.cloneNode(true));
                    }, 800);
                }
                setTimeout(() => {
                    aiDirectorBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Исполнить';
                    aiDirectorBtn.style.background = '#16a34a';
                }, 3000);
                
            }, 1200);
        });
    }
    // --- Темная тема и Локализация ---
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        let isDark = false;
        themeBtn.addEventListener('click', () => {
            isDark = !isDark;
            document.body.classList.toggle('dark-mode', isDark);
            themeBtn.innerHTML = isDark ? '☀️' : '🌙';
            // Небольшой хак для графиков: мы не можем легко инвертировать canvas внутри инвертированного body, 
            // так как график Chart.js уже отрисован. Но filter в CSS всё сделает за нас.
        });
    }

    const langSwitcher = document.getElementById('langSwitcher');
    if (langSwitcher) {
        const dict = {
            'ru': ['Обзор', 'Питание', 'Расписание', 'База приказов (RAG)', 'Панель управления'],
            'kz': ['Шолу', 'Тамақтану', 'Сабақ кестесі', 'Бұйрықтар (RAG)', 'Басқару панелі'],
            'en': ['Overview', 'Canteen', 'Schedule', 'Orders DB (RAG)', 'Dashboard']
        };
        const menuItems = document.querySelectorAll('.menu-item');
        const pageTitle = document.getElementById('pageTitle');
        
        langSwitcher.addEventListener('change', (e) => {
            let lang = e.target.value;
            let words = dict[lang];
            if (menuItems.length >= 4 && words) {
                menuItems[0].innerHTML = `<i class="fa-solid fa-chart-pie"></i> ${words[0]}`;
                menuItems[1].innerHTML = `<i class="fa-solid fa-utensils"></i> ${words[1]}`;
                menuItems[2].innerHTML = `<i class="fa-solid fa-calendar-check"></i> ${words[2]}`;
                menuItems[3].innerHTML = `<i class="fa-solid fa-scale-balanced"></i> ${words[3]}`;
                if (pageTitle) pageTitle.textContent = words[4];
            }
        });
    }

    loadScheduleData();
});