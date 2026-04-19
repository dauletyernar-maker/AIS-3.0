import codecs

file_path = r"c:\Users\ASUS\OneDrive\Desktop\AIS\AIS.JS"
with codecs.open(file_path, "r", "utf-8") as f:
    text = f.read()

import re

start_idx = text.find('    function renderScheduleForClass')
end_idx = text.find('    // 4. ИНТЕГРАЦИЯ ТЕЛЕГРАМ БОТА')

new_func = '''    function renderScheduleForClass(columnKey, className) {
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

'''

new_text = text[:start_idx] + new_func + text[end_idx:]

with codecs.open(file_path, "w", "utf-8") as f:
    f.write(new_text)

print("Updated style and fixed bug.")
