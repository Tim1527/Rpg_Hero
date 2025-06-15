from flask import Flask, render_template, request, jsonify, send_from_directory
import os
from datetime import datetime
import json
import math

app = Flask(__name__, template_folder='templates', static_folder='static')

# Пути к файлам
MODEL_PATH = 'Lowpolyszkielet.glb'
DATA_FILE = 'progress_data.json'
LOG_FILE = 'Log.txt'

# Инициализация данных прогресса
DEFAULT_STATS = {
    "Физические": {
        "Сила": {"value": 0, "current_max": 5, "base_max": 5, "level": 0},
        "Ловкость": {"value": 0, "current_max": 5, "base_max": 5, "level": 0},
        "Выносливость": {"value": 0, "current_max": 5, "base_max": 5, "level": 0},
        "Речь": {"value": 0, "current_max": 5, "base_max": 5, "level": 0}
    },
    "Социальные": {
        "Харизма": {"value": 0, "current_max": 5, "base_max": 5, "level": 0},
        "Внешность": {"value": 0, "current_max": 5, "base_max": 5, "level": 0}
    },
    "Ментальные": {
        "Восприятие": {"value": 0, "current_max": 5, "base_max": 5, "level": 0},
        "Интеллект": {"value": 0, "current_max": 5, "base_max": 5, "level": 0},
        "Память": {"value": 0, "current_max": 5, "base_max": 5, "level": 0},
        "Коммуникация": {"value": 0, "current_max": 5, "base_max": 5, "level": 0}
    },
    "total_level": 0
}


def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return DEFAULT_STATS


def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


def log_change(category, stat, change, new_value, max_value, level):
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(
            f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | {category} | {stat} | Изменение: {change:+} | Текущее: {new_value}/{max_value} | Уровень: {level}\n")


@app.route('/')
def home():
    current_date = datetime.now().strftime('%Y-%m-%d')
    return render_template('index.html', current_date=current_date)


@app.route('/model')
def serve_model():
    if not os.path.exists(MODEL_PATH):
        return "Model file not found", 404
    return send_from_directory('.', MODEL_PATH)


@app.route('/get_stats')
def get_stats():
    return jsonify(load_data())


@app.route('/update_stat', methods=['POST'])
def update_stat():
    data = request.json
    stats = load_data()

    if data['category'] in stats and data['stat'] in stats[data['category']]:
        stat = stats[data['category']][data['stat']]
        new_value = stat['value'] + data['change']

        level_up = False
        if new_value >= stat['current_max']:
            stat['level'] += 1
            new_value = new_value - stat['current_max']
            stat['current_max'] = math.ceil(stat['current_max'] * 1.25)
            level_up = True
        elif new_value < 0:
            new_value = 0

        stat['value'] = new_value

        log_change(data['category'], data['stat'], data['change'],
                   new_value, stat['current_max'], stat['level'])

        total = sum(
            s['level']
            for category in stats
            if category != "total_level"
            for s in stats[category].values()
        )

        stats['total_level'] = total
        save_data(stats)

        return jsonify({
            "success": True,
            "total_level": total,
            "level_up": level_up
        })

    return jsonify({"success": False})


if __name__ == '__main__':
    if not os.path.exists(DATA_FILE):
        save_data(DEFAULT_STATS)

    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'w', encoding='utf-8') as f:
            f.write("=== Лог изменений характеристик ===\n")

    if not os.path.exists(MODEL_PATH):
        print(f"Внимание: файл модели '{MODEL_PATH}' не найден в директории проекта!")

    app.run(debug=True)