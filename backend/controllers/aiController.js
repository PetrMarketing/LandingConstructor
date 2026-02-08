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

// POST /api/ai/edit-block — AI-assisted block editing
exports.editBlock = async (req, res) => {
    try {
        const { message, element, projectId } = req.body;

        if (!message || !element) {
            return res.status(400).json({ success: false, error: 'Сообщение и элемент обязательны' });
        }

        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

        // If no API key or placeholder, use local processing
        if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes('placeholder') || OPENROUTER_API_KEY.length < 20) {
            return res.json({
                success: true,
                useLocal: true,
                response: null,
                changes: null
            });
        }

        const editPrompt = `Ты — ассистент редактирования блоков в конструкторе лендингов.

Текущий блок:
- Тип: ${element.type}
- Название: ${element.label}
- Контент: ${JSON.stringify(element.content || {})}
- Стили: ${JSON.stringify(element.styles || {})}

Пользователь просит: "${message}"

Отвечай ТОЛЬКО валидным JSON:
{
  "response": "Краткое описание что сделано",
  "changes": {
    "content": { ... новые значения контента ... },
    "styles": { ... новые стили ... }
  }
}

Если изменений нет, changes = null.
Если нужно только изменить контент, styles не включай и наоборот.`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'Landing Page Builder'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    { role: 'user', content: editPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.5,
                max_tokens: 1000
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`API error ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('No AI response');
        }

        const parsed = JSON.parse(content);

        res.json({
            success: true,
            response: parsed.response || 'Изменения применены.',
            changes: parsed.changes || null
        });

    } catch (error) {
        console.error('[AI Edit Block] Error:', error.message);
        // On error, tell frontend to use local processing
        res.json({
            success: true,
            useLocal: true,
            response: null,
            changes: null
        });
    }
};

// ============================================================
// NICHE DEFAULTS — fallback when AI is not available
// ============================================================
const NICHE_DEFAULTS = {
    beauty: {
        modules: ['sales', 'clients', 'team', 'bookings', 'catalog'],
        pages: [
            { name: 'Главная', template: 'services-beauty', description: 'Лендинг салона красоты' },
            { name: 'Услуги', template: 'blank', description: 'Каталог услуг' },
            { name: 'Запись', template: 'blank', description: 'Онлайн-запись' }
        ],
        funnelStages: ['Новая заявка', 'Консультация', 'Записан', 'Выполнено', 'Повторный визит']
    },
    education: {
        modules: ['sales', 'clients', 'team', 'learning', 'catalog'],
        pages: [
            { name: 'Главная', template: 'education-course', description: 'Лендинг курса' },
            { name: 'Курсы', template: 'blank', description: 'Каталог курсов' },
            { name: 'Регистрация', template: 'blank', description: 'Запись на обучение' }
        ],
        funnelStages: ['Лид', 'Пробный урок', 'Оплата', 'Обучение', 'Выпуск']
    },
    ecommerce: {
        modules: ['sales', 'clients', 'orders', 'catalog', 'integrations'],
        pages: [
            { name: 'Главная', template: 'shop-fashion', description: 'Главная магазина' },
            { name: 'Каталог', template: 'blank', description: 'Каталог товаров' },
            { name: 'Акции', template: 'blank', description: 'Промо-страница' }
        ],
        funnelStages: ['Новый заказ', 'Подтверждён', 'Оплачен', 'Отправлен', 'Доставлен']
    },
    fitness: {
        modules: ['sales', 'clients', 'team', 'bookings', 'catalog'],
        pages: [
            { name: 'Главная', template: 'fitness-gym', description: 'Лендинг фитнес-клуба' },
            { name: 'Расписание', template: 'blank', description: 'Расписание занятий' },
            { name: 'Абонементы', template: 'blank', description: 'Тарифы и абонементы' }
        ],
        funnelStages: ['Заявка', 'Пробное занятие', 'Выбор абонемента', 'Оплата', 'Клиент']
    },
    services: {
        modules: ['sales', 'clients', 'team', 'bookings', 'orders'],
        pages: [
            { name: 'Главная', template: 'services-cleaning', description: 'Лендинг услуг' },
            { name: 'Услуги', template: 'blank', description: 'Каталог услуг' },
            { name: 'Контакты', template: 'blank', description: 'Контактная информация' }
        ],
        funnelStages: ['Обращение', 'Оценка', 'Коммерческое предложение', 'Согласование', 'Выполнение']
    },
    realestate: {
        modules: ['sales', 'clients', 'team', 'catalog', 'integrations'],
        pages: [
            { name: 'Главная', template: 'realestate-agency', description: 'Лендинг агентства' },
            { name: 'Объекты', template: 'blank', description: 'Каталог объектов' },
            { name: 'Ипотека', template: 'blank', description: 'Калькулятор ипотеки' }
        ],
        funnelStages: ['Заявка', 'Показ', 'Переговоры', 'Бронирование', 'Сделка']
    },
    restaurant: {
        modules: ['sales', 'clients', 'orders', 'bookings', 'team'],
        pages: [
            { name: 'Главная', template: 'restaurant-main', description: 'Лендинг ресторана' },
            { name: 'Меню', template: 'blank', description: 'Меню ресторана' },
            { name: 'Бронирование', template: 'blank', description: 'Бронирование столиков' }
        ],
        funnelStages: ['Бронь', 'Подтверждено', 'Гость пришёл', 'Обслужен', 'Отзыв']
    },
    medical: {
        modules: ['sales', 'clients', 'team', 'bookings', 'catalog'],
        pages: [
            { name: 'Главная', template: 'blank', description: 'Лендинг клиники' },
            { name: 'Услуги', template: 'blank', description: 'Медицинские услуги' },
            { name: 'Врачи', template: 'blank', description: 'Наши специалисты' }
        ],
        funnelStages: ['Обращение', 'Запись', 'Приём', 'Лечение', 'Контроль']
    },
    default: {
        modules: ['sales', 'clients', 'team', 'orders', 'catalog'],
        pages: [
            { name: 'Главная', template: 'landing-basic', description: 'Главная страница' },
            { name: 'О нас', template: 'blank', description: 'О компании' },
            { name: 'Контакты', template: 'blank', description: 'Контакты' }
        ],
        funnelStages: ['Новый лид', 'Квалификация', 'Предложение', 'Переговоры', 'Закрыто']
    }
};

// POST /api/ai/analyze-business — AI analysis for project creation
exports.analyzeBusiness = async (req, res) => {
    try {
        const { name, niche, description, audience, products } = req.body;

        if (!name || !niche || !description) {
            return res.status(400).json({
                success: false,
                error: 'Укажите название, нишу и описание бизнеса'
            });
        }

        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

        // If no API key, return defaults for the niche
        if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes('placeholder') || OPENROUTER_API_KEY.length < 20) {
            const defaults = NICHE_DEFAULTS[niche] || NICHE_DEFAULTS.default;
            return res.json({
                success: true,
                data: {
                    modules: defaults.modules,
                    pages: defaults.pages,
                    funnelStages: defaults.funnelStages,
                    aiGenerated: false
                }
            });
        }

        const analyzePrompt = `Ты — бизнес-аналитик для платформы PK Business. Проанализируй бизнес и верни рекомендации в JSON.

Бизнес: "${name}"
Ниша: "${niche}"
Описание: ${description}
Аудитория: ${audience || 'не указана'}
Продукты/услуги: ${products || 'не указаны'}

Верни ТОЛЬКО валидный JSON:
{
  "modules": ["sales", "clients", ...],
  "pages": [{"name": "Главная", "template": "landing-basic", "description": "Описание"}],
  "funnelStages": ["Этап 1", "Этап 2", ...]
}

Доступные модули: sales, clients, team, orders, catalog, bookings, learning, integrations
Доступные шаблоны: blank, landing-basic, cosmetology, personal-coach, shop-fashion, realestate-agency, realestate-developer, restaurant-main, restaurant-cafe, restaurant-delivery, fitness-gym, fitness-trainer, fitness-yoga, education-course, education-school, education-tutor, services-beauty, services-cleaning, services-auto, events-conference, events-wedding, events-party, portfolio, business-card, spa-center, nail-salon, barbershop, language-school, kids-education, masterclass, dental-clinic, law-firm, accounting-firm, cleaning-company, electronics-store, grocery-delivery, flower-shop, property-listing, rental-agency, delivery-service, catering

ПРАВИЛА:
1. modules — 4-6 наиболее релевантных модулей для этого бизнеса
2. pages — 3-5 страниц сайта с подходящими шаблонами
3. funnelStages — 4-6 этапов воронки продаж для этой ниши
4. Язык — русский`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'PK Business'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    { role: 'user', content: analyzePrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.5,
                max_tokens: 1500
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`API error ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('No AI response');
        }

        const parsed = JSON.parse(content);

        // Validate and sanitize
        const validModules = ['sales', 'clients', 'team', 'orders', 'catalog', 'bookings', 'learning', 'integrations'];
        const modules = (parsed.modules || []).filter(m => validModules.includes(m));
        const pages = (parsed.pages || []).slice(0, 8).map(p => ({
            name: p.name || 'Страница',
            template: p.template || 'blank',
            description: p.description || ''
        }));
        const funnelStages = (parsed.funnelStages || []).slice(0, 8);

        res.json({
            success: true,
            data: {
                modules: modules.length ? modules : (NICHE_DEFAULTS[niche] || NICHE_DEFAULTS.default).modules,
                pages: pages.length ? pages : (NICHE_DEFAULTS[niche] || NICHE_DEFAULTS.default).pages,
                funnelStages: funnelStages.length ? funnelStages : (NICHE_DEFAULTS[niche] || NICHE_DEFAULTS.default).funnelStages,
                aiGenerated: true
            }
        });

    } catch (error) {
        console.error('[AI Analyze Business] Error:', error.message);
        // On error, return defaults
        const defaults = NICHE_DEFAULTS[req.body?.niche] || NICHE_DEFAULTS.default;
        res.json({
            success: true,
            data: {
                modules: defaults.modules,
                pages: defaults.pages,
                funnelStages: defaults.funnelStages,
                aiGenerated: false
            }
        });
    }
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
