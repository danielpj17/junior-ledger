'use client';

export interface CourseWithNickname {
  canvasId: number;
  name: string;
  courseCode: string;
  nickname: string;
  href: string;
  color?: string; // Canvas course color
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

export interface CachedCanvasFile {
  canvasId: number; // Canvas file ID
  name: string;
  type: string;
  size: number;
  data: string; // base64 encoded
  url: string; // Original Canvas URL
  modifiedAt: string; // Canvas file modification date
  cachedAt: string; // When we cached it
  courseId: number;
}

const NICKNAMES_STORAGE_KEY = 'junior-ledger-course-nicknames';
const CANVAS_TOKEN_KEY = 'junior-ledger-canvas-token';
const HIDDEN_COURSES_KEY = 'junior-ledger-hidden-courses';
const CHAT_STORAGE_PREFIX = 'junior-ledger-chat-';
const FILES_STORAGE_PREFIX = 'junior-ledger-files-';
const CANVAS_FILES_STORAGE_PREFIX = 'junior-ledger-canvas-files-';
const CALENDAR_COURSE_COLORS_KEY = 'junior-ledger-course-colors';
const CALENDAR_SELECTED_COURSES_KEY = 'junior-ledger-calendar-selected-courses';
const AUTO_REFRESH_INTERVAL_KEY = 'junior-ledger-auto-refresh-interval';
const GOOGLE_CALENDAR_FEED_URL_KEY = 'junior-ledger-google-cal-url';
const GOOGLE_CALENDAR_SELECTED_KEY = 'junior-ledger-google-cal-selected';
const ASSIGNMENTS_STORAGE_PREFIX = 'junior-ledger-assignments-';
const EXTRACTED_TEXT_STORAGE_PREFIX = 'junior-ledger-extracted-text-';

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

// Canvas File Caching Functions

// Get cached Canvas files for a specific course
export function getCachedCanvasFiles(courseId: number): CachedCanvasFile[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const key = `${CANVAS_FILES_STORAGE_PREFIX}${courseId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save cached Canvas files for a specific course
export function saveCachedCanvasFiles(courseId: number, files: CachedCanvasFile[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = `${CANVAS_FILES_STORAGE_PREFIX}${courseId}`;
    localStorage.setItem(key, JSON.stringify(files));
  } catch (error) {
    console.error('Error saving cached Canvas files:', error);
    // If quota exceeded, provide helpful error
    if (error instanceof DOMException && error.code === 22) {
      throw new Error('Storage quota exceeded. Please clear some cached files to free up space.');
    }
    throw error;
  }
}

// Add or update a cached Canvas file
export function cacheCanvasFile(courseId: number, file: CachedCanvasFile): void {
  if (typeof window === 'undefined') return;
  
  try {
    const files = getCachedCanvasFiles(courseId);
    const existingIndex = files.findIndex(f => f.canvasId === file.canvasId);
    
    if (existingIndex >= 0) {
      // Update existing file
      files[existingIndex] = file;
    } else {
      // Add new file
      files.push(file);
    }
    
    saveCachedCanvasFiles(courseId, files);
  } catch (error) {
    console.error('Error caching Canvas file:', error);
    throw error;
  }
}

// Get a cached Canvas file by Canvas ID
export function getCachedCanvasFile(courseId: number, canvasId: number): CachedCanvasFile | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const files = getCachedCanvasFiles(courseId);
    return files.find(f => f.canvasId === canvasId) || null;
  } catch {
    return null;
  }
}

// Clear cached Canvas files for a specific course
export function clearCachedCanvasFiles(courseId: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = `${CANVAS_FILES_STORAGE_PREFIX}${courseId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing cached Canvas files:', error);
  }
}

// Calendar Storage Functions

// Get course colors from localStorage
export function getCourseColors(): Record<number, string> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(CALENDAR_COURSE_COLORS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save course colors
export function saveCourseColors(colors: Record<number, string>): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CALENDAR_COURSE_COLORS_KEY, JSON.stringify(colors));
  } catch (error) {
    console.error('Error saving course colors:', error);
  }
}

// Get selected course IDs for calendar (defaults to all courses if not set)
export function getCalendarSelectedCourses(): Set<number> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(CALENDAR_SELECTED_COURSES_KEY);
    if (stored) {
      const ids = JSON.parse(stored);
      return new Set(ids);
    }
    return null; // null means all courses are selected (default)
  } catch {
    return null;
  }
}

// Save selected course IDs for calendar
export function saveCalendarSelectedCourses(selectedCourseIds: Set<number> | null): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (selectedCourseIds === null) {
      localStorage.removeItem(CALENDAR_SELECTED_COURSES_KEY);
    } else {
      localStorage.setItem(CALENDAR_SELECTED_COURSES_KEY, JSON.stringify(Array.from(selectedCourseIds)));
    }
  } catch (error) {
    console.error('Error saving calendar selected courses:', error);
  }
}

// Auto-Refresh Interval Functions

// Get auto-refresh interval in minutes (default: 5 minutes, or 0 to disable)
export function getAutoRefreshInterval(): number {
  if (typeof window === 'undefined') return 5;
  
  try {
    const stored = localStorage.getItem(AUTO_REFRESH_INTERVAL_KEY);
    if (stored === null) return 5; // Default to 5 minutes
    const interval = parseInt(stored, 10);
    return isNaN(interval) || interval < 0 ? 5 : interval;
  } catch {
    return 5;
  }
}

