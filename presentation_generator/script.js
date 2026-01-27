// ===== Генератор презентаций =====

const CONFIG = {
    apiUrl: window.location.hostname === 'localhost'
        ? 'http://localhost:8000'
        : 'https://ai-tools-backend-d3zr.onrender.com'
};

// State
let uploadedFile = null;
let fileContent = '';
let generatedSlides = [];

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileContentPreview = document.getElementById('fileContentPreview');
const generateSection = document.getElementById('generateSection');
const generateBtn = document.getElementById('generateBtn');
const resultsSection = document.getElementById('resultsSection');
const slidesContainer = document.getElementById('slidesContainer');
const slideCounter = document.getElementById('slideCounter');

// ===== File Upload =====
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    const maxSize = 500000; // 500KB
    if (file.size > maxSize) {
        alert('Файл слишком большой. Максимальный размер: 500KB');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedFile = file;
        fileContent = e.target.result;

        // Show preview
        fileName.textContent = file.name;
        fileContentPreview.textContent = fileContent.substring(0, 1000) + (fileContent.length > 1000 ? '...' : '');

        uploadArea.style.display = 'none';
        filePreview.style.display = 'block';
        generateSection.style.display = 'block';
    };
    reader.readAsText(file);
}

document.getElementById('removeFile').addEventListener('click', () => {
    uploadedFile = null;
    fileContent = '';
    fileInput.value = '';

    uploadArea.style.display = 'block';
    filePreview.style.display = 'none';
    generateSection.style.display = 'none';
    resultsSection.style.display = 'none';
});

// ===== Generate Presentation =====
generateBtn.addEventListener('click', generatePresentation);

async function generatePresentation() {
    if (!fileContent) {
        alert('Сначала загрузите файл');
        return;
    }

    const slideCount = document.getElementById('slideCount').value;

    // Build prompt
    const prompt = `Проанализируй этот документ и создай структуру презентации из примерно ${slideCount} слайдов.

ВАЖНО: Разделяй каждый слайд символом %
Для каждого слайда напиши ТОЛЬКО те слова/фразы, которые должны быть на слайде (кратко, тезисно).
Первая строка каждого слайда — это заголовок.

Формат ответа:
Заголовок слайда 1
• Тезис 1
• Тезис 2
• Тезис 3
%
Заголовок слайда 2
• Тезис 1
• Тезис 2
%
...и так далее

Документ для анализа:
${fileContent}`;

    setLoading(true);

    try {
        const response = await fetch(`${CONFIG.apiUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'openrouter/auto',
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Ошибка генерации');
        }

        // Parse slides by % separator
        parseAndDisplaySlides(data.content);

    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка: ' + error.message);
    } finally {
        setLoading(false);
    }
}

function parseAndDisplaySlides(content) {
    // Split by % separator
    const rawSlides = content.split('%').map(s => s.trim()).filter(s => s.length > 0);

    generatedSlides = rawSlides.map((slideContent, index) => {
        const lines = slideContent.split('\n').filter(l => l.trim());
        const title = lines[0] || `Слайд ${index + 1}`;
        const body = lines.slice(1).join('\n');

        return { title, body, raw: slideContent };
    });

    displaySlides();
}

function displaySlides() {
    slidesContainer.innerHTML = generatedSlides.map((slide, index) => `
        <div class="slide-card" data-index="${index}">
            <div class="slide-header">
                <div class="slide-number">${index + 1}</div>
                <div class="slide-title">${escapeHtml(slide.title)}</div>
                <button class="slide-copy" onclick="copySlide(${index})">📋 Копировать</button>
            </div>
            <div class="slide-content">${formatSlideContent(slide.body)}</div>
        </div>
    `).join('');

    slideCounter.textContent = `${generatedSlides.length} слайдов`;
    resultsSection.style.display = 'block';

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function formatSlideContent(content) {
    if (!content) return '<em style="color: var(--text-secondary);">Только заголовок</em>';

    // Convert bullet points to list
    const lines = content.split('\n');
    let html = '<ul>';

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed) {
            // Remove bullet characters if present
            const cleanLine = trimmed.replace(/^[•\-\*]\s*/, '');
            html += `<li>${escapeHtml(cleanLine)}</li>`;
        }
    });

    html += '</ul>';
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copySlide(index) {
    const slide = generatedSlides[index];
    const text = `${slide.title}\n${slide.body}`;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Слайд скопирован!');
    });
}

document.getElementById('copyAllBtn').addEventListener('click', () => {
    const allText = generatedSlides.map((slide, i) =>
        `--- Слайд ${i + 1} ---\n${slide.title}\n${slide.body}`
    ).join('\n\n');

    navigator.clipboard.writeText(allText).then(() => {
        showToast('Все слайды скопированы!');
    });
});

document.getElementById('newPresentationBtn').addEventListener('click', () => {
    uploadedFile = null;
    fileContent = '';
    generatedSlides = [];
    fileInput.value = '';

    uploadArea.style.display = 'block';
    filePreview.style.display = 'none';
    generateSection.style.display = 'none';
    resultsSection.style.display = 'none';
    slideCounter.textContent = '0 слайдов';

    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== UI Helpers =====
function setLoading(loading) {
    generateBtn.disabled = loading;
    generateBtn.querySelector('.btn-text').style.display = loading ? 'none' : 'inline';
    generateBtn.querySelector('.btn-loader').style.display = loading ? 'inline' : 'none';
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--success);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 0.9rem;
        z-index: 1000;
        animation: fadeInOut 2s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
}

// Add animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
`;
document.head.appendChild(style);
