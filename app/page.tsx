'use client';

import DaysUntilExam from './components/DaysUntilExam';
import ClassCard from './components/ClassCard';
import JuniorAssistant from './components/JuniorAssistant';
import { useCourses } from './components/CoursesProvider';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export default function Home() {
  const { courses, isLoading } = useCourses();

  return (
    <div className="space-y-6">
      {/* Days Until Exam Countdown */}
      <DaysUntilExam />

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Section - Daily Pulse */}
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl lg:text-5xl font-bold text-[#002E5D] mb-2">
              Welcome back
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Here's your daily pulse
            </p>
          </motion.div>

          {/* Class Cards Grid */}
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <p>Loading courses...</p>
            </div>
          ) : courses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((course, index) => (
                <Link key={course.canvasId} href={course.href}>
                  <ClassCard 
                    name={course.nickname} 
                    courseCode={course.courseCode}
                    index={index} 
                  />
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">No courses found</h3>
                  <p className="text-sm text-blue-800 mb-3">
                    Connect your Canvas account to see your courses here.
                  </p>
                  <Link
                    href="/settings"
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    Go to Settings →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Section - Junior Assistant (Sticky) */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="sticky top-8">
            <JuniorAssistant />
          </div>
        </div>
      </div>
    </div>
  );
}
