import json
import os
import re
from pathlib import Path
from dotenv import load_dotenv
from google import genai

# Load .env from backend directory first, then fallback to cwd
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

CANDIDATE_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest"]


def get_client():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("Gemini API key not found. Please set GEMINI_API_KEY in backend/.env.")
    return genai.Client(api_key=api_key)


def _generate_with_fallback(prompt: str, temperature: float = 0.7) -> str:
    client = get_client()
    last_error = None

    for model_name in CANDIDATE_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            last_error = e
            continue

    raise last_error or RuntimeError("Failed to generate response from Gemini API.")


def generate_interview_question(domain: str, difficulty: str) -> str:
    prompt = f"""
You are a technical interviewer conducting a mock interview for an engineering student.

Generate exactly ONE short, crisp interview question.
Domain: {domain}
Difficulty level: {difficulty}

Strict rules:
1. Keep the question SHORT (maximum 15 to 20 words, exactly ONE single sentence).
2. Do NOT ask multi-part, scenario-based, or compound questions.
3. Return ONLY the question itself.
4. Do NOT include any introductory phrases (like "Here is your question:"), hints, or answers.
5. The question must be clear and comfortable to listen to via text-to-speech.
""".strip()

    question = _generate_with_fallback(prompt)

    # Clean any accidental wrapping quotes or prefixes
    question = question.strip().strip('"').strip("'")
    if question.lower().startswith("question:"):
        question = question[9:].strip()
    return question


def evaluate_answer(domain: str, question: str, answer: str) -> dict:
    prompt = f"""
You are a professional, encouraging, and fair technical interviewer.
Evaluate the candidate's answer for this interview question.

Domain: {domain}
Question: {question}
Candidate's Answer: {answer}

Provide a comprehensive, constructive evaluation in VALID JSON format with the following exact keys:
{{
  "score": <number between 1 and 10, decimal allowed e.g. 7.5>,
  "summary": "<1-2 sentences summarizing overall performance>",
  "strengths": [
    "<specific point 1>",
    "<specific point 2>"
  ],
  "improvements": [
    "<specific improvement suggestion 1>",
    "<specific improvement suggestion 2>"
  ],
  "suggested_answer": "<A clear, well-structured model answer that the candidate could study>"
}}

Respond with ONLY the raw JSON object. Do not enclose in markdown code blocks if possible.
""".strip()

    raw_response = _generate_with_fallback(prompt)

    # Clean markdown if present
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        feedback_data = json.loads(cleaned)
        # Validate expected keys
        if "score" not in feedback_data:
            feedback_data["score"] = 7.0
        if "strengths" not in feedback_data:
            feedback_data["strengths"] = ["Good attempt answering the question."]
        if "improvements" not in feedback_data:
            feedback_data["improvements"] = ["Elaborate with more technical details and practical examples."]
        if "suggested_answer" not in feedback_data:
            feedback_data["suggested_answer"] = "Review core principles for " + domain
        return feedback_data
    except Exception:
        # Fallback structured object if model returned plain text
        return {
            "score": 7.0,
            "summary": "Your answer was reviewed by AI.",
            "strengths": ["Answer recorded and evaluated."],
            "improvements": ["Try providing structured points and concrete examples."],
            "suggested_answer": raw_response,
            "raw_feedback": raw_response
        }