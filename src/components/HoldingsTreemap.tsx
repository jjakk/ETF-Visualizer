import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { BubbleDatum } from './GroupedBubbleChart';
import { DEFAULT_SECTOR_PALETTE } from './chartColors';

type HoldingsTreemapProps = {
    data: BubbleDatum[];
    height?: number;
    className?: string;
    sectorColorMap?: Record<string, string>;
};

type LogoMeta = {
    isAvailable: boolean;
    averageColor?: string;
};

const LOGO_BASE_URL = 'https://financialmodelingprep.com/image-stock';

const buildLogoUrl = (ticker: string): string => `${LOGO_BASE_URL}/${encodeURIComponent(ticker.toUpperCase())}.png`;

const escapeHtml = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const extractAverageColor = (image: HTMLImageElement): string | undefined => {
    const sampleSize = 20;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    const context = canvas.getContext('2d');
    if (!context) {
        return undefined;
    }

    context.drawImage(image, 0, 0, sampleSize, sampleSize);
    const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;

    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;

    for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3];
        if (alpha < 24) {
            continue;
        }

        red += pixels[index];
        green += pixels[index + 1];
        blue += pixels[index + 2];
        count += 1;
    }

    if (count === 0) {
        return undefined;
    }

    return `rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`;
};

const loadLogoMeta = (url: string): Promise<LogoMeta> =>
    new Promise((resolve) => {
        const logoImage = new Image();
        logoImage.crossOrigin = 'anonymous';
        logoImage.onload = () => {
            let averageColor: string | undefined;
            try {
                averageColor = extractAverageColor(logoImage);
            } catch {
                averageColor = undefined;
            }

            resolve({ isAvailable: true, averageColor });
        };
        logoImage.onerror = () => resolve({ isAvailable: false });
        logoImage.src = url;
    });

