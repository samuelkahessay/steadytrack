'use client';

import { FileText, ExternalLink, CheckCircle } from 'lucide-react';

interface CurriculumDoc {
  title: string;
  url: string;
  type?: string;
}

interface CurriculumPanelProps {
  subject: string;
  docs?: CurriculumDoc[];
  totalOutcomes?: number;
}

export default function CurriculumPanel({
  docs,
  totalOutcomes,
}: CurriculumPanelProps) {
  if (!docs || docs.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="flex items-start gap-2 mb-3">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Aligned with Alberta Education
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            Based on official curriculum documents
          </p>
        </div>
      </div>

      {/* Quick links to docs */}
      <div className="space-y-1.5">
        {docs.slice(0, 2).map((doc, index) => (
          <a
            key={index}
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()} // Prevent card click navigation
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors group"
          >
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 truncate">{doc.title}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
        {docs.length > 2 && (
          <p className="text-xs text-gray-500 px-2">
            +{docs.length - 2} more document{docs.length - 2 > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {totalOutcomes && totalOutcomes > 0 && (
        <p className="text-xs text-gray-500 mt-3 px-2">
          Covers {totalOutcomes} curriculum outcomes
        </p>
      )}
    </div>
  );
}
