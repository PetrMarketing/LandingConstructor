// ===== AI Landing Page Constructor with Claude API =====

// Configuration
const CONFIG = {
    CLAUDE_API_KEY: '', // Вставьте ваш API ключ
    CLAUDE_API_URL: 'https://api.anthropic.com/v1/messages',
    MODEL: 'claude-3-5-sonnet-20241022',
    // Image Generation (TODO: подключить реальный API)
    IMAGE_API_KEY: '',
    IMAGE_API_URL: '',
    IMAGE_SERVICE: 'mock' // 'openai', 'stability', 'replicate', 'mock'
};

// State
const state = {
    niche: '',
    offer: '',
    landingGoal: '',
    photos: [],
    template: 'strict',
    colors: {
        primary: '#2563eb',
        secondary: '#1e40af',
        accent: '#f59e0b'
    },
    fontHeading: "'Inter', sans-serif",
    sections: [],
    customBlocks: [],
    generatedContent: null
};

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const generateBtn = document.getElementById('generateBtn');
const previewContainer = document.getElementById('previewContainer');
const addBlockModal = document.getElementById('addBlockModal');
const exportModal = document.getElementById('exportModal');
const editElementModal = document.getElementById('editElementModal');

// ===== Claude API Integration =====
const ClaudeAPI = {
    async generateLandingContent(niche, offer, landingGoal) {
        const goalDescription = landingGoal || 'Запись на консультацию';

        const prompt = `Создай структуру лендинга для ниши "${niche}" с оффером "${offer}".

ЦЕЛЬ ЛЕНДИНГА: ${goalDescription}

Адаптируй ВСЕ тексты под указанную цель. Например:
- Если цель "Продажа курса" — кнопки должны быть "Купить курс", "Записаться на курс", форма для покупки и т.д.
- Если цель "Сбор заявок на вебинар" — "Записаться на вебинар", "Забронировать место" и т.д.
- Если цель "Продажа товара" — "Купить", "Заказать", "Добавить в корзину" и т.д.

Верни структуру СТРОГО в таком формате (КЛЮЧ: значение):
---
HERO_TITLE: [Главный заголовок, привлекающий внимание к ${goalDescription}]
HERO_SUBTITLE: [Подзаголовок с ключевой выгодой]
HERO_DESCRIPTION: [Краткое описание предложения]
HERO_CTA: [Кнопка призыва к действию, соответствующая цели: ${goalDescription}]

TARGET_TITLE: Это для вас, если вы
TARGET_1: [Описание целевой аудитории 1]
TARGET_2: [Описание целевой аудитории 2]
TARGET_3: [Описание целевой аудитории 3]
TARGET_4: [Описание целевой аудитории 4]
TARGET_5: [Описание целевой аудитории 5]

BENEFITS_TITLE: [Заголовок секции преимуществ, адаптированный под цель]
BENEFIT_1: [Преимущество 1]
BENEFIT_2: [Преимущество 2]
BENEFIT_3: [Преимущество 3]
BENEFIT_4: [Преимущество 4]
BENEFIT_5: [Преимущество 5]

FORM_TITLE: [Заголовок формы, соответствующий цели: ${goalDescription}]
FORM_ACTIVITY_OPTIONS: [Вариант 1], [Вариант 2], [Вариант 3], Другое
FORM_INTEREST_OPTIONS: [Направление 1], [Направление 2], [Направление 3], Помощь в выборе
FORM_CTA: [Кнопка отправки формы, соответствующая цели]

GIFT_TITLE: [Заголовок бонуса/подарка]
GIFT_DESCRIPTION: [Описание что получит пользователь]
GIFT_ITEM_1: [Пункт подарка 1]
GIFT_ITEM_2: [Пункт подарка 2]
GIFT_ITEM_3: [Пункт подарка 3]

FINAL_CTA_TITLE: [Финальный призыв к действию]
FINAL_CTA_TEXT: [Мотивирующий текст]
FINAL_CTA_BUTTON: [Кнопка, соответствующая цели: ${goalDescription}]
FINAL_GUARANTEE: [Гарантия или обещание]
---

ВАЖНО: Верни ТОЛЬКО структуру в указанном формате. Все тексты должны быть адаптированы под цель "${goalDescription}" для ниши "${niche}". Не добавляй пояснений.`;

        try {
            const response = await fetch(CONFIG.CLAUDE_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': CONFIG.CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: CONFIG.MODEL,
                    max_tokens: 2000,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Claude API Error:', errorData);
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.content[0].text;

            return this.parseResponse(content);
        } catch (error) {
            console.error('Error calling Claude API:', error);
            // Fallback to local generation
            return this.generateFallback(niche, offer, landingGoal);
        }
    },

    parseResponse(text) {
        const result = {};
        const lines = text.split('\n');

        for (const line of lines) {
            const match = line.match(/^([A-Z_]+):\s*(.+)$/);
            if (match) {
                result[match[1]] = match[2].trim();
            }
        }

        return {
            hero: {
                title: result.HERO_TITLE || 'Заголовок',
                subtitle: result.HERO_SUBTITLE || 'Подзаголовок',
                description: result.HERO_DESCRIPTION || 'Описание',
                cta: result.HERO_CTA || 'Записаться'
            },
            target: {
                title: result.TARGET_TITLE || 'Это для вас, если вы',
                items: [
                    result.TARGET_1,
                    result.TARGET_2,
                    result.TARGET_3,
                    result.TARGET_4,
                    result.TARGET_5
                ].filter(Boolean)
            },
            benefits: {
                title: result.BENEFITS_TITLE || 'Что вы получите',
                items: [
                    result.BENEFIT_1,
                    result.BENEFIT_2,
                    result.BENEFIT_3,
                    result.BENEFIT_4,
                    result.BENEFIT_5
                ].filter(Boolean)
            },
            form: {
                title: result.FORM_TITLE || 'Оставьте заявку',
                activityOptions: result.FORM_ACTIVITY_OPTIONS?.split(',').map(s => s.trim()) || ['Вариант 1', 'Вариант 2', 'Другое'],
                interestOptions: result.FORM_INTEREST_OPTIONS?.split(',').map(s => s.trim()) || ['Направление 1', 'Направление 2', 'Помощь в выборе'],
                cta: result.FORM_CTA || 'Отправить заявку'
            },
            gift: {
                title: result.GIFT_TITLE || 'Ваш подарок',
                description: result.GIFT_DESCRIPTION || 'Получите полезный материал',
                items: [
                    result.GIFT_ITEM_1,
                    result.GIFT_ITEM_2,
                    result.GIFT_ITEM_3
                ].filter(Boolean)
            },
            finalCta: {
                title: result.FINAL_CTA_TITLE || 'Сделайте первый шаг',
                text: result.FINAL_CTA_TEXT || 'Мы ждем вас',
                button: result.FINAL_CTA_BUTTON || 'Получить план',
                guarantee: result.FINAL_GUARANTEE || 'Ваши данные в безопасности'
            }
        };
    },

    generateFallback(niche, offer, landingGoal) {
        const goal = landingGoal || 'Оставить заявку';
        const ctaText = this.getCtaForGoal(landingGoal);

        return {
            hero: {
                title: `${offer || `Лучшее предложение в сфере ${niche}`}`,
                subtitle: `Получите то, что давно искали — качественное решение для ваших задач.`,
                description: `Узнайте подробности и сделайте первый шаг уже сегодня.`,
                cta: ctaText.main
            },
            target: {
                title: 'Это для вас, если вы',
                items: [
                    `Интересуетесь сферой ${niche}`,
                    'Хотите получить качественный результат',
                    'Цените профессиональный подход',
                    'Готовы к позитивным изменениям',
                    'Ищете надежное решение'
                ]
            },
            benefits: {
                title: 'Что вы получите',
                items: [
                    'Профессиональный подход к вашей задаче',
                    'Индивидуальное решение под ваши потребности',
                    'Поддержку на каждом этапе',
                    'Гарантию качества',
                    'Результат, который превзойдет ожидания'
                ]
            },
            form: {
                title: ctaText.formTitle,
                activityOptions: ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Другое'],
                interestOptions: ['Основное', 'Дополнительное', 'Помощь в выборе'],
                cta: ctaText.formButton
            },
            gift: {
                title: 'Бонус для вас',
                description: 'Получите дополнительную ценность прямо сейчас',
                items: [
                    'Полезные материалы по теме',
                    'Практические рекомендации',
                    'Эксклюзивный контент'
                ]
            },
            finalCta: {
                title: 'Не откладывайте на потом',
                text: 'Сделайте шаг к вашей цели прямо сейчас',
                button: ctaText.main,
                guarantee: 'Мы гарантируем качество и безопасность ваших данных.'
            }
        };
    },

    getCtaForGoal(landingGoal) {
        const goal = (landingGoal || '').toLowerCase();

        if (goal.includes('курс') || goal.includes('обучен')) {
            return {
                main: 'ЗАПИСАТЬСЯ НА КУРС',
                formTitle: 'Запишитесь на курс',
                formButton: 'ПОЛУЧИТЬ ДОСТУП К КУРСУ'
            };
        }
        if (goal.includes('вебинар')) {
            return {
                main: 'ЗАПИСАТЬСЯ НА ВЕБИНАР',
                formTitle: 'Забронируйте место на вебинаре',
                formButton: 'ЗАБРОНИРОВАТЬ МЕСТО'
            };
        }
        if (goal.includes('товар') || goal.includes('купить') || goal.includes('продаж')) {
            return {
                main: 'КУПИТЬ СЕЙЧАС',
                formTitle: 'Оформите заказ',
                formButton: 'ОФОРМИТЬ ЗАКАЗ'
            };
        }
        if (goal.includes('консультац')) {
            return {
                main: 'ЗАПИСАТЬСЯ НА КОНСУЛЬТАЦИЮ',
                formTitle: 'Запишитесь на консультацию',
                formButton: 'ОТПРАВИТЬ ЗАЯВКУ'
            };
        }
        if (goal.includes('заявк') || goal.includes('лид')) {
            return {
                main: 'ОСТАВИТЬ ЗАЯВКУ',
                formTitle: 'Оставьте заявку',
                formButton: 'ОТПРАВИТЬ ЗАЯВКУ'
            };
        }

        return {
            main: 'УЗНАТЬ ПОДРОБНЕЕ',
            formTitle: 'Свяжитесь с нами',
            formButton: 'ОТПРАВИТЬ'
        };
    }
};

// ===== Image Generator (Mock + Ready for API) =====
const ImageGenerator = {
    // Промпты для разных секций
    getPromptForSection(sectionType, niche) {
        const prompts = {
            hero: `Professional hero image for ${niche} business, modern, high quality, business photography style`,
            target: `Target audience representation for ${niche}, diverse people, professional setting`,
            benefits: `Benefits visualization for ${niche} service, abstract modern design`,
            gift: `Digital product mockup, ebook or guide cover for ${niche}, professional design`,
            custom: `Professional image for ${niche} business, modern style`
        };
        return prompts[sectionType] || prompts.custom;
    },

    // Имитация генерации (заменить на реальный API)
    async generate(sectionType, niche) {
        const prompt = this.getPromptForSection(sectionType, niche);

        if (CONFIG.IMAGE_SERVICE === 'mock') {
            return this.mockGenerate(sectionType, niche);
        }

        // TODO: Реальные API вызовы
        switch (CONFIG.IMAGE_SERVICE) {
            case 'openai':
                return this.generateOpenAI(prompt);
            case 'stability':
                return this.generateStability(prompt);
            case 'replicate':
                return this.generateReplicate(prompt);
            default:
                return this.mockGenerate(sectionType, niche);
        }
    },

    // Имитация генерации с разными изображениями по категориям
    async mockGenerate(sectionType, niche) {
        // Имитация задержки генерации
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

        // Категории изображений для разных ниш
        const nicheCategories = {
            'медицин': 'health',
            'косметолог': 'beauty',
            'красот': 'beauty',
            'it': 'technology',
            'програм': 'technology',
            'обучен': 'education',
            'курс': 'education',
            'фитнес': 'fitness',
            'спорт': 'fitness',
            'бизнес': 'business',
            'недвижим': 'architecture'
        };

        let category = 'business';
        const nicheLower = niche.toLowerCase();
        for (const [keyword, cat] of Object.entries(nicheCategories)) {
            if (nicheLower.includes(keyword)) {
                category = cat;
                break;
            }
        }

        // Разные размеры для разных секций
        const sizes = {
            hero: { w: 1200, h: 600 },
            target: { w: 800, h: 500 },
            benefits: { w: 600, h: 400 },
            gift: { w: 500, h: 600 },
            custom: { w: 800, h: 500 }
        };

        const size = sizes[sectionType] || sizes.custom;
        const randomId = Math.floor(Math.random() * 1000);

        // Используем picsum.photos для имитации (в реальности будет AI-генерация)
        return `https://picsum.photos/seed/${category}${randomId}/${size.w}/${size.h}`;
    },

    // Заглушки для реальных API (реализовать позже)
    async generateOpenAI(prompt) {
        // TODO: Реализовать OpenAI DALL-E API
        console.log('OpenAI prompt:', prompt);
        return this.mockGenerate('custom', state.niche);
    },

    async generateStability(prompt) {
        // TODO: Реализовать Stability AI API
        console.log('Stability prompt:', prompt);
        return this.mockGenerate('custom', state.niche);
    },

    async generateReplicate(prompt) {
        // TODO: Реализовать Replicate API
        console.log('Replicate prompt:', prompt);
        return this.mockGenerate('custom', state.niche);
    }
};

// ===== Style Generator =====
const StyleGenerator = {
    detectNicheStyle(niche) {
        const nicheLower = niche.toLowerCase();

        const styles = {
            medical: {
                keywords: ['медицин', 'косметолог', 'врач', 'клиник', 'здоров', 'стоматолог', 'эстетич'],
                colors: { primary: '#0891b2', secondary: '#0e7490', accent: '#f59e0b' },
                fonts: { heading: "'Inter', sans-serif" }
            },
            beauty: {
                keywords: ['красот', 'салон', 'маникюр', 'визаж', 'стилист', 'парикмахер'],
                colors: { primary: '#be185d', secondary: '#9d174d', accent: '#f472b6' },
                fonts: { heading: "'Playfair Display', serif" }
            },
            education: {
                keywords: ['курс', 'обучен', 'школа', 'академия', 'тренинг'],
                colors: { primary: '#4f46e5', secondary: '#4338ca', accent: '#fbbf24' },
                fonts: { heading: "'Inter', sans-serif" }
            },
            business: {
                keywords: ['бизнес', 'консалтинг', 'маркетинг', 'продажи', 'менеджмент'],
                colors: { primary: '#1e40af', secondary: '#1e3a8a', accent: '#f59e0b' },
                fonts: { heading: "'Inter', sans-serif" }
            },
            fitness: {
                keywords: ['фитнес', 'спорт', 'тренер', 'йога', 'здоров'],
                colors: { primary: '#059669', secondary: '#047857', accent: '#f97316' },
                fonts: { heading: "'Inter', sans-serif" }
            },
            tech: {
                keywords: ['it', 'программ', 'разработ', 'digital', 'технолог'],
                colors: { primary: '#7c3aed', secondary: '#6d28d9', accent: '#06b6d4' },
                fonts: { heading: "'Inter', sans-serif" }
            }
        };

        for (const [key, style] of Object.entries(styles)) {
            if (style.keywords.some(kw => nicheLower.includes(kw))) {
                return style;
            }
        }

        // Default style
        return {
            colors: { primary: '#2563eb', secondary: '#1e40af', accent: '#f59e0b' },
            fonts: { heading: "'Inter', sans-serif" }
        };
    },

    applyStyles(niche) {
        const style = this.detectNicheStyle(niche);

        document.documentElement.style.setProperty('--color-primary', style.colors.primary);
        document.documentElement.style.setProperty('--color-secondary', style.colors.secondary);
        document.documentElement.style.setProperty('--color-accent', style.colors.accent);
        document.documentElement.style.setProperty('--font-heading', style.fonts.heading);

        state.colors = style.colors;
        state.fontHeading = style.fonts.heading;

        // Update UI
        document.getElementById('colorPrimary').value = style.colors.primary;
        document.getElementById('colorSecondary').value = style.colors.secondary;
        document.getElementById('colorAccent').value = style.colors.accent;

        return style;
    }
};

// ===== Landing Builder =====
const LandingBuilder = {
    build(content) {
        return `
            ${this.createHero(content.hero)}
            ${this.createTarget(content.target)}
            ${this.createBenefits(content.benefits)}
            ${this.createForm(content.form)}
            ${this.createGift(content.gift)}
            ${this.createFinalCTA(content.finalCta)}
        `;
    },

    createHero(data) {
        return `
            <section class="landing-section hero-section" data-section="hero" id="section-hero">
                <div class="section-controls">
                    <button class="section-control-btn" onclick="moveSection('hero', -1)">↑</button>
                    <button class="section-control-btn" onclick="moveSection('hero', 1)">↓</button>
                    <button class="section-control-btn" onclick="deleteSection('hero')">×</button>
                </div>
                <div class="hero-image-placeholder" id="placeholder-hero">
                    <div class="placeholder-buttons">
                        <button class="placeholder-btn" onclick="uploadSectionImage('hero')">📁 Загрузить</button>
                        <button class="placeholder-btn placeholder-btn-ai" onclick="generateSectionImage('hero')">✨ Сгенерировать AI</button>
                    </div>
                    <span class="placeholder-text">Фоновое изображение</span>
                </div>
                <div class="hero-content">
                    <h1 contenteditable="true">${data.title}</h1>
                    <p class="hero-subtitle" contenteditable="true">${data.subtitle}</p>
                    <p class="hero-description" contenteditable="true">${data.description}</p>
                    <button class="btn btn-accent">${data.cta}</button>
                </div>
            </section>
        `;
    },

    createTarget(data) {
        const items = data.items.map(item => `
            <div class="target-item">
                <span class="target-check">✓</span>
                <p contenteditable="true">${item}</p>
            </div>
        `).join('');

        return `
            <section class="landing-section target-section" data-section="target" id="section-target">
                <div class="section-controls">
                    <button class="section-control-btn" onclick="moveSection('target', -1)">↑</button>
                    <button class="section-control-btn" onclick="moveSection('target', 1)">↓</button>
                    <button class="section-control-btn" onclick="deleteSection('target')">×</button>
                </div>
                <div class="section-content">
                    <h2 contenteditable="true">${data.title}</h2>
                    <div class="target-grid">
                        ${items}
                    </div>
                </div>
                <div class="section-image-placeholder" id="placeholder-target">
                        <div class="placeholder-buttons">
                            <button class="placeholder-btn" onclick="uploadSectionImage('target')">📁 Загрузить</button>
                            <button class="placeholder-btn placeholder-btn-ai" onclick="generateSectionImage('target')">✨ Сгенерировать AI</button>
                        </div>
                        <span class="placeholder-text">Изображение секции</span>
                    </div>
                </div>
            </section>
        `;
    },

    createBenefits(data) {
        const items = data.items.map((item, i) => `
            <div class="benefit-item">
                <div class="benefit-number">${i + 1}</div>
                <p contenteditable="true">${item}</p>
            </div>
        `).join('');

        return `
            <section class="landing-section benefits-section" data-section="benefits" id="section-benefits">
                <div class="section-controls">
                    <button class="section-control-btn" onclick="moveSection('benefits', -1)">↑</button>
                    <button class="section-control-btn" onclick="moveSection('benefits', 1)">↓</button>
                    <button class="section-control-btn" onclick="deleteSection('benefits')">×</button>
                </div>
                <h2 contenteditable="true">${data.title}</h2>
                <div class="benefits-grid">
                    ${items}
                </div>
            </section>
        `;
    },

    createForm(data) {
        const activityOptions = data.activityOptions.map(opt =>
            `<option value="${opt}">${opt}</option>`
        ).join('');

        const interestCheckboxes = data.interestOptions.map(opt => `
            <label class="checkbox-label">
                <input type="checkbox" name="interest" value="${opt}">
                <span>${opt}</span>
            </label>
        `).join('');

        return `
            <section class="landing-section form-section" data-section="form" id="section-form">
                <div class="section-controls">
                    <button class="section-control-btn" onclick="moveSection('form', -1)">↑</button>
                    <button class="section-control-btn" onclick="moveSection('form', 1)">↓</button>
                    <button class="section-control-btn" onclick="deleteSection('form')">×</button>
                </div>
                <div class="form-container">
                    <h2 contenteditable="true">${data.title}</h2>
                    <form class="landing-form" onsubmit="handleFormSubmit(event)">
                        <div class="form-row">
                            <div class="form-field">
                                <label>Ваше имя и фамилия</label>
                                <input type="text" name="name" placeholder="Введите имя" required>
                            </div>
                            <div class="form-field">
                                <label>Контактный телефон</label>
                                <input type="tel" name="phone" placeholder="+7 (___) ___-__-__" required>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-field">
                                <label>E-mail для связи</label>
                                <input type="email" name="email" placeholder="email@example.com" required>
                            </div>
                            <div class="form-field">
                                <label>Ваш основной вид деятельности</label>
                                <select name="activity" required>
                                    <option value="">Выберите...</option>
                                    ${activityOptions}
                                </select>
                            </div>
                        </div>
                        <div class="form-field">
                            <label>Интересующее направление</label>
                            <div class="checkbox-group">
                                ${interestCheckboxes}
                            </div>
                        </div>
                        <button type="submit" class="btn btn-accent btn-large">${data.cta}</button>
                    </form>
                </div>
            </section>
        `;
    },

    createGift(data) {
        const items = data.items.map(item => `
            <li contenteditable="true">${item}</li>
        `).join('');

        return `
            <section class="landing-section gift-section" data-section="gift" id="section-gift">
                <div class="section-controls">
                    <button class="section-control-btn" onclick="moveSection('gift', -1)">↑</button>
                    <button class="section-control-btn" onclick="moveSection('gift', 1)">↓</button>
                    <button class="section-control-btn" onclick="deleteSection('gift')">×</button>
                </div>
                <div class="gift-content">
                    <div class="gift-text">
                        <h2 contenteditable="true">${data.title}</h2>
                        <p class="gift-description" contenteditable="true">${data.description}</p>
                        <p><strong>Что внутри подарка:</strong></p>
                        <ul class="gift-list">
                            ${items}
                        </ul>
                    </div>
                    <div class="gift-image-placeholder" id="placeholder-gift">
                        <div class="placeholder-buttons">
                            <button class="placeholder-btn" onclick="uploadSectionImage('gift')">📁 Загрузить</button>
                            <button class="placeholder-btn placeholder-btn-ai" onclick="generateSectionImage('gift')">✨ Сгенерировать AI</button>
                        </div>
                        <span class="placeholder-text">Изображение подарка</span>
                    </div>
                </div>
            </section>
        `;
    },

    createFinalCTA(data) {
        return `
            <section class="landing-section final-cta-section" data-section="finalCta" id="section-finalCta">
                <div class="section-controls">
                    <button class="section-control-btn" onclick="moveSection('finalCta', -1)">↑</button>
                    <button class="section-control-btn" onclick="moveSection('finalCta', 1)">↓</button>
                    <button class="section-control-btn" onclick="deleteSection('finalCta')">×</button>
                </div>
                <h2 contenteditable="true">${data.title}</h2>
                <p class="final-text" contenteditable="true">${data.text}</p>
                <button class="btn btn-accent btn-large">${data.button}</button>
                <p class="guarantee-text" contenteditable="true">${data.guarantee}</p>
            </section>
        `;
    },

    createCustomBlock(blockData) {
        const { cols, elements, bgColor, id } = blockData;

        const columnsHtml = [];
        for (let i = 0; i < cols; i++) {
            const colElements = elements.filter(e => e.col === i);
            const elementsHtml = colElements.map(e => this.renderElement(e)).join('');
            columnsHtml.push(`<div class="custom-column">${elementsHtml}</div>`);
        }

        return `
            <section class="landing-section custom-block" data-section="custom-${id}" id="section-custom-${id}" style="background-color: ${bgColor};">
                <div class="section-controls">
                    <button class="section-control-btn" onclick="moveSection('custom-${id}', -1)">↑</button>
                    <button class="section-control-btn" onclick="moveSection('custom-${id}', 1)">↓</button>
                    <button class="section-control-btn" onclick="deleteSection('custom-${id}')">×</button>
                </div>
                <div class="custom-block-content" data-cols="${cols}">
                    ${columnsHtml.join('')}
                </div>
            </section>
        `;
    },

    renderElement(element) {
        switch (element.type) {
            case 'heading':
                return `<h2 contenteditable="true">${element.content || 'Заголовок'}</h2>`;
            case 'subheading':
                return `<h3 contenteditable="true">${element.content || 'Подзаголовок'}</h3>`;
            case 'text':
                return `<p contenteditable="true">${element.content || 'Текст параграфа'}</p>`;
            case 'image':
                const imgId = 'img-' + Date.now() + Math.random().toString(36).substr(2, 9);
                return `
                    <div class="element-image-placeholder" id="${imgId}">
                        <div class="placeholder-buttons">
                            <button class="placeholder-btn" onclick="uploadElementImage(this.closest('.element-image-placeholder'))">📁 Загрузить</button>
                            <button class="placeholder-btn placeholder-btn-ai" onclick="generateElementImage('${imgId}')">✨ AI</button>
                        </div>
                        <span class="placeholder-text">Изображение</span>
                    </div>
                `;
            case 'video':
                return `
                    <div class="video-placeholder" onclick="addVideoEmbed(this)">
                        <span>▶ Добавить видео (вставьте HTML-код)</span>
                    </div>
                `;
            case 'form':
                return `
                    <form class="mini-form" onsubmit="handleFormSubmit(event)">
                        <input type="text" placeholder="Имя" required>
                        <input type="email" placeholder="Email" required>
                        <input type="tel" placeholder="Телефон">
                        <button type="submit" class="btn btn-accent">Отправить</button>
                    </form>
                `;
            case 'button':
                return `<button class="btn btn-accent" contenteditable="true">${element.text || 'Кнопка'}</button>`;
            case 'timer':
                return `
                    <div class="timer-container" data-end="${element.endDate || Date.now() + 86400000}">
                        <div class="timer-block">
                            <div class="timer-number" data-days>00</div>
                            <div class="timer-label">Дней</div>
                        </div>
                        <div class="timer-block">
                            <div class="timer-number" data-hours>00</div>
                            <div class="timer-label">Часов</div>
                        </div>
                        <div class="timer-block">
                            <div class="timer-number" data-minutes>00</div>
                            <div class="timer-label">Минут</div>
                        </div>
                        <div class="timer-block">
                            <div class="timer-number" data-seconds>00</div>
                            <div class="timer-label">Секунд</div>
                        </div>
                    </div>
                `;
            case 'list':
                return `
                    <ul class="custom-list">
                        <li contenteditable="true">Пункт списка 1</li>
                        <li contenteditable="true">Пункт списка 2</li>
                        <li contenteditable="true">Пункт списка 3</li>
                    </ul>
                `;
            default:
                return '';
        }
    }
};

// ===== Image Upload Functions =====
function uploadSectionImage(sectionId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const section = document.getElementById(`section-${sectionId}`);
                const placeholder = section.querySelector('.hero-image-placeholder, .section-image-placeholder, .gift-image-placeholder');

                if (sectionId === 'hero') {
                    section.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url('${event.target.result}')`;
                    section.style.backgroundSize = 'cover';
                    section.style.backgroundPosition = 'center';
                    if (placeholder) placeholder.style.display = 'none';
                } else if (placeholder) {
                    placeholder.innerHTML = `<img src="${event.target.result}" alt="Section image" style="max-width:100%;border-radius:var(--radius);">`;
                }
            };
            reader.readAsDataURL(file);
        }
    };

    input.click();
}

function uploadElementImage(element) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                element.innerHTML = `<img src="${event.target.result}" alt="Image" style="max-width:100%;border-radius:var(--radius);">`;
            };
            reader.readAsDataURL(file);
        }
    };

    input.click();
}

function addVideoEmbed(element) {
    const embedCode = prompt('Вставьте HTML-код видео (iframe):');
    if (embedCode) {
        element.innerHTML = embedCode;
        element.classList.remove('video-placeholder');
        element.classList.add('video-container');
    }
}

// ===== AI Image Generation Functions =====
async function generateSectionImage(sectionId) {
    const placeholder = document.getElementById(`placeholder-${sectionId}`);
    if (!placeholder) return;

    const section = document.getElementById(`section-${sectionId}`);
    if (!section) return;

    // Показываем индикатор загрузки
    const originalContent = placeholder.innerHTML;
    placeholder.innerHTML = `
        <div class="generation-loader">
            <div class="loader-spinner"></div>
            <span>Генерация изображения...</span>
        </div>
    `;
    placeholder.classList.add('generating');

    try {
        const imageUrl = await ImageGenerator.generate(sectionId, state.niche || 'бизнес');

        if (sectionId === 'hero') {
            section.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url('${imageUrl}')`;
            section.style.backgroundSize = 'cover';
            section.style.backgroundPosition = 'center';
            placeholder.style.display = 'none';
        } else {
            placeholder.innerHTML = `
                <img src="${imageUrl}" alt="Generated image" style="max-width:100%;border-radius:var(--radius);">
                <div class="image-overlay-actions">
                    <button class="overlay-btn" onclick="regenerateSectionImage('${sectionId}')">🔄 Перегенерировать</button>
                    <button class="overlay-btn" onclick="uploadSectionImage('${sectionId}')">📁 Заменить</button>
                </div>
            `;
            placeholder.classList.add('has-image');
        }
    } catch (error) {
        console.error('Image generation error:', error);
        placeholder.innerHTML = originalContent;
        alert('Ошибка генерации изображения. Попробуйте снова.');
    }

    placeholder.classList.remove('generating');
}

