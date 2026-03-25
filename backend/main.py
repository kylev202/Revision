"""
FastAPI backend for AI Study Tool.
Endpoints: /generate, /evaluate, /files, /files/{id}
"""

import hashlib
import json
import os
import time

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response

from backend.pdf_extractor import extract_text_from_pdf
from backend.ai_service import (
    generate_study_material,
    evaluate_explanation,
    chat_with_document,
    MAX_INPUT_CHARS,
)

app = FastAPI(title="AI Study Tool")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------- Storage ---------------

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
FILES_DIR = os.path.join(DATA_DIR, "files")      # stored PDFs
META_FILE = os.path.join(DATA_DIR, "meta.json")   # file index

os.makedirs(FILES_DIR, exist_ok=True)


def _load_meta() -> list[dict]:
    if os.path.exists(META_FILE):
        with open(META_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def _save_meta(meta: list[dict]):
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)


def _add_file_record(filename: str, text: str, pdf_bytes: bytes | None) -> dict:
    """Save a file to the data store and return its record."""
    file_id = hashlib.sha256(
        f"{filename}{time.time()}".encode()
    ).hexdigest()[:12]

    record = {
        "id": file_id,
        "filename": filename,
        "uploaded_at": int(time.time()),
        "char_count": len(text),
    }

    # Save extracted text
    with open(os.path.join(FILES_DIR, f"{file_id}.txt"), "w", encoding="utf-8") as f:
        f.write(text)

    # Save original PDF if present
    if pdf_bytes:
        with open(os.path.join(FILES_DIR, f"{file_id}.pdf"), "wb") as f:
            f.write(pdf_bytes)

    meta = _load_meta()
    meta.insert(0, record)
    _save_meta(meta)
    return record


# --------------- Serve frontend ---------------

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
async def serve_frontend():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# --------------- File history endpoints ---------------


@app.get("/files")
async def list_files():
    """Return all uploaded file records (newest first)."""
    return _load_meta()


@app.get("/files/{file_id}")
async def get_file_text(file_id: str):
    """Return the extracted text for a stored file."""
    path = os.path.join(FILES_DIR, f"{file_id}.txt")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found.")
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    return {"id": file_id, "text": text}


@app.get("/files/{file_id}/pdf")
async def get_file_pdf(file_id: str):
    """Return the original PDF if it was stored."""
    path = os.path.join(FILES_DIR, f"{file_id}.pdf")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="PDF not found.")
    return FileResponse(path, media_type="application/pdf")


@app.put("/files/{file_id}")
async def rename_file(file_id: str, filename: str = Form(...)):
    """Rename a stored file."""
    meta = _load_meta()
    for rec in meta:
        if rec["id"] == file_id:
            rec["filename"] = filename
            _save_meta(meta)
            return rec
    raise HTTPException(status_code=404, detail="File not found.")


@app.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Delete a file and its data."""
    meta = _load_meta()
    new_meta = [r for r in meta if r["id"] != file_id]
    if len(new_meta) == len(meta):
        raise HTTPException(status_code=404, detail="File not found.")
    _save_meta(new_meta)

    # Remove stored files
    for ext in ("txt", "pdf"):
        path = os.path.join(FILES_DIR, f"{file_id}.{ext}")
        if os.path.exists(path):
            os.remove(path)

    return {"ok": True}


# --------------- Generate endpoint ---------------


@app.post("/generate")
async def generate(
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
):
    """
    Accepts a PDF file upload or pasted text.
    Returns JSON study material and saves the file to history.
    """
    raw_text = ""
    pdf_bytes = None
    filename = "Pasted text"

    if file and file.filename:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        pdf_bytes = await file.read()
        if len(pdf_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        raw_text = extract_text_from_pdf(pdf_bytes)
        filename = file.filename

    elif text and text.strip():
        raw_text = text.strip()

    else:
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF or paste some text.",
        )

    if len(raw_text) < 50:
        raise HTTPException(
            status_code=400,
            detail="Text is too short. Please provide more content.",
        )

    if len(raw_text) > MAX_INPUT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Text is too long ({len(raw_text)} chars). Max is {MAX_INPUT_CHARS}.",
        )

    # Save to history
    record = _add_file_record(filename, raw_text, pdf_bytes)

    try:
        result = generate_study_material(raw_text)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing failed: {e}")

    # Attach file ID so frontend can reference this file later
    result["file_id"] = record["id"]
    result["filename"] = record["filename"]
    return result


# --------------- Evaluate endpoint (Feynman Technique) ---------------


@app.post("/evaluate")
async def evaluate(
    topic: str = Form(...),
    explanation: str = Form(...),
    summary: str = Form(...),
):
    """
    Feynman Technique: user writes an explanation, AI evaluates it.
    """
    if len(explanation.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Please write a more detailed explanation (at least 20 characters).",
        )

    try:
        result = evaluate_explanation(topic, explanation.strip(), summary)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI evaluation failed: {e}")

    return result


# --------------- Chat endpoint ---------------


@app.post("/chat")
async def chat(
    file_id: str = Form(...),
    messages: str = Form(...),  # JSON-encoded list of {role, content}
):
    """
    Chat with AI about a specific uploaded document.
    """
    # Load document text
    path = os.path.join(FILES_DIR, f"{file_id}.txt")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found.")
    with open(path, "r", encoding="utf-8") as f:
        doc_text = f.read()

    try:
        msg_list = json.loads(messages)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid messages JSON.")

    if not msg_list or not isinstance(msg_list, list):
        raise HTTPException(status_code=400, detail="Messages must be a non-empty list.")

    try:
        reply = chat_with_document(doc_text, msg_list)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")

    return {"reply": reply}
