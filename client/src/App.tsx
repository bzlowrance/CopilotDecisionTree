/**
 * App — Main application component.
 *
 * Layout:
 * ┌──────────┬───────────────────────────────┐
 * │ Sidebar  │  React Flow Canvas            │
 * │          │  (Tree visual editor)         │
 * │  Trees   │                               │
 * │  Nodes   │                               │
 * │          │                               │
 * │  [Run]   │                               │
 * └──────────┴───────────────────────────────┘
 *
 * When "Run" is clicked, the TreeRunner overlay opens
 * with the chat interface + Westworld radar chart.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  type Node,
  type Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  type Connection,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import "./overrides.css";
import dagre from "dagre";

import { Sidebar } from "./components/Sidebar";
import { NodeEditor } from "./components/NodeEditor";
import { nodeTypes } from "./components/TreeNodes";
import { TreeRunner } from "./components/TreeRunner";
import { PipelineRunner } from "./components/PipelineRunner";
import type { DecisionTree, NodeType, TreeNodeData, WeightDimension } from "./types";
import * as api from "./api";
import { getTreeWeights } from "./weight-utils";

// ─── Helpers ────────────────────────────────────────────────

const NODE_WIDTH = 280;
const NODE_HEIGHT = 180;

/**
 * Auto-layout using dagre in left-to-right (LR) mode.
 * Linear chains flow horizontally; branches spread vertically at splits.
 * fitView is called after to fill the viewport.
 */
function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  // Count max outgoing edges from any single node (branching factor)
  const outDeg = edges.reduce<Record<string, number>>((acc, e) => {
    acc[e.source] = (acc[e.source] ?? 0) + 1;
    return acc;
  }, {});
  const maxFanOut = Math.max(...Object.values(outDeg).concat(1));

  // Adaptive spacing: more nodes → tighter fit
  const nodeCount = nodes.length;
  const ranksep = nodeCount > 30 ? 120 : nodeCount > 15 ? 160 : 200;
  const nodesep = Math.max(30, 20 + maxFanOut * 15);

  g.setGraph({ rankdir: "LR", ranksep, nodesep, edgesep: 20, marginx: 30, marginy: 30 });

  nodes.forEach((node) => {
    // Use tighter node dimensions so dagre packs nodes closer
    g.setNode(node.id, { width: 200, height: 100 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 100, y: pos.y - 50 },
    };
  });
}

let nodeIdCounter = 1;
function makeNodeId() {
  return `node_${Date.now()}_${nodeIdCounter++}`;
}

function treeNodeToFlowNode(tn: TreeNodeData): Node {
  return {
    id: tn.id,
    type: tn.type,
    position: tn.position,
    data: { ...tn },
  };
}

function flowNodesToTreeNodes(nodes: Node[]): TreeNodeData[] {
  return nodes.map((n) => ({
    ...n.data,
    id: n.id,
    type: n.type as NodeType,
    position: n.position,
  }));
}

// ─── Default template for new nodes ─────────────────────────

function createDefaultNode(type: NodeType, position: { x: number; y: number }): Node {
  const id = makeNodeId();
  const defaults: Record<NodeType, Partial<TreeNodeData>> = {
    input: {
      label: "New Input",
      prompt: "What is your preference?",
      variableName: "userInput",
      inputType: "text",
    },
    assumption: {
      label: "New Assumption",
      assumption: "This assumes a standard environment.",
      variableName: "assumptionConfirmed",
      default: true,
    },
    decision: {
      label: "New Decision",
      condition: "Does the condition hold?",
      evaluateExpression: "{{userInput}}",
    },
    action: {
      label: "New Action",
      actionType: "respond",
      template: "Based on your inputs: {{userInput}}",
    },
  };

  return {
    id,
    type,
    position,
    data: {
      id,
      type,
      label: defaults[type].label,
      ...defaults[type],
    },
  };
}

// ─── App Component ──────────────────────────────────────────

