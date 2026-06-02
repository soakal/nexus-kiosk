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

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getMockEvents(): MockEvent[] {
  return [
    {
      id: 'event-standup-1',
      subject: 'Daily Standup',
      start: { dateTime: `${dayOffset(0)}T08:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(0)}T08:15:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Jon Shantry', address: 'jons@vrs-inc.com' } },
      bodyPreview: 'Daily team sync',
      isOnlineMeeting: true,
    },
    {
      id: 'event-standup-2',
      subject: 'Daily Standup',
      start: { dateTime: `${dayOffset(1)}T08:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(1)}T08:15:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Jon Shantry', address: 'jons@vrs-inc.com' } },
      bodyPreview: 'Daily team sync',
      isOnlineMeeting: true,
    },
    {
      id: 'event-standup-3',
      subject: 'Daily Standup',
      start: { dateTime: `${dayOffset(2)}T08:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(2)}T08:15:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Jon Shantry', address: 'jons@vrs-inc.com' } },
      bodyPreview: 'Daily team sync',
      isOnlineMeeting: true,
    },
    {
      id: 'event-standup-4',
      subject: 'Daily Standup',
      start: { dateTime: `${dayOffset(3)}T08:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(3)}T08:15:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Jon Shantry', address: 'jons@vrs-inc.com' } },
      bodyPreview: 'Daily team sync',
      isOnlineMeeting: true,
    },
    {
      id: 'event-standup-5',
      subject: 'Daily Standup',
      start: { dateTime: `${dayOffset(4)}T08:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(4)}T08:15:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Jon Shantry', address: 'jons@vrs-inc.com' } },
      bodyPreview: 'Daily team sync',
      isOnlineMeeting: true,
    },
    {
      id: 'event-project-review',
      subject: 'Project Status Review',
      start: { dateTime: `${dayOffset(1)}T10:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(1)}T11:00:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Jon Shantry', address: 'jons@vrs-inc.com' } },
      bodyPreview: 'Review active project board — statuses, ship dates, blockers',
      isOnlineMeeting: false,
    },
    {
      id: 'event-customer-call',
      subject: 'Customer Call — Acme Corp',
      start: { dateTime: `${dayOffset(2)}T13:30:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(2)}T14:00:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Matt O', address: 'matto@vrs-inc.com' } },
      bodyPreview: 'Follow up on delivery timeline',
      isOnlineMeeting: true,
    },
    {
      id: 'event-shipping-review',
      subject: 'Shipping & Logistics Review',
      start: { dateTime: `${dayOffset(3)}T09:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(3)}T09:30:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Matt O', address: 'matto@vrs-inc.com' } },
      bodyPreview: 'Review pending shipments and carrier schedules',
      isOnlineMeeting: false,
    },
    {
      id: 'event-vendor-call',
      subject: 'Vendor Check-In',
      start: { dateTime: `${dayOffset(5)}T11:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(5)}T11:30:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Jon Shantry', address: 'jons@vrs-inc.com' } },
      bodyPreview: 'Parts availability update',
      isOnlineMeeting: true,
    },
    {
      id: 'event-weekly-all-hands',
      subject: 'Weekly All-Hands',
      start: { dateTime: `${dayOffset(7)}T09:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(7)}T10:00:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Jon Shantry', address: 'jons@vrs-inc.com' } },
      bodyPreview: 'Full team sync — active projects, priorities, announcements',
      isOnlineMeeting: false,
    },
    {
      id: 'event-pm-sync',
      subject: 'PM Sync',
      start: { dateTime: `${dayOffset(8)}T14:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(8)}T14:30:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Jon Shantry', address: 'jons@vrs-inc.com' } },
      bodyPreview: 'Project manager weekly alignment',
      isOnlineMeeting: true,
    },
    {
      id: 'event-delivery-confirm',
      subject: 'Delivery Confirmation — Job #4821',
      start: { dateTime: `${dayOffset(10)}T10:30:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(10)}T11:00:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Matt O', address: 'matto@vrs-inc.com' } },
      bodyPreview: 'Confirm freight pickup with carrier',
      isOnlineMeeting: false,
    },
    {
      id: 'event-monthly-review',
      subject: 'Monthly Operations Review',
      start: { dateTime: `${dayOffset(14)}T09:00:00`, timeZone: 'America/Chicago' },
      end: { dateTime: `${dayOffset(14)}T10:30:00`, timeZone: 'America/Chicago' },
      organizer: { emailAddress: { name: 'Jon Shantry', address: 'jons@vrs-inc.com' } },
      bodyPreview: 'Monthly KPI review, backlog analysis, team capacity',
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
