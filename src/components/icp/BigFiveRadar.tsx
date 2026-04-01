"use client";

import { useMemo } from "react";

interface BigFiveData {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface BigFiveRadarProps {
  data: BigFiveData;
  overlay?: BigFiveData;
  size?: number;
}

const LABELS = [
  { key: "openness" as const, label: "Abertura" },
  { key: "conscientiousness" as const, label: "Conscienciosidade" },
  { key: "extraversion" as const, label: "Extroversao" },
  { key: "agreeableness" as const, label: "Amabilidade" },
  { key: "neuroticism" as const, label: "Neuroticismo" },
];

const ANGLE_OFFSET = -Math.PI / 2; // Start from top

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  total: number
): [number, number] {
  const angle = ANGLE_OFFSET + (2 * Math.PI * index) / total;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function buildPolygon(
  cx: number,
  cy: number,
  radius: number,
  data: BigFiveData
): string {
  return LABELS.map((l, i) => {
    const value = Math.max(0, Math.min(100, data[l.key]));
    const r = (value / 100) * radius;
    const [x, y] = polarToCartesian(cx, cy, r, i, 5);
    return `${x},${y}`;
  }).join(" ");
}

export function BigFiveRadar({ data, overlay, size = 250 }: BigFiveRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const labelRadius = radius + 18;

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const gridLines = useMemo(
    () =>
      gridLevels.map((level) => {
        const r = radius * level;
        return LABELS.map((_, i) => {
          const [x, y] = polarToCartesian(cx, cy, r, i, 5);
          return `${x},${y}`;
        }).join(" ");
      }),
    [cx, cy, radius]
  );

  const axisLines = useMemo(
    () =>
      LABELS.map((_, i) => {
        const [x, y] = polarToCartesian(cx, cy, radius, i, 5);
        return { x1: cx, y1: cy, x2: x, y2: y };
      }),
    [cx, cy, radius]
  );

  const labelPositions = useMemo(
    () =>
      LABELS.map((l, i) => {
        const [x, y] = polarToCartesian(cx, cy, labelRadius, i, 5);
        return { ...l, x, y, value: data[l.key] };
      }),
    [cx, cy, labelRadius, data]
  );

  const primaryPolygon = useMemo(() => buildPolygon(cx, cy, radius, data), [cx, cy, radius, data]);
  const overlayPolygon = useMemo(
    () => (overlay ? buildPolygon(cx, cy, radius, overlay) : null),
    [cx, cy, radius, overlay]
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="select-none"
    >
      {/* Grid polygons */}
      {gridLines.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={0.5}
        />
      ))}

      {/* Axis lines */}
      {axisLines.map((line, i) => (
        <line
          key={i}
          {...line}
          stroke="var(--border-subtle)"
          strokeWidth={0.5}
        />
      ))}

      {/* Overlay polygon (ICP template) */}
      {overlayPolygon && (
        <polygon
          points={overlayPolygon}
          fill="var(--accent-muted)"
          stroke="var(--text-muted)"
          strokeWidth={1}
          strokeDasharray="4 2"
          opacity={0.5}
        />
      )}

      {/* Primary polygon */}
      <polygon
        points={primaryPolygon}
        fill="var(--accent-muted)"
        stroke="var(--accent)"
        strokeWidth={1.5}
        opacity={0.85}
      />

      {/* Data points */}
      {LABELS.map((l, i) => {
        const value = Math.max(0, Math.min(100, data[l.key]));
        const r = (value / 100) * radius;
        const [x, y] = polarToCartesian(cx, cy, r, i, 5);
        return (
          <circle
            key={l.key}
            cx={x}
            cy={y}
            r={3}
            fill="var(--accent)"
            stroke="var(--bg-card)"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Labels */}
      {labelPositions.map((l) => (
        <text
          key={l.key}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--text-muted)"
          fontSize={10}
          fontFamily="inherit"
        >
          <tspan x={l.x} dy={-6}>
            {l.label}
          </tspan>
          <tspan
            x={l.x}
            dy={13}
            fill="var(--text-primary)"
            fontWeight={600}
            fontSize={11}
          >
            {Math.round(l.value)}
          </tspan>
        </text>
      ))}
    </svg>
  );
}
