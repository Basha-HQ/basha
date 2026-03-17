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
}

const sizeConfig = {
  sm: { fontSize: '13px', padding: '10px 20px', borderRadius: '100px' },
  md: { fontSize: '16px', padding: '16px 32px', borderRadius: '100px' },
  lg: { fontSize: '18px', padding: '20px 44px', borderRadius: '100px' },
};

export const StardustButton = ({
  children = 'Get started',
  onClick,
  className = '',
  size = 'md',
  accentColor = '#f59e0b',
  href,
  inactive = false,
  ...props
}: StardustButtonProps) => {
  const { fontSize, padding, borderRadius } = sizeConfig[size];

  // Convert hex to rgba components for glow effects
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '245, 158, 11';
  };

  const rgb = hexToRgb(accentColor);

  const buttonStyle: React.CSSProperties = {
    outline: 'none',
    cursor: 'pointer',
    border: 0,
    position: 'relative',
    borderRadius,
    backgroundColor: '#07071a',
    transition: 'all 0.2s ease',
    display: 'inline-block',
    textDecoration: 'none',
    opacity: inactive ? 0.45 : 1,
    boxShadow: inactive
      ? `inset 0 0.3rem 0.9rem rgba(255,255,255,0.05),
         inset 0 -0.1rem 0.3rem rgba(0,0,0,0.7),
         0 2px 8px rgba(0,0,0,0.4)`
      : `inset 0 0.3rem 0.9rem rgba(${rgb},0.25),
         inset 0 -0.1rem 0.3rem rgba(0,0,0,0.7),
         inset 0 -0.4rem 0.9rem rgba(${rgb},0.4),
         0 3rem 3rem rgba(0,0,0,0.3),
         0 1rem 1rem -0.6rem rgba(0,0,0,0.8)`,
  };

  const wrapStyle: React.CSSProperties = {
    fontSize,
    fontWeight: 600,
    color: inactive ? 'rgba(255,255,255,0.35)' : `rgba(${rgb}, 0.95)`,
    padding,
    borderRadius: 'inherit',
    position: 'relative',
    overflow: 'hidden',
  };

  const pStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: 0,
    transition: 'all 0.2s ease',
    transform: 'translateY(2%)',
    maskImage: `linear-gradient(to bottom, rgba(${rgb},1) 40%, transparent)`,
    WebkitMaskImage: `linear-gradient(to bottom, rgba(${rgb},1) 40%, transparent)`,
    whiteSpace: 'nowrap' as const,
  };

  const uid = React.useId().replace(/:/g, '');

  const css = `
    .stardust-${uid} .sd-wrap::before,
    .stardust-${uid} .sd-wrap::after {
      content: "";
      position: absolute;
      transition: all 0.3s ease;
    }
    .stardust-${uid} .sd-wrap::before {
      left: -15%; right: -15%; bottom: 25%; top: -100%;
      border-radius: 50%;
      background-color: rgba(${rgb}, 0.12);
    }
    .stardust-${uid} .sd-wrap::after {
      left: 6%; right: 6%; top: 12%; bottom: 40%;
      border-radius: 22px 22px 0 0;
      box-shadow: inset 0 10px 8px -10px rgba(${rgb}, 0.5);
      background: linear-gradient(180deg, rgba(${rgb},0.2) 0%, transparent 50%);
    }
    .stardust-${uid} .sd-wrap .sd-star-default { display: inline; }
    .stardust-${uid} .sd-wrap .sd-star-hover   { display: none; }
    .stardust-${uid}:hover .sd-wrap .sd-star-default { display: none; }
    .stardust-${uid}:hover .sd-wrap .sd-star-hover   { display: inline; }
    .stardust-${uid}:hover {
      box-shadow:
        inset 0 0.3rem 0.5rem rgba(${rgb},0.35),
        inset 0 -0.1rem 0.3rem rgba(0,0,0,0.7),
        inset 0 -0.4rem 0.9rem rgba(${rgb},0.55),
        0 3rem 3rem rgba(0,0,0,0.3),
        0 1rem 1rem -0.6rem rgba(0,0,0,0.8);
    }
    .stardust-${uid}:hover .sd-wrap::before { transform: translateY(-5%); }
    .stardust-${uid}:hover .sd-wrap::after  { opacity: 0.4; transform: translateY(5%); }
    .stardust-${uid}:hover .sd-wrap .sd-p   { transform: translateY(-4%); }
    .stardust-${uid}:active {
      transform: translateY(3px);
      box-shadow:
        inset 0 0.3rem 0.5rem rgba(${rgb},0.45),
        inset 0 -0.1rem 0.3rem rgba(0,0,0,0.8),
        inset 0 -0.4rem 0.9rem rgba(${rgb},0.35),
        0 1rem 1rem rgba(0,0,0,0.2);
    }
  `;

  const inner = (
    <>
      <style>{css}</style>
      <div className="sd-wrap" style={wrapStyle}>
        <p className="sd-p" style={pStyle}>
          <span className="sd-star-default">✧</span>
          <span className="sd-star-hover">✦</span>
          {children}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={`stardust-${uid} ${className}`}
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
      className={`stardust-${uid} ${className}`}
      style={buttonStyle}
      onClick={onClick}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {inner}
    </button>
  );
};
