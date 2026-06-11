'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface SubjectShareButtonProps {
  subjectName: string;
}

export default function SubjectShareButton({ subjectName }: SubjectShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: subjectName,
      text: `Check out the ${subjectName} curriculum on SteadyTrack`,
      url: window.location.href,
    };

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or error - fall through to clipboard
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback: Copy to clipboard (desktop)
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-semibold border-2 border-gray-200 transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-5 h-5 text-green-600" />
          <span className="text-green-600">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="w-5 h-5" />
          Share
        </>
      )}
    </button>
  );
}
