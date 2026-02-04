// System prompt for landing page generation (compact to reduce tokens)
const SYSTEM_PROMPT = `You are a landing page JSON generator for a visual page builder. Output a JSON object: {"elements": [...]}.

Block types and componentSettings:
- navbar: {logo:"Name", items:["Text|#url",...]}
- hero: {title:"...", subtitle:"...", buttonText:"...", buttonUrl:"#", buttonColor:"#3b82f6", alignment:"center", textColor:"#1e293b"}
- features: {columns:3, items:[{icon:"🚀", title:"...", description:"..."},..]}
- testimonial: {quote:"...", authorName:"...", authorRole:"...", authorPhoto:"https://via.placeholder.com/48"}
- pricing: {planName:"...", price:"...", currency:"₽", period:"/мес", features:["..."], buttonText:"Выбрать", buttonColor:"#3b82f6", highlighted:false}
- counter: {items:[{value:"500+", label:"Клиентов"},...], color:"#3b82f6"}
- checklist: {title:"...", items:["..."], iconColor:"#10b981"}
- leadForm: {title:"...", subtitle:"...", buttonText:"Отправить", fields:["name","email","phone"]}
- footer: {companyName:"...", year:"2025", links:["Text|#"]}

Element: {"type":"blockType", "componentSettings":{...}, "styles":{...}}
styles = CSS properties: {padding:"60px 20px", backgroundColor:"#f8fafc"}

Rules: Russian text, 8-10 blocks, start with navbar, end with footer, relevant to business.
Output ONLY valid JSON, no markdown.`;

// Generate landing page
exports.generateLanding = async (req, res) => {
    try {
        const { niche, product, productDescription, audience, mainOffer, tone, colorScheme } = req.body;

        if (!niche || !product || !productDescription || !audience || !mainOffer) {
            return res.status(400).json({
                success: false,
                error: 'Заполните все обязательные поля'
            });
        }

        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'API ключ OpenRouter не настроен. Добавьте OPENROUTER_API_KEY в переменные окружения сервера.'
            });
        }

        const userPrompt = `Landing page: ниша "${niche}", продукт "${product}". Описание: ${productDescription}. Аудитория: ${audience}. УТП: ${mainOffer}. Тон: ${tone || 'Профессиональный'}. Цвета: ${colorScheme || 'blue'}.`;

        console.log('[AI] Starting generation for:', niche);

        // Send headers immediately to keep connection alive on Render
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no' // Disable Nginx/Render buffering
        });

        // Send a space to keep connection alive (valid JSON whitespace)
        const keepAlive = setInterval(() => {
            res.write(' ');
        }, 5000);

        // Abort after 25 seconds (before Render's 30s timeout)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        let apiResponse;
        try {
            apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7,
                    max_tokens: 3000
                }),
                signal: controller.signal
            });
        } catch (fetchErr) {
            clearTimeout(timeout);
            clearInterval(keepAlive);
            const errMsg = fetchErr.name === 'AbortError'
                ? 'Превышено время ожидания AI (25с). Попробуйте ещё раз.'
                : 'Не удалось подключиться к AI: ' + fetchErr.message;
            console.error('[AI] Fetch error:', errMsg);
            res.end(JSON.stringify({ success: false, error: errMsg }));
            return;
        }

        clearTimeout(timeout);

        const responseText = await apiResponse.text();
        clearInterval(keepAlive);

        console.log('[AI] Response status:', apiResponse.status, 'length:', responseText.length);

        if (!apiResponse.ok) {
            console.error('[AI] API error:', apiResponse.status, responseText.substring(0, 300));
            res.end(JSON.stringify({ success: false, error: `Ошибка API (${apiResponse.status})` }));
            return;
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('[AI] Parse error:', responseText.substring(0, 300));
            res.end(JSON.stringify({ success: false, error: 'Некорректный ответ AI API' }));
            return;
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('[AI] No choices:', JSON.stringify(data).substring(0, 300));
            res.end(JSON.stringify({ success: false, error: 'AI не вернул результат' }));
            return;
        }

        const content = data.choices[0].message.content;
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            console.error('[AI] Content parse error:', content.substring(0, 300));
            res.end(JSON.stringify({ success: false, error: 'AI вернул некорректный JSON' }));
            return;
        }

        const elements = parsed.elements || parsed;
        if (!Array.isArray(elements)) {
            res.end(JSON.stringify({ success: false, error: 'AI вернул некорректную структуру' }));
            return;
        }

        console.log('[AI] Success:', elements.length, 'elements');
        res.end(JSON.stringify({ success: true, elements }));

    } catch (error) {
        console.error('[AI] Unhandled:', error);
        if (!res.writableEnded) {
            res.end(JSON.stringify({ success: false, error: 'Ошибка сервера: ' + (error.message || 'unknown') }));
        }
    }
};
