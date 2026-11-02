import React from 'react';
import { Type, Image, RectangleHorizontal, ChartBar } from 'lucide-react';
import type { ElementProps } from '../../types/simulation';
import type { ElementType } from './types';

export const newElemId = () => `elem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const ELEMENT_PALETTE: { type: ElementType; label: string; icon: React.ReactNode; defaultProps: ElementProps }[] = [
  { type: 'text', label: 'Text', icon: <Type size={20} />, defaultProps: { content: 'Text', fontSize: 16, color: '#111827', bold: false } },
  { type: 'input-field', label: 'Input', icon: <RectangleHorizontal size={20} />, defaultProps: { cellRef: '', label: 'Input', placeholder: 'Enter value...' } },
  { type: 'output-field', label: 'Output', icon: <ChartBar size={20} />, defaultProps: { cellRef: '', cellRange: '', tableRowHeader: '', tableRows: ['Row 1'], tableColumns: [{ header: 'Column 1', range: '' }], label: 'Output', format: 'number', chartTitle: '', xAxisTitle: '', yAxisTitle: '' } },
  { type: 'image', label: 'Image', icon: <Image size={20} />, defaultProps: { src: 'https://placehold.co/400x200?text=Image', alt: '' } },
];
