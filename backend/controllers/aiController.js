// In-memory job storage
const jobs = new Map();

// Cleanup old jobs every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
        if (now - job.createdAt > 10 * 60 * 1000) jobs.delete(id);
    }
}, 10 * 60 * 1000);

const SYSTEM_PROMPT = `Ты — генератор JSON для конструктора лендингов. Отвечай ТОЛЬКО валидным JSON без markdown.

Формат ответа: {"elements": [...]}

Доступные блоки (type) и их componentSettings:

НАВИГАЦИЯ И ПОДВАЛ:
- navbar: {logoText:"Название", menuItems:[{text:"Пункт",href:"#id"}], buttonText:"CTA", buttonLink:"#form"}
- footer: {companyName:"Компания", links:[{text:"Текст",href:"#"}], copyright:"© 2025"}

ГЛАВНЫЙ ЭКРАН:
- hero: {title:"Заголовок", subtitle:"Подзаголовок", buttonText:"Кнопка", buttonLink:"#form"}
  styles: {backgroundColor:"#3b82f6"} для цветного фона

БЛОКИ КОНТЕНТА:
- features: {title:"", subtitle:"", columns:3, items:[{icon:"fas fa-star", title:"", description:""}]}
- testimonial: {quote:"Отзыв", authorName:"Имя", authorRole:"Должность", authorPhoto:"url"}
- pricing: {title:"Тарифы", items:[{name:"Базовый", price:"990", period:"₽", features:["Пункт"], buttonText:"Выбрать", popular:false}]}
- accordion: {title:"FAQ", items:[{question:"Вопрос?", answer:"Ответ"}]}
- program: {title:"Программа", items:[{day:"День 1", title:"Тема", topics:["Пункт 1","Пункт 2"]}]}
- speaker: {title:"Спикер", name:"Имя", role:"Должность", description:"Описание", achievements:["Достижение"]}

ДОПОЛНИТЕЛЬНЫЕ:
- checklist: {title:"Для кого", items:["Пункт 1","Пункт 2"]}
- benefitsList: {title:"Вы получите", items:["Выгода 1","Выгода 2"]}
- giftBlock: {title:"Бонус", description:"Описание подарка", icon:"fas fa-gift"}
- guarantee: {title:"Гарантия", description:"Текст гарантии"}
- counter: {items:[{value:"500+", label:"Клиентов"},{value:"10", label:"Лет опыта"}]}
- timer: {title:"До конца акции", endDate:"2025-12-31T23:59:59"}

ФОРМЫ:
- leadForm: {title:"Записаться", subtitle:"Оставьте заявку", buttonText:"Отправить", fields:["name","phone","email"]}

Стили (styles): {padding:"60px 20px", backgroundColor:"#f8fafc", color:"#1e293b"}

ПРАВИЛА:
1. Язык — русский
2. Контент релевантный бизнесу из запроса
3. 8-12 блоков, начинай с navbar, заканчивай footer
4. Для иконок используй Font Awesome: fas fa-star, fas fa-check, fas fa-users и т.д.
5. Только валидный JSON, без комментариев и markdown`;

// POST /api/ai/generate-landing — start job, return jobId
exports.generateLanding = (req, res) => {
    console.log('[AI] generateLanding called, body keys:', Object.keys(req.body || {}));

    try {
        const { niche, product, productDescription, audience, mainOffer, tone, colorScheme } = req.body;

        if (!niche || !product || !productDescription || !audience || !mainOffer) {
            return res.status(400).json({ success: false, error: 'Заполните все обязательные поля' });
        }

        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ success: false, error: 'OPENROUTER_API_KEY не настроен на сервере.' });
        }

        const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

        jobs.set(jobId, {
            status: 'processing',
            elements: null,
            error: null,
            createdAt: Date.now()
        });

        // Run AI generation in background (completely async, detached from response)
        setImmediate(() => {
            runGeneration(jobId, { niche, product, productDescription, audience, mainOffer, tone, colorScheme }, OPENROUTER_API_KEY)
                .catch(err => console.error('[AI] Background error:', err));
        });

        // Return immediately with explicit headers
        console.log('[AI] Sending jobId response:', jobId);
        res.setHeader('Content-Type', 'application/json');
        res.status(200);
        return res.send(JSON.stringify({ success: true, jobId }));

    } catch (error) {
        console.error('[AI] Start error:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
};

// GET /api/ai/result/:jobId — poll for result
exports.getResult = (req, res) => {
    const job = jobs.get(req.params.jobId);

    if (!job) {
        return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    if (job.status === 'processing') {
        return res.json({ success: true, status: 'processing' });
    }

    if (job.status === 'error') {
        jobs.delete(req.params.jobId);
        return res.json({ success: false, status: 'error', error: job.error });
    }

    // Done
    const elements = job.elements;
    jobs.delete(req.params.jobId);
    res.json({ success: true, status: 'done', elements });
};

// Background AI generation
async function runGeneration(jobId, params, apiKey) {
    const { niche, product, productDescription, audience, mainOffer, tone, colorScheme } = params;

    const userPrompt = `Landing page: ниша "${niche}", продукт "${product}". Описание: ${productDescription}. Аудитория: ${audience}. УТП: ${mainOffer}. Тон: ${tone || 'Профессиональный'}. Цвета: ${colorScheme || 'blue'}.`;

    console.log('[AI] Job', jobId, 'started for:', niche);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'Landing Page Builder'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_tokens: 3000
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        const responseText = await response.text();
        console.log('[AI] Job', jobId, 'API status:', response.status, 'len:', responseText.length);

        if (!response.ok) {
            throw new Error(`API error ${response.status}`);
        }

        const data = JSON.parse(responseText);

        if (!data.choices?.[0]?.message?.content) {
            throw new Error('No content in AI response');
        }

        const parsed = JSON.parse(data.choices[0].message.content);
        const elements = parsed.elements || parsed;

        if (!Array.isArray(elements)) {
            throw new Error('Elements is not an array');
        }

        console.log('[AI] Job', jobId, 'done:', elements.length, 'elements');

        const job = jobs.get(jobId);
        if (job) {
            job.status = 'done';
            job.elements = elements;
        }

    } catch (err) {
        console.error('[AI] Job', jobId, 'failed:', err.message);
        const job = jobs.get(jobId);
        if (job) {
            job.status = 'error';
            job.error = err.name === 'AbortError'
                ? 'AI не ответил за 60 секунд. Попробуйте ещё раз.'
                : 'Ошибка генерации: ' + err.message;
        }
    }
}
