'use client';

import * as React from 'react';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/textfield/outlined-text-field.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'filled' | 'outlined';
  label?: string;
  supportingText?: string;
  error?: boolean;
  errorText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    variant = 'outlined', 
    label, 
    supportingText, 
    error, 
    errorText, 
    className, 
    disabled,
    ...props 
  }, forwardedRef) => {
    const Tag = variant === 'filled' ? 'md-filled-text-field' : 'md-outlined-text-field';
    const ref = React.useRef<HTMLInputElement | null>(null);
    React.useImperativeHandle(forwardedRef, () => ref.current as HTMLInputElement);

    const displayText = error && errorText ? errorText : supportingText;

    return React.createElement(Tag as any, {
      ref,
      label,
      supportingText: displayText,
      error,
      disabled,
      className,
      ...props
    });
  },
);
Input.displayName = 'Input';
