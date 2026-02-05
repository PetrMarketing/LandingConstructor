// ===== Landing Page Builder =====

// Get page ID from URL
const urlParams = new URLSearchParams(window.location.search);
const currentPageId = urlParams.get('id');

// Redirect to admin if no page ID
if (!currentPageId) {
    window.location.href = 'admin.html';
}

// State
const state = {
    elements: [], // Tree structure with children
    selectedElement: null,
    editingElement: null,
    clipboard: null,
    clipboardStyle: null,
    history: [],
    historyIndex: -1,
    viewport: 'desktop',
    pageId: currentPageId,
    pageName: 'Новая страница',
    draggedLayerId: null, // For layer drag & drop
    meta: { // SEO meta data
        title: '',
        description: '',
        keywords: '',
        ogTitle: '',
        ogDescription: '',
        ogImage: '',
        favicon: ''
    },
    theme: {
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
        accentColor: '#f59e0b',
        textColor: '#1e293b',
        textSecondary: '#64748b',
        bgColor: '#ffffff',
        bgSecondary: '#f8fafc',
        borderColor: '#e2e8f0',
        fontFamily: 'Inter',
        borderRadius: '8px'
    }
};

// Theme presets
const themePresets = [
    { name: 'По умолчанию', id: 'default', theme: { primaryColor: '#3b82f6', secondaryColor: '#10b981', accentColor: '#f59e0b', textColor: '#1e293b', textSecondary: '#64748b', bgColor: '#ffffff', bgSecondary: '#f8fafc', borderColor: '#e2e8f0', fontFamily: 'Inter', borderRadius: '8px' } },
    { name: 'Тёмная', id: 'dark', theme: { primaryColor: '#6366f1', secondaryColor: '#22d3ee', accentColor: '#f59e0b', textColor: '#f1f5f9', textSecondary: '#94a3b8', bgColor: '#0f172a', bgSecondary: '#1e293b', borderColor: '#334155', fontFamily: 'Inter', borderRadius: '8px' } },
    { name: 'Зелёная', id: 'green', theme: { primaryColor: '#059669', secondaryColor: '#0d9488', accentColor: '#f59e0b', textColor: '#1e293b', textSecondary: '#64748b', bgColor: '#ffffff', bgSecondary: '#f0fdf4', borderColor: '#d1fae5', fontFamily: 'Inter', borderRadius: '8px' } },
    { name: 'Фиолетовая', id: 'purple', theme: { primaryColor: '#8b5cf6', secondaryColor: '#a78bfa', accentColor: '#f59e0b', textColor: '#1e293b', textSecondary: '#64748b', bgColor: '#ffffff', bgSecondary: '#faf5ff', borderColor: '#e9d5ff', fontFamily: 'Inter', borderRadius: '12px' } },
    { name: 'Тёплая', id: 'warm', theme: { primaryColor: '#ea580c', secondaryColor: '#d97706', accentColor: '#dc2626', textColor: '#1c1917', textSecondary: '#78716c', bgColor: '#fffbeb', bgSecondary: '#fef3c7', borderColor: '#fed7aa', fontFamily: 'Inter', borderRadius: '8px' } },
    { name: 'Минимализм', id: 'minimal', theme: { primaryColor: '#18181b', secondaryColor: '#3f3f46', accentColor: '#18181b', textColor: '#18181b', textSecondary: '#71717a', bgColor: '#ffffff', bgSecondary: '#fafafa', borderColor: '#e4e4e7', fontFamily: 'Inter', borderRadius: '4px' } }
];

// Load page data
function loadPageData() {
    if (!currentPageId) return;

    const pages = JSON.parse(localStorage.getItem('landing_pages') || '[]');
    const page = pages.find(p => String(p.id) === String(currentPageId));

    if (page) {
        state.elements = page.elements || [];
        state.pageName = page.name || 'Новая страница';
        state.meta = page.meta || {
            title: page.name || '',
            description: '',
            keywords: '',
            ogTitle: '',
            ogDescription: '',
            ogImage: '',
            favicon: ''
        };
        if (page.theme) {
            state.theme = { ...state.theme, ...page.theme };
        }

        // Regenerate content for elements with componentSettings (for imported pages)
        function regenerateContent(elements) {
            elements.forEach(el => {
                if (el.componentSettings && (!el.content || el.content === '')) {
                    el.content = generateComponentContent(el.type, el.componentSettings);
                }
                if (el.children && el.children.length > 0) {
                    regenerateContent(el.children);
                }
            });
        }
        regenerateContent(state.elements);

        renderCanvas();
        renderLayers();
        saveHistory();
    }
}

