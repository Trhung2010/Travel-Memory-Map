import type {JourneyMemory,JourneyState,Trip,TripDraft,TripStatus} from './types';

const DATE_PATTERN=/^(\d{4})-(\d{2})-(\d{2})$/;

export function localDateString(date=new Date()):string{
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,'0');
  const day=String(date.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
}

export function isValidLocalDate(value:string):boolean{
  const match=DATE_PATTERN.exec(value);
  if(!match)return false;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const parsed=new Date(year,month-1,day);
  return parsed.getFullYear()===year&&parsed.getMonth()===month-1&&parsed.getDate()===day;
}

export function deriveTripStatus(startDate:string,endDate:string,today=localDateString()):TripStatus{
  return endDate<today?'completed':startDate>today?'upcoming':'active';
}

export function validateTripDraft(input:TripDraft):TripDraft{
  const normalized={...input,title:input.title.trim(),destination:input.destination.trim(),description:input.description.trim()};
  if(!normalized.title||!normalized.destination)throw new Error('Tên chuyến đi và điểm đến là bắt buộc.');
  if(normalized.title.length>80)throw new Error('Tên chuyến đi tối đa 80 ký tự.');
  if(normalized.destination.length>100)throw new Error('Điểm đến tối đa 100 ký tự.');
  if(normalized.description.length>500)throw new Error('Mô tả tối đa 500 ký tự.');
  if(!isValidLocalDate(normalized.startDate)||!isValidLocalDate(normalized.endDate))throw new Error('Ngày phải hợp lệ và theo định dạng YYYY-MM-DD.');
  if(normalized.endDate<normalized.startDate)throw new Error('Ngày kết thúc không thể trước ngày bắt đầu.');
  return normalized;
}

export function parseCoordinates(latitudeInput:string,longitudeInput:string):{latitude?:number;longitude?:number}{
  const latitudeText=latitudeInput.trim(),longitudeText=longitudeInput.trim();
  if(!latitudeText&&!longitudeText)return {};
  if(!latitudeText||!longitudeText)throw new Error('Cần nhập đủ cả vĩ độ và kinh độ.');
  const latitude=Number(latitudeText),longitude=Number(longitudeText);
  if(!Number.isFinite(latitude)||latitude<-90||latitude>90)throw new Error('Vĩ độ phải nằm trong khoảng -90 đến 90.');
  if(!Number.isFinite(longitude)||longitude<-180||longitude>180)throw new Error('Kinh độ phải nằm trong khoảng -180 đến 180.');
  return {latitude,longitude};
}

function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null;}
export function validItinerary(value:unknown,startDate:string,endDate:string):boolean{
  if(value===undefined)return true;
  if(!Array.isArray(value)||value.length>2000)return false;
  const ids=new Set<string>();
  return value.every(item=>{
    if(!isRecord(item)||typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item.date!=='string'||!isValidLocalDate(item.date)||item.date<startDate||item.date>endDate||typeof item.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)||typeof item.place!=='string'||!item.place.trim()||item.place.length>100||typeof item.visited!=='boolean')return false;
    ids.add(item.id);return true;
  });
}
const MEMORY_KINDS=new Set(['photo','video','audio','note','document']);
function isTrip(value:unknown):value is Trip{
  if(!isRecord(value))return false;
  if(value.coverUri!==undefined&&typeof value.coverUri!=='string')return false;
  if(value.trace!==undefined){
    const trace=value.trace;
    if(!isRecord(trace)||typeof trace.message!=='string'||!trace.message.trim()||trace.message.length>500||
      typeof trace.latitude!=='number'||!Number.isFinite(trace.latitude)||Math.abs(trace.latitude)>90||
      typeof trace.longitude!=='number'||!Number.isFinite(trace.longitude)||Math.abs(trace.longitude)>180)return false;
  }
  if(typeof value.startDate!=='string'||typeof value.endDate!=='string'||!validItinerary(value.itinerary,value.startDate,value.endDate))return false;
  try{validateTripDraft(value as TripDraft);}catch{return false;}
  return typeof value.id==='string'&&typeof value.title==='string'&&typeof value.destination==='string'&&typeof value.description==='string'&&
    typeof value.startDate==='string'&&typeof value.endDate==='string'&&isValidLocalDate(value.startDate)&&isValidLocalDate(value.endDate);
}
function isMemory(value:unknown):value is JourneyMemory{
  if(!isRecord(value))return false;
  if(typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt)))return false;
  if(value.uri!==undefined&&(typeof value.uri!=='string'||!value.uri))return false;
  if(value.fileName!==undefined&&typeof value.fileName!=='string')return false;
  if(value.mimeType!==undefined&&typeof value.mimeType!=='string')return false;
  if(value.durationMs!==undefined&&(typeof value.durationMs!=='number'||!Number.isFinite(value.durationMs)||value.durationMs<0))return false;
  if(typeof value.title!=='string'||value.title.length>100||typeof value.note!=='string'||value.note.length>1000)return false;
  if(value.favorite!==undefined&&typeof value.favorite!=='boolean')return false;
  if(value.tags!==undefined&&(!Array.isArray(value.tags)||value.tags.length>10||!value.tags.every(tag=>typeof tag==='string'&&tag.length<=250)))return false;
  if(value.deletedAt!==undefined&&(typeof value.deletedAt!=='string'||!Number.isFinite(Date.parse(value.deletedAt))))return false;
  const hasLatitude=value.latitude!==undefined,hasLongitude=value.longitude!==undefined;
  return typeof value.id==='string'&&typeof value.tripId==='string'&&typeof value.kind==='string'&&MEMORY_KINDS.has(value.kind)&&typeof value.title==='string'&&
    typeof value.note==='string'&&typeof value.createdAt==='string'&&hasLatitude===hasLongitude&&
    (!hasLatitude||typeof value.latitude==='number'&&Number.isFinite(value.latitude)&&value.latitude>=-90&&value.latitude<=90&&
      typeof value.longitude==='number'&&Number.isFinite(value.longitude)&&value.longitude>=-180&&value.longitude<=180);
}

export function parseJourneyState(raw:string):JourneyState{
  const parsed:unknown=JSON.parse(raw);
  if(!isRecord(parsed)||!Array.isArray(parsed.trips)||!Array.isArray(parsed.memories)||!parsed.trips.every(isTrip)||!parsed.memories.every(isMemory))throw new Error('Dữ liệu hành trình trên máy không hợp lệ.');
  const trips=parsed.trips.map(trip=>({...trip,status:deriveTripStatus(trip.startDate,trip.endDate)}));
  const tripIds=new Set(trips.map(trip=>trip.id));
  if(tripIds.size!==trips.length||new Set(parsed.memories.map(memory=>memory.id)).size!==parsed.memories.length)throw new Error('Dữ liệu hành trình có mã bị trùng.');
  if(parsed.memories.some(memory=>!tripIds.has(memory.tripId)))throw new Error('Dữ liệu kỷ niệm không còn chuyến đi tương ứng.');
  return {trips,memories:parsed.memories};
}

