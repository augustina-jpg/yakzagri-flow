"use client";

import React from "react";
import { t as translateCopy } from "@/lib/i18n";

export interface RepScoreRingProps {
  score: number;
  maxScore?: number;
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
}

const SIZE_CONFIG = {
  sm: { svgSize: 64, strokeWidth: 5, radius: 26, fontSize: "text-sm", labelSize: "text-xs" },
  md: { svgSize: 96, strokeWidth: 7, radius: 38, fontSize: "text-base", labelSize: "text-xs" },
  lg: { svgSize: 128, strokeWidth: 8, radius: 52, fontSize: "text-xl", labelSize: "text-sm" },
  xl: { svgSize: 160, strokeWidth: 10, radius: 64, fontSize: "text-2xl", labelSize: "text-sm" },
} as const;

export function RepScoreRing({
  score,
  maxScore = 5,
  size = "md",
  animated = true,
}: RepScoreRingProps) {
  const clampedScore = Math.min(Math.max(score, 0), maxScore);
  const { svgSize, strokeWidth, radius, labelSize } = SIZE_CONFIG[size];

  const circumference = 2 * Math.PI * radius;
  const fillRatio = clampedScore / maxScore;
  const dashOffset = circumference * (1 - fillRatio);
  const center = svgSize / 2;

  const scoreDisplay = clampedScore % 1 === 0
    ? clampedScore.toFixed(0)
    : clampedScore.toFixed(1);

  return (
    <div
      className="inline-flex flex-col items-center gap-1"
      role="img"
      aria-label={translateCopy("ui.trustScoreOutOfMax", { score: scoreDisplay, maxScore })}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="gold-emerald-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--gold)" />
            <stop offset="100%" stopColor="var(--emerald)" />
          </linearGradient>
        </defs>

        {/* Track (background ring) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth={strokeWidth}
        />

        {/* Active arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#gold-emerald-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          className={
            animated
              ? "motion-safe:transition-all motion-safe:duration-1000 motion-reduce:transition-none"
              : undefined
          }
          style={{ strokeDashoffset: dashOffset }}
        />

        {/* Score text — centered */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-primary)"
          fontSize={SIZE_CONFIG[size].svgSize * 0.24}
          fontWeight="700"
          fontFamily="var(--font-geist-sans), Geist, ui-sans-serif, system-ui, sans-serif"
        >
          {scoreDisplay}
        </text>
      </svg>

      <span className={`${labelSize} text-text-secondary font-medium`}>
        {translateCopy("ui.trust_score_2c7902e")}
      </span>
      <span className={`${labelSize} text-text-secondary`}>
        / {maxScore}
      </span>
    </div>
  );
}

export default RepScoreRing;