export default function HoldingsTreemap({ data, height = 640, className, sectorColorMap }: HoldingsTreemapProps) {
    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

    const groups = useMemo(() => [...new Set(data.map((item) => item.group))], [data]);

    useEffect(() => {
        if (!chartContainerRef.current || !svgRef.current) {
            return;
        }

        const container = chartContainerRef.current;
        const svg = d3.select(svgRef.current);
        const resolvedPalette = groups.map((group, index) => {
            return sectorColorMap?.[group] ?? DEFAULT_SECTOR_PALETTE[index % DEFAULT_SECTOR_PALETTE.length];
        });
        const colorScale = d3.scaleOrdinal<string, string>().domain(groups).range(resolvedPalette);

        let destroyed = false;
        let logoMetaByTicker = new Map<string, LogoMeta>();

        const tooltipSelection = d3
            .select(container)
            .selectAll<HTMLDivElement, null>('.treemap-tooltip')
            .data([null])
            .join('div')
            .attr('class', 'treemap-tooltip pointer-events-none absolute z-20 hidden max-w-72 rounded-md border border-slate-200 bg-white/95 p-2 text-xs text-slate-800 shadow-lg backdrop-blur-sm');

        const draw = () => {
            const width = Math.max(container.clientWidth, 300);

            svg.selectAll('*').remove();
            svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

            const root = d3
                .hierarchy<{ children: BubbleDatum[] } | BubbleDatum>({ children: data } as { children: BubbleDatum[] })
                .sum((item) => ('value' in item ? item.value : 0))
                .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));

            const treemapRoot = d3
                .treemap<{ children: BubbleDatum[] } | BubbleDatum>()
                .size([width, height])
                .paddingOuter(6)
                .paddingInner(4)
                .round(true)(root);

            const nodes = treemapRoot.leaves() as d3.HierarchyRectangularNode<BubbleDatum>[];
            const items = svg
                .append('g')
                .selectAll('g')
                .data(nodes)
                .enter()
                .append('g')
                .attr('transform', (node) => `translate(${node.x0}, ${node.y0})`);

            items
                .append('rect')
                .attr('width', (node) => Math.max(0, node.x1 - node.x0))
                .attr('height', (node) => Math.max(0, node.y1 - node.y0))
                .attr('rx', 8)
                .attr('fill', (node) => {
                    const group = node.data.group;
                    return d3.color(colorScale(group))?.copy({ opacity: 0.22 })?.toString() ?? '#e2e8f0';
                })
                .attr('stroke', (node) => colorScale(node.data.group))
                .attr('stroke-width', 2);

            items.each(function appendLogo(node) {
                const widthPx = Math.max(0, node.x1 - node.x0);
                const heightPx = Math.max(0, node.y1 - node.y0);
                const ticker = node.data.ticker.toUpperCase();
                const logoMeta = logoMetaByTicker.get(ticker);
                const canShowLogo = logoMeta?.isAvailable === true && widthPx > 72 && heightPx > 56;

                const groupSelection = d3.select(this);
                if (!canShowLogo) {
                    groupSelection
                        .append('text')
                        .text(node.data.ticker)
                        .attr('x', 8)
                        .attr('y', 18)
                        .attr('fill', '#0f172a')
                        .attr('font-size', 12)
                        .attr('font-weight', 700);

                    groupSelection
                        .append('text')
                        .text(`${node.data.value.toFixed(2)}%`)
                        .attr('x', 8)
                        .attr('y', 34)
                        .attr('fill', '#334155')
                        .attr('font-size', 11)
                        .attr('font-weight', 500);
                    return;
                }

                groupSelection
                    .append('rect')
                    .attr('x', 6)
                    .attr('y', 6)
                    .attr('width', Math.max(0, widthPx - 12))
                    .attr('height', Math.max(0, heightPx - 12))
                    .attr('rx', 7)
                    .attr('fill', logoMeta.averageColor ?? colorScale(node.data.group))
                    .attr('fill-opacity', 0.78);

                const insetSize = Math.min(widthPx - 18, heightPx - 22);
                if (insetSize > 20) {
                    groupSelection
                        .append('image')
                        .attr('href', buildLogoUrl(node.data.ticker))
                        .attr('x', (widthPx - insetSize) / 2)
                        .attr('y', Math.max(8, (heightPx - insetSize) / 2 - 6))
                        .attr('width', insetSize)
                        .attr('height', insetSize)
                        .attr('preserveAspectRatio', 'xMidYMid meet')
                        .attr('crossorigin', 'anonymous');
                }

                groupSelection
                    .append('text')
                    .text(`${node.data.ticker} • ${node.data.value.toFixed(2)}%`)
                    .attr('x', 8)
                    .attr('y', heightPx - 8)
                    .attr('fill', '#f8fafc')
                    .attr('font-size', 11)
                    .attr('font-weight', 600)
                    .attr('paint-order', 'stroke')
                    .attr('stroke', '#0f172a')
                    .attr('stroke-width', 2);
            });

            items
                .on('mouseenter', (event: MouseEvent, node) => {
                    tooltipSelection
                        .style('display', 'block')
                        .html(
                            `<div class="mb-1 text-sm font-semibold text-slate-900">${escapeHtml(node.data.ticker)}</div>` +
                                `<div><span class="font-medium">Name:</span> ${escapeHtml(node.data.companyName || node.data.ticker)}</div>` +
                                `<div><span class="font-medium">Sector:</span> ${escapeHtml(node.data.group)}</div>` +
                                `<div><span class="font-medium">Weight:</span> ${node.data.value.toFixed(2)}%</div>`
                        );

                    const [pointerX, pointerY] = d3.pointer(event, container);
                    tooltipSelection
                        .style('left', `${Math.min(pointerX + 14, width - 220)}px`)
                        .style('top', `${Math.max(pointerY - 12, 8)}px`);
                })
                .on('mousemove', (event: MouseEvent) => {
                    const [pointerX, pointerY] = d3.pointer(event, container);
                    tooltipSelection
                        .style('left', `${Math.min(pointerX + 14, width - 220)}px`)
                        .style('top', `${Math.max(pointerY - 12, 8)}px`);
                })
                .on('mouseleave', () => {
                    tooltipSelection.style('display', 'none');
                });
        };

        const prepareLogos = async () => {
            const uniqueTickers = [...new Set(data.map((item) => item.ticker.toUpperCase()))];
            const logoMetaEntries = await Promise.all(
                uniqueTickers.map(async (ticker) => ({
                    ticker,
                    logoMeta: await loadLogoMeta(buildLogoUrl(ticker)),
                }))
            );

            if (destroyed) {
                return;
            }

            logoMetaByTicker = new Map(logoMetaEntries.map((entry) => [entry.ticker, entry.logoMeta]));
            draw();
        };

        draw();
        void prepareLogos();

        const observer = new ResizeObserver(() => {
            draw();
        });

        observer.observe(container);

        return () => {
            destroyed = true;
            observer.disconnect();
            tooltipSelection.remove();
            svg.selectAll('*').remove();
        };
    }, [data, groups, height, sectorColorMap]);

    return (
        <div ref={chartContainerRef} className={className ?? 'relative w-full rounded-xl bg-white p-4 shadow-sm'}>
            <svg ref={svgRef} role="img" aria-label="ETF holdings treemap" />
        </div>
    );
}