async function regenerateSectionImage(sectionId) {
    const placeholder = document.getElementById(`placeholder-${sectionId}`);
    if (placeholder) {
        placeholder.classList.remove('has-image');
    }
    await generateSectionImage(sectionId);
}

async function generateElementImage(elementId) {
    const placeholder = document.getElementById(elementId);
    if (!placeholder) return;

    // Показываем индикатор загрузки
    const originalContent = placeholder.innerHTML;
    placeholder.innerHTML = `
        <div class="generation-loader">
            <div class="loader-spinner"></div>
            <span>Генерация...</span>
        </div>
    `;
    placeholder.classList.add('generating');

    try {
        const imageUrl = await ImageGenerator.generate('custom', state.niche || 'бизнес');

        placeholder.innerHTML = `
            <img src="${imageUrl}" alt="Generated image" style="max-width:100%;border-radius:var(--radius);">
            <div class="image-overlay-actions">
                <button class="overlay-btn" onclick="regenerateElementImage('${elementId}')">🔄</button>
                <button class="overlay-btn" onclick="uploadElementImage(document.getElementById('${elementId}'))">📁</button>
            </div>
        `;
        placeholder.classList.add('has-image');
    } catch (error) {
        console.error('Image generation error:', error);
        placeholder.innerHTML = originalContent;
        alert('Ошибка генерации изображения.');
    }

    placeholder.classList.remove('generating');
}