// Save page data
function savePageData() {
    if (!currentPageId) {
        // Just save to local storage with default key
        localStorage.setItem('landing_builder_data', JSON.stringify(state.elements));
        return;
    }

    const pages = JSON.parse(localStorage.getItem('landing_pages') || '[]');
    // Use loose comparison to handle number vs string ID mismatch
    const pageIndex = pages.findIndex(p => String(p.id) === String(currentPageId));

    if (pageIndex !== -1) {
        pages[pageIndex].elements = state.elements;
        pages[pageIndex].meta = state.meta;
        pages[pageIndex].theme = state.theme;
        pages[pageIndex].updatedAt = new Date().toISOString();
        localStorage.setItem('landing_pages', JSON.stringify(pages));
    } else {
        // Page not found in localStorage — create it
        pages.push({
            id: currentPageId,
            name: state.pageName || 'Новая страница',
            elements: state.elements,
            meta: state.meta,
            theme: state.theme,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        localStorage.setItem('landing_pages', JSON.stringify(pages));
    }
}

// DOM Elements
const canvas = document.getElementById('canvas');
const canvasEmpty = document.getElementById('canvasEmpty');
const layersContent = document.getElementById('layersContent');
const editModal = document.getElementById('editModal');
const editContent = document.getElementById('editContent');
const editModalTitle = document.getElementById('editModalTitle');

// Container types that can have children
const containerTypes = ['section', 'container', 'row', 'column', 'div'];

// ===== Google Fonts =====
const googleFonts = [
    { name: 'Inter', weights: [300, 400, 500, 600, 700] },
    { name: 'Roboto', weights: [300, 400, 500, 700] },
    { name: 'Open Sans', weights: [300, 400, 600, 700] },
    { name: 'Montserrat', weights: [300, 400, 500, 600, 700] },
    { name: 'Nunito', weights: [300, 400, 600, 700] },
    { name: 'Lato', weights: [300, 400, 700] },
    { name: 'Poppins', weights: [300, 400, 500, 600, 700] },
    { name: 'Raleway', weights: [300, 400, 500, 600, 700] },
    { name: 'Ubuntu', weights: [300, 400, 500, 700] },
    { name: 'Rubik', weights: [300, 400, 500, 600, 700] },
    { name: 'Work Sans', weights: [300, 400, 500, 600, 700] },
    { name: 'Nunito Sans', weights: [300, 400, 600, 700] },
    { name: 'Fira Sans', weights: [300, 400, 500, 600, 700] },
    { name: 'PT Sans', weights: [400, 700] },
    { name: 'Oswald', weights: [300, 400, 500, 600, 700] },
    { name: 'Playfair Display', weights: [400, 500, 600, 700] },
    { name: 'Merriweather', weights: [300, 400, 700] },
    { name: 'Source Sans Pro', weights: [300, 400, 600, 700] },
    { name: 'Mulish', weights: [300, 400, 500, 600, 700] },
    { name: 'Quicksand', weights: [300, 400, 500, 600, 700] },
    { name: 'Comfortaa', weights: [300, 400, 500, 600, 700] },
    { name: 'Exo 2', weights: [300, 400, 500, 600, 700] },
    { name: 'Jost', weights: [300, 400, 500, 600, 700] },
    { name: 'Manrope', weights: [300, 400, 500, 600, 700] },
    { name: 'Space Grotesk', weights: [300, 400, 500, 600, 700] }
];

// Track loaded fonts
const loadedFonts = new Set();

// Load Google Font dynamically
function loadGoogleFont(fontName) {
    if (!fontName || loadedFonts.has(fontName)) return;

    const font = googleFonts.find(f => f.name === fontName);
    if (!font) return;

    const weights = font.weights.join(';');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@${weights}&display=swap`;
    document.head.appendChild(link);
    loadedFonts.add(fontName);
}

// ===== Page Templates =====
const pageTemplates = [
    // === БАЗОВЫЕ ===
    { id: 'blank', name: 'Пустая страница', category: 'basic', thumbnail: '📄', elements: [] },
    {
        id: 'landing-basic', name: 'Базовый лендинг', category: 'basic', thumbnail: '🚀',
        elements: [
            { type: 'navbar' },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Заголовок вашего предложения', subtitle: 'Подзаголовок с описанием ценности для клиента', buttonText: 'Получить консультацию', buttonColor: '#3b82f6' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Это для вас, если вы:', items: ['Хотите решить свою проблему быстро и эффективно', 'Ищете проверенное решение от экспертов', 'Готовы инвестировать в своё развитие'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'На консультации мы:', items: [{ title: 'Проанализируем вашу ситуацию', description: 'Разберём текущее положение дел и определим точки роста' }, { title: 'Подберём оптимальное решение', description: 'Предложим несколько вариантов под ваши цели и бюджет' }, { title: 'Составим план действий', description: 'Дадим пошаговую инструкцию для достижения результата' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишитесь на бесплатную консультацию', subtitle: 'Мы свяжемся с вами в течение 24 часов', fields: [{ type: 'text', name: 'name', label: 'Ваше имя', placeholder: 'Введите имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', placeholder: '+7 (___) ___-__-__', required: true }, { type: 'email', name: 'email', label: 'Email', placeholder: 'email@example.com', required: true }], buttonText: 'Отправить заявку', buttonColor: '#3b82f6' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#fef3c7', borderRadius: '0' }, children: [
                { type: 'giftBlock', componentSettings: { title: 'Ваш подарок за заявку', subtitle: 'Бесплатно при записи на консультацию', description: 'Получите доступ к эксклюзивным материалам', items: ['Чек-лист для самопроверки', 'Видеоурок от эксперта', 'Шаблоны документов'], buttonText: 'Получить подарок', buttonColor: '#f59e0b' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Не откладывайте своё развитие', description: 'Консультация бесплатна. Мы поможем найти оптимальное решение для ваших целей.', buttonText: 'Записаться на консультацию', buttonColor: '#3b82f6', guaranteeText: 'Ваши данные конфиденциальны. Мы свяжемся с вами в течение 24 часов.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Отличная консультация! Помогли разобраться в ситуации и составить чёткий план действий.', authorName: 'Алексей Петров', authorRole: 'Предприниматель', authorPhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },

    // === КОСМЕТОЛОГИЯ ===
    {
        id: 'cosmetology', name: 'Косметология / Обучение', category: 'education', thumbnail: '💉',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Учебный центр', links: 'Курсы|Спикеры|Отзывы|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(139,92,246,0.8), rgba(139,92,246,0.9)), url(https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Персональный план развития для косметолога', subtitle: 'Бесплатная консультация от менеджера учебного центра. За 30 минут разберем ваши цели и построим пошаговый план обучения.', buttonText: 'ПОЛУЧИТЬ КОНСУЛЬТАЦИЮ И ПОДАРОК', buttonColor: '#8b5cf6' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Это для вас, если вы:', iconColor: '#8b5cf6', items: ['Практикующий косметолог и хотите добавить новую востребованную методику (ботулинотерапию, контурную пластику, нитевой лифтинг)', 'Начинающий специалист и хотите избежать ошибок, выбрав правильный курс для старта карьеры', 'Хотите повысить доход, освоив процедуры премиум-сегмента (трэдлифтинг, коллагеностимуляция)', 'Запутались в разнообразии курсов и ищете оптимальную последовательность обучения', 'Имеете печальный опыт некачественного обучения и хотите выбрать курс с практикой у опытных спикеров'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#faf5ff' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'На консультации мы поможем:', accentColor: '#8b5cf6', items: [{ title: 'Проанализируем ваш уровень и цели', description: 'Разберём текущий опыт и карьерные планы' }, { title: 'Подберем 2-3 оптимальных курса', description: 'Из расписания на 2026 год — от контурной пластики до мезотерапии' }, { title: 'Объясним разницу в программах', description: 'Расскажем о спикерах и особенностях каждого курса' }, { title: 'Рассчитаем выгоду', description: 'Сравним стоимость обучения и потенциальный доход от новой процедуры' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Заполните форму для записи на консультацию', subtitle: 'И получите подарок — доступ к курсу «Нитевая имплантология»', fields: [{ type: 'text', name: 'name', label: 'Ваше имя', placeholder: 'Введите имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', placeholder: '+7 (___) ___-__-__', required: true }, { type: 'email', name: 'email', label: 'Email (для отправки подарка)', placeholder: 'email@example.com', required: true }, { type: 'select', name: 'experience', label: 'Ваш текущий статус', options: ['Начинающий косметолог (менее 1 года)', 'Практикующий косметолог (1-3 года)', 'Опытный косметолог (более 3 лет)', 'Врач, желающий освоить косметологию'], required: true }, { type: 'select', name: 'interest', label: 'Направление, которое интересует', options: ['Контурная пластика', 'Ботулинотерапия', 'Биоревитализация/Мезотерапия', 'Нитевой лифтинг', 'Коллагеностимуляция', 'Пока не знаю, нужна помощь в выборе'], required: false }], buttonText: 'ОТПРАВИТЬ ЗАЯВКУ И ПОЛУЧИТЬ ПОДАРОК', buttonColor: '#8b5cf6', privacyText: 'Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#fef3c7', borderRadius: '0' }, children: [
                { type: 'giftBlock', componentSettings: { title: 'Ваш подарок за запись на консультацию', subtitle: 'Сразу после отправки формы', description: 'Доступ к эксклюзивному лекционному курсу «Нитевая имплантология: от теории к практике»', items: ['Основы работы с нитями для лифтинга', 'Обзор современных методик и зон применения', 'Первый шаг к освоению высокооплачиваемой процедуры'], buttonText: 'Получить подарок', buttonColor: '#f59e0b' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Не откладывай своё профессиональное развитие', description: 'Консультация бесплатна, а подобранная программа обучения станет твоей инвестицией в успешное будущее.', buttonText: 'ВЫБРАТЬ ОБУЧЕНИЕ С ПОДАРКОМ', buttonColor: '#8b5cf6', guaranteeText: 'Ваши данные конфиденциальны. Мы свяжемся с вами в течение 24 часов в рабочее время.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'После обучения в этом центре мой доход вырос в 2 раза. Отличные спикеры и практика на реальных моделях.', authorName: 'Мария Козлова', authorRole: 'Косметолог, стаж 3 года', authorPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },

    // === ЛИЧНЫЙ БРЕНД ===
    {
        id: 'personal-coach', name: 'Коуч / Консультант', category: 'personal', thumbnail: '🎯',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Ваше Имя', links: 'Обо мне|Программы|Отзывы|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Раскрой свой потенциал с личным коучем', subtitle: 'Бесплатная стратегическая сессия. За 60 минут определим ваши цели и составим план их достижения.', buttonText: 'ЗАПИСАТЬСЯ НА СЕССИЮ', buttonColor: '#8b5cf6' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Коучинг для вас, если вы:', iconColor: '#8b5cf6', items: ['Чувствуете, что застряли на месте и не видите пути развития', 'Хотите повысить свой доход, но не знаете как', 'Страдаете от прокрастинации и недостатка мотивации', 'Ищете баланс между работой и личной жизнью', 'Готовы к переменам, но боитесь сделать первый шаг'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#faf5ff' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'На стратегической сессии мы:', accentColor: '#8b5cf6', items: [{ title: 'Определим ваши истинные цели', description: 'Разберёмся, чего вы на самом деле хотите достичь' }, { title: 'Выявим ограничивающие убеждения', description: 'Найдём внутренние барьеры, которые мешают двигаться вперёд' }, { title: 'Составим план первых шагов', description: 'Получите конкретные действия на ближайшую неделю' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишитесь на бесплатную стратегическую сессию', subtitle: 'Свяжусь с вами в течение 24 часов', fields: [{ type: 'text', name: 'name', label: 'Ваше имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'goal', label: 'Ваша главная цель', options: ['Карьерный рост', 'Увеличение дохода', 'Баланс жизни', 'Личностное развитие', 'Другое'] }], buttonText: 'ЗАПИСАТЬСЯ НА СЕССИЮ', buttonColor: '#8b5cf6' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#fef3c7' }, children: [
                { type: 'giftBlock', componentSettings: { title: 'Подарок за запись', description: 'Чек-лист «10 шагов к цели» — практический инструмент для достижения любых целей', items: ['Методика постановки целей', 'Шаблон ежедневного планирования', 'Техники самомотивации'], buttonText: 'Получить чек-лист', buttonColor: '#f59e0b' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Сделай первый шаг к своей лучшей версии', description: 'Стратегическая сессия бесплатна и ни к чему не обязывает.', buttonText: 'НАЧАТЬ ТРАНСФОРМАЦИЮ', buttonColor: '#8b5cf6', guaranteeText: 'Конфиденциальность гарантирована. Свяжусь с вами лично.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1552581234-26160f608093?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'За 3 месяца коучинга вырос в должности и увеличил доход на 40%. Рекомендую!', authorName: 'Дмитрий Соколов', authorRole: 'Руководитель отдела продаж', authorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },

    // === ИНТЕРНЕТ-МАГАЗИН ===
    {
        id: 'shop-fashion', name: 'Магазин одежды', category: 'shop', thumbnail: '👗',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'FASHION STORE', links: 'Каталог|Новинки|Sale|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Найди свой стиль с персональным стилистом', subtitle: 'Бесплатная консультация по подбору гардероба. Поможем создать образы, которые подчеркнут вашу индивидуальность.', buttonText: 'ПОЛУЧИТЬ КОНСУЛЬТАЦИЮ', buttonColor: '#1e293b' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Консультация стилиста для вас, если:', iconColor: '#1e293b', items: ['Шкаф полон одежды, но надеть нечего', 'Хотите выглядеть дороже без больших затрат', 'Не знаете, какие цвета и фасоны вам идут', 'Готовитесь к важному событию и нужен идеальный образ', 'Хотите обновить гардероб с умом'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Что вы получите:', accentColor: '#1e293b', items: [{ title: 'Анализ вашего типажа', description: 'Определим цветотип, тип фигуры и стилевое направление' }, { title: 'Персональную подборку', description: 'Готовые образы из нашей коллекции под ваш запрос' }, { title: 'Скидку 15% на первую покупку', description: 'Бонус за прохождение консультации' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишитесь на консультацию стилиста', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'goal', label: 'Что хотите подобрать', options: ['Повседневный гардероб', 'Деловой стиль', 'Образ для мероприятия', 'Полный разбор гардероба'] }], buttonText: 'ЗАПИСАТЬСЯ', buttonColor: '#1e293b' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1445205170230-053b83016050?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Стилист подобрала идеальный гардероб! Теперь получаю комплименты каждый день.', authorName: 'Анна Смирнова', authorRole: 'Клиент', authorPhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },

    // === НЕДВИЖИМОСТЬ ===
    {
        id: 'realestate-agency', name: 'Агентство недвижимости', category: 'realestate', thumbnail: '🏢',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Метры', links: 'Купить|Снять|Продать|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(5,150,105,0.8), rgba(5,150,105,0.9)), url(https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Найдём квартиру вашей мечты за 7 дней', subtitle: 'Бесплатная консультация риелтора. Подберём варианты под ваш бюджет и требования.', buttonText: 'ПОЛУЧИТЬ ПОДБОРКУ КВАРТИР', buttonColor: '#059669' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Обратитесь к нам, если вы:', iconColor: '#059669', items: ['Устали от бесконечного поиска на Авито и ЦИАН', 'Боитесь нарваться на мошенников или скрытые проблемы', 'Не знаете реальную рыночную стоимость квартир', 'Хотите сэкономить время и нервы', 'Нужна помощь с ипотекой и документами'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f0fdf4' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'На консультации мы:', accentColor: '#059669', items: [{ title: 'Уточним ваши требования', description: 'Район, метраж, бюджет, инфраструктура' }, { title: 'Подберём 5-7 вариантов', description: 'Только проверенные объекты без скрытых проблем' }, { title: 'Рассчитаем ипотеку', description: 'Подскажем лучшие условия от банков-партнёров' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'counter', componentSettings: { num1: '10K+', label1: 'Объектов в базе', num2: '15', label2: 'Лет на рынке', num3: '5000+', label3: 'Довольных клиентов' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Получите персональную подборку квартир', subtitle: 'Ответьте на 3 вопроса и получите варианты уже сегодня', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'type', label: 'Тип сделки', options: ['Купить квартиру', 'Снять квартиру', 'Продать недвижимость'] }, { type: 'select', name: 'budget', label: 'Бюджет', options: ['До 5 млн', '5-10 млн', '10-15 млн', 'Более 15 млн'] }], buttonText: 'ПОЛУЧИТЬ ПОДБОРКУ', buttonColor: '#059669' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Начните поиск своей квартиры сегодня', description: 'Консультация бесплатна. Поможем найти идеальный вариант.', buttonText: 'ПОЛУЧИТЬ КОНСУЛЬТАЦИЮ', buttonColor: '#059669', guaranteeText: 'Ваши данные защищены. Никакого спама — только полезная информация.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Нашли идеальную квартиру за 5 дней. Профессиональный подход и никаких скрытых комиссий.', authorName: 'Игорь Волков', authorRole: 'Купил квартиру', authorPhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'realestate-developer', name: 'Застройщик / ЖК', category: 'realestate', thumbnail: '🏗️',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'ЖК Парковый', links: 'О проекте|Планировки|Ход строительства|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(30,64,175,0.85), rgba(30,64,175,0.9)), url(https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Квартиры в ЖК «Парковый» с выгодой до 500 000₽', subtitle: 'Бесплатная консультация менеджера. Подберём планировку под ваш бюджет, рассчитаем ипотеку.', buttonText: 'ПОЛУЧИТЬ РАСЧЁТ', buttonColor: '#1e40af' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'ЖК «Парковый» — для тех, кто ценит:', iconColor: '#1e40af', items: ['Квартиры бизнес-класса по цене комфорта', 'Закрытую охраняемую территорию с собственным парком', 'Продуманную инфраструктуру: школа, садик, магазины в пешей доступности', 'Удобное расположение: 10 минут до метро', 'Надёжного застройщика с 15-летней историей'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#eff6ff' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Что вы получите на консультации:', accentColor: '#1e40af', items: [{ title: 'Подбор планировки', description: 'Покажем варианты под ваш бюджет и требования' }, { title: 'Расчёт ипотеки', description: 'Ставки от 0.1% в банках-партнёрах' }, { title: 'Виртуальный тур', description: 'Посмотрите квартиру онлайн в 3D' }, { title: 'Фиксация цены', description: 'Забронируем квартиру на 3 дня без доплат' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Получите персональный расчёт', subtitle: 'Менеджер свяжется с вами в течение 15 минут', fields: [{ type: 'text', name: 'name', label: 'Ваше имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'rooms', label: 'Количество комнат', options: ['Студия', '1 комната', '2 комнаты', '3+ комнаты'] }, { type: 'select', name: 'budget', label: 'Бюджет', options: ['До 8 млн', '8-12 млн', '12-18 млн', 'Более 18 млн'] }], buttonText: 'ПОЛУЧИТЬ РАСЧЁТ', buttonColor: '#1e40af' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#fef3c7' }, children: [
                { type: 'giftBlock', componentSettings: { title: 'Подарок за заявку', description: 'Скидка 200 000₽ при бронировании в этом месяце', items: ['Бесплатная кладовая', 'Скидка на паркинг', 'Дизайн-проект в подарок'], buttonText: 'Забрать подарок', buttonColor: '#f59e0b' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Ваша квартира ждёт вас', description: 'Сдача Q4 2025. Рассрочка 0%. Ипотека от 0.1%.', buttonText: 'ЗАБРОНИРОВАТЬ КВАРТИРУ', buttonColor: '#1e40af', guaranteeText: 'Цены актуальны на сегодня. Бронь бесплатна и ни к чему не обязывает.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Купили квартиру ещё на этапе строительства. Сдали вовремя, качество отделки на высоте!', authorName: 'Елена Новикова', authorRole: 'Собственница квартиры в ЖК', authorPhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },

    // === РЕСТОРАНЫ И КАФЕ ===
    {
        id: 'restaurant-main', name: 'Ресторан', category: 'restaurant', thumbnail: '🍽️',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'La Maison', links: 'Меню|О нас|Мероприятия|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Забронируйте столик в La Maison', subtitle: 'Французская кухня в сердце города. Бесплатный комплимент от шефа при бронировании онлайн.', buttonText: 'ЗАБРОНИРОВАТЬ СТОЛИК', buttonColor: '#7c2d12' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'La Maison — для особенных моментов:', iconColor: '#7c2d12', items: ['Романтический ужин на двоих в уютной атмосфере', 'Деловой обед с партнёрами в приватном зале', 'Семейное торжество с продуманным меню', 'Гастрономическое путешествие по французской кухне', 'Винный вечер с сомелье'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#fef3c7' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Почему выбирают нас:', accentColor: '#7c2d12', items: [{ title: 'Авторская кухня', description: 'Шеф-повар с опытом работы в Париже' }, { title: 'Винная карта', description: '200+ позиций из лучших регионов Франции' }, { title: 'Атмосфера', description: 'Приватные залы и открытая терраса' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Забронировать столик', subtitle: 'Подтвердим бронь в течение 30 минут', fields: [{ type: 'text', name: 'name', label: 'Ваше имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'guests', label: 'Количество гостей', options: ['2 гостя', '3-4 гостя', '5-8 гостей', 'Более 8'] }, { type: 'select', name: 'occasion', label: 'Повод', options: ['Романтический ужин', 'Деловая встреча', 'День рождения', 'Другое'] }], buttonText: 'ЗАБРОНИРОВАТЬ', buttonColor: '#7c2d12' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Ждём вас в La Maison', description: 'Бронирование бесплатно. Комплимент от шефа — при заказе онлайн.', buttonText: 'ЗАБРОНИРОВАТЬ СТОЛИК', buttonColor: '#7c2d12', guaranteeText: 'Работаем ежедневно с 12:00 до 00:00' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Лучший ресторан для романтического ужина. Превосходная кухня и безупречный сервис.', authorName: 'Михаил Ковалёв', authorRole: 'Гость ресторана', authorPhoto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'restaurant-cafe', name: 'Кофейня', category: 'restaurant', thumbnail: '☕',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Coffee Lab', links: 'Меню|О зёрнах|Адреса|Франшиза' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(120,53,15,0.8), rgba(120,53,15,0.85)), url(https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Попробуйте specialty кофе бесплатно', subtitle: 'Приходите на дегустацию в Coffee Lab. Расскажем о зёрнах и подберём ваш идеальный напиток.', buttonText: 'ЗАПИСАТЬСЯ НА ДЕГУСТАЦИЮ', buttonColor: '#78350f' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Coffee Lab для тех, кто:', iconColor: '#78350f', items: ['Устал от безвкусного кофе и хочет попробовать настоящий specialty', 'Интересуется миром кофе и хочет научиться разбираться в сортах', 'Ищет уютное место для работы или встреч', 'Хочет купить свежеобжаренный кофе для дома', 'Рассматривает открытие своей кофейни по франшизе'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#fef3c7' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Наши особенности:', accentColor: '#78350f', items: [{ title: 'Свежая обжарка', description: 'Обжариваем каждую неделю, не храним старый кофе' }, { title: 'Прямые закупки', description: 'Работаем с фермами напрямую, знаем историю каждого зерна' }, { title: 'Обучение бариста', description: 'Проводим мастер-классы и курсы' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Записаться на бесплатную дегустацию', fields: [{ type: 'text', name: 'name', label: 'Ваше имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'interest', label: 'Что интересует', options: ['Дегустация кофе', 'Мастер-класс', 'Покупка зёрен', 'Франшиза'] }], buttonText: 'ЗАПИСАТЬСЯ', buttonColor: '#78350f' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Лучший specialty кофе в городе! Захожу каждое утро перед работой. Бариста настоящие профессионалы.', authorName: 'Ольга Тарасова', authorRole: 'Постоянный гость', authorPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'restaurant-delivery', name: 'Доставка еды', category: 'restaurant', thumbnail: '🍕',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Pizza Express', links: 'Меню|Акции|Доставка|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(220,38,38,0.85), rgba(220,38,38,0.9)), url(https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Пицца за 30 минут или бесплатно!', subtitle: 'Закажите прямо сейчас и получите напиток в подарок к первому заказу.', buttonText: 'ЗАКАЗАТЬ СО СКИДКОЙ 20%', buttonColor: '#dc2626' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Почему заказывают у нас:', iconColor: '#dc2626', items: ['Доставка за 30 минут или пицца бесплатно — гарантия!', 'Тесто готовим каждый день, никаких заморозок', 'Щедрые начинки — минимум 200г сыра на каждую пиццу', 'Горячая пицца — специальные термосумки', 'Удобный заказ через сайт или приложение'] } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#fef2f2' }, children: [
                { type: 'counter', componentSettings: { num1: '30', label1: 'Минут доставка', num2: '15', label2: 'Видов пиццы', num3: '4.9', label3: 'Рейтинг' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Оставьте заявку — перезвоним за 2 минуты', subtitle: 'Поможем с выбором и оформим заказ', fields: [{ type: 'text', name: 'name', label: 'Ваше имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }], buttonText: 'ПЕРЕЗВОНИТЕ МНЕ', buttonColor: '#dc2626' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Закажите пиццу прямо сейчас', description: 'Скидка 20% на первый заказ. Напиток в подарок.', buttonText: 'ЗАКАЗАТЬ ПИЦЦУ', buttonColor: '#dc2626', guaranteeText: 'Доставка от 30 минут. Оплата при получении.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Заказываю каждую пятницу. Пицца всегда горячая, доставка реально за 30 минут!', authorName: 'Артём Кузнецов', authorRole: 'Постоянный клиент', authorPhoto: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },

    // === ФИТНЕС ===
    {
        id: 'fitness-gym', name: 'Фитнес-клуб', category: 'fitness', thumbnail: '🏋️',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'FitLife', links: 'Залы|Расписание|Цены|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.7)), url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Первая тренировка — бесплатно', subtitle: 'Приходите на пробное занятие в FitLife. Познакомим с залом, составим программу под ваши цели.', buttonText: 'ЗАПИСАТЬСЯ БЕСПЛАТНО', buttonColor: '#f97316' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'FitLife для вас, если:', iconColor: '#f97316', items: ['Хотите похудеть и привести тело в форму', 'Давно не занимались и не знаете с чего начать', 'Ищете клуб рядом с домом или работой', 'Хотите заниматься в современном зале с хорошим оборудованием', 'Нужна помощь тренера в составлении программы'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#fff7ed' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Что вас ждёт:', accentColor: '#f97316', items: [{ title: 'Современный зал', description: '5000 м², более 200 тренажёров Technogym' }, { title: 'Групповые программы', description: 'Йога, пилатес, CrossFit, танцы — 50+ направлений' }, { title: 'Бассейн и сауна', description: '25-метровый бассейн, финская сауна, хаммам' }, { title: 'Персональный тренер', description: 'Подберём программу под ваши цели' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишитесь на бесплатную тренировку', subtitle: 'Администратор свяжется с вами в течение часа', fields: [{ type: 'text', name: 'name', label: 'Ваше имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'goal', label: 'Ваша цель', options: ['Похудение', 'Набор мышечной массы', 'Поддержание формы', 'Гибкость и растяжка', 'Пока не определился'] }], buttonText: 'ЗАПИСАТЬСЯ БЕСПЛАТНО', buttonColor: '#f97316' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#fef3c7' }, children: [
                { type: 'giftBlock', componentSettings: { title: 'Подарок при покупке абонемента', description: 'Персональная тренировка с тренером в подарок', items: ['Анализ состава тела', 'Составление программы', 'Рекомендации по питанию'], buttonText: 'Получить подарок', buttonColor: '#f59e0b' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Начни менять себя сегодня', description: 'Первая тренировка бесплатна. Заморозка абонемента на время отпуска.', buttonText: 'ЗАПИСАТЬСЯ', buttonColor: '#f97316', guaranteeText: 'Работаем 24/7. Парковка для клиентов бесплатно.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Лучший фитнес-клуб! Современное оборудование, чистота и отличные тренеры.', authorName: 'Сергей Морозов', authorRole: 'Член клуба 2 года', authorPhoto: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'fitness-trainer', name: 'Персональный тренер', category: 'fitness', thumbnail: '💪',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Тренер Алексей', links: 'Обо мне|Программы|Результаты|Контакт' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(22,163,74,0.8), rgba(22,163,74,0.85)), url(https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Достигни формы мечты за 3 месяца', subtitle: 'Бесплатная консультация и диагностика. Разберём твои цели и составим индивидуальный план.', buttonText: 'ЗАПИСАТЬСЯ НА КОНСУЛЬТАЦИЮ', buttonColor: '#16a34a' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Персональный тренинг для тебя, если:', iconColor: '#16a34a', items: ['Хочешь похудеть, но диеты не работают', 'Занимаешься сам, но нет результата', 'Нужна мотивация и контроль', 'Есть проблемы со здоровьем и нужен индивидуальный подход', 'Хочешь подготовиться к соревнованиям или фотосессии'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f0fdf4' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Что ты получишь:', accentColor: '#16a34a', items: [{ title: 'Индивидуальную программу', description: 'Тренировки, адаптированные под твой уровень и цели' }, { title: 'Контроль техники', description: 'Избежишь травм и получишь максимум от упражнений' }, { title: 'План питания', description: 'Рекомендации по рациону без жёстких диет' }, { title: 'Поддержку 24/7', description: 'Отвечаю на вопросы и корректирую программу' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'counter', componentSettings: { num1: '10', label1: 'Лет опыта', num2: '500+', label2: 'Клиентов', num3: '95%', label3: 'Достигают цели' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишись на бесплатную консультацию', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'goal', label: 'Цель', options: ['Похудение', 'Набор массы', 'Рельеф', 'Здоровье и тонус', 'Подготовка к соревнованиям'] }], buttonText: 'ЗАПИСАТЬСЯ', buttonColor: '#16a34a' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Начни трансформацию сегодня', description: 'Первая консультация бесплатна. Результат гарантирую.', buttonText: 'ЗАПИСАТЬСЯ К ТРЕНЕРУ', buttonColor: '#16a34a', guaranteeText: 'Тренировки онлайн или в зале. Гибкий график.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'За 3 месяца с Алексеем сбросила 15 кг без жёстких диет. Лучший тренер!', authorName: 'Наталья Белова', authorRole: 'Похудела на 15 кг', authorPhoto: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'fitness-yoga', name: 'Йога студия', category: 'fitness', thumbnail: '🧘',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Shanti Yoga', links: 'Расписание|Направления|Преподаватели|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(124,58,237,0.7), rgba(124,58,237,0.8)), url(https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Первое занятие йогой — бесплатно', subtitle: 'Приходите на пробную практику в Shanti Yoga. Подберём направление под ваши цели.', buttonText: 'ЗАПИСАТЬСЯ НА ПРАКТИКУ', buttonColor: '#7c3aed' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Йога для вас, если вы хотите:', iconColor: '#7c3aed', items: ['Снять стресс и обрести внутреннее спокойствие', 'Улучшить гибкость и осанку', 'Избавиться от болей в спине и шее', 'Научиться управлять эмоциями через дыхание', 'Найти единомышленников и практику для души'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#faf5ff' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Наши направления:', accentColor: '#7c3aed', items: [{ title: 'Хатха-йога', description: 'Классическая практика для начинающих и продолжающих' }, { title: 'Виньяса', description: 'Динамичная практика для тех, кто любит движение' }, { title: 'Йога-нидра', description: 'Глубокое расслабление и восстановление' }, { title: 'Медитация', description: 'Практики осознанности для ментального здоровья' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишитесь на пробное занятие', subtitle: 'Администратор свяжется с вами в течение дня', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'level', label: 'Ваш уровень', options: ['Новичок', 'Есть опыт', 'Продвинутый'] }, { type: 'select', name: 'interest', label: 'Интересует', options: ['Хатха-йога', 'Виньяса', 'Медитация', 'Пока не знаю'] }], buttonText: 'ЗАПИСАТЬСЯ', buttonColor: '#7c3aed' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Найди гармонию в Shanti Yoga', description: 'Первое занятие бесплатно. Коврики и всё необходимое предоставляем.', buttonText: 'НАЧАТЬ ПРАКТИКУ', buttonColor: '#7c3aed', guaranteeText: 'Камерные группы до 12 человек. Удобное расположение в центре.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1588286840104-8957b019727f?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Shanti Yoga изменила мою жизнь. Спина больше не болит, стала спокойнее и энергичнее.', authorName: 'Ирина Лебедева', authorRole: 'Практикует йогу 1 год', authorPhoto: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },

    // === ОБРАЗОВАНИЕ ===
    {
        id: 'education-course', name: 'Онлайн-курс', category: 'education', thumbnail: '📚',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'WebDev Pro', links: 'Программа|Отзывы|Автор|Записаться' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(37,99,235,0.85), rgba(37,99,235,0.9)), url(https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Стань веб-разработчиком за 6 месяцев', subtitle: 'Бесплатная консультация с куратором. Расскажем о программе и составим план обучения.', buttonText: 'ПОЛУЧИТЬ КОНСУЛЬТАЦИЮ', buttonColor: '#2563eb' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Курс для вас, если:', iconColor: '#2563eb', items: ['Хотите сменить профессию и войти в IT', 'Уже пробовали учиться сами, но застряли', 'Нужна системная программа и наставник', 'Хотите гарантию трудоустройства после обучения', 'Важна практика на реальных проектах, а не только теория'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#eff6ff' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Что вы получите:', accentColor: '#2563eb', items: [{ title: '150+ видеоуроков', description: 'Структурированная программа от основ до продвинутого уровня' }, { title: '10 проектов в портфолио', description: 'Реальные задачи от компаний-партнёров' }, { title: 'Персональный ментор', description: 'Код-ревью, ответы на вопросы, помощь с проектами' }, { title: 'Помощь с трудоустройством', description: 'Подготовка резюме, симуляция собеседований' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'counter', componentSettings: { num1: '6', label1: 'Месяцев обучения', num2: '90%', label2: 'Трудоустройство', num3: '120K+', label3: 'Средняя зарплата' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишитесь на бесплатную консультацию', subtitle: 'Расскажем о программе и ответим на вопросы', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'email', name: 'email', label: 'Email', required: true }, { type: 'select', name: 'level', label: 'Ваш уровень', options: ['Полный ноль', 'Немного знаком с HTML/CSS', 'Есть опыт программирования'] }], buttonText: 'ЗАПИСАТЬСЯ', buttonColor: '#2563eb' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#fef3c7' }, children: [
                { type: 'giftBlock', componentSettings: { title: 'Подарок за заявку', description: 'Бесплатный мини-курс «Первые шаги в веб-разработке»', items: ['5 видеоуроков', 'Практические задания', 'Доступ к чату студентов'], buttonText: 'Получить курс', buttonColor: '#f59e0b' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Начни карьеру в IT уже сегодня', description: 'Гарантия трудоустройства или возврат денег. Рассрочка без переплаты.', buttonText: 'НАЧАТЬ ОБУЧЕНИЕ', buttonColor: '#2563eb', guaranteeText: 'Обучение онлайн. Старт нового потока каждый месяц.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Пришёл с нуля, через 6 месяцев устроился в IT-компанию с зарплатой 120K. Спасибо WebDev Pro!', authorName: 'Андрей Сидоров', authorRole: 'Выпускник, Junior Developer', authorPhoto: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'education-school', name: 'Школа / Детский центр', category: 'education', thumbnail: '🎓',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Умные дети', links: 'Программы|Расписание|Преподаватели|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(234,88,12,0.85), rgba(234,88,12,0.9)), url(https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Пробный урок для вашего ребёнка — бесплатно', subtitle: 'Приходите на ознакомительное занятие. Подберём программу по возрасту и интересам.', buttonText: 'ЗАПИСАТЬСЯ НА УРОК', buttonColor: '#ea580c' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Приводите ребёнка к нам, если хотите:', iconColor: '#ea580c', items: ['Развить логику и творческое мышление', 'Подготовить к школе или подтянуть успеваемость', 'Выучить английский в игровой форме', 'Научить программированию и робототехнике', 'Дать навыки, которые пригодятся в будущем'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#fff7ed' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Наши программы:', accentColor: '#ea580c', items: [{ title: 'Английский язык', description: 'Игровая методика для детей 3-14 лет' }, { title: 'Робототехника', description: 'LEGO Education, программирование Scratch' }, { title: 'Подготовка к школе', description: 'Чтение, счёт, письмо, развитие речи' }, { title: 'Творческая мастерская', description: 'Рисование, лепка, музыка' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'counter', componentSettings: { num1: '500+', label1: 'Учеников', num2: '15', label2: 'Педагогов', num3: '10', label3: 'Лет опыта' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишите ребёнка на пробный урок', fields: [{ type: 'text', name: 'name', label: 'Имя родителя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'age', label: 'Возраст ребёнка', options: ['3-5 лет', '6-8 лет', '9-11 лет', '12-14 лет'] }, { type: 'select', name: 'program', label: 'Интересующая программа', options: ['Английский', 'Робототехника', 'Подготовка к школе', 'Творчество', 'Не определились'] }], buttonText: 'ЗАПИСАТЬСЯ', buttonColor: '#ea580c' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Развивайте таланты вашего ребёнка', description: 'Пробный урок бесплатно. Удобное расписание. Группы до 8 человек.', buttonText: 'ЗАПИСАТЬСЯ НА УРОК', buttonColor: '#ea580c', guaranteeText: 'Возврат оплаты, если вам не понравится.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1544776193-352d25ca82cd?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Дети ходят с удовольствием! Старший заговорил по-английски, младшая обожает робототехнику.', authorName: 'Татьяна Федорова', authorRole: 'Мама двоих детей', authorPhoto: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'education-tutor', name: 'Репетитор', category: 'education', thumbnail: '👨‍🏫',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Репетитор Елена', links: 'Обо мне|Предметы|Отзывы|Записаться' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(8,145,178,0.85), rgba(8,145,178,0.9)), url(https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Подготовка к ЕГЭ по математике на 90+ баллов', subtitle: 'Бесплатное пробное занятие. Выявим пробелы и составим индивидуальный план подготовки.', buttonText: 'ЗАПИСАТЬСЯ НА УРОК', buttonColor: '#0891b2' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Занятия со мной подойдут, если:', iconColor: '#0891b2', items: ['Хотите сдать ЕГЭ на высокий балл и поступить в топовый вуз', 'Есть пробелы в знаниях, которые мешают двигаться дальше', 'Нужен индивидуальный подход, а не шаблонные курсы', 'Важна удобная форма занятий (онлайн или очно)', 'Хотите не просто натаскать, а понять предмет'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#ecfeff' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Почему выбирают меня:', accentColor: '#0891b2', items: [{ title: '15 лет опыта', description: 'Подготовила более 200 учеников к ЕГЭ' }, { title: 'Средний балл учеников — 95', description: 'Многие поступили в МГУ, МФТИ, ВШЭ' }, { title: 'Понятные объяснения', description: 'Сложное объясняю простым языком' }, { title: 'Домашние задания', description: 'С разбором ошибок и рекомендациями' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'counter', componentSettings: { num1: '15', label1: 'Лет опыта', num2: '200+', label2: 'Учеников', num3: '95', label3: 'Средний балл' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишитесь на бесплатный пробный урок', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'grade', label: 'Класс', options: ['9 класс (ОГЭ)', '10 класс', '11 класс (ЕГЭ)'] }, { type: 'select', name: 'format', label: 'Формат', options: ['Онлайн', 'Очно у репетитора', 'Очно с выездом'] }], buttonText: 'ЗАПИСАТЬСЯ', buttonColor: '#0891b2' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Начни подготовку к ЕГЭ прямо сейчас', description: 'Пробный урок бесплатный. Гибкий график. Оплата помесячно.', buttonText: 'ЗАПИСАТЬСЯ К РЕПЕТИТОРУ', buttonColor: '#0891b2', guaranteeText: 'Места на этот месяц ограничены.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1523050854058-8df90110c8f1?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Елена Ивановна — лучший репетитор! Объясняет так, что даже самые сложные темы становятся понятными.', authorName: 'Варвара Комарова', authorRole: 'Сдала ЕГЭ на 98 баллов', authorPhoto: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },

    // === УСЛУГИ ===
    {
        id: 'services-beauty', name: 'Салон красоты', category: 'services', thumbnail: '💇',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Beauty Lab', links: 'Услуги|Мастера|Цены|Записаться' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(219,39,119,0.8), rgba(219,39,119,0.85)), url(https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Запишитесь на процедуру со скидкой 20%', subtitle: 'Первый визит в Beauty Lab — со специальным предложением. Познакомьтесь с нашими мастерами.', buttonText: 'ЗАПИСАТЬСЯ СО СКИДКОЙ', buttonColor: '#db2777' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Приходите к нам, если хотите:', iconColor: '#db2777', items: ['Обновить образ: стрижка, окрашивание, укладка', 'Ухоженные ногти: маникюр и педикюр с долговечным покрытием', 'Здоровую кожу: чистки, пилинги, уходовые процедуры', 'Расслабиться: массаж, спа-процедуры', 'Доверить свою красоту профессионалам'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#fdf2f8' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Почему выбирают нас:', accentColor: '#db2777', items: [{ title: 'Опытные мастера', description: 'Каждый специалист — с сертификатами и стажем от 5 лет' }, { title: 'Премиум материалы', description: 'Работаем только с проверенными брендами' }, { title: 'Уютная атмосфера', description: 'Кофе, чай, журналы — отдыхайте, пока мы работаем' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишитесь на процедуру', subtitle: 'Администратор свяжется для подтверждения', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'service', label: 'Услуга', options: ['Стрижка/укладка', 'Окрашивание', 'Маникюр/педикюр', 'Косметология', 'Другое'] }], buttonText: 'ЗАПИСАТЬСЯ СО СКИДКОЙ 20%', buttonColor: '#db2777' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Станьте красивее с Beauty Lab', description: 'Скидка 20% на первый визит. Онлайн-запись 24/7.', buttonText: 'ЗАПИСАТЬСЯ', buttonColor: '#db2777', guaranteeText: 'Если результат вам не понравится — исправим бесплатно.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Хожу только в Beauty Lab! Мастера профессионалы, всегда довольна результатом.', authorName: 'Юлия Егорова', authorRole: 'Постоянная клиентка', authorPhoto: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'services-cleaning', name: 'Клининг', category: 'services', thumbnail: '🧹',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'CleanHome', links: 'Услуги|Цены|О нас|Заказать' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(13,148,136,0.85), rgba(13,148,136,0.9)), url(https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Профессиональная уборка от 1500₽', subtitle: 'Рассчитайте стоимость за 30 секунд. Приедем сегодня или в удобное время.', buttonText: 'РАССЧИТАТЬ СТОИМОСТЬ', buttonColor: '#0d9488' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Закажите уборку, если:', iconColor: '#0d9488', items: ['Нет времени на уборку — работа, семья, дела', 'Нужна генеральная уборка перед праздниками или после ремонта', 'Хотите регулярную поддерживающую уборку', 'Переезжаете и нужно убрать старую или новую квартиру', 'Просто хотите отдохнуть, пока профессионалы делают работу'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f0fdfa' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Почему выбирают нас:', accentColor: '#0d9488', items: [{ title: 'Фиксированные цены', description: 'Никаких доплат — озвучиваем стоимость до начала работ' }, { title: 'Проверенные клинеры', description: 'Все сотрудники прошли проверку и обучение' }, { title: 'Свои расходники', description: 'Привозим всё необходимое — средства, инвентарь' }, { title: 'Гарантия качества', description: 'Если что-то не так — переделаем бесплатно' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'counter', componentSettings: { num1: '5000+', label1: 'Уборок', num2: '99%', label2: 'Довольных', num3: '2ч', label3: 'Среднее время' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Рассчитайте стоимость уборки', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'type', label: 'Тип уборки', options: ['Поддерживающая', 'Генеральная', 'После ремонта', 'Мойка окон'] }, { type: 'select', name: 'rooms', label: 'Количество комнат', options: ['Студия', '1 комната', '2 комнаты', '3+ комнаты'] }], buttonText: 'РАССЧИТАТЬ СТОИМОСТЬ', buttonColor: '#0d9488' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Закажите уборку прямо сейчас', description: 'Приедем сегодня. Оплата после проверки качества.', buttonText: 'ЗАКАЗАТЬ УБОРКУ', buttonColor: '#0d9488', guaranteeText: 'Гарантия качества. Если не понравится — переделаем бесплатно.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Пользуюсь услугами CleanHome каждую неделю. Всегда приходят вовремя, убирают идеально!', authorName: 'Марина Зайцева', authorRole: 'Заказывает регулярную уборку', authorPhoto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'services-auto', name: 'Автосервис', category: 'services', thumbnail: '🚗',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'AutoPro', links: 'Услуги|Цены|О нас|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Бесплатная диагностика автомобиля', subtitle: 'Запишитесь на диагностику — выявим проблемы и рассчитаем стоимость ремонта.', buttonText: 'ЗАПИСАТЬСЯ НА ДИАГНОСТИКУ', buttonColor: '#dc2626' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Обращайтесь к нам, если:', iconColor: '#dc2626', items: ['Загорелся check engine или другие индикаторы', 'Появились странные звуки, вибрации, запахи', 'Пора пройти плановое ТО', 'Нужен кузовной ремонт или покраска', 'Хотите подготовить авто к продаже или сезону'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#fef2f2' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Почему выбирают нас:', accentColor: '#dc2626', items: [{ title: 'Честная диагностика', description: 'Покажем реальное состояние авто, без навязывания услуг' }, { title: 'Гарантия 1 год', description: 'На все виды работ и запчасти' }, { title: 'Оригинальные запчасти', description: 'Или качественные аналоги на выбор' }, { title: 'Прозрачные цены', description: 'Согласовываем стоимость до начала работ' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'counter', componentSettings: { num1: '10K+', label1: 'Клиентов', num2: '15', label2: 'Лет опыта', num3: '1 год', label3: 'Гарантия' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишитесь на бесплатную диагностику', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'brand', label: 'Марка авто', options: ['Toyota', 'Kia/Hyundai', 'Volkswagen/Skoda', 'BMW/Mercedes', 'Другое'] }, { type: 'select', name: 'service', label: 'Что беспокоит', options: ['Двигатель', 'Ходовая', 'Электрика', 'Кузов', 'Плановое ТО', 'Диагностика'] }], buttonText: 'ЗАПИСАТЬСЯ', buttonColor: '#dc2626' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Доверьте свой автомобиль профессионалам', description: 'Бесплатная диагностика. Гарантия на все работы. Запчасти в наличии.', buttonText: 'ЗАПИСАТЬСЯ НА СЕРВИС', buttonColor: '#dc2626', guaranteeText: 'Работаем без выходных. Есть зона ожидания с кофе и Wi-Fi.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1625047509248-ec889c3a4bba?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Честный сервис! Не навязывают лишнего, делают качественно. Езжу только к ним уже 3 года.', authorName: 'Павел Григорьев', authorRole: 'Владелец BMW X5', authorPhoto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },

    // === МЕРОПРИЯТИЯ ===
    {
        id: 'events-conference', name: 'Конференция', category: 'events', thumbnail: '🎪',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'TechConf 2026', links: 'Программа|Спикеры|Билеты|FAQ' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(124,58,237,0.85), rgba(124,58,237,0.9)), url(https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'TechConf 2026 — главная IT-конференция года', subtitle: '15-16 марта, Москва. Забронируйте билет со скидкой Early Bird до 1 февраля.', buttonText: 'КУПИТЬ БИЛЕТ СО СКИДКОЙ', buttonColor: '#7c3aed' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Конференция для тех, кто:', iconColor: '#7c3aed', items: ['Хочет узнать о последних трендах в AI, DevOps, Product', 'Ищет нетворкинг с лидерами индустрии', 'Хочет прокачать навыки на мастер-классах', 'Ищет работу или сотрудников в IT-компаниях', 'Хочет вдохновиться историями успеха'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#faf5ff' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Что вас ждёт:', accentColor: '#7c3aed', items: [{ title: '50+ спикеров', description: 'Эксперты из Яндекса, Сбера, Google, Meta' }, { title: '3 потока', description: 'AI & ML, DevOps & Infrastructure, Product & Design' }, { title: 'Воркшопы', description: 'Практические мастер-классы в малых группах' }, { title: 'Афтепати', description: 'Неформальный нетворкинг после первого дня' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'counter', componentSettings: { num1: '2', label1: 'Дня', num2: '50+', label2: 'Спикеров', num3: '2000', label3: 'Участников' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Забронируйте билет со скидкой Early Bird', subtitle: 'Скидка 30% до 1 февраля', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'email', name: 'email', label: 'Email', required: true }, { type: 'select', name: 'ticket', label: 'Тип билета', options: ['Standard (1 день)', 'Pro (2 дня + воркшопы)', 'VIP (все + афтепати)'] }], buttonText: 'КУПИТЬ БИЛЕТ', buttonColor: '#7c3aed' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Не упустите главное IT-событие года', description: 'Early Bird скидка 30% до 1 февраля. Количество мест ограничено.', buttonText: 'ЗАБРОНИРОВАТЬ МЕСТО', buttonColor: '#7c3aed', guaranteeText: 'Возврат 100% при отмене за 14 дней.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'TechConf — обязательное событие для всех, кто в IT. Потрясающие спикеры и нетворкинг!', authorName: 'Виктор Романов', authorRole: 'CTO, Технологии будущего', authorPhoto: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'events-wedding', name: 'Свадебное агентство', category: 'events', thumbnail: '💒',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Wedding Day', links: 'Услуги|Портфолио|Отзывы|Контакты' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.5)), url(https://images.unsplash.com/photo-1519741497674-611481863552?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Свадьба вашей мечты — без стресса', subtitle: 'Бесплатная консультация организатора. Обсудим концепцию и бюджет вашего торжества.', buttonText: 'ОБСУДИТЬ СВАДЬБУ', buttonColor: '#be185d' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Мы для вас, если вы:', iconColor: '#be185d', items: ['Хотите идеальную свадьбу, но нет времени на организацию', 'Боитесь что-то забыть или упустить важные детали', 'Хотите уникальную концепцию, а не шаблонное мероприятие', 'Нужен координатор в день свадьбы, чтобы вы наслаждались праздником', 'Хотите уложиться в бюджет без потери качества'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#fdf2f8' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Что мы сделаем:', accentColor: '#be185d', items: [{ title: 'Разработаем концепцию', description: 'От стиля до мельчайших деталей декора' }, { title: 'Подберём подрядчиков', description: 'Площадка, кейтеринг, фото, музыка — проверенные партнёры' }, { title: 'Возьмём на себя логистику', description: 'Тайминг, транспорт, размещение гостей' }, { title: 'Координируем день X', description: 'Вы просто наслаждаетесь, мы решаем вопросы' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'counter', componentSettings: { num1: '500+', label1: 'Свадеб', num2: '14', label2: 'Лет опыта', num3: '100%', label3: 'Счастливых пар' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Запишитесь на бесплатную консультацию', fields: [{ type: 'text', name: 'name', label: 'Ваши имена', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'date', label: 'Планируемая дата', options: ['Весна 2026', 'Лето 2026', 'Осень 2026', 'Зима 2026-2027', 'Ещё не определились'] }, { type: 'select', name: 'guests', label: 'Количество гостей', options: ['До 30', '30-50', '50-100', '100-150', 'Более 150'] }], buttonText: 'ОБСУДИТЬ СВАДЬБУ', buttonColor: '#be185d' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Создадим вашу идеальную свадьбу', description: 'Консультация бесплатна. Работаем с любым бюджетом.', buttonText: 'ЗАПИСАТЬСЯ НА ВСТРЕЧУ', buttonColor: '#be185d', guaranteeText: 'Организуем свадьбы с 2010 года. 100% пар рекомендуют нас друзьям.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Wedding Day сделали нашу свадьбу идеальной! Всё прошло без единой заминки. Спасибо!', authorName: 'Кристина и Александр', authorRole: 'Поженились в июне 2025', authorPhoto: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'events-party', name: 'Организация праздников', category: 'events', thumbnail: '🎉',
        elements: [
            { type: 'navbar', componentSettings: { logo: 'Party Time', links: 'Услуги|Портфолио|Артисты|Заказать' } },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(234,179,8,0.85), rgba(234,179,8,0.9)), url(https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Организуем праздник, который запомнится', subtitle: 'Бесплатный расчёт стоимости за 5 минут. Детские праздники, корпоративы, юбилеи.', buttonText: 'РАССЧИТАТЬ СТОИМОСТЬ', buttonColor: '#eab308' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'checklist', componentSettings: { title: 'Закажите праздник, если:', iconColor: '#eab308', items: ['Нужен детский день рождения с аниматорами и шоу', 'Планируете корпоратив или тимбилдинг для команды', 'Готовите юбилей для близкого человека', 'Хотите удивить гостей необычной программой', 'Нет времени на организацию самостоятельно'] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px', backgroundColor: '#fefce8' }, children: [
                { type: 'benefitsList', componentSettings: { title: 'Что мы организуем:', accentColor: '#eab308', items: [{ title: 'Детские праздники', description: 'Аниматоры, квесты, шоу мыльных пузырей, научное шоу' }, { title: 'Корпоративы', description: 'Тимбилдинг, банкеты, новогодние вечеринки' }, { title: 'Частные события', description: 'Юбилеи, дни рождения, годовщины' }, { title: 'Шоу-программы', description: 'Ведущие, музыканты, фокусники, танцоры' }] } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'leadForm', componentSettings: { title: 'Рассчитайте стоимость праздника', fields: [{ type: 'text', name: 'name', label: 'Имя', required: true }, { type: 'tel', name: 'phone', label: 'Телефон', required: true }, { type: 'select', name: 'type', label: 'Тип мероприятия', options: ['Детский день рождения', 'Корпоратив', 'Юбилей', 'Другое'] }, { type: 'select', name: 'guests', label: 'Количество гостей', options: ['До 10', '10-30', '30-50', '50-100', 'Более 100'] }], buttonText: 'РАССЧИТАТЬ', buttonColor: '#eab308' } }
            ]},
            { type: 'section', styles: { padding: '80px 20px' }, children: [
                { type: 'guarantee', componentSettings: { title: 'Сделаем ваш праздник незабываемым', description: 'Расчёт бесплатный. Работаем по всей Москве и области.', buttonText: 'ЗАКАЗАТЬ ПРАЗДНИК', buttonColor: '#eab308', guaranteeText: 'Более 1000 проведённых мероприятий. Довольные клиенты возвращаются.' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1496843916299-590492c751f4?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'section', styles: { padding: '60px 20px', backgroundColor: '#f8fafc' }, children: [
                { type: 'heading', content: 'Отзыв клиента', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'testimonial', componentSettings: { quote: 'Организовали сыну незабываемый день рождения! Дети были в восторге от шоу. Обязательно обратимся снова!', authorName: 'Светлана Миронова', authorRole: 'Мама именинника', authorPhoto: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150' } }
            ]},
            { type: 'footer' }
        ]
    },

    // Legacy templates for compatibility
    {
        id: 'portfolio', name: 'Портфолио', category: 'personal', thumbnail: '🎨',
        elements: [
            { type: 'navbar' },
            { type: 'hero', styles: { backgroundImage: 'linear-gradient(rgba(99,102,241,0.8), rgba(99,102,241,0.85)), url(https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' }, componentSettings: { title: 'Дизайнер-фрилансер', subtitle: 'Создаю визуальные истории для брендов', buttonText: 'Смотреть работы', buttonColor: '#6366f1' } },
            { type: 'section', styles: { padding: '80px 20px' }, children: [{ type: 'features' }] },
            { type: 'section', styles: { padding: '60px 20px' }, children: [
                { type: 'heading', content: 'Фотогалерея', styles: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#1e293b' } },
                { type: 'gallery', content: `<img src="https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1558655146-d09347e92766?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;"><img src="https://images.unsplash.com/photo-1545235617-9465d2a55698?w=800" alt="" style="border-radius:8px;width:100%;height:250px;object-fit:cover;">`, styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } }
            ]},
            { type: 'footer' }
        ]
    },
    {
        id: 'business-card', name: 'Визитка', category: 'basic', thumbnail: '📇',
        elements: [
            {
                type: 'section',
                styles: { padding: '100px 20px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundImage: 'linear-gradient(rgba(30,41,59,0.9), rgba(30,41,59,0.95)), url(https://images.unsplash.com/photo-1557683316-973673baf926?w=1600)', backgroundSize: 'cover', backgroundPosition: 'center' },
                children: [
                    { type: 'heading', content: 'Иван Иванов', styles: { fontSize: '48px' } },
                    { type: 'text', content: 'Веб-разработчик', styles: { fontSize: '24px', color: '#64748b' } },
                    { type: 'social' },
                    { type: 'button', content: 'Связаться', styles: { marginTop: '20px' } }
                ]
            }
        ]
    }
];

// ===== Color Schemes =====
const colorSchemes = [
    { name: 'Modern Blue', primary: '#3b82f6', secondary: '#1e40af', accent: '#60a5fa', bg: '#f8fafc', text: '#1e293b' },
    { name: 'Forest Green', primary: '#10b981', secondary: '#047857', accent: '#34d399', bg: '#f0fdf4', text: '#064e3b' },
    { name: 'Royal Purple', primary: '#8b5cf6', secondary: '#6d28d9', accent: '#a78bfa', bg: '#faf5ff', text: '#4c1d95' },
    { name: 'Sunset Orange', primary: '#f97316', secondary: '#ea580c', accent: '#fb923c', bg: '#fff7ed', text: '#9a3412' },
    { name: 'Rose Pink', primary: '#f43f5e', secondary: '#e11d48', accent: '#fb7185', bg: '#fff1f2', text: '#881337' },
    { name: 'Ocean Teal', primary: '#14b8a6', secondary: '#0d9488', accent: '#2dd4bf', bg: '#f0fdfa', text: '#134e4a' },
    { name: 'Midnight', primary: '#6366f1', secondary: '#4f46e5', accent: '#818cf8', bg: '#eef2ff', text: '#312e81' },
    { name: 'Coral', primary: '#ff6b6b', secondary: '#ee5a5a', accent: '#ff8787', bg: '#fff5f5', text: '#c92a2a' },
    { name: 'Emerald', primary: '#059669', secondary: '#047857', accent: '#10b981', bg: '#ecfdf5', text: '#065f46' },
    { name: 'Amber', primary: '#f59e0b', secondary: '#d97706', accent: '#fbbf24', bg: '#fffbeb', text: '#92400e' },
    { name: 'Sky', primary: '#0ea5e9', secondary: '#0284c7', accent: '#38bdf8', bg: '#f0f9ff', text: '#075985' },
    { name: 'Slate', primary: '#64748b', secondary: '#475569', accent: '#94a3b8', bg: '#f8fafc', text: '#1e293b' }
];

// ===== Button Presets =====
const buttonPresets = {
    'button-primary': {
        label: 'Основная',
        styles: { display: 'inline-block', padding: '12px 24px', backgroundColor: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '500' }
    },
    'button-secondary': {
        label: 'Вторичная',
        styles: { display: 'inline-block', padding: '12px 24px', backgroundColor: '#e2e8f0', color: '#1e293b', textDecoration: 'none', borderRadius: '8px', fontWeight: '500' }
    },
    'button-outline': {
        label: 'Контурная',
        styles: { display: 'inline-block', padding: '10px 22px', backgroundColor: 'transparent', color: '#3b82f6', textDecoration: 'none', borderRadius: '8px', fontWeight: '500', border: '2px solid #3b82f6' }
    },
    'button-ghost': {
        label: 'Прозрачная',
        styles: { display: 'inline-block', padding: '12px 24px', backgroundColor: 'transparent', color: '#3b82f6', textDecoration: 'none', borderRadius: '8px', fontWeight: '500' }
    },
    'button-rounded': {
        label: 'Округлая',
        styles: { display: 'inline-block', padding: '12px 32px', backgroundColor: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: '50px', fontWeight: '500' }
    },
    'button-gradient': {
        label: 'Градиент',
        styles: { display: 'inline-block', padding: '12px 24px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '500' }
    }
};

// Collect all fonts used in elements
function collectUsedFonts(elements = state.elements) {
    const fonts = new Set();
    function traverse(els) {
        for (const el of els) {
            if (el.styles?.fontFamily) {
                const fontName = el.styles.fontFamily.replace(/['"]/g, '').split(',')[0].trim();
                if (googleFonts.find(f => f.name === fontName)) {
                    fonts.add(fontName);
                }
            }
            if (el.children?.length) traverse(el.children);
        }
    }
    traverse(elements);
    return Array.from(fonts);
}

// ===== Block Templates =====
const blockTemplates = {
    // Structure
    section: {
        tag: 'section',
        label: 'Секция',
        icon: 'fa-square',
        content: '',
        isContainer: true,
        defaultStyles: { display: 'flex', flexDirection: 'column', padding: '60px 20px', minHeight: '200px', gap: '20px' }
    },
    container: {
        tag: 'div',
        label: 'Контейнер',
        icon: 'fa-box',
        content: '',
        isContainer: true,
        defaultStyles: { display: 'flex', flexDirection: 'column', maxWidth: '1200px', margin: '0 auto', padding: '20px', gap: '20px' }
    },
    row: {
        tag: 'div',
        label: 'Строка',
        icon: 'fa-columns',
        content: '',
        isContainer: true,
        defaultStyles: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '20px' }
    },
    column: {
        tag: 'div',
        label: 'Колонка',
        icon: 'fa-grip-lines-vertical',
        content: '',
        isContainer: true,
        defaultStyles: { display: 'flex', flexDirection: 'column', flex: '1', minWidth: '250px', padding: '10px', gap: '20px' }
    },

    // Basic
    heading: {
        tag: 'h2',
        label: 'Заголовок',
        icon: 'fa-heading',
        content: 'Заголовок',
        defaultStyles: { fontSize: '32px', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b' }
    },
    text: {
        tag: 'p',
        label: 'Текст',
        icon: 'fa-align-left',
        content: 'Здесь будет ваш текст. Кликните, чтобы редактировать.',
        defaultStyles: { fontSize: '16px', lineHeight: '1.6', color: '#475569', marginBottom: '20px' }
    },
    image: {
        tag: 'img',
        label: 'Изображение',
        icon: 'fa-image',
        content: '',
        attrs: { src: 'https://via.placeholder.com/800x400', alt: 'Изображение' },
        defaultStyles: { maxWidth: '100%', width: '100%', height: 'auto', borderRadius: '8px', marginBottom: '20px', boxSizing: 'border-box' }
    },
    button: {
        tag: 'a',
        label: 'Кнопка',
        icon: 'fa-hand-pointer',
        content: 'Кнопка',
        attrs: { href: '#' },
        defaultStyles: {
            display: 'inline-block', padding: '12px 24px', backgroundColor: '#3b82f6',
            color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '500', marginBottom: '20px'
        }
    },
    link: {
        tag: 'a',
        label: 'Ссылка',
        icon: 'fa-link',
        content: 'Ссылка',
        attrs: { href: '#' },
        defaultStyles: { color: '#3b82f6', textDecoration: 'underline', marginBottom: '20px', display: 'inline-block' }
    },
    list: {
        tag: 'ul',
        label: 'Список',
        icon: 'fa-list',
        content: '<li>Пункт 1</li><li>Пункт 2</li><li>Пункт 3</li>',
        defaultStyles: { paddingLeft: '20px', color: '#475569', marginBottom: '20px' }
    },
    divider: {
        tag: 'hr',
        label: 'Разделитель',
        icon: 'fa-minus',
        content: '',
        defaultStyles: { border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }
    },
    spacer: {
        tag: 'div',
        label: 'Отступ',
        icon: 'fa-arrows-alt-v',
        content: '',
        defaultStyles: { height: '40px' }
    },

    // Media
    video: {
        tag: 'div',
        label: 'Видео',
        icon: 'fa-video',
        content: '<iframe width="100%" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allowfullscreen></iframe>',
        defaultStyles: { aspectRatio: '16/9' }
    },
    gallery: {
        tag: 'div',
        label: 'Галерея',
        icon: 'fa-images',
        content: `<img src="https://via.placeholder.com/300x200" alt="1"><img src="https://via.placeholder.com/300x200" alt="2"><img src="https://via.placeholder.com/300x200" alt="3">`,
        defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }
    },
    carousel: {
        tag: 'div',
        label: 'Карусель',
        icon: 'fa-film',
        content: `<div style="display:flex;overflow-x:auto;gap:10px;scroll-snap-type:x mandatory;"><img src="https://via.placeholder.com/400x300" style="scroll-snap-align:start;flex-shrink:0;"><img src="https://via.placeholder.com/400x300" style="scroll-snap-align:start;flex-shrink:0;"><img src="https://via.placeholder.com/400x300" style="scroll-snap-align:start;flex-shrink:0;"></div>`,
        defaultStyles: {}
    },
    icon: {
        tag: 'i',
        label: 'Иконка',
        icon: 'fa-star',
        content: '',
        attrs: { class: 'fas fa-star' },
        defaultStyles: { fontSize: '48px', color: '#3b82f6' }
    },

    // Interactive
    form: {
        tag: 'form',
        label: 'Форма',
        icon: 'fa-envelope',
        content: `<input type="text" name="name" placeholder="Ваше имя" required style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;"><input type="email" name="email" placeholder="Email" required style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;"><button type="submit" style="width:100%;padding:12px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;">Отправить</button>`,
        defaultStyles: { maxWidth: '400px' },
        formSettings: {
            fields: { name: true, email: true, phone: false, message: false },
            buttonText: 'Отправить',
            buttonColor: '#3b82f6',
            successMessage: 'Спасибо! Ваша заявка отправлена.',
            webhook: '',
            notifyEmail: '',
            saveToBackend: true
        }
    },
    accordion: {
        tag: 'div',
        label: 'Аккордеон',
        icon: 'fa-chevron-down',
        content: `<details style="border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;"><summary style="padding:12px;cursor:pointer;font-weight:500;">Вопрос 1</summary><p style="padding:12px;border-top:1px solid #e2e8f0;">Ответ на вопрос 1</p></details><details style="border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;"><summary style="padding:12px;cursor:pointer;font-weight:500;">Вопрос 2</summary><p style="padding:12px;border-top:1px solid #e2e8f0;">Ответ на вопрос 2</p></details>`,
        defaultStyles: {}
    },
    tabs: {
        tag: 'div',
        label: 'Табы',
        icon: 'fa-folder',
        content: `<div style="display:flex;border-bottom:1px solid #e2e8f0;"><button style="padding:12px 24px;border:none;background:#3b82f6;color:white;cursor:pointer;">Таб 1</button><button style="padding:12px 24px;border:none;background:#f1f5f9;cursor:pointer;">Таб 2</button></div><div style="padding:20px;border:1px solid #e2e8f0;border-top:none;">Содержимое таба 1</div>`,
        defaultStyles: {}
    },
    modal: {
        tag: 'div',
        label: 'Модальное окно',
        icon: 'fa-window-restore',
        content: `<button onclick="this.nextElementSibling.style.display='flex'" style="padding:12px 24px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;">Открыть окно</button><div style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;z-index:1000;"><div style="background:white;padding:30px;border-radius:12px;max-width:500px;"><h3 style="margin-bottom:16px;">Заголовок окна</h3><p>Содержимое модального окна</p><button onclick="this.parentElement.parentElement.style.display='none'" style="margin-top:20px;padding:8px 16px;background:#e2e8f0;border:none;border-radius:6px;cursor:pointer;">Закрыть</button></div></div>`,
        defaultStyles: {}
    },
    timer: {
        tag: 'div',
        label: 'Таймер',
        icon: 'fa-clock',
        content: `<div style="display:flex;gap:20px;justify-content:center;"><div style="text-align:center;"><span style="font-size:48px;font-weight:bold;">00</span><br>Дней</div><div style="text-align:center;"><span style="font-size:48px;font-weight:bold;">12</span><br>Часов</div><div style="text-align:center;"><span style="font-size:48px;font-weight:bold;">30</span><br>Минут</div><div style="text-align:center;"><span style="font-size:48px;font-weight:bold;">45</span><br>Секунд</div></div>`,
        defaultStyles: { padding: '20px' }
    },

    // Components
    navbar: {
        tag: 'nav',
        label: 'Навигация',
        icon: 'fa-bars',
        content: `<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 0;"><a href="#" style="font-size:24px;font-weight:bold;color:#1e293b;text-decoration:none;">Logo</a><div style="display:flex;gap:24px;"><a href="#" style="color:#475569;text-decoration:none;">Главная</a><a href="#" style="color:#475569;text-decoration:none;">О нас</a><a href="#" style="color:#475569;text-decoration:none;">Услуги</a><a href="#" style="color:#475569;text-decoration:none;">Контакты</a></div></div>`,
        defaultStyles: { backgroundColor: 'white', padding: '0 20px', borderBottom: '1px solid #e2e8f0' }
    },
    hero: {
        tag: 'section',
        label: 'Hero',
        icon: 'fa-flag',
        content: '',
        defaultStyles: { padding: '100px 20px', backgroundColor: '#f8fafc' },
        componentSettings: {
            title: 'Заголовок Hero секции',
            subtitle: 'Подзаголовок с описанием вашего продукта или услуги',
            buttonText: 'Начать',
            buttonUrl: '#',
            buttonColor: '#3b82f6',
            alignment: 'center'
        }
    },
    features: {
        tag: 'div',
        label: 'Преимущества',
        icon: 'fa-th-large',
        content: '',
        defaultStyles: { padding: '40px 20px' },
        componentSettings: {
            columns: 3,
            items: [
                { icon: '🚀', title: 'Быстро', description: 'Описание преимущества' },
                { icon: '💡', title: 'Удобно', description: 'Описание преимущества' },
                { icon: '✨', title: 'Качественно', description: 'Описание преимущества' }
            ]
        }
    },
    card: {
        tag: 'div',
        label: 'Карточка',
        icon: 'fa-id-card',
        content: '',
        defaultStyles: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden', maxWidth: '350px' },
        componentSettings: {
            image: 'https://via.placeholder.com/400x200',
            title: 'Заголовок карточки',
            description: 'Описание карточки',
            linkText: 'Подробнее →',
            linkUrl: '#'
        }
    },
    testimonial: {
        tag: 'div',
        label: 'Отзыв',
        icon: 'fa-quote-left',
        content: '',
        defaultStyles: {},
        componentSettings: {
            quote: 'Отличный продукт! Рекомендую всем.',
            authorName: 'Имя Фамилия',
            authorRole: 'Должность',
            authorPhoto: 'https://via.placeholder.com/48'
        }
    },
    pricing: {
        tag: 'div',
        label: 'Цена',
        icon: 'fa-tag',
        content: '',
        defaultStyles: { maxWidth: '300px' },
        componentSettings: {
            planName: 'Базовый',
            price: '29',
            currency: '$',
            period: '/мес',
            features: ['Функция 1', 'Функция 2', 'Функция 3'],
            buttonText: 'Выбрать',
            buttonUrl: '#',
            buttonColor: '#3b82f6',
            highlighted: false
        }
    },
    counter: {
        tag: 'div',
        label: 'Счётчик',
        icon: 'fa-sort-numeric-up',
        content: '',
        defaultStyles: { padding: '40px 20px' },
        componentSettings: {
            items: [
                { value: '500+', label: 'Клиентов' },
                { value: '10', label: 'Лет опыта' },
                { value: '99%', label: 'Довольных' }
            ],
            color: '#3b82f6'
        }
    },
    progress: {
        tag: 'div',
        label: 'Прогресс',
        icon: 'fa-tasks',
        content: `<div style="margin-bottom:16px;"><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>HTML/CSS</span><span>90%</span></div><div style="height:8px;background:#e2e8f0;border-radius:4px;"><div style="width:90%;height:100%;background:#3b82f6;border-radius:4px;"></div></div></div><div style="margin-bottom:16px;"><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>JavaScript</span><span>75%</span></div><div style="height:8px;background:#e2e8f0;border-radius:4px;"><div style="width:75%;height:100%;background:#3b82f6;border-radius:4px;"></div></div></div>`,
        defaultStyles: { padding: '20px' }
    },
    social: {
        tag: 'div',
        label: 'Соцсети',
        icon: 'fa-share-alt',
        content: `<div style="display:flex;gap:16px;justify-content:center;"><a href="#" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#1877f2;color:white;border-radius:50%;text-decoration:none;"><i class="fab fa-facebook-f"></i></a><a href="#" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#1da1f2;color:white;border-radius:50%;text-decoration:none;"><i class="fab fa-twitter"></i></a><a href="#" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#e4405f;color:white;border-radius:50%;text-decoration:none;"><i class="fab fa-instagram"></i></a><a href="#" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#0088cc;color:white;border-radius:50%;text-decoration:none;"><i class="fab fa-telegram-plane"></i></a></div>`,
        defaultStyles: {}
    },
    map: {
        tag: 'div',
        label: 'Карта',
        icon: 'fa-map-marker-alt',
        content: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2245.3!2d37.6!3d55.75!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTXCsDQ1JzAwLjAiTiAzN8KwMzYnMDAuMCJF!5e0!3m2!1sru!2sru!4v1234567890" width="100%" height="300" style="border:0;border-radius:8px;" allowfullscreen></iframe>',
        defaultStyles: {}
    },
    table: {
        tag: 'table',
        label: 'Таблица',
        icon: 'fa-table',
        content: `<thead><tr><th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Заголовок 1</th><th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Заголовок 2</th><th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Заголовок 3</th></tr></thead><tbody><tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Ячейка 1</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Ячейка 2</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Ячейка 3</td></tr><tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Ячейка 4</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Ячейка 5</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Ячейка 6</td></tr></tbody>`,
        defaultStyles: { width: '100%', borderCollapse: 'collapse' }
    },
    footer: {
        tag: 'footer',
        label: 'Футер',
        icon: 'fa-shoe-prints',
        content: `<div style="display:flex;justify-content:space-between;padding:40px 20px;flex-wrap:wrap;gap:40px;"><div><h4 style="font-size:18px;margin-bottom:16px;">Компания</h4><p style="color:#94a3b8;">© 2024 Все права защищены</p></div><div><h4 style="font-size:18px;margin-bottom:16px;">Контакты</h4><p style="color:#94a3b8;">email@example.com<br>+7 (999) 123-45-67</p></div></div>`,
        defaultStyles: { backgroundColor: '#1e293b', color: 'white' }
    },

    // ===== Landing Page Specific Blocks =====

    // Checklist block - "Это для вас, если..."
    checklist: {
        tag: 'div',
        label: 'Чек-лист',
        icon: 'fa-check-circle',
        content: '',
        defaultStyles: { padding: '40px 20px' },
        componentSettings: {
            title: 'Это для вас, если вы:',
            items: [
                'Хотите увеличить свой доход',
                'Ищете проверенное решение',
                'Готовы к изменениям'
            ],
            iconColor: '#10b981'
        }
    },

    // Benefits list - numbered benefits
    benefitsList: {
        tag: 'div',
        label: 'Список выгод',
        icon: 'fa-list-ol',
        content: '',
        defaultStyles: { padding: '40px 20px' },
        componentSettings: {
            title: 'Что вы получите:',
            items: [
                { title: 'Персональный план', description: 'Разберем ваши цели и составим пошаговый план' },
                { title: 'Экспертная консультация', description: 'Ответим на все вопросы' },
                { title: 'Бонусные материалы', description: 'Получите доступ к эксклюзивному контенту' }
            ],
            accentColor: '#3b82f6'
        }
    },

    // Gift/Bonus block
    giftBlock: {
        tag: 'div',
        label: 'Подарок',
        icon: 'fa-gift',
        content: '',
        defaultStyles: { padding: '60px 20px', backgroundColor: '#fef3c7', borderRadius: '16px' },
        componentSettings: {
            title: 'Ваш подарок за заявку',
            subtitle: 'Бесплатно при записи на консультацию',
            description: 'Получите эксклюзивный доступ к обучающим материалам стоимостью 10 000₽',
            items: ['Видеокурс по основам', 'Чек-листы и шаблоны', 'Доступ в закрытый чат'],
            buttonText: 'Получить подарок',
            buttonColor: '#f59e0b'
        }
    },

    // Guarantee block with CTA
    guarantee: {
        tag: 'div',
        label: 'Гарантия + CTA',
        icon: 'fa-shield-alt',
        content: '',
        defaultStyles: { padding: '60px 20px', textAlign: 'center' },
        componentSettings: {
            title: 'Не откладывайте своё развитие',
            description: 'Консультация бесплатна. Мы поможем выбрать оптимальное решение для ваших целей.',
            buttonText: 'Записаться на консультацию',
            buttonColor: '#3b82f6',
            guaranteeText: 'Ваши данные конфиденциальны. Мы свяжемся с вами в течение 24 часов.'
        }
    },

    // Enhanced lead form with dropdowns
    leadForm: {
        tag: 'form',
        label: 'Форма заявки',
        icon: 'fa-clipboard-list',
        content: '',
        defaultStyles: { maxWidth: '500px', margin: '0 auto', padding: '40px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' },
        componentSettings: {
            title: 'Заполните форму для записи',
            subtitle: 'Мы свяжемся с вами в течение 24 часов',
            fields: [
                { type: 'text', name: 'name', label: 'Ваше имя', placeholder: 'Введите имя', required: true },
                { type: 'tel', name: 'phone', label: 'Телефон', placeholder: '+7 (___) ___-__-__', required: true },
                { type: 'email', name: 'email', label: 'Email', placeholder: 'email@example.com', required: true },
                { type: 'select', name: 'experience', label: 'Ваш опыт', options: ['Начинающий', 'Средний уровень', 'Продвинутый'], required: false },
                { type: 'select', name: 'interest', label: 'Что интересует', options: ['Консультация', 'Обучение', 'Другое'], required: false }
            ],
            buttonText: 'Отправить заявку',
            buttonColor: '#3b82f6',
            privacyText: 'Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности'
        }
    },

    // ===== New Feature Blocks =====

    // Modal Form - trigger button + modal with form fields
    modalForm: {
        tag: 'div',
        label: 'Модальная форма',
        icon: 'fa-window-maximize',
        content: '',
        defaultStyles: {},
        componentSettings: {
            modalId: 'modal_form_1',
            buttonText: 'Оставить заявку',
            buttonColor: '#3b82f6',
            title: 'Оставьте заявку',
            subtitle: 'Мы свяжемся с вами в ближайшее время',
            fields: [
                { type: 'text', name: 'name', label: 'Ваше имя', placeholder: 'Введите имя', required: true },
                { type: 'tel', name: 'phone', label: 'Телефон', placeholder: '+7 (___) ___-__-__', required: true },
                { type: 'email', name: 'email', label: 'Email', placeholder: 'email@example.com', required: false }
            ],
            submitText: 'Отправить',
            successMessage: 'Спасибо! Мы свяжемся с вами.'
        }
    },

    // Program/Course Modules
    program: {
        tag: 'div',
        label: 'Программа курса',
        icon: 'fa-graduation-cap',
        content: '',
        defaultStyles: { padding: '40px 20px' },
        componentSettings: {
            title: 'Программа курса',
            modules: [
                { title: 'Модуль 1. Введение', items: ['Обзор курса', 'Основные понятия', 'Инструменты'] },
                { title: 'Модуль 2. Основы', items: ['Теоретическая база', 'Первая практика', 'Домашнее задание'] },
                { title: 'Модуль 3. Продвинутый уровень', items: ['Сложные кейсы', 'Работа с клиентами', 'Итоговый проект'] }
            ],
            accentColor: '#3b82f6'
        }
    },

    // Speaker/Author
    speaker: {
        tag: 'div',
        label: 'Спикер',
        icon: 'fa-user-tie',
        content: '',
        defaultStyles: { padding: '40px 20px' },
        componentSettings: {
            name: 'Имя Фамилия',
            role: 'Эксперт в своей области',
            photo: 'https://via.placeholder.com/300x300',
            bio: [
                '10 лет опыта в индустрии',
                'Автор 3-х книг-бестселлеров',
                'Спикер международных конференций',
                'Основатель собственной школы'
            ],
            socialTelegram: '',
            socialInstagram: '',
            socialYoutube: '',
            socialLinkedin: '',
            accentColor: '#3b82f6'
        }
    },

    // Analytics Block
    analytics: {
        tag: 'div',
        label: 'Аналитика',
        icon: 'fa-chart-bar',
        content: '<div style="padding:20px;background:#f0fdf4;border:1px dashed #10b981;text-align:center;color:#059669;border-radius:8px;"><i class="fas fa-chart-bar" style="font-size:24px;margin-bottom:8px;display:block;"></i>Блок аналитики (скрыт на сайте)</div>',
        defaultStyles: {},
        componentSettings: {
            yandexMetrikaId: '',
            googleAnalyticsId: '',
            facebookPixelId: '',
            vkPixelId: ''
        }
    },

    // Legal Footer
    legalFooter: {
        tag: 'footer',
        label: 'Юр. подвал',
        icon: 'fa-balance-scale',
        content: '',
        defaultStyles: { backgroundColor: '#1e293b', color: '#94a3b8', padding: '40px 20px', fontSize: '14px' },
        componentSettings: {
            companyName: 'ООО «Компания»',
            inn: '',
            ogrn: '',
            offerUrl: '',
            privacyUrl: '',
            email: 'info@example.com',
            phone: '+7 (999) 123-45-67',
            socialTelegram: '',
            socialVk: '',
            socialInstagram: '',
            socialYoutube: ''
        }
    },

    // Code
    html: {
        tag: 'div',
        label: 'HTML',
        icon: 'fa-html5',
        content: '<div style="padding:20px;background:#f1f5f9;border:1px dashed #94a3b8;text-align:center;color:#64748b;">HTML блок</div>',
        defaultStyles: {}
    },
    css: {
        tag: 'style',
        label: 'CSS',
        icon: 'fa-css3-alt',
        content: '/* Ваши CSS стили */',
        defaultStyles: {}
    },
    js: {
        tag: 'script',
        label: 'JavaScript',
        icon: 'fa-js',
        content: '// Ваш JavaScript код',
        defaultStyles: {}
    },
    widget: {
        tag: 'div',
        label: 'Виджет',
        icon: 'fa-plug',
        content: '<div style="padding:20px;background:#fef3c7;border:1px dashed #f59e0b;text-align:center;color:#92400e;">Вставьте код виджета</div>',
        defaultStyles: {}
    },

    // ===== New Components (Stage 7) =====

    // Sticky Header - навигация с фиксацией при скролле
    stickyNavbar: {
        tag: 'nav',
        label: 'Sticky навигация',
        icon: 'fa-thumbtack',
        content: `<div style="display:flex;align-items:center;justify-content:space-between;max-width:1200px;margin:0 auto;padding:0 20px;">
            <a href="#" style="font-size:24px;font-weight:bold;color:#1e293b;text-decoration:none;">Logo</a>
            <div style="display:flex;gap:24px;align-items:center;">
                <a href="#" style="color:#475569;text-decoration:none;font-weight:500;">Главная</a>
                <a href="#" style="color:#475569;text-decoration:none;font-weight:500;">О нас</a>
                <a href="#" style="color:#475569;text-decoration:none;font-weight:500;">Услуги</a>
                <a href="#" style="color:#475569;text-decoration:none;font-weight:500;">Контакты</a>
                <a href="#" style="padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:6px;font-weight:500;">Заказать</a>
            </div>
        </div>`,
        defaultStyles: {
            position: 'sticky',
            top: '0',
            zIndex: '1000',
            backgroundColor: 'white',
            padding: '16px 0',
            borderBottom: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }
    },

    // Burger Menu - мобильное меню с анимацией
    burgerMenu: {
        tag: 'div',
        label: 'Бургер меню',
        icon: 'fa-bars',
        content: `<input type="checkbox" id="burger-toggle" style="display:none;">
            <label for="burger-toggle" class="burger-btn" style="display:flex;flex-direction:column;gap:5px;cursor:pointer;padding:10px;z-index:1001;position:relative;">
                <span style="display:block;width:25px;height:3px;background:#1e293b;border-radius:2px;transition:all 0.3s;"></span>
                <span style="display:block;width:25px;height:3px;background:#1e293b;border-radius:2px;transition:all 0.3s;"></span>
                <span style="display:block;width:25px;height:3px;background:#1e293b;border-radius:2px;transition:all 0.3s;"></span>
            </label>
            <nav class="burger-nav" style="position:fixed;top:0;right:-300px;width:300px;height:100vh;background:white;box-shadow:-2px 0 10px rgba(0,0,0,0.1);transition:right 0.3s;z-index:1000;padding:80px 30px 30px;">
                <a href="#" style="display:block;padding:15px 0;color:#1e293b;text-decoration:none;font-size:18px;border-bottom:1px solid #e2e8f0;">Главная</a>
                <a href="#" style="display:block;padding:15px 0;color:#1e293b;text-decoration:none;font-size:18px;border-bottom:1px solid #e2e8f0;">О нас</a>
                <a href="#" style="display:block;padding:15px 0;color:#1e293b;text-decoration:none;font-size:18px;border-bottom:1px solid #e2e8f0;">Услуги</a>
                <a href="#" style="display:block;padding:15px 0;color:#1e293b;text-decoration:none;font-size:18px;border-bottom:1px solid #e2e8f0;">Контакты</a>
            </nav>
            <style>
                #burger-toggle:checked ~ .burger-nav { right: 0 !important; }
                #burger-toggle:checked ~ .burger-btn span:nth-child(1) { transform: rotate(45deg) translate(5px, 6px); }
                #burger-toggle:checked ~ .burger-btn span:nth-child(2) { opacity: 0; }
                #burger-toggle:checked ~ .burger-btn span:nth-child(3) { transform: rotate(-45deg) translate(5px, -6px); }
            </style>`,
        defaultStyles: {
            display: 'none'
        },
        mobileStyles: {
            display: 'block'
        }
    },

    // Slider с стрелками
    slider: {
        tag: 'div',
        label: 'Слайдер',
        icon: 'fa-images',
        content: `<div class="slider-container" style="position:relative;overflow:hidden;border-radius:12px;">
            <div class="slider-track" style="display:flex;transition:transform 0.5s ease;">
                <div class="slide" style="min-width:100%;"><img src="https://via.placeholder.com/1200x500/3b82f6/ffffff?text=Слайд+1" style="width:100%;height:400px;object-fit:cover;"></div>
                <div class="slide" style="min-width:100%;"><img src="https://via.placeholder.com/1200x500/10b981/ffffff?text=Слайд+2" style="width:100%;height:400px;object-fit:cover;"></div>
                <div class="slide" style="min-width:100%;"><img src="https://via.placeholder.com/1200x500/f59e0b/ffffff?text=Слайд+3" style="width:100%;height:400px;object-fit:cover;"></div>
            </div>
            <button class="slider-prev" onclick="this.parentElement.querySelector('.slider-track').style.transform='translateX(-'+(Math.max(0,(parseInt(this.parentElement.querySelector('.slider-track').style.transform.replace(/[^0-9-]/g,'')||0)-100)))+'%)';" style="position:absolute;left:15px;top:50%;transform:translateY(-50%);width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.9);border:none;cursor:pointer;font-size:20px;box-shadow:0 2px 10px rgba(0,0,0,0.15);">❮</button>
            <button class="slider-next" onclick="this.parentElement.querySelector('.slider-track').style.transform='translateX(-'+(Math.min(200,(parseInt(this.parentElement.querySelector('.slider-track').style.transform.replace(/[^0-9-]/g,'')||0)+100)))+'%)';" style="position:absolute;right:15px;top:50%;transform:translateY(-50%);width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.9);border:none;cursor:pointer;font-size:20px;box-shadow:0 2px 10px rgba(0,0,0,0.15);">❯</button>
            <div class="slider-dots" style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:10px;">
                <span style="width:12px;height:12px;border-radius:50%;background:white;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>
                <span style="width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,0.5);cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>
                <span style="width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,0.5);cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>
            </div>
        </div>`,
        defaultStyles: {
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '20px'
        }
    },

    // Cookie Consent Banner
    cookieConsent: {
        tag: 'div',
        label: 'Cookie баннер',
        icon: 'fa-cookie-bite',
        content: `<div class="cookie-banner" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;max-width:1200px;margin:0 auto;padding:0 20px;">
            <div style="flex:1;min-width:300px;">
                <p style="margin:0;color:#1e293b;font-size:14px;">
                    <strong>🍪 Мы используем cookies</strong><br>
                    <span style="color:#64748b;">Продолжая использовать сайт, вы соглашаетесь с <a href="#" style="color:#3b82f6;">политикой конфиденциальности</a>.</span>
                </p>
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="this.closest('.cookie-banner').parentElement.style.display='none';localStorage.setItem('cookies-accepted','true');" style="padding:10px 24px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:500;">Принять</button>
                <button onclick="this.closest('.cookie-banner').parentElement.style.display='none';" style="padding:10px 24px;background:#e2e8f0;color:#475569;border:none;border-radius:6px;cursor:pointer;font-weight:500;">Отклонить</button>
            </div>
        </div>
        <script>if(localStorage.getItem('cookies-accepted')){document.currentScript.parentElement.style.display='none';}</script>`,
        defaultStyles: {
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            backgroundColor: 'white',
            padding: '20px 0',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
            zIndex: '9999',
            borderTop: '1px solid #e2e8f0'
        }
    },

    // Back to Top Button
    backToTop: {
        tag: 'div',
        label: 'Наверх',
        icon: 'fa-arrow-up',
        content: `<button onclick="window.scrollTo({top:0,behavior:'smooth'})" style="width:50px;height:50px;border-radius:50%;background:#3b82f6;color:white;border:none;cursor:pointer;font-size:20px;box-shadow:0 4px 15px rgba(59,130,246,0.4);transition:all 0.3s;">
            <i class="fas fa-arrow-up"></i>
        </button>
        <style>
            .back-to-top:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(59,130,246,0.5); }
        </style>`,
        defaultStyles: {
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: '999'
        }
    },

    // Floating Action Button
    fab: {
        tag: 'div',
        label: 'FAB кнопка',
        icon: 'fa-plus-circle',
        content: `<div class="fab-container">
            <button class="fab-main" onclick="this.parentElement.classList.toggle('open')" style="width:60px;height:60px;border-radius:50%;background:#3b82f6;color:white;border:none;cursor:pointer;font-size:24px;box-shadow:0 4px 15px rgba(59,130,246,0.4);transition:all 0.3s;z-index:2;position:relative;">
                <i class="fas fa-plus" style="transition:transform 0.3s;"></i>
            </button>
            <div class="fab-actions" style="position:absolute;bottom:70px;right:5px;display:flex;flex-direction:column;gap:10px;opacity:0;transform:translateY(20px);transition:all 0.3s;pointer-events:none;">
                <a href="tel:+79991234567" style="width:45px;height:45px;border-radius:50%;background:#10b981;color:white;display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,0.2);"><i class="fas fa-phone"></i></a>
                <a href="mailto:info@example.com" style="width:45px;height:45px;border-radius:50%;background:#f59e0b;color:white;display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,0.2);"><i class="fas fa-envelope"></i></a>
                <a href="#" style="width:45px;height:45px;border-radius:50%;background:#8b5cf6;color:white;display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,0.2);"><i class="fas fa-comment"></i></a>
            </div>
        </div>
        <style>
            .fab-container.open .fab-main i { transform: rotate(45deg); }
            .fab-container.open .fab-actions { opacity: 1; transform: translateY(0); pointer-events: all; }
        </style>`,
        defaultStyles: {
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: '999'
        }
    },

    // Animated Counter
    animatedCounter: {
        tag: 'div',
        label: 'Анимированный счётчик',
        icon: 'fa-sort-numeric-up-alt',
        content: `<div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:30px;text-align:center;">
            <div class="counter-item">
                <div class="counter-value" data-target="500" style="font-size:48px;font-weight:bold;color:#3b82f6;">0</div>
                <div style="color:#64748b;font-size:16px;margin-top:8px;">Клиентов</div>
            </div>
            <div class="counter-item">
                <div class="counter-value" data-target="150" style="font-size:48px;font-weight:bold;color:#3b82f6;">0</div>
                <div style="color:#64748b;font-size:16px;margin-top:8px;">Проектов</div>
            </div>
            <div class="counter-item">
                <div class="counter-value" data-target="10" style="font-size:48px;font-weight:bold;color:#3b82f6;">0</div>
                <div style="color:#64748b;font-size:16px;margin-top:8px;">Лет опыта</div>
            </div>
            <div class="counter-item">
                <div class="counter-value" data-target="99" style="font-size:48px;font-weight:bold;color:#3b82f6;">0</div>
                <div style="color:#64748b;font-size:16px;margin-top:8px;">% Довольных</div>
            </div>
        </div>
        <script>
        (function(){
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.querySelectorAll('.counter-value').forEach(counter => {
                            const target = parseInt(counter.dataset.target);
                            const duration = 2000;
                            const step = target / (duration / 16);
                            let current = 0;
                            const timer = setInterval(() => {
                                current += step;
                                if (current >= target) { current = target; clearInterval(timer); }
                                counter.textContent = Math.round(current) + (counter.dataset.suffix || '');
                            }, 16);
                        });
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });
            document.querySelectorAll('.counter-item').forEach(el => observer.observe(el.parentElement));
        })();
        </script>`,
        defaultStyles: {
            padding: '40px 20px'
        }
    },

    // Parallax Section
    parallaxSection: {
        tag: 'section',
        label: 'Параллакс секция',
        icon: 'fa-layer-group',
        content: '',
        defaultStyles: {
            backgroundImage: 'url(https://via.placeholder.com/1920x800/1e293b/1e293b)',
            backgroundAttachment: 'fixed',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            position: 'relative'
        },
        componentSettings: {
            title: 'Параллакс заголовок',
            subtitle: 'Красивый эффект параллакса при скролле страницы',
            buttonText: 'Подробнее',
            buttonUrl: '#',
            overlayColor: 'rgba(0,0,0,0.4)'
        }
    },

    // Marquee / Ticker
    marquee: {
        tag: 'div',
        label: 'Бегущая строка',
        icon: 'fa-text-width',
        content: '',
        defaultStyles: {
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '12px 0',
            fontSize: '16px',
            fontWeight: '500'
        },
        componentSettings: {
            items: ['🔥 Специальное предложение', '⭐ Скидка 20% на все услуги', '📞 Звоните: +7 (999) 123-45-67'],
            speed: 20
        }
    }
};

// ===== Utility Functions =====
function generateId() {
    return 'el_' + Math.random().toString(36).substr(2, 9);
}

function stylesToString(styles) {
    return Object.entries(styles || {}).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';');
}

