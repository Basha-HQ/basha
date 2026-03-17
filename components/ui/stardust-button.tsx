'use client';

import React from 'react';

interface StardustButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  accentColor?: string;
  href?: string;
  inactive?: boolean;
  variant?: 'solid' | 'outline';
}

const sizeConfig = {
  sm: { fontSize: '13px', padding: '9px 18px', borderRadius: '10px', fontWeight: 600 },
  md: { fontSize: '15px', padding: '14px 26px', borderRadius: '12px', fontWeight: 700 },
  lg: { fontSize: '17px', padding: '18px 38px', borderRadius: '14px', fontWeight: 700 },
};

// Returns perceived luminance to decide text color (dark on light, light on dark)
const isLightColor = (hex: string): boolean => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return false;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
};

const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '245, 158, 11';
};

export const StardustButton = ({
  children = 'Get started',
  onClick,
  className = '',
  size = 'md',
  accentColor = '#f59e0b',
  href,
  inactive = false,
  variant = 'solid',
  ...props
}: StardustButtonProps) => {
  const { fontSize, padding, borderRadius, fontWeight } = sizeConfig[size];
  const rgb = hexToRgb(accentColor);
  const light = isLightColor(accentColor);
  const textColor = variant === 'outline' ? accentColor : light ? '#07071a' : '#ffffff';

  const solidShadow = `0 2px 12px rgba(${rgb}, 0.45), 0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.18)`;
  const outlineShadow = `0 2px 8px rgba(${rgb}, 0.2), 0 1px 2px rgba(0,0,0,0.15)`;

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    fontSize,
    fontWeight,
    padding,
    borderRadius,
    cursor: inactive ? 'default' : 'pointer',
    border: variant === 'outline' ? `1.5px solid ${accentColor}` : 'none',
    background: variant === 'outline'
      ? 'transparent'
      : `linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.06) 100%), ${accentColor}`,
    color: textColor,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    outline: 'none',
    opacity: inactive ? 0.38 : 1,
    transition: inactive ? 'none' : 'transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease',
    boxShadow: variant === 'outline' ? outlineShadow : solidShadow,
    pointerEvents: inactive ? 'none' : 'auto',
    letterSpacing: '0.01em',
  };

  const uid = React.useId().replace(/:/g, '');

  const hoverCss = inactive ? '' : `
    .basha-btn-${uid}:hover {
      transform: translateY(-1px);
      filter: brightness(1.08);
      box-shadow: ${variant === 'outline'
        ? `0 4px 14px rgba(${rgb}, 0.3), 0 2px 4px rgba(0,0,0,0.15)`
        : `0 4px 18px rgba(${rgb}, 0.6), 0 2px 5px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.22)`};
    }
    .basha-btn-${uid}:active {
      transform: translateY(1px);
      filter: brightness(0.97);
      box-shadow: ${variant === 'outline'
        ? `0 1px 4px rgba(${rgb}, 0.2)`
        : `0 1px 6px rgba(${rgb}, 0.35), inset 0 1px 0 rgba(255,255,255,0.1)`};
    }
  `;

  const inner = (
    <>
      {hoverCss && <style>{hoverCss}</style>}
      {children}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={`basha-btn-${uid} ${className}`}
        style={buttonStyle}
        onClick={onClick}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      className={`basha-btn-${uid} ${className}`}
      style={buttonStyle}
      onClick={onClick}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {inner}
    </button>
  );
};