async function regenerateElementImage(elementId) {
    const placeholder = document.getElementById(elementId);
    if (placeholder) {
        placeholder.classList.remove('has-image');
    }
    await generateElementImage(elementId);
}

// Генерация всех изображений сразу
async function generateAllImages() {
    const sections = ['hero', 'target', 'gift'];
    for (const sectionId of sections) {
        const placeholder = document.getElementById(`placeholder-${sectionId}`);
        if (placeholder && !placeholder.classList.contains('has-image')) {
            await generateSectionImage(sectionId);
        }
    }
}

function handleFormSubmit(event) {
    event.preventDefault();
    alert('Спасибо! Ваша заявка отправлена.');
    event.target.reset();
}

// ===== Event Listeners =====

// Sidebar Toggle
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tabId}`).classList.add('active');
    });
});

// Photo Upload Preview
document.getElementById('photos').addEventListener('change', (e) => {
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = '';
    state.photos = [];

    Array.from(e.target.files).slice(0, 5).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            preview.appendChild(img);
            state.photos.push(e.target.result);
        };
        reader.readAsDataURL(file);
    });
});

// Generate Landing
generateBtn.addEventListener('click', async () => {
    const niche = document.getElementById('niche').value.trim();
    const offer = document.getElementById('offer').value.trim();
    const landingGoal = document.getElementById('landingGoal').value.trim();

    if (!niche) {
        alert('Пожалуйста, укажите нишу бизнеса');
        return;
    }

    state.niche = niche;
    state.offer = offer;
    state.landingGoal = landingGoal;

    // Show loading
    generateBtn.querySelector('.btn-text').style.display = 'none';
    generateBtn.querySelector('.btn-loader').style.display = 'inline';
    generateBtn.querySelector('.btn-loader').textContent = 'Генерация через AI...';
    generateBtn.disabled = true;

    try {
        // Step 1: Apply niche styles
        StyleGenerator.applyStyles(niche);

        // Step 2: Generate content via Claude API
        const content = await ClaudeAPI.generateLandingContent(niche, offer, landingGoal);
        state.generatedContent = content;

        // Step 3: Build landing page
        const html = LandingBuilder.build(content);
        previewContainer.innerHTML = html;

        // Step 4: Initialize features
        initSortable();
        updateBlocksList();
        initTimers();

    } catch (error) {
        console.error('Generation error:', error);
        alert('Произошла ошибка при генерации. Попробуйте снова.');
    } finally {
        // Hide loading
        generateBtn.querySelector('.btn-text').style.display = 'inline';
        generateBtn.querySelector('.btn-loader').style.display = 'none';
        generateBtn.disabled = false;
    }
});

// Template Selection
document.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const template = btn.dataset.template;
        state.template = template;
        document.body.className = `template-${template}`;
    });
});

// Color Picker
['colorPrimary', 'colorSecondary', 'colorAccent'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
        const prop = id.replace('color', '').toLowerCase();
        state.colors[prop] = e.target.value;
        document.documentElement.style.setProperty(`--color-${prop}`, e.target.value);
    });
});

// Font Selection
document.getElementById('fontHeading').addEventListener('change', (e) => {
    state.fontHeading = e.target.value;
    document.documentElement.style.setProperty('--font-heading', e.target.value);
});

// Add Block Button
document.getElementById('addBlockBtn').addEventListener('click', () => {
    openModal('addBlockModal');
    resetBlockModal();
});

// Column Selection in Modal
document.querySelectorAll('.col-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.col-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cols = parseInt(btn.dataset.cols);
        updateBlockColumns(cols);
    });
});

// Element Drag & Drop
let draggedElement = null;

document.querySelectorAll('.element-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        draggedElement = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'copy';
    });

    item.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
        draggedElement = null;
    });
});

// Drop Zones
document.getElementById('blockColumns').addEventListener('dragover', (e) => {
    e.preventDefault();
    const dropZone = e.target.closest('.drop-zone');
    if (dropZone) dropZone.classList.add('drag-over');
});

document.getElementById('blockColumns').addEventListener('dragleave', (e) => {
    const dropZone = e.target.closest('.drop-zone');
    if (dropZone) dropZone.classList.remove('drag-over');
});

document.getElementById('blockColumns').addEventListener('drop', (e) => {
    e.preventDefault();
    const dropZone = e.target.closest('.drop-zone');
    if (dropZone && draggedElement) {
        dropZone.classList.remove('drag-over');
        const elementType = draggedElement.dataset.type;
        const colIndex = parseInt(dropZone.dataset.col);
        addElementToColumn(elementType, colIndex, dropZone);
    }
});

// Save Block
document.getElementById('saveBlockBtn').addEventListener('click', () => {
    const cols = document.querySelector('.col-btn.active').dataset.cols;
    const bgColor = document.getElementById('blockBgColor').value;
    const columns = document.querySelectorAll('#blockColumns .block-column');

    const elements = [];
    columns.forEach((col, colIndex) => {
        col.querySelectorAll('.dropped-element').forEach(el => {
            elements.push({
                type: el.dataset.type,
                col: colIndex,
                content: el.dataset.content || ''
            });
        });
    });

    if (elements.length === 0) {
        alert('Добавьте хотя бы один элемент в блок');
        return;
    }

    const blockId = Date.now();
    const blockData = { id: blockId, cols: parseInt(cols), elements, bgColor };

    state.customBlocks.push(blockData);

    const blockHtml = LandingBuilder.createCustomBlock(blockData);
    previewContainer.insertAdjacentHTML('beforeend', blockHtml);

    updateBlocksList();
    closeModal('addBlockModal');
    initTimers();
});

// Export Button
document.getElementById('exportBtn').addEventListener('click', () => {
    openModal('exportModal');
    showExportCode('html');
});

// Export Tabs
document.querySelectorAll('.export-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.export-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        showExportCode(tab.dataset.export);
    });
});

// Copy Code
document.getElementById('copyCodeBtn').addEventListener('click', () => {
    const code = document.getElementById('exportCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        alert('Код скопирован в буфер обмена!');
    });
});

// Download ZIP
document.getElementById('downloadBtn').addEventListener('click', () => {
    downloadAsZip();
});

// Modal Close
document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    });
});

// Close modal on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
});

// ===== Helper Functions =====

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function resetBlockModal() {
    document.querySelectorAll('.col-btn').forEach((b, i) => {
        b.classList.toggle('active', i === 0);
    });
    updateBlockColumns(1);
    document.getElementById('blockBgColor').value = '#ffffff';
}

function updateBlockColumns(cols) {
    const container = document.getElementById('blockColumns');
    container.innerHTML = '';
    container.dataset.cols = cols;

    for (let i = 0; i < cols; i++) {
        const col = document.createElement('div');
        col.className = 'block-column drop-zone';
        col.dataset.col = i;
        col.innerHTML = '<span class="drop-hint">Перетащите элементы сюда</span>';
        container.appendChild(col);
    }
}

function addElementToColumn(type, colIndex, dropZone) {
    const hint = dropZone.querySelector('.drop-hint');
    if (hint) hint.remove();

    const elementDiv = document.createElement('div');
    elementDiv.className = 'dropped-element';
    elementDiv.dataset.type = type;

    const typeNames = {
        heading: 'Заголовок',
        subheading: 'Подзаголовок',
        text: 'Текст',
        image: 'Изображение',
        video: 'Видео',
        form: 'Форма',
        button: 'Кнопка',
        timer: 'Таймер',
        list: 'Список'
    };

    elementDiv.innerHTML = `
        <span>${typeNames[type]}</span>
        <button class="block-item-btn" onclick="this.parentElement.remove()">×</button>
    `;

    dropZone.appendChild(elementDiv);
}

function updateBlocksList() {
    const list = document.getElementById('blocksList');
    const sections = previewContainer.querySelectorAll('.landing-section');

    const sectionNames = {
        hero: 'Главный экран',
        target: 'Это для вас',
        benefits: 'Выгоды',
        form: 'Форма заявки',
        gift: 'Подарок',
        finalCta: 'Финальный призыв'
    };

    let html = '<p class="blocks-hint">Перетаскивайте блоки для изменения порядка</p>';

    sections.forEach(section => {
        const sectionId = section.dataset.section;
        const name = sectionNames[sectionId] || `Блок ${sectionId}`;

        html += `
            <div class="block-item" data-section="${sectionId}">
                <span class="block-item-name">${name}</span>
                <div class="block-item-actions">
                    <button class="block-item-btn" onclick="scrollToSection('${sectionId}')">👁</button>
                    <button class="block-item-btn" onclick="deleteSection('${sectionId}')">×</button>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;

    if (typeof Sortable !== 'undefined') {
        new Sortable(list, {
            animation: 150,
            handle: '.block-item',
            onEnd: function() { reorderSections(); }
        });
    }
}

