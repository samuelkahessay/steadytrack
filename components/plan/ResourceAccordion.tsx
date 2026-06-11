'use client';

import { useState } from 'react';
import { ChevronRight, ExternalLink, CheckCircle2, Circle, Video, FileText as FileTextIcon, Newspaper, Edit3, BookOpen, GraduationCap, FlaskConical, Star, ClipboardList, BarChart3, Link2 } from 'lucide-react';
import { CurriculumResource } from '@/lib/types';
import { cleanResourceTitle } from '@/lib/utils/title';

interface ResourceAccordionProps {
  resources: CurriculumResource[];
  completedResourceUrls: Set<string>;
  onResourceToggle: (resourceUrl: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function ResourceAccordion({
  resources,
  completedResourceUrls,
  onResourceToggle,
  isOpen: controlledIsOpen,
  onToggle,
}: ResourceAccordionProps) {
  // Auto-expand on mobile by default (if not controlled from parent)
  const [internalIsOpen, setInternalIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640; // Auto-expand on mobile
    }
    return false;
  });

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  if (!resources || resources.length === 0) {
    return null;
  }

  const completedCount = resources.filter((r) => completedResourceUrls.has(r.url)).length;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  const getResourceIcon = (type: string) => {
    const iconClass = "w-3.5 h-3.5 text-gray-500";

    switch (type) {
      case 'video':
        return <Video className={iconClass} />;
      case 'pdf':
        return <FileTextIcon className={iconClass} />;
      case 'article':
        return <Newspaper className={iconClass} />;
      case 'practice':
        return <Edit3 className={iconClass} />;
      case 'reference':
        return <BookOpen className={iconClass} />;
      case 'course':
        return <GraduationCap className={iconClass} />;
      case 'virtual-lab':
        return <FlaskConical className={iconClass} />;
      case 'exemplars':
        return <Star className={iconClass} />;
      case 'rubric':
        return <ClipboardList className={iconClass} />;
      case 'data-booklet':
        return <BarChart3 className={iconClass} />;
      default:
        return <Link2 className={iconClass} />;
    }
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 py-3 px-2 -mx-2 w-full text-left rounded-lg text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors min-h-[44px]"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Collapse resources' : 'Expand resources'}
      >
        <ChevronRight
          className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
        />
        <span className="flex-1 font-medium">
          Resources {completedCount > 0 && `(${completedCount}/${resources.length})`}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1 pl-2 border-l-2 border-gray-200">
          {resources.map((resource) => {
            const isCompleted = completedResourceUrls.has(resource.url);
            return (
              <div
                key={resource.url}
                className="flex items-center gap-3 py-2 group rounded-md hover:bg-gray-50"
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onResourceToggle(resource.url);
                  }}
                  className="flex-shrink-0 p-2 -m-1 hover:scale-110 active:scale-95 transition-transform"
                  aria-label={isCompleted ? 'Mark resource as incomplete' : 'Mark resource as complete'}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300" />
                  )}
                </button>
                <div className="flex-shrink-0">
                  {getResourceIcon(resource.type)}
                </div>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    // Auto-check when a resource link is opened
                    if (!isCompleted) {
                      onResourceToggle(resource.url);
                    }
                  }}
                  className={`flex-1 text-sm py-2 ${
                    isCompleted ? 'text-green-600 opacity-60' : 'text-gray-700'
                  } hover:text-blue-600 active:text-blue-700 transition-colors truncate`}
                >
                  {cleanResourceTitle(resource.title, resource.url)}
                </a>
                <ExternalLink className="w-4 h-4 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-gray-400 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
