import { act, renderHook } from '@testing-library/react';
import { useCanvasGestures } from '../useCanvasGestures';

// CanvasElementView is React.memo'd and receives these handlers as props. If their identity changed
// on every render, every element would re-render on every drag frame (the original cause of laggy
// dragging with large base64 images), so the identity must stay stable while the inputs do.
describe('useCanvasGestures', () => {
  const setup = (activePageIdx = 0) => {
    const canvasRef = { current: document.createElement('div') };
    const setPages = jest.fn();
    const setSelectedElemId = jest.fn();
    return renderHook(
      (props: { activePageIdx: number }) =>
        useCanvasGestures({ canvasRef, activePageIdx: props.activePageIdx, setPages, setSelectedElemId }),
      { initialProps: { activePageIdx } },
    );
  };

  it('returns the same handler functions across re-renders when nothing it depends on changed', () => {
    const { result, rerender } = setup();
    const first = result.current;

    rerender({ activePageIdx: 0 });
    rerender({ activePageIdx: 0 });

    expect(result.current.handleElemMouseDown).toBe(first.handleElemMouseDown);
    expect(result.current.handleResizeMouseDown).toBe(first.handleResizeMouseDown);
  });

  it('refreshes the handlers when the active page changes (they commit geometry to that page)', () => {
    const { result, rerender } = setup(0);
    const first = result.current.handleElemMouseDown;

    rerender({ activePageIdx: 1 });

    expect(result.current.handleElemMouseDown).not.toBe(first);
  });

  it('removes its window listeners on unmount, even mid-gesture', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const { result, unmount } = setup();
    const elem = { id: 'e1', type: 'text' as const, x: 0, y: 0, w: 10, h: 10, props: {} };

    act(() => {
      result.current.handleElemMouseDown(
        { target: document.createElement('div'), stopPropagation: jest.fn(), preventDefault: jest.fn(), clientX: 1, clientY: 1 } as never,
        elem,
      );
    });
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    removeSpy.mockRestore();
  });
});
