'use server';

const CANVAS_API_BASE = 'https://byu.instructure.com/api/v1';

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  start_at: string | null;
  end_at: string | null;
  workflow_state: string;
}

export async function fetchCanvasCourses(token: string): Promise<CanvasCourse[]> {
  try {
    const response = await fetch(`${CANVAS_API_BASE}/courses?enrollment_type=student&enrollment_state=active&per_page=100`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid Canvas API token. Please check your token in Canvas Sync settings.');
      }
      throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
    }

    const courses: CanvasCourse[] = await response.json();
    
    // Include all courses except those that are deleted or unpublished
    // This allows courses in various states (available, active, completed) to show up
    return courses.filter(course => 
      course.workflow_state !== 'deleted' && course.workflow_state !== 'unpublished'
    );
  } catch (error) {
    console.error('Error fetching Canvas courses:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Failed to fetch courses from Canvas');
  }
}

export async function fetchCourseAssignments(token: string, courseId: number) {
  try {
    const response = await fetch(
      `${CANVAS_API_BASE}/courses/${courseId}/assignments?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch assignments: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching assignments:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Failed to fetch assignments from Canvas');
  }
}

export interface CanvasFile {
  id: number;
  uuid: string;
  folder_id: number;
  display_name: string;
  filename: string;
  content_type: string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
  locked: boolean;
  hidden: boolean;
  lock_at: string | null;
  unlock_at: string | null;
  thumbnail_url: string | null;
  modified_at: string;
  mime_class: string;
  media_entry_id: string | null;
}

export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  context_id: number;
  context_type: string;
  parent_folder_id: number | null;
  created_at: string;
  updated_at: string;
  lock_at: string | null;
  unlock_at: string | null;
  position: number | null;
  folders_url: string;
  files_url: string;
  files_count: number;
  folders_count: number;
  hidden: boolean;
  locked: boolean;
  for_submissions: boolean;
}

export async function fetchCourseFiles(token: string, courseId: number): Promise<CanvasFile[]> {
  try {
    const response = await fetch(
      `${CANVAS_API_BASE}/courses/${courseId}/files?per_page=100&sort=created_at&order=desc`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching files:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Failed to fetch files from Canvas');
  }
}

export async function fetchCourseFolders(token: string, courseId: number): Promise<CanvasFolder[]> {
  try {
    const response = await fetch(
      `${CANVAS_API_BASE}/courses/${courseId}/folders`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch folders: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching folders:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Failed to fetch folders from Canvas');
  }
}

export async function fetchFolderFiles(token: string, folderId: number): Promise<CanvasFile[]> {
  try {
    const response = await fetch(
      `${CANVAS_API_BASE}/folders/${folderId}/files?per_page=100&sort=created_at&order=desc`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      // 403 means forbidden - folder might be restricted or require different permissions
      // Return empty array instead of throwing error
      if (response.status === 403 || response.status === 404) {
        console.warn(`Folder ${folderId} is not accessible (${response.status})`);
        return [];
      }
      throw new Error(`Failed to fetch folder files: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching folder files:', error);
    // Return empty array on error instead of throwing
    // This allows the UI to continue working even if some folders can't be accessed
    return [];
  }
}

export async function testFolderAccess(token: string, folderId: number): Promise<boolean> {
  try {
    const response = await fetch(
      `${CANVAS_API_BASE}/folders/${folderId}/files?per_page=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    // Only return false (restricted) if we get a 403 Forbidden
    // All other statuses (200, 404, etc.) mean accessible
    return response.status !== 403;
  } catch (error) {
    // On error, assume accessible (don't mark as restricted)
    return true;
  }
}