function stringToStyles(str) {
    if (!str) return {};
    const styles = {};
    str.split(';').forEach(s => {
        const [k, v] = s.split(':').map(x => x?.trim());
        if (k && v) {
            styles[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
        }
    });
    return styles;
}

// Find element by ID in tree
function findElement(id, elements = state.elements) {
    for (const el of elements) {
        if (el.id === id) return el;
        if (el.children?.length) {
            const found = findElement(id, el.children);
            if (found) return found;
        }
    }
    return null;
}

// Find parent of element
function findParent(id, elements = state.elements, parent = null) {
    for (const el of elements) {
        if (el.id === id) return parent;
        if (el.children?.length) {
            const found = findParent(id, el.children, el);
            if (found !== undefined) return found;
        }
    }
    return undefined;
}

// Remove element from tree
function removeElement(id, elements = state.elements) {
    const index = elements.findIndex(e => e.id === id);
    if (index > -1) {
        elements.splice(index, 1);
        return true;
    }
    for (const el of elements) {
        if (el.children?.length && removeElement(id, el.children)) {
            return true;
        }
    }
    return false;
}

// ===== Element Management =====
function createElement(type) {
    const template = blockTemplates[type];
    if (!template) return null;

    const element = {
        id: generateId(),
        type,
        tag: template.tag,
        label: template.label,
        icon: template.icon,
        content: template.content,
        attrs: { ...template.attrs },
        styles: { ...template.defaultStyles },
        tabletStyles: {}, // Tablet overrides (max-width: 1024px)
        mobileStyles: {}, // Mobile overrides (max-width: 640px)
        isContainer: template.isContainer || false,
        children: [],
        hidden: false
    };

    // Add formSettings for form elements
    if (template.formSettings) {
        element.formSettings = JSON.parse(JSON.stringify(template.formSettings));
    }

    // Add componentSettings for configurable components
    if (template.componentSettings) {
        element.componentSettings = JSON.parse(JSON.stringify(template.componentSettings));
        // Generate initial content from settings
        element.content = generateComponentContent(type, element.componentSettings);
    }

    return element;
}

// Generate HTML content from component settings
function generateComponentContent(type, settings) {
    switch (type) {
        case 'hero':
            const alignment = settings.alignment || 'center';
            const heroTextColor = settings.textColor || '#1e293b';
            const heroSubColor = settings.textColor ? settings.textColor : '#475569';
            return `<div style="text-align:${alignment};max-width:800px;margin:0 auto;">
                <h1 style="font-size:48px;font-weight:bold;margin-bottom:20px;color:${heroTextColor};">${settings.title || ''}</h1>
                <p style="font-size:20px;color:${heroSubColor};margin-bottom:30px;">${settings.subtitle || ''}</p>
                <a href="${settings.buttonUrl || '#'}" style="display:inline-block;padding:16px 32px;background:${settings.buttonColor || '#3b82f6'};color:white;text-decoration:none;border-radius:8px;font-weight:500;">${settings.buttonText || 'Начать'}</a>
            </div>`;

        case 'features':
            // Support both new format (items array) and legacy format (title1, desc1, etc.)
            let featuresItems = settings.items;
            if (!featuresItems || !Array.isArray(featuresItems)) {
                // Convert legacy format to items array
                featuresItems = [];
                for (let i = 1; i <= 4; i++) {
                    if (settings[`title${i}`]) {
                        featuresItems.push({
                            icon: settings[`icon${i}`] || ['🚀', '💡', '✨', '🎯'][i-1],
                            title: settings[`title${i}`],
                            description: settings[`desc${i}`] || ''
                        });
                    }
                }
                if (featuresItems.length === 0) {
                    featuresItems = [
                        { icon: '🚀', title: 'Быстро', description: 'Описание преимущества' },
                        { icon: '💡', title: 'Удобно', description: 'Описание преимущества' },
                        { icon: '✨', title: 'Качественно', description: 'Описание преимущества' }
                    ];
                }
            }
            const cols = settings.columns || 3;
            const featuresHtml = featuresItems.map(item => `
                <div style="text-align:center;padding:20px;">
                    <div style="font-size:48px;margin-bottom:16px;">${item.icon || ''}</div>
                    <h3 style="font-size:20px;margin-bottom:8px;">${item.title || ''}</h3>
                    <p style="color:#64748b;">${item.description || ''}</p>
                </div>
            `).join('');
            return `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:30px;">${featuresHtml}</div>`;

        case 'testimonial':
            // Support both new format and legacy format
            const quote = settings.quote || settings.text || 'Отзыв клиента';
            const authorName = settings.authorName || settings.author || 'Имя Фамилия';
            const authorRole = settings.authorRole || settings.role || 'Должность';
            const authorPhoto = settings.authorPhoto || 'https://via.placeholder.com/48';
            return `<div style="padding:24px;background:#f8fafc;border-radius:8px;">
                <p style="font-size:18px;font-style:italic;margin-bottom:16px;">"${quote}"</p>
                <div style="display:flex;align-items:center;gap:12px;">
                    <img src="${authorPhoto}" style="width:48px;height:48px;border-radius:50%;">
                    <div>
                        <div style="font-weight:600;">${authorName}</div>
                        <div style="color:#64748b;font-size:14px;">${authorRole}</div>
                    </div>
                </div>
            </div>`;

        case 'pricing':
            // Support both new format (features array) and legacy format (features string)
            let pricingFeatures = settings.features;
            if (typeof pricingFeatures === 'string') {
                pricingFeatures = pricingFeatures.split('|').filter(f => f.trim());
            }
            if (!pricingFeatures || !Array.isArray(pricingFeatures)) {
                pricingFeatures = ['Функция 1', 'Функция 2', 'Функция 3'];
            }
            const featuresListHtml = pricingFeatures.map(f => `<li style="padding:8px 0;">✓ ${f}</li>`).join('');
            const planName = settings.planName || settings.title || 'Базовый';
            const price = settings.price || '29';
            const currency = settings.currency || '';
            const period = settings.period || '/мес';
            const buttonColor = settings.buttonColor || '#3b82f6';
            const bgColor = settings.highlighted ? buttonColor : 'white';
            const textColor = settings.highlighted ? 'white' : '#1e293b';
            const oldPrice = settings.oldPrice || '';
            const installmentPrice = settings.installmentPrice || '';
            const installmentPeriod = settings.installmentPeriod || '/мес';
            const modalFormId = settings.modalFormId || '';
            const oldPriceHtml = oldPrice ? `<div style="font-size:20px;text-decoration:line-through;color:${settings.highlighted ? 'rgba(255,255,255,0.5)' : '#9ca3af'};margin-bottom:4px;">${currency}${oldPrice}</div>` : '';
            const installmentHtml = installmentPrice ? `<div style="font-size:15px;color:${settings.highlighted ? 'rgba(255,255,255,0.8)' : '#64748b'};margin-top:4px;">или ${currency}${installmentPrice}${installmentPeriod} в рассрочку</div>` : '';
            const pricingBtnHref = modalFormId ? `javascript:document.getElementById('${modalFormId}')&&(document.getElementById('${modalFormId}').style.display='flex')` : (settings.buttonUrl || '#');
            return `<div style="text-align:center;padding:32px;background:${bgColor};border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="font-size:24px;margin-bottom:8px;color:${textColor};">${planName}</h3>
                ${oldPriceHtml}
                <div style="font-size:48px;font-weight:bold;margin:16px 0;color:${textColor};">${currency}${price}<span style="font-size:16px;color:${settings.highlighted ? 'rgba(255,255,255,0.8)' : '#64748b'};">${period}</span></div>
                ${installmentHtml}
                <ul style="list-style:none;padding:0;margin-bottom:24px;color:${settings.highlighted ? 'rgba(255,255,255,0.9)' : '#64748b'};">${featuresListHtml}</ul>
                <a href="${pricingBtnHref}" style="display:block;padding:12px;background:${settings.highlighted ? 'white' : buttonColor};color:${settings.highlighted ? buttonColor : 'white'};text-decoration:none;border-radius:6px;">${settings.buttonText || 'Выбрать'}</a>
            </div>`;

        case 'counter':
            // Support both new format (items array) and legacy format (num1, label1, etc.)
            let counterItems = settings.items;
            if (!counterItems || !Array.isArray(counterItems)) {
                counterItems = [];
                for (let i = 1; i <= 4; i++) {
                    if (settings[`num${i}`] || settings[`label${i}`]) {
                        counterItems.push({
                            value: settings[`num${i}`] || '0',
                            label: settings[`label${i}`] || ''
                        });
                    }
                }
                if (counterItems.length === 0) {
                    counterItems = [
                        { value: '500+', label: 'Клиентов' },
                        { value: '10', label: 'Лет опыта' },
                        { value: '99%', label: 'Довольных' }
                    ];
                }
            }
            const counterColor = settings.color || '#3b82f6';
            const countersHtml = counterItems.map(item => `
                <div>
                    <div style="font-size:48px;font-weight:bold;color:${counterColor};">${item.value}</div>
                    <div style="color:#64748b;">${item.label}</div>
                </div>
            `).join('');
            return `<div style="display:flex;justify-content:space-around;text-align:center;flex-wrap:wrap;gap:30px;">${countersHtml}</div>`;

        case 'card':
            return `<img src="${settings.image || 'https://via.placeholder.com/400x200'}" style="width:100%;border-radius:8px 8px 0 0;">
                <div style="padding:20px;">
                    <h3 style="font-size:20px;margin-bottom:8px;">${settings.title || 'Заголовок'}</h3>
                    <p style="color:#64748b;margin-bottom:16px;">${settings.description || 'Описание'}</p>
                    <a href="${settings.linkUrl || '#'}" style="color:#3b82f6;">${settings.linkText || 'Подробнее →'}</a>
                </div>`;

        case 'parallaxSection':
            return `<div style="text-align:center;color:white;padding:100px 20px;position:relative;z-index:1;">
                <h2 style="font-size:42px;font-weight:bold;margin-bottom:20px;text-shadow:2px 2px 4px rgba(0,0,0,0.3);">${settings.title || 'Заголовок'}</h2>
                <p style="font-size:20px;max-width:600px;margin:0 auto 30px;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">${settings.subtitle || 'Подзаголовок'}</p>
                <a href="${settings.buttonUrl || '#'}" style="display:inline-block;padding:14px 32px;background:white;color:#1e293b;text-decoration:none;border-radius:8px;font-weight:600;">${settings.buttonText || 'Подробнее'}</a>
            </div>`;

        case 'marquee':
            // Support both new format (items array) and legacy format (text string)
            let marqueeItemsArray = settings.items;
            if (!marqueeItemsArray || !Array.isArray(marqueeItemsArray)) {
                if (settings.text) {
                    marqueeItemsArray = [settings.text];
                } else {
                    marqueeItemsArray = ['🔥 Специальное предложение', '⭐ Скидка 20%', '📞 Звоните сейчас'];
                }
            }
            const marqueeItems = marqueeItemsArray.map(item => `<span style="padding:0 50px;">${item}</span>`).join('');
            const speed = settings.speed || 20;
            return `<div class="marquee-container" style="overflow:hidden;white-space:nowrap;">
                <div class="marquee-content" style="display:inline-block;animation:marquee ${speed}s linear infinite;">
                    ${marqueeItems}${marqueeItems}
                </div>
            </div>
            <style>@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }</style>`;

        case 'checklist':
            const checklistItems = settings.items || ['Пункт 1', 'Пункт 2', 'Пункт 3'];
            const iconColor = settings.iconColor || '#10b981';
            const checklistHtml = checklistItems.map(item => `
                <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;">
                    <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${iconColor};display:flex;align-items:center;justify-content:center;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <p style="font-size:17px;line-height:1.6;color:#374151;margin:0;">${item}</p>
                </div>
            `).join('');
            return `<div style="max-width:700px;margin:0 auto;">
                <h3 style="font-size:28px;font-weight:bold;margin-bottom:32px;color:#1e293b;">${settings.title || 'Это для вас, если:'}</h3>
                ${checklistHtml}
            </div>`;

        case 'benefitsList':
            const benefitsItems = settings.items || [{ title: 'Выгода 1', description: 'Описание' }];
            const accentColor = settings.accentColor || '#3b82f6';
            const benefitsHtml = benefitsItems.map((item, i) => `
                <div style="display:flex;gap:20px;margin-bottom:28px;">
                    <div style="flex-shrink:0;width:48px;height:48px;border-radius:12px;background:${accentColor};color:white;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;">${i + 1}</div>
                    <div>
                        <h4 style="font-size:18px;font-weight:600;margin-bottom:6px;color:#1e293b;">${item.title || ''}</h4>
                        <p style="font-size:15px;color:#64748b;margin:0;line-height:1.5;">${item.description || ''}</p>
                    </div>
                </div>
            `).join('');
            return `<div style="max-width:700px;margin:0 auto;">
                <h3 style="font-size:28px;font-weight:bold;margin-bottom:32px;color:#1e293b;">${settings.title || 'Что вы получите:'}</h3>
                ${benefitsHtml}
            </div>`;

        case 'giftBlock':
            const giftItems = settings.items || ['Бонус 1', 'Бонус 2', 'Бонус 3'];
            const giftItemsHtml = giftItems.map(item => `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                    <span style="color:#f59e0b;font-size:20px;">🎁</span>
                    <span style="font-size:16px;color:#92400e;">${item}</span>
                </div>
            `).join('');
            return `<div style="max-width:600px;margin:0 auto;text-align:center;">
                <div style="font-size:64px;margin-bottom:20px;">🎁</div>
                <h3 style="font-size:28px;font-weight:bold;margin-bottom:12px;color:#92400e;">${settings.title || 'Ваш подарок'}</h3>
                <p style="font-size:16px;color:#b45309;margin-bottom:8px;">${settings.subtitle || ''}</p>
                <p style="font-size:18px;color:#78350f;margin-bottom:24px;line-height:1.6;">${settings.description || ''}</p>
                <div style="text-align:left;display:inline-block;margin-bottom:24px;">${giftItemsHtml}</div>
                <div><a href="#form" style="display:inline-block;padding:16px 40px;background:${settings.buttonColor || '#f59e0b'};color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:18px;">${settings.buttonText || 'Получить подарок'}</a></div>
            </div>`;

        case 'guarantee':
            return `<div style="max-width:700px;margin:0 auto;text-align:center;">
                <h3 style="font-size:32px;font-weight:bold;margin-bottom:20px;color:#1e293b;">${settings.title || 'Не откладывайте'}</h3>
                <p style="font-size:18px;color:#64748b;margin-bottom:32px;line-height:1.6;">${settings.description || ''}</p>
                <a href="#form" style="display:inline-block;padding:18px 48px;background:${settings.buttonColor || '#3b82f6'};color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:18px;box-shadow:0 4px 14px rgba(59,130,246,0.4);">${settings.buttonText || 'Записаться'}</a>
                <p style="font-size:14px;color:#9ca3af;margin-top:20px;">${settings.guaranteeText || ''}</p>
            </div>`;

        case 'leadForm':
            const formFields = settings.fields || [
                { type: 'text', name: 'name', label: 'Имя', placeholder: 'Ваше имя', required: true },
                { type: 'tel', name: 'phone', label: 'Телефон', placeholder: '+7', required: true },
                { type: 'email', name: 'email', label: 'Email', placeholder: 'email@example.com', required: true }
            ];
            const formFieldsHtml = formFields.map(field => {
                if (field.type === 'select') {
                    const options = (field.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('');
                    return `<div style="margin-bottom:16px;">
                        <label style="display:block;font-size:14px;font-weight:500;margin-bottom:6px;color:#374151;">${field.label || ''}</label>
                        <select name="${field.name}" ${field.required ? 'required' : ''} style="width:100%;padding:14px 16px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;background:white;">
                            <option value="">Выберите...</option>
                            ${options}
                        </select>
                    </div>`;
                }
                return `<div style="margin-bottom:16px;">
                    <label style="display:block;font-size:14px;font-weight:500;margin-bottom:6px;color:#374151;">${field.label || ''}</label>
                    <input type="${field.type || 'text'}" name="${field.name}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} style="width:100%;padding:14px 16px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;">
                </div>`;
            }).join('');
            return `<div id="form">
                <h3 style="font-size:24px;font-weight:bold;margin-bottom:8px;text-align:center;color:#1e293b;">${settings.title || 'Оставьте заявку'}</h3>
                <p style="font-size:15px;color:#6b7280;margin-bottom:24px;text-align:center;">${settings.subtitle || ''}</p>
                ${formFieldsHtml}
                <button type="submit" style="width:100%;padding:16px;background:${settings.buttonColor || '#3b82f6'};color:white;border:none;border-radius:8px;font-size:17px;font-weight:600;cursor:pointer;margin-top:8px;">${settings.buttonText || 'Отправить'}</button>
                <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:16px;">${settings.privacyText || ''}</p>
            </div>`;

        case 'modalForm': {
            const mfId = settings.modalId || 'modal_form_1';
            const mfFields = settings.fields || [];
            const mfFieldsHtml = mfFields.map(field => {
                if (field.type === 'select') {
                    const opts = (field.options || []).map(o => `<option value="${o}">${o}</option>`).join('');
                    return `<div style="margin-bottom:16px;">
                        <label style="display:block;font-size:14px;font-weight:500;margin-bottom:6px;color:#374151;">${field.label || ''}</label>
                        <select name="${field.name}" ${field.required ? 'required' : ''} style="width:100%;padding:14px 16px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;background:white;"><option value="">Выберите...</option>${opts}</select>
                    </div>`;
                }
                return `<div style="margin-bottom:16px;">
                    <label style="display:block;font-size:14px;font-weight:500;margin-bottom:6px;color:#374151;">${field.label || ''}</label>
                    <input type="${field.type || 'text'}" name="${field.name}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} style="width:100%;padding:14px 16px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;">
                </div>`;
            }).join('');
            return `<button onclick="document.getElementById('${mfId}').style.display='flex'" style="display:inline-block;padding:16px 32px;background:${settings.buttonColor || '#3b82f6'};color:white;border:none;border-radius:8px;font-weight:600;font-size:16px;cursor:pointer;">${settings.buttonText || 'Оставить заявку'}</button>
            <div id="${mfId}" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);align-items:center;justify-content:center;z-index:10000;" onclick="if(event.target===this)this.style.display='none'">
                <div style="background:white;padding:40px;border-radius:16px;max-width:500px;width:90%;max-height:90vh;overflow-y:auto;position:relative;">
                    <button onclick="this.closest('[id=\\'${mfId}\\']').style.display='none'" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#9ca3af;">&times;</button>
                    <h3 style="font-size:24px;font-weight:bold;margin-bottom:8px;color:#1e293b;">${settings.title || 'Оставьте заявку'}</h3>
                    <p style="font-size:15px;color:#6b7280;margin-bottom:24px;">${settings.subtitle || ''}</p>
                    <form onsubmit="event.preventDefault();this.innerHTML='<div style=\\'padding:20px;text-align:center;color:#10b981;font-weight:500;\\'>${settings.successMessage || 'Спасибо!'}</div>';">
                        ${mfFieldsHtml}
                        <button type="submit" style="width:100%;padding:16px;background:${settings.buttonColor || '#3b82f6'};color:white;border:none;border-radius:8px;font-size:17px;font-weight:600;cursor:pointer;">${settings.submitText || 'Отправить'}</button>
                    </form>
                </div>
            </div>`;
        }

        case 'program': {
            const progModules = settings.modules || [];
            const progAccent = settings.accentColor || '#3b82f6';
            const modulesHtml = progModules.map((mod, idx) => {
                const itemsHtml = (mod.items || []).map(item => `
                    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9;">
                        <div style="width:8px;height:8px;border-radius:50%;background:${progAccent};flex-shrink:0;"></div>
                        <span style="color:#475569;font-size:15px;">${item}</span>
                    </div>
                `).join('');
                return `<div style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;margin-bottom:16px;">
                    <div onclick="var c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none';this.querySelector('.prog-arrow').style.transform=c.style.display==='none'?'':'rotate(180deg)'" style="display:flex;align-items:center;gap:16px;padding:20px 24px;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                        <div style="flex-shrink:0;width:40px;height:40px;border-radius:10px;background:${progAccent};color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;">${idx + 1}</div>
                        <h4 style="flex:1;font-size:17px;font-weight:600;color:#1e293b;margin:0;">${mod.title || ''}</h4>
                        <span class="prog-arrow" style="color:#94a3b8;transition:transform 0.3s;">▼</span>
                    </div>
                    <div style="padding:4px 24px 16px 80px;">${itemsHtml}</div>
                </div>`;
            }).join('');
            return `<div style="max-width:800px;margin:0 auto;">
                <h3 style="font-size:32px;font-weight:bold;margin-bottom:32px;color:#1e293b;text-align:center;">${settings.title || 'Программа курса'}</h3>
                ${modulesHtml}
            </div>`;
        }

        case 'speaker': {
            const spkAccent = settings.accentColor || '#3b82f6';
            const bioItems = settings.bio || [];
            const bioHtml = bioItems.map(item => `
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                    <div style="flex-shrink:0;width:32px;height:32px;border-radius:8px;background:${spkAccent}15;color:${spkAccent};display:flex;align-items:center;justify-content:center;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span style="font-size:16px;color:#374151;">${item}</span>
                </div>
            `).join('');
            const socialLinks = [];
            if (settings.socialTelegram) socialLinks.push(`<a href="${settings.socialTelegram}" target="_blank" style="width:40px;height:40px;border-radius:50%;background:#0088cc;color:white;display:flex;align-items:center;justify-content:center;text-decoration:none;"><i class="fab fa-telegram-plane"></i></a>`);
            if (settings.socialInstagram) socialLinks.push(`<a href="${settings.socialInstagram}" target="_blank" style="width:40px;height:40px;border-radius:50%;background:#e4405f;color:white;display:flex;align-items:center;justify-content:center;text-decoration:none;"><i class="fab fa-instagram"></i></a>`);
            if (settings.socialYoutube) socialLinks.push(`<a href="${settings.socialYoutube}" target="_blank" style="width:40px;height:40px;border-radius:50%;background:#ff0000;color:white;display:flex;align-items:center;justify-content:center;text-decoration:none;"><i class="fab fa-youtube"></i></a>`);
            if (settings.socialLinkedin) socialLinks.push(`<a href="${settings.socialLinkedin}" target="_blank" style="width:40px;height:40px;border-radius:50%;background:#0077b5;color:white;display:flex;align-items:center;justify-content:center;text-decoration:none;"><i class="fab fa-linkedin-in"></i></a>`);
            const socialHtml = socialLinks.length ? `<div style="display:flex;gap:12px;margin-top:24px;">${socialLinks.join('')}</div>` : '';
            return `<div style="max-width:900px;margin:0 auto;display:flex;gap:48px;align-items:center;flex-wrap:wrap;">
                <div style="flex-shrink:0;">
                    <img src="${settings.photo || 'https://via.placeholder.com/300x300'}" alt="${settings.name}" style="width:280px;height:280px;border-radius:20px;object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,0.12);">
                </div>
                <div style="flex:1;min-width:280px;">
                    <h3 style="font-size:32px;font-weight:bold;color:#1e293b;margin-bottom:8px;">${settings.name || 'Имя Фамилия'}</h3>
                    <p style="font-size:18px;color:${spkAccent};font-weight:500;margin-bottom:24px;">${settings.role || 'Эксперт'}</p>
                    ${bioHtml}
                    ${socialHtml}
                </div>
            </div>`;
        }

        case 'legalFooter': {
            const legalSocials = [];
            if (settings.socialTelegram) legalSocials.push(`<a href="${settings.socialTelegram}" target="_blank" style="color:#94a3b8;text-decoration:none;font-size:18px;"><i class="fab fa-telegram-plane"></i></a>`);
            if (settings.socialVk) legalSocials.push(`<a href="${settings.socialVk}" target="_blank" style="color:#94a3b8;text-decoration:none;font-size:18px;"><i class="fab fa-vk"></i></a>`);
            if (settings.socialInstagram) legalSocials.push(`<a href="${settings.socialInstagram}" target="_blank" style="color:#94a3b8;text-decoration:none;font-size:18px;"><i class="fab fa-instagram"></i></a>`);
            if (settings.socialYoutube) legalSocials.push(`<a href="${settings.socialYoutube}" target="_blank" style="color:#94a3b8;text-decoration:none;font-size:18px;"><i class="fab fa-youtube"></i></a>`);
            const socialsRow = legalSocials.length ? `<div style="display:flex;gap:16px;margin-top:16px;">${legalSocials.join('')}</div>` : '';
            const legalLinks = [];
            if (settings.offerUrl) legalLinks.push(`<a href="${settings.offerUrl}" target="_blank" style="color:#94a3b8;text-decoration:underline;">Договор оферты</a>`);
            if (settings.privacyUrl) legalLinks.push(`<a href="${settings.privacyUrl}" target="_blank" style="color:#94a3b8;text-decoration:underline;">Политика конфиденциальности</a>`);
            const linksRow = legalLinks.length ? `<div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:12px;">${legalLinks.join('')}</div>` : '';
            const innOgrn = [];
            if (settings.inn) innOgrn.push(`ИНН: ${settings.inn}`);
            if (settings.ogrn) innOgrn.push(`ОГРН: ${settings.ogrn}`);
            const innOgrnRow = innOgrn.length ? `<p style="margin-top:8px;font-size:13px;color:#64748b;">${innOgrn.join(' | ')}</p>` : '';
            return `<div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;flex-wrap:wrap;gap:32px;">
                <div>
                    <h4 style="font-size:16px;color:#e2e8f0;margin-bottom:12px;">${settings.companyName || 'Компания'}</h4>
                    <p style="color:#94a3b8;">© ${new Date().getFullYear()} Все права защищены</p>
                    ${innOgrnRow}
                    ${linksRow}
                </div>
                <div>
                    <h4 style="font-size:16px;color:#e2e8f0;margin-bottom:12px;">Контакты</h4>
                    ${settings.email ? `<p style="color:#94a3b8;margin-bottom:4px;"><a href="mailto:${settings.email}" style="color:#94a3b8;text-decoration:none;">${settings.email}</a></p>` : ''}
                    ${settings.phone ? `<p style="color:#94a3b8;"><a href="tel:${settings.phone.replace(/[^+\d]/g, '')}" style="color:#94a3b8;text-decoration:none;">${settings.phone}</a></p>` : ''}
                    ${socialsRow}
                </div>
            </div>`;
        }

        default:
            return '';
    }
}

// Collect anchor IDs from all elements
function collectAnchors(elements = state.elements) {
    const anchors = [];
    function traverse(els) {
        for (const el of els) {
            if (el.anchorId) {
                anchors.push({ id: el.anchorId, label: el.label + ': ' + el.anchorId });
            }
            if (el.children?.length) traverse(el.children);
        }
    }
    traverse(elements);
    return anchors;
}

// Generate analytics scripts from analytics elements
function generateAnalyticsScripts(elements) {
    let scripts = '';
    function traverse(els) {
        for (const el of els) {
            if (el.type === 'analytics' && el.componentSettings) {
                const cs = el.componentSettings;
                if (cs.yandexMetrikaId) {
                    scripts += `\n<!-- Yandex.Metrika -->
<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${cs.yandexMetrikaId},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});</script>
<noscript><div><img src="https://mc.yandex.ru/watch/${cs.yandexMetrikaId}" style="position:absolute;left:-9999px;" alt=""></div></noscript>`;
                }
                if (cs.googleAnalyticsId) {
                    scripts += `\n<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${cs.googleAnalyticsId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${cs.googleAnalyticsId}');</script>`;
                }
                if (cs.facebookPixelId) {
                    scripts += `\n<!-- Facebook Pixel -->
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${cs.facebookPixelId}');fbq('track','PageView');</script>`;
                }
                if (cs.vkPixelId) {
                    scripts += `\n<!-- VK Pixel -->
<script>!function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="https://vk.com/js/api/openapi.js?169",t.onload=function(){VK.Retargeting.Init("${cs.vkPixelId}"),VK.Retargeting.Hit()},document.head.appendChild(t)}();</script>`;
                }
            }
            if (el.children?.length) traverse(el.children);
        }
    }
    traverse(elements);
    return scripts;
}

// Check if page has gallery blocks
function checkForGalleries(elements) {
    for (const el of elements) {
        if (el.type === 'gallery') return true;
        if (el.children?.length && checkForGalleries(el.children)) return true;
    }
    return false;
}

// Get styles based on current viewport
function getStylesForViewport(element) {
    const base = { ...element.styles };
    if (state.viewport === 'tablet') {
        return { ...base, ...element.tabletStyles };
    } else if (state.viewport === 'mobile') {
        return { ...base, ...element.tabletStyles, ...element.mobileStyles };
    }
    return base;
}

// Apply layout preset to container
function applyLayoutPreset(container, preset) {
    if (!container || !container.isContainer) return;

    // Set horizontal direction for column presets
    container.styles.display = 'flex';
    container.styles.flexDirection = 'row';
    container.styles.flexWrap = 'nowrap';

    // Parse preset (e.g., "1-2" means 1:2 ratio)
    const parts = preset.split('-').map(Number);
    const totalParts = parts.reduce((a, b) => a + b, 0);

    // Remove existing children or update their flex values
    if (container.children && container.children.length > 0) {
        // Update existing children flex values
        container.children.forEach((child, index) => {
            if (index < parts.length) {
                child.styles = child.styles || {};
                child.styles.flex = `${parts[index]} 1 0`;
                child.styles.minWidth = '0';
            }
        });

        // Add more columns if needed
        while (container.children.length < parts.length) {
            const newCol = createElement('column');
            newCol.styles.flex = `${parts[container.children.length]} 1 0`;
            newCol.styles.minWidth = '0';
            container.children.push(newCol);
        }
    } else {
        // Create new columns with specified ratios
        container.children = [];
        parts.forEach((part, index) => {
            const col = createElement('column');
            col.styles.flex = `${part} 1 0`;
            col.styles.minWidth = '0';
            container.children.push(col);
        });
    }
}

// Apply container template
function applyContainerTemplate(container, template) {
    if (!container || !container.isContainer) return;

    // Clear existing children
    container.children = [];

    switch (template) {
        case 'hero':
            // Hero section with centered content
            container.styles = {
                ...container.styles,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '80px 20px',
                minHeight: '80vh',
                gap: '20px'
            };
            const heroHeading = createElement('heading');
            heroHeading.tag = 'h1';
            heroHeading.content = 'Заголовок вашего сайта';
            heroHeading.styles = { fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' };

            const heroText = createElement('text');
            heroText.content = 'Краткое описание вашего продукта или услуги. Добавьте убедительный текст.';
            heroText.styles = { fontSize: '20px', maxWidth: '600px', marginBottom: '20px' };

            const heroBtn = createElement('button');
            heroBtn.content = 'Начать';
            heroBtn.styles = { ...heroBtn.styles, padding: '16px 32px', fontSize: '18px' };

            container.children = [heroHeading, heroText, heroBtn];
            break;

        case 'features':
            // 3 columns with features
            container.styles = {
                ...container.styles,
                display: 'flex',
                flexDirection: 'row',
                gap: '30px',
                padding: '40px 20px'
            };
            for (let i = 0; i < 3; i++) {
                const col = createElement('column');
                col.styles = { flex: '1 1 0', minWidth: '0', textAlign: 'center', padding: '20px' };

                const icon = createElement('icon');
                icon.styles = { fontSize: '48px', marginBottom: '16px' };

                const heading = createElement('heading');
                heading.tag = 'h3';
                heading.content = `Преимущество ${i + 1}`;
                heading.styles = { fontSize: '20px', marginBottom: '10px' };

                const text = createElement('text');
                text.content = 'Описание преимущества';
                text.styles = { fontSize: '14px', color: '#64748b' };

                col.children = [icon, heading, text];
                container.children.push(col);
            }
            break;

        case 'two-cols':
            // Text + Image
            container.styles = {
                ...container.styles,
                display: 'flex',
                flexDirection: 'row',
                gap: '40px',
                alignItems: 'center',
                padding: '60px 20px'
            };
            const textCol = createElement('column');
            textCol.styles = { flex: '1 1 0', minWidth: '0' };

            const textHeading = createElement('heading');
            textHeading.content = 'Заголовок секции';
            textHeading.styles = { fontSize: '36px', marginBottom: '20px' };

            const textPara = createElement('text');
            textPara.content = 'Добавьте описательный текст, который объясняет ваш продукт или услугу. Расскажите о преимуществах и особенностях.';
            textPara.styles = { fontSize: '16px', lineHeight: '1.8', marginBottom: '20px' };

            const textBtn = createElement('button');
            textBtn.content = 'Подробнее';

            textCol.children = [textHeading, textPara, textBtn];

            const imgCol = createElement('column');
            imgCol.styles = { flex: '1 1 0', minWidth: '0' };

            const img = createElement('image');
            img.attrs = { src: 'https://via.placeholder.com/600x400', alt: 'Изображение' };
            img.styles = { width: '100%', borderRadius: '12px' };

            imgCol.children = [img];

            container.children = [textCol, imgCol];
            break;

        case 'pricing':
            // 3 pricing cards
            container.styles = {
                ...container.styles,
                display: 'flex',
                flexDirection: 'row',
                gap: '20px',
                justifyContent: 'center',
                padding: '40px 20px'
            };
            const plans = ['Базовый', 'Стандарт', 'Премиум'];
            const prices = ['990', '1990', '4990'];
            plans.forEach((plan, i) => {
                const card = createElement('column');
                card.styles = {
                    flex: '1 1 0',
                    minWidth: '0',
                    maxWidth: '320px',
                    textAlign: 'center',
                    padding: '30px',
                    backgroundColor: i === 1 ? '#3b82f6' : 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                };

                const planName = createElement('heading');
                planName.tag = 'h3';
                planName.content = plan;
                planName.styles = { fontSize: '20px', marginBottom: '16px', color: i === 1 ? 'white' : '#1e293b' };

                const price = createElement('heading');
                price.content = `${prices[i]} ₽`;
                price.styles = { fontSize: '42px', fontWeight: 'bold', marginBottom: '24px', color: i === 1 ? 'white' : '#1e293b' };

                const features = createElement('list');
                features.content = '<li>Функция 1</li><li>Функция 2</li><li>Функция 3</li>';
                features.styles = { textAlign: 'left', marginBottom: '24px', color: i === 1 ? 'rgba(255,255,255,0.9)' : '#64748b' };

                const btn = createElement('button');
                btn.content = 'Выбрать';
                btn.styles = {
                    ...btn.styles,
                    width: '100%',
                    backgroundColor: i === 1 ? 'white' : '#3b82f6',
                    color: i === 1 ? '#3b82f6' : 'white'
                };

                card.children = [planName, price, features, btn];
                container.children.push(card);
            });
            break;

        case 'cta':
            // Call to action block
            container.styles = {
                ...container.styles,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: '#3b82f6',
                borderRadius: '16px',
                gap: '20px'
            };
            const ctaHeading = createElement('heading');
            ctaHeading.content = 'Готовы начать?';
            ctaHeading.styles = { fontSize: '36px', color: 'white', marginBottom: '10px' };

            const ctaText = createElement('text');
            ctaText.content = 'Присоединяйтесь к тысячам довольных клиентов';
            ctaText.styles = { fontSize: '18px', color: 'rgba(255,255,255,0.9)', marginBottom: '20px' };

            const ctaBtn = createElement('button');
            ctaBtn.content = 'Связаться с нами';
            ctaBtn.styles = { ...ctaBtn.styles, backgroundColor: 'white', color: '#3b82f6', padding: '16px 32px', fontSize: '18px' };

            container.children = [ctaHeading, ctaText, ctaBtn];
            break;
    }
}

// ===== Image Optimization =====
// Compress image on client side
function compressImage(file, maxWidth = 1920, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                // Create canvas and compress
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to compressed base64
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Save style to correct viewport object
function setStyleForCurrentViewport(element, styleName, value) {
    if (state.viewport === 'tablet') {
        element.tabletStyles = element.tabletStyles || {};
        if (value) {
            element.tabletStyles[styleName] = value;
        } else {
            delete element.tabletStyles[styleName];
        }
    } else if (state.viewport === 'mobile') {
        element.mobileStyles = element.mobileStyles || {};
        if (value) {
            element.mobileStyles[styleName] = value;
        } else {
            delete element.mobileStyles[styleName];
        }
    } else {
        if (value) {
            element.styles[styleName] = value;
        } else {
            delete element.styles[styleName];
        }
    }
}

function addElement(element, parentId = null) {
    if (parentId) {
        const parent = findElement(parentId);
        if (parent && parent.isContainer) {
            parent.children = parent.children || [];
            parent.children.push(element);
        } else {
            state.elements.push(element);
        }
    } else {
        state.elements.push(element);
    }
    saveHistory();
    renderCanvas();
    renderLayers();
}

function deleteElement(id) {
    if (removeElement(id)) {
        if (state.selectedElement?.id === id) {
            state.selectedElement = null;
        }
        saveHistory();
        renderCanvas();
        renderLayers();
    }
}

function duplicateElement(id) {
    const original = findElement(id);
    if (!original) return;

    const copy = JSON.parse(JSON.stringify(original));
    copy.id = generateId();

    // Generate new IDs for children
    function regenerateIds(el) {
        el.id = generateId();
        el.children?.forEach(regenerateIds);
    }
    copy.children?.forEach(regenerateIds);

    const parent = findParent(id);
    if (parent) {
        const index = parent.children.findIndex(e => e.id === id);
        parent.children.splice(index + 1, 0, copy);
    } else {
        const index = state.elements.findIndex(e => e.id === id);
        state.elements.splice(index + 1, 0, copy);
    }

    saveHistory();
    renderCanvas();
    renderLayers();
    selectElement(copy.id);
}

function moveElement(id, direction) {
    const parent = findParent(id);
    const siblings = parent ? parent.children : state.elements;
    const index = siblings.findIndex(e => e.id === id);

    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= siblings.length) return;

    const [element] = siblings.splice(index, 1);
    siblings.splice(newIndex, 0, element);

    saveHistory();
    renderCanvas();
    renderLayers();
}

function toggleVisibility(id) {
    const element = findElement(id);
    if (element) {
        element.hidden = !element.hidden;
        renderCanvas();
        renderLayers();
    }
}

function toggleUnlock(id) {
    const element = findElement(id);
    if (element) {
        element.unlocked = !element.unlocked;
        if (!element.unlocked) {
            // Reset position styles when locking
            delete element.posX;
            delete element.posY;
        }
        saveHistory();
        renderCanvas();
        renderLayers();
    }
}

// ===== Render Canvas =====
function renderElement(element, depth = 0) {
    const el = document.createElement(element.tag === 'img' ? 'div' : element.tag);
    el.id = element.id;
    el.className = `builder-element ${element.isContainer ? 'is-container' : ''} ${element.hidden ? 'is-hidden' : ''}`;
    el.setAttribute('data-type', element.type);
    el.setAttribute('data-depth', depth);

    if (element.tag === 'img') {
        el.innerHTML = `<img src="${element.attrs?.src || ''}" alt="${element.attrs?.alt || ''}" style="max-width:100%;height:auto;" loading="lazy">`;
    } else {
        el.innerHTML = element.content;
    }

    // Apply styles
    Object.assign(el.style, element.styles);

    // Apply attributes (except for img which is wrapped)
    if (element.attrs && element.tag !== 'img') {
        Object.entries(element.attrs).forEach(([k, v]) => {
            if (k !== 'class') el.setAttribute(k, v);
        });
    }

    // Hover toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'element-toolbar';
    toolbar.innerHTML = `
        <button class="toolbar-action ${element.unlocked ? 'active' : ''}" data-action="unlock" title="${element.unlocked ? 'Закрепить' : 'Свободное перемещение'}"><i class="fas fa-${element.unlocked ? 'lock-open' : 'lock'}"></i></button>
        <button class="toolbar-action" data-action="moveUp" title="Вверх"><i class="fas fa-arrow-up"></i></button>
        <button class="toolbar-action" data-action="moveDown" title="Вниз"><i class="fas fa-arrow-down"></i></button>
        <button class="toolbar-action" data-action="edit" title="Редактировать"><i class="fas fa-edit"></i></button>
        <button class="toolbar-action" data-action="duplicate" title="Дублировать"><i class="fas fa-copy"></i></button>
        <button class="toolbar-action" data-action="hide" title="${element.hidden ? 'Показать' : 'Скрыть'}"><i class="fas fa-${element.hidden ? 'eye' : 'eye-slash'}"></i></button>
        <button class="toolbar-action danger" data-action="delete" title="Удалить"><i class="fas fa-trash"></i></button>
    `;
    el.appendChild(toolbar);

    // Free position mode (unlocked)
    if (element.unlocked) {
        el.classList.add('unlocked');
        el.style.position = 'absolute';
        el.style.left = element.posX || '100px';
        el.style.top = element.posY || '100px';
        el.style.zIndex = '100';

        // Make draggable
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        el.addEventListener('mousedown', (e) => {
            if (!element.unlocked || e.target.closest('.element-toolbar')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(el.style.left) || 0;
            startTop = parseInt(el.style.top) || 0;
            el.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = (startLeft + dx) + 'px';
            el.style.top = (startTop + dy) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                el.style.cursor = '';
                // Save position
                element.posX = el.style.left;
                element.posY = el.style.top;
                savePageData();
            }
        });
    }

    // Toolbar actions
    toolbar.querySelectorAll('.toolbar-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            switch (action) {
                case 'unlock': toggleUnlock(element.id); break;
                case 'moveUp': moveElement(element.id, 'up'); break;
                case 'moveDown': moveElement(element.id, 'down'); break;
                case 'edit': openEditModal(element.id); break;
                case 'duplicate': duplicateElement(element.id); break;
                case 'hide': toggleVisibility(element.id); break;
                case 'delete': deleteElement(element.id); break;
            }
        });
    });

    // Label
    const label = document.createElement('span');
    label.className = 'element-label';
    label.innerHTML = `<i class="fas ${element.icon}"></i> ${element.label}`;
    el.appendChild(label);

    // Click to select
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectElement(element.id);
    });

    // Double click to edit
    el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openEditModal(element.id);
    });

    // Render children for containers
    if (element.isContainer) {
        const childContainer = document.createElement('div');
        childContainer.className = 'element-children';

        const isHorizontal = element.styles?.flexDirection === 'row';
        const gap = element.styles?.gap || '20px';
        const childCount = element.children?.length || 0;

        // Apply flex properties to children container
        childContainer.style.display = 'flex';
        childContainer.style.flexDirection = element.styles?.flexDirection || 'column';
        childContainer.style.flexWrap = element.styles?.flexWrap || 'nowrap';
        childContainer.style.gap = gap;
        childContainer.style.justifyContent = element.styles?.justifyContent || 'flex-start';
        childContainer.style.alignItems = element.styles?.alignItems || 'stretch';
        childContainer.style.flex = '1';
        childContainer.style.minHeight = '50px';
        childContainer.style.width = '100%';

        if (element.children?.length) {
            element.children.forEach(child => {
                const childEl = renderElement(child, depth + 1);

                // Auto-calculate width for horizontal layout
                if (isHorizontal && childCount > 0) {
                    const gapValue = parseInt(gap) || 0;
                    const totalGap = gapValue * (childCount - 1);
                    // All children (including containers) get equal flex
                    childEl.style.flex = '1 1 0';
                    childEl.style.minWidth = '0';
                    childEl.style.boxSizing = 'border-box';
                } else if (child.isContainer) {
                    // Vertical layout - containers take full width
                    childEl.style.width = '100%';
                    childEl.style.boxSizing = 'border-box';
                }

                childContainer.appendChild(childEl);
            });
        } else {
            // Empty container placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'container-placeholder';
            placeholder.innerHTML = '<i class="fas fa-plus"></i> Перетащите блоки сюда';
            childContainer.appendChild(placeholder);
        }

        el.appendChild(childContainer);
    }

    // Drag over handling for all elements
    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();

        clearDropIndicators();

        const rect = el.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        if (element.isContainer) {
            // For containers: top 25% = before, middle 50% = inside, bottom 25% = after
            if (y < height * 0.25) {
                el.classList.add('drop-before');
                dropTargetId = element.id;
                dropPosition = 'before';
            } else if (y > height * 0.75) {
                el.classList.add('drop-after');
                dropTargetId = element.id;
                dropPosition = 'after';
            } else {
                el.classList.add('drop-target');
                dropTargetId = element.id;
                dropPosition = 'inside';
            }
        } else {
            // For non-containers: top 50% = before, bottom 50% = after
            if (y < height * 0.5) {
                el.classList.add('drop-before');
                dropTargetId = element.id;
                dropPosition = 'before';
            } else {
                el.classList.add('drop-after');
                dropTargetId = element.id;
                dropPosition = 'after';
            }
        }
    });

    el.addEventListener('dragleave', (e) => {
        if (!el.contains(e.relatedTarget)) {
            el.classList.remove('drop-before', 'drop-after', 'drop-target');
        }
    });

    // Drop handler for elements
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        el.classList.remove('drop-before', 'drop-after', 'drop-target');

        if (draggedBlockType && dropTargetId && dropPosition) {
            handleDropAtPosition(dropTargetId, dropPosition);
        }
    });

    return el;
}

