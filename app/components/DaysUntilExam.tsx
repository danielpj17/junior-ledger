'use client';

import { useState, useEffect } from 'react';
import { useCourses } from './CoursesProvider';
import { fetchCourseAssignments } from '../actions/canvas';
import { getCanvasToken, getCachedAssignments, saveCachedAssignments } from '../lib/courseStorage';

export default function DaysUntilExam() {
  const [daysUntil, setDaysUntil] = useState<number | null>(null);
  const [examName, setExamName] = useState<string | null>(null);
  const [examCourseName, setExamCourseName] = useState<string | null>(null);
  const { courses } = useCourses();

  useEffect(() => {
    const fetchExams = async () => {
      const token = getCanvasToken();
      if (!token || courses.length === 0) {
        setDaysUntil(null);
        setExamName(null);
        setExamCourseName(null);
        return;
      }

      try {
        // Fetch all assignments from all courses (using cache when available)
        const allAssignments = await Promise.all(
          courses.map(async (course) => {
            try {
              // Check cache first
              const cached = getCachedAssignments(course.canvasId);
              let assignments: any[];
              
              if (cached) {
                assignments = cached.assignments;
              } else {
                assignments = await fetchCourseAssignments(token, course.canvasId);
                // Cache the assignments
                saveCachedAssignments(course.canvasId, assignments);
              }
              
              return assignments.map((assignment: any) => ({
                ...assignment,
                courseName: course.nickname,
              }));
            } catch (error) {
              console.error(`Error fetching assignments for course ${course.canvasId}:`, error);
              return [];
            }
          })
        );

        // Flatten the array of assignments
        const flatAssignments = allAssignments.flat();

        // Filter for exams (assignments containing "exam" or "final" in the name, case-insensitive)
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

        const upcomingExams = flatAssignments
          .filter((assignment: any) => {
            if (!assignment.due_at) return false;
            // Filter out assignments that have been submitted/completed in Canvas
            if (isAssignmentSubmitted(assignment)) return false;
            
            const assignmentName = (assignment.name || '').toLowerCase();
            const isExam = assignmentName.includes('exam') || 
                          assignmentName.includes('final') ||
                          assignmentName.includes('midterm') ||
                          assignmentName.includes('test');
            if (!isExam) return false;
            
            const dueDate = new Date(assignment.due_at);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate >= today;
          })
          .sort((a: any, b: any) => {
            const dateA = new Date(a.due_at).getTime();
            const dateB = new Date(b.due_at).getTime();
            return dateA - dateB;
          });

        if (upcomingExams.length > 0) {
          const nearestExam = upcomingExams[0];
          const examDate = new Date(nearestExam.due_at);
          examDate.setHours(0, 0, 0, 0);
          
          const diffTime = examDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          setDaysUntil(Math.max(0, diffDays));
          setExamName(nearestExam.name);
          setExamCourseName(nearestExam.courseName || null);
        } else {
          setDaysUntil(null);
          setExamName(null);
          setExamCourseName(null);
        }
      } catch (error) {
        console.error('Error fetching exams:', error);
        setDaysUntil(null);
        setExamName(null);
        setExamCourseName(null);
      }
    };

    fetchExams();
  }, [courses]);

  if (daysUntil === null) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-[#002E5D] to-[#004080] text-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">Days Until Exam</h2>
          {examName ? (
            <div>
              <p className="text-white/80 text-sm font-medium">{examName}</p>
              {examCourseName && (
                <p className="text-white/70 text-xs mt-0.5">{examCourseName}</p>
              )}
            </div>
          ) : (
            <p className="text-white/80 text-sm">Final exams approaching</p>
          )}
        </div>
        <div className="text-6xl font-bold text-[#FFD700]">
          {daysUntil}
        </div>
      </div>
    </div>
  );
}
