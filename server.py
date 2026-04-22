import json
import os
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, jsonify

app = Flask(__name__)

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


@app.route('/')
def home():
    log_visit('home')
    return render_template('homepage.html')


@app.route('/save_frame_count', methods=['POST'])
def save_frame_count():
    payload = request.get_json(silent=True) or {}
    frame_count = payload.get('frame_count')
    if not isinstance(frame_count, int) or frame_count < 0:
        return jsonify({"ok": False, "error": "Invalid frame count"}), 400
    user_data = load_user_data()
    user_data['frame_count'] = frame_count
    save_user_data(user_data)
    return jsonify({"ok": True})


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
        question['correct_answer'] = user_data.get('frame_count', 0)

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

    log_visit('quiz/result')
    return render_template(
        'quiz_result.html',
        results=results,
        score=score,
        total=len(questions)
    )


@app.route('/reset', methods=['POST'])
def reset():
    save_user_data({"started_at": None, "visits": [], "answers": {}})
    return jsonify({"ok": True})


if __name__ == '__main__':
    app.run(debug=True, port=8000)