function renderCanvas() {
    canvas.innerHTML = '';

    if (state.elements.length === 0) {
        canvas.appendChild(canvasEmpty);
    } else {
        state.elements.forEach(el => {
            try {
                canvas.appendChild(renderElement(el));
            } catch (err) {
                console.error('[Builder] Error rendering element:', el.type, el.id, err);
            }
        });
    }

    // Re-select if needed
    if (state.selectedElement) {
        const el = document.getElementById(state.selectedElement.id);
        el?.classList.add('selected');
    }
}

function selectElement(id) {
    document.querySelectorAll('.builder-element.selected').forEach(el => {
        el.classList.remove('selected');
    });

    if (id) {
        state.selectedElement = findElement(id);
        document.getElementById(id)?.classList.add('selected');
        highlightLayer(id);
    } else {
        state.selectedElement = null;
    }
}

// ===== Layers Panel =====
function renderLayers() {
    if (state.elements.length === 0) {
        layersContent.innerHTML = `
            <div class="layers-empty">
                <i class="fas fa-layer-group"></i>
                <p>Нет добавленных блоков</p>
            </div>
        `;
        return;
    }

    layersContent.innerHTML = '<div class="layers-tree">' + renderLayerTree(state.elements) + '</div>';

    // Add click handlers and drag & drop
    layersContent.querySelectorAll('.layer-item').forEach(item => {
        const id = item.dataset.id;

        // Click to select
        item.addEventListener('click', (e) => {
            if (e.target.closest('.layer-delete') || e.target.closest('.layer-toggle')) return;
            e.stopPropagation();
            selectElement(id);
        });

        // Double click to edit
        item.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            openEditModal(id);
        });

        // Drag start
        item.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            state.draggedLayerId = id;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        // Drag end
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            layersContent.querySelectorAll('.layer-drop-target').forEach(el => {
                el.classList.remove('layer-drop-target', 'layer-drop-before', 'layer-drop-after');
            });
            state.draggedLayerId = null;
        });

        // Drag over
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (state.draggedLayerId === id) return;

            const element = findElement(id);
            const rect = item.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const height = rect.height;

            item.classList.remove('layer-drop-before', 'layer-drop-after', 'layer-drop-inside');

            // For containers: top 25% = before, middle 50% = inside, bottom 25% = after
            if (element?.isContainer) {
                if (y < height * 0.25) {
                    item.classList.add('layer-drop-before');
                } else if (y > height * 0.75) {
                    item.classList.add('layer-drop-after');
                } else {
                    item.classList.add('layer-drop-inside');
                }
            } else {
                // For non-containers: top 50% = before, bottom 50% = after
                if (y < height / 2) {
                    item.classList.add('layer-drop-before');
                } else {
                    item.classList.add('layer-drop-after');
                }
            }
        });

        // Drag leave
        item.addEventListener('dragleave', () => {
            item.classList.remove('layer-drop-before', 'layer-drop-after', 'layer-drop-inside');
        });

        // Drop
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!state.draggedLayerId || state.draggedLayerId === id) return;

            let position = 'after';
            if (item.classList.contains('layer-drop-before')) {
                position = 'before';
            } else if (item.classList.contains('layer-drop-inside')) {
                position = 'inside';
            }

            item.classList.remove('layer-drop-before', 'layer-drop-after', 'layer-drop-inside');

            moveLayerToPosition(state.draggedLayerId, id, position);
        });
    });

    // Layer action buttons
    layersContent.querySelectorAll('.layer-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.closest('.layer-item').dataset.id;
            deleteElement(id);
        });
    });

    layersContent.querySelectorAll('.layer-visibility').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.closest('.layer-item').dataset.id;
            toggleVisibility(id);
        });
    });

    layersContent.querySelectorAll('.layer-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.closest('.layer-item').dataset.id;
            openEditModal(id);
        });
    });

    // Toggle children visibility
    layersContent.querySelectorAll('.layer-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle.parentElement.classList.toggle('collapsed');
        });
    });
}

function renderLayerTree(elements, depth = 0) {
    return elements.map(el => {
        const hasChildren = el.children?.length > 0;
        const isSelected = state.selectedElement?.id === el.id;
        return `
            <div class="layer-item ${isSelected ? 'selected' : ''} ${el.hidden ? 'is-hidden' : ''}"
                 data-id="${el.id}"
                 draggable="true"
                 style="padding-left:${depth * 16 + 8}px;">
                <span class="layer-drag-handle"><i class="fas fa-grip-vertical"></i></span>
                ${hasChildren ? '<span class="layer-toggle"><i class="fas fa-chevron-down"></i></span>' : '<span class="layer-spacer"></span>'}
                <i class="fas ${el.icon} layer-icon"></i>
                <span class="layer-name">${el.label}</span>
                <div class="layer-actions">
                    <button class="layer-action layer-visibility" title="${el.hidden ? 'Показать' : 'Скрыть'}">
                        <i class="fas fa-${el.hidden ? 'eye-slash' : 'eye'}"></i>
                    </button>
                    <button class="layer-action layer-edit" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="layer-action layer-delete" title="Удалить">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            ${hasChildren ? '<div class="layer-children">' + renderLayerTree(el.children, depth + 1) + '</div>' : ''}
        `;
    }).join('');
}

function moveLayerToPosition(draggedId, targetId, position) {
    const draggedElement = findElement(draggedId);
    const targetElement = findElement(targetId);
    if (!draggedElement || !targetElement) return;

    // Prevent dropping element into itself or its children
    if (isDescendant(targetId, draggedId)) return;

    // Remove from current position
    removeElement(draggedId);

    if (position === 'inside' && targetElement.isContainer) {
        // Insert inside container at the end
        targetElement.children = targetElement.children || [];
        targetElement.children.push(draggedElement);
    } else {
        // Find target and insert before/after
        const targetParent = findParent(targetId);
        const targetArray = targetParent ? targetParent.children : state.elements;
        const targetIndex = targetArray.findIndex(e => e.id === targetId);

        if (targetIndex !== -1) {
            const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
            targetArray.splice(insertIndex, 0, draggedElement);
        }
    }

    saveHistory();
    renderCanvas();
    renderLayers();
    selectElement(draggedId);
}

// Check if childId is a descendant of parentId
function isDescendant(childId, parentId) {
    const parent = findElement(parentId);
    if (!parent || !parent.children) return false;

    for (const child of parent.children) {
        if (child.id === childId) return true;
        if (isDescendant(childId, child.id)) return true;
    }
    return false;
}

function highlightLayer(id) {
    layersContent.querySelectorAll('.layer-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.id === id);
    });
}

// ===== Edit Modal =====
function openEditModal(id) {
    const element = findElement(id);
    if (!element) return;

    state.editingElement = JSON.parse(JSON.stringify(element)); // Clone for editing
    editModalTitle.textContent = `Редактировать: ${element.label}`;

    // Reset tabs to content
    document.querySelectorAll('.edit-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.edit-tab[data-tab="content"]').classList.add('active');

    renderEditContent('content');
    editModal.classList.add('active');
}

// Tab switching (set up once)
document.querySelectorAll('.edit-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        if (!state.editingElement) return;
        document.querySelectorAll('.edit-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderEditContent(tab.dataset.tab);
    });
});

function closeEditModal() {
    editModal.classList.remove('active');
    state.editingElement = null;
}

function saveEditChanges() {
    if (!state.editingElement) return;

    // Update values from form
    updateEditingElementFromForm();

    // Apply changes to actual element
    const element = findElement(state.editingElement.id);
    if (element) {
        Object.assign(element, state.editingElement);
        saveHistory();
        renderCanvas();
        renderLayers();
    }

    closeEditModal();
}

