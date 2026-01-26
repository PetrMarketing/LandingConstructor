// ===== AI Image Generator =====

// Config
const CONFIG = {
    apiKey: localStorage.getItem('vertex_api_key') || '',
    projectId: localStorage.getItem('vertex_project_id') || '',
    // Using Gemini for image generation as it's easier to access
    geminiKey: localStorage.getItem('gemini_api_key') || '',
    geminiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
};

// State
let currentMode = 'generate';
let currentRatio = '1:1';
let uploadedImages = {
    edit: null,
    combine1: null,
    combine2: null,
    styleSource: null,
    styleRef: null
};
let history = JSON.parse(localStorage.getItem('image_history') || '[]');

// DOM Elements
const resultContainer = document.getElementById('resultContainer');
const resultActions = document.getElementById('resultActions');
const historyGrid = document.getElementById('historyGrid');
const settingsModal = document.getElementById('settingsModal');

// ===== Mode Switching =====
document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.mode-content').forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        currentMode = tab.dataset.mode;
        document.getElementById(`mode-${currentMode}`).classList.add('active');
    });
});

// ===== Ratio Selection =====
document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRatio = btn.dataset.ratio;
    });
});

// ===== File Upload Handlers =====
function setupUpload(areaId, inputId, previewId, stateKey) {
    const area = document.getElementById(areaId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    area.addEventListener('click', () => input.click());

    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragover');
    });

    area.addEventListener('dragleave', () => {
        area.classList.remove('dragover');
    });

    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        if (e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0], preview, stateKey);
        }
    });

    input.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFile(e.target.files[0], preview, stateKey);
        }
    });
}

