# ⚡ MythX — AI-Powered Fake News Detector

> Real-time multimodal fact-checking for social media. Free. Open. Built with Google Gemini.

## 📌 Problem Statement

Social media platforms like Instagram and Twitter/X have become primary news sources for billions of users, yet they lack native tools to flag misleading content. Text-based fact-checkers miss the majority of disinformation, which today spreads primarily through **images, memes, and AI-generated visuals**. There is no accessible, real-time tool that analyses both the visual and textual content of social media posts together to warn users before they share or believe false information.

---

## 💡 What is MythX?

**MythX** is a free, AI-powered fake news detection system that analyzes social media content in real-time using Google Gemini 2.5 Flash. It detects misinformation in:

- 📝 Text posts, tweets, headlines, and claims
- 🖼️ Images, memes, and AI-generated visuals
- 📎 Combined text + image context
- 🔗 Social media URLs

---

## 🏗️ Project Structure

```
mythx/
├── frontend/
│   └── index.html          # Single-file web application (Vanilla JS)
├── backend/
│   ├── main.py             # FastAPI server — main entry point
│   └── requirements.txt    # Python dependencies
└── extension/
    ├── manifest.json        # Chrome MV3 configuration
    ├── popup.html          # Extension popup UI
    ├── background.js       # Service worker + context menus
    ├── content.js          # Auto-injected into social media pages
    ├── content.css         # Styles for injected UI elements
    └── icons/              # 16px, 48px, 128px extension icons
```

---

## 🧠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| AI Engine | `gemini-2.5-flash` | Multimodal analysis — text NLP + image vision |
| Backend | `FastAPI` (Python) | REST API, prompt engineering, JSON parsing |
| Server | `Uvicorn` | ASGI server running FastAPI |
| HTTP Client | `httpx` | Async calls to Gemini API |
| Validation | `Pydantic` | Request/response model validation |
| Frontend | Vanilla JS/HTML/CSS | Single-file web app, zero dependencies |
| Extension | Chrome MV3 | Manifest V3 Chrome extension standard |
| Key Storage | `chrome.storage.local` | Secure API key — never leaves your device |
| Stats | `localStorage` | Browser-side usage statistics |
| Fonts | Google Fonts | Syne + JetBrains Mono |

---

## 🚀 Getting Started

### Step 1 — Get Your FREE Gemini API Key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with Google (no credit card needed)
3. Click **Create API Key → Create API key in new project**
4. Copy your key (starts with `AIza...`)

> **Free tier:** 1,500 requests/day · 15 requests/minute — plenty for personal use.

---

### Option A — Web App Only *(Easiest — no install needed)*

Just open `frontend/index.html` directly in your browser:

```bash
# Double-click the file in File Explorer
# OR open in browser:
file:///D:/github/mythx/frontend/index.html
```

The web app calls Gemini directly from the browser — **no backend required**.

---

### Option B — Full Stack with Backend

```bash
# 1. Navigate to backend folder
cd D:\github\mythx\backend

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set your API key (PowerShell)
$env:GEMINI_API_KEY="AIza...your_key_here"

# 4. Start the server
uvicorn main:app --reload --port 8000
```

Server runs at `http://localhost:8000`  
Visit `/docs` for interactive Swagger API documentation.

---

### Option C — Chrome Extension

1. Open Chrome → go to `chrome://extensions/`
2. Toggle **Developer Mode** ON (top-right corner)
3. Click **Load unpacked** → select the `extension/` folder
4. Pin the ⚡ MythX icon to your toolbar
5. Click the icon → paste your free Gemini API key → done!

---

## ✨ Features

### Web Application

| Feature | Description |
|---------|-------------|
| Text Analysis | Paste any tweet, headline, post, or claim for instant fact-checking |
| Image Analysis | Upload memes or screenshots — AI reads all visible text inside |
| Combined Mode | Analyze text + image together for deeper multimodal analysis |
| URL Mode | Paste social media URLs with post text for analysis |
| Drag & Drop | Drop images directly onto the upload zone |
| Stats Dashboard | Tracks total analyzed, fake detected, and verified real counts |

### Chrome Extension

| Feature | Description |
|---------|-------------|
| Popup UI | Manual text/image analysis directly from the extension popup |
| Grab from Page | Auto-extracts content from the currently active browser tab |
| Right-Click Menu | Select any text → right-click → **⚡ MythX: Fact-Check** |
| Auto-Inject Buttons | ⚡ MythX Check buttons appear on Twitter/X posts automatically |
| Inline Results | Verdict shown directly below the post on social media pages |
| Secure Key Storage | API key stored locally — never sent to any third-party server |

