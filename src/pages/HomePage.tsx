import GroupedBubbleChart, { type BubbleDatum } from '../components/GroupedBubbleChart';

const bubbleData: BubbleDatum[] = [
    { name: 'VOO', group: 'Large Cap', value: 95 },
    { name: 'IVV', group: 'Large Cap', value: 88 },
    { name: 'SPY', group: 'Large Cap', value: 100 },
    { name: 'QQQ', group: 'Growth', value: 92 },
    { name: 'VUG', group: 'Growth', value: 78 },
    { name: 'SCHG', group: 'Growth', value: 70 },
    { name: 'VTI', group: 'Broad Market', value: 90 },
    { name: 'ITOT', group: 'Broad Market', value: 72 },
    { name: 'SCHB', group: 'Broad Market', value: 62 },
    { name: 'VXUS', group: 'International', value: 60 },
    { name: 'VEA', group: 'International', value: 56 },
    { name: 'VWO', group: 'International', value: 50 },
];

export default function HomePage() {
    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8">
            <h1 className="mb-2 text-center">ETF Bubble Groups</h1>
            <p className="mb-6 text-center text-slate-700">
                Bubble size represents relative value and color represents ETF grouping.
            </p>
            <GroupedBubbleChart data={bubbleData} />
        </div>
    );
}