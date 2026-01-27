import os
import re
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
VERTEX_ACCESS_TOKEN = os.getenv("VERTEX_ACCESS_TOKEN", "")
VERTEX_PROJECT_ID = os.getenv("VERTEX_PROJECT_ID", "petya-485408")
VERTEX_REGION = os.getenv("VERTEX_REGION", "us-central1")

app = FastAPI(title="AI Tools API")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "openrouter/auto"
    temperature: Optional[float] = 0.7

class ImageRequest(BaseModel):
    prompt: str
    aspect_ratio: Optional[str] = "1:1"

@app.get("/")
async def root():
    return {"status": "ok", "message": "AI Tools API работает"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY не настроен")
    messages = [{"role": "system", "content": "Ты полезный AI-ассистент."}]
    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post("https://openrouter.ai/api/v1/chat/completions", headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENROUTER_API_KEY}", "HTTP-Referer": "https://ai-tools-backend-d3zr.onrender.com", "X-Title": "AI Tools"}, json={"model": request.model, "messages": messages, "temperature": request.temperature, "max_tokens": 2048})
        if response.status_code != 200:
            error = response.json()
            detail = error.get("error", {}).get("message", str(error))
            raise HTTPException(status_code=response.status_code, detail=f"OpenRouter: {detail}")
        data = response.json()
        return {"success": True, "content": data["choices"][0]["message"]["content"]}

@app.post("/api/generate-image")
async def generate_image(request: ImageRequest):
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY не настроен")

    # Используем Gemini 3 Pro Image Preview через OpenRouter
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "HTTP-Referer": "https://ai-tools-backend-d3zr.onrender.com",
                "X-Title": "AI Tools Image Generator"
            },
            json={
                "model": "nanobanana/gemini-3-pro-image-preview",
                "messages": [
                    {"role": "user", "content": f"Generate an image: {request.prompt}. Aspect ratio: {request.aspect_ratio}"}
                ]
            }
        )

        if response.status_code != 200:
            error = response.json()
            detail = error.get("error", {}).get("message", str(error))
            raise HTTPException(status_code=response.status_code, detail=f"OpenRouter: {detail}")

        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        # Проверяем есть ли изображение в ответе
        if "data:image" in content or "base64" in content.lower():
            # Извлекаем base64 из ответа
            match = re.search(r'data:image/[^;]+;base64,([A-Za-z0-9+/=]+)', content)
            if match:
                return {"success": True, "image": match.group(0)}

        # Если модель вернула текст вместо изображения
        return {"success": False, "error": "Модель не сгенерировала изображение", "text_response": content}
