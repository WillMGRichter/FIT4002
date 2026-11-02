import React from 'react';
import { Upload, X } from 'lucide-react';
import styles from '../../ProjectDesigner.module.css';
import type { ElementProps } from '../../../types/simulation';
import type { CanvasElement } from '../types';

interface ImageSectionProps {
  elem: CanvasElement;
  updateElementProps: (elemId: string, props: Partial<ElementProps>) => void;
  onImageUpload: (file: File) => void;
}

/** Image URL, "upload from device" and remove controls for an image element. */
export const ImageSection: React.FC<ImageSectionProps> = ({ elem, updateElementProps, onImageUpload }) => {
  return (
    <div className={styles.propsSection}>
      <div className={styles.propsSectionTitle}>Image</div>
      <div className={styles.propRow}>
        <label>Image URL</label>
        <input type="text" value={elem.props.src || ''} onChange={e => updateElementProps(elem.id, { src: e.target.value })} className={styles.propInput} />
      </div>
      <div className={styles.propRow}>
        <label>Upload from device</label>
        <label className={styles.uploadBtn}>
          <Upload size={14} /> Choose Image
          <input type="file" accept="image/*" hidden onChange={e => {
            const file = e.target.files?.[0];
            if (file) onImageUpload(file);
            e.target.value = '';
          }} />
        </label>
      </div>
      {elem.props.src && String(elem.props.src).startsWith('data:') && (
        <div>
          <div className={styles.uploadPreview}>
            <img src={elem.props.src} alt="" />
          </div>
          <button className={styles.removeImgBtn} onClick={() => updateElementProps(elem.id, { src: '' })}>
            <X size={12} /> Remove image
          </button>
        </div>
      )}
    </div>
  );
};
