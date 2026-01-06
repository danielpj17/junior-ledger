'use client';

export interface CourseWithNickname {
  canvasId: number;
  name: string;
  courseCode: string;
  nickname: string;
  href: string;
}

const NICKNAMES_STORAGE_KEY = 'junior-ledger-course-nicknames';
const CANVAS_TOKEN_KEY = 'junior-ledger-canvas-token';
const HIDDEN_COURSES_KEY = 'junior-ledger-hidden-courses';

// Get course nicknames from localStorage
export function getCourseNicknames(): Record<number, string> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(NICKNAMES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save a course nickname
export function saveCourseNickname(canvasId: number, nickname: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const nicknames = getCourseNicknames();
    nicknames[canvasId] = nickname;
    localStorage.setItem(NICKNAMES_STORAGE_KEY, JSON.stringify(nicknames));
  } catch (error) {
    console.error('Error saving nickname:', error);
  }
}

// Get Canvas token from localStorage
export function getCanvasToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(CANVAS_TOKEN_KEY);
  } catch {
    return null;
  }
}

// Save Canvas token
export function saveCanvasToken(token: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CANVAS_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving token:', error);
  }
}

// Get hidden course IDs
export function getHiddenCourses(): number[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(HIDDEN_COURSES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Hide a course
export function hideCourse(canvasId: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const hidden = getHiddenCourses();
    if (!hidden.includes(canvasId)) {
      hidden.push(canvasId);
      localStorage.setItem(HIDDEN_COURSES_KEY, JSON.stringify(hidden));
    }
  } catch (error) {
    console.error('Error hiding course:', error);
  }
}

// Show a course (unhide)
export function showCourse(canvasId: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const hidden = getHiddenCourses();
    const updated = hidden.filter(id => id !== canvasId);
    localStorage.setItem(HIDDEN_COURSES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error showing course:', error);
  }
}

// Get courses with nicknames applied and filter out hidden ones
export function applyNicknamesToCourses(
  courses: Array<{ id: number; name: string; course_code: string }>
): CourseWithNickname[] {
  const nicknames = getCourseNicknames();
  const hidden = getHiddenCourses();
  
  return courses
    .filter(course => !hidden.includes(course.id))
    .map(course => {
      const nickname = nicknames[course.id] || course.name;
      // Create a URL-friendly slug from the course code or name
      const slug = course.course_code.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 
                   course.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      return {
        canvasId: course.id,
        name: course.name,
        courseCode: course.course_code,
        nickname,
        href: `/course/${course.id}`,
      };
    });
}