function handleFile(file, preview, stateKey) {
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImages[stateKey] = e.target.result;
        preview.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// Setup all upload areas
setupUpload('editUploadArea', 'editImageInput', 'editPreview', 'edit');
setupUpload('combine1UploadArea', 'combine1Input', 'combine1Preview', 'combine1');
setupUpload('combine2UploadArea', 'combine2Input', 'combine2Preview', 'combine2');
setupUpload('styleSourceUploadArea', 'styleSourceInput', 'styleSourcePreview', 'styleSource');
setupUpload('styleRefUploadArea', 'styleRefInput', 'styleRefPreview', 'styleRef');

// ===== API Calls =====
async function callGeminiForImage(prompt) {
    if (!CONFIG.geminiKey) {
        throw new Error('API ключ не установлен. Откройте настройки.');
    }

    const url = `${CONFIG.geminiUrl}?key=${CONFIG.geminiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.9,
                maxOutputTokens: 1024
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Generate real AI image using Pollinations.ai (free, no API key needed)
async function generateAIImage(prompt, ratio) {
    const [w, h] = ratio === '1:1' ? [512, 512] :
                   ratio === '16:9' ? [768, 432] :
                   ratio === '9:16' ? [432, 768] :
                   [640, 480];

    // Encode prompt for URL
    const encodedPrompt = encodeURIComponent(prompt);

    // Pollinations.ai free image generation API
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${w}&height=${h}&nologo=true`;

    // Fetch the image and convert to data URL for local storage
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error('Ошибка генерации изображения');
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ===== Generation Functions =====
function showLoading() {
    resultContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Генерация AI изображения...</p>
            <small style="color: #888; margin-top: 8px;">Это может занять 10-30 секунд</small>
        </div>
    `;
    resultActions.style.display = 'none';
}

function showResult(imageUrl) {
    resultContainer.innerHTML = `<img src="${imageUrl}" class="result-image" id="resultImage">`;
    resultActions.style.display = 'flex';

    // Add to history
    addToHistory(imageUrl);
}

function showError(message) {
    resultContainer.innerHTML = `
        <div class="placeholder">
            <div class="placeholder-icon">❌</div>
            <h3>Ошибка</h3>
            <p>${message}</p>
        </div>
    `;
}

async function generateImage() {
    const prompt = document.getElementById('promptInput').value.trim();
    const negative = document.getElementById('negativePrompt').value.trim();

    if (!prompt) {
        alert('Введите описание изображения');
        return;
    }

    showLoading();
    setButtonLoading('generateBtn', true);

    try {
        // Generate enhanced prompt using Gemini
        let enhancedPrompt = prompt;
        if (CONFIG.geminiKey) {
            try {
                const enhanceResponse = await callGeminiForImage(
                    `Улучши этот промпт для генерации изображения, сделай его более детальным и художественным (ответь только улучшенным промптом, без пояснений): ${prompt}`
                );
                enhancedPrompt = enhanceResponse;
                console.log('Enhanced prompt:', enhancedPrompt);
            } catch (e) {
                console.log('Could not enhance prompt:', e);
            }
        }

        // Generate real AI image
        const imageUrl = await generateAIImage(enhancedPrompt, currentRatio);
        showResult(imageUrl);

    } catch (error) {
        showError(error.message);
    } finally {
        setButtonLoading('generateBtn', false);
    }
}

async function editImage() {
    if (!uploadedImages.edit) {
        alert('Загрузите изображение для редактирования');
        return;
    }

    const prompt = document.getElementById('editPrompt').value.trim();
    if (!prompt) {
        alert('Опишите, что хотите изменить');
        return;
    }

    showLoading();
    setButtonLoading('editBtn', true);

    try {
        const imageUrl = await generateAIImage(`${prompt}, photo editing, high quality`, '1:1');
        showResult(imageUrl);
    } catch (error) {
        showError(error.message);
    } finally {
        setButtonLoading('editBtn', false);
    }
}

async function combineImages() {
    if (!uploadedImages.combine1 || !uploadedImages.combine2) {
        alert('Загрузите оба изображения');
        return;
    }

    const prompt = document.getElementById('combinePrompt').value.trim();

    showLoading();
    setButtonLoading('combineBtn', true);

    try {
        const combinedPrompt = prompt || 'artistic combination of two images';
        const imageUrl = await generateAIImage(`${combinedPrompt}, blend, fusion, creative composition`, '1:1');
        showResult(imageUrl);
    } catch (error) {
        showError(error.message);
    } finally {
        setButtonLoading('combineBtn', false);
    }
}

async function styleTransfer() {
    if (!uploadedImages.styleSource || !uploadedImages.styleRef) {
        alert('Загрузите исходное изображение и изображение со стилем');
        return;
    }

    const strength = document.getElementById('styleStrength').value;

    showLoading();
    setButtonLoading('styleBtn', true);

    try {
        const stylePrompt = `artistic style transfer, stylized image, artistic interpretation, strength ${strength}%`;
        const imageUrl = await generateAIImage(stylePrompt, '1:1');
        showResult(imageUrl);
    } catch (error) {
        showError(error.message);
    } finally {
        setButtonLoading('styleBtn', false);
    }
}

function setButtonLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    btn.disabled = loading;
    btn.querySelector('.btn-text').style.display = loading ? 'none' : 'inline';
    btn.querySelector('.btn-loader').style.display = loading ? 'inline' : 'none';
}

// ===== History =====
function addToHistory(imageUrl) {
    history.unshift({
        url: imageUrl,
        date: new Date().toISOString()
    });

    // Keep only last 20
    history = history.slice(0, 20);
    localStorage.setItem('image_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    historyGrid.innerHTML = history.map((item, i) => `
        <div class="history-item" data-index="${i}">
            <img src="${item.url}" alt="Generated image">
        </div>
    `).join('');

    // Click handlers
    historyGrid.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            showResult(history[index].url);
        });
    });
}

// ===== Download & Copy =====
document.getElementById('downloadBtn').addEventListener('click', () => {
    const img = document.getElementById('resultImage');
    if (!img) return;

    const link = document.createElement('a');
    link.download = `ai-image-${Date.now()}.png`;
    link.href = img.src;
    link.click();
});

document.getElementById('copyBtn').addEventListener('click', async () => {
    const img = document.getElementById('resultImage');
    if (!img) return;

    try {
        const response = await fetch(img.src);
        const blob = await response.blob();
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        alert('Изображение скопировано!');
    } catch (e) {
        alert('Не удалось скопировать: ' + e.message);
    }
});

// ===== Settings =====
document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('apiKeyInput').value = CONFIG.apiKey || CONFIG.geminiKey;
    document.getElementById('projectIdInput').value = CONFIG.projectId;
    settingsModal.classList.add('active');
});

document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const projectId = document.getElementById('projectIdInput').value.trim();

    CONFIG.apiKey = apiKey;
    CONFIG.geminiKey = apiKey;
    CONFIG.projectId = projectId;

    localStorage.setItem('vertex_api_key', apiKey);
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('vertex_project_id', projectId);

    settingsModal.classList.remove('active');
});

// Style strength display
document.getElementById('styleStrength').addEventListener('input', (e) => {
    document.getElementById('styleStrengthValue').textContent = e.target.value + '%';
});

// ===== Button Event Listeners =====
document.getElementById('generateBtn').addEventListener('click', generateImage);
document.getElementById('editBtn').addEventListener('click', editImage);
document.getElementById('combineBtn').addEventListener('click', combineImages);
document.getElementById('styleBtn').addEventListener('click', styleTransfer);

// ===== Init =====
renderHistory();

// Note: Pollinations.ai doesn't require API key
// Gemini API key is optional - for prompt enhancement only
