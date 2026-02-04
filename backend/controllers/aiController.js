// System prompt for landing page generation
const SYSTEM_PROMPT = `You are a landing page generator. You generate JSON for a visual page builder.

Output a JSON object with key "elements" containing an array of page blocks.

Available block types and their componentSettings:

1. navbar - Navigation bar
   componentSettings: { logo: "Company Name", items: ["Главная|#", "О нас|#about", "Контакты|#contact"] }

2. hero - Hero section with title, subtitle and CTA button
   componentSettings: { title: "...", subtitle: "...", buttonText: "...", buttonUrl: "#", buttonColor: "#3b82f6", alignment: "center", textColor: "#1e293b" }
   styles: { padding: "80px 20px" }

3. features - Feature cards grid
   componentSettings: { columns: 3, items: [{ icon: "🚀", title: "...", description: "..." }, ...] }

4. testimonial - Client testimonial
   componentSettings: { quote: "...", authorName: "...", authorRole: "...", authorPhoto: "https://via.placeholder.com/48" }

5. pricing - Pricing card
   componentSettings: { planName: "...", price: "...", currency: "₽", period: "/мес", features: ["Feature 1", "Feature 2"], buttonText: "Выбрать", buttonColor: "#3b82f6", highlighted: false }

6. counter - Statistics counters
   componentSettings: { items: [{ value: "500+", label: "Клиентов" }, ...], color: "#3b82f6" }

7. checklist - Checklist with checkmarks
   componentSettings: { title: "...", items: ["Item 1", "Item 2", ...], iconColor: "#10b981" }

8. footer - Page footer
   componentSettings: { companyName: "...", year: "2025", links: ["Политика конфиденциальности|#", "Условия|#"] }

9. leadForm - Lead capture form
   componentSettings: { title: "...", subtitle: "...", buttonText: "Отправить", fields: ["name", "email", "phone"] }

Each element format:
{ "type": "blockType", "componentSettings": {...}, "styles": {...} }

- styles are optional CSS properties as an object: { padding: "60px 20px", backgroundColor: "#f8fafc" }
- Use the provided color scheme for styling
- Generate Russian-language content
- Make content specific and relevant to the niche, not generic placeholder text
- Include 8-12 blocks forming a complete landing page
- Always start with navbar and end with footer
- Use realistic, compelling copy that would work for the specific business

Color schemes:
- blue: primary=#3b82f6, accent=#2563eb
- green: primary=#059669, accent=#047857
- dark: primary=#6366f1, accent=#818cf8
- warm: primary=#ea580c, accent=#dc2626
- purple: primary=#8b5cf6, accent=#7c3aed

IMPORTANT: Output ONLY valid JSON. No markdown, no code blocks, just the JSON object.`;

// Generate landing page
exports.generateLanding = async (req, res) => {
    try {
        const { niche, product, productDescription, audience, mainOffer, tone, colorScheme } = req.body;

        // Validate required fields
        if (!niche || !product || !productDescription || !audience || !mainOffer) {
            return res.status(400).json({
                success: false,
                error: 'Заполните все обязательные поля: ниша, продукт, описание, аудитория, предложение'
            });
        }

        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'API ключ OpenRouter не настроен. Добавьте OPENROUTER_API_KEY в переменные окружения сервера.'
            });
        }

        const userPrompt = `Generate a complete landing page for:
- Ниша: ${niche}
- Продукт: ${product}
- Описание продукта: ${productDescription}
- Целевая аудитория: ${audience}
- Главное предложение (УТП): ${mainOffer}
- Тон коммуникации: ${tone || 'Профессиональный'}
- Цветовая схема: ${colorScheme || 'blue'}

Generate 8-12 blocks. All text content must be in Russian. Make the content specific, compelling and relevant to this exact business.`;

        console.log('[AI] Starting generation for:', niche, product);

        // Abort after 90 seconds
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        let response;
        try {
            response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
                    max_tokens: 4096
                }),
                signal: controller.signal
            });
        } catch (fetchErr) {
            clearTimeout(timeout);
            if (fetchErr.name === 'AbortError') {
                console.error('[AI] Request timed out');
                return res.status(504).json({
                    success: false,
                    error: 'Превышено время ожидания ответа от AI. Попробуйте ещё раз.'
                });
            }
            console.error('[AI] Fetch error:', fetchErr.message);
            return res.status(502).json({
                success: false,
                error: 'Не удалось подключиться к AI сервису: ' + fetchErr.message
            });
        }

        clearTimeout(timeout);

        const responseText = await response.text();
        console.log('[AI] Response status:', response.status, 'length:', responseText.length);

        if (!response.ok) {
            console.error('[AI] API error:', response.status, responseText.substring(0, 500));
            return res.status(502).json({
                success: false,
                error: `Ошибка API (${response.status}). Попробуйте позже.`
            });
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('[AI] Failed to parse API response:', responseText.substring(0, 500));
            return res.status(502).json({
                success: false,
                error: 'Некорректный ответ от AI API.'
            });
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('[AI] No choices in response:', JSON.stringify(data).substring(0, 500));
            return res.status(502).json({
                success: false,
                error: 'AI не вернул результат. Попробуйте ещё раз.'
            });
        }

        const content = data.choices[0].message.content;
        let parsed;

        try {
            parsed = JSON.parse(content);
        } catch (e) {
            console.error('[AI] Failed to parse AI content:', content.substring(0, 500));
            return res.status(502).json({
                success: false,
                error: 'AI вернул некорректный JSON. Попробуйте ещё раз.'
            });
        }

        const elements = parsed.elements || parsed;

        if (!Array.isArray(elements)) {
            return res.status(502).json({
                success: false,
                error: 'AI вернул некорректную структуру. Попробуйте ещё раз.'
            });
        }

        console.log('[AI] Success, generated', elements.length, 'elements');

        res.json({
            success: true,
            elements: elements
        });

    } catch (error) {
        console.error('[AI] Unhandled error:', error);
        // Make sure we always send a response
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Внутренняя ошибка сервера: ' + (error.message || 'unknown')
            });
        }
    }
};
