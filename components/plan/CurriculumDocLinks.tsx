'use client';

import { useState, useEffect } from 'react';
import { FileText, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { get, set } from '@/lib/storage/local';

interface CurriculumDoc {
  title: string;
  url: string;
  type?: string;
}

interface SubjectDocs {
  subject: string;
  docs: CurriculumDoc[];
}

interface CurriculumDocLinksProps {
  subjectDocs: SubjectDocs[];
}

const STORAGE_KEY = 'steadytrack_curriculum_docs_expanded';

export default function CurriculumDocLinks({ subjectDocs }: CurriculumDocLinksProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = get<string | null>(STORAGE_KEY, null);
    if (stored !== null) {
      setIsExpanded(stored === 'true');
    }
  }, []);

  // Save state to localStorage
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    set(STORAGE_KEY, String(newState));
  };

  if (!subjectDocs || subjectDocs.length === 0) return null;

  const getDocLabel = (type?: string) => {
    switch (type) {
      case 'reference':
        return 'Program of Studies';
      case 'data-booklet':
        return 'Data Booklet';
      case 'rubric':
        return 'Scoring Guide';
      case 'exemplars':
        return 'Student Exemplars';
      default:
        return 'Reference';
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-start gap-2 text-left hover:opacity-80 transition-opacity"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse curriculum documents' : 'Expand curriculum documents'}
      >
        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileText className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900">
            Official Alberta Curriculum Documents
          </h3>
          <p className="text-xs text-blue-700 mt-0.5">
            Reference materials from Alberta Education
          </p>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-blue-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-blue-600" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {subjectDocs.map((subjectDoc) => (
            <div key={subjectDoc.subject}>
              {/* Subject header - only show if there are multiple subjects */}
              {subjectDocs.length > 1 && (
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  {subjectDoc.subject}
                </h4>
              )}
              <div className="space-y-2">
                {subjectDoc.docs.map((doc) => (
                  <a
                    key={doc.url}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-blue-50 border border-blue-200 rounded-md transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                        {doc.title}
                      </p>
                      {doc.type && (
                        <p className="text-xs text-gray-500">
                          {getDocLabel(doc.type)}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-blue-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          ))}

          <p className="text-xs text-gray-600 italic">
            These official documents show exactly what&apos;s tested on Alberta diploma exams.
          </p>
        </div>
      )}
    </div>
  );
}