function AppInner() {
  const { fitView } = useReactFlow();
  const [trees, setTrees] = useState<DecisionTree[]>([]);
  const [selectedTree, setSelectedTree] = useState<DecisionTree | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPipeline, setIsPipeline] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layoutModified, setLayoutModified] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;

  // Load trees on mount
  useEffect(() => {
    api.fetchTrees().then(setTrees).catch(console.error);
  }, []);

  // Load tree into editor
  const loadTree = useCallback(
    (tree: DecisionTree) => {
      setSelectedNodeId(null);
      setSelectedTree(tree);
      setLayoutModified(false);

      let flowNodes = tree.nodes.map(treeNodeToFlowNode);
      const flowEdges = tree.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(100,150,200,0.6)" },
        style: { stroke: "rgba(100,150,200,0.5)", strokeWidth: 2 },
        labelStyle: { fill: "#0a1628", fontSize: 12, fontWeight: 600 },
        labelBgStyle: { fill: "rgba(200,215,235,0.92)" },
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 4,
      }));

      // Auto-arrange if user hasn't saved a custom layout
      if (!tree.customLayout && flowNodes.length > 0) {
        flowNodes = autoLayout(flowNodes, flowEdges);
      }

      setNodes(flowNodes);
      setEdges(flowEdges);

      // Fit viewport to show all nodes after render
      setTimeout(() => {
        fitView({ padding: 0.12, duration: 300 });
      }, 80);
    },
    [setNodes, setEdges, fitView]
  );

  // Auto-save changes
  const autoSave = useCallback(() => {
    if (!selectedTree) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      const updated: DecisionTree = {
        ...selectedTree,
        nodes: flowNodesToTreeNodes(nodes),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: typeof e.label === "string" ? e.label : undefined,
        })),
        updatedAt: new Date().toISOString(),
      };
      try {
        await api.saveTree(updated);
        setSelectedTree(updated);
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 1000);
  }, [selectedTree, nodes, edges]);

  useEffect(() => {
    autoSave();
  }, [nodes, edges, selectedTree, autoSave]);

  // Handle new edge connections
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        id: `edge_${Date.now()}`,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(100,150,200,0.6)" },
        style: { stroke: "rgba(100,150,200,0.5)", strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Create new tree
  const handleNewTree = async () => {
    const tree: Partial<DecisionTree> = {
      name: `New Tree ${trees.length + 1}`,
      description: "A new decision tree",
      version: "1.0.0",
      nodes: [],
      edges: [],
      rootNodeId: "",
      tags: ["new"],
    };
    try {
      const created = await api.createTree(tree);
      setTrees((prev) => [...prev, created]);
      loadTree(created);
    } catch (err) {
      console.error("Failed to create tree:", err);
    }
  };

  // Add node to canvas
  const handleAddNode = (type: NodeType) => {
    const position = {
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 200,
    };
    const newNode = createDefaultNode(type, position);
    setNodes((nds) => [...nds, newNode]);

    // If this is the first node and tree has no root, set it
    if (selectedTree && !selectedTree.rootNodeId) {
      setSelectedTree({
        ...selectedTree,
        rootNodeId: newNode.id,
      });
    }
  };

  // ── Node CRUD handlers ──

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleUpdateNodeData = useCallback(
    (id: string, data: Partial<TreeNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, ...data } }
            : n
        )
      );
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      setSelectedNodeId(null);
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      if (selectedTree?.rootNodeId === id) {
        setSelectedTree((prev) => prev ? { ...prev, rootNodeId: "" } : prev);
      }
    },
    [setNodes, setEdges, selectedTree]
  );

  const handleDuplicateNode = useCallback(
    (node: Node) => {
      const newId = makeNodeId();
      const dup: Node = {
        ...node,
        id: newId,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        data: { ...node.data, id: newId, label: `${node.data.label} (copy)` },
        selected: false,
      };
      setNodes((nds) => [...nds, dup]);
      setSelectedNodeId(newId);
    },
    [setNodes]
  );

  const handleSetRoot = useCallback(
    (id: string) => {
      setSelectedTree((prev) => prev ? { ...prev, rootNodeId: id } : prev);
    },
    []
  );

  const handleAutoArrange = useCallback(() => {
    setNodes((nds) => autoLayout(nds, edges));
    // Clear custom layout flag so next load also auto-arranges
    setSelectedTree((prev) => prev ? { ...prev, customLayout: false } : prev);
    setLayoutModified(false);
    setTimeout(() => {
      fitView({ padding: 0.12, duration: 300 });
    }, 80);
  }, [edges, setNodes, fitView]);

  /** Mark layout as user-customised when nodes are dragged */
  const handleNodeDragStop = useCallback(() => {
    setLayoutModified(true);
  }, []);

  /** Persist current positions and flag as custom layout */
  const handleSaveLayout = useCallback(() => {
    setSelectedTree((prev) => prev ? { ...prev, customLayout: true } : prev);
    setLayoutModified(false);
  }, []);

  // ── Weight CRUD handler ──
  // Updates tree.defaultWeights and triggers auto-save.
  // Also cleans up stale references in nodes when dimensions are removed.
  const handleUpdateWeights = useCallback(
    (newWeights: WeightDimension[]) => {
      if (!selectedTree) return;
      const dimIds = new Set(newWeights.map((w) => w.id));

      // Update the tree's defaultWeights
      setSelectedTree((prev) => prev ? { ...prev, defaultWeights: newWeights } : prev);

      // Clean stale references from nodes
      setNodes((nds) =>
        nds.map((n) => {
          const d = n.data as TreeNodeData;
          let changed = false;
          let weightInfluence = d.weightInfluence;
          let weightBias = d.weightBias;

          if (weightInfluence) {
            const cleaned = weightInfluence.filter((wi) => dimIds.has(wi.dimension));
            if (cleaned.length !== weightInfluence.length) {
              weightInfluence = cleaned;
              changed = true;
            }
          }
          if (weightBias) {
            const cleaned = weightBias.filter((wb) => dimIds.has(wb.dimension));
            if (cleaned.length !== weightBias.length) {
              weightBias = cleaned;
              changed = true;
            }
          }

          return changed
            ? { ...n, data: { ...d, weightInfluence, weightBias } }
            : n;
        })
      );
    },
    [selectedTree, setNodes]
  );

  // ── Computed helpers for NodeEditor ──
  const selectedNodeWeightDims = selectedTree ? getTreeWeights(selectedTree) : [];
  const selectedNodeEdgeLabels = selectedNode
    ? edges
        .filter((e) => e.source === selectedNode.id && e.label)
        .map((e) => e.label as string)
    : [];

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#0a0a0f" }}>
      <Sidebar
        trees={trees}
        selectedTree={selectedTree}
        onSelectTree={loadTree}
        onNewTree={handleNewTree}
        onAddNode={handleAddNode}
        onRunTree={() => setIsRunning(true)}
        onRunPipeline={() => setIsPipeline(true)}
        onUpdateWeights={handleUpdateWeights}
      />

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        {selectedTree ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onNodeDragStop={handleNodeDragStop}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            fitView
            style={{ background: "#0a0a0f" }}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: "rgba(100,150,200,0.5)" },
            }}
          >
            <Background color="rgba(100,150,200,0.06)" gap={20} />
            <Controls
              style={{
                background: "rgba(20,30,50,0.8)",
                border: "1px solid rgba(100,150,200,0.2)",
                borderRadius: 6,
              }}
            />
            {/* Auto-Arrange + Save Layout Buttons */}
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 5,
                display: "flex",
                gap: 6,
              }}
            >
              <button
                onClick={handleAutoArrange}
                title="Auto-arrange nodes to fill the workspace"
                style={{
                  padding: "8px 14px",
                  background: "rgba(20,30,50,0.85)",
                  border: "1px solid rgba(100,150,200,0.3)",
                  borderRadius: 6,
                  color: "#c8d6e8",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  backdropFilter: "blur(8px)",
                }}
              >
                <span style={{ fontSize: 14 }}>🔀</span> Auto-Arrange
              </button>
              {layoutModified && (
                <button
                  onClick={handleSaveLayout}
                  title="Save current node positions so they persist on next load"
                  style={{
                    padding: "8px 14px",
                    background: "rgba(74,222,128,0.12)",
                    border: "1px solid rgba(74,222,128,0.4)",
                    borderRadius: 6,
                    color: "#4ade80",
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    backdropFilter: "blur(8px)",
                    animation: "pulse-save 2s ease-in-out infinite",
                  }}
                >
                  <span style={{ fontSize: 14 }}>💾</span> Save Layout
                </button>
              )}
              {selectedTree?.customLayout && !layoutModified && (
                <span
                  style={{
                    padding: "8px 10px",
                    fontSize: 10,
                    color: "rgba(74,222,128,0.5)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  ✓ Custom layout saved
                </span>
              )}
            </div>
            <MiniMap
              nodeColor={(n) => {
                switch (n.type) {
                  case "input": return "#4ea8de";
                  case "assumption": return "#f0c040";
                  case "decision": return "#4ade80";
                  case "action": return "#f87171";
                  default: return "#666";
                }
              }}
              style={{
                background: "rgba(10,10,20,0.9)",
                border: "1px solid rgba(100,150,200,0.15)",
              }}
            />
          </ReactFlow>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 48, opacity: 0.3 }}>🌳</div>
            <p style={{ color: "rgba(200,210,230,0.3)", fontSize: 14 }}>
              Select or create a decision tree to get started
            </p>
          </div>
        )}
      </div>

      {/* Node Properties Panel */}
      {selectedNode && selectedTree && (
        <NodeEditor
          node={selectedNode}
          onUpdate={handleUpdateNodeData}
          onDelete={handleDeleteNode}
          onDuplicate={handleDuplicateNode}
          onSetRoot={handleSetRoot}
          isRoot={selectedTree.rootNodeId === selectedNode.id}
          weightDimensions={selectedNodeWeightDims}
          outgoingEdgeLabels={selectedNodeEdgeLabels}
        />
      )}

      {/* Tree Runner overlay */}
      {isRunning && selectedTree && (
        <TreeRunner tree={selectedTree} onClose={() => setIsRunning(false)} />
      )}

      {/* Pipeline Runner overlay */}
      {isPipeline && selectedTree && (
        <PipelineRunner tree={selectedTree} onClose={() => setIsPipeline(false)} />
      )}
    </div>
  );
}

/** Wrap AppInner in ReactFlowProvider so useReactFlow() works */
export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  );
}
