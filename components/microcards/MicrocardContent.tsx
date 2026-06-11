'use client';

import { ExternalLink } from 'lucide-react';
import type { ContentMicrocard } from '@/lib/types';

interface MicrocardContentProps {
  microcard: ContentMicrocard;
}

export default function MicrocardContent({ microcard }: MicrocardContentProps) {
  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-lg">📖</span>
          <h3 className="font-semibold text-blue-900">Summary</h3>
        </div>
        <p className="text-gray-700 leading-relaxed">{microcard.summary}</p>
      </div>

      {/* Steps Section */}
      {microcard.steps && microcard.steps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🪜</span>
            <h3 className="font-semibold text-gray-900">Steps to Master This</h3>
          </div>
          <ol className="space-y-2">
            {microcard.steps.map((step: string, index: number) => (
              <li key={index} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </span>
                <span className="text-gray-700 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Pitfall Section */}
      {microcard.pitfall && (
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-lg">⚠️</span>
            <h3 className="font-semibold text-amber-900">Common Pitfall</h3>
          </div>
          <p className="text-gray-700">{microcard.pitfall}</p>
        </div>
      )}

      {/* Recommended Resource */}
      {microcard.recommended_resource_url && (
        <div className="pt-2">
          <a
            href={microcard.recommended_resource_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
          >
            <span>📚 Learn more about this concept</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}
