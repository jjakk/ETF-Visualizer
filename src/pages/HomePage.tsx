import { type FormEvent, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { ProgressSpinner } from 'primereact/progressspinner';
import GroupedBubbleChart, { type BubbleDatum } from '../components/GroupedBubbleChart';
import { fetchEtfHoldingsFromGemini } from '../services/geminiHoldings';

const defaultBubbleData: BubbleDatum[] = [
    { ticker: 'AAPL', companyName: 'Apple Inc.', group: 'Technology', value: 7.2 },
    { ticker: 'MSFT', companyName: 'Microsoft Corporation', group: 'Technology', value: 6.8 },
    { ticker: 'NVDA', companyName: 'NVIDIA Corporation', group: 'Technology', value: 5.4 },
    { ticker: 'AMZN', companyName: 'Amazon.com, Inc.', group: 'Consumer Discretionary', value: 3.6 },
    { ticker: 'META', companyName: 'Meta Platforms, Inc.', group: 'Communication Services', value: 2.9 },
    { ticker: 'GOOGL', companyName: 'Alphabet Inc.', group: 'Communication Services', value: 2.5 },
];

export default function HomePage() {
    const [ticker, setTicker] = useState('VOO');
    const [apiKey, setApiKey] = useState('');
    const [chartData, setChartData] = useState<BubbleDatum[]>(defaultBubbleData);
    const [fundTitle, setFundTitle] = useState('Sample Holdings');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage('');

        if (!ticker.trim() || !apiKey.trim()) {
            setErrorMessage('Please provide both an ETF ticker and Gemini API key.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetchEtfHoldingsFromGemini({ ticker, apiKey });
            const nextData: BubbleDatum[] = response.holdings.map((holding) => ({
                ticker: holding.ticker,
                companyName: holding.name,
                group: holding.sector || 'Other',
                value: holding.weightPercent,
            }));

            setChartData(nextData);
            setFundTitle(`${response.fundName} (${response.ticker})`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Unable to fetch ETF holdings.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8">
            <h1 className="mb-2 text-center">ETF Holdings Bubble Chart</h1>
            <p className="mb-6 text-center text-slate-700">
                Enter a ticker and Gemini API key to visualize ETF holdings by sector.
            </p>

            <form onSubmit={onSubmit} className="mb-6 grid gap-4 rounded-xl bg-white p-4 shadow-sm md:grid-cols-[1fr_2fr_auto] md:items-end">
                <span className="p-float-label">
                    <InputText
                        id="ticker"
                        value={ticker}
                        onChange={(event) => setTicker(event.target.value.toUpperCase())}
                        autoComplete="off"
                    />
                    <label htmlFor="ticker">ETF Ticker (e.g. VOO)</label>
                </span>

                <span className="p-float-label">
                    <InputText
                        id="gemini-api-key"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        type="password"
                        autoComplete="off"
                    />
                    <label htmlFor="gemini-api-key">Gemini API Key</label>
                </span>

                <Button type="submit" label={isLoading ? 'Loading...' : 'Load Holdings'} disabled={isLoading} />
            </form>

            {errorMessage && <Message severity="error" text={errorMessage} className="mb-4 w-full" />}

            <div className="mb-2 text-center text-lg font-semibold text-slate-800">{fundTitle}</div>

            {isLoading ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-xl bg-white shadow-sm">
                    <ProgressSpinner strokeWidth="4" />
                </div>
            ) : (
                <GroupedBubbleChart data={chartData} />
            )}
        </div>
    );
}