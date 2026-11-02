import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import styles from '../ProjectDesigner.module.css';
import type { CanvasElement, Page } from './types';

interface UseCanvasGesturesArgs {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  activePageIdx: number;
  setPages: React.Dispatch<React.SetStateAction<Page[]>>;
  setSelectedElemId: (id: string | null) => void;
}

/**
 * Drag-to-move and drag-to-resize for canvas elements, including auto-scrolling the canvas when
 * the pointer is held near its edge. Returns the mousedown handlers to attach to each element.
 *
 * Performance-critical: during a gesture the element's DOM style is written directly (no React
 * state per mouse move) and the final geometry is committed to state once, on mouse up.
 */
export function useCanvasGestures({ canvasRef, activePageIdx, setPages, setSelectedElemId }: UseCanvasGesturesArgs) {
  // offsetX/Y is the grab point expressed relative to the element's own top-left corner, in
  // canvas *content* coordinates (scrollLeft/Top + pointer-in-viewport) rather than raw client
  // pixels - that makes position purely a function of (current scroll, current pointer), so
  // programmatic auto-scroll during a drag (see the edge-pan effect below) moves the element
  // along with the pan for free, with no separate delta bookkeeping needed.
  //
  // NOTE: drag/resize gesture info lives in REFS, not React state. The gesture is started from
  // the mousedown handler which attaches the window mousemove/mouseup listeners synchronously.
  // Driving this through useState instead caused a bug where the first movements were dropped:
  // the listener was only attached by a useEffect that ran *after* a re-render, so the element
  // "didn't move at first, then jumped" once the render finally committed. Using refs means the
  // drag is live on the very next mousemove with no render in between.
  const draggingRef = useRef<{ elemId: string; offsetX: number; offsetY: number; baseX: number; baseY: number } | null>(null);
  const resizingRef = useRef<{ elemId: string; elemX: number; elemY: number; offsetW: number; offsetH: number } | null>(null);
  // Bumped on gesture start/end only, to drive the edge-pan rAF effect (which does need to
  // start/stop with the gesture). Not used for per-frame updates.
  const [gestureActive, setGestureActive] = useState(false);
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Content-space position under the pointer: scroll offset + pointer's offset within the
  // canvas viewport. Unlike raw clientX/Y, this stays correct across programmatic scrolling.
  const contentPointFromClient = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: clientX, y: clientY };
    const rect = canvas.getBoundingClientRect();
    return { x: canvas.scrollLeft + (clientX - rect.left), y: canvas.scrollTop + (clientY - rect.top) };
  }, [canvasRef]);

  // During a drag/resize we mutate the element's DOM style directly instead of calling
  // setState on every mousemove. That avoids re-rendering React 60x/sec (which was slow for
  // image elements with large base64 srcs). The latest geometry is stashed here and committed
  // to React state once, on mouseup.
  const pendingGeomRef = useRef<{ elemId: string; x: number; y: number; w: number; h: number } | null>(null);

  const findElemNode = useCallback((elemId: string): HTMLElement | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.querySelector(`[data-elem-id="${elemId}"]`) as HTMLElement | null;
  }, [canvasRef]);

  const updateDragFromClient = useCallback((clientX: number, clientY: number) => {
    const current = draggingRef.current;
    if (!current) return;
    const point = contentPointFromClient(clientX, clientY);
    const x = Math.max(0, point.x - current.offsetX);
    const y = Math.max(0, point.y - current.offsetY);
    const node = findElemNode(current.elemId);
    if (node) {
      // Move via GPU-composited transform rather than left/top so the browser skips layout on
      // every frame - this is what removes the stutter. The real left/top is committed on drop.
      node.style.transform = `translate(${x - current.baseX}px, ${y - current.baseY}px)`;
      node.style.willChange = 'transform';
      pendingGeomRef.current = { elemId: current.elemId, x, y, w: node.offsetWidth, h: node.offsetHeight };
    }
  }, [findElemNode, contentPointFromClient]);

  const updateResizeFromClient = useCallback((clientX: number, clientY: number) => {
    const current = resizingRef.current;
    if (!current) return;
    const point = contentPointFromClient(clientX, clientY);
    const w = Math.max(40, point.x - current.elemX + current.offsetW);
    const h = Math.max(24, point.y - current.elemY + current.offsetH);
    const node = findElemNode(current.elemId);
    if (node) {
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
      pendingGeomRef.current = { elemId: current.elemId, x: current.elemX, y: current.elemY, w, h };
    }
  }, [findElemNode, contentPointFromClient]);

  // Commit the DOM-only drag/resize geometry back into React state. Called once on mouseup.
  const commitPendingGeom = useCallback(() => {
    const geom = pendingGeomRef.current;
    pendingGeomRef.current = null;
    if (!geom) return;
    // Clear the temporary drag transform so the committed left/top (applied on the next render)
    // isn't stacked on top of a leftover translate. React will set left/top to geom.x/geom.y.
    const node = findElemNode(geom.elemId);
    if (node) {
      node.style.transform = '';
      node.style.willChange = '';
      node.style.left = `${geom.x}px`;
      node.style.top = `${geom.y}px`;
    }
    setPages(prev => {
      const page = prev[activePageIdx];
      if (!page) return prev;
      const newElements = page.elements.map(e =>
        e.id === geom.elemId ? { ...e, x: geom.x, y: geom.y, w: geom.w, h: geom.h } : e
      );
      return prev.map((p, i) => i === activePageIdx ? { ...p, elements: newElements } : p);
    });
  }, [activePageIdx, findElemNode, setPages]);

  // Ends whichever gesture is active: commits geometry, clears the gesture refs, removes the
  // window listeners and stops the edge-pan loop. Stored in a ref so the listeners (attached
  // synchronously on mousedown) can always reference the current teardown.
  const endGestureRef = useRef<() => void>(() => {});

  // Starts a drag or resize. Listeners are attached HERE, synchronously, so the very next
  // mousemove drives the element - no waiting for a React re-render/effect (that delay was the
  // "doesn't move at first, then jumps" bug). No React state changes per frame; only DOM writes.
  const beginGesture = useCallback(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      if (draggingRef.current) updateDragFromClient(e.clientX, e.clientY);
      else if (resizingRef.current) updateResizeFromClient(e.clientX, e.clientY);
    };
    const handleMouseUp = () => endGestureRef.current();

    endGestureRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      commitPendingGeom();
      draggingRef.current = null;
      resizingRef.current = null;
      setGestureActive(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    setGestureActive(true); // only to (re)start the edge-pan rAF effect
  }, [updateDragFromClient, updateResizeFromClient, commitPendingGeom]);

  const handleElemMouseDown = useCallback((e: React.MouseEvent, elem: CanvasElement) => {
    if ((e.target as HTMLElement).closest(`.${styles.resizeHandle}`)) return;
    e.stopPropagation();
    e.preventDefault(); // avoid native image drag-ghost / text selection stealing the gesture
    setSelectedElemId(elem.id);
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    const point = contentPointFromClient(e.clientX, e.clientY);
    resizingRef.current = null;
    draggingRef.current = { elemId: elem.id, offsetX: point.x - elem.x, offsetY: point.y - elem.y, baseX: elem.x, baseY: elem.y };
    beginGesture();
  }, [beginGesture, contentPointFromClient, setSelectedElemId]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, elem: CanvasElement) => {
    e.stopPropagation();
    e.preventDefault();
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    const point = contentPointFromClient(e.clientX, e.clientY);
    draggingRef.current = null;
    resizingRef.current = { elemId: elem.id, elemX: elem.x, elemY: elem.y, offsetW: elem.w - (point.x - elem.x), offsetH: elem.h - (point.y - elem.y) };
    beginGesture();
  }, [beginGesture, contentPointFromClient]);

  // Clean up listeners if the component unmounts mid-gesture.
  useEffect(() => () => endGestureRef.current(), []);

  // Edge auto-pan: while dragging/resizing, holding the pointer near the canvas viewport's
  // border scrolls the canvas toward that border every frame, even without further pointer
  // movement. Position/size are re-derived from (scroll, last known pointer) each tick, so the
  // element keeps growing outward with the pan instead of getting left behind.
  useEffect(() => {
    if (!gestureActive) return;
    const EDGE = 60; // px from viewport edge where panning starts
    const MAX_SPEED = 11; // px scrolled per frame at/past the edge

    const edgePanDelta = (pos: number, min: number, max: number) => {
      if (pos > max - EDGE) return Math.min(MAX_SPEED, ((pos - (max - EDGE)) / EDGE) * MAX_SPEED);
      if (pos < min + EDGE) return -Math.min(MAX_SPEED, (((min + EDGE) - pos) / EDGE) * MAX_SPEED);
      return 0;
    };

    let rafId: number;
    const tick = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const { x: mx, y: my } = mousePosRef.current;
        const dx = edgePanDelta(mx, rect.left, rect.right);
        const dy = edgePanDelta(my, rect.top, rect.bottom);
        if (dx !== 0 || dy !== 0) {
          canvas.scrollLeft += dx;
          canvas.scrollTop += dy;
          if (draggingRef.current) updateDragFromClient(mx, my);
          if (resizingRef.current) updateResizeFromClient(mx, my);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [canvasRef, gestureActive, updateDragFromClient, updateResizeFromClient]);

  return { handleElemMouseDown, handleResizeMouseDown };
}
