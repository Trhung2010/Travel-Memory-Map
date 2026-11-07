export type TripStatus = 'upcoming' | 'active' | 'completed';

export type Trip = {
  id: string;
  title: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  coverUri?: string;
  trace?: {latitude:number;longitude:number;message:string};
  status: TripStatus;
  itinerary?: {id:string;date:string;time:string;place:string;visited:boolean}[];
};

export type MemoryKind = 'photo' | 'video' | 'audio' | 'note' | 'document';

export type JourneyMemory = {
  id: string;
  tripId: string;
  kind: MemoryKind;
  title: string;
  note: string;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  uri?: string;
  fileName?: string;
  mimeType?: string;
  durationMs?: number;
  favorite?: boolean;
  tags?: string[];
  deletedAt?: string;
};

export type JourneyState = {trips:Trip[];memories:JourneyMemory[]};
export type TripDraft = Pick<Trip,'title'|'destination'|'description'|'startDate'|'endDate'>;
export type MemoryDraft = Omit<JourneyMemory,'id'|'createdAt'> & {createdAt?:string};


