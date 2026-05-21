# ✨ Polyglot - AI Translator App

Polyglot is a premium, full-stack language translation web application. It combines a modern, responsive React frontend with a high-performance FastAPI Python backend, featuring SQLite persistence, real-time voice input, text-to-speech playback, and translation history tracking with favorites filtering.

---

## 🚀 Features

### 🎙️ Interactive User Interface
- **Modern Glassmorphic Design:** A dark-mode user interface with smooth transitions, modern typography (Outfit/Inter), and hover micro-animations.
- **Bi-directional Swapping:** Swap the source and target languages/texts instantly with a single click.
- **Character Counter:** Visual cues and validation preventing input text from exceeding the 500-character limit.
- **Success Feedback:** Immediate visual confirmation (checkmarks) when copying translations to the clipboard.

### 🔊 Advanced Web Speech Features
- **Speech Recognition (Voice Input):** Speak directly into the microphone to input text (uses the browser's Web Speech API).
- **Speech Synthesis (Text-to-Speech):** Listen to translations read aloud in native-sounding accents with visual audio wave animations.

### 💾 Persistent History & Favorites
- **Recent Log:** View the 20 most recent translations instantly fetched from the backend.
- **Favorites Filter:** Toggle items as favorites (starred) and filter the history log to quickly access saved translations.
- **Quick Restore:** Click on any history entry to restore its text, source language, and target language back into the translator.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19 (Vite)
- **API Client:** Axios
- **Styling:** Vanilla CSS (Tailwind-free, offering fine-grained custom transition states)
- **Deployment:** GitHub Pages

### Backend
- **Framework:** FastAPI (Python 3.x)
- **ASGI Web Server:** Uvicorn
- **ORM / Database:** SQLAlchemy / SQLite
- **Translation Engine:** `deep-translator` (Google Translator) with automatic Google Translate HTTP fallback
- **Hosting:** Render

---

## 📂 Project Structure

```text
translator-app/
├── backend/
│   ├── .venv/                  # Python Virtual Environment
│   ├── database.py             # SQLite configuration, ORM Engine, and Models
│   ├── main.py                 # FastAPI application and endpoint logic
│   ├── requirements.txt        # Python package dependencies
│   ├── runtime.txt             # Render runtime version specifier
│   └── translator.db           # SQLite database file (locally generated)
├── frontend/
│   ├── src/
│   │   ├── assets/             # Static graphics
│   │   ├── utils/
│   │   │   └── api.js          # Axios API configuration & request helpers
│   │   ├── App.css             # Component-specific styles
│   │   ├── App.jsx             # Main Application component and logic
│   │   ├── index.css           # Global typography & root variables
│   │   └── main.jsx            # React root entry point
│   ├── index.html              # Frontend DOM template
│   ├── vite.config.js          # Vite build config
│   ├── package.json            # Node project configuration
│   └── eslint.config.js        # ESLint code-style configuration
└── README.md                   # Project documentation (this file)
```

---

## ⚙️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.10+)

---

### 1. Backend Setup

Navigate to the `backend` directory:
```bash
cd backend
```

Create a virtual environment and activate it:
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

Install the dependencies:
```bash
pip install -r requirements.txt
```

*(Optional)* Create a `.env` file in the `backend/` directory to configure the optional language detection API key:
```env
DETECT_LANGUAGE_API_KEY=your_api_key_here
```
> [!NOTE]
> If `DETECT_LANGUAGE_API_KEY` is not provided, the backend seamlessly falls back to Google's public translation endpoint for language auto-detection.

Run the development server:
```bash
uvicorn main:app --reload
```
The backend API will be available at `http://localhost:8000` with interactive API docs at `http://localhost:8000/docs`.

---

### 2. Frontend Setup

Navigate to the `frontend` directory:
```bash
cd ../frontend
```

Install the packages:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```
The frontend application will start at `http://localhost:5173`.

> [!TIP]
> To run the frontend locally with a local backend, update the `baseURL` in [api.js](file:///C:/Users/Sanbaj%20Ansari/Documents/Samir/translator-app/frontend/src/utils/api.js) from the hosted Render link back to `http://localhost:8000`.

---

## 🗄️ Database Schema

SQLite is used for local database transactions. The database includes a single `translations` table defined via SQLAlchemy in `database.py`:

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary key (Auto-incremented) |
| `original_text` | `VARCHAR` | Text submitted for translation |
| `translated_text`| `VARCHAR` | Translated text returned by translation engine |
| `source_language`| `VARCHAR` | Resolved ISO-639-1 source language code (e.g. `en`, `es`) |
| `target_language`| `VARCHAR` | Target ISO-639-1 language code |
| `is_favourite` | `BOOLEAN` | Toggles whether the entry has been starred |
| `created_at` | `DATETIME`| Timestamp of the translation transaction (defaults to UTC now) |

---

## 🔌 API Reference

### 1. Translate Text
- **Endpoint:** `POST /translate`
- **Request Body:**
  ```json
  {
    "text": "Hello world",
    "target_language": "es",
    "source_language": "auto"
  }
  ```
- **Response Example:**
  ```json
  {
    "id": 1,
    "original_text": "Hello world",
    "translated_text": "Hola Mundo",
    "source_language": "en",
    "target_language": "es",
    "is_favourite": false,
    "created_at": "2026-05-20T22:15:30.123456"
  }
  ```

### 2. Detect Language
- **Endpoint:** `POST /detect`
- **Request Body:**
  ```json
  {
    "text": "Bonjour tout le monde"
  }
  ```
- **Response Example:**
  ```json
  {
    "language": "fr"
  }
  ```

### 3. Fetch History
- **Endpoint:** `GET /history`
- **Response Example:**
  ```json
  [
    {
      "id": 1,
      "original_text": "Hello world",
      "translated_text": "Hola Mundo",
      "source_language": "en",
      "target_language": "es",
      "is_favourite": false,
      "created_at": "2026-05-20T22:15:30.123456"
    }
  ]
  ```

### 4. Toggle Favorite
- **Endpoint:** `PUT /history/{id}/favourite`
- **Response Example:**
  ```json
  {
    "id": 1,
    "original_text": "Hello world",
    "translated_text": "Hola Mundo",
    "source_language": "en",
    "target_language": "es",
    "is_favourite": true,
    "created_at": "2026-05-20T22:15:30.123456"
  }
  ```

### 5. Health Check
- **Endpoint:** `GET /health`
- **Response Example:**
  ```json
  {
    "status": "healthy"
  }
  ```

---

## 🚢 Deployment

### Frontend Deployment (GitHub Pages)
The project is configured for deployment using the `gh-pages` npm package.
1. Build and deploy the project:
   ```bash
   npm run deploy
   ```
2. The site is live at: `https://sanbaj-traid.github.io/translation-app/`

### Backend Deployment (Render)
The backend is configured to be hosted on Render.
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Production Endpoint:** `https://translation-app-d64t.onrender.com/`
