// Type definitions for Infinite Learning Mode

export interface InfiniteCard {
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
  quality_score: number;
}

export interface InfiniteSession {
  id: string;
  user_id: string;
  selected_subjects: string[];
  cards_viewed: string[];
  current_card_index: number;
  started_at: string;
  last_active_at: string;
  expires_at: string;
}

export interface AnswerResult {
  success: boolean;
  is_correct: boolean;
  correct_answer_index: number;
  explanation: string;
}

export interface CardAnswerState {
  selectedIndex: number | null;
  isAnswered: boolean;
  isCorrect: boolean | null;
  correctIndex: number | null;
  explanation: string | null;
  retryCount: number;
  timeStarted: number;
}
