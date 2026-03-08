/**
 * WeightsRadar — Westworld-inspired interactive radar/polygon chart.
 *
 * Renders decision weight dimensions as an interactive polygon
 * on a dark canvas with glowing edges, pulsing nodes, and
 * draggable handles to adjust each dimension's value.
 *
 * Inspired by the Delos "attribute tablet" from Westworld — the
 * radial interface used to tune host personality attributes.
 */

import React, { useRef, useEffect, useCallback, useState } from "react";
import type { WeightDimension, WeightProfile } from "../types";

interface WeightsRadarProps {
  dimensions: WeightDimension[];
  onChange: (dimensions: WeightDimension[]) => void;
  profiles?: WeightProfile[];
  onProfileSelect?: (profile: WeightProfile) => void;
  size?: number;
  interactive?: boolean;
}

export const WeightsRadar: React.FC<WeightsRadarProps> = ({
  dimensions,
  onChange,
  profiles,
  onProfileSelect,
  size = 380,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const draggingRef = useRef<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const pulseRef = useRef<number>(0);
  const [selectedProfile, setSelectedProfile] = useState<string>("balanced");

  const center = size / 2;
  const maxRadius = size * 0.30;
  const ringCount = 5;

  // Calculate point position for a dimension at a given value
  const getPoint = useCallback(
    (index: number, value: number, total: number) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      const radius = (value / 100) * maxRadius;
      return {
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
      };
    },
    [center, maxRadius]
  );

  // Get value from mouse position for a given dimension index
  const getValueFromMouse = useCallback(
    (mx: number, my: number, index: number, total: number) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      const dx = mx - center;
      const dy = my - center;
      // Project mouse vector onto the dimension axis
      const projection = dx * Math.cos(angle) + dy * Math.sin(angle);
      const value = Math.round(Math.max(0, Math.min(100, (projection / maxRadius) * 100)));
      return value;
    },
    [center, maxRadius]
  );

  // Draw the radar chart
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    pulseRef.current += 0.02;
    const pulse = Math.sin(pulseRef.current) * 0.5 + 0.5;
    const total = dimensions.length;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Background glow
    const bgGrad = ctx.createRadialGradient(center, center, 0, center, center, maxRadius * 1.3);
    bgGrad.addColorStop(0, "rgba(20, 30, 50, 0.8)");
    bgGrad.addColorStop(1, "rgba(5, 5, 15, 0.95)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // Grid rings
    for (let r = 1; r <= ringCount; r++) {
      const radius = (r / ringCount) * maxRadius;
      ctx.beginPath();
      for (let i = 0; i <= total; i++) {
        const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(100, 150, 200, ${r === ringCount ? 0.3 : 0.1})`;
      ctx.lineWidth = r === ringCount ? 1.5 : 0.5;
      ctx.stroke();
    }

    // Axis lines
    for (let i = 0; i < total; i++) {
      const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
      const x = center + maxRadius * Math.cos(angle);
      const y = center + maxRadius * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(x, y);
      ctx.strokeStyle = `rgba(100, 150, 200, 0.15)`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Filled polygon (the "personality shape")
    ctx.beginPath();
    for (let i = 0; i <= total; i++) {
      const idx = i % total;
      const pt = getPoint(idx, dimensions[idx].value, total);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();

    // Fill with gradient
    const fillGrad = ctx.createRadialGradient(center, center, 0, center, center, maxRadius);
    fillGrad.addColorStop(0, "rgba(70, 200, 255, 0.15)");
    fillGrad.addColorStop(1, "rgba(70, 200, 255, 0.05)");
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Glow edge
    ctx.strokeStyle = `rgba(70, 200, 255, ${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(70, 200, 255, 0.6)";
    ctx.shadowBlur = 10 + pulse * 5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Dimension handles and labels
    for (let i = 0; i < total; i++) {
      const dim = dimensions[i];
      const pt = getPoint(i, dim.value, total);
      const labelPt = getPoint(i, 130, total);
      const isHover = hoverRef.current === i;
      const isDrag = draggingRef.current === i;

      // Handle dot
      const handleRadius = isDrag ? 8 : isHover ? 7 : 5;
      const glowAmount = isDrag ? 20 : isHover ? 12 : 6;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = dim.color;
      ctx.shadowColor = dim.color;
      ctx.shadowBlur = glowAmount + pulse * 4;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, handleRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();

      // Label
      ctx.save();
      ctx.font = `${isHover || isDrag ? "bold " : ""}11px -apple-system, sans-serif`;
      ctx.fillStyle = isHover || isDrag ? "#ffffff" : "rgba(200, 210, 230, 0.8)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Icon + label — measure and truncate only if truly needed
      const label = `${dim.icon ?? ""} ${dim.label}`;
      const maxLabelWidth = size * 0.42; // generous: almost half the canvas
      let displayLabel = label;
      while (ctx.measureText(displayLabel).width > maxLabelWidth && displayLabel.length > 3) {
        displayLabel = displayLabel.slice(0, -1);
      }
      if (displayLabel !== label) displayLabel += "…";
      ctx.fillText(displayLabel, labelPt.x, labelPt.y - 7);

      // Value
      ctx.font = `bold 10px monospace`;
      ctx.fillStyle = dim.color;
      ctx.fillText(`${dim.value}`, labelPt.x, labelPt.y + 7);
      ctx.restore();
    }

    // Center decoration - pulsing core
    const coreGrad = ctx.createRadialGradient(center, center, 0, center, center, 12);
    coreGrad.addColorStop(0, `rgba(70, 200, 255, ${0.6 + pulse * 0.4})`);
    coreGrad.addColorStop(1, "rgba(70, 200, 255, 0)");
    ctx.beginPath();
    ctx.arc(center, center, 12, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(center, center, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200, 230, 255, 0.9)";
    ctx.fill();

    animRef.current = requestAnimationFrame(draw);
  }, [dimensions, size, center, maxRadius, getPoint]);

  // Animation loop
  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  // Mouse interaction handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!interactive) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Find closest dimension handle
      for (let i = 0; i < dimensions.length; i++) {
        const pt = getPoint(i, dimensions[i].value, dimensions.length);
        const dist = Math.sqrt((mx - pt.x) ** 2 + (my - pt.y) ** 2);
        if (dist < 15) {
          draggingRef.current = i;
          return;
        }
      }
    },
    [dimensions, getPoint, interactive]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!interactive) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (draggingRef.current !== null) {
        const newValue = getValueFromMouse(mx, my, draggingRef.current, dimensions.length);
        const updated = dimensions.map((d, i) =>
          i === draggingRef.current ? { ...d, value: newValue } : d
        );
        onChange(updated);
        return;
      }

      // Hover detection
      let found = false;
      for (let i = 0; i < dimensions.length; i++) {
        const pt = getPoint(i, dimensions[i].value, dimensions.length);
        const dist = Math.sqrt((mx - pt.x) ** 2 + (my - pt.y) ** 2);
        if (dist < 15) {
          hoverRef.current = i;
          found = true;
          if (canvasRef.current) canvasRef.current.style.cursor = "grab";
          break;
        }
      }
      if (!found) {
        hoverRef.current = null;
        if (canvasRef.current) canvasRef.current.style.cursor = "default";
      }
    },
    [dimensions, getPoint, getValueFromMouse, onChange, interactive]
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {/* Profile selector */}
      {profiles && profiles.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProfile(p.id);
                onProfileSelect?.(p);
              }}
              style={{
                padding: "4px 10px",
                borderRadius: 12,
                border: selectedProfile === p.id ? "1px solid rgba(70,200,255,0.8)" : "1px solid rgba(100,150,200,0.3)",
                background: selectedProfile === p.id ? "rgba(70,200,255,0.15)" : "rgba(20,30,50,0.6)",
                color: selectedProfile === p.id ? "#fff" : "rgba(200,210,230,0.7)",
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              title={p.description}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: 8 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Dimension sliders */}
      {interactive && (
        <div style={{ width: size, flexShrink: 0, padding: "0 8px" }}>
          {dimensions.map((dim, i) => (
            <div key={dim.id} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(200,210,230,0.7)" }}>
                <span>
                  {dim.icon} {dim.label}
                </span>
                <span style={{ color: dim.color, fontWeight: "bold", fontFamily: "monospace" }}>
                  {dim.value}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={dim.value}
                onChange={(e) => {
                  const updated = dimensions.map((d, idx) =>
                    idx === i ? { ...d, value: parseInt(e.target.value) } : d
                  );
                  onChange(updated);
                }}
                style={{
                  width: "100%",
                  accentColor: dim.color,
                  height: 4,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
