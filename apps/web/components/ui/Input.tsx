'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, leftIcon, rightSlot, className, inputClassName, id, ...rest },
  ref,
) {
  const inputId = id || rest.name;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-500">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'input',
            leftIcon && 'pl-10',
            rightSlot && 'pr-10',
            error && 'ring-2 ring-red-500/40 focus:ring-red-500',
            inputClassName,
          )}
          {...rest}
        />
        {rightSlot && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-500">
            {rightSlot}
          </div>
        )}
      </div>
      {(error || helper) && (
        <p className={cn('helper', error && 'text-red-400')}>
          {error || helper}
        </p>
      )}
    </div>
  );
});
