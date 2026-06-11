/**
 * Dashboard layout - simple wrapper for dashboard routes
 * No authentication needed (local-first app)
 */

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <>{children}</>;
}
