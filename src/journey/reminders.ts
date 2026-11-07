import {isValidLocalDate,localDateString} from './validation.ts';

export function diaryReminderDates(startDate:string,endDate:string,time:string,now=new Date()):Date[]{
  if(!isValidLocalDate(startDate)||!isValidLocalDate(endDate)||endDate<startDate)throw new Error('Ngày chuyến đi không hợp lệ.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Giờ phải theo định dạng HH:mm.');
  const today=localDateString(now);
  const day=new Date(`${startDate>today?startDate:today}T${time}:00`);
  const end=new Date(endDate+'T23:59:59');
  const dates:Date[]=[];
  while(day<=end){
    if(day.getTime()>now.getTime())dates.push(new Date(day));
    if(dates.length>60)throw new Error('Mỗi lần đặt nhắc tối đa 60 ngày. Hãy rút ngắn khoảng chuyến đi.');
    day.setDate(day.getDate()+1);
  }
  if(!dates.length)throw new Error('Chuyến đi không còn ngày nhắc trong tương lai.');
  return dates;
}
