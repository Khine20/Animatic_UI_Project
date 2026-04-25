import json
import os
import base64
from datetime import datetime
from io import BytesIO
from flask import Flask, render_template, request, redirect, url_for, jsonify, send_file
from PIL import Image

app = Flask(__name__)

# In-memory canvas frame store — cleared on server restart (no persistent save)
canvas_frames = []

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, 'data.json')
USER_DATA_PATH = os.path.join(BASE_DIR, 'user_data.json')


def load_quiz_data():
    with open(DATA_PATH, 'r') as f:
        return json.load(f)


def load_user_data():
    if not os.path.exists(USER_DATA_PATH):
        return {"started_at": None, "visits": [], "answers": {}}
    with open(USER_DATA_PATH, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"started_at": None, "visits": [], "answers": {}}


def save_user_data(user_data):
    with open(USER_DATA_PATH, 'w') as f:
        json.dump(user_data, f, indent=2)

save_user_data({"started_at": None, "visits": [], "answers": {}, "frame_count": 0})


def log_visit(page):
    user_data = load_user_data()
    user_data.setdefault('visits', []).append({
        "page": page,
        "at": datetime.utcnow().isoformat() + 'Z'
    })
    save_user_data(user_data)


def decode_frame_image(frame_data_url):
    if not isinstance(frame_data_url, str) or "," not in frame_data_url:
        raise ValueError("frame must be a data URL string")

    _, encoded = frame_data_url.split(",", 1)
    image_bytes = base64.b64decode(encoded)
    image = Image.open(BytesIO(image_bytes))
    image.load()
    return image.copy().convert("RGBA")


def compile_gif(frames, duration_ms=100):
    if not isinstance(frames, list) or not frames:
        raise ValueError("frames must be a non-empty list")

    rgba_images = [decode_frame_image(frame) for frame in frames]
    
    # Composite each RGBA image onto a white background
    if rgba_images:
        width, height = rgba_images[0].size
        composited_images = []
        for rgba in rgba_images:
            white_bg = Image.new("RGB", (width, height), (255, 255, 255))
            white_bg.paste(rgba, (0, 0), rgba)
            composited_images.append(white_bg)
        
        first_image, remaining_images = composited_images[0], composited_images[1:]
    else:
        return BytesIO()

    output = BytesIO()
    first_image.save(
        output,
        format="GIF",
        save_all=True,
        append_images=remaining_images,
        duration=max(20, int(duration_ms)),
        loop=0,
        disposal=2
    )
    output.seek(0)
    return output


@app.route('/')
def home():
    log_visit('home')
    return render_template('homepage.html')


@app.route('/save_frames', methods=['POST'])
def save_frames():
    global canvas_frames
    payload = request.get_json(silent=True) or {}
    frames = payload.get('frames')
    if not isinstance(frames, list):
        return jsonify({"ok": False, "error": "frames must be a list"}), 400
    canvas_frames = frames
    return jsonify({"ok": True, "saved": len(canvas_frames)})


@app.route('/load_frames', methods=['GET'])
def load_frames():
    return jsonify({"frames": canvas_frames})


@app.route('/export_gif', methods=['POST'])
def export_gif():
    payload = request.get_json(silent=True) or {}
    frames = payload.get('frames')
    duration_ms = payload.get('duration_ms', 100)
    file_name = payload.get('file_name', 'animatic.gif')

    if not isinstance(frames, list) or not frames:
        return jsonify({"ok": False, "error": "frames must be a non-empty list"}), 400

    try:
        gif_bytes = compile_gif(frames, duration_ms=duration_ms)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    safe_name = os.path.basename(file_name) or "animatic.gif"
    if not safe_name.lower().endswith(".gif"):
        safe_name += ".gif"

    return send_file(
        gif_bytes,
        mimetype="image/gif",
        as_attachment=True,
        download_name=safe_name
    )


@app.route('/learn')
def learn():
    log_visit('learn')
    return render_template('learn.html')


