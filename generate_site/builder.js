// ===== Landing Page Builder =====

// State
const state = {
    elements: [],
    selectedElement: null,
    clipboard: null,
    clipboardStyle: null,
    history: [],
    historyIndex: -1,
    viewport: 'desktop'
};

// DOM Elements
const canvas = document.getElementById('canvas');
const canvasEmpty = document.getElementById('canvasEmpty');
const settingsContent = document.getElementById('settingsContent');
const settingsTitle = document.getElementById('settingsTitle');
const contextMenu = document.getElementById('contextMenu');

// ===== Block Templates =====
const blockTemplates = {
    // Structure
    section: {
        tag: 'section',
        label: 'Секция',
        content: '',
        defaultStyles: { padding: '60px 20px', minHeight: '200px' }
    },
    container: {
        tag: 'div',
        label: 'Контейнер',
        content: '',
        defaultStyles: { maxWidth: '1200px', margin: '0 auto', padding: '20px' }
    },
    row: {
        tag: 'div',
        label: 'Строка',
        content: '',
        defaultStyles: { display: 'flex', flexWrap: 'wrap', gap: '20px' }
    },
    column: {
        tag: 'div',
        label: 'Колонка',
        content: '',
        defaultStyles: { flex: '1', minWidth: '250px' }
    },

    // Basic
    heading: {
        tag: 'h2',
        label: 'Заголовок',
        content: 'Заголовок',
        defaultStyles: { fontSize: '32px', fontWeight: 'bold', marginBottom: '16px', color: '#1e293b' }
    },
    text: {
        tag: 'p',
        label: 'Текст',
        content: 'Здесь будет ваш текст. Кликните, чтобы редактировать.',
        defaultStyles: { fontSize: '16px', lineHeight: '1.6', color: '#475569' }
    },
    image: {
        tag: 'img',
        label: 'Изображение',
        content: '',
        attrs: { src: 'https://via.placeholder.com/800x400', alt: 'Изображение' },
        defaultStyles: { maxWidth: '100%', height: 'auto', borderRadius: '8px' }
    },
    button: {
        tag: 'a',
        label: 'Кнопка',
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
        content: 'Ссылка',
        attrs: { href: '#' },
        defaultStyles: { color: '#3b82f6', textDecoration: 'underline' }
    },
    list: {
        tag: 'ul',
        label: 'Список',
        content: '<li>Пункт 1</li><li>Пункт 2</li><li>Пункт 3</li>',
        defaultStyles: { paddingLeft: '20px', color: '#475569' }
    },
    divider: {
        tag: 'hr',
        label: 'Разделитель',
        content: '',
        defaultStyles: { border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }
    },
    spacer: {
        tag: 'div',
        label: 'Отступ',
        content: '',
        defaultStyles: { height: '40px' }
    },

    // Media
    video: {
        tag: 'div',
        label: 'Видео',
        content: '<iframe width="100%" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allowfullscreen></iframe>',
        defaultStyles: { aspectRatio: '16/9' }
    },
    gallery: {
        tag: 'div',
        label: 'Галерея',
        content: `
            <img src="https://via.placeholder.com/300x200" alt="1">
            <img src="https://via.placeholder.com/300x200" alt="2">
            <img src="https://via.placeholder.com/300x200" alt="3">
        `,
        defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }
    },
    icon: {
        tag: 'i',
        label: 'Иконка',
        content: '',
        attrs: { class: 'fas fa-star' },
        defaultStyles: { fontSize: '48px', color: '#3b82f6' }
    },

    // Interactive
    form: {
        tag: 'form',
        label: 'Форма',
        content: `
            <input type="text" placeholder="Ваше имя" style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;">
            <input type="email" placeholder="Email" style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:6px;">
            <button type="submit" style="width:100%;padding:12px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;">Отправить</button>
        `,
        defaultStyles: { maxWidth: '400px' }
    },
    accordion: {
        tag: 'div',
        label: 'Аккордеон',
        content: `
            <details style="border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;">
                <summary style="padding:12px;cursor:pointer;font-weight:500;">Вопрос 1</summary>
                <p style="padding:12px;border-top:1px solid #e2e8f0;">Ответ на вопрос 1</p>
            </details>
            <details style="border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;">
                <summary style="padding:12px;cursor:pointer;font-weight:500;">Вопрос 2</summary>
                <p style="padding:12px;border-top:1px solid #e2e8f0;">Ответ на вопрос 2</p>
            </details>
        `,
        defaultStyles: {}
    },
    timer: {
        tag: 'div',
        label: 'Таймер',
        content: `
            <div style="display:flex;gap:20px;justify-content:center;">
                <div style="text-align:center;"><span style="font-size:48px;font-weight:bold;">00</span><br>Дней</div>
                <div style="text-align:center;"><span style="font-size:48px;font-weight:bold;">12</span><br>Часов</div>
                <div style="text-align:center;"><span style="font-size:48px;font-weight:bold;">30</span><br>Минут</div>
                <div style="text-align:center;"><span style="font-size:48px;font-weight:bold;">45</span><br>Секунд</div>
            </div>
        `,
        defaultStyles: { padding: '20px' }
    },

    // Components
    navbar: {
        tag: 'nav',
        label: 'Навигация',
        content: `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 0;">
                <a href="#" style="font-size:24px;font-weight:bold;color:#1e293b;text-decoration:none;">Logo</a>
                <div style="display:flex;gap:24px;">
                    <a href="#" style="color:#475569;text-decoration:none;">Главная</a>
                    <a href="#" style="color:#475569;text-decoration:none;">О нас</a>
                    <a href="#" style="color:#475569;text-decoration:none;">Услуги</a>
                    <a href="#" style="color:#475569;text-decoration:none;">Контакты</a>
                </div>
            </div>
        `,
        defaultStyles: { backgroundColor: 'white', padding: '0 20px', borderBottom: '1px solid #e2e8f0' }
    },
    hero: {
        tag: 'section',
        label: 'Hero',
        content: `
            <div style="text-align:center;max-width:800px;margin:0 auto;">
                <h1 style="font-size:48px;font-weight:bold;margin-bottom:20px;color:#1e293b;">Заголовок Hero секции</h1>
                <p style="font-size:20px;color:#475569;margin-bottom:30px;">Подзаголовок с описанием вашего продукта или услуги</p>
                <a href="#" style="display:inline-block;padding:16px 32px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:500;">Начать</a>
            </div>
        `,
        defaultStyles: { padding: '100px 20px', backgroundColor: '#f8fafc' }
    },
    features: {
        tag: 'div',
        label: 'Преимущества',
        content: `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:30px;">
                <div style="text-align:center;padding:20px;">
                    <div style="font-size:48px;margin-bottom:16px;">🚀</div>
                    <h3 style="font-size:20px;margin-bottom:8px;">Быстро</h3>
                    <p style="color:#64748b;">Описание преимущества</p>
                </div>
                <div style="text-align:center;padding:20px;">
                    <div style="font-size:48px;margin-bottom:16px;">💡</div>
                    <h3 style="font-size:20px;margin-bottom:8px;">Удобно</h3>
                    <p style="color:#64748b;">Описание преимущества</p>
                </div>
                <div style="text-align:center;padding:20px;">
                    <div style="font-size:48px;margin-bottom:16px;">✨</div>
                    <h3 style="font-size:20px;margin-bottom:8px;">Качественно</h3>
                    <p style="color:#64748b;">Описание преимущества</p>
                </div>
            </div>
        `,
        defaultStyles: { padding: '40px 20px' }
    },
    card: {
        tag: 'div',
        label: 'Карточка',
        content: `
            <img src="https://via.placeholder.com/400x200" style="width:100%;border-radius:8px 8px 0 0;">
            <div style="padding:20px;">
                <h3 style="font-size:20px;margin-bottom:8px;">Заголовок карточки</h3>
                <p style="color:#64748b;margin-bottom:16px;">Описание карточки</p>
                <a href="#" style="color:#3b82f6;">Подробнее →</a>
            </div>
        `,
        defaultStyles: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden' }
    },
    testimonial: {
        tag: 'div',
        label: 'Отзыв',
        content: `
            <div style="padding:24px;background:#f8fafc;border-radius:8px;">
                <p style="font-size:18px;font-style:italic;margin-bottom:16px;">"Отличный продукт! Рекомендую всем."</p>
                <div style="display:flex;align-items:center;gap:12px;">
                    <img src="https://via.placeholder.com/48" style="width:48px;height:48px;border-radius:50%;">
                    <div>
                        <div style="font-weight:600;">Имя Фамилия</div>
                        <div style="color:#64748b;font-size:14px;">Должность</div>
                    </div>
                </div>
            </div>
        `,
        defaultStyles: {}
    },
    pricing: {
        tag: 'div',
        label: 'Цена',
        content: `
            <div style="text-align:center;padding:32px;background:white;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="font-size:24px;margin-bottom:8px;">Базовый</h3>
                <div style="font-size:48px;font-weight:bold;margin:16px 0;">$29<span style="font-size:16px;color:#64748b;">/мес</span></div>
                <ul style="list-style:none;padding:0;margin-bottom:24px;color:#64748b;">
                    <li style="padding:8px 0;">✓ Функция 1</li>
                    <li style="padding:8px 0;">✓ Функция 2</li>
                    <li style="padding:8px 0;">✓ Функция 3</li>
                </ul>
                <a href="#" style="display:block;padding:12px;background:#3b82f6;color:white;text-decoration:none;border-radius:6px;">Выбрать</a>
            </div>
        `,
        defaultStyles: { maxWidth: '300px' }
    },
    counter: {
        tag: 'div',
        label: 'Счётчик',
        content: `
            <div style="display:flex;justify-content:space-around;text-align:center;">
                <div><div style="font-size:48px;font-weight:bold;color:#3b82f6;">500+</div><div style="color:#64748b;">Клиентов</div></div>
                <div><div style="font-size:48px;font-weight:bold;color:#3b82f6;">10</div><div style="color:#64748b;">Лет опыта</div></div>
                <div><div style="font-size:48px;font-weight:bold;color:#3b82f6;">99%</div><div style="color:#64748b;">Довольных</div></div>
            </div>
        `,
        defaultStyles: { padding: '40px 20px' }
    },
    social: {
        tag: 'div',
        label: 'Соцсети',
        content: `
            <div style="display:flex;gap:16px;justify-content:center;">
                <a href="#" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#1877f2;color:white;border-radius:50%;text-decoration:none;"><i class="fab fa-facebook-f"></i></a>
                <a href="#" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#1da1f2;color:white;border-radius:50%;text-decoration:none;"><i class="fab fa-twitter"></i></a>
                <a href="#" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#e4405f;color:white;border-radius:50%;text-decoration:none;"><i class="fab fa-instagram"></i></a>
            </div>
        `,
        defaultStyles: {}
    },
    map: {
        tag: 'div',
        label: 'Карта',
        content: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2245.3!2d37.6!3d55.75!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTXCsDQ1JzAwLjAiTiAzN8KwMzYnMDAuMCJF!5e0!3m2!1sru!2sru!4v1234567890" width="100%" height="300" style="border:0;border-radius:8px;" allowfullscreen></iframe>',
        defaultStyles: {}
    },
    footer: {
        tag: 'footer',
        label: 'Футер',
        content: `
            <div style="display:flex;justify-content:space-between;padding:40px 20px;flex-wrap:wrap;gap:40px;">
                <div>
                    <h4 style="font-size:18px;margin-bottom:16px;">Компания</h4>
                    <p style="color:#94a3b8;">© 2024 Все права защищены</p>
                </div>
                <div>
                    <h4 style="font-size:18px;margin-bottom:16px;">Контакты</h4>
                    <p style="color:#94a3b8;">email@example.com<br>+7 (999) 123-45-67</p>
                </div>
            </div>
        `,
        defaultStyles: { backgroundColor: '#1e293b', color: 'white' }
    },

    // Code
    html: {
        tag: 'div',
        label: 'HTML',
        content: '<div style="padding:20px;background:#f1f5f9;border:1px dashed #94a3b8;text-align:center;color:#64748b;">HTML блок</div>',
        defaultStyles: {}
    },
    css: {
        tag: 'style',
        label: 'CSS',
        content: '/* Ваши CSS стили */',
        defaultStyles: {}
    },
    js: {
        tag: 'script',
        label: 'JavaScript',
        content: '// Ваш JavaScript код',
        defaultStyles: {}
    }
};

