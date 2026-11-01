import React from 'react';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from '../ProjectDesigner.module.css';
import type { ElementProps, InputCell, OutputCell } from '../../types/simulation';
import type { CanvasElement } from './types';
import { PositionSizeSection } from './properties/PositionSizeSection';
import { TextSection } from './properties/TextSection';
import { CellBindingSection } from './properties/CellBindingSection';
import { ImageSection } from './properties/ImageSection';

interface PropertiesPanelProps {
  open: boolean;
  onToggle: () => void;
  /** The selected canvas element, or undefined when nothing is selected. */
  selectedElem: CanvasElement | undefined;
  inputCells: InputCell[];
  outputCells: OutputCell[];
  updateElementProps: (elemId: string, props: Partial<ElementProps>) => void;
  updateElementPosition: (elemId: string, x: number, y: number) => void;
  updateElementSize: (elemId: string, w: number, h: number) => void;
  deleteElement: (elemId: string) => void;
  onImageUpload: (file: File) => void;
}

/** Right-hand panel: edits whichever canvas element is selected. */
export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  open, onToggle, selectedElem, inputCells, outputCells,
  updateElementProps, updateElementPosition, updateElementSize, deleteElement, onImageUpload,
}) => {
  return (
    <aside className={`${styles.propsPanel} ${!open ? styles.panelCollapsed : ''}`}>
      <div className={styles.propsTitleRow}>
        {open && <h3 className={styles.propsTitle}>Properties</h3>}
        <button
          className={styles.panelToggleBtn}
          onClick={onToggle}
          title={open ? 'Collapse properties' : 'Expand properties'}
        >
          {open ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
      {open && (
        selectedElem ? (
          <div className={styles.propsContent}>
            <PositionSizeSection
              elem={selectedElem}
              updateElementPosition={updateElementPosition}
              updateElementSize={updateElementSize}
            />

            <div className={styles.divider} />

            {selectedElem.type === 'text' && (
              <TextSection elem={selectedElem} updateElementProps={updateElementProps} />
            )}

            {(selectedElem.type === 'input-field' || selectedElem.type === 'output-field') && (
              <CellBindingSection
                elem={selectedElem}
                inputCells={inputCells}
                outputCells={outputCells}
                updateElementProps={updateElementProps}
              />
            )}

            {selectedElem.type === 'image' && (
              <ImageSection elem={selectedElem} updateElementProps={updateElementProps} onImageUpload={onImageUpload} />
            )}

            <div className={styles.divider} />
            <button className={styles.deleteBtn} onClick={() => deleteElement(selectedElem.id)}>
              <Trash2 size={14} /> Delete element
            </button>
          </div>
        ) : (
          <p className={styles.propsEmpty}>Select an element on the canvas to edit its properties</p>
        )
      )}
    </aside>
  );
};
