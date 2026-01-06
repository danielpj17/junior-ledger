'use client';

import { useSidebar } from './SidebarProvider';

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <main
      className={`flex-1 transition-all duration-300 ${
        isCollapsed ? 'ml-16' : 'ml-64'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </div>
    </main>
  );
}