// ===== Utility Functions =====
function generateId() {
    return 'el_' + Math.random().toString(36).substr(2, 9);
}

function stylesToString(styles) {
    return Object.entries(styles).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';');
}

function stringToStyles(str) {
    if (!str) return {};
    const styles = {};
    str.split(';').forEach(s => {
        const [k, v] = s.split(':').map(x => x.trim());
        if (k && v) {
            styles[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
        }
    });
    return styles;
}

// ===== Element Management =====
function createElement(type, parentId = null) {
    const template = blockTemplates[type];
    if (!template) return null;

    const id = generateId();
    const element = {
        id,
        type,
        tag: template.tag,
        label: template.label,
        content: template.content,
        attrs: { ...template.attrs },
        styles: { ...template.defaultStyles },
        children: []
    };

    state.elements.push(element);
    return element;
}

function renderElement(element) {
    const el = document.createElement(element.tag);
    el.id = element.id;
    el.className = 'builder-element';
    el.setAttribute('data-type', element.type);
    el.innerHTML = element.content;

    // Apply styles
    Object.assign(el.style, element.styles);

    // Apply attributes
    if (element.attrs) {
        Object.entries(element.attrs).forEach(([k, v]) => {
            if (k !== 'class') el.setAttribute(k, v);
        });
    }

    // Add label
    const label = document.createElement('span');
    label.className = 'element-label';
    label.textContent = element.label;
    el.appendChild(label);

    // Event listeners
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectElement(element.id);
    });

    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectElement(element.id);
        showContextMenu(e.clientX, e.clientY);
    });

    // Make draggable within canvas
    el.draggable = true;
    el.addEventListener('dragstart', handleCanvasDragStart);
    el.addEventListener('dragover', handleCanvasDragOver);
    el.addEventListener('drop', handleCanvasDrop);

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
}

