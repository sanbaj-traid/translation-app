import os
import logging
import requests
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from deep_translator import GoogleTranslator, single_detection

# Import database module variables and dependencies
from database import engine, Base, get_db, Translation

# ---------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------
# Database Table Initializer
# Triggers creation of all SQL tables defined under Base
# when the application module is loaded on startup.
# ---------------------------------------------------------
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------
# FastAPI App Initialization
# ---------------------------------------------------------
app = FastAPI(
    title="Translator API",
    description="A FastAPI backend with SQLite persistence for translating text and detecting languages using Google Translator.",
    version="1.2.0"
)

# ---------------------------------------------------------
# CORS Middleware Configuration
# Allows request routing from the Vite-based React frontend.
# ---------------------------------------------------------
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://sanbaj-traid.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allows standard HTTP verbs
    allow_headers=["*"],  # Allows custom and standard headers
)

# ---------------------------------------------------------
# Request Validation Schemas
# ---------------------------------------------------------
class TranslateRequest(BaseModel):
    text: str
    target_language: str
    source_language: str = "auto"

class DetectRequest(BaseModel):
    text: str

# ---------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------
def perform_detection(text: str) -> str:
    """
    Attempts to detect the language of the provided text.
    First tries deep-translator's single_detection if DETECT_LANGUAGE_API_KEY
    is set in environment variables. If key is missing or fails, falls back
    to Google Translate's free API endpoint.
    """
    api_key = os.getenv("DETECT_LANGUAGE_API_KEY")
    if api_key:
        try:
            logger.info("Attempting language detection using deep-translator and api key.")
            detected = single_detection(text, api_key=api_key)
            if detected:
                return detected
        except Exception as e:
            logger.warning(f"deep-translator single_detection failed: {str(e)}. Falling back to Google API.")

    try:
        logger.info("Attempting language detection using Google API fallback.")
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": "en",
            "dt": "t",
            "q": text
        }
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        res_json = response.json()
        return res_json[2]  # Detected language code
    except Exception as e:
        logger.error(f"Language detection fallback failed: {str(e)}")
        return "auto"

# ---------------------------------------------------------
# 1) POST /detect Endpoint
# Detects the source language code for the provided input text.
# ---------------------------------------------------------
@app.post("/detect")
async def detect(request: DetectRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text for detection cannot be empty.")
    
    detected_lang = perform_detection(request.text.strip())
    if detected_lang == "auto":
        raise HTTPException(
            status_code=500,
            detail="Language detection failed. Could not determine source language."
        )
    
    return {"language": detected_lang}

# ---------------------------------------------------------
# 2) POST /translate Endpoint
# Translates source text, auto-detects source language if not provided,
# persists the transaction record to the database, and returns the newly saved model.
# ---------------------------------------------------------
@app.post("/translate")
async def translate(request: TranslateRequest, db: Session = Depends(get_db)):
    # Validate request payload
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text to translate cannot be empty.")
    if not request.target_language or not request.target_language.strip():
        raise HTTPException(status_code=400, detail="Target language cannot be empty.")

    try:
        src_lang = request.source_language.strip().lower()
        detected_lang = src_lang

        # Auto-detect language if source language is set to "auto"
        if src_lang == "auto":
            detected_lang = perform_detection(request.text.strip())
            # If auto-detection fails, fallback to auto on the translation service
            if detected_lang == "auto":
                detected_lang = "auto"
        
        # Perform translation using the specified source language (defaults to 'auto')
        translator = GoogleTranslator(
            source=src_lang,
            target=request.target_language.strip().lower()
        )
        translated_text = translator.translate(request.text)
        
        # If we successfully translated using auto and didn't resolve the code,
        # try another quick resolution step or default to auto
        final_src_lang = detected_lang if detected_lang != "auto" else "auto"

        # Instantiate translation model record to persist
        db_translation = Translation(
            original_text=request.text.strip(),
            translated_text=translated_text,
            source_language=final_src_lang,
            target_language=request.target_language.strip().lower(),
            is_favourite=False
        )
        
        # Persist to database using the injection-provided Session
        db.add(db_translation)
        db.commit()
        db.refresh(db_translation)  # Fetch auto-generated ID and created_at fields
        
        return db_translation
    except Exception as e:
        logger.error(f"Error during translation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Translation failed: {str(e)}"
        )

# ---------------------------------------------------------
# 3) GET /history Endpoint
# Queries the database for the 20 most recent translations,
# sorted in descending order of creation.
# ---------------------------------------------------------
@app.get("/history")
async def get_history(db: Session = Depends(get_db)):
    try:
        # Retrieve the latest 20 translation entries
        translations = db.query(Translation).order_by(Translation.created_at.desc()).limit(20).all()
        return translations
    except Exception as e:
        logger.error(f"Error retrieving history: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch translation history: {str(e)}"
        )

# ---------------------------------------------------------
# 4) PUT /history/{id}/favourite Endpoint
# Toggles the favourite status of a specific translation record by ID.
# ---------------------------------------------------------
@app.put("/history/{id}/favourite")
async def toggle_favourite(id: int, db: Session = Depends(get_db)):
    try:
        # Query database for the translation record matching the ID
        translation = db.query(Translation).filter(Translation.id == id).first()
        if not translation:
            raise HTTPException(
                status_code=404,
                detail=f"Translation record with ID {id} not found."
            )
        
        # Toggle favourite status flag
        translation.is_favourite = not translation.is_favourite
        
        # Commit status change
        db.commit()
        db.refresh(translation)
        
        return translation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling favourite for ID {id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to toggle favourite state: {str(e)}"
        )

# ---------------------------------------------------------
# 5) GET /health Endpoint
# Simple health check endpoint to verify backend status.
# ---------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
