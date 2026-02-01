// ===== Landing Page Builder =====

// Get page ID from URL
const urlParams = new URLSearchParams(window.location.search);
const currentPageId = urlParams.get('id');

// Redirect to pages if no page ID
if (!currentPageId) {
    window.location.href = 'pages.html';
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
    }
};

// Load page data
function loadPageData() {
    if (!currentPageId) return;

    const pages = JSON.parse(localStorage.getItem('landing_pages') || '[]');
    const page = pages.find(p => p.id === currentPageId);

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
    const pageIndex = pages.findIndex(p => p.id === currentPageId);

    if (pageIndex !== -1) {
        pages[pageIndex].elements = state.elements;
        pages[pageIndex].meta = state.meta;
        pages[pageIndex].updatedAt = new Date().toISOString();
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
    {
        id: 'blank',
        name: 'Пустая страница',
        category: 'basic',
        thumbnail: '📄',
        elements: []
    },
    {
        id: 'landing-basic',
        name: 'Базовый лендинг',
        category: 'landing',
        thumbnail: '🚀',
        elements: [
            {
                type: 'navbar',
                styles: { backgroundColor: 'white', padding: '0 20px', borderBottom: '1px solid #e2e8f0' }
            },
            {
                type: 'hero',
                styles: { padding: '100px 20px', backgroundColor: '#f8fafc' }
            },
            {
                type: 'section',
                styles: { padding: '80px 20px' },
                children: [{ type: 'features' }]
            },
            {
                type: 'footer',
                styles: { backgroundColor: '#1e293b', color: 'white' }
            }
        ]
    },
    {
        id: 'landing-sales',
        name: 'Продающий лендинг',
        category: 'landing',
        thumbnail: '💰',
        elements: [
            {
                type: 'navbar',
                styles: { backgroundColor: '#1e293b', color: 'white', padding: '0 20px' }
            },
            {
                type: 'hero',
                styles: { padding: '120px 20px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', color: 'white' }
            },
            {
                type: 'section',
                styles: { padding: '80px 20px' },
                children: [{ type: 'features' }]
            },
            {
                type: 'section',
                styles: { padding: '80px 20px', backgroundColor: '#f8fafc' },
                children: [{ type: 'testimonial' }, { type: 'testimonial' }]
            },
            {
                type: 'section',
                styles: { padding: '80px 20px' },
                children: [
                    { type: 'heading', content: 'Выберите тариф', styles: { textAlign: 'center', marginBottom: '40px' } },
                    { type: 'row', children: [{ type: 'pricing' }, { type: 'pricing' }, { type: 'pricing' }] }
                ]
            },
            {
                type: 'section',
                styles: { padding: '80px 20px', backgroundColor: '#3b82f6', color: 'white' },
                children: [{ type: 'form' }]
            },
            {
                type: 'footer',
                styles: { backgroundColor: '#1e293b', color: 'white' }
            }
        ]
    },
    {
        id: 'portfolio',
        name: 'Портфолио',
        category: 'portfolio',
        thumbnail: '🎨',
        elements: [
            {
                type: 'navbar',
                styles: { backgroundColor: 'white', padding: '0 20px', borderBottom: '1px solid #e2e8f0' }
            },
            {
                type: 'section',
                styles: { padding: '100px 20px', textAlign: 'center' },
                children: [
                    { type: 'heading', content: 'Привет, я дизайнер', styles: { fontSize: '48px' } },
                    { type: 'text', content: 'Создаю красивые и функциональные сайты' }
                ]
            },
            {
                type: 'section',
                styles: { padding: '80px 20px' },
                children: [
                    { type: 'heading', content: 'Мои работы', styles: { textAlign: 'center', marginBottom: '40px' } },
                    { type: 'gallery' }
                ]
            },
            {
                type: 'section',
                styles: { padding: '80px 20px', backgroundColor: '#f8fafc' },
                children: [
                    { type: 'heading', content: 'Связаться со мной', styles: { textAlign: 'center', marginBottom: '40px' } },
                    { type: 'form' }
                ]
            },
            {
                type: 'footer',
                styles: { backgroundColor: '#1e293b', color: 'white' }
            }
        ]
    },
    {
        id: 'business-card',
        name: 'Визитка',
        category: 'business',
        thumbnail: '📇',
        elements: [
            {
                type: 'section',
                styles: { padding: '100px 20px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
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
        content: `<div style="text-align:center;max-width:800px;margin:0 auto;"><h1 style="font-size:48px;font-weight:bold;margin-bottom:20px;color:#1e293b;">Заголовок Hero секции</h1><p style="font-size:20px;color:#475569;margin-bottom:30px;">Подзаголовок с описанием вашего продукта или услуги</p><a href="#" style="display:inline-block;padding:16px 32px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:500;">Начать</a></div>`,
        defaultStyles: { padding: '100px 20px', backgroundColor: '#f8fafc' }
    },
    features: {
        tag: 'div',
        label: 'Преимущества',
        icon: 'fa-th-large',
        content: `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:30px;"><div style="text-align:center;padding:20px;"><div style="font-size:48px;margin-bottom:16px;">🚀</div><h3 style="font-size:20px;margin-bottom:8px;">Быстро</h3><p style="color:#64748b;">Описание преимущества</p></div><div style="text-align:center;padding:20px;"><div style="font-size:48px;margin-bottom:16px;">💡</div><h3 style="font-size:20px;margin-bottom:8px;">Удобно</h3><p style="color:#64748b;">Описание преимущества</p></div><div style="text-align:center;padding:20px;"><div style="font-size:48px;margin-bottom:16px;">✨</div><h3 style="font-size:20px;margin-bottom:8px;">Качественно</h3><p style="color:#64748b;">Описание преимущества</p></div></div>`,
        defaultStyles: { padding: '40px 20px' }
    },
    card: {
        tag: 'div',
        label: 'Карточка',
        icon: 'fa-id-card',
        content: `<img src="https://via.placeholder.com/400x200" style="width:100%;border-radius:8px 8px 0 0;"><div style="padding:20px;"><h3 style="font-size:20px;margin-bottom:8px;">Заголовок карточки</h3><p style="color:#64748b;margin-bottom:16px;">Описание карточки</p><a href="#" style="color:#3b82f6;">Подробнее →</a></div>`,
        defaultStyles: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden', maxWidth: '350px' }
    },
    testimonial: {
        tag: 'div',
        label: 'Отзыв',
        icon: 'fa-quote-left',
        content: `<div style="padding:24px;background:#f8fafc;border-radius:8px;"><p style="font-size:18px;font-style:italic;margin-bottom:16px;">"Отличный продукт! Рекомендую всем."</p><div style="display:flex;align-items:center;gap:12px;"><img src="https://via.placeholder.com/48" style="width:48px;height:48px;border-radius:50%;"><div><div style="font-weight:600;">Имя Фамилия</div><div style="color:#64748b;font-size:14px;">Должность</div></div></div></div>`,
        defaultStyles: {}
    },
    pricing: {
        tag: 'div',
        label: 'Цена',
        icon: 'fa-tag',
        content: `<div style="text-align:center;padding:32px;background:white;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><h3 style="font-size:24px;margin-bottom:8px;">Базовый</h3><div style="font-size:48px;font-weight:bold;margin:16px 0;">$29<span style="font-size:16px;color:#64748b;">/мес</span></div><ul style="list-style:none;padding:0;margin-bottom:24px;color:#64748b;"><li style="padding:8px 0;">✓ Функция 1</li><li style="padding:8px 0;">✓ Функция 2</li><li style="padding:8px 0;">✓ Функция 3</li></ul><a href="#" style="display:block;padding:12px;background:#3b82f6;color:white;text-decoration:none;border-radius:6px;">Выбрать</a></div>`,
        defaultStyles: { maxWidth: '300px' }
    },
    counter: {
        tag: 'div',
        label: 'Счётчик',
        icon: 'fa-sort-numeric-up',
        content: `<div style="display:flex;justify-content:space-around;text-align:center;"><div><div style="font-size:48px;font-weight:bold;color:#3b82f6;">500+</div><div style="color:#64748b;">Клиентов</div></div><div><div style="font-size:48px;font-weight:bold;color:#3b82f6;">10</div><div style="color:#64748b;">Лет опыта</div></div><div><div style="font-size:48px;font-weight:bold;color:#3b82f6;">99%</div><div style="color:#64748b;">Довольных</div></div></div>`,
        defaultStyles: { padding: '40px 20px' }
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
        content: `<div style="text-align:center;color:white;padding:100px 20px;position:relative;z-index:1;">
            <h2 style="font-size:42px;font-weight:bold;margin-bottom:20px;text-shadow:2px 2px 4px rgba(0,0,0,0.3);">Параллакс заголовок</h2>
            <p style="font-size:20px;max-width:600px;margin:0 auto 30px;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">Красивый эффект параллакса при скролле страницы</p>
            <a href="#" style="display:inline-block;padding:14px 32px;background:white;color:#1e293b;text-decoration:none;border-radius:8px;font-weight:600;">Подробнее</a>
        </div>`,
        defaultStyles: {
            backgroundImage: 'url(https://via.placeholder.com/1920x800/1e293b/1e293b)',
            backgroundAttachment: 'fixed',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            position: 'relative'
        }
    },

    // Marquee / Ticker
    marquee: {
        tag: 'div',
        label: 'Бегущая строка',
        icon: 'fa-text-width',
        content: `<div class="marquee-container" style="overflow:hidden;white-space:nowrap;">
            <div class="marquee-content" style="display:inline-block;animation:marquee 20s linear infinite;">
                <span style="padding:0 50px;">🔥 Специальное предложение</span>
                <span style="padding:0 50px;">⭐ Скидка 20% на все услуги</span>
                <span style="padding:0 50px;">📞 Звоните: +7 (999) 123-45-67</span>
                <span style="padding:0 50px;">🔥 Специальное предложение</span>
                <span style="padding:0 50px;">⭐ Скидка 20% на все услуги</span>
                <span style="padding:0 50px;">📞 Звоните: +7 (999) 123-45-67</span>
            </div>
        </div>
        <style>
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        </style>`,
        defaultStyles: {
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '12px 0',
            fontSize: '16px',
            fontWeight: '500'
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

    return element;
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
            canvas.appendChild(renderElement(el));
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
        button: () => `
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
                <div class="edit-row">
                    <label>Открывать в</label>
                    <select class="edit-select" data-attr="target">
                        <option value="">Текущем окне</option>
                        <option value="_blank" ${el.attrs?.target === '_blank' ? 'selected' : ''}>Новом окне</option>
                    </select>
                </div>
            </div>
        `,

        // ===== ССЫЛКА =====
        link: () => `
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
                <div class="edit-row">
                    <label>Открывать в</label>
                    <select class="edit-select" data-attr="target">
                        <option value="">Текущем окне</option>
                        <option value="_blank" ${el.attrs?.target === '_blank' ? 'selected' : ''}>Новом окне</option>
                    </select>
                </div>
            </div>
        `,

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

        hero: () => `
            <div class="edit-section">
                <h4><i class="fas fa-flag"></i> Hero секция</h4>
                <div class="edit-row">
                    <label>Заголовок</label>
                    <input type="text" class="edit-input" data-custom="heroTitle" value="${extractHeroTitle(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Подзаголовок</label>
                    <textarea class="edit-textarea" data-custom="heroSubtitle" rows="2">${extractHeroSubtitle(el.content)}</textarea>
                </div>
                <div class="edit-row">
                    <label>Текст кнопки</label>
                    <input type="text" class="edit-input" data-custom="heroButton" value="${extractHeroButton(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Ссылка кнопки</label>
                    <input type="text" class="edit-input" data-custom="heroButtonLink" value="#" placeholder="https://...">
                </div>
                <div class="edit-row">
                    <label>Цвет кнопки</label>
                    <div class="edit-color">
                        <input type="color" value="#3b82f6" data-custom="heroButtonColor">
                        <input type="text" class="edit-input" value="#3b82f6">
                    </div>
                </div>
            </div>
        `,

        features: () => `
            <div class="edit-section">
                <h4><i class="fas fa-th-large"></i> Преимущества</h4>
                <div class="edit-row">
                    <label>Преимущества</label>
                    <textarea class="edit-textarea" data-custom="featuresItems" rows="10" placeholder="🚀
Быстро
Описание преимущества

💡
Удобно
Описание преимущества">${extractFeaturesItems(el.content)}</textarea>
                </div>
                <p class="edit-hint">Формат: Иконка/эмодзи, Заголовок, Описание. Разделяйте блоки пустой строкой.</p>
            </div>
            <div class="edit-section">
                <h4><i class="fas fa-th"></i> Сетка</h4>
                <div class="edit-row">
                    <label>Колонок</label>
                    <select class="edit-select" data-custom="featuresCols">
                        <option value="2">2 колонки</option>
                        <option value="3" selected>3 колонки</option>
                        <option value="4">4 колонки</option>
                    </select>
                </div>
            </div>
        `,

        card: () => `
            <div class="edit-section">
                <h4><i class="fas fa-id-card"></i> Карточка</h4>
                <div class="edit-row">
                    <label>URL изображения</label>
                    <input type="text" class="edit-input" data-custom="cardImage" value="${extractCardImage(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Заголовок</label>
                    <input type="text" class="edit-input" data-custom="cardTitle" value="${extractCardTitle(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Описание</label>
                    <textarea class="edit-textarea" data-custom="cardDescription" rows="3">${extractCardDescription(el.content)}</textarea>
                </div>
                <div class="edit-row">
                    <label>Текст ссылки</label>
                    <input type="text" class="edit-input" data-custom="cardLinkText" value="Подробнее →">
                </div>
                <div class="edit-row">
                    <label>URL ссылки</label>
                    <input type="text" class="edit-input" data-custom="cardLink" value="#" placeholder="https://...">
                </div>
            </div>
        `,

        testimonial: () => `
            <div class="edit-section">
                <h4><i class="fas fa-quote-left"></i> Отзыв</h4>
                <div class="edit-row">
                    <label>Текст отзыва</label>
                    <textarea class="edit-textarea" data-custom="testimonialText" rows="3">${extractTestimonialText(el.content)}</textarea>
                </div>
                <div class="edit-row">
                    <label>Имя автора</label>
                    <input type="text" class="edit-input" data-custom="testimonialName" value="${extractTestimonialName(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Должность / компания</label>
                    <input type="text" class="edit-input" data-custom="testimonialRole" value="${extractTestimonialRole(el.content)}">
                </div>
                <div class="edit-row">
                    <label>Фото (URL)</label>
                    <input type="text" class="edit-input" data-custom="testimonialPhoto" value="${extractTestimonialPhoto(el.content)}">
                </div>
            </div>
        `,

        pricing: () => `
            <div class="edit-section">
                <h4><i class="fas fa-tag"></i> Тариф</h4>
                <div class="edit-row">
                    <label>Название тарифа</label>
                    <input type="text" class="edit-input" data-custom="pricingName" value="${extractPricingName(el.content)}">
                </div>
                <div class="edit-grid">
                    <div class="edit-row">
                        <label>Цена</label>
                        <input type="text" class="edit-input" data-custom="pricingPrice" value="${extractPricingPrice(el.content)}">
                    </div>
                    <div class="edit-row">
                        <label>Период</label>
                        <input type="text" class="edit-input" data-custom="pricingPeriod" value="/мес" placeholder="/мес, /год">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Преимущества (каждое с новой строки)</label>
                    <textarea class="edit-textarea" data-custom="pricingFeatures" rows="4">${extractPricingFeatures(el.content)}</textarea>
                </div>
                <div class="edit-row">
                    <label>Текст кнопки</label>
                    <input type="text" class="edit-input" data-custom="pricingButton" value="Выбрать">
                </div>
                <div class="edit-row">
                    <label>Цвет кнопки</label>
                    <div class="edit-color">
                        <input type="color" value="#3b82f6" data-custom="pricingButtonColor">
                        <input type="text" class="edit-input" value="#3b82f6">
                    </div>
                </div>
            </div>
        `,

        counter: () => `
            <div class="edit-section">
                <h4><i class="fas fa-sort-numeric-up"></i> Счётчики</h4>
                <div class="edit-row">
                    <label>Счётчики</label>
                    <textarea class="edit-textarea" data-custom="counterItems" rows="6" placeholder="500+
Клиентов

10
Лет опыта

99%
Довольных">${extractCounterItems(el.content)}</textarea>
                </div>
                <p class="edit-hint">Формат: Число, затем Подпись. Разделяйте пары пустой строкой.</p>
            </div>
        `,

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
        `
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

    // Always add id for auto-responsive CSS targeting
    attrs['id'] = el.id;

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

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(pageTitle)}</title>${metaTags}${faviconTag}
    ${fontLinks ? fontLinks + '\n    ' : ''}<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
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
        form input:focus, form textarea:focus { outline: none; border-color: #3b82f6 !important; }
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
${hasForm ? generateFormScript() : ''}
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
            // User-defined tablet styles
            if (el.tabletStyles && Object.keys(el.tabletStyles).length > 0) {
                const styleStr = stylesToString(el.tabletStyles);
                tabletCSS += `        #${el.id} { ${styleStr} }\n`;
            }

            // User-defined mobile styles
            if (el.mobileStyles && Object.keys(el.mobileStyles).length > 0) {
                const styleStr = stylesToString(el.mobileStyles);
                mobileCSS += `        #${el.id} { ${styleStr} }\n`;
            }

            // Auto-responsive: horizontal containers switch to vertical on mobile
            if (el.isContainer && el.styles?.flexDirection === 'row') {
                autoMobileCSS += `        #${el.id} > .element-children, #${el.id} { flex-direction: column !important; }\n`;
            }

            // Auto-responsive: reduce large font sizes on mobile
            const fontSize = parseInt(el.styles?.fontSize);
            if (fontSize && fontSize > 32) {
                const tabletSize = Math.max(24, Math.round(fontSize * 0.75));
                const mobileSize = Math.max(20, Math.round(fontSize * 0.6));
                autoTabletCSS += `        #${el.id} { font-size: ${tabletSize}px !important; }\n`;
                autoMobileCSS += `        #${el.id} { font-size: ${mobileSize}px !important; }\n`;
            }

            // Auto-responsive: reduce large padding on mobile
            const padding = parseInt(el.styles?.padding);
            if (padding && padding > 40) {
                autoMobileCSS += `        #${el.id} { padding: ${Math.round(padding * 0.5)}px !important; }\n`;
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

// ===== Init =====
loadProject();

// Check for template parameter after loading
const templateParam = urlParams.get('template');
if (templateParam && state.elements.length === 0) {
    applyPageTemplate(templateParam);
}

saveHistory();
renderLayers();