function updateEditingElementFromForm() {
    const el = state.editingElement;

    // Content
    editContent.querySelectorAll('[data-prop="content"]').forEach(input => {
        el.content = input.value;
    });

    // Attributes
    editContent.querySelectorAll('[data-attr]').forEach(input => {
        el.attrs = el.attrs || {};
        el.attrs[input.dataset.attr] = input.value;
    });

    // Styles - save to current viewport
    editContent.querySelectorAll('[data-style]').forEach(input => {
        const val = input.value;
        const unit = input.dataset.unit || '';
        const styleName = input.dataset.style;
        const finalValue = val ? (val.includes(unit) || !unit ? val : val + unit) : '';

        // Always save to base styles for desktop, or to responsive styles for tablet/mobile
        if (state.viewport === 'tablet') {
            el.tabletStyles = el.tabletStyles || {};
            if (finalValue) {
                el.tabletStyles[styleName] = finalValue;
            } else {
                delete el.tabletStyles[styleName];
            }
        } else if (state.viewport === 'mobile') {
            el.mobileStyles = el.mobileStyles || {};
            if (finalValue) {
                el.mobileStyles[styleName] = finalValue;
            } else {
                delete el.mobileStyles[styleName];
            }
        } else {
            if (finalValue) {
                el.styles[styleName] = finalValue;
            } else {
                delete el.styles[styleName];
            }
        }
    });

    // Custom fields
    editContent.querySelectorAll('[data-custom]').forEach(input => {
        const custom = input.dataset.custom;

        if (custom === 'listItems') {
            const items = input.value.split('\n').filter(i => i.trim());
            el.content = items.map(i => `<li>${i}</li>`).join('');
        }

        if (custom === 'listType') {
            el.tag = input.value;
        }

        if (custom === 'headingLevel') {
            el.tag = input.value;
        }

        if (custom === 'videoUrl') {
            const url = input.value;
            let embedUrl = url;

            // Convert YouTube URL to embed
            const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
            if (ytMatch) {
                embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
            }

            // Convert Vimeo URL to embed
            const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
            if (vimeoMatch) {
                embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
            }

            el.content = `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
        }
    });

    // Button groups (single select)
    editContent.querySelectorAll('.edit-btn-group').forEach(group => {
        const activeBtn = group.querySelector('.active');
        if (activeBtn && group.dataset.style) {
            el.styles[group.dataset.style] = activeBtn.dataset.value;
        }
        // Handle background type
        if (group.dataset.custom === 'bgType') {
            const bgValue = activeBtn?.dataset.value;

            // Clear previous background styles
            delete el.styles.background;
            delete el.styles.backdropFilter;
            delete el.styles.WebkitBackdropFilter;

            if (bgValue === 'gradient') {
                // Build gradient from colors
                const direction = editContent.querySelector('[data-custom="gradientDirection"]')?.value || 'to bottom';
                const colors = [];
                for (let i = 1; i <= 10; i++) {
                    const colorInput = editContent.querySelector(`[data-custom="gradientColor${i}"]`);
                    if (colorInput && colorInput.value) {
                        colors.push(colorInput.value);
                    }
                }
                if (colors.length >= 2) {
                    el.styles.background = `linear-gradient(${direction}, ${colors.join(', ')})`;
                    delete el.styles.backgroundColor;
                    delete el.styles.backgroundImage;
                }
            } else if (bgValue === 'photo') {
                // Background image
                const urlInput = editContent.querySelector('[data-custom="bgImageUrl"]');
                const repeatInput = editContent.querySelector('[data-custom="bgRepeat"]');
                if (urlInput && urlInput.value) {
                    el.styles.backgroundImage = `url(${urlInput.value})`;
                    el.styles.backgroundRepeat = repeatInput?.checked ? 'repeat' : 'no-repeat';
                }
                delete el.styles.backgroundColor;
                delete el.styles.background;
            } else if (bgValue === 'blur') {
                // Backdrop blur
                const blurAmount = editContent.querySelector('[data-custom="bgBlurAmount"]')?.value || 10;
                const overlayColor = editContent.querySelector('[data-custom="bgBlurOverlay"]')?.value || 'rgba(255,255,255,0.3)';
                el.styles.backdropFilter = `blur(${blurAmount}px)`;
                el.styles.WebkitBackdropFilter = `blur(${blurAmount}px)`;
                el.styles.backgroundColor = overlayColor;
                delete el.styles.backgroundImage;
                delete el.styles.background;
            } else {
                // Solid color - remove other background properties
                delete el.styles.backgroundImage;
                delete el.styles.background;
            }
        }

        // Handle text color type (gradient, solid, or blur)
        if (group.dataset.custom === 'textColorType') {
            const textValue = activeBtn?.dataset.value;

            if (textValue === 'gradient') {
                // Build text gradient
                const direction = editContent.querySelector('[data-custom="textGradientDirection"]')?.value || 'to right';
                const colors = [];
                for (let i = 1; i <= 10; i++) {
                    const colorInput = editContent.querySelector(`[data-custom="textGradientColor${i}"]`);
                    if (colorInput && colorInput.value) {
                        colors.push(colorInput.value);
                    }
                }
                if (colors.length >= 2) {
                    // Apply text gradient using background-clip technique
                    el.styles.backgroundImage = `linear-gradient(${direction}, ${colors.join(', ')})`;
                    el.styles.backgroundClip = 'text';
                    el.styles.WebkitBackgroundClip = 'text';
                    el.styles.WebkitTextFillColor = 'transparent';
                    el.styles.color = 'transparent';
                }
                delete el.styles.textShadow;
            } else if (textValue === 'blur') {
                // Text with blur/glow effect
                const blurColor = editContent.querySelector('[data-custom="textBlurColor"]')?.value || '#000000';
                const blurAmount = editContent.querySelector('[data-custom="textBlurAmount"]')?.value || 4;
                el.styles.color = blurColor;
                el.styles.textShadow = `0 0 ${blurAmount}px ${blurColor}`;
                // Remove gradient properties
                delete el.styles.backgroundImage;
                delete el.styles.backgroundClip;
                delete el.styles.WebkitBackgroundClip;
                delete el.styles.WebkitTextFillColor;
            } else {
                // Solid color - remove gradient and blur properties
                delete el.styles.backgroundImage;
                delete el.styles.backgroundClip;
                delete el.styles.WebkitBackgroundClip;
                delete el.styles.WebkitTextFillColor;
                delete el.styles.textShadow;
                // Keep the color property as set by the color input
            }
        }
    });

    // Animation
    el.animation = el.animation || {};
    editContent.querySelectorAll('[data-anim]').forEach(input => {
        const prop = input.dataset.anim;
        const val = input.type === 'range' ? parseFloat(input.value) : input.value;
        if (val) {
            el.animation[prop] = val;
        } else {
            delete el.animation[prop];
        }
    });

    // Action
    el.action = el.action || {};
    editContent.querySelectorAll('[data-action]').forEach(input => {
        const prop = input.dataset.action;
        if (input.value) {
            el.action[prop] = input.value;
        } else {
            delete el.action[prop];
        }
    });

    // Custom CSS
    editContent.querySelectorAll('[data-prop="customCss"]').forEach(input => {
        el.styles = stringToStyles(input.value);
    });
}

function renderEditContent(tab) {
    const el = state.editingElement;
    let html = '';

    if (tab === 'content') {
        html = renderContentTab(el);
    } else if (tab === 'style') {
        html = renderStyleTab(el);
    } else if (tab === 'animation') {
        html = renderAnimationTab(el);
    } else if (tab === 'action') {
        html = renderActionTab(el);
    } else if (tab === 'advanced') {
        html = renderAdvancedTab(el);
    }

    editContent.innerHTML = html;

    // Setup interactive handlers
    setupEditHandlers();
}

function setupEditHandlers() {
    // Range sliders - update display value
    editContent.querySelectorAll('input[type="range"]').forEach(range => {
        const display = range.parentElement.querySelector('span');
        range.addEventListener('input', () => {
            const unit = range.dataset.unit || '';
            display.textContent = range.value + unit;
        });
    });

    // Color inputs - sync color picker and text input
    editContent.querySelectorAll('.edit-color').forEach(colorRow => {
        const colorPicker = colorRow.querySelector('input[type="color"]');
        const textInput = colorRow.querySelector('input[type="text"]');

        if (colorPicker && textInput) {
            colorPicker.addEventListener('input', () => {
                textInput.value = colorPicker.value;
            });
            textInput.addEventListener('input', () => {
                if (/^#[0-9A-Fa-f]{6}$/.test(textInput.value)) {
                    colorPicker.value = textInput.value;
                }
            });
        }
    });

    // Button groups (single select)
    editContent.querySelectorAll('.edit-btn-group').forEach(group => {
        group.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    });

    // Button groups multi (toggle)
    editContent.querySelectorAll('.edit-btn-group-multi').forEach(group => {
        group.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');

                // Update style immediately
                const style = btn.dataset.style;
                const value = btn.dataset.value;

                if (btn.classList.contains('active')) {
                    state.editingElement.styles[style] = value;
                } else {
                    delete state.editingElement.styles[style];
                }
            });
        });
    });

    // Layout presets handler
    const layoutPresets = editContent.querySelector('.layout-presets');
    if (layoutPresets) {
        layoutPresets.querySelectorAll('.layout-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                applyLayoutPreset(state.editingElement, preset);
                layoutPresets.querySelectorAll('.layout-preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderCanvas();
                renderLayers();
                saveHistory();
            });
        });
    }

    // Anchor ID handler
    const anchorIdInput = editContent.querySelector('[data-custom="anchorId"]');
    if (anchorIdInput) {
        anchorIdInput.addEventListener('change', (e) => {
            state.editingElement.anchorId = e.target.value.trim();
            renderCanvas();
        });
    }

    // Child min-width handler
    const childMinWidthInput = editContent.querySelector('[data-custom="childMinWidth"]');
    if (childMinWidthInput) {
        childMinWidthInput.addEventListener('change', (e) => {
            state.editingElement.childMinWidth = e.target.value;
            renderCanvas();
        });
    }

    // Container templates handler
    editContent.querySelectorAll('.container-template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const template = btn.dataset.template;
            applyContainerTemplate(state.editingElement, template);
            renderCanvas();
            renderLayers();
            saveHistory();
        });
    });

    // Image file upload with compression
    const imageUpload = editContent.querySelector('#imageUpload');
    if (imageUpload) {
        imageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // Compress image before storing
                    const compressedDataUrl = await compressImage(file, 1920, 0.8);
                    const srcInput = editContent.querySelector('[data-attr="src"]');
                    if (srcInput) {
                        srcInput.value = compressedDataUrl;
                    }
                    state.editingElement.attrs = state.editingElement.attrs || {};
                    state.editingElement.attrs.src = compressedDataUrl;
                    // Ensure image fits within container
                    state.editingElement.styles = state.editingElement.styles || {};
                    state.editingElement.styles.maxWidth = '100%';
                    state.editingElement.styles.width = '100%';
                    state.editingElement.styles.height = 'auto';
                    state.editingElement.styles.boxSizing = 'border-box';
                } catch (err) {
                    // Fallback to original file if compression fails
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const dataUrl = event.target.result;
                        const srcInput = editContent.querySelector('[data-attr="src"]');
                        if (srcInput) srcInput.value = dataUrl;
                        state.editingElement.attrs = state.editingElement.attrs || {};
                        state.editingElement.attrs.src = dataUrl;
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    // Background type toggle
    const bgTypeGroup = editContent.querySelector('[data-custom="bgType"]');
    if (bgTypeGroup) {
        bgTypeGroup.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.value;
                const colorSection = editContent.querySelector('.bg-color-section');
                const photoSection = editContent.querySelector('.bg-photo-section');
                const gradientSection = editContent.querySelector('.bg-gradient-section');
                const blurSection = editContent.querySelector('.bg-blur-section');

                if (colorSection) colorSection.style.display = type === 'color' ? '' : 'none';
                if (photoSection) photoSection.style.display = type === 'photo' ? '' : 'none';
                if (gradientSection) gradientSection.style.display = type === 'gradient' ? '' : 'none';
                if (blurSection) blurSection.style.display = type === 'blur' ? '' : 'none';
            });
        });
    }

    // Background image upload
    const bgImageUpload = editContent.querySelector('#bgImageUpload');
    if (bgImageUpload) {
        bgImageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target.result;
                    const urlInput = editContent.querySelector('[data-custom="bgImageUrl"]');
                    if (urlInput) {
                        urlInput.value = dataUrl;
                    }
                    state.editingElement.styles.backgroundImage = `url(${dataUrl})`;
                    state.editingElement.styles.backgroundSize = state.editingElement.styles.backgroundSize || 'cover';
                    state.editingElement.styles.backgroundPosition = state.editingElement.styles.backgroundPosition || 'center';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Add gradient color button
    const addColorBtn = editContent.querySelector('#addGradientColor');
    if (addColorBtn) {
        addColorBtn.addEventListener('click', () => {
            const container = editContent.querySelector('#extraGradientColors');
            const count = container.querySelectorAll('.gradient-color-row').length + 3;
            const html = `
                <div class="edit-row gradient-color-row">
                    <label>Цвет ${count}</label>
                    <div class="edit-color">
                        <input type="color" data-custom="gradientColor${count}" value="#10b981">
                        <input type="text" class="edit-input" data-custom="gradientColor${count}" value="#10b981">
                    </div>
                    <button type="button" class="btn-remove-color" onclick="this.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    }

    // Text color type toggle
    const textColorTypeGroup = editContent.querySelector('[data-custom="textColorType"]');
    if (textColorTypeGroup) {
        textColorTypeGroup.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.value;
                const colorSection = editContent.querySelector('.text-color-section');
                const gradientSection = editContent.querySelector('.text-gradient-section');
                const blurSection = editContent.querySelector('.text-blur-section');

                if (colorSection) colorSection.style.display = type === 'color' ? '' : 'none';
                if (gradientSection) gradientSection.style.display = type === 'gradient' ? '' : 'none';
                if (blurSection) blurSection.style.display = type === 'blur' ? '' : 'none';
            });
        });
    }

    // Add text gradient color button
    const addTextColorBtn = editContent.querySelector('#addTextGradientColor');
    if (addTextColorBtn) {
        addTextColorBtn.addEventListener('click', () => {
            const container = editContent.querySelector('#extraTextGradientColors');
            const count = container.querySelectorAll('.gradient-color-row').length + 3;
            const html = `
                <div class="edit-row gradient-color-row">
                    <label>Цвет ${count}</label>
                    <div class="edit-color">
                        <input type="color" data-custom="textGradientColor${count}" value="#10b981">
                        <input type="text" class="edit-input" data-custom="textGradientColor${count}" value="#10b981">
                    </div>
                    <button type="button" class="btn-remove-color" onclick="this.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    }

    // Action type change
    const actionType = editContent.querySelector('#actionType');
    if (actionType) {
        actionType.addEventListener('change', () => {
            const type = actionType.value;
            editContent.querySelectorAll('[class*="action-"][class*="-section"]').forEach(s => s.style.display = 'none');
            if (type) {
                const section = editContent.querySelector(`.action-${type}-section`);
                if (section) section.style.display = '';
            }
        });
    }

    // Form settings handlers
    if (state.editingElement?.type === 'form') {
        state.editingElement.formSettings = state.editingElement.formSettings || {
            fields: { name: true, email: true, phone: false, message: false },
            buttonText: 'Отправить',
            buttonColor: '#3b82f6',
            successMessage: 'Спасибо! Ваша заявка отправлена.',
            webhook: '',
            notifyEmail: '',
            saveToBackend: true
        };

        // Field checkboxes
        ['Name', 'Email', 'Phone', 'Message'].forEach(field => {
            const checkbox = editContent.querySelector(`[data-custom="formField${field}"]`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    state.editingElement.formSettings.fields[field.toLowerCase()] = checkbox.checked;
                    updateFormContent();
                });
            }
        });

        // Button text
        const buttonTextInput = editContent.querySelector('[data-custom="formButtonText"]');
        if (buttonTextInput) {
            buttonTextInput.addEventListener('input', () => {
                state.editingElement.formSettings.buttonText = buttonTextInput.value;
                updateFormContent();
            });
        }

        // Button color
        const buttonColorInputs = editContent.querySelectorAll('[data-custom="formButtonColor"]');
        buttonColorInputs.forEach(input => {
            input.addEventListener('input', () => {
                state.editingElement.formSettings.buttonColor = input.value;
                // Sync color inputs
                buttonColorInputs.forEach(inp => inp.value = input.value);
                updateFormContent();
            });
        });

        // Success message
        const successInput = editContent.querySelector('[data-custom="formSuccessMessage"]');
        if (successInput) {
            successInput.addEventListener('input', () => {
                state.editingElement.formSettings.successMessage = successInput.value;
            });
        }

        // Webhook URL
        const webhookInput = editContent.querySelector('[data-custom="formWebhook"]');
        if (webhookInput) {
            webhookInput.addEventListener('input', () => {
                state.editingElement.formSettings.webhook = webhookInput.value;
            });
        }

        // Notify email
        const notifyInput = editContent.querySelector('[data-custom="formNotifyEmail"]');
        if (notifyInput) {
            notifyInput.addEventListener('input', () => {
                state.editingElement.formSettings.notifyEmail = notifyInput.value;
            });
        }

        // Save to backend checkbox
        const saveToBackendCheckbox = editContent.querySelector('[data-custom="formSaveToBackend"]');
        if (saveToBackendCheckbox) {
            saveToBackendCheckbox.addEventListener('change', () => {
                state.editingElement.formSettings.saveToBackend = saveToBackendCheckbox.checked;
            });
        }
    }

    // Animation sliders
    editContent.querySelectorAll('[data-anim]').forEach(input => {
        if (input.type === 'range') {
            const display = input.parentElement.querySelector('span');
            input.addEventListener('input', () => {
                display.textContent = input.value + 's';
            });
        }
    });

    // Font family select - load font on change
    const fontSelect = editContent.querySelector('#fontFamilySelect');
    if (fontSelect) {
        // Load fonts for preview in select options
        googleFonts.forEach(f => loadGoogleFont(f.name));

        fontSelect.addEventListener('change', () => {
            const fontName = fontSelect.value.replace(/['"]/g, '').split(',')[0].trim();
            if (fontName) {
                loadGoogleFont(fontName);
            }
        });
    }

    // Component settings handler
    editContent.querySelectorAll('[data-component]').forEach(input => {
        const updateComponentSetting = () => {
            const el = state.editingElement;
            if (!el.componentSettings) el.componentSettings = {};

            const key = input.dataset.component;
            let value = input.type === 'checkbox' ? input.checked : input.value;

            // Handle special cases for parsing complex data
            if (key === 'featuresText' && el.type === 'pricing') {
                // Pricing features - simple list
                el.componentSettings.features = value.split('\n').filter(l => l.trim());
            } else if (key === 'featuresText' && el.type === 'features') {
                // Parse features text into items array
                const blocks = value.split('\n\n').filter(b => b.trim());
                el.componentSettings.items = blocks.map(block => {
                    const lines = block.split('\n').filter(l => l.trim());
                    return {
                        icon: lines[0] || '',
                        title: lines[1] || '',
                        description: lines[2] || ''
                    };
                });
            } else if (key === 'counterText') {
                // Parse counter items
                const blocks = value.split('\n\n').filter(b => b.trim());
                el.componentSettings.items = blocks.map(block => {
                    const lines = block.split('\n').filter(l => l.trim());
                    return {
                        value: lines[0] || '',
                        label: lines[1] || ''
                    };
                });
            } else if (key === 'marqueeText') {
                el.componentSettings.items = value.split('\n').filter(l => l.trim());
            } else if (key === 'fieldsText') {
                // Parse modal form fields: type|name|label|placeholder|required
                el.componentSettings.fields = value.split('\n').filter(l => l.trim()).map(line => {
                    const parts = line.split('|');
                    return {
                        type: parts[0] || 'text',
                        name: parts[1] || '',
                        label: parts[2] || '',
                        placeholder: parts[3] || '',
                        required: (parts[4] || '').trim().toLowerCase() === 'required'
                    };
                });
            } else if (key === 'modulesText') {
                // Parse program modules: blocks separated by empty lines
                const blocks = value.split('\n\n').filter(b => b.trim());
                el.componentSettings.modules = blocks.map(block => {
                    const lines = block.split('\n').filter(l => l.trim());
                    return {
                        title: lines[0] || '',
                        items: lines.slice(1)
                    };
                });
            } else if (key === 'bioText') {
                // Parse speaker bio items
                el.componentSettings.bio = value.split('\n').filter(l => l.trim());
            } else if (key === 'columns' || key === 'speed') {
                el.componentSettings[key] = parseInt(value) || 0;
            } else {
                el.componentSettings[key] = value;
            }

            // Regenerate content from settings
            el.content = generateComponentContent(el.type, el.componentSettings);
            renderCanvas();
        };

        input.addEventListener('input', updateComponentSetting);
        input.addEventListener('change', updateComponentSetting);
    });

    // Hero background image handlers
    const heroBgUrlInput = editContent.querySelector('[data-custom="heroBgUrl"]');
    const heroBgOverlayInput = editContent.querySelector('[data-custom="heroBgOverlay"]');
    const heroBgRemoveBtn = editContent.querySelector('[data-custom="heroBgRemove"]');

    const updateHeroBg = () => {
        const el = state.editingElement;
        if (!el) return;
        const url = heroBgUrlInput ? heroBgUrlInput.value.trim() : '';
        const overlay = heroBgOverlayInput ? heroBgOverlayInput.value.trim() : 'rgba(0,0,0,0.5)';
        if (url) {
            el.styles.backgroundImage = `linear-gradient(${overlay}, ${overlay}), url(${url})`;
            if (!el.styles.backgroundSize) el.styles.backgroundSize = 'cover';
            if (!el.styles.backgroundPosition) el.styles.backgroundPosition = 'center';
            // Auto-set text color to white when background is added
            if (!el.componentSettings) el.componentSettings = {};
            if (!el.componentSettings.textColor || el.componentSettings.textColor === '#1e293b') {
                el.componentSettings.textColor = '#ffffff';
                const textColorInputs = editContent.querySelectorAll('[data-component="textColor"]');
                textColorInputs.forEach(inp => inp.value = '#ffffff');
            }
        } else {
            delete el.styles.backgroundImage;
            delete el.styles.backgroundSize;
            delete el.styles.backgroundPosition;
        }
        if (el.componentSettings) {
            el.content = generateComponentContent(el.type, el.componentSettings);
        }
        renderCanvas();
    };

    if (heroBgUrlInput) heroBgUrlInput.addEventListener('input', updateHeroBg);
    if (heroBgOverlayInput) heroBgOverlayInput.addEventListener('input', updateHeroBg);

    if (heroBgRemoveBtn) {
        heroBgRemoveBtn.addEventListener('click', () => {
            const el = state.editingElement;
            if (!el) return;
            delete el.styles.backgroundImage;
            delete el.styles.backgroundSize;
            delete el.styles.backgroundPosition;
            if (heroBgUrlInput) heroBgUrlInput.value = '';
            if (heroBgOverlayInput) heroBgOverlayInput.value = 'rgba(0,0,0,0.5)';
            if (el.componentSettings) {
                el.componentSettings.textColor = '#1e293b';
                const textColorInputs = editContent.querySelectorAll('[data-component="textColor"]');
                textColorInputs.forEach(inp => inp.value = '#1e293b');
                el.content = generateComponentContent(el.type, el.componentSettings);
            }
            renderCanvas();
        });
    }
}

function renderContentTab(el) {
    const s = el.styles || {};

    // Настройки по типам элементов
    const typeSettings = {
        // ===== ТЕКСТ =====
        heading: () => `
            <div class="edit-section">
                <h4><i class="fas fa-heading"></i> Заголовок</h4>
                <div class="edit-row">
                    <label>Текст заголовка</label>
                    <input type="text" class="edit-input" data-prop="content" value="${escapeHtml(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Уровень заголовка</label>
                    <select class="edit-select" data-custom="headingLevel">
                        <option value="h1" ${el.tag === 'h1' ? 'selected' : ''}>H1 - Главный</option>
                        <option value="h2" ${el.tag === 'h2' ? 'selected' : ''}>H2 - Подзаголовок</option>
                        <option value="h3" ${el.tag === 'h3' ? 'selected' : ''}>H3 - Секция</option>
                        <option value="h4" ${el.tag === 'h4' ? 'selected' : ''}>H4 - Подсекция</option>
                    </select>
                </div>
            </div>
        `,

        text: () => `
            <div class="edit-section">
                <h4><i class="fas fa-align-left"></i> Текст</h4>
                <div class="edit-row">
                    <label>Содержимое</label>
                    <textarea class="edit-textarea" data-prop="content" rows="5">${escapeHtml(el.content)}</textarea>
                </div>
            </div>
        `,

        // ===== ИЗОБРАЖЕНИЕ =====
        image: () => `
            <div class="edit-section">
                <h4><i class="fas fa-image"></i> Изображение</h4>
                <div class="edit-row">
                    <label>Загрузить изображение</label>
                    <div class="upload-row">
                        <input type="file" id="imageUpload" accept="image/*" class="edit-file-input">
                        <label for="imageUpload" class="btn-upload">
                            <i class="fas fa-upload"></i> Выбрать файл
                        </label>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Или вставьте URL</label>
                    <input type="text" class="edit-input" data-attr="src" value="${el.attrs?.src || ''}" placeholder="https://...">
                </div>
                <div class="edit-row">
                    <label>Описание (alt)</label>
                    <input type="text" class="edit-input" data-attr="alt" value="${el.attrs?.alt || ''}" placeholder="Описание изображения">
                </div>
            </div>
        `,

        // ===== КНОПКА =====
        button: () => {
            const anchors = collectAnchors();
            const anchorOptions = anchors.map(a => `<option value="#${a.id}" ${el.attrs?.href === '#' + a.id ? 'selected' : ''}>${a.label}</option>`).join('');
            return `
            <div class="edit-section">
                <h4><i class="fas fa-hand-pointer"></i> Кнопка</h4>
                <div class="edit-row">
                    <label>Текст кнопки</label>
                    <input type="text" class="edit-input" data-prop="content" value="${escapeHtml(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Ссылка</label>
                    <input type="text" class="edit-input" data-attr="href" value="${el.attrs?.href || '#'}" placeholder="https://...">
                </div>
                ${anchors.length ? `<div class="edit-row">
                    <label>Или выберите якорь на странице</label>
                    <select class="edit-select" data-custom="anchorSelect" onchange="if(this.value){this.closest('.edit-section').querySelector('[data-attr=\\'href\\']').value=this.value}">
                        <option value="">— Выберите якорь —</option>
                        ${anchorOptions}
                    </select>
                </div>` : ''}
                <div class="edit-row">
                    <label>Открывать в</label>
                    <select class="edit-select" data-attr="target">
                        <option value="">Текущем окне</option>
                        <option value="_blank" ${el.attrs?.target === '_blank' ? 'selected' : ''}>Новом окне</option>
                    </select>
                </div>
            </div>
        `},

        // ===== ССЫЛКА =====
        link: () => {
            const anchors = collectAnchors();
            const anchorOptions = anchors.map(a => `<option value="#${a.id}" ${el.attrs?.href === '#' + a.id ? 'selected' : ''}>${a.label}</option>`).join('');
            return `
            <div class="edit-section">
                <h4><i class="fas fa-link"></i> Ссылка</h4>
                <div class="edit-row">
                    <label>Текст ссылки</label>
                    <input type="text" class="edit-input" data-prop="content" value="${escapeHtml(el.content)}">
                </div>
                <div class="edit-row">
                    <label>URL</label>
                    <input type="text" class="edit-input" data-attr="href" value="${el.attrs?.href || '#'}" placeholder="https://...">
                </div>
                ${anchors.length ? `<div class="edit-row">
                    <label>Или выберите якорь на странице</label>
                    <select class="edit-select" data-custom="anchorSelect" onchange="if(this.value){this.closest('.edit-section').querySelector('[data-attr=\\'href\\']').value=this.value}">
                        <option value="">— Выберите якорь —</option>
                        ${anchorOptions}
                    </select>
                </div>` : ''}
                <div class="edit-row">
                    <label>Открывать в</label>
                    <select class="edit-select" data-attr="target">
                        <option value="">Текущем окне</option>
                        <option value="_blank" ${el.attrs?.target === '_blank' ? 'selected' : ''}>Новом окне</option>
                    </select>
                </div>
            </div>
        `},

        // ===== СПИСОК =====
        list: () => `
            <div class="edit-section">
                <h4><i class="fas fa-list"></i> Список</h4>
                <div class="edit-row">
                    <label>Пункты списка (каждый с новой строки)</label>
                    <textarea class="edit-textarea" data-custom="listItems" rows="6">${extractListItems(el.content)}</textarea>
                </div>
                <div class="edit-row">
                    <label>Тип списка</label>
                    <select class="edit-select" data-custom="listType">
                        <option value="ul" ${el.tag === 'ul' ? 'selected' : ''}>Маркированный (•)</option>
                        <option value="ol" ${el.tag === 'ol' ? 'selected' : ''}>Нумерованный (1, 2, 3)</option>
                    </select>
                </div>
            </div>
        `,

        // ===== РАЗДЕЛИТЕЛЬ =====
        divider: () => `
            <div class="edit-section">
                <h4><i class="fas fa-minus"></i> Разделитель</h4>
                <div class="edit-row">
                    <label>Стиль линии</label>
                    <select class="edit-select" data-style="borderTopStyle">
                        <option value="solid" ${s.borderTopStyle !== 'dashed' && s.borderTopStyle !== 'dotted' ? 'selected' : ''}>Сплошная</option>
                        <option value="dashed" ${s.borderTopStyle === 'dashed' ? 'selected' : ''}>Пунктирная</option>
                        <option value="dotted" ${s.borderTopStyle === 'dotted' ? 'selected' : ''}>Точечная</option>
                    </select>
                </div>
            </div>
        `,

        // ===== ОТСТУП =====
        spacer: () => `
            <div class="edit-section">
                <h4><i class="fas fa-arrows-alt-v"></i> Отступ</h4>
                <p class="edit-hint">Настройте высоту во вкладке "Стиль"</p>
            </div>
        `,

        // ===== ВИДЕО =====
        video: () => `
            <div class="edit-section">
                <h4><i class="fas fa-video"></i> Видео</h4>
                <div class="edit-row">
                    <label>Ссылка на YouTube</label>
                    <input type="text" class="edit-input" data-custom="videoUrl" value="${extractVideoUrl(el.content)}" placeholder="https://www.youtube.com/watch?v=...">
                </div>
                <p class="edit-hint">Вставьте ссылку на видео YouTube или Vimeo</p>
            </div>
        `,

        // ===== ИКОНКА =====
        icon: () => `
            <div class="edit-section">
                <h4><i class="fas fa-star"></i> Иконка</h4>
                <div class="edit-row">
                    <label>Класс иконки</label>
                    <input type="text" class="edit-input" data-attr="class" value="${el.attrs?.class || 'fas fa-star'}">
                </div>
                <p class="edit-hint">Примеры: fas fa-star, fas fa-heart, fas fa-check, fab fa-telegram</p>
            </div>
        `,

        // ===== КОНТЕЙНЕРЫ =====
        section: () => renderContainerSettings(el, 'Секция', 'fa-square'),
        container: () => renderContainerSettings(el, 'Контейнер', 'fa-box'),
        row: () => `
            <div class="edit-section">
                <h4><i class="fas fa-columns"></i> Строка</h4>
                <p class="edit-hint">Перетащите сюда колонки или другие элементы. Настройки расположения во вкладке "Стиль".</p>
            </div>
        `,
        column: () => `
            <div class="edit-section">
                <h4><i class="fas fa-grip-lines-vertical"></i> Колонка</h4>
                <p class="edit-hint">Перетащите сюда текст, изображения и другие элементы. Настройки размера во вкладке "Стиль".</p>
            </div>
        `,

        // ===== МЕДИА =====
        gallery: () => `
            <div class="edit-section">
                <h4><i class="fas fa-images"></i> Галерея</h4>
                <div class="edit-row">
                    <label>Изображения (URL, каждое с новой строки)</label>
                    <textarea class="edit-textarea" data-custom="galleryImages" rows="5">${extractGalleryImages(el.content)}</textarea>
                </div>
                <div class="edit-row">
                    <label>Колонок в ряду</label>
                    <select class="edit-select" data-style="gridTemplateColumns">
                        <option value="repeat(2, 1fr)" ${s.gridTemplateColumns?.includes('2') ? 'selected' : ''}>2 колонки</option>
                        <option value="repeat(3, 1fr)" ${s.gridTemplateColumns?.includes('3') ? 'selected' : ''}>3 колонки</option>
                        <option value="repeat(4, 1fr)" ${s.gridTemplateColumns?.includes('4') ? 'selected' : ''}>4 колонки</option>
                    </select>
                </div>
            </div>
        `,

        carousel: () => `
            <div class="edit-section">
                <h4><i class="fas fa-film"></i> Карусель</h4>
                <div class="edit-row">
                    <label>Изображения (URL, каждое с новой строки)</label>
                    <textarea class="edit-textarea" data-custom="carouselImages" rows="5">${extractCarouselImages(el.content)}</textarea>
                </div>
                <p class="edit-hint">Добавьте URL изображений для слайдов карусели</p>
            </div>
        `,

        // ===== ИНТЕРАКТИВ =====
        form: () => `
            <div class="edit-section">
                <h4><i class="fas fa-envelope"></i> Форма обратной связи</h4>
                <div class="edit-row">
                    <label>Текст кнопки отправки</label>
                    <input type="text" class="edit-input" data-custom="formButtonText" value="${extractFormButton(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Поля формы</label>
                    <div class="edit-checkbox-row">
                        <input type="checkbox" id="fieldName" data-custom="formFieldName" ${el.formSettings?.fields?.name !== false ? 'checked' : ''}>
                        <label for="fieldName">Имя</label>
                    </div>
                    <div class="edit-checkbox-row">
                        <input type="checkbox" id="fieldEmail" data-custom="formFieldEmail" ${el.formSettings?.fields?.email !== false ? 'checked' : ''}>
                        <label for="fieldEmail">Email</label>
                    </div>
                    <div class="edit-checkbox-row">
                        <input type="checkbox" id="fieldPhone" data-custom="formFieldPhone" ${el.formSettings?.fields?.phone ? 'checked' : ''}>
                        <label for="fieldPhone">Телефон</label>
                    </div>
                    <div class="edit-checkbox-row">
                        <input type="checkbox" id="fieldMessage" data-custom="formFieldMessage" ${el.formSettings?.fields?.message ? 'checked' : ''}>
                        <label for="fieldMessage">Сообщение</label>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Цвет кнопки</label>
                    <div class="edit-color">
                        <input type="color" value="${el.formSettings?.buttonColor || '#3b82f6'}" data-custom="formButtonColor">
                        <input type="text" class="edit-input" value="${el.formSettings?.buttonColor || '#3b82f6'}" data-custom="formButtonColor">
                    </div>
                </div>
            </div>
            <div class="edit-section">
                <h4><i class="fas fa-cog"></i> Настройки отправки</h4>
                <div class="edit-row">
                    <label>Сообщение после отправки</label>
                    <input type="text" class="edit-input" data-custom="formSuccessMessage" value="${el.formSettings?.successMessage || 'Спасибо! Ваша заявка отправлена.'}" placeholder="Спасибо! Ваша заявка отправлена.">
                </div>
                <div class="edit-row">
                    <label>Webhook URL (опционально)</label>
                    <input type="text" class="edit-input" data-custom="formWebhook" value="${el.formSettings?.webhook || ''}" placeholder="https://...">
                    <p class="edit-hint">Заявки будут отправляться на этот URL</p>
                </div>
                <div class="edit-row">
                    <label>Email для уведомлений (опционально)</label>
                    <input type="text" class="edit-input" data-custom="formNotifyEmail" value="${el.formSettings?.notifyEmail || ''}" placeholder="email@example.com">
                </div>
                <div class="edit-checkbox-row">
                    <input type="checkbox" id="saveToBackend" data-custom="formSaveToBackend" ${el.formSettings?.saveToBackend !== false ? 'checked' : ''}>
                    <label for="saveToBackend">Сохранять заявки в системе</label>
                </div>
            </div>
        `,

        accordion: () => `
            <div class="edit-section">
                <h4><i class="fas fa-chevron-down"></i> Аккордеон (FAQ)</h4>
                <div class="edit-row">
                    <label>Вопросы и ответы</label>
                    <textarea class="edit-textarea" data-custom="accordionItems" rows="8" placeholder="Вопрос 1
Ответ на вопрос 1

Вопрос 2
Ответ на вопрос 2">${extractAccordionItems(el.content)}</textarea>
                </div>
                <p class="edit-hint">Формат: Вопрос, затем Ответ. Разделяйте пары пустой строкой.</p>
            </div>
        `,

        tabs: () => `
            <div class="edit-section">
                <h4><i class="fas fa-folder"></i> Табы</h4>
                <div class="edit-row">
                    <label>Табы и содержимое</label>
                    <textarea class="edit-textarea" data-custom="tabsItems" rows="8" placeholder="Таб 1
Содержимое первого таба

Таб 2
Содержимое второго таба">${extractTabsItems(el.content)}</textarea>
                </div>
                <p class="edit-hint">Формат: Название таба, затем содержимое. Разделяйте пары пустой строкой.</p>
            </div>
        `,

        modal: () => `
            <div class="edit-section">
                <h4><i class="fas fa-window-restore"></i> Модальное окно</h4>
                <div class="edit-row">
                    <label>Текст кнопки открытия</label>
                    <input type="text" class="edit-input" data-custom="modalButtonText" value="${extractModalButton(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Заголовок окна</label>
                    <input type="text" class="edit-input" data-custom="modalTitle" value="${extractModalTitle(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Содержимое окна</label>
                    <textarea class="edit-textarea" data-custom="modalContent" rows="4">${extractModalContent(el.content)}</textarea>
                </div>
            </div>
            <div class="edit-section">
                <h4><i class="fas fa-palette"></i> Оформление</h4>
                <div class="edit-row">
                    <label>Цвет кнопки</label>
                    <div class="edit-color">
                        <input type="color" value="#3b82f6" data-custom="modalButtonColor">
                        <input type="text" class="edit-input" value="#3b82f6">
                    </div>
                </div>
            </div>
        `,

        timer: () => `
            <div class="edit-section">
                <h4><i class="fas fa-clock"></i> Таймер обратного отсчёта</h4>
                <div class="edit-row">
                    <label>Дата окончания</label>
                    <input type="datetime-local" class="edit-input" data-custom="timerDate" value="${getTimerDate(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Показывать</label>
                    <div class="edit-checkbox-row">
                        <input type="checkbox" id="showDays" checked>
                        <label for="showDays">Дни</label>
                    </div>
                    <div class="edit-checkbox-row">
                        <input type="checkbox" id="showHours" checked>
                        <label for="showHours">Часы</label>
                    </div>
                    <div class="edit-checkbox-row">
                        <input type="checkbox" id="showMinutes" checked>
                        <label for="showMinutes">Минуты</label>
                    </div>
                    <div class="edit-checkbox-row">
                        <input type="checkbox" id="showSeconds" checked>
                        <label for="showSeconds">Секунды</label>
                    </div>
                </div>
            </div>
        `,

        // ===== КОМПОНЕНТЫ =====
        navbar: () => `
            <div class="edit-section">
                <h4><i class="fas fa-bars"></i> Навигация</h4>
                <div class="edit-row">
                    <label>Логотип (текст)</label>
                    <input type="text" class="edit-input" data-custom="navLogo" value="${extractNavLogo(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Пункты меню (каждый с новой строки)</label>
                    <textarea class="edit-textarea" data-custom="navItems" rows="4">${extractNavItems(el.content)}</textarea>
                </div>
                <p class="edit-hint">Формат: Название или Название|ссылка</p>
            </div>
        `,

        hero: () => {
            const cs = el.componentSettings || { title: '', subtitle: '', buttonText: '', buttonUrl: '#', buttonColor: '#3b82f6', alignment: 'center', textColor: '#1e293b' };
            // Extract current background image URL and overlay from styles
            const bgImage = el.styles.backgroundImage || '';
            let currentBgUrl = '';
            let currentOverlay = 'rgba(0,0,0,0.5)';
            if (bgImage) {
                const urlMatch = bgImage.match(/url\(['"]?([^'")\s]+)['"]?\)/);
                if (urlMatch) currentBgUrl = urlMatch[1];
                const gradientMatch = bgImage.match(/linear-gradient\(([^,]+),/);
                if (gradientMatch) currentOverlay = gradientMatch[1].trim();
            }
            return `
            <div class="edit-section">
                <h4><i class="fas fa-flag"></i> Hero секция</h4>
                <div class="edit-row">
                    <label>Заголовок</label>
                    <input type="text" class="edit-input" data-component="title" value="${escapeHtml(cs.title)}">
                </div>
                <div class="edit-row">
                    <label>Подзаголовок</label>
                    <textarea class="edit-textarea" data-component="subtitle" rows="2">${escapeHtml(cs.subtitle)}</textarea>
                </div>
                <div class="edit-row">
                    <label>Текст кнопки</label>
                    <input type="text" class="edit-input" data-component="buttonText" value="${escapeHtml(cs.buttonText)}">
                </div>
                <div class="edit-row">
                    <label>Ссылка кнопки</label>
                    <input type="text" class="edit-input" data-component="buttonUrl" value="${cs.buttonUrl}" placeholder="https://...">
                </div>
                <div class="edit-row">
                    <label>Цвет кнопки</label>
                    <div class="edit-color">
                        <input type="color" value="${cs.buttonColor}" data-component="buttonColor">
                        <input type="text" class="edit-input" data-component="buttonColor" value="${cs.buttonColor}">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Цвет текста</label>
                    <div class="edit-color">
                        <input type="color" value="${cs.textColor || '#1e293b'}" data-component="textColor">
                        <input type="text" class="edit-input" data-component="textColor" value="${cs.textColor || '#1e293b'}">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Выравнивание</label>
                    <select class="edit-select" data-component="alignment">
                        <option value="left" ${cs.alignment === 'left' ? 'selected' : ''}>Слева</option>
                        <option value="center" ${cs.alignment === 'center' ? 'selected' : ''}>По центру</option>
                        <option value="right" ${cs.alignment === 'right' ? 'selected' : ''}>Справа</option>
                    </select>
                </div>
            </div>
            <div class="edit-section">
                <h4><i class="fas fa-image"></i> Фоновое изображение</h4>
                <div class="edit-row">
                    <label>URL изображения</label>
                    <input type="text" class="edit-input" data-custom="heroBgUrl" value="${escapeHtml(currentBgUrl)}" placeholder="https://images.unsplash.com/...">
                </div>
                <div class="edit-row">
                    <label>Цвет оверлея</label>
                    <input type="text" class="edit-input" data-custom="heroBgOverlay" value="${currentOverlay}" placeholder="rgba(0,0,0,0.5)">
                    <p class="edit-hint">Формат: rgba(0,0,0,0.5) — чёрный полупрозрачный</p>
                </div>
                <div class="edit-row">
                    <label>Размер фона</label>
                    <select class="edit-select" data-style="backgroundSize">
                        <option value="cover" ${(el.styles.backgroundSize || 'cover') === 'cover' ? 'selected' : ''}>Cover (заполнить)</option>
                        <option value="contain" ${el.styles.backgroundSize === 'contain' ? 'selected' : ''}>Contain (вписать)</option>
                        <option value="auto" ${el.styles.backgroundSize === 'auto' ? 'selected' : ''}>Авто</option>
                    </select>
                </div>
                <div class="edit-row">
                    <label>Позиция фона</label>
                    <select class="edit-select" data-style="backgroundPosition">
                        <option value="center" ${(el.styles.backgroundPosition || 'center') === 'center' ? 'selected' : ''}>Центр</option>
                        <option value="top" ${el.styles.backgroundPosition === 'top' ? 'selected' : ''}>Верх</option>
                        <option value="bottom" ${el.styles.backgroundPosition === 'bottom' ? 'selected' : ''}>Низ</option>
                        <option value="left" ${el.styles.backgroundPosition === 'left' ? 'selected' : ''}>Лево</option>
                        <option value="right" ${el.styles.backgroundPosition === 'right' ? 'selected' : ''}>Право</option>
                    </select>
                </div>
                <div class="edit-row">
                    <button class="btn" data-custom="heroBgRemove" style="width:100%;justify-content:center;"><i class="fas fa-trash"></i> Убрать фоновое изображение</button>
                </div>
            </div>
        `},

        features: () => {
            const cs = el.componentSettings || { columns: 3, items: [] };
            const itemsText = (cs.items || []).map(i => `${i.icon}\n${i.title}\n${i.description}`).join('\n\n');
            return `
            <div class="edit-section">
                <h4><i class="fas fa-th-large"></i> Преимущества</h4>
                <div class="edit-row">
                    <label>Преимущества</label>
                    <textarea class="edit-textarea" data-component="featuresText" rows="10" placeholder="🚀
Быстро
Описание преимущества

💡
Удобно
Описание преимущества">${itemsText}</textarea>
                </div>
                <p class="edit-hint">Формат: Иконка/эмодзи, Заголовок, Описание. Разделяйте блоки пустой строкой.</p>
            </div>
            <div class="edit-section">
                <h4><i class="fas fa-th"></i> Сетка</h4>
                <div class="edit-row">
                    <label>Колонок</label>
                    <select class="edit-select" data-component="columns">
                        <option value="2" ${cs.columns == 2 ? 'selected' : ''}>2 колонки</option>
                        <option value="3" ${cs.columns == 3 ? 'selected' : ''}>3 колонки</option>
                        <option value="4" ${cs.columns == 4 ? 'selected' : ''}>4 колонки</option>
                    </select>
                </div>
            </div>
        `},

        card: () => {
            const cs = el.componentSettings || { image: '', title: '', description: '', linkText: 'Подробнее →', linkUrl: '#' };
            return `
            <div class="edit-section">
                <h4><i class="fas fa-id-card"></i> Карточка</h4>
                <div class="edit-row">
                    <label>URL изображения</label>
                    <input type="text" class="edit-input" data-component="image" value="${cs.image}">
                </div>
                <div class="edit-row">
                    <label>Заголовок</label>
                    <input type="text" class="edit-input" data-component="title" value="${escapeHtml(cs.title)}">
                </div>
                <div class="edit-row">
                    <label>Описание</label>
                    <textarea class="edit-textarea" data-component="description" rows="3">${escapeHtml(cs.description)}</textarea>
                </div>
                <div class="edit-row">
                    <label>Текст ссылки</label>
                    <input type="text" class="edit-input" data-component="linkText" value="${escapeHtml(cs.linkText)}">
                </div>
                <div class="edit-row">
                    <label>URL ссылки</label>
                    <input type="text" class="edit-input" data-component="linkUrl" value="${cs.linkUrl}" placeholder="https://...">
                </div>
            </div>
        `},

        testimonial: () => {
            const cs = el.componentSettings || { quote: '', authorName: '', authorRole: '', authorPhoto: '' };
            return `
            <div class="edit-section">
                <h4><i class="fas fa-quote-left"></i> Отзыв</h4>
                <div class="edit-row">
                    <label>Текст отзыва</label>
                    <textarea class="edit-textarea" data-component="quote" rows="3">${escapeHtml(cs.quote)}</textarea>
                </div>
                <div class="edit-row">
                    <label>Имя автора</label>
                    <input type="text" class="edit-input" data-component="authorName" value="${escapeHtml(cs.authorName)}">
                </div>
                <div class="edit-row">
                    <label>Должность / компания</label>
                    <input type="text" class="edit-input" data-component="authorRole" value="${escapeHtml(cs.authorRole)}">
                </div>
                <div class="edit-row">
                    <label>Фото (URL)</label>
                    <input type="text" class="edit-input" data-component="authorPhoto" value="${cs.authorPhoto}">
                </div>
            </div>
        `},

        pricing: () => {
            const cs = el.componentSettings || { planName: '', price: '', currency: '$', period: '/мес', features: [], buttonText: 'Выбрать', buttonUrl: '#', buttonColor: '#3b82f6', highlighted: false };
            return `
            <div class="edit-section">
                <h4><i class="fas fa-tag"></i> Тариф</h4>
                <div class="edit-row">
                    <label>Название тарифа</label>
                    <input type="text" class="edit-input" data-component="planName" value="${escapeHtml(cs.planName)}">
                </div>
                <div class="edit-grid">
                    <div class="edit-row">
                        <label>Валюта</label>
                        <input type="text" class="edit-input" data-component="currency" value="${cs.currency}" style="width:60px;">
                    </div>
                    <div class="edit-row">
                        <label>Цена</label>
                        <input type="text" class="edit-input" data-component="price" value="${cs.price}">
                    </div>
                    <div class="edit-row">
                        <label>Период</label>
                        <input type="text" class="edit-input" data-component="period" value="${cs.period}" placeholder="/мес, /год">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Старая цена (зачёркнутая)</label>
                    <input type="text" class="edit-input" data-component="oldPrice" value="${cs.oldPrice || ''}" placeholder="Например: 49000">
                </div>
                <div class="edit-grid">
                    <div class="edit-row">
                        <label>Цена рассрочки</label>
                        <input type="text" class="edit-input" data-component="installmentPrice" value="${cs.installmentPrice || ''}" placeholder="Например: 3900">
                    </div>
                    <div class="edit-row">
                        <label>Период рассрочки</label>
                        <input type="text" class="edit-input" data-component="installmentPeriod" value="${cs.installmentPeriod || '/мес'}" placeholder="/мес">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Преимущества (каждое с новой строки)</label>
                    <textarea class="edit-textarea" data-component="featuresText" rows="4">${(cs.features || []).join('\n')}</textarea>
                </div>
                <div class="edit-row">
                    <label>Текст кнопки</label>
                    <input type="text" class="edit-input" data-component="buttonText" value="${escapeHtml(cs.buttonText)}">
                </div>
                <div class="edit-row">
                    <label>ID модальной формы (кнопка откроет форму)</label>
                    <input type="text" class="edit-input" data-component="modalFormId" value="${cs.modalFormId || ''}" placeholder="modal_form_1">
                </div>
                <div class="edit-row">
                    <label>Цвет кнопки</label>
                    <div class="edit-color">
                        <input type="color" value="${cs.buttonColor}" data-component="buttonColor">
                        <input type="text" class="edit-input" value="${cs.buttonColor}" data-component="buttonColor">
                    </div>
                </div>
                <div class="edit-row">
                    <label>
                        <input type="checkbox" data-component="highlighted" ${cs.highlighted ? 'checked' : ''}> Выделенный тариф
                    </label>
                </div>
            </div>
        `},

        counter: () => {
            const cs = el.componentSettings || { items: [], color: '#3b82f6' };
            const itemsText = (cs.items || []).map(i => `${i.value}\n${i.label}`).join('\n\n');
            return `
            <div class="edit-section">
                <h4><i class="fas fa-sort-numeric-up"></i> Счётчики</h4>
                <div class="edit-row">
                    <label>Счётчики</label>
                    <textarea class="edit-textarea" data-component="counterText" rows="6" placeholder="500+
Клиентов

10
Лет опыта

99%
Довольных">${itemsText}</textarea>
                </div>
                <p class="edit-hint">Формат: Число, затем Подпись. Разделяйте пары пустой строкой.</p>
                <div class="edit-row">
                    <label>Цвет чисел</label>
                    <div class="edit-color">
                        <input type="color" value="${cs.color}" data-component="color">
                        <input type="text" class="edit-input" value="${cs.color}" data-component="color">
                    </div>
                </div>
            </div>
        `},

        progress: () => `
            <div class="edit-section">
                <h4><i class="fas fa-tasks"></i> Прогресс-бары</h4>
                <div class="edit-row">
                    <label>Навыки / прогресс</label>
                    <textarea class="edit-textarea" data-custom="progressItems" rows="6" placeholder="HTML/CSS
90

JavaScript
75

React
60">${extractProgressItems(el.content)}</textarea>
                </div>
                <p class="edit-hint">Формат: Название, затем процент (0-100). Разделяйте пары пустой строкой.</p>
                <div class="edit-row">
                    <label>Цвет заполнения</label>
                    <div class="edit-color">
                        <input type="color" value="#3b82f6" data-custom="progressColor">
                        <input type="text" class="edit-input" value="#3b82f6">
                    </div>
                </div>
            </div>
        `,

        social: () => `
            <div class="edit-section">
                <h4><i class="fas fa-share-alt"></i> Социальные сети</h4>
                <div class="edit-row">
                    <label>Facebook</label>
                    <input type="text" class="edit-input" data-custom="socialFacebook" placeholder="https://facebook.com/...">
                </div>
                <div class="edit-row">
                    <label>Instagram</label>
                    <input type="text" class="edit-input" data-custom="socialInstagram" placeholder="https://instagram.com/...">
                </div>
                <div class="edit-row">
                    <label>Telegram</label>
                    <input type="text" class="edit-input" data-custom="socialTelegram" placeholder="https://t.me/...">
                </div>
                <div class="edit-row">
                    <label>VK</label>
                    <input type="text" class="edit-input" data-custom="socialVk" placeholder="https://vk.com/...">
                </div>
                <div class="edit-row">
                    <label>YouTube</label>
                    <input type="text" class="edit-input" data-custom="socialYoutube" placeholder="https://youtube.com/...">
                </div>
                <div class="edit-row">
                    <label>WhatsApp</label>
                    <input type="text" class="edit-input" data-custom="socialWhatsapp" placeholder="https://wa.me/...">
                </div>
            </div>
        `,

        map: () => `
            <div class="edit-section">
                <h4><i class="fas fa-map-marker-alt"></i> Карта</h4>
                <div class="edit-row">
                    <label>Код карты (iframe)</label>
                    <textarea class="edit-textarea code" data-custom="mapEmbed" rows="6">${extractMapEmbed(el.content)}</textarea>
                </div>
                <p class="edit-hint">Вставьте код iframe с Google Maps или Яндекс.Карт</p>
                <div class="edit-row">
                    <label>Высота карты</label>
                    <div class="edit-range-row">
                        <input type="range" min="200" max="600" value="300" data-custom="mapHeight">
                        <span>300px</span>
                    </div>
                </div>
            </div>
        `,

        table: () => `
            <div class="edit-section">
                <h4><i class="fas fa-table"></i> Таблица</h4>
                <div class="edit-row">
                    <label>Заголовки (через |)</label>
                    <input type="text" class="edit-input" data-custom="tableHeaders" value="${extractTableHeaders(el.content)}" placeholder="Колонка 1|Колонка 2|Колонка 3">
                </div>
                <div class="edit-row">
                    <label>Данные (каждая строка с новой строки, ячейки через |)</label>
                    <textarea class="edit-textarea" data-custom="tableRows" rows="5">${extractTableRows(el.content)}</textarea>
                </div>
                <p class="edit-hint">Пример: Ячейка 1|Ячейка 2|Ячейка 3</p>
            </div>
        `,

        footer: () => `
            <div class="edit-section">
                <h4><i class="fas fa-shoe-prints"></i> Футер</h4>
                <div class="edit-row">
                    <label>Название компании</label>
                    <input type="text" class="edit-input" data-custom="footerCompany" value="${extractFooterCompany(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Копирайт</label>
                    <input type="text" class="edit-input" data-custom="footerCopyright" value="${extractFooterCopyright(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Email</label>
                    <input type="text" class="edit-input" data-custom="footerEmail" value="${extractFooterEmail(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Телефон</label>
                    <input type="text" class="edit-input" data-custom="footerPhone" value="${extractFooterPhone(el.content)}">
                </div>
            </div>
        `,

        // ===== КОД =====
        html: () => `
            <div class="edit-section">
                <h4><i class="fab fa-html5"></i> HTML код</h4>
                <div class="edit-row">
                    <textarea class="edit-textarea code" data-prop="content" rows="15">${escapeHtml(el.content)}</textarea>
                </div>
            </div>
        `,
        css: () => `
            <div class="edit-section">
                <h4><i class="fab fa-css3-alt"></i> CSS стили</h4>
                <div class="edit-row">
                    <textarea class="edit-textarea code" data-prop="content" rows="15">${escapeHtml(el.content)}</textarea>
                </div>
            </div>
        `,
        js: () => `
            <div class="edit-section">
                <h4><i class="fab fa-js"></i> JavaScript код</h4>
                <div class="edit-row">
                    <textarea class="edit-textarea code" data-prop="content" rows="15">${escapeHtml(el.content)}</textarea>
                </div>
            </div>
        `,
        widget: () => `
            <div class="edit-section">
                <h4><i class="fas fa-plug"></i> Виджет</h4>
                <div class="edit-row">
                    <label>Вставьте код виджета</label>
                    <textarea class="edit-textarea code" data-prop="content" rows="10">${escapeHtml(el.content)}</textarea>
                </div>
                <p class="edit-hint">Код виджета от стороннего сервиса (чат, формы, аналитика и т.д.)</p>
            </div>
        `,

        parallaxSection: () => {
            const cs = el.componentSettings || { title: '', subtitle: '', buttonText: '', buttonUrl: '#', overlayColor: 'rgba(0,0,0,0.4)' };
            return `
            <div class="edit-section">
                <h4><i class="fas fa-layer-group"></i> Параллакс секция</h4>
                <div class="edit-row">
                    <label>Заголовок</label>
                    <input type="text" class="edit-input" data-component="title" value="${escapeHtml(cs.title)}">
                </div>
                <div class="edit-row">
                    <label>Подзаголовок</label>
                    <textarea class="edit-textarea" data-component="subtitle" rows="2">${escapeHtml(cs.subtitle)}</textarea>
                </div>
                <div class="edit-row">
                    <label>Текст кнопки</label>
                    <input type="text" class="edit-input" data-component="buttonText" value="${escapeHtml(cs.buttonText)}">
                </div>
                <div class="edit-row">
                    <label>Ссылка кнопки</label>
                    <input type="text" class="edit-input" data-component="buttonUrl" value="${cs.buttonUrl}">
                </div>
            </div>
            <div class="edit-section">
                <h4><i class="fas fa-image"></i> Фоновое изображение</h4>
                <p class="edit-hint">Настройте фоновое изображение во вкладке "Стиль" → Фон → Фото</p>
            </div>
        `},

        marquee: () => {
            const cs = el.componentSettings || { items: [], speed: 20 };
            return `
            <div class="edit-section">
                <h4><i class="fas fa-text-width"></i> Бегущая строка</h4>
                <div class="edit-row">
                    <label>Текст (каждый элемент с новой строки)</label>
                    <textarea class="edit-textarea" data-component="marqueeText" rows="4">${(cs.items || []).join('\n')}</textarea>
                </div>
                <div class="edit-row">
                    <label>Скорость (секунд на цикл)</label>
                    <div class="edit-range-row">
                        <input type="range" min="5" max="60" value="${cs.speed || 20}" data-component="speed">
                        <span>${cs.speed || 20}s</span>
                    </div>
                </div>
            </div>
        `},

        modalForm: () => {
            const cs = el.componentSettings || {};
            const fieldsText = (cs.fields || []).map(f => {
                const parts = [f.type || 'text', f.name || '', f.label || '', f.placeholder || '', f.required ? 'required' : ''];
                return parts.join('|');
            }).join('\n');
            return `
            <div class="edit-section">
                <h4><i class="fas fa-window-maximize"></i> Модальная форма</h4>
                <div class="edit-row">
                    <label>ID модального окна</label>
                    <input type="text" class="edit-input" data-component="modalId" value="${cs.modalId || 'modal_form_1'}">
                </div>
                <div class="edit-row">
                    <label>Текст кнопки</label>
                    <input type="text" class="edit-input" data-component="buttonText" value="${escapeHtml(cs.buttonText || '')}">
                </div>
                <div class="edit-row">
                    <label>Цвет кнопки</label>
                    <div class="edit-color">
                        <input type="color" value="${cs.buttonColor || '#3b82f6'}" data-component="buttonColor">
                        <input type="text" class="edit-input" value="${cs.buttonColor || '#3b82f6'}" data-component="buttonColor">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Заголовок формы</label>
                    <input type="text" class="edit-input" data-component="title" value="${escapeHtml(cs.title || '')}">
                </div>
                <div class="edit-row">
                    <label>Подзаголовок</label>
                    <input type="text" class="edit-input" data-component="subtitle" value="${escapeHtml(cs.subtitle || '')}">
                </div>
                <div class="edit-row">
                    <label>Поля формы (тип|имя|метка|placeholder|required)</label>
                    <textarea class="edit-textarea" data-component="fieldsText" rows="5" placeholder="text|name|Ваше имя|Введите имя|required
tel|phone|Телефон|+7|required
email|email|Email|email@example.com|">${fieldsText}</textarea>
                </div>
                <p class="edit-hint">Формат: тип|имя|метка|placeholder|required</p>
                <div class="edit-row">
                    <label>Текст кнопки отправки</label>
                    <input type="text" class="edit-input" data-component="submitText" value="${escapeHtml(cs.submitText || 'Отправить')}">
                </div>
                <div class="edit-row">
                    <label>Сообщение после отправки</label>
                    <input type="text" class="edit-input" data-component="successMessage" value="${escapeHtml(cs.successMessage || '')}">
                </div>
            </div>
        `},

        program: () => {
            const cs = el.componentSettings || { title: '', modules: [], accentColor: '#3b82f6' };
            const modulesText = (cs.modules || []).map(m => {
                return m.title + '\n' + (m.items || []).join('\n');
            }).join('\n\n');
            return `
            <div class="edit-section">
                <h4><i class="fas fa-graduation-cap"></i> Программа курса</h4>
                <div class="edit-row">
                    <label>Заголовок</label>
                    <input type="text" class="edit-input" data-component="title" value="${escapeHtml(cs.title)}">
                </div>
                <div class="edit-row">
                    <label>Модули и темы</label>
                    <textarea class="edit-textarea" data-component="modulesText" rows="12" placeholder="Модуль 1. Введение
Тема 1
Тема 2

Модуль 2. Основы
Тема 1
Тема 2">${modulesText}</textarea>
                </div>
                <p class="edit-hint">Первая строка блока — название модуля, остальные — темы. Разделяйте модули пустой строкой.</p>
                <div class="edit-row">
                    <label>Цвет акцента</label>
                    <div class="edit-color">
                        <input type="color" value="${cs.accentColor || '#3b82f6'}" data-component="accentColor">
                        <input type="text" class="edit-input" value="${cs.accentColor || '#3b82f6'}" data-component="accentColor">
                    </div>
                </div>
            </div>
        `},

        speaker: () => {
            const cs = el.componentSettings || {};
            const bioText = (cs.bio || []).join('\n');
            return `
            <div class="edit-section">
                <h4><i class="fas fa-user-tie"></i> Спикер / Автор</h4>
                <div class="edit-row">
                    <label>Имя</label>
                    <input type="text" class="edit-input" data-component="name" value="${escapeHtml(cs.name || '')}">
                </div>
                <div class="edit-row">
                    <label>Роль / Должность</label>
                    <input type="text" class="edit-input" data-component="role" value="${escapeHtml(cs.role || '')}">
                </div>
                <div class="edit-row">
                    <label>URL фото</label>
                    <input type="text" class="edit-input" data-component="photo" value="${cs.photo || ''}">
                </div>
                <div class="edit-row">
                    <label>Биография (каждый пункт с новой строки)</label>
                    <textarea class="edit-textarea" data-component="bioText" rows="5">${bioText}</textarea>
                </div>
                <div class="edit-row">
                    <label>Цвет акцента</label>
                    <div class="edit-color">
                        <input type="color" value="${cs.accentColor || '#3b82f6'}" data-component="accentColor">
                        <input type="text" class="edit-input" value="${cs.accentColor || '#3b82f6'}" data-component="accentColor">
                    </div>
                </div>
            </div>
            <div class="edit-section">
                <h4><i class="fas fa-share-alt"></i> Социальные сети</h4>
                <div class="edit-row">
                    <label>Telegram</label>
                    <input type="text" class="edit-input" data-component="socialTelegram" value="${cs.socialTelegram || ''}" placeholder="https://t.me/...">
                </div>
                <div class="edit-row">
                    <label>Instagram</label>
                    <input type="text" class="edit-input" data-component="socialInstagram" value="${cs.socialInstagram || ''}" placeholder="https://instagram.com/...">
                </div>
                <div class="edit-row">
                    <label>YouTube</label>
                    <input type="text" class="edit-input" data-component="socialYoutube" value="${cs.socialYoutube || ''}" placeholder="https://youtube.com/...">
                </div>
                <div class="edit-row">
                    <label>LinkedIn</label>
                    <input type="text" class="edit-input" data-component="socialLinkedin" value="${cs.socialLinkedin || ''}" placeholder="https://linkedin.com/in/...">
                </div>
            </div>
        `},

        analytics: () => {
            const cs = el.componentSettings || {};
            return `
            <div class="edit-section">
                <h4><i class="fas fa-chart-bar"></i> Коды аналитики</h4>
                <p class="edit-hint">Этот блок невидим на сайте. Скрипты аналитики будут добавлены в &lt;head&gt; экспортированной страницы.</p>
                <div class="edit-row">
                    <label>Яндекс.Метрика ID</label>
                    <input type="text" class="edit-input" data-component="yandexMetrikaId" value="${cs.yandexMetrikaId || ''}" placeholder="12345678">
                </div>
                <div class="edit-row">
                    <label>Google Analytics ID</label>
                    <input type="text" class="edit-input" data-component="googleAnalyticsId" value="${cs.googleAnalyticsId || ''}" placeholder="G-XXXXXXXXXX">
                </div>
                <div class="edit-row">
                    <label>Facebook Pixel ID</label>
                    <input type="text" class="edit-input" data-component="facebookPixelId" value="${cs.facebookPixelId || ''}" placeholder="123456789012345">
                </div>
                <div class="edit-row">
                    <label>VK Pixel ID</label>
                    <input type="text" class="edit-input" data-component="vkPixelId" value="${cs.vkPixelId || ''}" placeholder="VK-RTRG-123456-XXXXX">
                </div>
            </div>
        `},

        legalFooter: () => {
            const cs = el.componentSettings || {};
            return `
            <div class="edit-section">
                <h4><i class="fas fa-balance-scale"></i> Юридический подвал</h4>
                <div class="edit-row">
                    <label>Название компании</label>
                    <input type="text" class="edit-input" data-component="companyName" value="${escapeHtml(cs.companyName || '')}">
                </div>
                <div class="edit-grid">
                    <div class="edit-row">
                        <label>ИНН</label>
                        <input type="text" class="edit-input" data-component="inn" value="${cs.inn || ''}">
                    </div>
                    <div class="edit-row">
                        <label>ОГРН</label>
                        <input type="text" class="edit-input" data-component="ogrn" value="${cs.ogrn || ''}">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Ссылка на оферту</label>
                    <input type="text" class="edit-input" data-component="offerUrl" value="${cs.offerUrl || ''}" placeholder="https://...">
                </div>
                <div class="edit-row">
                    <label>Ссылка на политику конфиденциальности</label>
                    <input type="text" class="edit-input" data-component="privacyUrl" value="${cs.privacyUrl || ''}" placeholder="https://...">
                </div>
                <div class="edit-row">
                    <label>Email</label>
                    <input type="text" class="edit-input" data-component="email" value="${cs.email || ''}">
                </div>
                <div class="edit-row">
                    <label>Телефон</label>
                    <input type="text" class="edit-input" data-component="phone" value="${cs.phone || ''}">
                </div>
            </div>
            <div class="edit-section">
                <h4><i class="fas fa-share-alt"></i> Социальные сети</h4>
                <div class="edit-row">
                    <label>Telegram</label>
                    <input type="text" class="edit-input" data-component="socialTelegram" value="${cs.socialTelegram || ''}" placeholder="https://t.me/...">
                </div>
                <div class="edit-row">
                    <label>VK</label>
                    <input type="text" class="edit-input" data-component="socialVk" value="${cs.socialVk || ''}" placeholder="https://vk.com/...">
                </div>
                <div class="edit-row">
                    <label>Instagram</label>
                    <input type="text" class="edit-input" data-component="socialInstagram" value="${cs.socialInstagram || ''}" placeholder="https://instagram.com/...">
                </div>
                <div class="edit-row">
                    <label>YouTube</label>
                    <input type="text" class="edit-input" data-component="socialYoutube" value="${cs.socialYoutube || ''}" placeholder="https://youtube.com/...">
                </div>
            </div>
        `}
    };

    // Если есть специфичные настройки для типа - используем их
    if (typeSettings[el.type]) {
        return typeSettings[el.type]();
    }

    // Для остальных типов - общие настройки
    return `
        <div class="edit-section">
            <h4><i class="fas ${el.icon}"></i> ${el.label}</h4>
            <div class="edit-row">
                <label>HTML содержимое</label>
                <textarea class="edit-textarea" data-prop="content" rows="10">${escapeHtml(el.content)}</textarea>
            </div>
        </div>
    `;
}

// Настройки для контейнеров
function renderContainerSettings(el, title, icon) {
    return `
        <div class="edit-section">
            <h4><i class="fas ${icon}"></i> ${title}</h4>
            <p class="edit-hint">Перетащите сюда другие блоки: колонки, строки, текст, изображения и т.д. Все настройки оформления во вкладке "Стиль".</p>
        </div>

        <div class="edit-section">
            <h4><i class="fas fa-magic"></i> Быстрые шаблоны</h4>
            <div class="container-templates">
                <button type="button" class="container-template-btn" data-template="hero">
                    <i class="fas fa-flag"></i>
                    <span>Hero секция</span>
                </button>
                <button type="button" class="container-template-btn" data-template="features">
                    <i class="fas fa-th-large"></i>
                    <span>3 колонки</span>
                </button>
                <button type="button" class="container-template-btn" data-template="two-cols">
                    <i class="fas fa-columns"></i>
                    <span>Текст + Фото</span>
                </button>
                <button type="button" class="container-template-btn" data-template="pricing">
                    <i class="fas fa-tags"></i>
                    <span>Карточки цен</span>
                </button>
                <button type="button" class="container-template-btn" data-template="cta">
                    <i class="fas fa-bullhorn"></i>
                    <span>CTA блок</span>
                </button>
            </div>
        </div>
    `;
}

// Вспомогательные функции для извлечения данных
function extractListItems(content) {
    const matches = content.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    return matches.map(m => m.replace(/<\/?li[^>]*>/gi, '')).join('\n');
}

function extractVideoUrl(content) {
    const match = content.match(/src="([^"]+)"/);
    if (match) {
        const embedUrl = match[1];
        const videoId = embedUrl.match(/embed\/([^?]+)/);
        if (videoId) {
            return `https://www.youtube.com/watch?v=${videoId[1]}`;
        }
    }
    return '';
}

