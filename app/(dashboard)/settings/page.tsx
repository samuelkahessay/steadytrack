import { SettingsSubjectsCard } from '@/components/settings/settings-subjects-card';

/**
 * Settings page - local-first, no auth required
 * Currently only shows subject management
 */
export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        {/* Study Plan/Subjects Card */}
        <SettingsSubjectsCard />
      </div>
    </div>
  );
}
