/**
 * NodeProgressPanel — Mini React Flow graph showing real tree topology.
 * Uses the SAME node components as the main editor (TreeNodes.tsx)
 * with overlay styling for active/visited/pending state.
 * Active node pulses and viewport zooms to center it.
 */

import React, { useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "./TreeNodes";
import type { TreeNodeData, TreeEdgeData } from "../types";

interface NodeProgressPanelProps {
  nodes: TreeNodeData[];
  edges: TreeEdgeData[];
  rootNodeId: string;
  activeNodeId: string | null;
  visitedNodeIds: Set<string>;
  /** Increments each time the surrounding layout finishes a transition (e.g. weights collapse/expand) */
  layoutEpoch?: number;
}

/* ── inner component (needs ReactFlowProvider) ────────────── */
const NodeProgressInner: React.FC<NodeProgressPanelProps> = ({
  nodes: treeNodes,
  edges: treeEdges,
  activeNodeId,
  visitedNodeIds,
  layoutEpoch = 0,
}) => {
  const { setCenter, fitView } = useReactFlow();
  const prevActiveNodeId = useRef<string | null>(null);  // always start null to detect first node
  const pendingInitialZoom = useRef(false);

  /** Serialise visitedNodeIds so useMemo doesn't stale-close over the Set ref */
  const visitedKey = useMemo(() => [...visitedNodeIds].sort().join(","), [visitedNodeIds]);

  /* Convert tree data → React Flow nodes with full data (same as editor) */
  const rfNodes: Node[] = useMemo(() => {
    const visited = new Set(visitedKey.split(",").filter(Boolean));
    return treeNodes.map((n) => {
      const isActive = n.id === activeNodeId;
      const isVisited = visited.has(n.id);
      const isPending = !isActive && !isVisited;

      return {
        id: n.id,
        type: n.type,             // "input" | "decision" | "action" | "assumption" — maps to nodeTypes
        position: n.position,
        selected: isActive,       // highlights the node using the selected style in TreeNodes
        data: {
          ...n,                   // full node data — label, prompt, choices, condition, template, etc.
        },
        draggable: false,
        selectable: false,
        connectable: false,
        // Apply opacity for pending nodes via className
        className: isPending ? "progress-node-pending" : isVisited && !isActive ? "progress-node-visited" : isActive ? "progress-node-active" : "",
        style: {
          opacity: isPending ? 0.25 : 1,
          transition: "opacity 0.6s ease, filter 0.6s ease",
          filter: isPending ? "saturate(0.3)" : "none",
          pointerEvents: "none" as const,
        },
      };
    });
  }, [treeNodes, activeNodeId, visitedKey]);

  const rfEdges: Edge[] = useMemo(() => {
    const visited = new Set(visitedKey.split(",").filter(Boolean));
    return treeEdges.map((e) => {
      const sourceVisited = visited.has(e.source);
      const targetVisited = visited.has(e.target) || e.target === activeNodeId;
      const edgeActive = sourceVisited && targetVisited;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
        type: "default",
        animated: e.target === activeNodeId,
        style: {
          stroke: edgeActive
            ? "rgba(74,222,128,0.6)"
            : "rgba(100,150,200,0.15)",
          strokeWidth: edgeActive ? 2 : 1,
          transition: "stroke 0.6s ease, stroke-width 0.6s ease",
        },
        labelStyle: {
          fontSize: 9,
          fill: edgeActive ? "rgba(200,220,240,0.7)" : "rgba(200,210,230,0.25)",
          fontFamily: "-apple-system, sans-serif",
        },
        labelBgStyle: {
          fill: "rgba(10,15,25,0.85)",
          fillOpacity: 0.85,
        },
      };
    });
  }, [treeEdges, activeNodeId, visitedKey]);

  /* Zoom to the active node only when activeNodeId actually changes */
  useEffect(() => {
    const prev = prevActiveNodeId.current;
    prevActiveNodeId.current = activeNodeId;

    // Only act on actual node transitions
    if (prev === activeNodeId) return;
    if (!activeNodeId) return;

    if (prev === null) {
      // First node of a run — defer zoom until layout settles (weights collapse)
      pendingInitialZoom.current = true;
      return;
    }

    // Subsequent node transitions: zoom directly
    const node = treeNodes.find((n) => n.id === activeNodeId);
    if (!node) return;
    const t = setTimeout(() => {
      setCenter(node.position.x + 100, node.position.y + 40, {
        zoom: 1.4,
        duration: 800,
      });
    }, 150);
    return () => clearTimeout(t);
  }, [activeNodeId, treeNodes, setCenter]);

  /* After any layout transition (weights collapse/expand), re-zoom to active node */
  useEffect(() => {
    if (!activeNodeId) return;
    const node = treeNodes.find((n) => n.id === activeNodeId);
    if (!node) return;

    if (pendingInitialZoom.current) {
      // Initial zoom after first weights collapse
      pendingInitialZoom.current = false;
      const t = setTimeout(() => {
        fitView({ padding: 0.2, duration: 400 });
        setTimeout(() => {
          setCenter(node.position.x + 100, node.position.y + 40, {
            zoom: 1.4,
            duration: 800,
          });
        }, 500);
      }, 50);
      return () => clearTimeout(t);
    }

    // Re-zoom after any subsequent layout change
    const t = setTimeout(() => {
      setCenter(node.position.x + 100, node.position.y + 40, {
        zoom: 1.4,
        duration: 600,
      });
    }, 100);
    return () => clearTimeout(t);
    // layoutEpoch is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutEpoch]);

  return (
    <>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        panOnScroll={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
        minZoom={0.15}
        maxZoom={3}
      />
      <style>{`
        /* Active node glow overlay */
        .progress-node-active .react-flow__node {
          animation: progressNodePulse 2s ease-in-out infinite;
        }
        @keyframes progressNodePulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(78,168,222,0.4)); }
          50% { filter: drop-shadow(0 0 24px rgba(78,168,222,0.7)); }
        }
        /* Visited node green tint on border */
        .progress-node-visited > div {
          border-color: rgba(74,222,128,0.6) !important;
          box-shadow: 0 0 10px rgba(74,222,128,0.15) !important;
        }
        /* Hide React Flow background */
        .react-flow__background { display: none; }
      `}</style>
    </>
  );
};

/* ── exported wrapper with its own ReactFlowProvider ──────── */
export const NodeProgressPanel: React.FC<NodeProgressPanelProps> = (props) => (
  <ReactFlowProvider>
    <div style={{ width: "100%", height: "100%" }}>
      <NodeProgressInner {...props} />
    </div>
  </ReactFlowProvider>
);
