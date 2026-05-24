import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#9CA3AF',
  border: '1.5px solid #fff',
};

export const CircleNode: React.FC<NodeProps> = ({ selected }) => (
  <div style={{
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#fff',
    border: `2px solid ${selected ? '#2563EB' : '#374151'}`,
    boxShadow: selected ? '0 0 0 3px rgba(37,99,235,0.2)' : 'none',
    position: 'relative',
  }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <Handle type="source" position={Position.Bottom} style={handleStyle} />
    <Handle type="source" position={Position.Left} style={handleStyle} id="left" />
    <Handle type="source" position={Position.Right} style={handleStyle} id="right" />
  </div>
);

export const DiamondNode: React.FC<NodeProps> = ({ selected }) => (
  <div style={{ width: 72, height: 72, position: 'relative' }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <Handle type="source" position={Position.Bottom} style={handleStyle} />
    <Handle type="source" position={Position.Left} style={handleStyle} id="left" />
    <Handle type="source" position={Position.Right} style={handleStyle} id="right" />
    {/* Border layer */}
    <div style={{
      position: 'absolute',
      inset: 0,
      clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
      background: selected ? '#2563EB' : '#374151',
    }} />
    {/* Fill layer */}
    <div style={{
      position: 'absolute',
      inset: 3,
      clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
      background: '#fff',
    }} />
  </div>
);

export const RoundedRectNode: React.FC<NodeProps> = ({ selected }) => (
  <div style={{
    width: 110,
    height: 44,
    borderRadius: 14,
    background: '#fff',
    border: `2px solid ${selected ? '#2563EB' : '#374151'}`,
    boxShadow: selected ? '0 0 0 3px rgba(37,99,235,0.2)' : 'none',
    position: 'relative',
  }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <Handle type="source" position={Position.Bottom} style={handleStyle} />
    <Handle type="source" position={Position.Left} style={handleStyle} id="left" />
    <Handle type="source" position={Position.Right} style={handleStyle} id="right" />
  </div>
);

// ── Output nodes ─────────────────────────────────────────────────────────────

const OutputShell: React.FC<{ selected: boolean; icon: React.ReactNode; label: string }> = ({
  selected,
  icon,
  label,
}) => (
  <div style={{
    width: 110,
    height: 80,
    borderRadius: 8,
    background: '#fff',
    border: `2px solid ${selected ? '#2563EB' : '#E5E7EB'}`,
    boxShadow: selected
      ? '0 0 0 3px rgba(37,99,235,0.2)'
      : '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 10,
    color: '#6B7280',
    position: 'relative',
  }}>
    {icon}
    <span>{label}</span>
  </div>
);

export const BarChartNode: React.FC<NodeProps> = ({ selected }) => (
  <div style={{ position: 'relative' }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <OutputShell selected={!!selected} label="Bar Chart" icon={
      <svg width="36" height="26" viewBox="0 0 36 26" fill="none">
        <rect x="2" y="14" width="8" height="10" rx="1" fill="#9CA3AF" />
        <rect x="14" y="6" width="8" height="18" rx="1" fill="#6B7280" />
        <rect x="26" y="10" width="8" height="14" rx="1" fill="#9CA3AF" />
      </svg>
    } />
    <Handle type="source" position={Position.Bottom} style={handleStyle} />
  </div>
);

export const PieChartNode: React.FC<NodeProps> = ({ selected }) => (
  <div style={{ position: 'relative' }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <OutputShell selected={!!selected} label="Pie Chart" icon={
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M16 16 L16 2 A14 14 0 0 1 30 16 Z" fill="#374151" />
        <path d="M16 16 L30 16 A14 14 0 0 1 9 28 Z" fill="#9CA3AF" />
        <path d="M16 16 L9 28 A14 14 0 0 1 16 2 Z" fill="#D1D5DB" />
      </svg>
    } />
    <Handle type="source" position={Position.Bottom} style={handleStyle} />
  </div>
);

export const HBarChartNode: React.FC<NodeProps> = ({ selected }) => (
  <div style={{ position: 'relative' }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <OutputShell selected={!!selected} label="H-Bar Chart" icon={
      <svg width="36" height="26" viewBox="0 0 36 26" fill="none">
        <rect x="2" y="3" width="22" height="5" rx="1" fill="#6B7280" />
        <rect x="2" y="11" width="14" height="5" rx="1" fill="#9CA3AF" />
        <rect x="2" y="19" width="28" height="5" rx="1" fill="#6B7280" />
      </svg>
    } />
    <Handle type="source" position={Position.Bottom} style={handleStyle} />
  </div>
);

export const TrendLineNode: React.FC<NodeProps> = ({ selected }) => (
  <div style={{ position: 'relative' }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <OutputShell selected={!!selected} label="Trend Line" icon={
      <svg width="36" height="26" viewBox="0 0 36 26" fill="none">
        <polyline
          points="2,22 8,16 16,18 24,9 32,4"
          stroke="#6B7280"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="4" r="2.5" fill="#6B7280" />
      </svg>
    } />
    <Handle type="source" position={Position.Bottom} style={handleStyle} />
  </div>
);
