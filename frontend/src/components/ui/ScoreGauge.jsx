"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated arc dial gauge showing the authenticity score (0–100).
 * Green (real) → Amber (suspicious) → Red (fake).
 */
export default function ScoreGauge({ score = 0, size = 220, strokeWidth = 14 }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const canvasRef = useRef(null);

  // Animate score on mount
  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 1200;

    function animate(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(score * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  // Draw the gauge
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2 + 10;
    const radius = (size - strokeWidth * 2) / 2 - 5;
    const startAngle = Math.PI * 0.8;
    const endAngle = Math.PI * 2.2;
    const totalArc = endAngle - startAngle;
    const scoreAngle = startAngle + (animatedScore / 100) * totalArc;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = "rgba(150, 150, 150, 0.15)";
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    // Score arc with gradient
    if (animatedScore > 0) {
      const gradient = ctx.createConicGradient(startAngle, cx, cy);
      gradient.addColorStop(0, "#E24B4A");      // red
      gradient.addColorStop(0.35, "#BA7517");    // amber
      gradient.addColorStop(0.65, "#639922");    // green
      gradient.addColorStop(1, "#4a8c1a");       // deep green

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, scoreAngle);
      ctx.strokeStyle = getScoreColor(animatedScore);
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.stroke();

      // Glow effect
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, scoreAngle);
      ctx.strokeStyle = getScoreColor(animatedScore) + "40";
      ctx.lineWidth = strokeWidth + 8;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Score text
    ctx.fillStyle = getScoreColor(animatedScore);
    ctx.font = `bold ${size * 0.22}px 'Newsreader', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(animatedScore.toString(), cx, cy - 8);

    // Label
    ctx.fillStyle = "rgba(150, 150, 150, 0.7)";
    ctx.font = `500 ${size * 0.065}px 'Work Sans', sans-serif`;
    ctx.fillText("AUTHENTICITY SCORE", cx, cy + size * 0.16);
  }, [animatedScore, size, strokeWidth]);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="drop-shadow-lg"
      />
    </div>
  );
}

function getScoreColor(score) {
  if (score >= 70) return "#639922";
  if (score >= 40) return "#BA7517";
  return "#E24B4A";
}
