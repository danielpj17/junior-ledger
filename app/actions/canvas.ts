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

/**
 * Download a Canvas file and return it as base64 (server action to avoid CORS)
 */
export async function downloadCanvasFileAsBase64(
  fileUrl: string,
  fileName: string,
  token: string
): Promise<string | null> {
  try {
    const response = await fetch(fileUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to download Canvas file ${fileName}: ${response.status}`);
      return null;
    }

    // Convert response to buffer, then to base64
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Return as data URL
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error downloading Canvas file ${fileName}:`, error);
    return null;
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

export interface CanvasCalendarEvent {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  description: string | null;
  location_name: string | null;
  location_address: string | null;
  context_code: string;
  workflow_state: string;
  url: string;
  html_url: string;
  all_day: boolean;
  all_day_date: string | null;
  created_at: string;
  updated_at: string;
  type: string;
}

// Fetch calendar events from Canvas (including assignments)
export async function fetchCalendarEvents(
  token: string,
  startDate?: string,
  endDate?: string,
  contextCodes?: string[]
): Promise<CanvasCalendarEvent[]> {
  try {
    const allEvents: CanvasCalendarEvent[] = [];
    
    // Fetch calendar events (both events and assignments)
    let url = `${CANVAS_API_BASE}/calendar_events?per_page=100`;
    
    if (startDate) {
      url += `&start_date=${startDate}`;
    }
    if (endDate) {
      url += `&end_date=${endDate}`;
    }
    if (contextCodes && contextCodes.length > 0) {
      contextCodes.forEach(code => {
        url += `&context_codes[]=${code}`;
      });
    }

    const eventsResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (eventsResponse.ok) {
      const events = await eventsResponse.json();
      allEvents.push(...events);
    } else {
      console.warn('Failed to fetch calendar events:', eventsResponse.status);
    }

    // Also fetch assignments and convert them to calendar events
    if (contextCodes && contextCodes.length > 0) {
      const assignmentPromises = contextCodes.map(async (contextCode) => {
        const courseIdMatch = contextCode.match(/^course_(\d+)$/);
        if (!courseIdMatch) return [];

        const courseId = parseInt(courseIdMatch[1], 10);
        try {
          let assignmentsUrl = `${CANVAS_API_BASE}/courses/${courseId}/assignments?per_page=100&include[]=assignment_overrides`;
          
          if (startDate) {
            assignmentsUrl += `&bucket=upcoming`;
          }

          const assignmentsResponse = await fetch(assignmentsUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!assignmentsResponse.ok) {
            return [];
          }

          const assignments = await assignmentsResponse.json();
          
          // Convert assignments to calendar events
          return assignments
            .filter((assignment: any) => assignment.due_at || assignment.all_dates)
            .map((assignment: any) => {
              // Handle assignments with multiple due dates
              if (assignment.all_dates && assignment.all_dates.length > 0) {
                return assignment.all_dates.map((dateInfo: any) => ({
                  id: assignment.id * 1000 + (dateInfo.id || 0), // Make unique IDs
                  title: assignment.name,
                  start_at: dateInfo.due_at || assignment.due_at || '',
                  end_at: dateInfo.due_at || assignment.due_at || null,
                  description: assignment.description || null,
                  location_name: null,
                  location_address: null,
                  context_code: contextCode,
                  workflow_state: assignment.workflow_state || 'published',
                  url: assignment.html_url || '',
                  html_url: assignment.html_url || '',
                  all_day: false,
                  all_day_date: null, // Don't use all_day_date for assignments - use start_at for proper timezone handling
                  created_at: assignment.created_at || '',
                  updated_at: assignment.updated_at || '',
                  type: 'assignment',
                }));
              } else if (assignment.due_at) {
                return {
                  id: assignment.id,
                  title: assignment.name,
                  start_at: assignment.due_at,
                  end_at: assignment.due_at,
                  description: assignment.description || null,
                  location_name: null,
                  location_address: null,
                  context_code: contextCode,
                  workflow_state: assignment.workflow_state || 'published',
                  url: assignment.html_url || '',
                  html_url: assignment.html_url || '',
                  all_day: false,
                  all_day_date: null, // Don't use all_day_date for assignments - use start_at for proper timezone handling
                  created_at: assignment.created_at || '',
                  updated_at: assignment.updated_at || '',
                  type: 'assignment',
                };
              }
              return null;
            })
            .flat()
            .filter((event: any) => {
              if (!event || !event.start_at) return false;
              // Filter by date range if provided
              const eventDate = event.start_at.split('T')[0];
              if (startDate && eventDate < startDate) return false;
              if (endDate && eventDate > endDate) return false;
              return true;
            });
        } catch (err) {
          console.error(`Error fetching assignments for course ${courseId}:`, err);
          return [];
        }
      });

      const assignmentEventsArrays = await Promise.all(assignmentPromises);
      assignmentEventsArrays.forEach(events => {
        allEvents.push(...events);
      });
    }

    // Remove duplicates (in case an assignment also appears as a calendar event)
    const uniqueEvents = allEvents.filter((event, index, self) =>
      index === self.findIndex((e) => 
        e.id === event.id && e.context_code === event.context_code
      )
    );

    return uniqueEvents;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error instanceof Error
      ? error
      : new Error('Failed to fetch calendar events from Canvas');
  }
}

// Fetch user's custom colors for courses
export async function fetchCourseColor(token: string, courseId: number): Promise<string | null> {
  try {
    const response = await fetch(
      `${CANVAS_API_BASE}/users/self/colors/course_${courseId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      // If color not set, return null (Canvas will use default)
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch course color: ${response.status}`);
    }

    const data = await response.json();
    return data.hexcode || null;
  } catch (error) {
    console.error('Error fetching course color:', error);
    // Return null on error so we can use a default color
    return null;
  }
}

// Fetch colors for multiple courses at once
export async function fetchCourseColors(
  token: string,
  courseIds: number[]
): Promise<Record<number, string>> {
  const colors: Record<number, string> = {};
  
  // Canvas doesn't have a bulk endpoint, so we fetch individually
  // But we do it in parallel to be efficient
  const promises = courseIds.map(async (courseId) => {
    const color = await fetchCourseColor(token, courseId);
    if (color) {
      colors[courseId] = color;
    }
  });

  await Promise.all(promises);
  return colors;
}