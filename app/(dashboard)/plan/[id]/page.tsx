import { SimplifiedPlanView } from '@/components/plan/SimplifiedPlanView';

/**
 * Plan View Page
 * Displays the user's study plan in a simplified accordion format
 * with daily segmentation (Day 1, Day 2, etc.)
 *
 * Features:
 * - Day-based accordion structure
 * - Subject and unit organization
 * - Inline interactive microcards
 * - Resource completion tracking
 * - localStorage-based (no auth required)
 */
export default function PlanPage() {
  return <SimplifiedPlanView />;
}
