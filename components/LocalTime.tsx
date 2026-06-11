'use client';

import * as React from 'react';

type Props = {
  value: string | Date;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
};

export default function LocalTime({ value, options, className }: Props) {
  const [text, setText] = React.useState<string>('');

  React.useEffect(() => {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) {
      setText('');
      return;
    }
    setText(d.toLocaleString(undefined, options));
  }, [value, options]);

  const dateTime = typeof value === 'string' ? value : value.toISOString();

  return (
    <time dateTime={dateTime} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}

