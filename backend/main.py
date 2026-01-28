import os
import re
import httpx
import json
import time
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import pytz

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
VERTEX_ACCESS_TOKEN = os.getenv("VERTEX_ACCESS_TOKEN", "")
VERTEX_PROJECT_ID = os.getenv("VERTEX_PROJECT_ID", "petya-485408")
VERTEX_REGION = os.getenv("VERTEX_REGION", "us-central1")
TELEGRAM_BOT_TOKEN = "8528588924:AAEYggmQxAo-sVZajljhtlsR4T-92fMeE3M"

# Pending channels storage (in-memory, will reset on restart)
pending_channels: Dict[str, Dict[str, Any]] = {}

# Scheduled posts storage (in-memory)
scheduled_posts: Dict[str, Dict[str, Any]] = {}

async def check_scheduled_posts():
    """Background task to check and send scheduled posts"""
    while True:
        try:
            now = datetime.now(pytz.UTC)
            posts_to_send = []

            for post_id, post in list(scheduled_posts.items()):
                if post.get('status') != 'scheduled':
                    continue

                # Parse scheduled time
                try:
                    tz = pytz.timezone(post.get('timezone', 'Europe/Moscow'))
                    scheduled_dt = tz.localize(datetime.strptime(f"{post['date']} {post['time']}", "%Y-%m-%d %H:%M"))
                    scheduled_utc = scheduled_dt.astimezone(pytz.UTC)

                    if scheduled_utc <= now:
                        posts_to_send.append(post_id)
                except Exception as e:
                    print(f"Error parsing post {post_id}: {e}")

            # Send posts
            for post_id in posts_to_send:
                post = scheduled_posts.get(post_id)
                if post:
                    print(f"[Scheduler] Sending post {post_id}")
                    await send_telegram_post(post)

        except Exception as e:
            print(f"[Scheduler] Error: {e}")

        await asyncio.sleep(30)  # Check every 30 seconds


async def send_telegram_post(post: dict):
    """Send a scheduled post to Telegram"""
    try:
        chat_id = post.get('chatId')
        text = post.get('text', '')
        image = post.get('image')
        buttons = post.get('buttons', [])

        # Build inline keyboard if buttons exist
        reply_markup = None
        if buttons:
            reply_markup = {
                "inline_keyboard": [[{"text": btn["text"], "url": btn["url"]}] for btn in buttons]
            }

        async with httpx.AsyncClient(timeout=60.0) as client:
            if image:
                # Send photo with caption
                if image.startswith('data:'):
                    # Base64 image - need to convert to file
                    import base64
                    # Extract base64 data
                    header, b64data = image.split(',', 1)
                    image_data = base64.b64decode(b64data)

                    files = {'photo': ('image.jpg', image_data, 'image/jpeg')}
                    data = {'chat_id': chat_id, 'caption': text}
                    if reply_markup:
                        data['reply_markup'] = json.dumps(reply_markup)

                    response = await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto",
                        data=data,
                        files=files
                    )
                else:
                    # URL image
                    payload = {'chat_id': chat_id, 'photo': image, 'caption': text}
                    if reply_markup:
                        payload['reply_markup'] = reply_markup
                    response = await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto",
                        json=payload
                    )
            else:
                # Send text message
                payload = {'chat_id': chat_id, 'text': text}
                if reply_markup:
                    payload['reply_markup'] = reply_markup
                response = await client.post(
                    f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                    json=payload
                )

            result = response.json()
            if result.get('ok'):
                post['status'] = 'sent'
                post['sentAt'] = datetime.now(pytz.UTC).isoformat()
                print(f"[Scheduler] Post {post['id']} sent successfully")
            else:
                post['status'] = 'failed'
                post['error'] = result.get('description', 'Unknown error')
                print(f"[Scheduler] Post {post['id']} failed: {post['error']}")

    except Exception as e:
        post['status'] = 'failed'
        post['error'] = str(e)
        print(f"[Scheduler] Error sending post: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[Scheduler] Starting background scheduler...")
    scheduler_task = asyncio.create_task(check_scheduled_posts())
    yield
    # Shutdown
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="AI Tools API", lifespan=lifespan)

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

class PostButton(BaseModel):
    text: str
    url: str

class ScheduledPostRequest(BaseModel):
    id: str
    projectId: str
    chatId: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    timezone: str = "Europe/Moscow"
    text: Optional[str] = ""
    image: Optional[str] = None  # base64 or URL
    buttons: Optional[List[PostButton]] = []
    status: str = "scheduled"

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

    # Используем Gemini 2.0 Flash Image Generation через OpenRouter
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
                "model": "google/gemini-2.5-flash-image-preview",
                "messages": [
                    {"role": "user", "content": f"Generate an image: {request.prompt}"}
                ]
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
                "model": "google/gemini-2.5-flash-image-preview",
                "messages": [
                    {"role": "user", "content": content_parts}
                ]
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