function selectElement(id) {
    // Deselect previous
    document.querySelectorAll('.builder-element.selected').forEach(el => {
        el.classList.remove('selected');
    });

    if (id) {
        const element = state.elements.find(e => e.id === id);
        if (element) {
            state.selectedElement = element;
            document.getElementById(id)?.classList.add('selected');
            renderSettings(element);
        }
    } else {
        state.selectedElement = null;
        renderNoSelection();
    }

    hideContextMenu();
}

function deleteElement(id) {
    const index = state.elements.findIndex(e => e.id === id);
    if (index > -1) {
        state.elements.splice(index, 1);
        if (state.selectedElement?.id === id) {
            state.selectedElement = null;
        }
        saveHistory();
        renderCanvas();
        renderNoSelection();
    }
}

function duplicateElement(id) {
    const original = state.elements.find(e => e.id === id);
    if (original) {
        const copy = {
            ...original,
            id: generateId(),
            styles: { ...original.styles },
            attrs: { ...original.attrs }
        };
        const index = state.elements.findIndex(e => e.id === id);
        state.elements.splice(index + 1, 0, copy);
        saveHistory();
        renderCanvas();
        selectElement(copy.id);
    }
}

function moveElement(id, direction) {
    const index = state.elements.findIndex(e => e.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= state.elements.length) return;

    const [element] = state.elements.splice(index, 1);
    state.elements.splice(newIndex, 0, element);
    saveHistory();
    renderCanvas();
    selectElement(id);
}

