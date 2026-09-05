import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  variant?: 'text' | 'card' | 'circle';
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  borderRadius,
  className = '',
  style,
}: SkeletonProps) {
  const variantClass =
    variant === 'circle'
      ? styles.circle
      : variant === 'card'
      ? styles.card
      : styles.text;

  const customStyle: CSSProperties = {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(borderRadius !== undefined ? { borderRadius } : {}),
    ...style,
  };

  return (
    <div
      className={`${styles.skeleton} ${variantClass} ${className}`}
      style={customStyle}
    />
  );
}

export function SkeletonCard() {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      <Skeleton variant="card" height={180} />
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Skeleton variant="text" width="70%" height={24} />
        <Skeleton variant="text" width="40%" height={16} />
        <Skeleton variant="text" width="100%" height={40} />
      </div>
    </div>
  );
}
