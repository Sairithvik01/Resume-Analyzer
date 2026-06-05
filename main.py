"""
ResumeAI — Indian ATS Resume Analyzer
FastAPI backend with Google Gemini integration for Hugging Face Spaces.
"""

import os
import io
import re
import json
import logging
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
import docx2txt
from PIL import Image
from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# Logging & Setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resume-analyzer")

app = FastAPI(title="ResumeAI API")

# Allow CORS for cloud hosting flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Constants & Schemas
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """
You are an expert Indian ATS (Applicant Tracking System) Analyzer and Technical Recruiter. 
Analyze the provided resume against the Target Role and Experience Level. 
Be highly critical but constructive. Focus on quantifiable metrics, impact, and keywords.
"""

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "healthScore": {
            "type": "OBJECT",
            "properties": {
                "overall": {"type": "NUMBER", "description": "Score out of 100"},
                "formatting": {"type": "NUMBER"},
                "content": {"type": "NUMBER"}
            }
        },
        "strengths": {
            "type": "ARRAY",
            "items": {"type": "STRING"}
        },
        "weaknesses": {
            "type": "ARRAY",
            "items": {"type": "STRING"}
        },
        "missingKeywords": {
            "type": "ARRAY",
            "items": {"type": "STRING"}
        },
        "summary": {"type": "STRING"}
    },
    "required": ["healthScore", "strengths", "weaknesses", "summary"]
}

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------
def strip_tokens(text: str) -> str:
    """Removes excessive whitespace and newlines to save tokens."""
    return re.sub(r'\s+', ' ', text).strip()

def compress_image(raw_bytes: bytes) -> bytes:
    """Compresses uploaded images to JPEG to save bandwidth and API limits."""
    img = Image.open(io.BytesIO(raw_bytes))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=80)
    return out.getvalue()

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
async def serve_frontend():
    if not os.path.exists("static/index.html"):
        return {"message": "API is running. (static/index.html not found. Please upload your frontend files to the 'static' folder.)"}
    return FileResponse("static/index.html")


@app.post("/analyze")
async def analyze_resume(
    target_role: str = Form("Software Engineer"),
    experience_level: str = Form("Entry Level"),
    file: UploadFile = File(...),
):
    raw = await file.read()
    fname = (file.filename or "").lower()
    logger.info("Received file: %s (%d bytes)", file.filename, len(raw))

    is_image = False
    text = ""

    # ------ PDF ------
    if fname.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(raw))
            pages = [p.extract_text() or "" for p in reader.pages]
            text = "\n".join(pages)
        except Exception as exc:
            raise HTTPException(400, f"PDF parse error: {exc}")
        text = strip_tokens(text)
        if not text.strip():
            raise HTTPException(400, "Could not extract text from PDF. Is it an image-PDF? Upload as an image.")

    # ------ DOCX ------
    elif fname.endswith((".docx", ".doc")):
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
                tmp.write(raw)
                tmp_path = tmp.name
            text = docx2txt.process(tmp_path)
        except Exception as exc:
            raise HTTPException(400, f"DOCX parse error: {exc}")
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
        text = strip_tokens(text)
        if not text.strip():
            raise HTTPException(400, "Could not extract text from document.")

    # ------ Image ------
    elif fname.endswith((".png", ".jpg", ".jpeg", ".webp")):
        is_image = True
        try:
            compressed = compress_image(raw)
        except Exception as exc:
            raise HTTPException(400, f"Image processing error: {exc}")
    else:
        raise HTTPException(400, "Unsupported file type. Please upload PDF, DOCX, PNG, JPG, or JPEG.")

    # ------ Build Gemini prompt ------
    user_context = f"\n\nTarget Role: {target_role}\nExperience Level: {experience_level}"

    if is_image:
        image_part = types.Part.from_bytes(data=compressed, mime_type="image/jpeg")
        contents = [
            SYSTEM_PROMPT + user_context + "\n\nAnalyze the resume shown in this image:",
            image_part,
        ]
    else:
        contents = [
            SYSTEM_PROMPT + user_context + f"\n\nResume text (stop-words stripped for brevity):\n\n{text}"
        ]

    # ------ Call Gemini ------
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            500,
            "GEMINI_API_KEY environment variable not set. "
            "Add it as a secret in your Hugging Face Space settings.",
        )

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RESPONSE_SCHEMA,
                temperature=0.2,
            ),
        )
        result = json.loads(response.text)
        logger.info("Analysis complete — score: %s", result.get("healthScore", {}).get("overall"))
        return JSONResponse(content=result)

    except json.JSONDecodeError:
        logger.error("Gemini returned non-JSON: %s", response.text[:500])
        raise HTTPException(502, "AI returned malformed response. Please try again.")
    except Exception as exc:
        logger.error("Gemini API error: %s", exc)
        raise HTTPException(502, f"AI analysis failed: {exc}")

# ---------------------------------------------------------------------------
# Static file mount
# -----------------------------------------------------------------------
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/css", StaticFiles(directory="static/css"), name="css")
app.mount("/js", StaticFiles(directory="static/js"), name="js")