function initSortable() {
    if (typeof Sortable !== 'undefined') {
        new Sortable(previewContainer, {
            animation: 150,
            handle: '.section-controls',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: function() { updateBlocksList(); }
        });
    }
}

function scrollToSection(sectionId) {
    const section = document.querySelector(`[data-section="${sectionId}"]`);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function moveSection(sectionId, direction) {
    const section = document.querySelector(`[data-section="${sectionId}"]`);
    if (!section) return;

    const sibling = direction === -1 ? section.previousElementSibling : section.nextElementSibling;

    if (sibling && sibling.classList.contains('landing-section')) {
        if (direction === -1) {
            section.parentNode.insertBefore(section, sibling);
        } else {
            section.parentNode.insertBefore(sibling, section);
        }
        updateBlocksList();
    }
}

function deleteSection(sectionId) {
    if (confirm('Удалить этот блок?')) {
        const section = document.querySelector(`[data-section="${sectionId}"]`);
        if (section) {
            section.remove();
            updateBlocksList();
        }
    }
}

function reorderSections() {
    const items = document.querySelectorAll('#blocksList .block-item');
    const container = previewContainer;

    items.forEach(item => {
        const sectionId = item.dataset.section;
        const section = container.querySelector(`[data-section="${sectionId}"]`);
        if (section) container.appendChild(section);
    });
}

function initTimers() {
    document.querySelectorAll('.timer-container').forEach(timer => {
        const endDate = parseInt(timer.dataset.end) || Date.now() + 86400000;

        const updateTimer = () => {
            const diff = Math.max(0, endDate - Date.now());
            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            const daysEl = timer.querySelector('[data-days]');
            const hoursEl = timer.querySelector('[data-hours]');
            const minutesEl = timer.querySelector('[data-minutes]');
            const secondsEl = timer.querySelector('[data-seconds]');

            if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
            if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
            if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
            if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
        };

        updateTimer();
        setInterval(updateTimer, 1000);
    });
}

// ===== Export Functions =====

function showExportCode(type) {
    const codeEl = document.getElementById('exportCode');

    switch(type) {
        case 'html':
            codeEl.textContent = generateHTML();
            break;
        case 'css':
            codeEl.textContent = generateCSS();
            break;
        case 'js':
            codeEl.textContent = generateJS();
            break;
        case 'full':
            codeEl.textContent = generateFullCode();
            break;
    }
}

function generateHTML() {
    const landingContent = previewContainer.innerHTML
        .replace(/\s*data-section="[^"]*"/g, '')
        .replace(/<div class="section-controls">[\s\S]*?<\/div>/g, '')
        .replace(/\s*contenteditable="true"/g, '')
        .replace(/\s*onclick="[^"]*"/g, '')
        .replace(/<div class="[^"]*image-placeholder[^"]*"[^>]*>[\s\S]*?<\/div>/g, '')
        .replace(/<div class="video-placeholder"[^>]*>[\s\S]*?<\/div>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${state.offer || 'Landing Page'}</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
    ${landingContent}
    <script src="script.js"><\/script>
</body>
</html>`;
}

function generateCSS() {
    return `:root {
    --color-primary: ${state.colors.primary};
    --color-secondary: ${state.colors.secondary};
    --color-accent: ${state.colors.accent};
    --color-bg: #f8fafc;
    --color-surface: #ffffff;
    --color-text: #1e293b;
    --color-text-light: #64748b;
    --color-border: #e2e8f0;
    --font-heading: ${state.fontHeading};
    --font-body: 'Inter', sans-serif;
    --radius: 12px;
    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: var(--font-body);
    background: var(--color-bg);
    color: var(--color-text);
    line-height: 1.6;
}

.landing-section { padding: 80px 40px; max-width: 1200px; margin: 0 auto; }

/* Hero */
.hero-section {
    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
    color: white;
    text-align: center;
    padding: 120px 40px;
    max-width: 100%;
    background-size: cover;
    background-position: center;
}

.hero-content { max-width: 800px; margin: 0 auto; }
.hero-section h1 { font-family: var(--font-heading); font-size: 2.75rem; margin-bottom: 20px; line-height: 1.2; }
.hero-subtitle { font-size: 1.5rem; margin-bottom: 15px; opacity: 0.95; }
.hero-description { font-size: 1.125rem; margin-bottom: 30px; opacity: 0.9; }

/* Buttons */
.btn { display: inline-block; padding: 16px 32px; border: none; border-radius: var(--radius); font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.3s; text-transform: uppercase; letter-spacing: 0.5px; }
.btn-accent { background: var(--color-accent); color: #1a1a1a; }
.btn-accent:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
.btn-large { padding: 18px 40px; font-size: 1.125rem; }

/* Target Section */
.target-section { background: white; }
.target-section h2 { font-family: var(--font-heading); font-size: 2rem; text-align: center; margin-bottom: 40px; }
.target-grid { display: flex; flex-direction: column; gap: 20px; max-width: 800px; margin: 0 auto; }
.target-item { display: flex; align-items: flex-start; gap: 15px; padding: 20px; background: var(--color-bg); border-radius: var(--radius); }
.target-check { width: 28px; height: 28px; background: var(--color-primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
.target-item p { font-size: 1.05rem; line-height: 1.5; }

/* Benefits Section */
.benefits-section { background: var(--color-bg); }
.benefits-section h2 { font-family: var(--font-heading); font-size: 2rem; text-align: center; margin-bottom: 40px; }
.benefits-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; }
.benefit-item { display: flex; align-items: flex-start; gap: 15px; padding: 25px; background: white; border-radius: var(--radius); box-shadow: var(--shadow); }
.benefit-number { width: 40px; height: 40px; background: var(--color-primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.125rem; flex-shrink: 0; }
.benefit-item p { font-size: 1.05rem; line-height: 1.5; }

/* Form Section */
.form-section { background: white; }
.form-container { max-width: 700px; margin: 0 auto; }
.form-section h2 { font-family: var(--font-heading); font-size: 1.75rem; text-align: center; margin-bottom: 30px; }
.landing-form { display: flex; flex-direction: column; gap: 20px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.form-field { display: flex; flex-direction: column; gap: 8px; }
.form-field label { font-weight: 500; font-size: 0.9rem; }
.form-field input, .form-field select { padding: 14px 16px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 1rem; transition: border-color 0.2s; }
.form-field input:focus, .form-field select:focus { outline: none; border-color: var(--color-primary); }
.checkbox-group { display: flex; flex-direction: column; gap: 10px; }
.checkbox-label { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.checkbox-label input { width: 18px; height: 18px; }
.landing-form .btn { margin-top: 10px; }

/* Gift Section */
.gift-section { background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); color: white; }
.gift-content { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
.gift-section h2 { font-family: var(--font-heading); font-size: 2rem; margin-bottom: 20px; }
.gift-description { font-size: 1.125rem; margin-bottom: 20px; opacity: 0.95; }
.gift-list { list-style: none; }
.gift-list li { padding: 10px 0; padding-left: 30px; position: relative; font-size: 1.05rem; }
.gift-list li::before { content: '✓'; position: absolute; left: 0; color: var(--color-accent); font-weight: bold; }

/* Final CTA */
.final-cta-section { background: white; text-align: center; }
.final-cta-section h2 { font-family: var(--font-heading); font-size: 2rem; margin-bottom: 15px; }
.final-text { font-size: 1.25rem; color: var(--color-text-light); margin-bottom: 30px; }
.guarantee-text { font-size: 0.9rem; color: var(--color-text-light); margin-top: 20px; }

/* Timer */
.timer-container { display: flex; justify-content: center; gap: 15px; margin: 20px 0; }
.timer-block { background: rgba(255,255,255,0.1); padding: 20px 25px; border-radius: var(--radius); text-align: center; }
.timer-number { font-size: 2.5rem; font-weight: 700; }
.timer-label { font-size: 0.8rem; text-transform: uppercase; opacity: 0.8; }

/* Custom Blocks */
.custom-block-content { display: grid; gap: 30px; }
.custom-block-content[data-cols="2"] { grid-template-columns: 1fr 1fr; }
.custom-block-content[data-cols="3"] { grid-template-columns: 1fr 1fr 1fr; }
.custom-list { list-style: none; }
.custom-list li { padding: 8px 0 8px 25px; position: relative; }
.custom-list li::before { content: '•'; position: absolute; left: 0; color: var(--color-accent); font-weight: bold; }

/* Responsive */
@media (max-width: 768px) {
    .hero-section h1 { font-size: 2rem; }
    .landing-section { padding: 60px 20px; }
    .form-row { grid-template-columns: 1fr; }
    .gift-content { grid-template-columns: 1fr; }
    .custom-block-content[data-cols="2"],
    .custom-block-content[data-cols="3"] { grid-template-columns: 1fr; }
}`;
}

function generateJS() {
    return `// Form Submit
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Спасибо! Ваша заявка отправлена.');
        form.reset();
    });
});

// Timer
document.querySelectorAll('.timer-container').forEach(timer => {
    const endDate = parseInt(timer.dataset.end) || Date.now() + 86400000;

    const update = () => {
        const diff = Math.max(0, endDate - Date.now());
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        const daysEl = timer.querySelector('[data-days]');
        const hoursEl = timer.querySelector('[data-hours]');
        const minutesEl = timer.querySelector('[data-minutes]');
        const secondsEl = timer.querySelector('[data-seconds]');

        if (daysEl) daysEl.textContent = String(d).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(h).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(m).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(s).padStart(2, '0');
    };

    update();
    setInterval(update, 1000);
});`;
}

function generateFullCode() {
    return `<!-- index.html -->
${generateHTML()}

<!-- style.css -->
<style>
${generateCSS()}
</style>

<!-- script.js -->
<script>
${generateJS()}
<\/script>`;
}

function downloadAsZip() {
    const fullCode = generateFullCode();
    const blob = new Blob([fullCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'landing-page.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('AI Landing Constructor with Claude API initialized');
});