function extractGalleryImages(content) {
    const matches = content.match(/src="([^"]+)"/gi) || [];
    return matches.map(m => m.replace(/src="|"/g, '')).join('\n');
}

function extractCarouselImages(content) {
    return extractGalleryImages(content);
}

function extractFormButton(content) {
    const match = content.match(/<button[^>]*>([^<]+)<\/button>/i);
    return match ? match[1] : 'Отправить';
}

function extractAccordionItems(content) {
    const questions = content.match(/<summary[^>]*>([^<]+)<\/summary>/gi) || [];
    const answers = content.match(/<p[^>]*>([^<]+)<\/p>/gi) || [];
    let result = [];
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i].replace(/<\/?summary[^>]*>/gi, '');
        const a = answers[i] ? answers[i].replace(/<\/?p[^>]*>/gi, '') : '';
        result.push(q + '\n' + a);
    }
    return result.join('\n\n');
}

function extractTabsItems(content) {
    const tabs = content.match(/<button[^>]*>([^<]+)<\/button>/gi) || [];
    return tabs.map(t => t.replace(/<\/?button[^>]*>/gi, '')).join('\n');
}

function extractModalButton(content) {
    const match = content.match(/<button[^>]*>([^<]+)<\/button>/i);
    return match ? match[1] : 'Открыть окно';
}

function extractModalTitle(content) {
    const match = content.match(/<h3[^>]*>([^<]+)<\/h3>/i);
    return match ? match[1] : 'Заголовок окна';
}

function extractModalContent(content) {
    const match = content.match(/<p>([^<]+)<\/p>/);
    return match ? match[1] : 'Содержимое модального окна';
}

function getTimerDate(content) {
    const now = new Date();
    now.setDate(now.getDate() + 7);
    return now.toISOString().slice(0, 16);
}

function extractNavLogo(content) {
    const match = content.match(/>([^<]+)<\/a>/);
    return match ? match[1] : 'Logo';
}

function extractNavItems(content) {
    const matches = content.match(/<a[^>]*>([^<]+)<\/a>/gi) || [];
    return matches.slice(1).map(m => m.replace(/<\/?a[^>]*>/gi, '')).join('\n');
}

function extractHeroTitle(content) {
    const match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    return match ? match[1] : 'Заголовок';
}

function extractHeroSubtitle(content) {
    const match = content.match(/<p[^>]*>([^<]+)<\/p>/i);
    return match ? match[1] : 'Подзаголовок';
}

function extractHeroButton(content) {
    const match = content.match(/<a[^>]*>([^<]+)<\/a>/i);
    return match ? match[1] : 'Начать';
}

function extractFeaturesItems(content) {
    return '🚀\nБыстро\nОписание\n\n💡\nУдобно\nОписание\n\n✨\nКачественно\nОписание';
}

function extractCardImage(content) {
    const match = content.match(/src="([^"]+)"/);
    return match ? match[1] : '';
}

function extractCardTitle(content) {
    const match = content.match(/<h3[^>]*>([^<]+)<\/h3>/i);
    return match ? match[1] : 'Заголовок';
}

function extractCardDescription(content) {
    const match = content.match(/<p[^>]*>([^<]+)<\/p>/i);
    return match ? match[1] : 'Описание';
}

function extractTestimonialText(content) {
    const match = content.match(/"([^"]+)"/);
    return match ? match[1] : 'Отзыв клиента';
}

function extractTestimonialName(content) {
    const match = content.match(/font-weight:600[^>]*>([^<]+)</i);
    return match ? match[1] : 'Имя Фамилия';
}

function extractTestimonialRole(content) {
    const match = content.match(/font-size:14px[^>]*>([^<]+)</i);
    return match ? match[1] : 'Должность';
}

function extractTestimonialPhoto(content) {
    const match = content.match(/src="([^"]+)"/);
    return match ? match[1] : '';
}

function extractPricingName(content) {
    const match = content.match(/<h3[^>]*>([^<]+)<\/h3>/i);
    return match ? match[1] : 'Базовый';
}

function extractPricingPrice(content) {
    const match = content.match(/(\$?\d+)/);
    return match ? match[1] : '$29';
}

function extractPricingFeatures(content) {
    const matches = content.match(/✓\s*([^<]+)/gi) || [];
    return matches.map(m => m.replace('✓ ', '')).join('\n');
}

function extractCounterItems(content) {
    return '500+\nКлиентов\n\n10\nЛет опыта\n\n99%\nДовольных';
}

function extractProgressItems(content) {
    return 'HTML/CSS\n90\n\nJavaScript\n75';
}

function extractMapEmbed(content) {
    const match = content.match(/<iframe[^>]+>/i);
    return match ? match[0] + '</iframe>' : '';
}

function extractTableHeaders(content) {
    const matches = content.match(/<th[^>]*>([^<]+)<\/th>/gi) || [];
    return matches.map(m => m.replace(/<\/?th[^>]*>/gi, '')).join('|');
}

function extractTableRows(content) {
    const rows = content.match(/<tr>[\s\S]*?<\/tr>/gi) || [];
    return rows.slice(1).map(row => {
        const cells = row.match(/<td[^>]*>([^<]+)<\/td>/gi) || [];
        return cells.map(c => c.replace(/<\/?td[^>]*>/gi, '')).join('|');
    }).join('\n');
}

function extractFooterCompany(content) {
    const match = content.match(/<h4[^>]*>([^<]+)<\/h4>/i);
    return match ? match[1] : 'Компания';
}

function extractFooterCopyright(content) {
    const match = content.match(/©\s*\d+\s*([^<]+)/i);
    return match ? '© 2024 ' + match[1] : '© 2024 Все права защищены';
}

function extractFooterEmail(content) {
    const match = content.match(/[\w.-]+@[\w.-]+\.\w+/);
    return match ? match[0] : 'email@example.com';
}

function extractFooterPhone(content) {
    const match = content.match(/\+?\d[\d\s()-]+/);
    return match ? match[0] : '+7 (999) 123-45-67';
}

