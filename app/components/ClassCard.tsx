'use client';

import { motion } from 'framer-motion';
import { BookOpen, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchCourseAssignments } from '../actions/canvas';
import { getCanvasToken, getCachedAssignments, saveCachedAssignments } from '../lib/courseStorage';

interface ClassCardProps {
  name: string;
  courseCode?: string;
  courseId: number;
  index: number;
}

interface NextAssignment {
  name: string;
  dueDate: string;
}

export default function ClassCard({ name, courseCode, courseId, index }: ClassCardProps) {
  const [nextAssignment, setNextAssignment] = useState<NextAssignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNextAssignment = async () => {
      const token = getCanvasToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // Check cache first
        const cached = getCachedAssignments(courseId);
        let assignments: any[];
        
        if (cached) {
          // Use cached assignments
          assignments = cached.assignments;
          setIsLoading(false);
        } else {
          // Fetch from API
          assignments = await fetchCourseAssignments(token, courseId);
          // Cache the assignments
          saveCachedAssignments(courseId, assignments);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Helper function to check if assignment is completed/submitted in Canvas
        const isAssignmentSubmitted = (assignment: any): boolean => {
          // Check if assignment has a submission object from Canvas
          if (assignment.submission) {
            const workflowState = assignment.submission.workflow_state;
            // Assignment is considered completed if it's been submitted or graded
            return workflowState === 'submitted' || workflowState === 'graded';
          }
          return false;
        };

        // Filter for upcoming assignments with due dates, excluding completed/submitted ones from Canvas
        const upcomingAssignments = assignments
          .filter((assignment: any) => {
            if (!assignment.due_at) return false;
            // Filter out assignments that have been submitted/completed in Canvas
            if (isAssignmentSubmitted(assignment)) return false;
            const dueDate = new Date(assignment.due_at);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate >= today;
          })
          .sort((a: any, b: any) => {
            const dateA = new Date(a.due_at).getTime();
            const dateB = new Date(b.due_at).getTime();
            return dateA - dateB;
          });

        if (upcomingAssignments.length > 0) {
          const next = upcomingAssignments[0];
          setNextAssignment({
            name: next.name,
            dueDate: next.due_at,
          });
        } else {
          setNextAssignment(null);
        }
      } catch (error) {
        console.error(`Error fetching assignments for course ${courseId}:`, error);
        setNextAssignment(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNextAssignment();
  }, [courseId]);

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays <= 7) {
      return `In ${diffDays} days`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#002E5D]/10 rounded-lg">
            <BookOpen className="w-5 h-5 text-[#002E5D]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#002E5D] text-lg">{name}</h3>
            {courseCode && (
              <p className="text-sm text-gray-500 mt-1">{courseCode}</p>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-500 mb-1">Next Deadline</p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : nextAssignment ? (
          <div>
            <p className="text-sm font-medium text-gray-900 line-clamp-1">{nextAssignment.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatDueDate(nextAssignment.dueDate)}</p>
          </div>
        ) : (
          <p className="text-gray-400 text-sm italic">No upcoming deadlines</p>
        )}
      </div>
    </motion.div>
  );
}
