'use client';

export interface CourseWithNickname {
  canvasId: number;
  name: string;
  courseCode: string;
  nickname: string;
  href: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // base64 encoded
  uploadDate: string;
  courseId: number | null; // null for semester-wide documents
}

const NICKNAMES_STORAGE_KEY = 'junior-ledger-course-nicknames';
const CANVAS_TOKEN_KEY = 'junior-ledger-canvas-token';
const HIDDEN_COURSES_KEY = 'junior-ledger-hidden-courses';
const CHAT_STORAGE_PREFIX = 'junior-ledger-chat-';
const FILES_STORAGE_PREFIX = 'junior-ledger-files-';

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

// Chat Storage Functions

// Get chat messages for a specific course
export function getCourseChatMessages(courseId: number): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const key = `${CHAT_STORAGE_PREFIX}${courseId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save chat messages for a specific course
export function saveCourseChatMessages(courseId: number, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = `${CHAT_STORAGE_PREFIX}${courseId}`;
    localStorage.setItem(key, JSON.stringify(messages));
  } catch (error) {
    console.error('Error saving chat messages:', error);
  }
}

// Clear chat messages for a specific course
export function clearCourseChatMessages(courseId: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = `${CHAT_STORAGE_PREFIX}${courseId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing chat messages:', error);
  }
}

// File Storage Functions

// Get uploaded files for a specific course (or semester documents if courseId is null)
export function getCourseFiles(courseId: number | null): UploadedFile[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const key = courseId === null 
      ? `${FILES_STORAGE_PREFIX}semester` 
      : `${FILES_STORAGE_PREFIX}${courseId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Get all uploaded files across all courses
export function getAllFiles(): UploadedFile[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const allFiles: UploadedFile[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(FILES_STORAGE_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const files = JSON.parse(stored);
          allFiles.push(...files);
        }
      }
    }
    return allFiles;
  } catch {
    return [];
  }
}

// Save uploaded files for a specific course (or semester documents if courseId is null)
export function saveCourseFiles(courseId: number | null, files: UploadedFile[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = courseId === null 
      ? `${FILES_STORAGE_PREFIX}semester` 
      : `${FILES_STORAGE_PREFIX}${courseId}`;
    localStorage.setItem(key, JSON.stringify(files));
  } catch (error) {
    console.error('Error saving files:', error);
    // If quota exceeded, provide helpful error
    if (error instanceof DOMException && error.code === 22) {
      throw new Error('Storage quota exceeded. Please delete some files to free up space.');
    }
    throw error;
  }
}

// Add a file to a course (or semester documents if courseId is null)
export function addCourseFile(courseId: number | null, file: UploadedFile): void {
  if (typeof window === 'undefined') return;
  
  try {
    const files = getCourseFiles(courseId);
    files.push(file);
    saveCourseFiles(courseId, files);
  } catch (error) {
    console.error('Error adding file:', error);
    throw error;
  }
}

// Delete a file from a course (or semester documents if courseId is null)
export function deleteCourseFile(courseId: number | null, fileId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const files = getCourseFiles(courseId);
    const updated = files.filter(f => f.id !== fileId);
    saveCourseFiles(courseId, updated);
  } catch (error) {
    console.error('Error deleting file:', error);
  }
}
