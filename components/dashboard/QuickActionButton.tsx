'use client';

import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface QuickActionButtonProps extends Omit<ButtonProps, 'variant'> {
  variant?: 'primary' | 'warning' | 'danger' | 'success';
  pulse?: boolean;
  href?: string;
}

export default function QuickActionButton({
  variant = 'primary',
  pulse = false,
  href,
  className,
  children,
  ...props
}: QuickActionButtonProps) {
  const router = useRouter();
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    warning: 'bg-orange-600 hover:bg-orange-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (href) router.push(href);
    props.onClick?.(e);
  };

  return (
    <Button
      className={cn(
        'relative font-semibold shadow-lg transition-all duration-200',
        variantStyles[variant],
        pulse && 'animate-pulse',
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Button>
  );
}
