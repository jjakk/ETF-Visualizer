import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';

export type BubbleDatum = {
    ticker: string;
    companyName?: string;
    group: string;
    value: number;
};

type GroupedBubbleChartProps = {
    data: BubbleDatum[];
    height?: number;
    className?: string;
};

type SimulationNode = BubbleDatum & {
    nodeId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
};

type LogoMeta = {
    isAvailable: boolean;
    averageColor?: string;
};

const defaultPalette = ['#2563eb', '#059669', '#f59e0b', '#7c3aed', '#ef4444', '#0ea5e9'];
const CHART_INNER_PADDING = 16;
const LOGO_BASE_URL = 'https://financialmodelingprep.com/image-stock';

const buildLogoUrl = (ticker: string): string => `${LOGO_BASE_URL}/${encodeURIComponent(ticker.toUpperCase())}.png`;

const sanitizeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '-');

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

export default function GroupedBubbleChart({ data, height = 640, className }: GroupedBubbleChartProps) {
    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

    const groups = useMemo(() => [...new Set(data.map((item) => item.group))], [data]);

    useEffect(() => {
        if (!chartContainerRef.current || !svgRef.current) {
            return;
        }

        const container = chartContainerRef.current;
        const svg = d3.select(svgRef.current);
        const colorScale = d3.scaleOrdinal<string>().domain(groups).range(defaultPalette);
        let destroyed = false;
        let logoMetaByTicker = new Map<string, LogoMeta>();
        let tooltipSelection = d3
            .select(container)
            .selectAll<HTMLDivElement, null>('.bubble-tooltip')
            .data([null])
            .join('div')
            .attr('class', 'bubble-tooltip pointer-events-none absolute z-20 hidden max-w-72 rounded-md border border-slate-200 bg-white/95 p-2 text-xs text-slate-800 shadow-lg backdrop-blur-sm');

        const draw = () => {
            const width = Math.max(container.clientWidth, 300);

            svg.selectAll('*').remove();
            svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

            const maxValue = d3.max(data, (item) => item.value) ?? 100;
            const minValue = d3.min(data, (item) => item.value) ?? 0;
            const radiusScale = d3.scaleSqrt().domain([Math.max(0, minValue), maxValue]).range([22, 54]);
            const maxRadius = d3.max(data, (item) => radiusScale(item.value)) ?? 54;

            const headingY = 40;
            const clusterTopBoundary = headingY + 18 + maxRadius;
            const clusterBottomBoundary = height - CHART_INNER_PADDING - maxRadius;
            const clusterY = (clusterTopBoundary + clusterBottomBoundary) / 2;

            const horizontalPadding = CHART_INNER_PADDING + maxRadius;
            const minX = horizontalPadding;
            const maxX = width - horizontalPadding;
            const minY = clusterTopBoundary;
            const maxY = clusterBottomBoundary;

            const defs = svg.append('defs');

            const groupCenters = new Map<string, number>();
            groups.forEach((group, index) => {
                const x =
                    groups.length === 1
                        ? width / 2
                        : horizontalPadding + (index * (Math.max(width - horizontalPadding * 2, 1))) / (groups.length - 1);
                groupCenters.set(group, x);
            });

            const nodes: SimulationNode[] = data.map((item) => ({
                ...item,
                nodeId: `${sanitizeId(item.ticker)}-${sanitizeId(item.group)}`,
                x: groupCenters.get(item.group) ?? width / 2,
                y: clusterY,
                vx: 0,
                vy: 0,
                r: radiusScale(item.value),
            }));

            const laneGroup = svg.append('g').attr('opacity', 0.18);
            groups.forEach((group, index) => {
                const centerX = groupCenters.get(group) ?? width / 2;
                const prevCenter = index > 0 ? groupCenters.get(groups[index - 1]) ?? minX : minX;
                const nextCenter = index < groups.length - 1 ? groupCenters.get(groups[index + 1]) ?? maxX : maxX;
                const leftX = index === 0 ? minX : (prevCenter + centerX) / 2;
                const rightX = index === groups.length - 1 ? maxX : (centerX + nextCenter) / 2;

                laneGroup
                    .append('rect')
                    .attr('x', leftX)
                    .attr('y', headingY + 8)
                    .attr('width', Math.max(0, rightX - leftX))
                    .attr('height', Math.max(0, maxY - headingY - 8))
                    .attr('fill', colorScale(group));
            });

            svg
                .append('g')
                .attr('opacity', 0.35)
                .selectAll('line')
                .data(groups.slice(0, -1))
                .enter()
                .append('line')
                .attr('x1', (_group, index) => {
                    const currentCenter = groupCenters.get(groups[index]) ?? width / 2;
                    const nextCenter = groupCenters.get(groups[index + 1]) ?? width / 2;
                    return (currentCenter + nextCenter) / 2;
                })
                .attr('x2', (_group, index) => {
                    const currentCenter = groupCenters.get(groups[index]) ?? width / 2;
                    const nextCenter = groupCenters.get(groups[index + 1]) ?? width / 2;
                    return (currentCenter + nextCenter) / 2;
                })
                .attr('y1', headingY + 8)
                .attr('y2', maxY)
                .attr('stroke', '#334155')
                .attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '6 4');

            const clusterForce = (alpha: number) => {
                const strength = 0.42 * alpha;
                nodes.forEach((node) => {
                    const targetX = groupCenters.get(node.group) ?? width / 2;
                    node.vx += (targetX - node.x) * strength;
                    node.vy += (clusterY - node.y) * strength;
                });
            };

            const simulation = d3
                .forceSimulation<SimulationNode>(nodes)
                .force(
                    'x',
                    d3
                        .forceX<SimulationNode>((node: SimulationNode) => groupCenters.get(node.group) ?? width / 2)
                        .strength(0.5)
                )
                .force('y', d3.forceY<SimulationNode>(clusterY).strength(0.4))
                .force('cluster', clusterForce)
                .force('collide', d3.forceCollide<SimulationNode>((node: SimulationNode) => node.r + 1.5).strength(1))
                .alpha(1)
                .alphaDecay(0.03);

            svg
                .append('g')
                .selectAll('text')
                .data(groups)
                .enter()
                .append('text')
                .attr('x', (group: string) => groupCenters.get(group) ?? width / 2)
                .attr('y', headingY)
                .attr('text-anchor', 'middle')
                .attr('fill', (group: string) => colorScale(group))
                .attr('font-size', 15)
                .attr('font-weight', 800)
                .attr('paint-order', 'stroke')
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 3)
                .text((group: string) => group);

            const bubbles = svg.append('g').selectAll('g').data(nodes).enter().append('g');

            const logoBubbles = bubbles.filter(
                (node: SimulationNode) => logoMetaByTicker.get(node.ticker.toUpperCase())?.isAvailable === true
            );
            const nonLogoBubbles = bubbles.filter(
                (node: SimulationNode) => logoMetaByTicker.get(node.ticker.toUpperCase())?.isAvailable !== true
            );

            bubbles
                .append('circle')
                .attr('r', (node: SimulationNode) => node.r)
                .attr('fill', (node: SimulationNode) => d3.color(colorScale(node.group))?.copy({ opacity: 0.28 })?.toString() ?? '#cbd5e1')
                .attr('stroke', '#0f172a')
                .attr('stroke-opacity', 0.35)
                .attr('stroke-width', 1.4);

            logoBubbles
                .append('circle')
                .attr('r', (node: SimulationNode) => node.r * 0.86)
                .attr('fill', (node: SimulationNode) => {
                    const logoMeta = logoMetaByTicker.get(node.ticker.toUpperCase());
                    return logoMeta?.averageColor || colorScale(node.group);
                })
                .attr('fill-opacity', 0.92)
                .attr('stroke', '#ffffff')
                .attr('stroke-opacity', 0.75)
                .attr('stroke-width', 1);

            nodes.forEach((node) => {
                const ticker = node.ticker.toUpperCase();
                if (logoMetaByTicker.get(ticker)?.isAvailable !== true) {
                    return;
                }

                const clipId = `logo-clip-${sanitizeId(node.nodeId)}`;
                defs
                    .append('clipPath')
                    .attr('id', clipId)
                    .append('circle')
                    .attr('r', node.r * 0.76)
                    .attr('cx', 0)
                    .attr('cy', 0);
            });

            logoBubbles
                .append('image')
                .attr('href', (node: SimulationNode) => buildLogoUrl(node.ticker))
                .attr('x', (node: SimulationNode) => -node.r * 0.76)
                .attr('y', (node: SimulationNode) => -node.r * 0.76)
                .attr('width', (node: SimulationNode) => node.r * 1.52)
                .attr('height', (node: SimulationNode) => node.r * 1.52)
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .attr('clip-path', (node: SimulationNode) => `url(#logo-clip-${sanitizeId(node.nodeId)})`)
                .attr('crossorigin', 'anonymous')
                .attr('opacity', 0.98);

            nonLogoBubbles
                .append('text')
                .text((node: SimulationNode) => node.ticker)
                .attr('text-anchor', 'middle')
                .attr('dy', '-0.15em')
                .attr('fill', '#ffffff')
                .attr('font-size', (node: SimulationNode) => Math.max(10, Math.min(14, node.r * 0.38)))
                .attr('font-weight', 700)
                .attr('pointer-events', 'none');

            nonLogoBubbles
                .append('text')
                .text((node: SimulationNode) => `${node.value.toFixed(2)}%`)
                .attr('text-anchor', 'middle')
                .attr('dy', '1.25em')
                .attr('fill', '#f8fafc')
                .attr('font-size', 10)
                .attr('font-weight', 500)
                .attr('pointer-events', 'none');

            bubbles
                .on('mouseenter', (event: MouseEvent, node: SimulationNode) => {
                    tooltipSelection
                        .style('display', 'block')
                        .html(
                            `<div class="mb-1 text-sm font-semibold text-slate-900">${escapeHtml(node.ticker)}</div>` +
                                `<div><span class="font-medium">Name:</span> ${escapeHtml(node.companyName || node.ticker)}</div>` +
                                `<div><span class="font-medium">Sector:</span> ${escapeHtml(node.group)}</div>` +
                                `<div><span class="font-medium">Weight:</span> ${node.value.toFixed(2)}%</div>`
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

            simulation.on('tick', () => {
                nodes.forEach((node) => {
                    node.x = Math.max(minX, Math.min(maxX, node.x));
                    node.y = Math.max(minY, Math.min(maxY, node.y));
                });

                bubbles.attr('transform', (node: SimulationNode) => `translate(${node.x}, ${node.y})`);
            });

            return () => {
                simulation.stop();
            };
        };

        const prepareLogoAvailability = async () => {
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
            stopSimulation();
            stopSimulation = draw();
        };

        let stopSimulation = draw();
        void prepareLogoAvailability();

        const observer = new ResizeObserver(() => {
            stopSimulation();
            stopSimulation = draw();
        });

        observer.observe(container);

        return () => {
            destroyed = true;
            observer.disconnect();
            stopSimulation();
            tooltipSelection.remove();
            svg.selectAll('*').remove();
        };
    }, [data, groups, height]);

    return (
        <div ref={chartContainerRef} className={className ?? 'relative w-full rounded-xl bg-white p-4 shadow-sm'}>
            <svg ref={svgRef} role="img" aria-label="Grouped ETF bubble chart" />
        </div>
    );
}
