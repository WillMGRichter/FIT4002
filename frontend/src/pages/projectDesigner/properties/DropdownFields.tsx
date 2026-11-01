import React from 'react';
import styles from '../../ProjectDesigner.module.css';
import type { ElementProps } from '../../../types/simulation';
import type { CanvasElement } from '../types';

interface DropdownFieldsProps {
  elem: CanvasElement;
  updateElementProps: (elemId: string, props: Partial<ElementProps>) => void;
}

/** Comma-separated options field for a dropdown input. */
export const DropdownFields: React.FC<DropdownFieldsProps> = ({ elem, updateElementProps }) => {
  return (
    <div className={styles.propRow}>
      <label>Options</label>
      <input type="text" value={elem.props.options || ''} onChange={e => updateElementProps(elem.id, { options: e.target.value })} className={styles.propInput} placeholder="Comma-separated" />
    </div>
  );
};
