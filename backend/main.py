import os
import re
import httpx
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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

class SlideRequest(BaseModel):
    slide_text: str
    color1: str = "#8b5cf6"
    color2: str = "#10b981"
    user_image: Optional[str] = None
    reference_images: Optional[List[str]] = None  # base64 images

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

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat endpoint using Server-Sent Events"""
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY не настроен")

    messages = [{"role": "system", "content": "Ты полезный AI-ассистент."}]
    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})

    async def generate():
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "HTTP-Referer": "https://ai-tools-backend-d3zr.onrender.com",
                    "X-Title": "AI Tools"
                },
                json={
                    "model": request.model,
                    "messages": messages,
                    "temperature": request.temperature,
                    "max_tokens": 4096,
                    "stream": True
                }
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield f"data: {json.dumps({'error': error_text.decode()})}\n\n"
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        yield f"{line}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

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
                "model": "google/gemini-3-pro-image-preview",
                "messages": [
                    {"role": "user", "content": f"Generate an image: {request.prompt}"}
                ],
                "modalities": ["image", "text"]
            }
        )

        if response.status_code != 200:
            error = response.json()
            detail = error.get("error", {}).get("message", str(error))
            raise HTTPException(status_code=response.status_code, detail=f"OpenRouter: {detail}")

        data = response.json()
        message = data.get("choices", [{}])[0].get("message", {})

        # Проверяем наличие изображений в ответе
        images = message.get("images", [])
        if images:
            image_url = images[0].get("image_url", {}).get("url", "")
            if image_url:
                return {"success": True, "image": image_url}

        # Проверяем content на наличие base64 изображения
        content = message.get("content", "")
        if content and "data:image" in content:
            match = re.search(r'data:image/[^;]+;base64,[A-Za-z0-9+/=]+', content)
            if match:
                return {"success": True, "image": match.group(0)}

        # Если модель вернула текст вместо изображения
        raise HTTPException(status_code=400, detail="Не удалось сгенерировать изображение")

@app.post("/api/generate-slide")
async def generate_slide(request: SlideRequest):
    """Generate a presentation slide image"""
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY не настроен")

    # Формируем промпт для генерации слайда
    has_references = request.reference_images and any(request.reference_images)

    prompt = f"""Сделай слайд для презентации размером 1920х1080 px.

С текстом (ВАЖНО!!! добавляй только этот текст, не добавляй дополнительно):

{request.slide_text}

Картинка должна соответствовать тексту.

{"ВАЖНО! Используй стиль и дизайн с приложенных референсных изображений. Не копируй содержимое, только стиль!" if has_references else "ВАЖНО! Используй современный минималистичный дизайн."}
Цветовая схема: основные акценты {request.color1} и {request.color2}
Фон должен быть темным или градиентным.
Текст должен быть читаемым и контрастным.

ВАЖНО! Не добавляй никаких логотипов или водяных знаков."""

    # Формируем сообщения с изображениями
    content_parts = []

    # Добавляем референсные изображения если есть (base64)
    if request.reference_images:
        for i, img_base64 in enumerate(request.reference_images[:4]):
            if img_base64:
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": img_base64}
                })

    # Добавляем изображение пользователя (лого/фото) если есть
    if request.user_image:
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": request.user_image}
        })
        prompt += "\n\nВставь загруженное фото/лого пользователя в дизайн слайда."

    # Добавляем текстовый промпт
    content_parts.append({
        "type": "text",
        "text": prompt
    })

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "HTTP-Referer": "https://ai-tools-backend-d3zr.onrender.com",
                "X-Title": "AI Tools Slide Generator"
            },
            json={
                "model": "google/gemini-2.0-flash-exp:free",
                "messages": [
                    {"role": "user", "content": content_parts}
                ],
                "modalities": ["image", "text"]
            }
        )

        if response.status_code != 200:
            error_data = response.json()
            detail = error_data.get("error", {}).get("message", str(error_data))
            raise HTTPException(status_code=response.status_code, detail=f"OpenRouter: {detail}")

        data = response.json()
        message = data.get("choices", [{}])[0].get("message", {})

        # Проверяем разные форматы ответа с изображением

        # Формат 1: images array
        images = message.get("images", [])
        if images:
            image_url = images[0].get("image_url", {}).get("url", "")
            if image_url:
                return {"success": True, "image": image_url}

        # Формат 2: content как массив с image_url
        content = message.get("content", "")
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict):
                    if part.get("type") == "image_url":
                        url = part.get("image_url", {}).get("url", "")
                        if url:
                            return {"success": True, "image": url}

        # Формат 3: base64 в строке content
        if isinstance(content, str) and "data:image" in content:
            match = re.search(r'data:image/[^;]+;base64,[A-Za-z0-9+/=]+', content)
            if match:
                return {"success": True, "image": match.group(0)}

        # Формат 4: inline_data в content
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and "inline_data" in part:
                    inline = part["inline_data"]
                    mime = inline.get("mime_type", "image/png")
                    b64 = inline.get("data", "")
                    if b64:
                        return {"success": True, "image": f"data:{mime};base64,{b64}"}

        raise HTTPException(status_code=400, detail="Не удалось сгенерировать изображение слайда")
