// Database types based on PRD Section 6: Data Model

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
        Relationships: never[];
      };
      study_plans: {
        Row: StudyPlan;
        Insert: Omit<StudyPlan, 'id' | 'created_at'>;
        Update: Partial<Omit<StudyPlan, 'id' | 'user_id'>>;
        Relationships: never[];
      };
      user_progress: {
        Row: UserProgress;
        Insert: Omit<UserProgress, 'id' | 'created_at'>;
        Update: Partial<Omit<UserProgress, 'id' | 'user_id'>>;
        Relationships: never[];
      };
      study_streaks: {
        Row: StudyStreak;
        Insert: Omit<StudyStreak, 'id' | 'updated_at'>;
        Update: Partial<Omit<StudyStreak, 'id' | 'user_id'>>;
        Relationships: never[];
      };
      parent_access: {
        Row: ParentAccess;
        Insert: Omit<ParentAccess, 'id' | 'created_at'>;
        Update: Partial<Omit<ParentAccess, 'id' | 'student_user_id'>>;
        Relationships: never[];
      };
      resource_progress: {
        Row: ResourceProgress;
        Insert: Omit<ResourceProgress, 'id' | 'created_at'>;
        Update: Partial<Omit<ResourceProgress, 'id' | 'user_id'>>;
        Relationships: never[];
      };
      events: {
        Row: Event;
        Insert: Omit<Event, 'id' | 'created_at'>;
        Update: never;
        Relationships: never[];
      };
      content_microcards: {
        Row: ContentMicrocard;
        Insert: Omit<ContentMicrocard, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ContentMicrocard, 'id' | 'subject' | 'outcome_code'>>;
        Relationships: never[];
      };
      quick_check_results: {
        Row: QuickCheckResult;
        Insert: Omit<QuickCheckResult, 'id' | 'created_at'>;
        Update: never;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

// Table: profiles
export interface Profile {
  id: string; // UUID (FK to auth.users)
  grade: number | null;
  timezone?: string;
  display_name?: string | null; // Optional student-chosen name
  created_at: string;
}

// Table: study_plans
export interface StudyPlan {
  id: string;
  user_id: string;
  subjects: string[];
  schedule: FlexibleSchedule;
  total_units: number; // Total number of units across all days
  duration_weeks: number; // Number of weeks for the plan (1-12)
  includes_weekends: boolean; // Whether weekends are included
  start_date: string; // ISO date string (YYYY-MM-DD) - plan start date
  end_date: string; // ISO date string (YYYY-MM-DD) - plan end date
  status: 'active' | 'completed' | 'expired' | 'archived'; // Plan lifecycle state
  current_day_index: number; // Manual day override for progression (0-based)
  locked_timezone: string; // Timezone locked at plan creation (e.g., 'America/Edmonton')
  completed_at: string | null; // Timestamp when all units were completed
  expired_at: string | null; // Timestamp when plan expired
  archived_at: string | null; // Timestamp when user archived the plan
  created_at: string;
}

/**
 * Learning outcome with metadata for scheduling and rendering
 * Represents an atomic unit of learning content
 */
export interface LearningOutcome {
  subject: string;
  unitId: string;
  unitTitle: string;
  outcomeCode: string;
  isSynthetic: boolean; // True for units without Alberta outcomes (e.g., supplemental content)
  fallbackResources: CurriculumResource[]; // External resources if no microcards exist
}

// Flexible schedule structure supporting 1-12 weeks with optional weekends
export interface FlexibleSchedule {
  days: ScheduleDay[];
}

export interface ScheduleDay {
  dayIndex: number; // 0-based index for the day
  dayLabel: string; // e.g., "Monday, Jan 8" or "Week 2 - Tuesday, Jan 15"
  date: string; // YYYY-MM-DD format (always present)
  isWeekend: boolean; // True if Saturday or Sunday
  outcomes: LearningOutcome[]; // Learning outcomes assigned to this day
}

// Table: user_progress
export interface UserProgress {
  id: string;
  user_id: string;
  plan_id: string;
  subject: string;
  unit_id: string;
  completed: boolean;
  completed_at: string; // Used for streak and weekly summary calculations
  created_at: string;
}

// Table: study_streaks
export interface StudyStreak {
  id: string;
  user_id: string; // Unique
  current_streak: number;
  longest_streak: number;
  last_study_date: string; // Date
  total_study_days: number;
  updated_at: string;
}

// Table: parent_access
export interface ParentAccess {
  id: string;
  student_user_id: string;
  share_token: string; // Unique
  is_active: boolean;
  created_at: string;
}

// Table: resource_progress
export interface ResourceProgress {
  id: string;
  user_id: string;
  plan_id: string;
  unit_id: string;
  resource_url: string; // URL serves as unique identifier for resource
  completed: boolean;
  completed_at: string;
  created_at: string;
}

// Table: events (analytics)
export interface Event {
  id: string;
  user_id: string | null;
  event_name: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

// Curriculum data types
export interface CurriculumSubject {
  subject: string;
  grade: number;
  albertaDocs?: Array<{ title: string; url: string; type?: string }>;
  units: CurriculumUnit[];
}

export interface CurriculumUnit {
  id: string;
  title: string;
  topics?: string[];
  estimatedHours: number;
  outcomesRef?: string;
  outcomes?: Array<{
    code: string;
    // Some datasets use `description`, others use `title` for the label
    description?: string;
    title?: string;
    strand?: string;
    type?: string;
    category?: string;
    parent?: string;
  }>; // Supports richer Alberta curriculum outcome metadata
  resources: CurriculumResource[];
}

export interface CurriculumResource {
  type: 'video' | 'pdf' | 'article' | 'practice' | 'reference' | 'virtual-lab' | 'exemplars' | 'rubric' | 'data-booklet' | 'course' | 'simulation' | 'diploma-prep' | 'worksheet';
  title: string;
  url: string;
  alignedOutcomes?: string[]; // Which specific outcomes this resource supports
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

// Table: content_microcards
export interface ContentMicrocard {
  id: string;
  subject: string;
  unit_id: string;
  outcome_code: string;
  summary: string;
  steps: string[];
  pitfall: string | null;
  quick_check: {
    question: string;
    choices: string[];
    answer: string;
    explanation: string;
  };
  recommended_resource_url: string | null;
  sources: Array<{
    type: string;
    title: string;
    url?: string;
    doc_stem?: string;
    pages?: number[];
  }>;
  version: number;
  status: 'active' | 'draft' | 'archived';
  created_at: string;
  updated_at: string;
}

// Table: quick_check_results
export interface QuickCheckResult {
  id: string;
  user_id: string;
  plan_id: string | null;
  subject: string;
  unit_id: string | null;
  outcome_code: string | null;
  microcard_id: string | null;
  correct: boolean;
  selected: string | null;
  created_at: string;
}

// API response types
export interface WeeklySummaryStats {
  activityDates: string[];
  totalUnits: number;
}

export interface ProgressUpdateResponse {
  success: boolean;
  streakIncreased: boolean;
  newStreak: number;
  milestone?: number; // 25, 50, 75, or 100
  streak: StudyStreak | null;
  weeklySummary: WeeklySummaryStats | null;
}
