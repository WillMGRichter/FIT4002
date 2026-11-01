import React from 'react';
import styles from '../../ProjectDesigner.module.css';
import type { ElementProps } from '../../../types/simulation';
import type { CanvasElement } from '../types';

interface SliderFieldsProps {
  elem: CanvasElement;
  updateElementProps: (elemId: string, props: Partial<ElementProps>) => void;
}

/** Step / min / max fields for a slider (range) input. */
export const SliderFields: React.FC<SliderFieldsProps> = ({ elem, updateElementProps }) => {
  return (
    <>
      <div className={styles.propRow}>
        <label>Step Size</label>
        <input 
        type="text"
        placeholder='1'
        value={elem.props.stepSize ?? ''}
        onChange={e => updateElementProps(elem.id, { stepSize: e.target.value})}
        className={styles.propInput}/>
      </div>
      <div className={styles.propRow}>
        <label>Min</label>
        <input 
        type="text"
        placeholder='0'
        value={elem.props.min ?? ''}
        onChange={e => updateElementProps(elem.id, { min: e.target.value})}
        className={styles.propInput}/>
      </div>
      <div className={styles.propRow}>
        <label>Max</label>
        <input 
        type="text"
        placeholder='10'
        value={elem.props.max ?? ''}
        onChange={e => updateElementProps(elem.id, { max: e.target.value})}
        className={styles.propInput}/>
      </div>
    </>
  );
};