function renderStyleTab(el) {
    // Get styles for current viewport
    const s = getStylesForViewport(el);

    // Show viewport indicator if editing responsive styles
    const viewportIndicator = state.viewport !== 'desktop' ? `
        <div class="edit-section" style="background: rgba(59, 130, 246, 0.1); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px; color: var(--accent);">
                <i class="fas fa-${state.viewport === 'tablet' ? 'tablet-alt' : 'mobile-alt'}"></i>
                <span>Редактирование стилей для <strong>${state.viewport === 'tablet' ? 'планшета' : 'мобильного'}</strong></span>
            </div>
            <p class="edit-hint" style="margin-top: 8px;">Изменения применятся только для ${state.viewport === 'tablet' ? 'экранов ≤1024px' : 'экранов ≤640px'}</p>
        </div>
    ` : '';

    // Determine background type
    let bgType = 'color';
    if (s.background?.includes('gradient')) {
        bgType = 'gradient';
    } else if (s.backgroundImage?.startsWith('url')) {
        bgType = 'photo';
    } else if (s.backdropFilter?.includes('blur') || s.WebkitBackdropFilter?.includes('blur')) {
        bgType = 'blur';
    }
    const gradientColors = extractGradientColors(s.background);

    return `
        ${viewportIndicator}
        <div class="edit-section">
            <h4><i class="fas fa-expand-arrows-alt"></i> Размер</h4>
            <div class="edit-grid">
                <div class="edit-row">
                    <label>Ширина</label>
                    <input type="text" class="edit-input" data-style="width" value="${s.width || ''}" placeholder="auto">
                </div>
                <div class="edit-row">
                    <label>Высота</label>
                    <input type="text" class="edit-input" data-style="height" value="${s.height || ''}" placeholder="auto">
                </div>
            </div>
            <div class="edit-row">
                <label>Максимальная ширина</label>
                <input type="text" class="edit-input" data-style="maxWidth" value="${s.maxWidth || ''}" placeholder="1200px или 100%">
            </div>
        </div>

        ${el.isContainer ? `
        <div class="edit-section">
            <h4><i class="fas fa-th-large"></i> Быстрые макеты</h4>
            <div class="edit-row">
                <div class="layout-presets" data-custom="layoutPreset">
                    <button type="button" class="layout-preset-btn" data-preset="1" title="1 колонка">
                        <div class="preset-icon"><div class="col"></div></div>
                    </button>
                    <button type="button" class="layout-preset-btn" data-preset="1-1" title="2 равные колонки">
                        <div class="preset-icon"><div class="col"></div><div class="col"></div></div>
                    </button>
                    <button type="button" class="layout-preset-btn" data-preset="1-1-1" title="3 равные колонки">
                        <div class="preset-icon"><div class="col"></div><div class="col"></div><div class="col"></div></div>
                    </button>
                    <button type="button" class="layout-preset-btn" data-preset="1-2" title="1:2">
                        <div class="preset-icon"><div class="col" style="flex:1"></div><div class="col" style="flex:2"></div></div>
                    </button>
                    <button type="button" class="layout-preset-btn" data-preset="2-1" title="2:1">
                        <div class="preset-icon"><div class="col" style="flex:2"></div><div class="col" style="flex:1"></div></div>
                    </button>
                    <button type="button" class="layout-preset-btn" data-preset="1-3" title="Sidebar + Content">
                        <div class="preset-icon"><div class="col" style="flex:1"></div><div class="col" style="flex:3"></div></div>
                    </button>
                    <button type="button" class="layout-preset-btn" data-preset="1-1-1-1" title="4 колонки">
                        <div class="preset-icon"><div class="col"></div><div class="col"></div><div class="col"></div><div class="col"></div></div>
                    </button>
                </div>
            </div>
        </div>

        <div class="edit-section">
            <h4><i class="fas fa-align-center"></i> Расположение контента</h4>
            <div class="edit-row">
                <label>Тип раскладки</label>
                <div class="edit-btn-group" data-style="display">
                    <button type="button" class="${!s.display || s.display === 'flex' ? 'active' : ''}" data-value="flex">
                        <i class="fas fa-grip-lines"></i> Flex
                    </button>
                    <button type="button" class="${s.display === 'grid' ? 'active' : ''}" data-value="grid">
                        <i class="fas fa-th"></i> Grid
                    </button>
                </div>
            </div>
            <div class="edit-row">
                <label>Направление</label>
                <div class="edit-btn-group" data-style="flexDirection">
                    <button type="button" class="${!s.flexDirection || s.flexDirection === 'row' ? 'active' : ''}" data-value="row">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                    <button type="button" class="${s.flexDirection === 'row-reverse' ? 'active' : ''}" data-value="row-reverse">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <button type="button" class="${s.flexDirection === 'column' ? 'active' : ''}" data-value="column">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button type="button" class="${s.flexDirection === 'column-reverse' ? 'active' : ''}" data-value="column-reverse">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                </div>
            </div>
            <div class="edit-row">
                <label>Перенос элементов</label>
                <div class="edit-btn-group" data-style="flexWrap">
                    <button type="button" class="${!s.flexWrap || s.flexWrap === 'nowrap' ? 'active' : ''}" data-value="nowrap">
                        Без переноса
                    </button>
                    <button type="button" class="${s.flexWrap === 'wrap' ? 'active' : ''}" data-value="wrap">
                        Переносить
                    </button>
                </div>
            </div>
            <div class="edit-row">
                <label>По горизонтали</label>
                <select class="edit-select" data-style="justifyContent">
                    <option value="flex-start" ${s.justifyContent === 'flex-start' || !s.justifyContent ? 'selected' : ''}>В начале</option>
                    <option value="center" ${s.justifyContent === 'center' ? 'selected' : ''}>По центру</option>
                    <option value="flex-end" ${s.justifyContent === 'flex-end' ? 'selected' : ''}>В конце</option>
                    <option value="space-between" ${s.justifyContent === 'space-between' ? 'selected' : ''}>Равномерно</option>
                    <option value="space-around" ${s.justifyContent === 'space-around' ? 'selected' : ''}>С отступами</option>
                    <option value="space-evenly" ${s.justifyContent === 'space-evenly' ? 'selected' : ''}>Равные промежутки</option>
                </select>
            </div>
            <div class="edit-row">
                <label>По вертикали</label>
                <select class="edit-select" data-style="alignItems">
                    <option value="stretch" ${!s.alignItems || s.alignItems === 'stretch' ? 'selected' : ''}>Растянуть</option>
                    <option value="flex-start" ${s.alignItems === 'flex-start' ? 'selected' : ''}>Сверху</option>
                    <option value="center" ${s.alignItems === 'center' ? 'selected' : ''}>По центру</option>
                    <option value="flex-end" ${s.alignItems === 'flex-end' ? 'selected' : ''}>Снизу</option>
                    <option value="baseline" ${s.alignItems === 'baseline' ? 'selected' : ''}>По базовой линии</option>
                </select>
            </div>
            <div class="edit-row">
                <label>Отступ между элементами</label>
                <div class="edit-range-row">
                    <input type="range" min="0" max="80" value="${parseInt(s.gap) || 0}" data-style="gap" data-unit="px">
                    <span>${parseInt(s.gap) || 0}px</span>
                </div>
            </div>
        </div>

        <div class="edit-section">
            <h4><i class="fas fa-th"></i> Grid настройки</h4>
            <div class="edit-row">
                <label>Колонки</label>
                <select class="edit-select" data-style="gridTemplateColumns">
                    <option value="" ${!s.gridTemplateColumns ? 'selected' : ''}>Авто</option>
                    <option value="repeat(2, 1fr)" ${s.gridTemplateColumns === 'repeat(2, 1fr)' ? 'selected' : ''}>2 колонки</option>
                    <option value="repeat(3, 1fr)" ${s.gridTemplateColumns === 'repeat(3, 1fr)' ? 'selected' : ''}>3 колонки</option>
                    <option value="repeat(4, 1fr)" ${s.gridTemplateColumns === 'repeat(4, 1fr)' ? 'selected' : ''}>4 колонки</option>
                    <option value="repeat(auto-fit, minmax(250px, 1fr))" ${s.gridTemplateColumns?.includes('auto-fit') ? 'selected' : ''}>Авто-адаптив (250px мин)</option>
                    <option value="repeat(auto-fit, minmax(300px, 1fr))" ${s.gridTemplateColumns?.includes('300px') ? 'selected' : ''}>Авто-адаптив (300px мин)</option>
                </select>
            </div>
            <div class="edit-row">
                <label>Минимальная ширина элемента</label>
                <input type="text" class="edit-input" data-custom="childMinWidth" value="${el.childMinWidth || ''}" placeholder="250px">
            </div>
        </div>

        <div class="edit-section">
            <h4><i class="fas fa-arrows-alt-v"></i> Высота секции</h4>
            <div class="edit-row">
                <label>Высота</label>
                <select class="edit-select" data-style="minHeight">
                    <option value="" ${!s.minHeight ? 'selected' : ''}>Авто</option>
                    <option value="100vh" ${s.minHeight === '100vh' ? 'selected' : ''}>Полный экран (100vh)</option>
                    <option value="80vh" ${s.minHeight === '80vh' ? 'selected' : ''}>80% экрана</option>
                    <option value="50vh" ${s.minHeight === '50vh' ? 'selected' : ''}>Половина экрана (50vh)</option>
                    <option value="400px" ${s.minHeight === '400px' ? 'selected' : ''}>400px</option>
                    <option value="600px" ${s.minHeight === '600px' ? 'selected' : ''}>600px</option>
                </select>
            </div>
        </div>

        <div class="edit-section">
            <h4><i class="fas fa-thumbtack"></i> Позиционирование</h4>
            <div class="edit-row">
                <label>Позиция</label>
                <select class="edit-select" data-style="position">
                    <option value="" ${!s.position || s.position === 'relative' ? 'selected' : ''}>Обычная</option>
                    <option value="sticky" ${s.position === 'sticky' ? 'selected' : ''}>Липкая (sticky)</option>
                    <option value="fixed" ${s.position === 'fixed' ? 'selected' : ''}>Фиксированная</option>
                    <option value="absolute" ${s.position === 'absolute' ? 'selected' : ''}>Абсолютная</option>
                </select>
            </div>
            <div class="edit-row" ${!s.position || (s.position !== 'sticky' && s.position !== 'fixed') ? 'style="display:none"' : ''}>
                <label>Отступ сверху</label>
                <input type="text" class="edit-input" data-style="top" value="${s.top || ''}" placeholder="0">
            </div>
            <div class="edit-row">
                <label>Z-index (слой)</label>
                <input type="text" class="edit-input" data-style="zIndex" value="${s.zIndex || ''}" placeholder="auto">
            </div>
        </div>

        <div class="edit-section">
            <h4><i class="fas fa-eye-slash"></i> Overflow (переполнение)</h4>
            <div class="edit-row">
                <label>Поведение</label>
                <select class="edit-select" data-style="overflow">
                    <option value="" ${!s.overflow ? 'selected' : ''}>Видимое</option>
                    <option value="hidden" ${s.overflow === 'hidden' ? 'selected' : ''}>Скрыть</option>
                    <option value="auto" ${s.overflow === 'auto' ? 'selected' : ''}>Авто (скролл при необходимости)</option>
                    <option value="scroll" ${s.overflow === 'scroll' ? 'selected' : ''}>Всегда скролл</option>
                </select>
            </div>
        </div>
        ` : ''}

        <div class="edit-section">
            <h4><i class="fas fa-arrows-alt"></i> Отступы</h4>
            <div class="edit-row">
                <label>Внутренний отступ (padding)</label>
                <input type="text" class="edit-input" data-style="padding" value="${s.padding || ''}" placeholder="20px или 10px 20px">
            </div>
            <div class="edit-row">
                <label>Внешний отступ (margin)</label>
                <input type="text" class="edit-input" data-style="margin" value="${s.margin || ''}" placeholder="0 auto">
            </div>
        </div>

        ${!el.isContainer ? `
        <div class="edit-section">
            <h4><i class="fas fa-text-height"></i> Типографика</h4>
            <div class="edit-row">
                <label>Шрифт</label>
                <select class="edit-select font-select" data-style="fontFamily" id="fontFamilySelect">
                    <option value="" ${!s.fontFamily ? 'selected' : ''}>По умолчанию (Inter)</option>
                    ${googleFonts.map(f => `<option value="'${f.name}', sans-serif" ${s.fontFamily?.includes(f.name) ? 'selected' : ''} style="font-family:'${f.name}',sans-serif">${f.name}</option>`).join('')}
                </select>
            </div>
            <div class="edit-row">
                <label>Размер шрифта</label>
                <div class="edit-range-row">
                    <input type="range" min="10" max="72" value="${parseInt(s.fontSize) || 16}" data-style="fontSize" data-unit="px">
                    <span>${parseInt(s.fontSize) || 16}px</span>
                </div>
            </div>
            <div class="edit-row">
                <label>Толщина шрифта</label>
                <select class="edit-select" data-style="fontWeight">
                    <option value="" ${!s.fontWeight ? 'selected' : ''}>Обычный (400)</option>
                    <option value="300" ${s.fontWeight === '300' ? 'selected' : ''}>Тонкий (300)</option>
                    <option value="500" ${s.fontWeight === '500' ? 'selected' : ''}>Средний (500)</option>
                    <option value="600" ${s.fontWeight === '600' ? 'selected' : ''}>Полужирный (600)</option>
                    <option value="700" ${s.fontWeight === 'bold' || s.fontWeight === '700' ? 'selected' : ''}>Жирный (700)</option>
                    <option value="800" ${s.fontWeight === '800' ? 'selected' : ''}>Очень жирный (800)</option>
                </select>
            </div>
            <div class="edit-row">
                <label>Выравнивание текста</label>
                <div class="edit-btn-group" data-style="textAlign">
                    <button type="button" class="${s.textAlign === 'left' || !s.textAlign ? 'active' : ''}" data-value="left"><i class="fas fa-align-left"></i></button>
                    <button type="button" class="${s.textAlign === 'center' ? 'active' : ''}" data-value="center"><i class="fas fa-align-center"></i></button>
                    <button type="button" class="${s.textAlign === 'right' ? 'active' : ''}" data-value="right"><i class="fas fa-align-right"></i></button>
                    <button type="button" class="${s.textAlign === 'justify' ? 'active' : ''}" data-value="justify"><i class="fas fa-align-justify"></i></button>
                </div>
            </div>
            <div class="edit-row">
                <label>Межстрочный интервал</label>
                <div class="edit-range-row">
                    <input type="range" min="1" max="3" step="0.1" value="${parseFloat(s.lineHeight) || 1.5}" data-style="lineHeight">
                    <span>${parseFloat(s.lineHeight) || 1.5}</span>
                </div>
            </div>
            <div class="edit-row">
                <label>Стиль текста</label>
                <div class="edit-btn-group-multi">
                    <button type="button" class="${s.fontStyle === 'italic' ? 'active' : ''}" data-style="fontStyle" data-value="italic" title="Курсив"><i class="fas fa-italic"></i></button>
                    <button type="button" class="${s.textDecoration === 'underline' ? 'active' : ''}" data-style="textDecoration" data-value="underline" title="Подчёркнутый"><i class="fas fa-underline"></i></button>
                    <button type="button" class="${s.textDecoration === 'line-through' ? 'active' : ''}" data-style="textDecoration" data-value="line-through" title="Зачёркнутый"><i class="fas fa-strikethrough"></i></button>
                    <button type="button" class="${s.textTransform === 'uppercase' ? 'active' : ''}" data-style="textTransform" data-value="uppercase" title="ЗАГЛАВНЫЕ"><i class="fas fa-font"></i> AA</button>
                </div>
            </div>
            <div class="edit-row">
                <label>Межбуквенный интервал</label>
                <div class="edit-range-row">
                    <input type="range" min="-2" max="10" step="0.5" value="${parseFloat(s.letterSpacing) || 0}" data-style="letterSpacing" data-unit="px">
                    <span>${parseFloat(s.letterSpacing) || 0}px</span>
                </div>
            </div>
        </div>
        ` : ''}

        <div class="edit-section">
            <h4><i class="fas fa-fill-drip"></i> Фон</h4>
            <div class="edit-row">
                <label>Тип фона</label>
                <div class="edit-btn-group bg-type-group" data-custom="bgType">
                    <button type="button" class="${bgType === 'color' ? 'active' : ''}" data-value="color">
                        <i class="fas fa-palette"></i> Цвет
                    </button>
                    <button type="button" class="${bgType === 'photo' ? 'active' : ''}" data-value="photo">
                        <i class="fas fa-image"></i> Фото
                    </button>
                    <button type="button" class="${bgType === 'gradient' ? 'active' : ''}" data-value="gradient">
                        <i class="fas fa-fill"></i> Градиент
                    </button>
                    <button type="button" class="${bgType === 'blur' ? 'active' : ''}" data-value="blur">
                        <i class="fas fa-tint"></i> Размытие
                    </button>
                </div>
            </div>
            <div class="bg-color-section" ${bgType !== 'color' ? 'style="display:none"' : ''}>
                <div class="edit-row">
                    <label>Цвет фона</label>
                    <div class="edit-color">
                        <input type="color" data-style="backgroundColor" value="${s.backgroundColor || '#ffffff'}">
                        <input type="text" class="edit-input" data-style="backgroundColor" value="${s.backgroundColor || ''}" placeholder="Прозрачный">
                    </div>
                </div>
            </div>
            <div class="bg-photo-section" ${bgType !== 'photo' ? 'style="display:none"' : ''}>
                <div class="edit-row">
                    <label>Загрузить изображение</label>
                    <div class="file-upload-wrapper">
                        <input type="file" id="bgImageUpload" accept="image/*" class="file-input">
                        <label for="bgImageUpload" class="btn file-upload-btn">
                            <i class="fas fa-upload"></i> Выбрать файл
                        </label>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Или URL изображения</label>
                    <input type="text" class="edit-input" data-custom="bgImageUrl" value="${s.backgroundImage?.match(/url\\(['\"]?([^'\"\\)]+)['\"]?\\)/)?.[1] || ''}" placeholder="https://...">
                </div>
                <div class="edit-row">
                    <label>Размер фона</label>
                    <select class="edit-select" data-style="backgroundSize">
                        <option value="">Авто</option>
                        <option value="cover" ${s.backgroundSize === 'cover' ? 'selected' : ''}>Заполнить (cover)</option>
                        <option value="contain" ${s.backgroundSize === 'contain' ? 'selected' : ''}>Вместить (contain)</option>
                    </select>
                </div>
                <div class="edit-row">
                    <label>Позиция фона</label>
                    <select class="edit-select" data-style="backgroundPosition">
                        <option value="center" ${!s.backgroundPosition || s.backgroundPosition === 'center' ? 'selected' : ''}>По центру</option>
                        <option value="top" ${s.backgroundPosition === 'top' ? 'selected' : ''}>Сверху</option>
                        <option value="bottom" ${s.backgroundPosition === 'bottom' ? 'selected' : ''}>Снизу</option>
                        <option value="left" ${s.backgroundPosition === 'left' ? 'selected' : ''}>Слева</option>
                        <option value="right" ${s.backgroundPosition === 'right' ? 'selected' : ''}>Справа</option>
                    </select>
                </div>
                <div class="edit-row">
                    <label>
                        <input type="checkbox" data-custom="bgRepeat" ${s.backgroundRepeat === 'repeat' ? 'checked' : ''}> Повторять изображение
                    </label>
                </div>
            </div>
            <div class="bg-gradient-section" ${bgType !== 'gradient' ? 'style="display:none"' : ''}>
                <div class="edit-row">
                    <label>Направление градиента</label>
                    <select class="edit-select" data-custom="gradientDirection">
                        <option value="to right" ${s.background?.includes('to right') ? 'selected' : ''}>→ Вправо</option>
                        <option value="to left" ${s.background?.includes('to left') ? 'selected' : ''}>← Влево</option>
                        <option value="to bottom" ${s.background?.includes('to bottom') || (!s.background?.includes('to ')) ? 'selected' : ''}>↓ Вниз</option>
                        <option value="to top" ${s.background?.includes('to top') ? 'selected' : ''}>↑ Вверх</option>
                        <option value="to bottom right" ${s.background?.includes('to bottom right') ? 'selected' : ''}>↘ По диагонали</option>
                    </select>
                </div>
                <div class="edit-row">
                    <label>Цвет 1</label>
                    <div class="edit-color">
                        <input type="color" data-custom="gradientColor1" value="${gradientColors[0] || '#3b82f6'}">
                        <input type="text" class="edit-input" data-custom="gradientColor1" value="${gradientColors[0] || '#3b82f6'}">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Цвет 2</label>
                    <div class="edit-color">
                        <input type="color" data-custom="gradientColor2" value="${gradientColors[1] || '#8b5cf6'}">
                        <input type="text" class="edit-input" data-custom="gradientColor2" value="${gradientColors[1] || '#8b5cf6'}">
                    </div>
                </div>
                <div id="extraGradientColors">
                    ${gradientColors.slice(2).map((color, i) => `
                        <div class="edit-row gradient-color-row">
                            <label>Цвет ${i + 3}</label>
                            <div class="edit-color">
                                <input type="color" data-custom="gradientColor${i + 3}" value="${color}">
                                <input type="text" class="edit-input" data-custom="gradientColor${i + 3}" value="${color}">
                            </div>
                            <button type="button" class="btn-remove-color" onclick="this.parentElement.remove()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-add-color" id="addGradientColor">
                    <i class="fas fa-plus"></i> Добавить цвет
                </button>
            </div>
            <div class="bg-blur-section" ${bgType !== 'blur' ? 'style="display:none"' : ''}>
                <div class="edit-row">
                    <label>Сила размытия</label>
                    <div class="edit-range-row">
                        <input type="range" min="0" max="30" value="${parseInt(s.backdropFilter?.match(/\\d+/)?.[0]) || 10}" data-custom="bgBlurAmount">
                        <span>${parseInt(s.backdropFilter?.match(/\\d+/)?.[0]) || 10}px</span>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Затемнение/Осветление</label>
                    <div class="edit-color">
                        <input type="color" data-custom="bgBlurOverlay" value="${s.backgroundColor || 'rgba(255,255,255,0.3)'}">
                        <input type="text" class="edit-input" data-custom="bgBlurOverlay" value="${s.backgroundColor || 'rgba(255,255,255,0.3)'}" placeholder="rgba(255,255,255,0.3)">
                    </div>
                </div>
            </div>
        </div>

        ${el.isContainer ? `
        <div class="edit-section">
            <h4><i class="fas fa-video"></i> Фоновое видео</h4>
            <div class="edit-row">
                <label>URL видео (YouTube, Vimeo или MP4)</label>
                <input type="text" class="edit-input" data-custom="bgVideoUrl" value="${el.bgVideo?.url || ''}" placeholder="https://www.youtube.com/watch?v=...">
            </div>
            <div class="edit-row">
                <div class="edit-checkbox-row">
                    <input type="checkbox" id="bgVideoAutoplay" data-custom="bgVideoAutoplay" ${el.bgVideo?.autoplay !== false ? 'checked' : ''}>
                    <label for="bgVideoAutoplay">Автовоспроизведение</label>
                </div>
                <div class="edit-checkbox-row">
                    <input type="checkbox" id="bgVideoLoop" data-custom="bgVideoLoop" ${el.bgVideo?.loop !== false ? 'checked' : ''}>
                    <label for="bgVideoLoop">Повтор</label>
                </div>
                <div class="edit-checkbox-row">
                    <input type="checkbox" id="bgVideoMuted" data-custom="bgVideoMuted" ${el.bgVideo?.muted !== false ? 'checked' : ''}>
                    <label for="bgVideoMuted">Без звука</label>
                </div>
            </div>
            <div class="edit-row">
                <label>Затемнение видео</label>
                <div class="edit-range-row">
                    <input type="range" min="0" max="80" value="${el.bgVideo?.overlay || 0}" data-custom="bgVideoOverlay">
                    <span>${el.bgVideo?.overlay || 0}%</span>
                </div>
            </div>
        </div>
        ` : ''}

        <div class="edit-section">
            <h4><i class="fas fa-font"></i> Цвет текста</h4>
            ${renderTextColorSection(el)}
        </div>

        <div class="edit-section">
            <h4><i class="fas fa-border-style"></i> Граница и тень</h4>
            <div class="edit-row">
                <label>Граница</label>
                <input type="text" class="edit-input" data-style="border" value="${s.border || ''}" placeholder="1px solid #ccc">
            </div>
            <div class="edit-row">
                <label>Скругление углов</label>
                <div class="edit-range-row">
                    <input type="range" min="0" max="50" value="${parseInt(s.borderRadius) || 0}" data-style="borderRadius" data-unit="px">
                    <span>${parseInt(s.borderRadius) || 0}px</span>
                </div>
            </div>
            <div class="edit-row">
                <label>Тень</label>
                <select class="edit-select" data-style="boxShadow">
                    <option value="" ${!s.boxShadow ? 'selected' : ''}>Без тени</option>
                    <option value="0 2px 4px rgba(0,0,0,0.1)" ${s.boxShadow?.includes('2px 4px') ? 'selected' : ''}>Лёгкая</option>
                    <option value="0 4px 6px rgba(0,0,0,0.1)" ${s.boxShadow?.includes('4px 6px') ? 'selected' : ''}>Средняя</option>
                    <option value="0 10px 25px rgba(0,0,0,0.15)" ${s.boxShadow?.includes('10px 25px') ? 'selected' : ''}>Большая</option>
                </select>
            </div>
        </div>
    `;
}

function extractGradientColors(background) {
    if (!background || !background.includes('gradient')) return [];
    const matches = background.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\([^)]+\)|rgba\([^)]+\)/g);
    return matches || [];
}

function renderTextColorSection(el) {
    const s = el.styles || {};
    // Check if text has gradient (uses backgroundClip: text trick)
    const hasTextGradient = s.backgroundClip === 'text' || s.WebkitBackgroundClip === 'text';
    const hasTextShadowBlur = s.textShadow?.includes('blur') || (s.textShadow && !s.textShadow.includes('px 0px'));
    const textColorType = hasTextGradient ? 'gradient' : (hasTextShadowBlur ? 'blur' : 'color');
    const textGradientColors = hasTextGradient ? extractGradientColors(s.background || s.backgroundImage) : [];

    return `
        <div class="edit-row">
            <label>Тип цвета</label>
            <div class="edit-btn-group" data-custom="textColorType">
                <button type="button" class="${textColorType === 'color' ? 'active' : ''}" data-value="color">
                    <i class="fas fa-palette"></i> Цвет
                </button>
                <button type="button" class="${textColorType === 'gradient' ? 'active' : ''}" data-value="gradient">
                    <i class="fas fa-fill"></i> Градиент
                </button>
                <button type="button" class="${textColorType === 'blur' ? 'active' : ''}" data-value="blur">
                    <i class="fas fa-tint"></i> Размытие
                </button>
            </div>
        </div>
        <div class="text-color-section" ${textColorType !== 'color' ? 'style="display:none"' : ''}>
            <div class="edit-row">
                <label>Цвет текста</label>
                <div class="edit-color">
                    <input type="color" data-style="color" value="${s.color || '#000000'}">
                    <input type="text" class="edit-input" data-style="color" value="${s.color || ''}" placeholder="#000000">
                </div>
            </div>
        </div>
        <div class="text-blur-section" ${textColorType !== 'blur' ? 'style="display:none"' : ''}>
            <div class="edit-row">
                <label>Цвет текста</label>
                <div class="edit-color">
                    <input type="color" data-custom="textBlurColor" value="${s.color || '#000000'}">
                    <input type="text" class="edit-input" data-custom="textBlurColor" value="${s.color || '#000000'}">
                </div>
            </div>
            <div class="edit-row">
                <label>Сила размытия</label>
                <div class="edit-range-row">
                    <input type="range" min="0" max="20" value="${parseInt(s.textShadow?.match(/\\d+px/)?.[0]) || 4}" data-custom="textBlurAmount">
                    <span>${parseInt(s.textShadow?.match(/\\d+px/)?.[0]) || 4}px</span>
                </div>
            </div>
        </div>
        <div class="text-gradient-section" ${textColorType !== 'gradient' ? 'style="display:none"' : ''}>
            <div class="edit-row">
                <label>Направление градиента</label>
                <select class="edit-select" data-custom="textGradientDirection">
                    <option value="to right" ${s.background?.includes('to right') || s.backgroundImage?.includes('to right') ? 'selected' : ''}>→ Вправо</option>
                    <option value="to left" ${s.background?.includes('to left') || s.backgroundImage?.includes('to left') ? 'selected' : ''}>← Влево</option>
                    <option value="to bottom" selected>↓ Вниз</option>
                    <option value="to top" ${s.background?.includes('to top') || s.backgroundImage?.includes('to top') ? 'selected' : ''}>↑ Вверх</option>
                    <option value="to bottom right" ${s.background?.includes('to bottom right') || s.backgroundImage?.includes('to bottom right') ? 'selected' : ''}>↘ По диагонали</option>
                </select>
            </div>
            <div class="edit-row">
                <label>Цвет 1</label>
                <div class="edit-color">
                    <input type="color" data-custom="textGradientColor1" value="${textGradientColors[0] || '#3b82f6'}">
                    <input type="text" class="edit-input" data-custom="textGradientColor1" value="${textGradientColors[0] || '#3b82f6'}">
                </div>
            </div>
            <div class="edit-row">
                <label>Цвет 2</label>
                <div class="edit-color">
                    <input type="color" data-custom="textGradientColor2" value="${textGradientColors[1] || '#8b5cf6'}">
                    <input type="text" class="edit-input" data-custom="textGradientColor2" value="${textGradientColors[1] || '#8b5cf6'}">
                </div>
            </div>
            <div id="extraTextGradientColors">
                ${textGradientColors.slice(2).map((color, i) => `
                    <div class="edit-row gradient-color-row">
                        <label>Цвет ${i + 3}</label>
                        <div class="edit-color">
                            <input type="color" data-custom="textGradientColor${i + 3}" value="${color}">
                            <input type="text" class="edit-input" data-custom="textGradientColor${i + 3}" value="${color}">
                        </div>
                        <button type="button" class="btn-remove-color" onclick="this.parentElement.remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
            <button type="button" class="btn-add-color" id="addTextGradientColor">
                <i class="fas fa-plus"></i> Добавить цвет
            </button>
        </div>
    `;
}

function renderAnimationTab(el) {
    const anim = el.animation || {};
    return `
        <div class="edit-section">
            <h4><i class="fas fa-magic"></i> Анимация при появлении</h4>
            <div class="edit-row">
                <label>Тип анимации</label>
                <select class="edit-select" data-anim="type">
                    <option value="" ${!anim.type ? 'selected' : ''}>Без анимации</option>
                    <option value="fadeIn" ${anim.type === 'fadeIn' ? 'selected' : ''}>Появление (Fade In)</option>
                    <option value="fadeInUp" ${anim.type === 'fadeInUp' ? 'selected' : ''}>Появление снизу</option>
                    <option value="fadeInDown" ${anim.type === 'fadeInDown' ? 'selected' : ''}>Появление сверху</option>
                    <option value="fadeInLeft" ${anim.type === 'fadeInLeft' ? 'selected' : ''}>Появление слева</option>
                    <option value="fadeInRight" ${anim.type === 'fadeInRight' ? 'selected' : ''}>Появление справа</option>
                    <option value="zoomIn" ${anim.type === 'zoomIn' ? 'selected' : ''}>Увеличение (Zoom In)</option>
                    <option value="bounce" ${anim.type === 'bounce' ? 'selected' : ''}>Прыжок (Bounce)</option>
                    <option value="pulse" ${anim.type === 'pulse' ? 'selected' : ''}>Пульсация</option>
                    <option value="shake" ${anim.type === 'shake' ? 'selected' : ''}>Тряска</option>
                </select>
            </div>
            <div class="edit-row">
                <label>Длительность</label>
                <div class="edit-range-row">
                    <input type="range" min="0.1" max="3" step="0.1" value="${anim.duration || 0.5}" data-anim="duration">
                    <span>${anim.duration || 0.5}s</span>
                </div>
            </div>
            <div class="edit-row">
                <label>Задержка</label>
                <div class="edit-range-row">
                    <input type="range" min="0" max="2" step="0.1" value="${anim.delay || 0}" data-anim="delay">
                    <span>${anim.delay || 0}s</span>
                </div>
            </div>
        </div>

        <div class="edit-section">
            <h4><i class="fas fa-redo"></i> Анимация при наведении</h4>
            <div class="edit-row">
                <label>Эффект</label>
                <select class="edit-select" data-anim="hover">
                    <option value="" ${!anim.hover ? 'selected' : ''}>Без эффекта</option>
                    <option value="scale" ${anim.hover === 'scale' ? 'selected' : ''}>Увеличение</option>
                    <option value="lift" ${anim.hover === 'lift' ? 'selected' : ''}>Подъём с тенью</option>
                    <option value="glow" ${anim.hover === 'glow' ? 'selected' : ''}>Свечение</option>
                    <option value="rotate" ${anim.hover === 'rotate' ? 'selected' : ''}>Поворот</option>
                    <option value="shake" ${anim.hover === 'shake' ? 'selected' : ''}>Тряска</option>
                </select>
            </div>
        </div>
    `;
}

function renderActionTab(el) {
    const action = el.action || {};
    return `
        <div class="edit-section">
            <h4><i class="fas fa-mouse-pointer"></i> Действие при клике</h4>
            <div class="edit-row">
                <label>Тип действия</label>
                <select class="edit-select" data-action="type" id="actionType">
                    <option value="" ${!action.type ? 'selected' : ''}>Нет действия</option>
                    <option value="link" ${action.type === 'link' ? 'selected' : ''}>Перейти по ссылке</option>
                    <option value="scroll" ${action.type === 'scroll' ? 'selected' : ''}>Прокрутить к блоку</option>
                    <option value="modal" ${action.type === 'modal' ? 'selected' : ''}>Открыть модальное окно</option>
                    <option value="phone" ${action.type === 'phone' ? 'selected' : ''}>Позвонить</option>
                    <option value="email" ${action.type === 'email' ? 'selected' : ''}>Написать email</option>
                    <option value="copy" ${action.type === 'copy' ? 'selected' : ''}>Скопировать текст</option>
                </select>
            </div>

            <div class="action-link-section" ${action.type !== 'link' ? 'style="display:none"' : ''}>
                <div class="edit-row">
                    <label>URL ссылки</label>
                    <input type="text" class="edit-input" data-action="url" value="${action.url || ''}" placeholder="https://...">
                </div>
                <div class="edit-row">
                    <label>Открывать в</label>
                    <select class="edit-select" data-action="target">
                        <option value="_self" ${action.target !== '_blank' ? 'selected' : ''}>Текущем окне</option>
                        <option value="_blank" ${action.target === '_blank' ? 'selected' : ''}>Новом окне</option>
                    </select>
                </div>
            </div>

            <div class="action-scroll-section" ${action.type !== 'scroll' ? 'style="display:none"' : ''}>
                <div class="edit-row">
                    <label>ID блока для прокрутки</label>
                    <input type="text" class="edit-input" data-action="scrollTo" value="${action.scrollTo || ''}" placeholder="#section1">
                </div>
            </div>

            <div class="action-phone-section" ${action.type !== 'phone' ? 'style="display:none"' : ''}>
                <div class="edit-row">
                    <label>Номер телефона</label>
                    <input type="text" class="edit-input" data-action="phone" value="${action.phone || ''}" placeholder="+7 999 123-45-67">
                </div>
            </div>

            <div class="action-email-section" ${action.type !== 'email' ? 'style="display:none"' : ''}>
                <div class="edit-row">
                    <label>Email адрес</label>
                    <input type="text" class="edit-input" data-action="email" value="${action.email || ''}" placeholder="email@example.com">
                </div>
                <div class="edit-row">
                    <label>Тема письма</label>
                    <input type="text" class="edit-input" data-action="emailSubject" value="${action.emailSubject || ''}" placeholder="Заявка с сайта">
                </div>
            </div>

            <div class="action-copy-section" ${action.type !== 'copy' ? 'style="display:none"' : ''}>
                <div class="edit-row">
                    <label>Текст для копирования</label>
                    <input type="text" class="edit-input" data-action="copyText" value="${action.copyText || ''}" placeholder="Текст...">
                </div>
            </div>
        </div>

        <div class="edit-section">
            <h4><i class="fas fa-hand-pointer"></i> Курсор</h4>
            <div class="edit-row">
                <label>Вид курсора</label>
                <select class="edit-select" data-style="cursor">
                    <option value="" ${!el.styles?.cursor ? 'selected' : ''}>По умолчанию</option>
                    <option value="pointer" ${el.styles?.cursor === 'pointer' ? 'selected' : ''}>Указатель (pointer)</option>
                    <option value="grab" ${el.styles?.cursor === 'grab' ? 'selected' : ''}>Хват (grab)</option>
                    <option value="crosshair" ${el.styles?.cursor === 'crosshair' ? 'selected' : ''}>Крестик</option>
                    <option value="not-allowed" ${el.styles?.cursor === 'not-allowed' ? 'selected' : ''}>Запрещено</option>
                </select>
            </div>
        </div>
    `;
}

function renderAdvancedTab(el) {
    return `
        <div class="edit-section">
            <h4>ID элемента</h4>
            <div class="edit-row">
                <input type="text" class="edit-input" value="${el.id}" disabled>
            </div>
        </div>

        <div class="edit-section">
            <h4><i class="fas fa-anchor"></i> Якорь (Anchor)</h4>
            <div class="edit-row">
                <label>ID якоря для навигации</label>
                <input type="text" class="edit-input" data-custom="anchorId" value="${el.anchorId || ''}" placeholder="например: about, pricing, contacts">
            </div>
            <p class="edit-hint">Используйте для smooth scroll навигации. Ссылка: #якорь</p>
        </div>

        <div class="edit-section">
            <h4>CSS классы</h4>
            <div class="edit-row">
                <input type="text" class="edit-input" data-attr="class" value="${el.attrs?.class || ''}" placeholder="class1 class2">
            </div>
        </div>

        <div class="edit-section">
            <h4>Кастомный CSS</h4>
            <div class="edit-row">
                <textarea class="edit-textarea code" data-prop="customCss" rows="12" placeholder="property: value;
font-size: 20px;
color: red;">${stylesToString(el.styles)}</textarea>
            </div>
            <p class="edit-hint">Введите CSS свойства, по одному на строку</p>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Update form content based on settings
function updateFormContent() {
    const el = state.editingElement;
    if (!el || el.type !== 'form' || !el.formSettings) return;

    const fields = el.formSettings.fields;
    const buttonText = el.formSettings.buttonText || 'Отправить';
    const buttonColor = el.formSettings.buttonColor || '#3b82f6';

    let content = '';

    if (fields.name) {
        content += `<input type="text" name="name" placeholder="Ваше имя" required style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;">`;
    }
    if (fields.email) {
        content += `<input type="email" name="email" placeholder="Email" required style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;">`;
    }
    if (fields.phone) {
        content += `<input type="tel" name="phone" placeholder="Телефон" style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;">`;
    }
    if (fields.message) {
        content += `<textarea name="message" placeholder="Сообщение" rows="4" style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;resize:vertical;"></textarea>`;
    }

    content += `<button type="submit" style="width:100%;padding:12px;background:${buttonColor};color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;">${buttonText}</button>`;

    el.content = content;
}

// ===== Drag and Drop =====
let draggedBlockType = null;
let dropTargetId = null;
let dropPosition = null; // 'before', 'after', 'inside'

document.querySelectorAll('.block-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        draggedBlockType = e.target.dataset.type;
        e.target.classList.add('dragging');
    });

    item.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
        draggedBlockType = null;
        clearDropIndicators();
    });
});

canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!e.target.closest('.builder-element')) {
        canvas.classList.add('drop-target');
    }
});