---

## 🔍 Verdict Types

| Verdict | Color | Meaning |
|---------|-------|---------|
| 🚫 **FAKE** | 🔴 Red | Clear misinformation, fabricated events, known false claims |
| ⚠️ **MISLEADING** | 🟠 Orange | Contains truth but twisted, out of context, or exaggerated |
| ✅ **REAL** | 🟢 Green | Credible, verifiable information from reliable sources |
| 🔍 **UNVERIFIED** | 🟣 Purple | Cannot confirm or deny — needs more evidence or context |

Each result also includes:
- **Confidence %** — how certain the AI is in its verdict
- **Credibility Score** — overall content credibility (0–100)
- **Red Flags** — specific warning signs detected in the content
- **Fact Checks** — specific claims identified and assessed

---

## 🌐 API Reference

### `POST /analyze`

**Request Body:**
```json
{
  "text":         "Optional text content to analyze",
  "image_url":    "Optional image URL",
  "image_base64": "Optional base64-encoded image data",
  "url":          "Optional social media URL"
}
```

**Response:**
```json
{
  "verdict":           "FAKE",
  "confidence":        87,
  "explanation":       "This claim is contradicted by multiple verified sources...",
  "red_flags":         ["No credible sources cited", "Emotional language used"],
  "fact_checks":       ["WHO data shows vaccination rates of 72%"],
  "credibility_score": 12,
  "verdict_color":     "#FF3B5C"
}
```

### Other Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | API status and key configuration check |
| `GET /health` | Health check — returns `{status: healthy}` |
| `GET /docs` | Auto-generated Swagger UI for interactive testing |

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  USER INPUTS                    │
│     Text │ Image │ Text+Image │ URL             │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │     FRONTEND        │
        │   index.html        │
        │  • base64 encode    │
        │  • HTTP POST        │
        │  • result display   │
        └──────────┬──────────┘
                   │ POST /analyze
        ┌──────────▼──────────┐
        │     BACKEND         │
        │  FastAPI + Uvicorn  │
        │  • validate input   │
        │  • build prompt     │
        │  • call Gemini      │
        │  • parse JSON       │
        └──────────┬──────────┘
                   │ HTTPS API
        ┌──────────▼──────────┐
        │   GOOGLE GEMINI     │
        │  gemini-2.5-flash   │
        │  • text analysis    │
        │  • image vision     │
        │  • fact checking    │
        └─────────────────────┘
```

### Why Base64 for Images?
HTTP/JSON can only transfer text. Images are binary data. Base64 converts binary bytes into a safe ASCII string that travels inside JSON without corruption. A 1MB image becomes ~1.33MB of text (33% overhead) — acceptable for a fact-checking use case.

### 3-Layer JSON Parser
Gemini occasionally wraps responses in markdown or returns `null` fields. MythX handles this gracefully:

1. **Layer 1** — Direct `json.loads()` on the raw response
2. **Layer 2** — Regex extraction of JSON object from surrounding text
3. **Layer 3** — Manual field-by-field regex extraction for malformed responses

---

## ⚠️ Known Limitations

| Limitation | Details |
|-----------|---------|
| URL Fetching | URLs are passed as text — actual page content is not crawled |
| Image-only Posts | Images with no visible text return UNVERIFIED (no claim to fact-check) |
| Rate Limits | Free tier: 1,500 requests/day, 15 requests/minute |
| Twitter/X Auth | Extension cannot access private/login-gated posts |
| Knowledge Cutoff | Gemini may not know about very recent events |
| Firewall Issues | Backend requires access to `generativelanguage.googleapis.com` |

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key |
| `PORT` | ❌ No | Server port (default: `8000`) |

```powershell
# PowerShell — current session only
$env:GEMINI_API_KEY="AIza...your_key"

# PowerShell — permanent (restart terminal after)
[System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY","AIza...","User")
```

---

## 📦 Dependencies

```
fastapi==0.115.0
uvicorn==0.32.0
httpx==0.27.2
pydantic==2.9.2
python-multipart==0.0.12
```

```bash
pip install -r requirements.txt
```

---

## 🛠️ Supported Platforms (Extension)

- 🐦 Twitter / X
- 📸 Instagram
- 👥 Facebook
- 🤖 Reddit
- 🌐 Any webpage via right-click context menu

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<div align="center">
  <strong>⚡ MythX — Truth Detection Engine</strong><br>
  Powered by Google Gemini (Free Tier) &nbsp;|&nbsp; Built with FastAPI &nbsp;|&nbsp; MIT License
</div>
