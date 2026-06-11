'use client';

import * as React from 'react';

export interface CheckboxProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ id, checked = false, onCheckedChange, disabled = false }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary disabled:opacity-50 cursor-pointer"
    />
  );
}
