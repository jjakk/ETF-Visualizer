import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';

export type BubbleDatum = {
    name: string;
    group: string;
    value: number;
};

type GroupedBubbleChartProps = {
    data: BubbleDatum[];
    height?: number;
    className?: string;
};

type SimulationNode = BubbleDatum & {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
};

const defaultPalette = ['#2563eb', '#059669', '#f59e0b', '#7c3aed', '#ef4444', '#0ea5e9'];

export default function GroupedBubbleChart({ data, height = 560, className }: GroupedBubbleChartProps) {
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

        const draw = () => {
            const width = Math.max(container.clientWidth, 300);
            const horizontalPadding = 80;
            const clusterY = height / 2 + 24;

            svg.selectAll('*').remove();
            svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

            const maxValue = d3.max(data, (item) => item.value) ?? 100;
            const minValue = d3.min(data, (item) => item.value) ?? 0;
            const radiusScale = d3.scaleSqrt().domain([Math.max(0, minValue), maxValue]).range([22, 54]);

            const groupCenters = new Map<string, number>();
            groups.forEach((group, index) => {
                const x =
                    groups.length === 1
                        ? width / 2
                        : horizontalPadding + (index * (width - horizontalPadding * 2)) / (groups.length - 1);
                groupCenters.set(group, x);
            });

            const nodes: SimulationNode[] = data.map((item) => ({
                ...item,
                x: groupCenters.get(item.group) ?? width / 2,
                y: clusterY,
                vx: 0,
                vy: 0,
                r: radiusScale(item.value),
            }));

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
                .attr('y', 56)
                .attr('text-anchor', 'middle')
                .attr('fill', (group: string) => colorScale(group))
                .attr('font-size', 16)
                .attr('font-weight', 700)
                .text((group: string) => group);

            const bubbles = svg.append('g').selectAll('g').data(nodes).enter().append('g');

            bubbles
                .append('circle')
                .attr('r', (node: SimulationNode) => node.r)
                .attr('fill', (node: SimulationNode) => colorScale(node.group))
                .attr('fill-opacity', 0.86)
                .attr('stroke', '#0f172a')
                .attr('stroke-opacity', 0.3)
                .attr('stroke-width', 1.2);

            bubbles
                .append('text')
                .text((node: SimulationNode) => node.name)
                .attr('text-anchor', 'middle')
                .attr('dy', '-0.15em')
                .attr('fill', '#ffffff')
                .attr('font-size', (node: SimulationNode) => Math.max(10, Math.min(14, node.r * 0.38)))
                .attr('font-weight', 700)
                .attr('pointer-events', 'none');

            bubbles
                .append('text')
                .text((node: SimulationNode) => `${node.value}`)
                .attr('text-anchor', 'middle')
                .attr('dy', '1.1em')
                .attr('fill', '#e2e8f0')
                .attr('font-size', 11)
                .attr('font-weight', 500)
                .attr('pointer-events', 'none');

            simulation.on('tick', () => {
                bubbles.attr('transform', (node: SimulationNode) => `translate(${node.x}, ${node.y})`);
            });

            return () => {
                simulation.stop();
            };
        };

        let stopSimulation = draw();
        const observer = new ResizeObserver(() => {
            stopSimulation();
            stopSimulation = draw();
        });

        observer.observe(container);

        return () => {
            observer.disconnect();
            stopSimulation();
            svg.selectAll('*').remove();
        };
    }, [data, groups, height]);

    return (
        <div ref={chartContainerRef} className={className ?? 'w-full rounded-xl bg-white p-4 shadow-sm'}>
            <svg ref={svgRef} role="img" aria-label="Grouped ETF bubble chart" />
        </div>
    );
}
