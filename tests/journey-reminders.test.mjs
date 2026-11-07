import test from 'node:test';
import assert from 'node:assert/strict';
import {diaryReminderDates} from '../src/journey/reminders.ts';
const now=new Date('2026-11-06T19:00:00');
test('reminders include today only if its chosen time is still ahead',()=>{
  const dates=diaryReminderDates('2026-11-01','2026-11-07','20:00',now);
  assert.equal(dates.length,2);assert.equal(dates[0].getDate(),6);assert.equal(dates[0].getHours(),20);
  assert.equal(diaryReminderDates('2026-11-01','2026-11-07','18:00',now).length,1);
});
test('reminders reject ended trips, invalid time and reversed ranges',()=>{
  assert.throws(()=>diaryReminderDates('2026-11-01','2026-11-05','20:00',now),/tương lai/);
  assert.throws(()=>diaryReminderDates('2026-11-07','2026-11-06','20:00',now),/Ngày/);
  assert.throws(()=>diaryReminderDates('2026-11-06','2026-11-07','24:00',now),/HH:mm/);
  assert.throws(()=>diaryReminderDates('2026-02-30','2026-11-07','20:00',now),/Ngày/);
});
test('reminders enforce sixty upcoming dates and skip historical days',()=>{
  assert.equal(diaryReminderDates('1900-01-01','2026-11-07','20:00',now).length,2);
  assert.equal(diaryReminderDates('2026-11-06','2027-01-04','20:00',now).length,60);
  assert.throws(()=>diaryReminderDates('2026-11-06','2027-01-05','20:00',now),/60/);
});
test('calendar stepping preserves wall-clock reminder hour through DST',()=>{
  const dates=diaryReminderDates('2026-10-31','2026-11-02','20:00',new Date('2026-10-30T00:00:00'));
  assert.deepEqual(dates.map(date=>date.getHours()),[20,20,20]);assert.equal(dates.length,3);
});
