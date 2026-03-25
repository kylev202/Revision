"""
AI service module.
Handles text chunking, Ollama (Llama) API calls, and result merging.
Uses Ollama's OpenAI-compatible endpoint at http://localhost:11434.
"""

import json
import re
from typing import Any, cast
from openai import OpenAI

# --------------- Configuration ---------------

OLLAMA_BASE_URL = "http://localhost:11434/v1"
MODEL = "llama3.2"
TEMPERATURE = 0.4
MAX_CHUNK_CHARS = 6000
MAX_INPUT_CHARS = 50000

_client = OpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")

# --------------- Chunking ---------------


def chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current_chunk = ""
    for para in paragraphs:
        if len(current_chunk) + len(para) + 2 > max_chars:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = para
        else:
            current_chunk += "\n\n" + para
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    return chunks if chunks else [text[:max_chars]]


# --------------- JSON extraction ---------------


def _extract_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*\n?(\{.*?})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r"(\{.*})", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return None


def _safe_message_content(response: Any) -> str:
    """Extract assistant content safely from an OpenAI/Ollama chat response."""
    try:
        content = response.choices[0].message.content
    except Exception:
        return ""
    return content.strip() if isinstance(content, str) else ""


# --------------- Prompts ---------------

# Main generation prompt — produces concept summaries, many quiz questions, sectioned flashcards
SYSTEM_PROMPT = """You are an expert study assistant. Given a text excerpt, produce comprehensive study material in STRICT JSON format with NO extra text outside the JSON object.

Return exactly this structure:
{
  "summary": "A clear, concise overall summary of the main ideas (3-5 sentences).",
  "concept_details": [
    {
      "name": "Concept Name",
      "summary": "2-3 sentence explanation of this concept."
    }
  ],
  "mindmap": {
    "label": "Main Topic",
    "children": [
      {
        "label": "Subtopic 1",
        "children": [
          {"label": "Detail A"},
          {"label": "Detail B"}
        ]
      },
      {
        "label": "Subtopic 2",
        "children": [
          {"label": "Detail C"}
        ]
      }
    ]
  },
  "quiz": [
    {
      "question": "A question testing understanding (not just recall).",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "answer": "A",
      "explanation": "Short explanation of why this is correct.",
      "concept": "Which concept this question tests"
    }
  ],
  "flashcard_sections": [
    {
      "topic": "Section/Topic name",
      "cards": [
        {"front": "Question or term", "back": "Answer or definition"}
      ]
    }
  ]
}

Rules:
- Output ONLY valid JSON — no markdown fences, no commentary.
- Generate as many quiz questions as there are concepts minimum of 10. Each question MUST be unique — no duplicate questions.
- Generate flashcards grouped by topic/section. At least 20 cards .
- Quiz questions must test understanding, not memorization.
- Each quiz question must have a "concept" field saying which concept it tests.
- The mindmap should show the hierarchical structure of all topics and subtopics.
- Keep explanations short and clear."""


def _build_user_prompt(text: str, n_quiz: int, n_flash_per_section: int) -> str:
    return (
        f"Analyze the following text thoroughly. Generate at least {n_quiz} unique quiz questions "
        f"covering every concept found in the text (no duplicate questions). "
        f"Group flashcards by topic with at least {n_flash_per_section} cards per section. "
        f"Create a detailed mindmap showing the topic hierarchy.\n\n"
        f"---TEXT START---\n{text}\n---TEXT END---"
    )


# --------------- LLM calls ---------------


def _call_llm_study(text: str, n_quiz: int, n_flash_per_section: int) -> dict:
    for attempt in range(3):
        response = _client.chat.completions.create(
            model=MODEL,
            temperature=TEMPERATURE,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(text, n_quiz, n_flash_per_section)},
            ],
        )
        raw = _safe_message_content(response)
        data = _extract_json(raw)
        if data and "summary" in data and "quiz" in data:
            return data
    raise ValueError("AI returned invalid JSON after 3 attempts.")