// ===== Settings Panel =====
function renderNoSelection() {
    settingsTitle.textContent = 'Настройки';
    settingsContent.innerHTML = `
        <div class="no-selection">
            <i class="fas fa-mouse-pointer"></i>
            <p>Выберите элемент для редактирования</p>
        </div>
    `;
}

function renderSettings(element) {
    settingsTitle.textContent = element.label;

    settingsContent.innerHTML = `
        <div class="settings-tabs-content">
            <div class="tab-content active" data-tab="content">
                ${renderContentSettings(element)}
            </div>
            <div class="tab-content" data-tab="style">
                ${renderStyleSettings(element)}
            </div>
            <div class="tab-content" data-tab="advanced">
                ${renderAdvancedSettings(element)}
            </div>
        </div>
        <div class="settings-actions" style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border);">
            <button class="btn danger" onclick="deleteElement('${element.id}')" style="width:100%;">
                <i class="fas fa-trash"></i> Удалить элемент
            </button>
        </div>
    `;

    // Add event listeners for inputs
    settingsContent.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('change', () => updateElementFromSettings(element.id));
        input.addEventListener('input', () => updateElementFromSettings(element.id));
    });
}

function renderContentSettings(element) {
    let html = '<div class="settings-group"><div class="settings-group-title">Контент</div>';

    if (element.tag === 'img') {
        html += `
            <div class="setting-row">
                <label class="setting-label">URL изображения</label>
                <input type="text" class="setting-input" data-prop="src" value="${element.attrs?.src || ''}">
            </div>
            <div class="setting-row">
                <label class="setting-label">Alt текст</label>
                <input type="text" class="setting-input" data-prop="alt" value="${element.attrs?.alt || ''}">
            </div>
        `;
    } else if (element.tag === 'a') {
        html += `
            <div class="setting-row">
                <label class="setting-label">Текст</label>
                <input type="text" class="setting-input" data-prop="content" value="${element.content}">
            </div>
            <div class="setting-row">
                <label class="setting-label">Ссылка</label>
                <input type="text" class="setting-input" data-prop="href" value="${element.attrs?.href || '#'}">
            </div>
        `;
    } else if (['style', 'script'].includes(element.tag)) {
        html += `
            <div class="setting-row">
                <label class="setting-label">Код</label>
                <textarea class="setting-textarea" data-prop="content" rows="10">${element.content}</textarea>
            </div>
        `;
    } else {
        html += `
            <div class="setting-row">
                <label class="setting-label">HTML контент</label>
                <textarea class="setting-textarea" data-prop="content" rows="6">${element.content}</textarea>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

function renderStyleSettings(element) {
    const s = element.styles;
    return `
        <div class="settings-group">
            <div class="settings-group-title">Размеры</div>
            <div class="setting-row">
                <label class="setting-label">Ширина</label>
                <input type="text" class="setting-input" data-style="width" value="${s.width || ''}">
            </div>
            <div class="setting-row">
                <label class="setting-label">Высота</label>
                <input type="text" class="setting-input" data-style="height" value="${s.height || ''}">
            </div>
        </div>

        <div class="settings-group">
            <div class="settings-group-title">Отступы (padding)</div>
            <div class="spacing-inputs">
                <input type="text" class="setting-input" data-style="paddingTop" placeholder="top" value="${s.paddingTop || ''}">
                <input type="text" class="setting-input" data-style="paddingRight" placeholder="right" value="${s.paddingRight || ''}">
                <input type="text" class="setting-input" data-style="paddingBottom" placeholder="bottom" value="${s.paddingBottom || ''}">
                <input type="text" class="setting-input" data-style="paddingLeft" placeholder="left" value="${s.paddingLeft || ''}">
            </div>
        </div>

        <div class="settings-group">
            <div class="settings-group-title">Внешние отступы (margin)</div>
            <div class="spacing-inputs">
                <input type="text" class="setting-input" data-style="marginTop" placeholder="top" value="${s.marginTop || ''}">
                <input type="text" class="setting-input" data-style="marginRight" placeholder="right" value="${s.marginRight || ''}">
                <input type="text" class="setting-input" data-style="marginBottom" placeholder="bottom" value="${s.marginBottom || ''}">
                <input type="text" class="setting-input" data-style="marginLeft" placeholder="left" value="${s.marginLeft || ''}">
            </div>
        </div>

        <div class="settings-group">
            <div class="settings-group-title">Фон</div>
            <div class="setting-row">
                <label class="setting-label">Цвет фона</label>
                <div class="setting-color">
                    <input type="color" data-style="backgroundColor" value="${s.backgroundColor || '#ffffff'}">
                    <input type="text" class="setting-input" data-style="backgroundColor" value="${s.backgroundColor || ''}">
                </div>
            </div>
            <div class="setting-row">
                <label class="setting-label">Изображение фона</label>
                <input type="text" class="setting-input" data-style="backgroundImage" placeholder="url(...)" value="${s.backgroundImage || ''}">
            </div>
        </div>

        <div class="settings-group">
            <div class="settings-group-title">Текст</div>
            <div class="setting-row">
                <label class="setting-label">Цвет текста</label>
                <div class="setting-color">
                    <input type="color" data-style="color" value="${s.color || '#000000'}">
                    <input type="text" class="setting-input" data-style="color" value="${s.color || ''}">
                </div>
            </div>
            <div class="setting-row">
                <label class="setting-label">Размер шрифта</label>
                <input type="text" class="setting-input" data-style="fontSize" value="${s.fontSize || ''}">
            </div>
            <div class="setting-row">
                <label class="setting-label">Выравнивание</label>
                <select class="setting-select" data-style="textAlign">
                    <option value="">—</option>
                    <option value="left" ${s.textAlign === 'left' ? 'selected' : ''}>Слева</option>
                    <option value="center" ${s.textAlign === 'center' ? 'selected' : ''}>По центру</option>
                    <option value="right" ${s.textAlign === 'right' ? 'selected' : ''}>Справа</option>
                </select>
            </div>
        </div>

        <div class="settings-group">
            <div class="settings-group-title">Границы</div>
            <div class="setting-row">
                <label class="setting-label">Скругление</label>
                <input type="text" class="setting-input" data-style="borderRadius" value="${s.borderRadius || ''}">
            </div>
            <div class="setting-row">
                <label class="setting-label">Граница</label>
                <input type="text" class="setting-input" data-style="border" placeholder="1px solid #ccc" value="${s.border || ''}">
            </div>
            <div class="setting-row">
                <label class="setting-label">Тень</label>
                <input type="text" class="setting-input" data-style="boxShadow" value="${s.boxShadow || ''}">
            </div>
        </div>
    `;
}

function renderAdvancedSettings(element) {
    return `
        <div class="settings-group">
            <div class="settings-group-title">ID и классы</div>
            <div class="setting-row">
                <label class="setting-label">ID элемента</label>
                <input type="text" class="setting-input" value="${element.id}" disabled>
            </div>
            <div class="setting-row">
                <label class="setting-label">CSS классы</label>
                <input type="text" class="setting-input" data-prop="className" value="${element.attrs?.class || ''}">
            </div>
        </div>

        <div class="settings-group">
            <div class="settings-group-title">Кастомный CSS</div>
            <div class="setting-row">
                <textarea class="setting-textarea" data-prop="customCss" rows="8" placeholder="color: red;
font-size: 20px;">${stylesToString(element.styles)}</textarea>
            </div>
        </div>
    `;
}

function updateElementFromSettings(id) {
    const element = state.elements.find(e => e.id === id);
    if (!element) return;

    // Update content
    settingsContent.querySelectorAll('[data-prop="content"]').forEach(input => {
        element.content = input.value;
    });

    // Update attributes
    settingsContent.querySelectorAll('[data-prop="src"]').forEach(input => {
        element.attrs = element.attrs || {};
        element.attrs.src = input.value;
    });
    settingsContent.querySelectorAll('[data-prop="alt"]').forEach(input => {
        element.attrs = element.attrs || {};
        element.attrs.alt = input.value;
    });
    settingsContent.querySelectorAll('[data-prop="href"]').forEach(input => {
        element.attrs = element.attrs || {};
        element.attrs.href = input.value;
    });

    // Update styles
    settingsContent.querySelectorAll('[data-style]').forEach(input => {
        const prop = input.dataset.style;
        if (input.value) {
            element.styles[prop] = input.value;
        } else {
            delete element.styles[prop];
        }
    });

    // Custom CSS
    settingsContent.querySelectorAll('[data-prop="customCss"]').forEach(input => {
        element.styles = stringToStyles(input.value);
    });

    renderCanvas();
    selectElement(id);
}

// ===== Drag and Drop =====
let draggedBlockType = null;
let draggedElement = null;

// From blocks panel
document.querySelectorAll('.block-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        draggedBlockType = e.target.dataset.type;
        e.target.classList.add('dragging');
    });

    item.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
        draggedBlockType = null;
    });
});

// Canvas drop zone
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    canvas.classList.add('drop-target');
});

canvas.addEventListener('dragleave', () => {
    canvas.classList.remove('drop-target');
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('drop-target');

    if (draggedBlockType) {
        const element = createElement(draggedBlockType);
        if (element) {
            saveHistory();
            renderCanvas();
            selectElement(element.id);
        }
    }
});

// Canvas element drag
function handleCanvasDragStart(e) {
    draggedElement = e.target.id;
    e.target.classList.add('dragging');
}

function handleCanvasDragOver(e) {
    e.preventDefault();
}

function handleCanvasDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (draggedElement && e.target.classList.contains('builder-element')) {
        const fromIndex = state.elements.findIndex(el => el.id === draggedElement);
        const toIndex = state.elements.findIndex(el => el.id === e.target.id);

        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
            const [element] = state.elements.splice(fromIndex, 1);
            state.elements.splice(toIndex, 0, element);
            saveHistory();
            renderCanvas();
        }
    }

    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    draggedElement = null;
}

// ===== Context Menu =====
function showContextMenu(x, y) {
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.classList.add('active');
}

function hideContextMenu() {
    contextMenu.classList.remove('active');
}

document.addEventListener('click', hideContextMenu);

contextMenu.querySelectorAll('.context-item').forEach(item => {
    item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (!state.selectedElement) return;

        switch (action) {
            case 'edit':
                // Already selected
                break;
            case 'duplicate':
                duplicateElement(state.selectedElement.id);
                break;
            case 'moveUp':
                moveElement(state.selectedElement.id, 'up');
                break;
            case 'moveDown':
                moveElement(state.selectedElement.id, 'down');
                break;
            case 'copyStyle':
                state.clipboardStyle = { ...state.selectedElement.styles };
                break;
            case 'pasteStyle':
                if (state.clipboardStyle) {
                    state.selectedElement.styles = { ...state.clipboardStyle };
                    saveHistory();
                    renderCanvas();
                    selectElement(state.selectedElement.id);
                }
                break;
            case 'delete':
                deleteElement(state.selectedElement.id);
                break;
        }
    });
});

// ===== History (Undo/Redo) =====
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
        selectElement(null);
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        state.elements = JSON.parse(state.history[state.historyIndex]);
        renderCanvas();
        selectElement(null);
    }
}

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
            e.preventDefault();
            undo();
        } else if (e.key === 'y') {
            e.preventDefault();
            redo();
        } else if (e.key === 's') {
            e.preventDefault();
            saveProject();
        }
    }

    if (e.key === 'Delete' && state.selectedElement) {
        deleteElement(state.selectedElement.id);
    }
});

// ===== Viewport =====
document.querySelectorAll('.viewport-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.viewport-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const viewport = btn.dataset.viewport;
        canvas.setAttribute('data-viewport', viewport);
        state.viewport = viewport;
    });
});

// ===== Category Toggle =====
document.querySelectorAll('.category-header').forEach(header => {
    header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
    });
});

// ===== Panel Tabs =====
document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabName = tab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });
    });
});

// ===== Export =====
function generateHTML() {
    let html = '';
    state.elements.forEach(el => {
        const styles = stylesToString(el.styles);
        const attrs = Object.entries(el.attrs || {}).map(([k, v]) => `${k}="${v}"`).join(' ');
        html += `<${el.tag}${attrs ? ' ' + attrs : ''} style="${styles}">${el.content}</${el.tag}>\n`;
    });
    return html;
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

// Export button
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

// Click on canvas deselects
canvas.addEventListener('click', (e) => {
    if (e.target === canvas || e.target === canvasEmpty) {
        selectElement(null);
    }
});
