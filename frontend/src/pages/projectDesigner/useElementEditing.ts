import { useCallback } from 'react';
import type React from 'react';
import type { ElementProps } from '../../types/simulation';
import type { CanvasElement, ElementType, Page } from './types';
import { ELEMENT_PALETTE, newElemId } from './elementPalette';

interface UseElementEditingArgs {
  setPages: React.Dispatch<React.SetStateAction<Page[]>>;
  activePageIdx: number;
  activePage: Page | undefined;
  activeElements: CanvasElement[];
  selectedElem: CanvasElement | undefined;
  setSelectedElemId: (id: string | null) => void;
}

/** Actions that change the elements on the active page: add, edit properties/position/size, delete, image upload. */
export function useElementEditing({
  setPages, activePageIdx, activePage, activeElements, selectedElem, setSelectedElemId,
}: UseElementEditingArgs) {
  const addElement = (type: ElementType) => {
    if (!activePage) return;
    const paletteItem = ELEMENT_PALETTE.find(e => e.type === type);
    const newElem: CanvasElement = {
      id: newElemId(),
      type,
      x: 40 + (activeElements.length * 20),
      y: 40 + (activeElements.length * 20),
      w: type === 'text' ? 200 : type === 'image' ? 300 : 220,
      h: type === 'image' ? 180 : (type === 'input-field' || type === 'output-field') ? 64 : 48,
      props: { ...(paletteItem?.defaultProps || {}) },
    };
    const newElements = [...activeElements, newElem];
    updateActivePageElements(newElements);
    setSelectedElemId(newElem.id);
  };

  const updateActivePageElements = useCallback((elements: CanvasElement[]) => {
    setPages(prev => prev.map((p, i) => i === activePageIdx ? { ...p, elements } : p));
  }, [activePageIdx, setPages]);

  const updateElementProps = useCallback((elemId: string, props: Partial<ElementProps>) => {
    setPages(prev => {
      const page = prev[activePageIdx];
      if (!page) return prev;
      const newElements = page.elements.map(e => e.id === elemId ? { ...e, props: { ...e.props, ...props } } : e);
      return prev.map((p, i) => i === activePageIdx ? { ...p, elements: newElements } : p);
    });
  }, [activePageIdx, setPages]);

  const updateElementPosition = useCallback((elemId: string, x: number, y: number) => {
    setPages(prev => {
      const page = prev[activePageIdx];
      if (!page) return prev;
      const newElements = page.elements.map(e => e.id === elemId ? { ...e, x, y } : e);
      return prev.map((p, i) => i === activePageIdx ? { ...p, elements: newElements } : p);
    });
  }, [activePageIdx, setPages]);

  const updateElementSize = useCallback((elemId: string, w: number, h: number) => {
    setPages(prev => {
      const page = prev[activePageIdx];
      if (!page) return prev;
      const newElements = page.elements.map(e => e.id === elemId ? { ...e, w: Math.max(40, w), h: Math.max(24, h) } : e);
      return prev.map((p, i) => i === activePageIdx ? { ...p, elements: newElements } : p);
    });
  }, [activePageIdx, setPages]);

  const deleteElement = useCallback((elemId: string) => {
    setPages(prev => {
      const page = prev[activePageIdx];
      if (!page) return prev;
      const newElements = page.elements.filter(e => e.id !== elemId);
      return prev.map((p, i) => i === activePageIdx ? { ...p, elements: newElements } : p);
    });
    setSelectedElemId(null);
  }, [activePageIdx, setPages, setSelectedElemId]);

  // Reads a picked image file, downscales it on a canvas (max 1280px) and stores the result
  // as a compressed data URL in the element's src so it persists with the page's JSONB.
  const handleImageUpload = (file: File) => {
    if (!selectedElem || selectedElem.type !== 'image') return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement('img');
      img.onload = () => {
        const MAX = 1280;
        let width = img.width;
        let height = img.height;
        if (width > MAX || height > MAX) {
          const scale = Math.min(MAX / width, MAX / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        updateElementProps(selectedElem.id, { src: canvas.toDataURL('image/jpeg', 0.85) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return { addElement, updateElementProps, updateElementPosition, updateElementSize, deleteElement, handleImageUpload };
}
