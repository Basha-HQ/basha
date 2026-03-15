'use client';

import { ReactNode, CSSProperties } from 'react';
import { useInView } from '@/hooks/useInView';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

export function FadeIn({ children, delay = 0, className = '', style }: FadeInProps) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={className}
      style={{
        ...style,
        opacity: inView ? undefined : 0,
        transform: inView ? undefined : 'translateY(20px)',
        transition: inView
          ? `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`
          : 'none',
        willChange: inView ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}