@app.route('/learn/<int:lesson_id>')
def learn_lesson(lesson_id):
    log_visit(f'learn/{lesson_id}')
    return render_template('learn.html', lesson_id=lesson_id)


@app.route('/quiz/<int:question_id>')
def quiz(question_id):
    data = load_quiz_data()
    questions = data.get('quiz', [])
    total = len(questions)

    if question_id < 1 or question_id > total:
        return redirect(url_for('home'))

    question = questions[question_id - 1].copy() 
    user_data = load_user_data()
    if question_id == 1 and question.get('type') == 'input':
        question['correct_answer'] = len(canvas_frames)

    log_visit(f'quiz/{question_id}')

    previous_answer = user_data.get('answers', {}).get(str(question_id))

    return render_template(
        'quiz.html',
        question=question,
        question_id=question_id,
        total=total,
        previous_answer=previous_answer
    )


@app.route('/quiz/<int:question_id>/answer', methods=['POST'])
def submit_answer(question_id):
    data = load_quiz_data()
    questions = data.get('quiz', [])
    total = len(questions)

    if question_id < 1 or question_id > total:
        return jsonify({"ok": False, "error": "Invalid question id"}), 400

    payload = request.get_json(silent=True) or {}
    question = questions[question_id - 1]

    if question.get('type') == 'input':
        answer = payload.get('answer')
        if not isinstance(answer, str) or not answer.strip():
            return jsonify({"ok": False, "error": "answer must be a non-empty string"}), 400
        user_answer = {
            "answer": answer.strip(),
            "answered_at": datetime.utcnow().isoformat() + 'Z'
        }
    else:
        selected_index = payload.get('selected_index')
        if not isinstance(selected_index, int):
            return jsonify({"ok": False, "error": "selected_index must be an int"}), 400
        user_answer = {
            "selected_index": selected_index,
            "answered_at": datetime.utcnow().isoformat() + 'Z'
        }

    user_data = load_user_data()
    user_data.setdefault('answers', {})[str(question_id)] = user_answer
    save_user_data(user_data)

    next_url = (
        url_for('quiz', question_id=question_id + 1)
        if question_id < total
        else url_for('quiz_result')
    )
    return jsonify({"ok": True, "next_url": next_url})


@app.route('/quiz/result')
def quiz_result():
    data = load_quiz_data()
    questions = data.get('quiz', [])
    user_data = load_user_data()
    answers = user_data.get('answers', {})

    results = []
    score = 0
    for q in questions:
        qid = str(q['id'])
        user_answer = answers.get(qid)
        if q.get('type') == 'input':
            answer = user_answer.get('answer') if user_answer else None
            is_correct = answer == str(q['correct_answer']) if answer else False
        else:
            selected_index = user_answer.get('selected_index') if user_answer else None
            is_correct = selected_index == q['correct_index']
        if is_correct:
            score += 1
        result = {
            "question": q['question'],
            "is_correct": is_correct
        }
        if q.get('type') == 'input':
            result["user_answer"] = answer
            result["correct_answer"] = q['correct_answer']
        else:
            result["options"] = q['options']
            result["correct_index"] = q['correct_index']
            result["selected_index"] = selected_index
        results.append(result)

    # Compile GIF from stored frames
    gif_data_url = None
    if canvas_frames:
        try:
            gif_bytes = compile_gif(canvas_frames, duration_ms=100)
            gif_b64 = base64.b64encode(gif_bytes.getvalue()).decode('utf-8')
            gif_data_url = f"data:image/gif;base64,{gif_b64}"
        except Exception:
            pass

    log_visit('quiz/result')
    return render_template(
        'quiz_result.html',
        results=results,
        score=score,
        total=len(questions),
        animation_gif=gif_data_url
    )


@app.route('/reset', methods=['POST'])
def reset():
    save_user_data({"started_at": None, "visits": [], "answers": {}})
    return jsonify({"ok": True})


if __name__ == '__main__':
    app.run(debug=True, port=8000)
