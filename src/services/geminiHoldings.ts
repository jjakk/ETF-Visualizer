export type EtfHolding = {
    ticker: string;
    name: string;
    sector: string;
    weightPercent: number;
};

export type EtfHoldingsResponse = {
    ticker: string;
    fundName: string;
    holdings: EtfHolding[];
};

type FetchEtfHoldingsOptions = {
    ticker: string;
    apiKey: string;
};

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const stripCodeFence = (text: string): string => text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

const isValidHolding = (item: unknown): item is EtfHolding => {
    if (!item || typeof item !== 'object') {
        return false;
    }

    const holding = item as Record<string, unknown>;
    return (
        typeof holding.ticker === 'string' &&
        typeof holding.name === 'string' &&
        typeof holding.sector === 'string' &&
        typeof holding.weightPercent === 'number' &&
        Number.isFinite(holding.weightPercent) &&
        holding.weightPercent > 0
    );
};

const normalizeResponse = (payload: unknown, fallbackTicker: string): EtfHoldingsResponse => {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Gemini returned an invalid response payload.');
    }

    const data = payload as Record<string, unknown>;
    const holdings = Array.isArray(data.holdings) ? data.holdings.filter(isValidHolding) : [];

    if (holdings.length === 0) {
        throw new Error('No holdings were returned for this ETF ticker.');
    }

    return {
        ticker: typeof data.ticker === 'string' ? data.ticker.toUpperCase() : fallbackTicker.toUpperCase(),
        fundName: typeof data.fundName === 'string' ? data.fundName : `${fallbackTicker.toUpperCase()} ETF`,
        holdings: holdings.map((holding) => ({
            ...holding,
            ticker: holding.ticker.toUpperCase(),
            sector: holding.sector || 'Other',
            weightPercent: Number(holding.weightPercent.toFixed(2)),
        })),
    };
};

export async function fetchEtfHoldingsFromGemini({ ticker, apiKey }: FetchEtfHoldingsOptions): Promise<EtfHoldingsResponse> {
    const cleanedTicker = ticker.trim().toUpperCase();
    const cleanedKey = apiKey.trim();

    if (!cleanedTicker) {
        throw new Error('Please enter an ETF ticker symbol.');
    }

    if (!cleanedKey) {
        throw new Error('Please enter a Gemini API key.');
    }

    const prompt = `You are a financial data assistant. Return the latest known ETF holdings for ticker ${cleanedTicker}.\n\nOutput only JSON with this exact shape:\n{\n  "ticker": "${cleanedTicker}",\n  "fundName": "Fund full name",\n  "holdings": [\n    { "ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology", "weightPercent": 7.21 }\n  ]\n}\n\nRequirements:\n- Include all holdings\n- weightPercent must be numeric values, not strings\n- sector should be a concise category label\n- If exact holdings are unavailable, provide best available recent holdings estimates\n- Do not include markdown or commentary`; 

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(cleanedKey)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        let details = '';
        try {
            const errorJson = (await response.json()) as { error?: { message?: string } };
            details = errorJson.error?.message ?? '';
        } catch {
            details = '';
        }

        throw new Error(details || 'Failed to fetch holdings from Gemini.');
    }

    const raw = (await response.json()) as {
        candidates?: Array<{
            content?: {
                parts?: Array<{ text?: string }>;
            };
        }>;
    };

    const text = raw.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('Gemini returned an empty result.');
    }

    const cleanedText = stripCodeFence(text);

    let parsed: unknown;
    try {
        parsed = JSON.parse(cleanedText);
    } catch {
        throw new Error('Gemini returned non-JSON output. Try again.');
    }

    return normalizeResponse(parsed, cleanedTicker);
}
