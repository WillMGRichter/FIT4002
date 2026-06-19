import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styles from './CanvasPlayground.module.css';
import { CanvasSidebar, type SidebarSection } from '../components/canvas/CanvasSidebar';
import {
  CircleNode,
  DiamondNode,
  RoundedRectNode,
  BarChartNode,
  PieChartNode,
  HBarChartNode,
  TrendLineNode,
} from '../components/canvas/shapeNodes';

// ── Sidebar shape previews ────────────────────────────────────────────────────

const CirclePreview = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <circle cx="18" cy="18" r="15" stroke="#374151" strokeWidth="2" fill="white" />
  </svg>
);

const DiamondPreview = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <polygon points="18,3 33,18 18,33 3,18" stroke="#374151" strokeWidth="2" fill="white" />
  </svg>
);

const RoundedRectPreview = () => (
  <svg width="48" height="30" viewBox="0 0 48 30" fill="none">
    <rect x="2" y="2" width="44" height="26" rx="9" stroke="#374151" strokeWidth="2" fill="white" />
  </svg>
);

const BarChartPreview = () => (
  <svg width="34" height="28" viewBox="0 0 34 28" fill="none">
    <rect x="2" y="14" width="8" height="12" rx="1" fill="#374151" />
    <rect x="13" y="6" width="8" height="20" rx="1" fill="#374151" />
    <rect x="24" y="10" width="8" height="16" rx="1" fill="#374151" />
  </svg>
);

const PieChartPreview = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M16 16 L16 2 A14 14 0 0 1 30 16 Z" fill="#374151" />
    <path d="M16 16 L30 16 A14 14 0 0 1 9 28 Z" fill="#6B7280" />
    <path d="M16 16 L9 28 A14 14 0 0 1 16 2 Z" fill="#D1D5DB" />
  </svg>
);

const HBarPreview = () => (
  <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
    <rect x="2" y="3" width="22" height="6" rx="1" fill="#374151" />
    <rect x="2" y="12" width="14" height="6" rx="1" fill="#6B7280" />
    <rect x="2" y="21" width="28" height="6" rx="1" fill="#374151" />
  </svg>
);

const TrendPreview = () => (
  <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
    <polyline
      points="2,24 8,17 16,19 24,10 32,4"
      stroke="#374151"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="32" cy="4" r="2.5" fill="#374151" />
  </svg>
);

// ── Node types — must be defined outside the component for stability ──────────

const NODE_TYPES = {
  circle: CircleNode,
  diamond: DiamondNode,
  roundedRect: RoundedRectNode,
  barChart: BarChartNode,
  pieChart: PieChartNode,
  hBarChart: HBarChartNode,
  trendLine: TrendLineNode,
};

// ── Default sidebar configuration ─────────────────────────────────────────────

const DEFAULT_SECTIONS: SidebarSection[] = [
  {
    title: 'Inputs',
    layout: 'list',
    items: [
      { type: 'circle',      label: 'Circle',       preview: <CirclePreview /> },
      { type: 'diamond',     label: 'Diamond',      preview: <DiamondPreview /> },
      { type: 'roundedRect', label: 'Rounded Rect', preview: <RoundedRectPreview /> },
    ],
  },
  {
    title: 'Outputs',
    layout: 'grid',
    items: [
      { type: 'barChart',  label: 'Bar Chart',   preview: <BarChartPreview /> },
      { type: 'pieChart',  label: 'Pie Chart',   preview: <PieChartPreview /> },
      { type: 'hBarChart', label: 'H-Bar Chart', preview: <HBarPreview /> },
      { type: 'trendLine', label: 'Trend Line',  preview: <TrendPreview /> },
    ],
  },
];

let _id = 0;
const nextId = () => `node_${++_id}`;

// ── Inner canvas — must live inside ReactFlowProvider ─────────────────────────

const CanvasInner: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode: Node = {
        id: nextId(),
        type,
        position,
        data: {},
      };
      setNodes(nds => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  return (
    <div className={styles.layout}>
      <CanvasSidebar sections={DEFAULT_SECTIONS} />

      <div className={styles.canvasColumn}>
        {/* ── Toolbar ── */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <button className={styles.toolBtn} title="Undo" disabled>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 6H10a4 4 0 010 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.5 4L3.5 6l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className={styles.toolBtn} title="Redo" disabled>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M12.5 6H6a4 4 0 000 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.5 4l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <span className={styles.toolbarTitle}>Canvas Playground</span>

          <div className={styles.toolbarGroup}>
            <button className={styles.toolBtn} title="Save">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M12 14H4a1 1 0 01-1-1V3a1 1 0 011-1h6.5L13 4.5V13a1 1 0 01-1 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M5 14v-4h6v4M9.5 2v3H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className={styles.toolBtn} title="Export">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 10V2M8 2l3 3M8 2L5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 11v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── ReactFlow canvas ── */}
        <div
          ref={wrapperRef}
          className={styles.flowArea}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={NODE_TYPES}
            deleteKeyCode="Delete"
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#D1D5DB" />
            <Controls />
            <MiniMap nodeStrokeWidth={3} zoomable pannable />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

// ── Exported page ─────────────────────────────────────────────────────────────

export const CanvasPlayground: React.FC = () => (
  <ReactFlowProvider>
    <CanvasInner />
  </ReactFlowProvider>
);
