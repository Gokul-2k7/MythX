from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import json
import os
from typing import Optional
import re

app = FastAPI(title="MythX API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

class AnalysisRequest(BaseModel):
    text: Optional[str] = None
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    url: Optional[str] = None
    api_key: Optional[str] = None

class AnalysisResponse(BaseModel):
    verdict: str
    confidence: int
    explanation: str
    red_flags: list[str]
    fact_checks: list[str]
    credibility_score: int
    verdict_color: str

async def analyze_with_gemini(text=None, image_base64=None, image_url=None, url=None, api_key=None) -> dict:
    key = api_key or GEMINI_API_KEY
    if not key:
        raise HTTPException(
            status_code=400,
            detail="No Gemini API key. Set GEMINI_API_KEY env variable or pass api_key in request."
        )

    gemini_url = f"{GEMINI_BASE_URL}?key={key}"
    parts = []

    prompt = """You are MythX, an expert AI fact-checker and visual analyst. Analyze ALL provided content for misinformation, manipulation, or deception.

For images:
- Read ALL visible text in the image carefully
- Identify if it's a meme, screenshot, news graphic, manipulated photo, or AI-generated image
- Look for signs of photo manipulation, deepfakes, or AI generation artifacts
- Check if visible text contains false claims, misleading statistics, or fabricated quotes
- Assess lighting inconsistencies, unnatural backgrounds, distorted features
- Even without external context, judge based on what IS visible

IMPORTANT RULES:
- You MUST return REAL, FAKE, or MISLEADING whenever possible — only use UNVERIFIED if you truly cannot make any assessment
- If an image shows a motivational quote, meme, or social media graphic — assess whether the quote/claim is accurate or misleading
- If an image shows people without any text or claim, return UNVERIFIED with explanation
- If an image has visible text making a claim, fact-check that claim

Respond ONLY with raw JSON (no markdown, no code blocks):
{
  "verdict": "REAL",
  "confidence": 85,
  "explanation": "Explanation here.",
  "red_flags": ["flag1", "flag2"],
  "fact_checks": ["check1", "check2"],
  "credibility_score": 80
}

verdict must be exactly one of: REAL, FAKE, MISLEADING, UNVERIFIED"""

    parts.append({"text": prompt})
    if text:
        parts.append({"text": f"CONTENT: {text}"})
    if image_base64:
        # Detect image type from base64 header bytes
        if image_base64.startswith('iVBORw'):
            mime = "image/png"
        elif image_base64.startswith('R0lGOD'):
            mime = "image/gif"
        elif image_base64.startswith('UklGR'):
            mime = "image/webp"
        elif image_base64.startswith('/9j/'):
            mime = "image/jpeg"
        else:
            mime = "image/jpeg"  # safe default
        parts.append({"inline_data": {"mime_type": mime, "data": image_base64}})
        parts.append({"text": "Carefully analyze the image above. Describe what you see, read all text in it, and determine if it contains misinformation, manipulation, or misleading content."})
    elif image_url:
        parts.append({"text": f"IMAGE URL: {image_url}"})
    if url:
        parts.append({"text": f"SOURCE URL: {url}"})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1024}
    }

    print(f"[MythX] Calling Gemini... key={key[:8]}...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(gemini_url, json=payload)

    print(f"[MythX] Status: {response.status_code}")
    if response.status_code != 200:
        print(f"[MythX] Error body: {response.text}")
        raise HTTPException(status_code=500, detail=f"Gemini API error {response.status_code}: {response.text}")

    data = response.json()
    try:
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        print(f"[MythX] Got response: {raw_text[:200]}")
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=500, detail=f"Unexpected Gemini response: {str(data)[:300]}")

    # Strip markdown code fences
    raw_text = re.sub(r'```json\s*', '', raw_text)
    raw_text = re.sub(r'```\s*', '', raw_text)
    raw_text = raw_text.strip()

    # Try direct parse first
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    # Try extracting JSON object
    json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            # Try fixing truncated JSON by extracting known fields manually
            pass

    # Manual field extraction fallback
    def extract_field(pattern, default):
        m = re.search(pattern, raw_text, re.IGNORECASE | re.DOTALL)
        return m.group(1).strip() if m else default

    verdict_match = re.search(r'"verdict"\s*:\s*"(REAL|FAKE|MISLEADING|UNVERIFIED)"', raw_text, re.IGNORECASE)
    conf_match = re.search(r'"confidence"\s*:\s*(\d+)', raw_text)
    cred_match = re.search(r'"credibility_score"\s*:\s*(\d+)', raw_text)
    exp_match = re.search(r'"explanation"\s*:\s*"([^"]*)"', raw_text)
    flags_match = re.findall(r'"red_flags"\s*:\s*\[([^\]]*)\]', raw_text, re.DOTALL)
    checks_match = re.findall(r'"fact_checks"\s*:\s*\[([^\]]*)\]', raw_text, re.DOTALL)

    def parse_list(raw):
        if not raw:
            return []
        items = re.findall(r'"([^"]+)"', raw[0] if raw else "")
        return items

    if verdict_match:
        return {
            "verdict": verdict_match.group(1),
            "confidence": int(conf_match.group(1)) if conf_match else 50,
            "explanation": exp_match.group(1) if exp_match else "Analysis completed.",
            "red_flags": parse_list(flags_match),
            "fact_checks": parse_list(checks_match),
            "credibility_score": int(cred_match.group(1)) if cred_match else 50,
        }

    # Last resort: return unverified
    print(f"[MythX] Could not parse response: {raw_text[:500]}")
    return {
        "verdict": "UNVERIFIED",
        "confidence": 0,
        "explanation": "Analysis completed but result could not be parsed. Please try again.",
        "red_flags": [],
        "fact_checks": [],
        "credibility_score": 50,
    }


@app.get("/")
async def root():
    return {"message": "MythX API running", "key_set": bool(GEMINI_API_KEY)}

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalysisRequest):
    if not request.text and not request.image_url and not request.image_base64:
        raise HTTPException(status_code=400, detail="Provide text, image_url, or image_base64")

    result = await analyze_with_gemini(
        text=request.text,
        image_base64=request.image_base64,
        image_url=request.image_url,
        url=request.url,
        api_key=request.api_key
    )

    colors = {"REAL": "#00C896", "FAKE": "#FF3B5C", "MISLEADING": "#FF8C00", "UNVERIFIED": "#A78BFA"}

    return AnalysisResponse(
        verdict=result.get("verdict") or "UNVERIFIED",
        confidence=int(result.get("confidence") or 50),
        explanation=result.get("explanation") or "",
        red_flags=result.get("red_flags") or [],
        fact_checks=result.get("fact_checks") or [],
        credibility_score=int(result.get("credibility_score") or 50),
        verdict_color=colors.get(result.get("verdict") or "UNVERIFIED", "#A78BFA")
    )

@app.get("/health")
async def health():
    return {"status": "healthy", "key_configured": bool(GEMINI_API_KEY)}