// Save auto-refresh interval in minutes (0 to disable)
export function saveAutoRefreshInterval(intervalMinutes: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (intervalMinutes < 0) {
      intervalMinutes = 0;
    }
    localStorage.setItem(AUTO_REFRESH_INTERVAL_KEY, intervalMinutes.toString());
  } catch (error) {
    console.error('Error saving auto-refresh interval:', error);
  }
}

// Google Calendar Feed URL Functions

// Get Google Calendar feed URL from localStorage
export function getGoogleCalendarFeedUrl(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(GOOGLE_CALENDAR_FEED_URL_KEY);
  } catch {
    return null;
  }
}

// Save Google Calendar feed URL
export function saveGoogleCalendarFeedUrl(url: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (url.trim() === '') {
      localStorage.removeItem(GOOGLE_CALENDAR_FEED_URL_KEY);
      // Also unselect Google Calendar if URL is removed
      localStorage.removeItem(GOOGLE_CALENDAR_SELECTED_KEY);
    } else {
      localStorage.setItem(GOOGLE_CALENDAR_FEED_URL_KEY, url.trim());
      // Default to selected when URL is added
      if (!localStorage.getItem(GOOGLE_CALENDAR_SELECTED_KEY)) {
        localStorage.setItem(GOOGLE_CALENDAR_SELECTED_KEY, 'true');
      }
    }
  } catch (error) {
    console.error('Error saving Google Calendar feed URL:', error);
  }
}

// Google Calendar Selection Functions

// Get Google Calendar selection state (defaults to true if URL exists)
export function getGoogleCalendarSelected(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const url = localStorage.getItem(GOOGLE_CALENDAR_FEED_URL_KEY);
    if (!url) return false; // Can't be selected if no URL
    
    const stored = localStorage.getItem(GOOGLE_CALENDAR_SELECTED_KEY);
    if (stored === null) {
      // Default to true (selected) if not set
      return true;
    }
    return stored === 'true';
  } catch {
    return false;
  }
}

// Save Google Calendar selection state
export function saveGoogleCalendarSelected(selected: boolean): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (selected) {
      localStorage.setItem(GOOGLE_CALENDAR_SELECTED_KEY, 'true');
    } else {
      localStorage.setItem(GOOGLE_CALENDAR_SELECTED_KEY, 'false');
    }
  } catch (error) {
    console.error('Error saving Google Calendar selection:', error);
  }
}

// Assignment Caching Functions

export interface CachedAssignment {
  id: number;
  name: string;
  due_at: string | null;
  course_id: number;
  cachedAt: string; // When we cached it
}

export interface CachedAssignments {
  assignments: CachedAssignment[];
  cachedAt: string;
}

// Get cached assignments for a specific course
export function getCachedAssignments(courseId: number): CachedAssignments | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const key = `${ASSIGNMENTS_STORAGE_PREFIX}${courseId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const cached = JSON.parse(stored) as CachedAssignments;
    // Check if cache is older than 5 minutes
    const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();
    if (cacheAge > 5 * 60 * 1000) { // 5 minutes
      return null; // Cache expired
    }
    return cached;
  } catch {
    return null;
  }
}

// Save cached assignments for a specific course
export function saveCachedAssignments(courseId: number, assignments: any[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = `${ASSIGNMENTS_STORAGE_PREFIX}${courseId}`;
    const cached: CachedAssignments = {
      assignments: assignments.map((assignment: any) => ({
        id: assignment.id,
        name: assignment.name,
        due_at: assignment.due_at,
        course_id: courseId,
        cachedAt: new Date().toISOString()
      })),
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (error) {
    console.error('Error saving cached assignments:', error);
  }
}

// Clear cached assignments for a specific course
export function clearCachedAssignments(courseId: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = `${ASSIGNMENTS_STORAGE_PREFIX}${courseId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing cached assignments:', error);
  }
}

// Extracted Text Caching Functions

export interface CachedExtractedText {
  canvasId?: number; // Canvas file ID if from Canvas
  fileName: string;
  text: string;
  fileModifiedAt?: string; // When the file was last modified (for Canvas files)
  extractedAt: string; // When we extracted the text
}

export interface CachedExtractedTexts {
  texts: CachedExtractedText[];
  cachedAt: string;
}

// Get cached extracted text for a specific course
export function getCachedExtractedText(courseId: number): CachedExtractedTexts | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const key = `${EXTRACTED_TEXT_STORAGE_PREFIX}${courseId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as CachedExtractedTexts : null;
  } catch {
    return null;
  }
}

// Save cached extracted text for a specific course
export function saveCachedExtractedText(courseId: number, texts: CachedExtractedText[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = `${EXTRACTED_TEXT_STORAGE_PREFIX}${courseId}`;
    const cached: CachedExtractedTexts = {
      texts,
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (error) {
    console.error('Error saving cached extracted text:', error);
    // If quota exceeded, provide helpful error
    if (error instanceof DOMException && error.code === 22) {
      throw new Error('Storage quota exceeded. Please clear some cached files to free up space.');
    }
    throw error;
  }
}

// Clear cached extracted text for a specific course
export function clearCachedExtractedText(courseId: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = `${EXTRACTED_TEXT_STORAGE_PREFIX}${courseId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing cached extracted text:', error);
  }
}
