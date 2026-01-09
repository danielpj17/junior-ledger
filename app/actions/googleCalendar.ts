'use server';

import ical from 'node-ical';
import { CanvasCalendarEvent } from './canvas';

/**
 * Fetch and parse Google Calendar iCal feed
 * Maps iCal events to CanvasCalendarEvent format for compatibility with the UI
 */
export async function fetchGoogleCalendarEvents(
  feedUrl: string,
  startDate?: string,
  endDate?: string
): Promise<CanvasCalendarEvent[]> {
  try {
    // Fetch the iCal feed
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Junior-Ledger/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Calendar feed: ${response.status} ${response.statusText}`);
    }

    const icalText = await response.text();
    
    // Parse the iCal data
    const events = ical.parseICS(icalText);
    
    // Filter and convert events to CanvasCalendarEvent format
    const calendarEvents: CanvasCalendarEvent[] = [];
    const startDateObj = startDate ? new Date(startDate) : null;
    const endDateObj = endDate ? new Date(endDate + 'T23:59:59') : null;

    for (const key in events) {
      const event = events[key];
      
      // Only process VEVENT type
      if (event.type !== 'VEVENT') continue;

      // Extract event details
      const start = event.start;
      const end = event.end;
      const summary = event.summary || 'Untitled Event';
      const description = event.description || null;
      const location = event.location || null;
      
      if (!start) continue; // Skip events without start time

      // Check if event is within date range
      if (startDateObj && start < startDateObj) continue;
      if (endDateObj && start > endDateObj) continue;

      // Determine if all-day event
      // All-day events in iCal typically have dates without times (or start at midnight)
      // Check if the start date has no time component or spans a full day
      const isAllDay = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0 && 
                       (!end || (end.getTime() - start.getTime() >= 86400000 && end.getHours() === 0 && end.getMinutes() === 0));

      // Format dates as ISO strings
      const startAt = start.toISOString();
      const endAt = end ? end.toISOString() : null;
      
      // For all-day events, use date string without time
      const allDayDate = isAllDay ? start.toISOString().split('T')[0] : null;

      // Generate a stable ID from the event's UID or use timestamp
      const eventId = event.uid ? parseInt(event.uid.replace(/\D/g, '').slice(-9) || '0', 10) || Date.now() : Date.now();

      // Parse location into name and address
      let locationName = null;
      let locationAddress = null;
      if (location) {
        // Try to split location by common separators
        const locationParts = location.split(',').map(s => s.trim());
        if (locationParts.length > 1) {
          locationName = locationParts[0];
          locationAddress = locationParts.slice(1).join(', ');
        } else {
          locationName = location;
        }
      }

      // Detect event type based on keywords in title or description
      const eventText = `${summary} ${description || ''}`.toLowerCase();
      let eventType = 'google-calendar';
      
      // Check for exam/test/quiz keywords
      const examKeywords = ['exam', 'final', 'midterm', 'test', 'quiz', 'assessment', 'evaluation'];
      const hasExamKeyword = examKeywords.some(keyword => eventText.includes(keyword));
      
      if (hasExamKeyword) {
        eventType = 'google-calendar-exam';
      }

      // Create event in CanvasCalendarEvent format
      const calendarEvent: CanvasCalendarEvent = {
        id: eventId,
        title: summary,
        start_at: startAt,
        end_at: endAt,
        description: description,
        location_name: locationName,
        location_address: locationAddress,
        context_code: 'google_calendar', // Use a special context code for Google Calendar events
        workflow_state: 'active',
        url: event.url || '',
        html_url: event.url || '',
        all_day: isAllDay,
        all_day_date: allDayDate,
        created_at: event.created ? event.created.toISOString() : startAt,
        updated_at: event.lastmodified ? event.lastmodified.toISOString() : startAt,
        type: eventType,
      };

      calendarEvents.push(calendarEvent);
    }

    // Sort events by start time
    calendarEvents.sort((a, b) => {
      const timeA = new Date(a.start_at).getTime();
      const timeB = new Date(b.start_at).getTime();
      return timeA - timeB;
    });

    return calendarEvents;
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    throw error instanceof Error
      ? error
      : new Error('Failed to fetch Google Calendar events');
  }
}