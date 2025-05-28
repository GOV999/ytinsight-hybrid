# backend/app/main.py
import os, json, httpx
from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
YT_KEY = os.getenv("YOUTUBE_API_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

@app.get("/analyze")
async def analyze(videoId: str):
    # 1) Fetch top 100 comments using AsyncClient
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/youtube/v3/commentThreads",
            params={
                "key": YT_KEY,
                "videoId": videoId,
                "part": "snippet",
                "maxResults": 100,
                "textFormat": "plainText",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, detail=resp.text)

    items = resp.json().get("items", [])
    comments = [
        it["snippet"]["topLevelComment"]["snippet"]["textOriginal"]
        for it in items
    ]

    # TODO: Replace with real Gemini call
    return {
        "comments": comments,
        "sentiment": [],
        "keywords": [],
    }
