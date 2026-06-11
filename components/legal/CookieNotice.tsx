'use client';

import { useEffect, useState } from 'react';
import { get, set } from '@/lib/storage/local';

const STORAGE_KEY = 'steadytrack_cookie_notice_dismissed_v1';

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = get<string | null>(STORAGE_KEY, null);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    set(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-50 p-4 md:p-6"
    >
      <div className="mx-auto max-w-4xl rounded-lg border border-gray-200 bg-white shadow-lg p-4 md:p-6">
        <p className="text-sm text-gray-700 mb-4">
          We use localStorage to save your study progress locally and anonymized analytics to
          improve SteadyTrack. No account needed - your data stays on your device.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={dismiss}
            className="w-full inline-flex items-center justify-center text-sm font-medium rounded-md bg-blue-600 text-white px-6 py-2.5 hover:bg-blue-700 transition-colors shadow-sm hover:shadow min-h-[44px]"
            aria-label="Dismiss cookie notice"
          >
            Got it
          </button>
          <a
            href="/privacy"
            className="w-full inline-flex items-center justify-center text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2.5 rounded-md hover:bg-gray-100 transition-colors min-h-[44px]"
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
  );
}

