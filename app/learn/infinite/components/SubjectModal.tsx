'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (subjects: string[]) => void;
  onResume?: () => Promise<void>;
  availableSubjects: string[];
  hasActiveSession?: boolean;
  isLoadingSubjects?: boolean;
}

export function SubjectModal({
  isOpen,
  onClose,
  onStart,
  onResume,
  availableSubjects,
  hasActiveSession = false,
  isLoadingSubjects = false
}: SubjectModalProps) {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Group subjects by grade
  const subjectsByGrade = useMemo(() => {
    const grade11 = availableSubjects.filter(s => s.includes('20'));
    const grade12 = availableSubjects.filter(s => s.includes('30'));
    return { grade11, grade12 };
  }, [availableSubjects]);

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject)
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  const handleStart = () => {
    if (selectedSubjects.length === 0) {
      alert('Please select at least one subject');
      return;
    }
    onStart(selectedSubjects);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-purple-50 to-blue-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center px-4 py-4 md:py-8">
        <div className="max-w-4xl w-full bg-white rounded-lg shadow-xl p-4 md:p-8 relative">
          {/* Header - Balanced layout */}
          <div className="flex items-center justify-between mb-3 md:mb-6">
            <div className="w-10"></div>
            <div className="text-center flex-1">
              <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-0.5 md:mb-1">
                Quick Learn Mode
              </h1>
              <p className="text-xs md:text-base text-gray-600">
                Select subjects for instant quiz practice
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Resume Session CTA (if available) */}
          {hasActiveSession && onResume && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-900">Continue where you left off</p>
                  <p className="text-sm text-blue-700">You have an active session</p>
                </div>
                <Button
                  variant="outline"
                  onClick={onResume}
                  className="border-blue-300 hover:bg-blue-100"
                >
                  Resume Session
                </Button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoadingSubjects && (
            <div className="mb-6 p-8 bg-gray-50 rounded-lg flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
              <p className="text-gray-600">Loading available subjects...</p>
            </div>
          )}

          {/* Subject Selection */}
          {!isLoadingSubjects && (
            <div className="mb-3 md:mb-6">
              <h2 className="text-base md:text-xl font-semibold text-gray-900 mb-2 md:mb-4">
                Select Subjects
              </h2>

            {/* Grade 11 (20-level) Subjects */}
            {subjectsByGrade.grade11.length > 0 && (
              <div className="mb-3 md:mb-6">
                <h3 className="text-xs md:text-sm font-medium text-gray-700 mb-2">
                  Grade 11 (20-level)
                </h3>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  {subjectsByGrade.grade11.map((subject) => {
                    const isSelected = selectedSubjects.includes(subject);
                    return (
                      <Card
                        key={subject}
                        className={`p-2 md:p-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-500 border-2 bg-purple-50'
                            : 'hover:border-gray-300 border-2 border-transparent'
                        }`}
                        onClick={() => toggleSubject(subject)}
                      >
                        <div className="flex items-center justify-center text-center relative min-h-[32px] md:min-h-[40px]">
                          <p className="text-xs md:text-sm font-medium leading-tight px-1">{subject}</p>
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 text-purple-500 text-sm">✓</span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grade 12 (30-level) Subjects */}
            {subjectsByGrade.grade12.length > 0 && (
              <div>
                <h3 className="text-xs md:text-sm font-medium text-gray-700 mb-2">
                  Grade 12 (30-level)
                </h3>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  {subjectsByGrade.grade12.map((subject) => {
                    const isSelected = selectedSubjects.includes(subject);
                    return (
                      <Card
                        key={subject}
                        className={`p-2 md:p-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-500 border-2 bg-purple-50'
                            : 'hover:border-gray-300 border-2 border-transparent'
                        }`}
                        onClick={() => toggleSubject(subject)}
                      >
                        <div className="flex items-center justify-center text-center relative min-h-[32px] md:min-h-[40px]">
                          <p className="text-xs md:text-sm font-medium leading-tight px-1">{subject}</p>
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 text-purple-500 text-sm">✓</span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

              <p className="text-xs md:text-sm text-gray-500 text-center mt-2 md:mt-4">
                {selectedSubjects.length} / {availableSubjects.length} subjects selected
              </p>
            </div>
          )}

          {/* Start Button */}
          <Button
            onClick={handleStart}
            disabled={selectedSubjects.length === 0 || isLoadingSubjects}
            className="w-full h-9 md:h-12 text-sm md:text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isLoadingSubjects ? 'Loading subjects...' : `Start Learning (${selectedSubjects.length} subject${selectedSubjects.length !== 1 ? 's' : ''})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
