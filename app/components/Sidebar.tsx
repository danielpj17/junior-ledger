'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  SquareStack,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useSidebar } from './SidebarProvider';
import { useCourses } from './CoursesProvider';

const staticNavigationItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Sandbox (T-Accounts)', href: '/sandbox', icon: SquareStack },
  { name: 'Canvas Sync', href: '/canvas-sync', icon: LinkIcon },
];

export default function Sidebar() {
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const pathname = usePathname();
  const { courses, isLoading } = useCourses();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#002E5D] text-white transition-all duration-300 z-50 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-white">Junior Ledger</h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-md hover:bg-white/10 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {/* Static Navigation Items */}
          {staticNavigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white font-medium'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm truncate">{item.name}</span>
                )}
              </Link>
            );
          })}

          {/* Courses Section */}
          {courses.length > 0 && (
            <>
              {!isCollapsed && (
                <div className="pt-4 pb-2">
                  <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider px-3">
                    Courses
                  </h2>
                </div>
              )}
              {courses.map((course) => {
                const isActive = pathname === course.href;
                
                return (
                  <Link
                    key={course.canvasId}
                    href={course.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white font-medium'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                    title={isCollapsed ? course.nickname : undefined}
                  >
                    <BookOpen className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <span className="text-sm truncate">{course.nickname}</span>
                    )}
                  </Link>
                );
              })}
            </>
          )}

          {/* Loading State */}
          {isLoading && !isCollapsed && (
            <div className="flex items-center gap-3 px-3 py-2.5 text-white/60">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading courses...</span>
            </div>
          )}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-white/10 text-xs text-white/60">
            BYU Accounting Study OS
          </div>
        )}
      </div>
    </aside>
  );
}