def chat_with_document(text: str, messages: list[dict]) -> str:
    """
    Chat with the AI about the document content.
    messages = [{"role": "user"/"assistant", "content": "..."}]
    Returns the AI's reply as a string.
    """
    system_msg = (
        "You are a helpful study tutor. The student has uploaded a document. "
        "Answer their questions based on the document content below. "
        "Be concise, clear, and helpful. If the answer isn't in the document, say so.\n\n"
        f"---DOCUMENT---\n{text[:8000]}\n---END DOCUMENT---"
    )
    valid_roles = {"user", "assistant", "system"}
    clean_messages: list[dict[str, str]] = []
    for msg in messages[-10:]:
        role = str(msg.get("role", "")).strip().lower()
        content = msg.get("content", "")
        if role not in valid_roles or not isinstance(content, str):
            continue
        content = content.strip()
        if not content:
            continue
        clean_messages.append({"role": role, "content": content})

    api_messages: list[dict[str, str]] = [{"role": "system", "content": system_msg}] + clean_messages

    response = _client.chat.completions.create(
        model=MODEL,
        temperature=0.4,
        messages=cast(Any, api_messages),  # Ollama OpenAI-compatible endpoint accepts role/content dicts.
    )
    reply = _safe_message_content(response)
    return reply or "I could not generate a response this time. Please try again."


def evaluate_explanation(topic: str, user_explanation: str, reference_summary: str) -> dict:
    prompt = f"""You are evaluating a student's explanation of a topic using the Feynman Technique.

Topic: {topic}
Reference material summary: {reference_summary}

Student's explanation:
\"\"\"{user_explanation}\"\"\"

Rate the explanation and return STRICT JSON only:
{{
  "clarity": <number 1-10>,
  "strengths": ["what they got right"],
  "missing": ["key concepts they missed or got wrong"],
  "feedback": "One paragraph of constructive feedback"
}}

Output ONLY valid JSON — no markdown fences, no commentary."""

    for attempt in range(3):
        response = _client.chat.completions.create(
            model=MODEL,
            temperature=0.3,
            messages=[
                {"role": "system", "content": "You are a strict but encouraging tutor."},
                {"role": "user", "content": prompt},
            ],
        )
        raw = _safe_message_content(response)
        data = _extract_json(raw)
        if data and "clarity" in data:
            return data
    raise ValueError("AI returned invalid evaluation after 3 attempts.")


# --------------- Deduplication ---------------


def _deduplicate_quiz(questions: list[dict]) -> list[dict]:
    """Remove duplicate quiz questions based on question text similarity."""
    seen = set()
    unique = []
    for q in questions:
        # Normalize: lowercase, strip punctuation for comparison
        key = re.sub(r"[^a-z0-9 ]", "", q.get("question", "").lower()).strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(q)
    return unique


# --------------- Public API ---------------


def generate_study_material(text: str) -> dict:
    if len(text) > MAX_INPUT_CHARS:
        raise ValueError(f"Input too long ({len(text)} chars). Maximum is {MAX_INPUT_CHARS}.")

    chunks = chunk_text(text)

    if len(chunks) == 1:
        result = _call_llm_study(chunks[0], n_quiz=15, n_flash_per_section=20)
        result["quiz"] = _deduplicate_quiz(result.get("quiz", []))
        # Backwards-compatible: extract flat concepts list
        result["concepts"] = [c["name"] for c in result.get("concept_details", [])]
        return result

    # Multiple chunks — generate per chunk, then merge
    merged = {
        "summary": "",
        "concept_details": [],
        "concepts": [],
        "mindmap": {"label": "Main Topic", "children": []},
        "quiz": [],
        "flashcard_sections": [],
    }

    summaries = []
    quiz_per_chunk = max(10, 15 // len(chunks))

    for chunk in chunks:
        result = _call_llm_study(chunk, n_quiz=quiz_per_chunk, n_flash_per_section=20)
        summaries.append(result.get("summary", ""))
        merged["concept_details"].extend(result.get("concept_details", []))
        merged["quiz"].extend(result.get("quiz", []))
        merged["flashcard_sections"].extend(result.get("flashcard_sections", []))
        # Merge mindmap children
        mm = result.get("mindmap", {})
        if mm.get("children"):
            merged["mindmap"]["children"].extend(mm["children"])
        if mm.get("label") and merged["mindmap"]["label"] == "Main Topic":
            merged["mindmap"]["label"] = mm["label"]

    merged["summary"] = " ".join(summaries)

    # Deduplicate concepts
    seen = set()
    unique_cd = []
    for c in merged["concept_details"]:
        lower = c.get("name", "").lower()
        if lower and lower not in seen:
            seen.add(lower)
            unique_cd.append(c)
    merged["concept_details"] = unique_cd
    merged["concepts"] = [c["name"] for c in unique_cd]

    # Deduplicate quiz
    merged["quiz"] = _deduplicate_quiz(merged["quiz"])

    return merged
