import json
from flask import Flask, render_template, request, redirect, url_for, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('homepage.html')

@app.route('/learn')
def learn():
    return render_template('learn.html')

@app.route('/learn/<int:lesson_id>')
def learn_lesson(lesson_id):
    return render_template('learn.html', lesson_id=lesson_id)

if __name__ == '__main__':
    app.run(debug=True, port=8000)