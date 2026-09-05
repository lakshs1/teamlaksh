import { useId } from 'react';
import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled = false, className = '' }: ToggleProps) {
  const id = useId();

  return (
    <div className={`${styles.wrapper} ${className}`}>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`${styles.track} ${checked ? styles.active : ''} ${disabled ? styles.disabled : ''}`}
        onClick={() => onChange(!checked)}
        type="button"
      >
        <span className={styles.thumb} />
      </button>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
    </div>
  );
}
