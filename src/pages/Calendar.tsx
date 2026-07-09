import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const CalendarPage: React.FC = () => {
  const events = [
    { title: 'Mid-Term Exams', date: '2026-07-15', color: '#f59e0b' },
    { title: 'Sports Day', date: '2026-07-22', color: '#10b981' },
    { title: 'Parent-Teacher Meeting', date: '2026-07-10', color: '#3b82f6' },
    { title: 'Annual Day Practice', date: '2026-07-18', color: '#8b5cf6' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">School Calendar &amp; Events</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Academic Calendar 2026</CardTitle>
        </CardHeader>
        <CardContent>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            height="auto"
            editable={true}
            selectable={true}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,dayGridWeek'
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarPage;