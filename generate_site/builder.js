// ===== Landing Page Builder =====

// State
const state = {
    elements: [], // Tree structure with children
    selectedElement: null,
    editingElement: null,
    clipboard: null,
    clipboardStyle: null,
    history: [],
    historyIndex: -1,
    viewport: 'desktop'
};

// DOM Elements
const canvas = document.getElementById('canvas');
const canvasEmpty = document.getElementById('canvasEmpty');
const layersContent = document.getElementById('layersContent');
const editModal = document.getElementById('editModal');
const editContent = document.getElementById('editContent');
const editModalTitle = document.getElementById('editModalTitle');

// Container types that can have children
const containerTypes = ['section', 'container', 'row', 'column', 'div'];

// ===== Block Templates =====
const blockTemplates = {
    // Structure
    section: {
        tag: 'section',
        label: 'Секция',
        icon: 'fa-square',
        content: '',
        isContainer: true,
        defaultStyles: { padding: '60px 20px', minHeight: '200px' }
    },
    container: {
        tag: 'div',
        label: 'Контейнер',
        icon: 'fa-box',
        content: '',
        isContainer: true,
        defaultStyles: { maxWidth: '1200px', margin: '0 auto', padding: '20px' }
    },
    row: {
        tag: 'div',
        label: 'Строка',
        icon: 'fa-columns',
        content: '',
        isContainer: true,
        defaultStyles: { display: 'flex', flexWrap: 'wrap', gap: '20px' }
    },
    column: {
        tag: 'div',
        label: 'Колонка',
        icon: 'fa-grip-lines-vertical',
        content: '',
        isContainer: true,
        defaultStyles: { flex: '1', minWidth: '250px', padding: '10px' }
    },

    // Basic
    heading: {
        tag: 'h2',
        label: 'Заголовок',
        icon: 'fa-heading',
        content: 'Заголовок',
        defaultStyles: { fontSize: '32px', fontWeight: 'bold', marginBottom: '16px', color: '#1e293b' }
    },
    text: {
        tag: 'p',
        label: 'Текст',
        icon: 'fa-align-left',
        content: 'Здесь будет ваш текст. Кликните, чтобы редактировать.',
        defaultStyles: { fontSize: '16px', lineHeight: '1.6', color: '#475569' }
    },
    image: {
        tag: 'img',
        label: 'Изображение',
        icon: 'fa-image',
        content: '',
        attrs: { src: 'https://via.placeholder.com/800x400', alt: 'Изображение' },
        defaultStyles: { maxWidth: '100%', height: 'auto', borderRadius: '8px' }
    },
    button: {
        tag: 'a',
        label: 'Кнопка',
        icon: 'fa-hand-pointer',
        content: 'Кнопка',
        attrs: { href: '#' },
        defaultStyles: {
            display: 'inline-block', padding: '12px 24px', backgroundColor: '#3b82f6',
            color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '500'
        }
    },
    link: {
        tag: 'a',
        label: 'Ссылка',
        icon: 'fa-link',
        content: 'Ссылка',
        attrs: { href: '#' },
        defaultStyles: { color: '#3b82f6', textDecoration: 'underline' }
    },
    list: {
        tag: 'ul',
        label: 'Список',
        icon: 'fa-list',
        content: '<li>Пункт 1</li><li>Пункт 2</li><li>Пункт 3</li>',
        defaultStyles: { paddingLeft: '20px', color: '#475569' }
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
        content: `<input type="text" placeholder="Ваше имя" style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;"><input type="email" placeholder="Email" style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;"><button type="submit" style="width:100%;padding:12px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;">Отправить</button>`,
        defaultStyles: { maxWidth: '400px' }
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

    return {
        id: generateId(),
        type,
        tag: template.tag,
        label: template.label,
        icon: template.icon,
        content: template.content,
        attrs: { ...template.attrs },
        styles: { ...template.defaultStyles },
        isContainer: template.isContainer || false,
        children: [],
        hidden: false
    };
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

// ===== Render Canvas =====
function renderElement(element, depth = 0) {
    const el = document.createElement(element.tag === 'img' ? 'div' : element.tag);
    el.id = element.id;
    el.className = `builder-element ${element.isContainer ? 'is-container' : ''} ${element.hidden ? 'is-hidden' : ''}`;
    el.setAttribute('data-type', element.type);
    el.setAttribute('data-depth', depth);

    if (element.tag === 'img') {
        el.innerHTML = `<img src="${element.attrs?.src || ''}" alt="${element.attrs?.alt || ''}" style="max-width:100%;height:auto;">`;
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
        <button class="toolbar-action" data-action="moveUp" title="Вверх"><i class="fas fa-arrow-up"></i></button>
        <button class="toolbar-action" data-action="moveDown" title="Вниз"><i class="fas fa-arrow-down"></i></button>
        <button class="toolbar-action" data-action="edit" title="Редактировать"><i class="fas fa-edit"></i></button>
        <button class="toolbar-action" data-action="duplicate" title="Дублировать"><i class="fas fa-copy"></i></button>
        <button class="toolbar-action" data-action="hide" title="${element.hidden ? 'Показать' : 'Скрыть'}"><i class="fas fa-${element.hidden ? 'eye' : 'eye-slash'}"></i></button>
        <button class="toolbar-action danger" data-action="delete" title="Удалить"><i class="fas fa-trash"></i></button>
    `;
    el.appendChild(toolbar);

    // Toolbar actions
    toolbar.querySelectorAll('.toolbar-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            switch (action) {
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
    if (element.isContainer && element.children?.length) {
        const childContainer = document.createElement('div');
        childContainer.className = 'element-children';
        element.children.forEach(child => {
            childContainer.appendChild(renderElement(child, depth + 1));
        });
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

    // Add click handlers
    layersContent.querySelectorAll('.layer-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectElement(item.dataset.id);
        });
        item.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            openEditModal(item.dataset.id);
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
            <div class="layer-item ${isSelected ? 'selected' : ''} ${el.hidden ? 'is-hidden' : ''}" data-id="${el.id}" style="padding-left:${depth * 16 + 8}px;">
                ${hasChildren ? '<span class="layer-toggle"><i class="fas fa-chevron-down"></i></span>' : '<span class="layer-spacer"></span>'}
                <i class="fas ${el.icon} layer-icon"></i>
                <span class="layer-name">${el.label}</span>
                ${el.hidden ? '<i class="fas fa-eye-slash layer-hidden-icon"></i>' : ''}
            </div>
            ${hasChildren ? '<div class="layer-children">' + renderLayerTree(el.children, depth + 1) + '</div>' : ''}
        `;
    }).join('');
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

    // Styles
    editContent.querySelectorAll('[data-style]').forEach(input => {
        const val = input.value;
        const unit = input.dataset.unit || '';
        if (val) {
            el.styles[input.dataset.style] = val.includes(unit) || !unit ? val : val + unit;
        } else {
            delete el.styles[input.dataset.style];
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
            <div class="edit-section">
                <h4><i class="fas fa-palette"></i> Оформление текста</h4>
                <div class="edit-row">
                    <label>Размер шрифта</label>
                    <div class="edit-range-row">
                        <input type="range" min="12" max="72" value="${parseInt(s.fontSize) || 32}" data-style="fontSize" data-unit="px">
                        <span>${parseInt(s.fontSize) || 32}px</span>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Цвет текста</label>
                    <div class="edit-color">
                        <input type="color" value="${s.color || '#1e293b'}" data-style="color">
                        <input type="text" class="edit-input" value="${s.color || '#1e293b'}" data-style="color">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Выравнивание</label>
                    <div class="edit-btn-group" data-style="textAlign">
                        <button type="button" class="${s.textAlign === 'left' || !s.textAlign ? 'active' : ''}" data-value="left"><i class="fas fa-align-left"></i></button>
                        <button type="button" class="${s.textAlign === 'center' ? 'active' : ''}" data-value="center"><i class="fas fa-align-center"></i></button>
                        <button type="button" class="${s.textAlign === 'right' ? 'active' : ''}" data-value="right"><i class="fas fa-align-right"></i></button>
                    </div>
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
            <div class="edit-section">
                <h4><i class="fas fa-palette"></i> Оформление</h4>
                <div class="edit-row">
                    <label>Размер шрифта</label>
                    <div class="edit-range-row">
                        <input type="range" min="12" max="32" value="${parseInt(s.fontSize) || 16}" data-style="fontSize" data-unit="px">
                        <span>${parseInt(s.fontSize) || 16}px</span>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Цвет текста</label>
                    <div class="edit-color">
                        <input type="color" value="${s.color || '#475569'}" data-style="color">
                        <input type="text" class="edit-input" value="${s.color || '#475569'}" data-style="color">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Стиль текста</label>
                    <div class="edit-btn-group-multi">
                        <button type="button" class="${s.fontWeight === 'bold' ? 'active' : ''}" data-style="fontWeight" data-value="bold" title="Жирный"><i class="fas fa-bold"></i></button>
                        <button type="button" class="${s.fontStyle === 'italic' ? 'active' : ''}" data-style="fontStyle" data-value="italic" title="Курсив"><i class="fas fa-italic"></i></button>
                        <button type="button" class="${s.textDecoration === 'underline' ? 'active' : ''}" data-style="textDecoration" data-value="underline" title="Подчёркнутый"><i class="fas fa-underline"></i></button>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Выравнивание</label>
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
                        <input type="range" min="1" max="3" step="0.1" value="${parseFloat(s.lineHeight) || 1.6}" data-style="lineHeight">
                        <span>${parseFloat(s.lineHeight) || 1.6}</span>
                    </div>
                </div>
            </div>
        `,

        // ===== ИЗОБРАЖЕНИЕ =====
        image: () => `
            <div class="edit-section">
                <h4><i class="fas fa-image"></i> Изображение</h4>
                <div class="edit-row">
                    <label>URL изображения</label>
                    <input type="text" class="edit-input" data-attr="src" value="${el.attrs?.src || ''}" placeholder="https://...">
                </div>
                <div class="edit-row">
                    <label>Описание (alt)</label>
                    <input type="text" class="edit-input" data-attr="alt" value="${el.attrs?.alt || ''}" placeholder="Описание изображения">
                </div>
            </div>
            <div class="edit-section">
                <h4><i class="fas fa-expand"></i> Размер</h4>
                <div class="edit-grid">
                    <div class="edit-row">
                        <label>Ширина</label>
                        <input type="text" class="edit-input" data-style="width" value="${s.width || ''}" placeholder="100% или 400px">
                    </div>
                    <div class="edit-row">
                        <label>Макс. ширина</label>
                        <input type="text" class="edit-input" data-style="maxWidth" value="${s.maxWidth || '100%'}" placeholder="100%">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Скругление углов</label>
                    <div class="edit-range-row">
                        <input type="range" min="0" max="50" value="${parseInt(s.borderRadius) || 8}" data-style="borderRadius" data-unit="px">
                        <span>${parseInt(s.borderRadius) || 8}px</span>
                    </div>
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
            <div class="edit-section">
                <h4><i class="fas fa-palette"></i> Оформление</h4>
                <div class="edit-row">
                    <label>Цвет кнопки</label>
                    <div class="edit-color">
                        <input type="color" value="${s.backgroundColor || '#3b82f6'}" data-style="backgroundColor">
                        <input type="text" class="edit-input" value="${s.backgroundColor || '#3b82f6'}" data-style="backgroundColor">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Цвет текста</label>
                    <div class="edit-color">
                        <input type="color" value="${s.color || '#ffffff'}" data-style="color">
                        <input type="text" class="edit-input" value="${s.color || '#ffffff'}" data-style="color">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Размер текста</label>
                    <div class="edit-range-row">
                        <input type="range" min="12" max="24" value="${parseInt(s.fontSize) || 16}" data-style="fontSize" data-unit="px">
                        <span>${parseInt(s.fontSize) || 16}px</span>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Скругление</label>
                    <div class="edit-range-row">
                        <input type="range" min="0" max="30" value="${parseInt(s.borderRadius) || 8}" data-style="borderRadius" data-unit="px">
                        <span>${parseInt(s.borderRadius) || 8}px</span>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Внутренний отступ</label>
                    <input type="text" class="edit-input" data-style="padding" value="${s.padding || '12px 24px'}" placeholder="12px 24px">
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
            <div class="edit-section">
                <h4><i class="fas fa-palette"></i> Оформление</h4>
                <div class="edit-row">
                    <label>Цвет ссылки</label>
                    <div class="edit-color">
                        <input type="color" value="${s.color || '#3b82f6'}" data-style="color">
                        <input type="text" class="edit-input" value="${s.color || '#3b82f6'}" data-style="color">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Подчёркивание</label>
                    <select class="edit-select" data-style="textDecoration">
                        <option value="underline" ${s.textDecoration !== 'none' ? 'selected' : ''}>С подчёркиванием</option>
                        <option value="none" ${s.textDecoration === 'none' ? 'selected' : ''}>Без подчёркивания</option>
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
            <div class="edit-section">
                <h4><i class="fas fa-palette"></i> Оформление</h4>
                <div class="edit-row">
                    <label>Цвет текста</label>
                    <div class="edit-color">
                        <input type="color" value="${s.color || '#475569'}" data-style="color">
                        <input type="text" class="edit-input" value="${s.color || '#475569'}" data-style="color">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Размер шрифта</label>
                    <div class="edit-range-row">
                        <input type="range" min="12" max="24" value="${parseInt(s.fontSize) || 16}" data-style="fontSize" data-unit="px">
                        <span>${parseInt(s.fontSize) || 16}px</span>
                    </div>
                </div>
            </div>
        `,

        // ===== РАЗДЕЛИТЕЛЬ =====
        divider: () => `
            <div class="edit-section">
                <h4><i class="fas fa-minus"></i> Разделитель</h4>
                <div class="edit-row">
                    <label>Толщина линии</label>
                    <div class="edit-range-row">
                        <input type="range" min="1" max="10" value="${parseInt(s.borderTopWidth) || 1}" data-style="borderTopWidth" data-unit="px">
                        <span>${parseInt(s.borderTopWidth) || 1}px</span>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Цвет</label>
                    <div class="edit-color">
                        <input type="color" value="${s.borderTopColor || '#e2e8f0'}" data-style="borderTopColor">
                        <input type="text" class="edit-input" value="${s.borderTopColor || '#e2e8f0'}" data-style="borderTopColor">
                    </div>
                </div>
                <div class="edit-row">
                    <label>Стиль линии</label>
                    <select class="edit-select" data-style="borderTopStyle">
                        <option value="solid" ${s.borderTopStyle !== 'dashed' && s.borderTopStyle !== 'dotted' ? 'selected' : ''}>Сплошная</option>
                        <option value="dashed" ${s.borderTopStyle === 'dashed' ? 'selected' : ''}>Пунктирная</option>
                        <option value="dotted" ${s.borderTopStyle === 'dotted' ? 'selected' : ''}>Точечная</option>
                    </select>
                </div>
                <div class="edit-row">
                    <label>Ширина</label>
                    <input type="text" class="edit-input" data-style="width" value="${s.width || '100%'}" placeholder="100% или 200px">
                </div>
            </div>
        `,

        // ===== ОТСТУП =====
        spacer: () => `
            <div class="edit-section">
                <h4><i class="fas fa-arrows-alt-v"></i> Отступ</h4>
                <div class="edit-row">
                    <label>Высота отступа</label>
                    <div class="edit-range-row">
                        <input type="range" min="10" max="200" value="${parseInt(s.height) || 40}" data-style="height" data-unit="px">
                        <span>${parseInt(s.height) || 40}px</span>
                    </div>
                </div>
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
                <div class="edit-row">
                    <label>Размер</label>
                    <div class="edit-range-row">
                        <input type="range" min="16" max="120" value="${parseInt(s.fontSize) || 48}" data-style="fontSize" data-unit="px">
                        <span>${parseInt(s.fontSize) || 48}px</span>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Цвет</label>
                    <div class="edit-color">
                        <input type="color" value="${s.color || '#3b82f6'}" data-style="color">
                        <input type="text" class="edit-input" value="${s.color || '#3b82f6'}" data-style="color">
                    </div>
                </div>
            </div>
        `,

        // ===== КОНТЕЙНЕРЫ =====
        section: () => renderContainerSettings(el, 'Секция', 'fa-square'),
        container: () => renderContainerSettings(el, 'Контейнер', 'fa-box'),
        row: () => `
            <div class="edit-section">
                <h4><i class="fas fa-columns"></i> Строка</h4>
                <p class="edit-hint">Перетащите сюда колонки или другие элементы</p>
                <div class="edit-row">
                    <label>Расстояние между элементами</label>
                    <div class="edit-range-row">
                        <input type="range" min="0" max="60" value="${parseInt(s.gap) || 20}" data-style="gap" data-unit="px">
                        <span>${parseInt(s.gap) || 20}px</span>
                    </div>
                </div>
                <div class="edit-row">
                    <label>Выравнивание по горизонтали</label>
                    <select class="edit-select" data-style="justifyContent">
                        <option value="flex-start" ${s.justifyContent === 'flex-start' ? 'selected' : ''}>В начале</option>
                        <option value="center" ${s.justifyContent === 'center' ? 'selected' : ''}>По центру</option>
                        <option value="flex-end" ${s.justifyContent === 'flex-end' ? 'selected' : ''}>В конце</option>
                        <option value="space-between" ${s.justifyContent === 'space-between' ? 'selected' : ''}>Равномерно</option>
                    </select>
                </div>
                <div class="edit-row">
                    <label>Выравнивание по вертикали</label>
                    <select class="edit-select" data-style="alignItems">
                        <option value="stretch" ${!s.alignItems || s.alignItems === 'stretch' ? 'selected' : ''}>Растянуть</option>
                        <option value="flex-start" ${s.alignItems === 'flex-start' ? 'selected' : ''}>Сверху</option>
                        <option value="center" ${s.alignItems === 'center' ? 'selected' : ''}>По центру</option>
                        <option value="flex-end" ${s.alignItems === 'flex-end' ? 'selected' : ''}>Снизу</option>
                    </select>
                </div>
            </div>
        `,
        column: () => `
            <div class="edit-section">
                <h4><i class="fas fa-grip-lines-vertical"></i> Колонка</h4>
                <p class="edit-hint">Перетащите сюда текст, изображения и другие элементы</p>
                <div class="edit-row">
                    <label>Ширина колонки</label>
                    <select class="edit-select" data-style="flex">
                        <option value="1" ${s.flex === '1' || !s.flex ? 'selected' : ''}>Авто (равная)</option>
                        <option value="0 0 25%" ${s.flex === '0 0 25%' ? 'selected' : ''}>25%</option>
                        <option value="0 0 33.33%" ${s.flex === '0 0 33.33%' ? 'selected' : ''}>33%</option>
                        <option value="0 0 50%" ${s.flex === '0 0 50%' ? 'selected' : ''}>50%</option>
                        <option value="0 0 66.66%" ${s.flex === '0 0 66.66%' ? 'selected' : ''}>66%</option>
                        <option value="0 0 75%" ${s.flex === '0 0 75%' ? 'selected' : ''}>75%</option>
                    </select>
                </div>
                <div class="edit-row">
                    <label>Внутренний отступ</label>
                    <input type="text" class="edit-input" data-style="padding" value="${s.padding || '10px'}" placeholder="10px">
                </div>
            </div>
            <div class="edit-section">
                <h4><i class="fas fa-fill-drip"></i> Фон</h4>
                <div class="edit-row">
                    <label>Цвет фона</label>
                    <div class="edit-color">
                        <input type="color" value="${s.backgroundColor || '#ffffff'}" data-style="backgroundColor">
                        <input type="text" class="edit-input" value="${s.backgroundColor || ''}" data-style="backgroundColor" placeholder="Прозрачный">
                    </div>
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
    const s = el.styles || {};
    return `
        <div class="edit-section">
            <h4><i class="fas ${icon}"></i> ${title}</h4>
            <p class="edit-hint">Перетащите сюда другие блоки: колонки, строки, текст, изображения и т.д.</p>
        </div>
        <div class="edit-section">
            <h4><i class="fas fa-fill-drip"></i> Фон</h4>
            <div class="edit-row">
                <label>Цвет фона</label>
                <div class="edit-color">
                    <input type="color" value="${s.backgroundColor || '#ffffff'}" data-style="backgroundColor">
                    <input type="text" class="edit-input" value="${s.backgroundColor || ''}" data-style="backgroundColor" placeholder="Прозрачный">
                </div>
            </div>
            <div class="edit-row">
                <label>Изображение фона</label>
                <input type="text" class="edit-input" data-style="backgroundImage" value="${s.backgroundImage || ''}" placeholder="url(https://...)">
            </div>
        </div>
        <div class="edit-section">
            <h4><i class="fas fa-arrows-alt"></i> Отступы</h4>
            <div class="edit-row">
                <label>Внутренний отступ</label>
                <input type="text" class="edit-input" data-style="padding" value="${s.padding || '60px 20px'}" placeholder="60px 20px">
            </div>
            <div class="edit-row">
                <label>Максимальная ширина</label>
                <input type="text" class="edit-input" data-style="maxWidth" value="${s.maxWidth || ''}" placeholder="1200px">
            </div>
        </div>
    `;
}

// Вспомогательные функции
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

function renderStyleTab(el) {
    const s = el.styles || {};
    return `
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

        <div class="edit-section">
            <h4><i class="fas fa-fill-drip"></i> Фон</h4>
            <div class="edit-row">
                <label>Цвет фона</label>
                <div class="edit-color">
                    <input type="color" data-style="backgroundColor" value="${s.backgroundColor || '#ffffff'}">
                    <input type="text" class="edit-input" data-style="backgroundColor" value="${s.backgroundColor || ''}" placeholder="Прозрачный">
                </div>
            </div>
            <div class="edit-row">
                <label>Изображение фона (URL)</label>
                <input type="text" class="edit-input" data-style="backgroundImage" value="${s.backgroundImage || ''}" placeholder="url(https://...)">
            </div>
            <div class="edit-row">
                <label>Размер фона</label>
                <select class="edit-select" data-style="backgroundSize">
                    <option value="">Авто</option>
                    <option value="cover" ${s.backgroundSize === 'cover' ? 'selected' : ''}>Заполнить (cover)</option>
                    <option value="contain" ${s.backgroundSize === 'contain' ? 'selected' : ''}>Вместить (contain)</option>
                </select>
            </div>
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
function generateHTML(elements = state.elements) {
    return elements.map(el => {
        const styles = stylesToString(el.styles);
        const attrs = Object.entries(el.attrs || {}).map(([k, v]) => `${k}="${v}"`).join(' ');
        const childrenHtml = el.children?.length ? generateHTML(el.children) : '';
        const content = el.content + childrenHtml;
        return `<${el.tag}${attrs ? ' ' + attrs : ''} style="${styles}">${content}</${el.tag}>`;
    }).join('\n');
}

function generateFullHTML() {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Лендинг</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
${generateHTML()}
</body>
</html>`;
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

document.getElementById('exportBtn').addEventListener('click', () => {
    document.getElementById('codeBtn').click();
});

// ===== Save/Load =====
function saveProject() {
    localStorage.setItem('builder_project', JSON.stringify(state.elements));
    alert('Проект сохранён!');
}

function loadProject() {
    const saved = localStorage.getItem('builder_project');
    if (saved) {
        state.elements = JSON.parse(saved);
        renderCanvas();
        renderLayers();
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

// ===== Init =====
loadProject();
saveHistory();
renderLayers();

canvas.addEventListener('click', (e) => {
    if (e.target === canvas || e.target === canvasEmpty) {
        selectElement(null);
    }
});
