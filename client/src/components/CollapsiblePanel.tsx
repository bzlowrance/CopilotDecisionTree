/**
 * CollapsiblePanel — A resizable, collapsible side panel with drag handle.
 * Used in TreeRunner for weights and node progress panels.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";

interface CollapsiblePanelProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  side: "left" | "right";
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  defaultCollapsed?: boolean;
  /** When true, the body has no padding and overflow:hidden — useful for embedded canvases */
  noPadding?: boolean;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  icon,
  children,
  side,
  defaultWidth = 320,
  minWidth = 200,
  maxWidth = 600,
  defaultCollapsed = false,
  noPadding = false,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
    },
    [width]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = side === "left"
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      setWidth(newWidth);
    };
    const onMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [side, minWidth, maxWidth]);

  const collapsedWidth = 36;

  return (
    <div
      style={{
        width: collapsed ? collapsedWidth : width,
        minWidth: collapsed ? collapsedWidth : minWidth,
        transition: isDragging.current ? "none" : "width 0.3s ease",
        display: "flex",
        flexDirection: side === "left" ? "row" : "row-reverse",
        position: "relative",
        borderLeft: side === "right" ? "1px solid rgba(100,150,200,0.15)" : "none",
        borderRight: side === "left" ? "1px solid rgba(100,150,200,0.15)" : "none",
      }}
    >
      {/* Collapse toggle strip */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: collapsedWidth,
          minWidth: collapsedWidth,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          background: "rgba(15,20,35,0.6)",
          borderRight: side === "left" && !collapsed ? "1px solid rgba(100,150,200,0.08)" : "none",
          borderLeft: side === "right" && !collapsed ? "1px solid rgba(100,150,200,0.08)" : "none",
          userSelect: "none",
        }}
        title={collapsed ? `Show ${title}` : `Hide ${title}`}
      >
        <span style={{ fontSize: 14, marginBottom: 4 }}>{icon}</span>
        <span
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            fontSize: 10,
            color: "rgba(200,210,230,0.5)",
            letterSpacing: 1,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "rgba(200,210,230,0.3)",
            marginTop: 6,
          }}
        >
          {collapsed
            ? side === "left" ? "▶" : "◀"
            : side === "left" ? "◀" : "▶"}
        </span>
      </div>

      {/* Content */}
      {!collapsed && (
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid rgba(100,150,200,0.1)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 13 }}>{icon}</span>
            <h3 style={{ fontSize: 12, color: "#e0e8f0", margin: 0, fontWeight: 600 }}>
              {title}
            </h3>
          </div>
          {/* Body */}
          <div style={{ flex: 1, overflow: noPadding ? "hidden" : "auto", padding: noPadding ? 0 : 12 }}>
            {children}
          </div>
        </div>
      )}

      {/* Resize drag handle */}
      {!collapsed && (
        <div
          onMouseDown={onMouseDown}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 5,
            cursor: "col-resize",
            [side === "left" ? "right" : "left"]: -3,
            zIndex: 10,
            background: isDragging.current
              ? "rgba(70,200,255,0.3)"
              : "transparent",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background =
              "rgba(70,200,255,0.2)";
          }}
          onMouseLeave={(e) => {
            if (!isDragging.current)
              (e.currentTarget as HTMLDivElement).style.background =
                "transparent";
          }}
        />
      )}
    </div>
  );
};
