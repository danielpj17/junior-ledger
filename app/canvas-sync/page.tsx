'use client';

import { useState, useEffect } from 'react';
import { Info, CheckCircle2, Loader2, Link as LinkIcon, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveCanvasToken, getCanvasToken, getHiddenCourses, showCourse } from '../lib/courseStorage';
import { fetchCanvasCourses, CanvasCourse } from '../actions/canvas';
import { useCourses } from '../components/CoursesProvider';

export default function CanvasSyncPage() {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenCourses, setHiddenCourses] = useState<Array<{ id: number; name: string }>>([]);
  const { refreshCourses } = useCourses();

  useEffect(() => {
    // Load saved token if it exists
    const savedToken = getCanvasToken();
    if (savedToken) {
      setToken(savedToken);
    }
    loadHiddenCourses();
  }, []);

  const loadHiddenCourses = async () => {
    const token = getCanvasToken();
    if (!token) return;

    try {
      // Fetch ALL courses including hidden ones to show in the hidden section
      const response = await fetch(`https://byu.instructure.com/api/v1/courses?enrollment_type=student&enrollment_state=active&per_page=100&include[]=all_courses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const allCourses = await response.json();
        const hiddenIds = getHiddenCourses();
        const hidden = allCourses
          .filter((course: CanvasCourse) => hiddenIds.includes(course.id))
          .map((course: CanvasCourse) => ({ id: course.id, name: course.name || course.course_code || 'Unnamed Course' }));
        setHiddenCourses(hidden);
      }
    } catch (err) {
      // Silently fail - hidden courses are optional
    }
  };

  const handleRestoreCourse = (courseId: number) => {
    showCourse(courseId);
    setHiddenCourses(prev => prev.filter(c => c.id !== courseId));
    refreshCourses();
  };

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError('Please enter a Canvas access token');
      return;
    }

    setIsLoading(true);
    setIsSuccess(false);
    setError(null);

    try {
      // Test the token by fetching courses
      await fetchCanvasCourses(token);
      
      // Save the token if successful
      saveCanvasToken(token);
      
      // Refresh courses to show them in the sidebar
      await refreshCourses();
      await loadHiddenCourses();
      
      setIsSuccess(true);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Canvas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[#002E5D] mb-2">
          Canvas Sync
        </h1>
        <p className="text-lg text-gray-600">
          Connect your BYU Canvas account to sync assignments and deadlines
        </p>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <form onSubmit={handleSync} className="space-y-6">
          {/* Token Input */}
          <div>
            <label
              htmlFor="canvas-token"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Canvas Personal Access Token
            </label>
            <div className="relative">
              <input
                type="password"
                id="canvas-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your Canvas access token"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002E5D] focus:border-transparent pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#002E5D] transition-colors"
                aria-label="Show token information"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Info Box */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-blue-50 border border-blue-200 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      How to get your token
                    </h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                      <li>Go to BYU Canvas and log in to your account</li>
                      <li>Click on your profile picture in the top right</li>
                      <li>Select "Settings" from the dropdown menu</li>
                      <li>Scroll down to "Approved Integrations"</li>
                      <li>Click on "+ New Access Token"</li>
                      <li>Enter a purpose (e.g., "Junior Ledger Sync")</li>
                      <li>Click "Generate Token" and copy it</li>
                      <li>Paste the token in the field above</li>
                    </ol>
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs text-blue-700">
                        <strong>Note:</strong> Your token will only be shown once. Keep it secure and don't share it with anyone.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3"
              >
                <Info className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-800 font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Message */}
          <AnimatePresence>
            {isSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-green-800 font-medium">
                  Connected to BYU Canvas
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sync Button */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={!token.trim() || isLoading}
              className="px-6 py-3 bg-[#002E5D] text-white rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2 font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#002E5D]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <LinkIcon className="w-5 h-5" />
                  Sync Assignments
                </>
              )}
            </button>
            {token && !isLoading && !isSuccess && (
              <p className="text-sm text-gray-500">
                Ready to sync your assignments
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Hidden Courses Section */}
      {hiddenCourses.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-[#002E5D] mb-3 flex items-center gap-2">
            <EyeOff className="w-5 h-5" />
            Hidden Courses
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            These courses are hidden from your sidebar and dashboard. Click "Show" to restore them.
          </p>
          <div className="space-y-2">
            {hiddenCourses.map((course) => (
              <div
                key={course.id}
                className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200"
              >
                <span className="text-gray-800">{course.name}</span>
                <button
                  onClick={() => handleRestoreCourse(course.id)}
                  className="px-3 py-1.5 text-sm bg-[#002E5D] text-white rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Show
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug: Show All Courses Section */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h2 className="text-xl font-semibold text-[#002E5D] mb-3">
          Debug: Check All Courses
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          If ACC 409 is missing, click this button to see all courses in the browser console. Look for courses with "409" in the name or course_code.
        </p>
        <button
          onClick={async () => {
            const token = getCanvasToken();
            if (!token) {
              alert('Please sync your Canvas token first');
              return;
            }
            try {
              const response = await fetch(`https://byu.instructure.com/api/v1/courses?enrollment_type=student&per_page=100`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });
              if (response.ok) {
                const allCourses = await response.json();
                console.log('All Canvas Courses:', allCourses);
                const acc409 = allCourses.find((c: any) => 
                  c.name?.includes('409') || 
                  c.course_code?.includes('409') ||
                  c.name?.includes('Integrated Topics')
                );
                if (acc409) {
                  alert(`Found ACC 409! Name: ${acc409.name}, Code: ${acc409.course_code}, State: ${acc409.workflow_state}, ID: ${acc409.id}\n\nCheck console (F12) for full list.`);
                } else {
                  alert(`Checked ${allCourses.length} courses. ACC 409 not found. Check the browser console (F12) to see all courses.`);
                }
              }
            } catch (err) {
              console.error('Error fetching all courses:', err);
              alert('Error fetching courses. Check console for details.');
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          Check All Courses in Console
        </button>
      </div>

      {/* Additional Info Section */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-[#002E5D] mb-3">
          What gets synced?
        </h2>
        <ul className="space-y-2 text-gray-600">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <span>Assignment due dates and deadlines</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <span>Course information and schedules</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <span>Assignment details and descriptions</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