# ===== Scheduled Posts API =====

@app.post("/api/posts")
async def create_or_update_post(post: ScheduledPostRequest):
    """Create or update a scheduled post"""
    post_dict = post.dict()
    post_dict['createdAt'] = post_dict.get('createdAt') or datetime.now(pytz.UTC).isoformat()
    scheduled_posts[post.id] = post_dict
    print(f"[Posts] Saved post {post.id} for {post.date} {post.time} ({post.timezone})")
    return {"success": True, "post": post_dict}

@app.get("/api/posts")
async def get_posts():
    """Get all scheduled posts"""
    return {"posts": list(scheduled_posts.values())}

@app.get("/api/posts/{post_id}")
async def get_post(post_id: str):
    """Get a specific post"""
    post = scheduled_posts.get(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"post": post}

@app.delete("/api/posts/{post_id}")
async def delete_post(post_id: str):
    """Delete a scheduled post"""
    if post_id in scheduled_posts:
        del scheduled_posts[post_id]
        print(f"[Posts] Deleted post {post_id}")
    return {"success": True}

@app.post("/api/posts/{post_id}/send")
async def send_post_now(post_id: str):
    """Send a post immediately"""
    post = scheduled_posts.get(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    await send_telegram_post(post)

    if post.get('status') == 'sent':
        return {"success": True, "message": "Пост отправлен"}
    else:
        raise HTTPException(status_code=400, detail=post.get('error', 'Ошибка отправки'))

# ===== Telegram Bot Webhook =====

@app.post("/api/telegram/webhook")
async def telegram_webhook(request: Request):
    """Handle Telegram webhook updates"""
    try:
        update = await request.json()

        # Handle my_chat_member update (bot added/removed from chat)
        if "my_chat_member" in update:
            chat_member = update["my_chat_member"]
            chat = chat_member.get("chat", {})
            new_status = chat_member.get("new_chat_member", {}).get("status")

            # Bot was added as admin
            if new_status == "administrator":
                chat_id = str(chat.get("id"))
                chat_title = chat.get("title", "Без названия")
                chat_username = chat.get("username")
                chat_type = chat.get("type")

                # Store pending channel
                pending_channels[chat_id] = {
                    "id": chat_id,
                    "title": chat_title,
                    "username": chat_username,
                    "type": chat_type,
                    "added_at": time.time()
                }

                # Send confirmation message to the channel
                message = f"✅ Бот успешно добавлен!\n\n📋 ID канала: `{chat_id}`\n\nТеперь вы можете планировать посты через сервис."

                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": message,
                            "parse_mode": "Markdown"
                        }
                    )

            # Bot was removed
            elif new_status in ["left", "kicked"]:
                chat_id = str(chat.get("id"))
                if chat_id in pending_channels:
                    del pending_channels[chat_id]

        return {"ok": True}

    except Exception as e:
        print(f"Webhook error: {e}")
        return {"ok": True}  # Always return ok to Telegram

@app.get("/api/telegram/pending-channels")
async def get_pending_channels():
    """Get list of pending channels (channels where bot was recently added)"""
    # Clean up old entries (older than 10 minutes)
    current_time = time.time()
    expired = [k for k, v in pending_channels.items() if current_time - v.get("added_at", 0) > 600]
    for k in expired:
        del pending_channels[k]

    return {"channels": list(pending_channels.values())}

@app.delete("/api/telegram/pending-channels/{chat_id}")
async def remove_pending_channel(chat_id: str):
    """Remove a channel from pending list (after user adds it)"""
    if chat_id in pending_channels:
        del pending_channels[chat_id]
    return {"ok": True}

@app.post("/api/telegram/setup-webhook")
async def setup_telegram_webhook():
    """Setup Telegram webhook (call this once to register)"""
    webhook_url = "https://ai-tools-backend-d3zr.onrender.com/api/telegram/webhook"

    async with httpx.AsyncClient() as client:
        # First, delete any existing webhook
        await client.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook")

        # Set new webhook
        response = await client.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook",
            json={
                "url": webhook_url,
                "allowed_updates": ["my_chat_member", "chat_member"]
            }
        )

        result = response.json()

        if result.get("ok"):
            return {"success": True, "message": "Webhook установлен"}
        else:
            raise HTTPException(status_code=400, detail=result.get("description", "Ошибка установки webhook"))
