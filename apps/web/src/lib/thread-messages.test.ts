import { describe, expect, it } from 'vitest';
import { formatMessageTime, messageAlignment, parseSystemEvents } from './thread-messages';

describe('parseSystemEvents', () => {
  it('parses legacy resolution proposal with embedded note', () => {
    const events = parseSystemEvents(
      'Management proposed this thread as resolved — awaiting resident confirmation: Resolved by vendor, please confirm',
    );
    const event = events[0];
    expect(event?.type).toBe('resolution_proposed');
    expect(event?.label).toBe('Marked as fixed — waiting for resident');
    expect(event?.detail).toBe('Resolved by vendor, please confirm');
  });

  it('parses resident confirmed (legacy and new copy)', () => {
    expect(parseSystemEvents('Resident confirmed the thread is resolved.')[0]?.label).toBe(
      'Resident confirmed — ticket closed',
    );
    expect(parseSystemEvents('Resident confirmed — ticket closed.')[0]?.type).toBe(
      'resolution_confirmed',
    );
  });

  it('splits compound status updates', () => {
    const events = parseSystemEvents('Category changed to BILLING; Thread reassigned');
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe('status_change');
    expect(events[1]?.label).toBe('Reassigned');
  });
});

describe('messageAlignment', () => {
  const residentMsg = {
    id: '1',
    threadId: 't',
    kind: 'MESSAGE' as const,
    body: 'hi',
    createdAt: new Date().toISOString(),
    author: { id: 'resident-1', name: 'Aisyah' },
  };
  const staffMsg = {
    ...residentMsg,
    id: '2',
    author: { id: 'staff-1', name: 'Admin' },
  };

  it('admin view: resident left, staff right', () => {
    expect(
      messageAlignment(residentMsg, {
        variant: 'admin',
        residentId: 'resident-1',
      }),
    ).toBe('left');
    expect(
      messageAlignment(staffMsg, {
        variant: 'admin',
        residentId: 'resident-1',
      }),
    ).toBe('right');
  });

  it('resident view: own messages right', () => {
    expect(
      messageAlignment(residentMsg, {
        variant: 'resident',
        viewerId: 'resident-1',
        residentId: 'resident-1',
      }),
    ).toBe('right');
    expect(
      messageAlignment(staffMsg, {
        variant: 'resident',
        viewerId: 'resident-1',
        residentId: 'resident-1',
      }),
    ).toBe('left');
  });
});

describe('formatMessageTime', () => {
  it('shows time only for same calendar day', () => {
    const now = new Date('2026-06-05T18:00:00');
    const label = formatMessageTime('2026-06-05T13:25:33', now);
    expect(label).toMatch(/1:25/);
    expect(label).not.toMatch(/6\/4/);
  });
});
