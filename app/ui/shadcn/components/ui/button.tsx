"use client";
import * as React from 'react';
// Import Material Web button definitions (custom elements)
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
// Tonal button correct module name is filled-tonal-button in @material/web
import '@material/web/button/filled-tonal-button.js';
import '@material/web/button/text-button.js';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean; // retained for API compatibility (ignored)
}

// Map prior shadcn-style variants to Material 3 button tags
function mapVariantToTag(variant: ButtonProps['variant']): keyof HTMLElementTagNameMap | string {
  switch (variant) {
    case 'outline':
      return 'md-outlined-button';
    case 'secondary':
      return 'md-filled-tonal-button';
    case 'ghost':
    case 'link':
      return 'md-text-button';
    case 'destructive':
      // Use filled button; color will be overridden via style attr (since Material Web doesn't have built-in destructive variant)
      return 'md-filled-button';
    default:
  return 'md-filled-button'; // default / elevated fallback (no separate elevated element in current @material/web)
  }
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', className, children, disabled, ...rest }, forwardedRef) => {
    const Tag = mapVariantToTag(variant) as any;
    const ref = React.useRef<HTMLButtonElement | null>(null);
    React.useImperativeHandle(forwardedRef, () => ref.current as HTMLButtonElement);

    // Size handling via inline styles (Material buttons have fixed height; we can scale density)
    const density = size === 'sm' ? -4 : size === 'lg' ? 2 : 0; // Material density scale approximation

    const style: React.CSSProperties & Record<string, string | number> = {};
    if (variant === 'destructive') {
      style['--md-sys-color-primary'] = 'var(--md-sys-color-error)';
      style['--md-sys-color-on-primary'] = 'var(--md-sys-color-on-error)';
    }

    return (
      <Tag
        ref={ref}
        data-size={size}
        data-variant={variant}
        style={style}
        className={className}
        disabled={disabled}
        {...rest}
        {...(density !== 0 ? { 'data-density': density } : {})}
      >
        {children}
      </Tag>
    );
  },
);
Button.displayName = 'Button';

export const buttonVariants = undefined; // Legacy export placeholder to avoid import breakage
