'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Calendar as CalendarIcon, Loader2, AlertCircle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCanvasToken, getAutoRefreshInterval } from '../lib/courseStorage';
import { fetchCalendarEvents, CanvasCalendarEvent, fetchCourseColors } from '../actions/canvas';
import { useCourses } from '../components/CoursesProvider';
import { getCourseColors, saveCourseColors, getCalendarSelectedCourses, saveCalendarSelectedCourses } from '../lib/courseStorage';

export default function CalendarPage() {
  const { courses } = useCourses();
  const [events, setEvents] = useState<CanvasCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseColors, setCourseColors] = useState<Record<number, string>>({});
  const [selectedCourses, setSelectedCourses] = useState<Set<number> | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Initialize selected courses - default to all courses selected
  useEffect(() => {
    const saved = getCalendarSelectedCourses();
    if (saved !== null) {
      setSelectedCourses(saved);
    } else {
      // Default: all courses selected
      setSelectedCourses(new Set(courses.map(c => c.canvasId)));
    }
  }, [courses]);

  // Load course colors from storage and fetch from Canvas if needed
  useEffect(() => {
    const loadCourseColors = async () => {
      const storedColors = getCourseColors();
      const token = getCanvasToken();
      
      if (!token || courses.length === 0) {
        if (Object.keys(storedColors).length > 0) {
          setCourseColors(storedColors);
        }
        return;
      }

      // Check which courses need colors fetched
      const coursesNeedingColors = courses.filter(
        c => !storedColors[c.canvasId]
      );

      if (coursesNeedingColors.length > 0) {
        try {
          const fetchedColors = await fetchCourseColors(
            token,
            coursesNeedingColors.map(c => c.canvasId)
          );
          const updatedColors = { ...storedColors, ...fetchedColors };
          saveCourseColors(updatedColors);
          setCourseColors(updatedColors);
        } catch (err) {
          console.error('Error fetching course colors:', err);
          // Use stored colors if fetch fails
          if (Object.keys(storedColors).length > 0) {
            setCourseColors(storedColors);
          }
        }
      } else {
        setCourseColors(storedColors);
      }
    };

    loadCourseColors();
  }, [courses]);

  // Fetch calendar events
  const loadCalendarEvents = useCallback(async () => {
    const token = getCanvasToken();
    if (!token || courses.length === 0) {
      setEvents([]);
      return;
    }

    // Determine which courses to fetch
    // null means all courses are selected (default), empty Set means none selected
    const coursesToFetch = selectedCourses === null 
      ? new Set(courses.map(c => c.canvasId))
      : selectedCourses;
    
    // Don't fetch if no courses are selected
    if (coursesToFetch.size === 0) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calculate date range (current month ± 1 month)
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Build context codes for selected courses
      const contextCodes = Array.from(coursesToFetch).map(id => `course_${id}`);

      const calendarEvents = await fetchCalendarEvents(
        token,
        startDateStr,
        endDateStr,
        contextCodes
      );
      setEvents(calendarEvents);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load calendar events';
      setError(errorMessage);
      console.error('Error loading calendar events:', err);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, courses, selectedCourses]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  // Auto-refresh calendar events on interval
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const setupAutoRefresh = () => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const token = getCanvasToken();
    if (!token || courses.length === 0) return;

    const intervalMinutes = getAutoRefreshInterval();
    if (intervalMinutes <= 0) return; // Auto-refresh disabled

    const intervalMs = intervalMinutes * 60 * 1000;

    // Set up new interval
    intervalRef.current = setInterval(() => {
      loadCalendarEvents();
    }, intervalMs);
  };

  useEffect(() => {
    setupAutoRefresh();

    // Listen for interval changes
    const handleIntervalChange = () => {
      setupAutoRefresh();
    };
    
    window.addEventListener('autoRefreshIntervalChanged', handleIntervalChange);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      window.removeEventListener('autoRefreshIntervalChanged', handleIntervalChange);
    };
  }, [loadCalendarEvents, courses.length]); // Re-setup interval when load function or courses change

  // Toggle course selection
  const toggleCourseSelection = (courseId: number) => {
    const newSelected = new Set(selectedCourses || courses.map(c => c.canvasId));
    
    if (newSelected.has(courseId)) {
      newSelected.delete(courseId);
    } else {
      newSelected.add(courseId);
    }

    setSelectedCourses(newSelected);
    saveCalendarSelectedCourses(newSelected);
  };

  // Get course color with fallback
  const getCourseColor = (courseId: number): string => {
    return courseColors[courseId] || '#002E5D'; // Default BYU blue
  };

  // Parse context code to get course ID
  const getCourseIdFromContext = (contextCode: string): number | null => {
    const match = contextCode.match(/^course_(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Filter events by selected courses
  const filteredEvents = useMemo(() => {
    if (!selectedCourses) return events;
    return events.filter(event => {
      const courseId = getCourseIdFromContext(event.context_code);
      return courseId !== null && selectedCourses.has(courseId);
    });
  }, [events, selectedCourses]);

  // Helper function to get local date string from ISO string
  const getLocalDateString = (isoString: string): string => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Group events by date (using local timezone)
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CanvasCalendarEvent[]> = {};
    
    filteredEvents.forEach(event => {
      // Use all_day_date if available, otherwise parse start_at in local timezone
      let dateKey: string;
      if (event.all_day_date) {
        dateKey = event.all_day_date;
      } else if (event.start_at) {
        dateKey = getLocalDateString(event.start_at);
      } else {
        return; // Skip events without a date
      }
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });

    // Sort events within each date by start time
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const timeA = a.start_at || '';
        const timeB = b.start_at || '';
        return timeA.localeCompare(timeB);
      });
    });

    return grouped;
  }, [filteredEvents]);

  // Get current month name and year
  const monthYear = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  // Check if a course is selected
  const isCourseSelected = (courseId: number): boolean => {
    return selectedCourses ? selectedCourses.has(courseId) : true;
  };

  // Generate calendar grid for current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean; dateStr: string }> = [];

    // Add previous month's trailing days
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({
        date,
        isCurrentMonth: false,
        dateStr: date.toISOString().split('T')[0],
      });
    }

    // Add current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        dateStr: date.toISOString().split('T')[0],
      });
    }

    // Add next month's leading days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows × 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        dateStr: date.toISOString().split('T')[0],
      });
    }

    return days;
  }, [currentDate]);

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Format time display for events - show deadline if start and end are the same
  const formatEventTime = (event: CanvasCalendarEvent): string => {
    if (event.all_day) {
      return 'All Day';
    }
    
    if (!event.start_at) {
      return '';
    }

    // Check if start and end times are essentially the same (within 1 minute)
    if (event.end_at) {
      const startTime = new Date(event.start_at).getTime();
      const endTime = new Date(event.end_at).getTime();
      const diffMinutes = Math.abs(endTime - startTime) / (1000 * 60);
      
      // If they're the same or very close (like same minute), treat as deadline
      if (diffMinutes < 2) {
        return `Due at ${formatTime(event.start_at)}`;
      }
      
      return `${formatTime(event.start_at)} - ${formatTime(event.end_at)}`;
    }
    
    // No end time, just show start time as deadline
    return `Due at ${formatTime(event.start_at)}`;
  };

  // Get selected date's events (defaults to today)
  const selectedDateEvents = useMemo(() => {
    return eventsByDate[selectedDate] || [];
  }, [eventsByDate, selectedDate]);

  // Check if selected date is today
  const isSelectedDateToday = selectedDate === new Date().toISOString().split('T')[0];

  // Format selected date for display
  const selectedDateDisplay = useMemo(() => {
    const date = new Date(selectedDate + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (selectedDate === today.toISOString().split('T')[0]) {
      return "Today";
    } else if (selectedDate === tomorrow.toISOString().split('T')[0]) {
      return "Tomorrow";
    } else if (selectedDate === yesterday.toISOString().split('T')[0]) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#002E5D] mb-2 flex items-center gap-3">
            <CalendarIcon className="w-10 h-10" />
            Calendar
          </h1>
          <p className="text-lg text-gray-600">
            View assignments and events from Canvas
          </p>
        </div>
      </div>

      {/* Selected Date's Events Panel */}
      {!isLoading && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-[#002E5D] mb-4 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            {selectedDateDisplay}'s Schedule
          </h2>
          {selectedDateEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedDateEvents.map((event) => {
              const courseId = getCourseIdFromContext(event.context_code);
              const color = courseId ? getCourseColor(courseId) : '#002E5D';
              const course = courses.find(c => c.canvasId === courseId);
              
              return (
                <div
                  key={event.id}
                  className="p-4 rounded-lg border-l-4 hover:shadow-md transition-shadow"
                  style={{ borderLeftColor: color }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{event.title}</h3>
                        {course && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                            style={{ backgroundColor: color }}
                          >
                            {course.nickname}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatEventTime(event)}
                      </p>
                      {event.location_name && (
                        <p className="text-sm text-gray-500 mt-1">
                          📍 {event.location_name}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {event.description.replace(/<[^>]*>/g, '')}
                        </p>
                      )}
                    </div>
                    {event.html_url && (
                      <a
                        href={event.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#002E5D] hover:text-[#004080] text-sm font-medium whitespace-nowrap"
                      >
                        View →
                      </a>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No events scheduled for {selectedDateDisplay.toLowerCase()}</p>
            </div>
          )}
        </div>
      )}

      {/* Course Selection Panel */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-[#002E5D] mb-4">
          Select Courses to Display
        </h2>
        {courses.length === 0 ? (
          <p className="text-gray-500">No courses available. Please sync your Canvas account in Settings.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses.map((course) => {
              const isSelected = isCourseSelected(course.canvasId);
              const color = getCourseColor(course.canvasId);
              
              return (
                <button
                  key={course.canvasId}
                  onClick={() => toggleCourseSelection(course.canvasId)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-[#002E5D] bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      backgroundColor: isSelected ? color : 'white',
                      borderColor: color,
                    }}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    )}
                  </div>
                  <span className={`text-sm font-medium flex-1 text-left ${
                    isSelected ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {course.nickname}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Navigation */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-[#002E5D]">{monthYear}</h2>
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-[#002E5D] text-white rounded-lg hover:bg-[#004080] transition-colors text-sm font-medium"
            >
              Today
            </button>
          </div>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#002E5D]" />
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                const dayEvents = eventsByDate[day.dateStr] || [];
                const isToday = day.dateStr === new Date().toISOString().split('T')[0];
                const isSelected = day.dateStr === selectedDate;
                
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day.dateStr)}
                    className={`min-h-24 p-2 border rounded-lg text-left transition-all hover:shadow-md ${
                      day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                    } ${
                      isSelected 
                        ? 'ring-2 ring-[#002E5D] border-[#002E5D]' 
                        : isToday 
                        ? 'ring-1 ring-gray-400 border-gray-300' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    } ${isSelected ? 'text-[#002E5D] font-bold' : isToday ? 'text-[#002E5D] font-semibold' : ''}`}>
                      {day.date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => {
                        const courseId = getCourseIdFromContext(event.context_code);
                        const color = courseId ? getCourseColor(courseId) : '#002E5D';
                        
                        return (
                          <div
                            key={event.id}
                            className="text-xs p-1 rounded truncate"
                            style={{
                              backgroundColor: `${color}20`,
                              borderLeft: `3px solid ${color}`,
                              color: '#1f2937',
                            }}
                            title={event.title}
                          >
                            {event.all_day ? (
                              <span className="font-medium">{event.title}</span>
                            ) : (
                              <>
                                <span className="font-medium">{event.title}</span>
                                {' '}
                                <span className="text-gray-600 text-xs">{formatEventTime(event)}</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500 font-medium">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Event List for Selected Month */}
      {!isLoading && filteredEvents.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-[#002E5D] mb-4">
            Events in {monthYear}
          </h2>
          <div className="space-y-3">
            {Object.keys(eventsByDate)
              .sort()
              .filter(dateStr => {
                const date = new Date(dateStr);
                return date.getMonth() === currentDate.getMonth() && 
                       date.getFullYear() === currentDate.getFullYear();
              })
              .map((dateStr) => {
                const dateEvents = eventsByDate[dateStr];
                const date = new Date(dateStr);
                
                return (
                  <div key={dateStr} className="border-l-4 border-[#002E5D] pl-4 py-2">
                    <div className="font-semibold text-gray-900 mb-2">
                      {date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="space-y-2">
                      {dateEvents.map((event) => {
                        const courseId = getCourseIdFromContext(event.context_code);
                        const color = courseId ? getCourseColor(courseId) : '#002E5D';
                        const course = courses.find(c => c.canvasId === courseId);
                        
                        return (
                          <div
                            key={event.id}
                            className="p-3 rounded-lg border-l-4"
                            style={{ borderLeftColor: color }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-gray-900">{event.title}</h3>
                                  {course && (
                                    <span
                                      className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                                      style={{ backgroundColor: color }}
                                    >
                                      {course.nickname}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">
                                  {formatEventTime(event)}
                                </p>
                                {event.location_name && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    📍 {event.location_name}
                                  </p>
                                )}
                                {event.description && (
                                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                    {event.description.replace(/<[^>]*>/g, '')}
                                  </p>
                                )}
                              </div>
                              {event.html_url && (
                                <a
                                  href={event.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#002E5D] hover:text-[#004080] text-sm font-medium"
                                >
                                  View →
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {!isLoading && filteredEvents.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <CalendarIcon className="w-12 h-12 text-blue-400 mx-auto mb-2" />
          <p className="text-blue-800">No events found for the selected courses</p>
        </div>
      )}
    </div>
  );
}
