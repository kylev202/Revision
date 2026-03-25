# AI Study Tool

Upload a PDF or paste text — get an AI-powered summary, interactive quiz, flashcards, and more.

---

## Quick Start

### 1. Download the project

```bash
git clone https://github.com/YOUR_USERNAME/revision-bot.git
cd revision-bot
```

Or download the ZIP from GitHub and extract it.

### 2. Install prerequisites

| Tool               | Version        | Download                                                             |
| ------------------ | -------------- | -------------------------------------------------------------------- |
| **Python**         | 3.11 or higher | [python.org/downloads](https://www.python.org/downloads/)            |
| **Node.js**        | 18 or higher   | [nodejs.org](https://nodejs.org/)                                    |
| **OpenAI API key** | —              | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

> During Python installation, make sure to check **"Add Python to PATH"**.

### 3. Set your OpenAI API key

**Windows (PowerShell):**

```powershell
$env:OPENAI_API_KEY = "sk-your-key-here"
```

**macOS / Linux:**

```bash
export OPENAI_API_KEY="sk-your-key-here"
```

### 4. Set up & run

```bash
npm install
npm run setup:py
npm run start
```

Open **http://127.0.0.1:8000** in your browser — done!

---

## Usage

1. **Upload a PDF** or **paste text** into the input area.
2. Click **Generate** — the AI will process your material.
3. Switch between modes using the tabs:
   - **Learn** — Summary, key concepts (click to expand), and a topic mindmap.
   - **Quiz** — One-at-a-time adaptive quiz with instant feedback and round-based mastery.
   - **Flashcards** — Flip-style cards grouped by topic. Edit or add your own.
   - **Test Me** — Free-form AI evaluation of your understanding.
   - **Explain It** — Explain a concept back to the AI and get scored.
   - **Ask AI** — Chat with the AI about your uploaded material.
4. Your files are saved in the sidebar — click any to reload.

---

## NPM Scripts

| Command              | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `npm run setup:py`   | Creates a Python virtual environment and installs backend packages |
| `npm run start`      | Starts the server with auto-reload (development)                   |
| `npm run start:prod` | Starts the server without auto-reload (production)                 |
| `npm run dev`        | Same as `npm run start`                                            |

## Running without npm

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

---

## Folder Structure

```
revision-bot/
├── backend/
│   ├── main.py              # FastAPI app & endpoints
│   ├── ai_service.py        # Chunking, OpenAI calls, result merging
│   ├── pdf_extractor.py     # PDF → text extraction (PyMuPDF)
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── index.html           # Main page
│   ├── style.css            # Styles
│   └── script.js            # Frontend logic
├── scripts/
│   ├── start.js             # Node launcher for uvicorn
│   └── setup-python.js      # Python env setup script
├── package.json
└── README.md
```

## How It Works

1. You upload a PDF or paste text.
2. The backend extracts text (PyMuPDF for PDFs).
3. Long text is split into chunks to stay within token limits.
4. Each chunk is sent to OpenAI's `gpt-4.1-mini` with a structured prompt.
5. Results are merged and returned as JSON.
6. The frontend renders interactive study material across all six modes.

## Troubleshooting

| Problem                  | Fix                                                                        |
| ------------------------ | -------------------------------------------------------------------------- | -------------- |
| `OPENAI_API_KEY not set` | Set the environment variable (see step 3 above)                            |
| `python not found`       | Install Python 3.11+ and ensure it's on your PATH                          |
| `npm not found`          | Install Node.js 18+ from [nodejs.org](https://nodejs.org/)                 |
| Server won't start       | Check if port 8000 is already in use (`netstat -ano                        | findstr 8000`) |
| PDF upload fails         | Ensure the PDF contains selectable text (scanned images are not supported) |

- User performance tracking & analytics
- "Chat with document" feature
