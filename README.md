# Resume Analyzer

Resume Analyzer is a FastAPI app that scores resumes against a target role and experience level using Google Gemini.

## Features

- Upload PDF, DOCX, PNG, JPG, JPEG, or WEBP resumes
- Extract text from documents and images
- Return a structured ATS-style analysis
- Serve the frontend from `static/index.html`

## Local Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Set your Gemini API key:

```bash
set GEMINI_API_KEY=your_api_key_here
```

4. Start the app:

```bash
uvicorn main:app --reload
```

5. Open `http://127.0.0.1:8000` in your browser.

## GitHub Pages

GitHub Pages can host the frontend files in `static/`, but it cannot run the FastAPI backend in `main.py`.

This repository now includes a GitHub Pages workflow that publishes the contents of `static/` as a static site.

Important:

- The frontend now uses relative asset paths, so it works from the Pages root.
- The Analyze button still needs a live backend URL.
- Set `window.RESUME_AI_API_BASE` to your deployed FastAPI backend if you want the upload/analyze flow to work on Pages.

Recommended options:

1. Publish only the frontend as a static site on GitHub Pages.
2. Keep the FastAPI backend on a server like Render, Railway, Hugging Face Spaces, or Azure.
3. Point the frontend to the backend API with the correct public URL.

## Repository Layout

```text
main.py
requirements.txt
static/
  index.html
  css/
  js/
```
