import { GraphCalendar } from './calendars.js';

export interface MockEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  organizer: { emailAddress: { name: string; address: string } };
  bodyPreview: string;
  isOnlineMeeting: boolean;
}

export interface MockFile {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime: string;
}

export const mockCalendars: GraphCalendar[] = [
  {
    id: 'calendar-personal',
    name: 'Calendar',
    color: 'auto',
    hexColor: '#0078D4',
    isDefaultCalendar: true,
  },
  {
    id: 'calendar-team',
    name: 'Team Calendar',
    color: 'auto',
    hexColor: '#107C10',
    isDefaultCalendar: false,
  },
];

export function getMockEvents(): MockEvent[] {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return [
    {
      id: 'event-1',
      subject: 'Team Standup',
      start: {
        dateTime: tomorrow.toISOString().split('T')[0] + 'T09:00:00',
        timeZone: 'UTC',
      },
      end: {
        dateTime: tomorrow.toISOString().split('T')[0] + 'T09:30:00',
        timeZone: 'UTC',
      },
      organizer: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
      bodyPreview: 'Daily sync',
      isOnlineMeeting: true,
    },
    {
      id: 'event-2',
      subject: 'Project Review',
      start: {
        dateTime: nextWeek.toISOString().split('T')[0] + 'T14:00:00',
        timeZone: 'UTC',
      },
      end: {
        dateTime: nextWeek.toISOString().split('T')[0] + 'T15:30:00',
        timeZone: 'UTC',
      },
      organizer: { emailAddress: { name: 'Bob', address: 'bob@example.com' } },
      bodyPreview: 'Quarterly review of Q2 milestones',
      isOnlineMeeting: false,
    },
  ];
}

export const mockFiles: MockFile[] = [
  {
    id: 'file-1',
    name: 'Project Plan.docx',
    webUrl: 'https://sharepoint.example.com/files/project-plan',
    lastModifiedDateTime: new Date().toISOString(),
  },
  {
    id: 'file-2',
    name: 'Budget 2026.xlsx',
    webUrl: 'https://sharepoint.example.com/files/budget-2026',
    lastModifiedDateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'file-3',
    name: 'Team Handbook.pdf',
    webUrl: 'https://sharepoint.example.com/files/handbook',
    lastModifiedDateTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