canvas.addEventListener('dragleave', (e) => {
    if (!canvas.contains(e.relatedTarget)) {
        canvas.classList.remove('drop-target');
    }
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('drop-target');
    clearDropIndicators();

    if (dropTargetId && dropPosition) {
        handleDropAtPosition(dropTargetId, dropPosition);
    } else {
        handleDrop(null);
    }
});

function clearDropIndicators() {
    document.querySelectorAll('.drop-before, .drop-after, .drop-target').forEach(el => {
        el.classList.remove('drop-before', 'drop-after', 'drop-target');
    });
    dropTargetId = null;
    dropPosition = null;
}

function handleDrop(parentId) {
    if (draggedBlockType) {
        const element = createElement(draggedBlockType);
        if (element) {
            addElement(element, parentId);
            selectElement(element.id);
        }
        draggedBlockType = null;
    }
}

function handleDropAtPosition(targetId, position) {
    if (!draggedBlockType) return;

    const element = createElement(draggedBlockType);
    if (!element) return;

    const target = findElement(targetId);
    if (!target) {
        addElement(element, null);
        return;
    }

    if (position === 'inside' && target.isContainer) {
        addElement(element, targetId);
    } else {
        // Insert before or after target
        const parent = findParent(targetId);
        const siblings = parent ? parent.children : state.elements;
        const targetIndex = siblings.findIndex(e => e.id === targetId);

        if (targetIndex !== -1) {
            const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
            siblings.splice(insertIndex, 0, element);
            saveHistory();
            renderCanvas();
            renderLayers();
            selectElement(element.id);
        }
    }

    draggedBlockType = null;
}

// ===== History =====
function saveHistory() {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(JSON.stringify(state.elements));
    state.historyIndex = state.history.length - 1;
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        state.elements = JSON.parse(state.history[state.historyIndex]);
        renderCanvas();
        renderLayers();
        selectElement(null);
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        state.elements = JSON.parse(state.history[state.historyIndex]);
        renderCanvas();
        renderLayers();
        selectElement(null);
    }
}

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

// ===== Keyboard Shortcuts =====
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo(); }
        else if (e.key === 'y') { e.preventDefault(); redo(); }
        else if (e.key === 's') { e.preventDefault(); saveProject(); }
    }
    if (e.key === 'Delete' && state.selectedElement) {
        deleteElement(state.selectedElement.id);
    }
    if (e.key === 'Escape') {
        closeEditModal();
    }
});

// ===== Viewport =====
document.querySelectorAll('.viewport-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.viewport-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        canvas.setAttribute('data-viewport', btn.dataset.viewport);
        state.viewport = btn.dataset.viewport;
    });
});

// ===== Category Toggle =====
document.querySelectorAll('.category-header').forEach(header => {
    header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
    });
});

// ===== Modal Events =====
document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
document.getElementById('saveEditBtn').addEventListener('click', saveEditChanges);
document.getElementById('deleteBlockBtn').addEventListener('click', () => {
    if (state.editingElement) {
        deleteElement(state.editingElement.id);
        closeEditModal();
    }
});

// ===== Export =====
function generateElementHTML(el) {
    let styles = { ...el.styles };
    let attrs = { ...el.attrs };
    let wrapperStart = '';
    let wrapperEnd = '';

    // Animation styles
    const anim = el.animation || {};
    if (anim.type) {
        styles.animation = `${anim.type} ${anim.duration || 0.5}s ease ${anim.delay || 0}s both`;
    }
    if (anim.hover) {
        attrs['data-hover'] = anim.hover;
    }

    // Form handling
    if (el.type === 'form' && el.formSettings) {
        const fs = el.formSettings;
        attrs['data-form-id'] = el.id;
        attrs['data-page-id'] = state.pageId || 'unknown';
        attrs['data-success-message'] = fs.successMessage || 'Спасибо! Ваша заявка отправлена.';
        if (fs.webhook) attrs['data-webhook'] = fs.webhook;
        if (fs.saveToBackend !== false) attrs['data-save-backend'] = 'true';
    }

    // Action handling
    const action = el.action || {};
    if (action.type === 'link' && action.url) {
        wrapperStart = `<a href="${action.url}" target="${action.target || '_self'}" style="text-decoration:none;color:inherit;display:contents;">`;
        wrapperEnd = '</a>';
    } else if (action.type === 'phone' && action.phone) {
        wrapperStart = `<a href="tel:${action.phone.replace(/[^+\d]/g, '')}" style="text-decoration:none;color:inherit;display:contents;">`;
        wrapperEnd = '</a>';
    } else if (action.type === 'email' && action.email) {
        const subject = action.emailSubject ? `?subject=${encodeURIComponent(action.emailSubject)}` : '';
        wrapperStart = `<a href="mailto:${action.email}${subject}" style="text-decoration:none;color:inherit;display:contents;">`;
        wrapperEnd = '</a>';
    } else if (action.type === 'scroll' && action.scrollTo) {
        attrs['onclick'] = `document.querySelector('${action.scrollTo}')?.scrollIntoView({behavior:'smooth'})`;
        styles.cursor = 'pointer';
    } else if (action.type === 'copy' && action.copyText) {
        attrs['onclick'] = `navigator.clipboard.writeText('${action.copyText.replace(/'/g, "\\'")}');alert('Скопировано!')`;
        styles.cursor = 'pointer';
    } else if (action.type === 'modal') {
        attrs['onclick'] = `alert('Модальное окно')`;
        styles.cursor = 'pointer';
    }

    const styleStr = stylesToString(styles);

    // Always add id for auto-responsive CSS targeting; use anchorId if set
    attrs['id'] = el.anchorId || el.id;

    // Add class based on element type for responsive targeting
    const typeClass = el.type || '';
    if (typeClass) {
        attrs['class'] = (attrs['class'] || '') + ' ' + typeClass;
    }

    const attrsStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    const childrenHtml = el.children?.length ? generateHTML(el.children) : '';
    const content = el.content + childrenHtml;

    return `${wrapperStart}<${el.tag}${attrsStr ? ' ' + attrsStr : ''} style="${styleStr}">${content}</${el.tag}>${wrapperEnd}`;
}

function generateHTML(elements = state.elements) {
    return elements.map(el => generateElementHTML(el)).join('\n');
}

function generateFullHTML() {
    // Check if page has forms
    const hasForm = checkForForms(state.elements);
    const hasGallery = checkForGalleries(state.elements);

    // Collect used Google Fonts
    const usedFonts = collectUsedFonts();
    const fontLinks = usedFonts.map(fontName => {
        const font = googleFonts.find(f => f.name === fontName);
        const weights = font ? font.weights.join(';') : '400;700';
        return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@${weights}&display=swap">`;
    }).join('\n    ');

    // Generate meta tags
    const meta = state.meta || {};
    const pageTitle = meta.title || state.pageName || 'Лендинг';

    let metaTags = '';
    if (meta.description) {
        metaTags += `\n    <meta name="description" content="${escapeHtml(meta.description)}">`;
    }
    if (meta.keywords) {
        metaTags += `\n    <meta name="keywords" content="${escapeHtml(meta.keywords)}">`;
    }
    // Open Graph tags
    metaTags += `\n    <meta property="og:title" content="${escapeHtml(meta.ogTitle || pageTitle)}">`;
    if (meta.ogDescription || meta.description) {
        metaTags += `\n    <meta property="og:description" content="${escapeHtml(meta.ogDescription || meta.description)}">`;
    }
    if (meta.ogImage) {
        metaTags += `\n    <meta property="og:image" content="${meta.ogImage}">`;
    }
    metaTags += `\n    <meta property="og:type" content="website">`;

    // Favicon
    let faviconTag = '';
    if (meta.favicon) {
        faviconTag = `\n    <link rel="icon" href="${meta.favicon}">`;
    }

    // Theme CSS variables
    const t = state.theme || {};
    const themeCss = `
        :root {
            --primary: ${t.primaryColor || '#3b82f6'};
            --secondary: ${t.secondaryColor || '#10b981'};
            --accent: ${t.accentColor || '#f59e0b'};
            --text: ${t.textColor || '#1e293b'};
            --text-secondary: ${t.textSecondary || '#64748b'};
            --bg: ${t.bgColor || '#ffffff'};
            --bg-secondary: ${t.bgSecondary || '#f8fafc'};
            --border: ${t.borderColor || '#e2e8f0'};
            --radius: ${t.borderRadius || '8px'};
        }`;

    // Analytics scripts
    const analyticsScripts = generateAnalyticsScripts(state.elements);

    // Lightbox code for galleries
    const lightboxCode = hasGallery ? `
    <div id="lb-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.92);z-index:99999;align-items:center;justify-content:center;cursor:pointer;" onclick="if(event.target===this)closeLb()">
        <button onclick="closeLb()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:white;font-size:32px;cursor:pointer;z-index:100000;">&times;</button>
        <button id="lb-prev" onclick="lbNav(-1)" style="position:absolute;left:20px;top:50%;transform:translateY(-50%);background:none;border:none;color:white;font-size:36px;cursor:pointer;">&#10094;</button>
        <img id="lb-img" src="" style="max-width:90%;max-height:90vh;border-radius:8px;object-fit:contain;">
        <button id="lb-next" onclick="lbNav(1)" style="position:absolute;right:20px;top:50%;transform:translateY(-50%);background:none;border:none;color:white;font-size:36px;cursor:pointer;">&#10095;</button>
    </div>
    <script>
    (function(){
        var imgs=[],ci=0,ov=document.getElementById('lb-overlay'),im=document.getElementById('lb-img');
        document.querySelectorAll('.gallery img').forEach(function(img,i){
            img.style.cursor='pointer';
            img.addEventListener('click',function(){
                imgs=Array.from(img.closest('.gallery').querySelectorAll('img')).map(function(x){return x.src;});
                ci=imgs.indexOf(img.src);if(ci<0)ci=0;
                im.src=imgs[ci];ov.style.display='flex';
            });
        });
        window.closeLb=function(){ov.style.display='none';};
        window.lbNav=function(d){ci+=d;if(ci<0)ci=imgs.length-1;if(ci>=imgs.length)ci=0;im.src=imgs[ci];};
        document.addEventListener('keydown',function(e){
            if(ov.style.display==='flex'){
                if(e.key==='Escape')closeLb();
                if(e.key==='ArrowLeft')lbNav(-1);
                if(e.key==='ArrowRight')lbNav(1);
            }
        });
    })();
    </script>` : '';

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(pageTitle)}</title>${metaTags}${faviconTag}
    ${fontLinks ? fontLinks + '\n    ' : ''}<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">${analyticsScripts}
    <style>${themeCss}
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: '${t.fontFamily || 'Inter'}', -apple-system, BlinkMacSystemFont, sans-serif; color: var(--text); background: var(--bg); }
        img { max-width: 100%; height: auto; }
        img[loading="lazy"] { opacity: 1; transition: opacity 0.3s; }
        img.loading { opacity: 0; }

        /* Animations */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-20px); } 60% { transform: translateY(-10px); } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); } 20%, 40%, 60%, 80% { transform: translateX(5px); } }

        /* Hover effects */
        [data-hover="scale"]:hover { transform: scale(1.05); transition: transform 0.3s; }
        [data-hover="lift"]:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.2); transition: all 0.3s; }
        [data-hover="glow"]:hover { box-shadow: 0 0 20px currentColor; transition: box-shadow 0.3s; }
        [data-hover="rotate"]:hover { transform: rotate(5deg); transition: transform 0.3s; }
        [data-hover="shake"]:hover { animation: shake 0.5s; }

        /* Form styles */
        form input:focus, form textarea:focus, form select:focus { outline: none; border-color: var(--primary) !important; }
        form button:hover { opacity: 0.9; }
        form button:disabled { opacity: 0.6; cursor: not-allowed; }
        .form-success { padding: 16px; background: #10b981; color: white; border-radius: 8px; text-align: center; }
        .form-error { padding: 16px; background: #ef4444; color: white; border-radius: 8px; text-align: center; }

        /* Responsive styles */
${generateResponsiveCSS()}
    </style>
</head>
<body>
${generateHTML()}
${hasForm ? generateFormScript() : ''}${lightboxCode}
</body>
</html>`;
}

// Generate responsive CSS with media queries
function generateResponsiveCSS() {
    let tabletCSS = '';
    let mobileCSS = '';
    let autoTabletCSS = '';
    let autoMobileCSS = '';

    function collectResponsiveStyles(elements) {
        for (const el of elements) {
            const elCssId = el.anchorId || el.id;
            // User-defined tablet styles
            if (el.tabletStyles && Object.keys(el.tabletStyles).length > 0) {
                const styleStr = stylesToString(el.tabletStyles);
                tabletCSS += `        #${elCssId} { ${styleStr} }\n`;
            }

            // User-defined mobile styles
            if (el.mobileStyles && Object.keys(el.mobileStyles).length > 0) {
                const styleStr = stylesToString(el.mobileStyles);
                mobileCSS += `        #${elCssId} { ${styleStr} }\n`;
            }

            // Auto-responsive: horizontal containers switch to vertical on mobile
            if (el.isContainer && el.styles?.flexDirection === 'row') {
                autoMobileCSS += `        #${elCssId} > .element-children, #${elCssId} { flex-direction: column !important; }\n`;
            }

            // Auto-responsive: reduce large font sizes on mobile
            const fontSize = parseInt(el.styles?.fontSize);
            if (fontSize && fontSize > 32) {
                const tabletSize = Math.max(24, Math.round(fontSize * 0.75));
                const mobileSize = Math.max(20, Math.round(fontSize * 0.6));
                autoTabletCSS += `        #${elCssId} { font-size: ${tabletSize}px !important; }\n`;
                autoMobileCSS += `        #${elCssId} { font-size: ${mobileSize}px !important; }\n`;
            }

            // Auto-responsive: reduce large padding on mobile
            const padding = parseInt(el.styles?.padding);
            if (padding && padding > 40) {
                autoMobileCSS += `        #${elCssId} { padding: ${Math.round(padding * 0.5)}px !important; }\n`;
            }

            // Process children
            if (el.children?.length) {
                collectResponsiveStyles(el.children);
            }
        }
    }

    collectResponsiveStyles(state.elements);

    // Combine auto and user styles (user styles take priority)
    let css = '';

    // Base responsive styles
    css += `        /* Auto-responsive base styles */
        @media (max-width: 1024px) {
            .hero h1, h1 { font-size: 36px !important; }
            .hero p { font-size: 18px !important; }
${autoTabletCSS}${tabletCSS}        }
        @media (max-width: 640px) {
            .hero h1, h1 { font-size: 28px !important; }
            h2 { font-size: 24px !important; }
            h3 { font-size: 20px !important; }
            .hero p { font-size: 16px !important; }
            section { padding: 40px 15px !important; }
            .container { padding: 15px !important; }
            nav { padding: 10px !important; }
            .row { flex-direction: column !important; }
            .column { min-width: 100% !important; flex: 1 1 100% !important; }
            .features > div { grid-template-columns: 1fr !important; }
${autoMobileCSS}${mobileCSS}        }
`;

    return css;
}

// Check if elements tree contains forms
function checkForForms(elements) {
    for (const el of elements) {
        if (el.type === 'form') return true;
        if (el.children?.length && checkForForms(el.children)) return true;
    }
    return false;
}

// Generate form handling script
function generateFormScript() {
    return `
<script>
document.querySelectorAll('form[data-form-id]').forEach(form => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Отправка...';

        try {
            const formData = Object.fromEntries(new FormData(form));
            const pageId = form.dataset.pageId;
            const successMessage = form.dataset.successMessage || 'Спасибо! Ваша заявка отправлена.';
            const webhook = form.dataset.webhook;
            const saveBackend = form.dataset.saveBackend === 'true';

            // Send to webhook if specified
            if (webhook) {
                try {
                    await fetch(webhook, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pageId, formData, submittedAt: new Date().toISOString() })
                    });
                } catch (err) {
                    console.log('Webhook error:', err);
                }
            }

            // Save to backend if enabled
            if (saveBackend) {
                try {
                    await fetch('https://ai-tools-backend-d3zr.onrender.com/api/submissions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pageId, formData, submittedAt: new Date().toISOString() })
                    });
                } catch (err) {
                    console.log('Backend save error:', err);
                }
            }

            // Show success message
            form.innerHTML = '<div class="form-success">' + successMessage + '</div>';

        } catch (error) {
            btn.disabled = false;
            btn.textContent = originalText;
            form.insertAdjacentHTML('beforeend', '<div class="form-error" style="margin-top:10px;">Ошибка отправки. Попробуйте ещё раз.</div>');
            setTimeout(() => form.querySelector('.form-error')?.remove(), 5000);
        }
    });
});
</script>`;
}

// Preview
document.getElementById('previewBtn').addEventListener('click', () => {
    const modal = document.getElementById('previewModal');
    const frame = document.getElementById('previewFrame');
    frame.srcdoc = generateFullHTML();
    modal.classList.add('active');
});

document.getElementById('closePreview').addEventListener('click', () => {
    document.getElementById('previewModal').classList.remove('active');
});

// Code
document.getElementById('codeBtn').addEventListener('click', () => {
    const modal = document.getElementById('codeModal');
    document.querySelector('#htmlCode code').textContent = generateHTML();
    document.querySelector('#cssCode code').textContent = '/* Стили встроены в HTML */';
    document.querySelector('#fullCode code').textContent = generateFullHTML();
    modal.classList.add('active');
});

document.getElementById('closeCode').addEventListener('click', () => {
    document.getElementById('codeModal').classList.remove('active');
});

document.querySelectorAll('.code-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.code-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + 'Code').classList.add('active');
    });
});

document.getElementById('copyCode').addEventListener('click', () => {
    const activeCode = document.querySelector('.code-content.active code');
    navigator.clipboard.writeText(activeCode.textContent);
    alert('Код скопирован!');
});

document.getElementById('downloadCode').addEventListener('click', () => {
    const blob = new Blob([generateFullHTML()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'landing.html';
    a.click();
    URL.revokeObjectURL(url);
});

// ===== Export Dropdown =====
const exportBtn = document.getElementById('exportBtn');
const exportDropdownMenu = document.getElementById('exportDropdownMenu');

exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdownMenu.classList.toggle('show');
});

document.addEventListener('click', () => {
    exportDropdownMenu.classList.remove('show');
});

// Export as HTML
document.getElementById('exportHtmlBtn').addEventListener('click', () => {
    const blob = new Blob([generateFullHTML()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (state.meta?.title || 'landing') + '.html';
    a.click();
    URL.revokeObjectURL(url);
    exportDropdownMenu.classList.remove('show');
});

// Export as ZIP
document.getElementById('exportZipBtn').addEventListener('click', async () => {
    exportDropdownMenu.classList.remove('show');
    await exportAsZip();
});

// ZIP Export Function
async function exportAsZip() {
    if (typeof JSZip === 'undefined') {
        alert('Ошибка: JSZip не загружен');
        return;
    }

    const zip = new JSZip();
    const images = zip.folder('images');
    const imageMap = new Map(); // base64 -> filename
    let imageCounter = 1;

    // Extract images from elements
    function extractImages(elements) {
        elements.forEach(el => {
            // Check for img src
            if (el.tag === 'img' && el.attrs?.src) {
                const src = el.attrs.src;
                if (src.startsWith('data:image/')) {
                    if (!imageMap.has(src)) {
                        const ext = src.match(/data:image\/(\w+)/)?.[1] || 'png';
                        const filename = `image_${imageCounter++}.${ext}`;
                        imageMap.set(src, filename);

                        // Convert base64 to binary
                        const base64Data = src.split(',')[1];
                        images.file(filename, base64Data, { base64: true });
                    }
                }
            }

            // Check content for inline images
            if (el.content) {
                const imgMatches = el.content.matchAll(/src="(data:image\/[^"]+)"/g);
                for (const match of imgMatches) {
                    const src = match[1];
                    if (!imageMap.has(src)) {
                        const ext = src.match(/data:image\/(\w+)/)?.[1] || 'png';
                        const filename = `image_${imageCounter++}.${ext}`;
                        imageMap.set(src, filename);

                        const base64Data = src.split(',')[1];
                        images.file(filename, base64Data, { base64: true });
                    }
                }
            }

            // Check background images in styles
            const bgImage = el.styles?.backgroundImage;
            if (bgImage && bgImage.includes('data:image/')) {
                const match = bgImage.match(/url\(["']?(data:image\/[^"')]+)["']?\)/);
                if (match && !imageMap.has(match[1])) {
                    const src = match[1];
                    const ext = src.match(/data:image\/(\w+)/)?.[1] || 'png';
                    const filename = `image_${imageCounter++}.${ext}`;
                    imageMap.set(src, filename);

                    const base64Data = src.split(',')[1];
                    images.file(filename, base64Data, { base64: true });
                }
            }

            // Check meta images
            if (state.meta?.ogImage?.startsWith('data:image/')) {
                const src = state.meta.ogImage;
                if (!imageMap.has(src)) {
                    const ext = src.match(/data:image\/(\w+)/)?.[1] || 'png';
                    const filename = `og-image.${ext}`;
                    imageMap.set(src, filename);

                    const base64Data = src.split(',')[1];
                    images.file(filename, base64Data, { base64: true });
                }
            }

            if (state.meta?.favicon?.startsWith('data:image/')) {
                const src = state.meta.favicon;
                if (!imageMap.has(src)) {
                    const ext = src.match(/data:image\/(\w+)/)?.[1] || 'ico';
                    const filename = `favicon.${ext === 'x-icon' ? 'ico' : ext}`;
                    imageMap.set(src, filename);

                    const base64Data = src.split(',')[1];
                    zip.file(filename, base64Data, { base64: true });
                }
            }

            if (el.children?.length) {
                extractImages(el.children);
            }
        });
    }

    // Extract all images
    extractImages(state.elements);

    // Generate HTML with replaced image paths
    let html = generateFullHTML();

    // Replace base64 images with file paths
    imageMap.forEach((filename, base64) => {
        if (filename.startsWith('favicon') || filename.startsWith('og-image')) {
            html = html.split(base64).join(filename);
        } else {
            html = html.split(base64).join('images/' + filename);
        }
    });

    // Add HTML file
    zip.file('index.html', html);

    // Generate and download ZIP
    try {
        const content = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        const siteName = state.meta?.title || 'landing-page';
        const safeName = siteName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_').toLowerCase();
        saveAs(content, `${safeName}.zip`);
    } catch (err) {
        console.error('ZIP export error:', err);
        alert('Ошибка при создании архива: ' + err.message);
    }
}

// ===== Save/Load =====
function saveProject() {
    if (state.pageId) {
        // Save to pages storage
        savePageData();
        alert('Страница сохранена!');
    } else {
        // Legacy save
        localStorage.setItem('builder_project', JSON.stringify(state.elements));
        alert('Проект сохранён!');
    }
}

function loadProject() {
    if (state.pageId) {
        // Load from pages storage
        loadPageData();
    } else {
        // Legacy load
        const saved = localStorage.getItem('builder_project');
        if (saved) {
            state.elements = JSON.parse(saved);
            renderCanvas();
            renderLayers();
        }
    }
}

document.getElementById('saveBtn').addEventListener('click', saveProject);

// ===== Search =====
document.getElementById('blockSearch').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.block-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? '' : 'none';
    });
});

// Apply page template
function applyPageTemplate(templateId) {
    const template = pageTemplates.find(t => t.id === templateId);
    if (!template || !template.elements) return;

    // Create elements from template
    const createElementsFromTemplate = (templateElements) => {
        return templateElements.map(tpl => {
            const el = createElement(tpl.type);
            if (!el) return null;

            // Override styles if provided
            if (tpl.styles) {
                el.styles = { ...el.styles, ...tpl.styles };
            }

            // Override content if provided
            if (tpl.content) {
                el.content = tpl.content;
            }

            // Apply componentSettings from template
            if (tpl.componentSettings) {
                // Merge template settings with defaults
                el.componentSettings = { ...el.componentSettings, ...tpl.componentSettings };
                // Regenerate content based on new settings
                if (typeof generateComponentContent === 'function') {
                    el.content = generateComponentContent(tpl.type, el.componentSettings);
                }
            }

            // Create children
            if (tpl.children) {
                el.children = createElementsFromTemplate(tpl.children).filter(Boolean);
            }

            return el;
        }).filter(Boolean);
    };

    state.elements = createElementsFromTemplate(template.elements);
    savePageData();
    renderCanvas();
    renderLayers();
    saveHistory();

    // Remove template param from URL
    const newUrl = window.location.pathname + '?id=' + currentPageId;
    window.history.replaceState({}, '', newUrl);
}

canvas.addEventListener('click', (e) => {
    if (e.target === canvas || e.target === canvasEmpty) {
        selectElement(null);
    }
});

// ===== Visual Guides Toggle =====
let visualGuidesActive = false;
document.getElementById('guidesBtn').addEventListener('click', function() {
    visualGuidesActive = !visualGuidesActive;
    this.classList.toggle('active', visualGuidesActive);
    document.getElementById('canvas').classList.toggle('visual-guides-active', visualGuidesActive);
});

// ===== SEO Modal =====
const seoModal = document.getElementById('seoModal');

document.getElementById('seoBtn').addEventListener('click', () => {
    // Populate form with current meta data
    document.getElementById('seoTitle').value = state.meta.title || state.pageName || '';
    document.getElementById('seoDescription').value = state.meta.description || '';
    document.getElementById('seoKeywords').value = state.meta.keywords || '';
    document.getElementById('seoOgTitle').value = state.meta.ogTitle || '';
    document.getElementById('seoOgDescription').value = state.meta.ogDescription || '';
    document.getElementById('seoOgImage').value = state.meta.ogImage || '';

    // Show favicon preview if exists
    const faviconPreview = document.getElementById('faviconPreview');
    if (state.meta.favicon) {
        faviconPreview.src = state.meta.favicon;
        faviconPreview.style.display = 'block';
    } else {
        faviconPreview.style.display = 'none';
    }

    seoModal.classList.add('active');
});

document.getElementById('closeSeoModal').addEventListener('click', () => {
    seoModal.classList.remove('active');
});

document.getElementById('cancelSeoBtn').addEventListener('click', () => {
    seoModal.classList.remove('active');
});

document.getElementById('saveSeoBtn').addEventListener('click', () => {
    state.meta.title = document.getElementById('seoTitle').value;
    state.meta.description = document.getElementById('seoDescription').value;
    state.meta.keywords = document.getElementById('seoKeywords').value;
    state.meta.ogTitle = document.getElementById('seoOgTitle').value;
    state.meta.ogDescription = document.getElementById('seoOgDescription').value;
    state.meta.ogImage = document.getElementById('seoOgImage').value;

    savePageData();
    seoModal.classList.remove('active');
    alert('SEO настройки сохранены!');
});

// OG Image upload
document.getElementById('seoOgImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('seoOgImage').value = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Favicon upload
document.getElementById('seoFaviconUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            state.meta.favicon = event.target.result;
            const preview = document.getElementById('faviconPreview');
            preview.src = event.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// ===== Theme Modal Handlers =====
const themeModal = document.getElementById('themeModal');

// Theme color field pairs mapping
const themeFields = [
    { key: 'primaryColor', picker: 'themePrimary', text: 'themePrimaryText' },
    { key: 'secondaryColor', picker: 'themeSecondary', text: 'themeSecondaryText' },
    { key: 'accentColor', picker: 'themeAccent', text: 'themeAccentText' },
    { key: 'textColor', picker: 'themeText', text: 'themeTextText' },
    { key: 'textSecondary', picker: 'themeTextSecondary', text: 'themeTextSecondaryText' },
    { key: 'bgColor', picker: 'themeBg', text: 'themeBgText' },
    { key: 'bgSecondary', picker: 'themeBgSecondary', text: 'themeBgSecondaryText' },
    { key: 'borderColor', picker: 'themeBorder', text: 'themeBorderText' }
];

function populateThemeModal() {
    const t = state.theme || {};
    themeFields.forEach(f => {
        const val = t[f.key] || '#000000';
        const p = document.getElementById(f.picker);
        const tx = document.getElementById(f.text);
        if (p) p.value = val;
        if (tx) tx.value = val;
    });
    const fontSel = document.getElementById('themeFontFamily');
    if (fontSel) fontSel.value = t.fontFamily || 'Inter';
    const radiusSel = document.getElementById('themeBorderRadius');
    if (radiusSel) radiusSel.value = t.borderRadius || '8px';

    // Render preset buttons
    const presetsContainer = document.getElementById('themePresets');
    if (presetsContainer) {
        presetsContainer.innerHTML = themePresets.map(p => `
            <button type="button" class="btn" style="padding:8px 16px;font-size:13px;" data-preset="${p.id}">
                <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${p.theme.primaryColor};margin-right:6px;vertical-align:middle;"></span>
                ${p.name}
            </button>
        `).join('');
        presetsContainer.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = themePresets.find(p => p.id === btn.dataset.preset);
                if (preset) {
                    const t = preset.theme;
                    themeFields.forEach(f => {
                        const val = t[f.key] || '#000000';
                        const p = document.getElementById(f.picker);
                        const tx = document.getElementById(f.text);
                        if (p) p.value = val;
                        if (tx) tx.value = val;
                    });
                    const fontSel = document.getElementById('themeFontFamily');
                    if (fontSel) fontSel.value = t.fontFamily || 'Inter';
                    const radiusSel = document.getElementById('themeBorderRadius');
                    if (radiusSel) radiusSel.value = t.borderRadius || '8px';
                }
            });
        });
    }
}

// Sync color pickers with text inputs in theme modal
themeFields.forEach(f => {
    const p = document.getElementById(f.picker);
    const tx = document.getElementById(f.text);
    if (p && tx) {
        p.addEventListener('input', () => { tx.value = p.value; });
        tx.addEventListener('input', () => { if (/^#[0-9A-Fa-f]{6}$/.test(tx.value)) p.value = tx.value; });
    }
});

document.getElementById('themeBtn').addEventListener('click', () => {
    populateThemeModal();
    themeModal.classList.add('active');
});

document.getElementById('closeThemeModal').addEventListener('click', () => {
    themeModal.classList.remove('active');
});

document.getElementById('cancelThemeBtn').addEventListener('click', () => {
    themeModal.classList.remove('active');
});

document.getElementById('saveThemeBtn').addEventListener('click', () => {
    themeFields.forEach(f => {
        const tx = document.getElementById(f.text);
        if (tx) state.theme[f.key] = tx.value;
    });
    const fontSel = document.getElementById('themeFontFamily');
    if (fontSel) state.theme.fontFamily = fontSel.value;
    const radiusSel = document.getElementById('themeBorderRadius');
    if (radiusSel) state.theme.borderRadius = radiusSel.value;

    savePageData();
    themeModal.classList.remove('active');
    alert('Тема применена!');
});

// ===== Publish Modal Handlers =====
const publishModal = document.getElementById('publishModal');

document.getElementById('publishBtn').addEventListener('click', () => {
    publishModal.classList.add('active');
});

document.getElementById('closePublishModal').addEventListener('click', () => {
    publishModal.classList.remove('active');
});

document.getElementById('cancelPublishBtn').addEventListener('click', () => {
    publishModal.classList.remove('active');
});

// Toggle publish option details
document.querySelectorAll('.publish-option-header').forEach(header => {
    header.addEventListener('click', () => {
        const option = header.closest('.publish-option');
        option.classList.toggle('expanded');
    });
});

// Download ZIP from publish modal
document.getElementById('downloadForPublish').addEventListener('click', async () => {
    publishModal.classList.remove('active');
    await exportAsZip();
});

// ===== AI Generation Modal =====
const aiModal = document.getElementById('aiModal');

document.getElementById('aiGenerateBtn').addEventListener('click', () => {
    aiModal.classList.add('active');
    document.getElementById('aiProgress').style.display = 'none';
    document.getElementById('aiError').style.display = 'none';
    document.getElementById('aiGenerateSubmit').disabled = false;
});

document.getElementById('closeAiModal').addEventListener('click', () => {
    aiModal.classList.remove('active');
});

document.getElementById('aiCancelBtn').addEventListener('click', () => {
    aiModal.classList.remove('active');
});

document.getElementById('aiGenerateSubmit').addEventListener('click', async () => {
    const niche = document.getElementById('aiNiche').value.trim();
    const product = document.getElementById('aiProduct').value.trim();
    const productDescription = document.getElementById('aiProductDesc').value.trim();
    const audience = document.getElementById('aiAudience').value.trim();
    const mainOffer = document.getElementById('aiOffer').value.trim();
    const tone = document.getElementById('aiTone').value;
    const colorScheme = document.getElementById('aiColors').value;

    if (!niche || !product || !productDescription || !audience || !mainOffer) {
        document.getElementById('aiError').textContent = 'Заполните все обязательные поля (отмечены *)';
        document.getElementById('aiError').style.display = 'block';
        return;
    }

    // Show progress
    document.getElementById('aiError').style.display = 'none';
    document.getElementById('aiProgress').style.display = 'block';
    document.getElementById('aiGenerateSubmit').disabled = true;

    // Reset progress animation
    const progressFill = document.querySelector('.ai-progress-fill');
    progressFill.style.animation = 'none';
    progressFill.offsetHeight; // trigger reflow
    progressFill.style.animation = 'ai-progress 60s ease-out forwards';

    // Determine API base URL
    const apiBase = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        ? `${location.protocol}//${location.hostname}:3000/api`
        : '/api';

    // Safe JSON parse from fetch response
    const safeParseResponse = async (resp, context) => {
        const text = await resp.text();
        console.log('[AI] ' + context + ' raw text (' + text.length + ' chars):', text.substring(0, 500));
        if (!text || !text.trim()) {
            throw new Error(context + ': сервер вернул пустой ответ (HTTP ' + resp.status + ')');
        }
        try {
            return JSON.parse(text.trim());
        } catch (e) {
            console.error('[AI] ' + context + ' JSON parse failed, raw:', text.substring(0, 500));
            throw new Error(context + ': некорректный ответ сервера');
        }
    };

    try {
        // First check if AI is configured
        try {
            const statusCheck = await fetch(apiBase + '/ai/status');
            const statusData = await safeParseResponse(statusCheck, 'Status check');
            if (!statusData.configured) {
                throw new Error('OPENROUTER_API_KEY не настроен на сервере. Добавьте ключ в переменные окружения.');
            }
        } catch (statusErr) {
            if (statusErr.message.includes('OPENROUTER_API_KEY')) throw statusErr;
            console.warn('[AI] Status check failed:', statusErr.message);
        }

        // Step 1: Start the generation job
        console.log('[AI] Sending POST to:', apiBase + '/ai/generate-landing');
        console.log('[AI] Request body:', { niche, product, productDescription, audience, mainOffer, tone, colorScheme });

        const startResponse = await fetch(apiBase + '/ai/generate-landing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ niche, product, productDescription, audience, mainOffer, tone, colorScheme })
        });

        console.log('[AI] Response status:', startResponse.status);
        console.log('[AI] Response headers:', [...startResponse.headers.entries()]);

        const startData = await safeParseResponse(startResponse, 'Запуск генерации');
        if (!startData.success || !startData.jobId) {
            throw new Error(startData.error || 'Не удалось запустить генерацию');
        }

        const jobId = startData.jobId;
        console.log('[AI] Job started:', jobId);

        // Step 2: Poll for result every 3 seconds, up to 90 seconds
        const maxAttempts = 30;
        let attempts = 0;
        let result = null;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            attempts++;

            console.log('[AI] Polling attempt', attempts, 'for job', jobId);

            let pollData;
            try {
                const pollResponse = await fetch(apiBase + '/ai/result/' + jobId);
                pollData = await safeParseResponse(pollResponse, 'Polling');
            } catch (pollErr) {
                console.warn('[AI] Poll error (attempt ' + attempts + '):', pollErr.message);
                continue; // Retry on transient errors
            }

            if (pollData.status === 'processing') {
                continue;
            }

            if (pollData.status === 'error') {
                throw new Error(pollData.error || 'Ошибка генерации');
            }

            if (pollData.status === 'done' && pollData.elements) {
                result = pollData;
                break;
            }

            // Unexpected response
            if (!pollData.success && pollData.error) {
                throw new Error(pollData.error);
            }
        }

        if (!result) {
            throw new Error('AI не ответил за 90 секунд. Попробуйте ещё раз.');
        }

        console.log('[AI] Generation done:', result.elements.length, 'elements');

        // Confirm replacement if page has content
        if (state.elements.length > 0) {
            if (!confirm('Заменить текущее содержимое страницы на сгенерированное?')) {
                document.getElementById('aiProgress').style.display = 'none';
                document.getElementById('aiGenerateSubmit').disabled = false;
                return;
            }
        }

        // Apply generated elements using the same logic as applyPageTemplate
        const createElementsFromAI = (templateElements) => {
            return templateElements.map(tpl => {
                const el = createElement(tpl.type);
                if (!el) return null;

                if (tpl.styles) {
                    el.styles = { ...el.styles, ...tpl.styles };
                }

                if (tpl.content) {
                    el.content = tpl.content;
                }

                if (tpl.componentSettings) {
                    el.componentSettings = { ...el.componentSettings, ...tpl.componentSettings };
                    if (typeof generateComponentContent === 'function') {
                        el.content = generateComponentContent(tpl.type, el.componentSettings);
                    }
                }

                if (tpl.children) {
                    el.children = createElementsFromAI(tpl.children).filter(Boolean);
                }

                return el;
            }).filter(Boolean);
        };

        state.elements = createElementsFromAI(result.elements);
        savePageData();
        renderCanvas();
        renderLayers();
        saveHistory();

        // Close modal
        aiModal.classList.remove('active');

    } catch (err) {
        console.error('AI generation error:', err);
        document.getElementById('aiError').textContent = err.message || 'Ошибка генерации. Попробуйте ещё раз.';
        document.getElementById('aiError').style.display = 'block';
    } finally {
        document.getElementById('aiProgress').style.display = 'none';
        document.getElementById('aiGenerateSubmit').disabled = false;
    }
});

// ===== Init =====
loadProject();

// Check for template parameter after loading
const templateParam = urlParams.get('template');
if (templateParam && state.elements.length === 0) {
    console.log('[Builder] Applying template:', templateParam);
    applyPageTemplate(templateParam);
    if (state.elements.length === 0) {
        console.warn('[Builder] Template applied but no elements created for:', templateParam);
    }
}

saveHistory();
renderLayers();
