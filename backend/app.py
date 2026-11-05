import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from ai_service import generate_interview_question, evaluate_answer
import database

app = Flask(__name__)
CORS(app)

# Initialize SQLite database on startup
database.init_db()


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "AI Mock Interview Backend is running!",
        "status": "success"
    })


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "project": "AI-Powered Mock Interview System",
        "status": "healthy"
    })


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = data.get("name")
    email_or_usn = data.get("email_or_usn")
    password = data.get("password")

    success, result = database.register_user(name, email_or_usn, password)
    if not success:
        return jsonify({"error": result}), 400

    return jsonify({
        "message": "Registration successful!",
        "user": result
    }), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email_or_usn = data.get("email_or_usn")
    password = data.get("password")

    success, result = database.authenticate_user(email_or_usn, password)
    if not success:
        return jsonify({"error": result}), 401

    return jsonify({
        "message": "Login successful!",
        "user": result
    }), 200


@app.route("/api/generate-question", methods=["POST"])
def generate_question():
    data = request.get_json() or {}

    domain = data.get("domain", "DSA")
    difficulty = data.get("difficulty", "Intermediate")

    try:
        question = generate_interview_question(domain, difficulty)
        return jsonify({"question": question})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/evaluate-answer", methods=["POST"])
def evaluate():
    data = request.get_json() or {}

    domain = data.get("domain")
    question = data.get("question")
    answer = data.get("answer")
    difficulty = data.get("difficulty", "Intermediate")
    user_id = data.get("user_id")

    if not all([domain, question, answer]):
        return jsonify({"error": "Missing required fields (domain, question, answer)"}), 400

    try:
        feedback = evaluate_answer(domain, question, answer)

        # Optionally persist to database if user is logged in
        if user_id:
            try:
                score = feedback.get("score") if isinstance(feedback, dict) else None
                database.save_interview_record(
                    user_id=int(user_id),
                    domain=domain,
                    difficulty=difficulty,
                    question=question,
                    answer=answer,
                    score=score,
                    feedback=json.dumps(feedback) if isinstance(feedback, dict) else str(feedback)
                )
            except Exception as db_err:
                # Non-fatal if history recording fails
                app.logger.warning(f"Could not persist interview history: {db_err}")

        return jsonify({"feedback": feedback})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/history/<int:user_id>", methods=["GET"])
def history(user_id):
    try:
        records = database.get_user_interview_history(user_id)
        # Parse feedback JSON if available
        for rec in records:
            if rec.get("feedback"):
                try:
                    rec["feedback"] = json.loads(rec["feedback"])
                except Exception:
                    pass
        return jsonify({"history": records})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
