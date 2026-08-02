"use client";

import { useTranslations } from "next-intl";

interface ChartPoint {
  month: string;
  forecast: string;
  received: string;
}

const BAR_GAP = 4;

export function ForecastReceivedChart({ data }: { data: ChartPoint[] }) {
  const t = useTranslations("financial.overview.chart");
  const max = Math.max(
    1,
    ...data.flatMap((point) => [Number(point.forecast), Number(point.received)])
  );
  const width = 640;
  const height = 240;
  const labelSpace = 44;
  const plotWidth = width - labelSpace;
  const groupWidth = plotWidth / Math.max(1, data.length);
  const barWidth = Math.max(4, groupWidth / 2 - BAR_GAP);

  return (
    <figure className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t("ariaLabel", { firstMonth: data[0]?.month ?? "", lastMonth: data[data.length - 1]?.month ?? "" })}
        className="h-56 w-full min-w-[560px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = labelSpace + (height - labelSpace) * ratio;
          return (
            <line
              key={ratio}
              x1={labelSpace}
              y1={y}
              x2={width}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
          );
        })}
        {data.map((point, index) => {
          const centerX = labelSpace + groupWidth * index + groupWidth / 2;
          const forecastHeight = (Number(point.forecast) / max) * (height - labelSpace);
          const receivedHeight = (Number(point.received) / max) * (height - labelSpace);
          return (
            <g key={point.month}>
              <rect
                x={centerX - barWidth - 1}
                y={height - forecastHeight}
                width={barWidth}
                height={forecastHeight}
                fill="var(--color-accent)"
              >
                <title>{t("forecastTitle", { month: point.month, value: point.forecast })}</title>
              </rect>
              <rect
                x={centerX + 1}
                y={height - receivedHeight}
                width={barWidth}
                height={receivedHeight}
                fill="var(--color-success)"
              >
                <title>{t("receivedTitle", { month: point.month, value: point.received })}</title>
              </rect>
              <text
                x={centerX}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-text-secondary)"
              >
                {point.month}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden="true" /> {t("forecast")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success" aria-hidden="true" /> {t("received")}
        </span>
      </figcaption>
    </figure>
  );
}
