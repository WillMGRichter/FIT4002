import type { ElementProps } from '../../types/simulation';

export type ElementType = 'text' | 'input-field' | 'output-field' | 'image';

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  props: ElementProps;
}

export interface Page {
  id: string;
  name: string;
  sort_order: number;
  elements: CanvasElement[];
}

/** A page as stored by the API: `elements` can be null on rows that were never edited. */
export type ServerPage = Omit<Page, 'elements'> & { elements: CanvasElement[] | null };
