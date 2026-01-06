'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchCanvasCourses } from '../actions/canvas';
import { 
  getCanvasToken, 
  applyNicknamesToCourses, 
  CourseWithNickname,
  saveCourseNickname as saveNickname,
  hideCourse as hideCourseStorage,
  showCourse as showCourseStorage
} from '../lib/courseStorage';
import { CanvasCourse } from '../actions/canvas';

interface CoursesContextType {
  courses: CourseWithNickname[];
  isLoading: boolean;
  error: string | null;
  refreshCourses: () => Promise<void>;
  updateNickname: (canvasId: number, nickname: string) => void;
  hideCourse: (canvasId: number) => void;
}

const CoursesContext = createContext<CoursesContextType | undefined>(undefined);

export function CoursesProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<CourseWithNickname[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCourses = async () => {
    const token = getCanvasToken();
    if (!token) {
      setCourses([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const canvasCourses = await fetchCanvasCourses(token);
      const coursesWithNicknames = applyNicknamesToCourses(canvasCourses);
      setCourses(coursesWithNicknames);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses');
      setCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateNickname = (canvasId: number, nickname: string) => {
    saveNickname(canvasId, nickname);
    setCourses(prev => 
      prev.map(course => 
        course.canvasId === canvasId 
          ? { ...course, nickname }
          : course
      )
    );
  };

  const hideCourse = (canvasId: number) => {
    hideCourseStorage(canvasId);
    setCourses(prev => prev.filter(course => course.canvasId !== canvasId));
  };

  useEffect(() => {
    refreshCourses();
  }, []);

  return (
    <CoursesContext.Provider value={{ courses, isLoading, error, refreshCourses, updateNickname, hideCourse }}>
      {children}
    </CoursesContext.Provider>
  );
}

export function useCourses() {
  const context = useContext(CoursesContext);
  if (context === undefined) {
    throw new Error('useCourses must be used within a CoursesProvider');
  }
  return context;
}
