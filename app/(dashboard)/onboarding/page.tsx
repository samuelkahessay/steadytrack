import { redirect } from 'next/navigation';

export default function OnboardingPage() {
  // Server-side redirect to new multi-step onboarding flow
  redirect('/plan/new');
}
