# backend/app/main.py

import os
import re
import json
from typing import List, Tuple

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import vertexai
from vertexai.preview.generative_models import GenerativeModel

# ---------------------------------------------------------------------------- #
# Load configuration from .env
# ---------------------------------------------------------------------------- #
load_dotenv()  # expects .env at project root

YT_KEY     = os.getenv("YOUTUBE_API_KEY")
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
REGION     = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")

if not (YT_KEY and PROJECT_ID):
    raise RuntimeError("Missing YOUTUBE_API_KEY or GOOGLE_CLOUD_PROJECT_ID in .env")

# ---------------------------------------------------------------------------- #
# Initialize FastAPI and enable CORS
# ---------------------------------------------------------------------------- #
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------- #
# Initialize Vertex AI & load Gemini 2.5 Flash Preview model
# ---------------------------------------------------------------------------- #
vertexai.init(project=PROJECT_ID, location=REGION)
ai_model = GenerativeModel("gemini-2.5-flash-preview-05-20")

# ---------------------------------------------------------------------------- #
# Debug endpoint
# ---------------------------------------------------------------------------- #
@app.get("/debug")
def debug():
    """
    Confirm that environment variables and model selection are correct.
    """
    return {
        "YOUTUBE_API_KEY_set": bool(YT_KEY),
        "GOOGLE_CLOUD_PROJECT_ID": PROJECT_ID,
        "GOOGLE_CLOUD_REGION": REGION,
        "model_in_use": ai_model.model_id,
    }

# ---------------------------------------------------------------------------- #
# Helper: fetch comments from YouTube
# ---------------------------------------------------------------------------- #
async def fetch_comments(video_id: str) -> List[str]:
    url = "https://www.googleapis.com/youtube/v3/commentThreads"
    params = {
        "key": YT_KEY,
        "videoId": video_id,
        "part": "snippet",
        "maxResults": 100,
        "textFormat": "plainText",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params)

    if resp.status_code == 404:
        raise HTTPException(404, "Video not found or comments disabled")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"YouTube API error: {resp.text}")

    items = resp.json().get("items", [])
    return [
        item["snippet"]["topLevelComment"]["snippet"]["textOriginal"]
        for item in items
    ]

# ---------------------------------------------------------------------------- #
# Helper: call Gemini to analyze comments
# ---------------------------------------------------------------------------- #
async def call_gemini(
    comments: List[str]
) -> Tuple[List[str], List[List[str]]]:
    # Build a numbered‐list prompt
    text_block = "\n".join(f"{i+1}. {c}" for i, c in enumerate(comments))
    prompt = (
        "You are a JSON generator. Given a list of YouTube comments, output a JSON object "
        "with two keys:\n"
        "  1) \"sentiments\": [\"positive\",\"neutral\",\"negative\",...]\n"
        "  2) \"keywords\": [[...], [...], ...]\n\n"
        f"Comments:\n{text_block}\n\n"
        "Respond ONLY with the raw JSON object—do NOT wrap it in markdown fences or add any extra text."
    )

    try:
        response = ai_model.generate_content(prompt)
        raw = response.text
    except Exception as e:
        raise HTTPException(500, f"Vertex AI error: {e}")

    # Strip any markdown fences
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
        return parsed["sentiments"], parsed["keywords"]
    except Exception as e:
        raise HTTPException(
            500,
            f"Failed parsing model output: {e}\nCleaned output:\n{cleaned}"
        )

# ---------------------------------------------------------------------------- #
# Main analyze endpoint
# ---------------------------------------------------------------------------- #
@app.get("/analyze")
async def analyze(videoId: str):
    """
    1) Fetch YouTube comments
    2) Analyze with Gemini 2.5 Flash Preview
    3) Return comments, sentiment labels, and keyword arrays
    """
    # Step 1: fetch comments
    try:
        comments = await fetch_comments(videoId)
    except HTTPException as he:
        return {"comments": [], "sentiment": [], "keywords": [], "error": he.detail}

    # Step 2: analyze comments
    try:
        sentiments, keywords = await call_gemini(comments)
    except HTTPException as he:
        return {"comments": comments, "sentiment": [], "keywords": [], "error": he.detail}

    # Step 3: success
    return {
        "comments": comments,
        "sentiment": sentiments,
        "keywords": keywords,
    }
