'use client';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function CircularProgress({
  percentage,
  size = 48,
  strokeWidth = 4,
  className = '',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Celebration effect at 100%
  const isComplete = percentage === 100;

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-500 ease-out ${
            isComplete
              ? 'text-green-500 drop-shadow-md'
              : percentage > 0
              ? 'text-blue-500'
              : 'text-gray-300'
          }`}
          strokeLinecap="round"
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold transition-all duration-300 ${
          isComplete
            ? 'text-green-600 scale-110'
            : 'text-gray-700'
        }`}>
          {Math.round(percentage)}%
        </span>
      </div>
      {/* Celebration pulse effect at 100% */}
      {isComplete && (
        <div className="absolute inset-0 animate-ping opacity-20 rounded-full bg-green-400"
          style={{ animationIterationCount: 1, animationDuration: '1s' }}
        />
      )}
    </div>
  );
}
