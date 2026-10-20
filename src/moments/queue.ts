import {randomUUID} from 'expo-crypto';
import {Directory, File, Paths} from 'expo-file-system';
import {openDatabaseSync} from 'expo-sqlite';
import * as api from './api';

export type PendingMoment={
  id:string;userId:string;fileUri:string;caption:string;recipientIds:string[];
  status:'pending'|'sending'|'failed'|'sent';error:string|null;momentId:string|null;created:number;
};
type Row={id:string;user_id:string;file_uri:string;caption:string;recipients:string;status:PendingMoment['status'];error:string|null;moment_id:string|null;created:number};
const queueFolder=()=>new Directory(Paths.document,'LUMA-pending');
let database:ReturnType<typeof openDatabaseSync>|null=null;
function db(){
  if(!database){
    const next=openDatabaseSync('luma-moments.db');
    next.execSync(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS outgoing (
        id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL,file_uri TEXT NOT NULL,
        caption TEXT NOT NULL,recipients TEXT NOT NULL,status TEXT NOT NULL,
        error TEXT,moment_id TEXT,created INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS outgoing_by_user ON outgoing(user_id,created DESC);`);
    next.runSync("UPDATE outgoing SET status='pending' WHERE status='sending'");
    database=next;
  }
  return database;
}
const decode=(row:Row):PendingMoment=>({...row,userId:row.user_id,fileUri:row.file_uri,recipientIds:JSON.parse(row.recipients),momentId:row.moment_id});
export function listOutgoing(userId:string):PendingMoment[]{
  return db().getAllSync<Row>('SELECT * FROM outgoing WHERE user_id=? ORDER BY created DESC',userId).map(decode);
}
export async function queueMoment(uri:string,caption:string,recipientIds:string[]):Promise<PendingMoment>{
  const account=await api.session();
  if(!account)throw new Error('Cần đăng nhập để gửi ảnh.');
  const recipients=[...new Set(recipientIds)].filter(id=>id!==account.user.id);
  if(!recipients.length)throw new Error('Hãy chọn ít nhất một người bạn.');
  const original=new File(uri);
  if(!original.exists||!original.size||original.size>10*1024*1024)throw new Error('Ảnh không tồn tại hoặc vượt giới hạn 10 MB.');
  const id=randomUUID();
  const folder=queueFolder();if(!folder.exists)folder.create({intermediates:true,idempotent:true});
  const queued=new File(folder,id+'.jpg');
  try{
    original.copy(queued);
    db().runSync('INSERT INTO outgoing(id,user_id,file_uri,caption,recipients,status,created) VALUES(?,?,?,?,?,?,?)',
      id,account.user.id,queued.uri,caption.trim().slice(0,240),JSON.stringify(recipients),'pending',Date.now());
  }catch(e){try{if(queued.exists)queued.delete();}catch{}throw e;}
  return listOutgoing(account.user.id).find(row=>row.id===id)!;
}
let sending=false;
export async function flushOutgoing(){
  if(sending||!api.configured())return;
  const account=await api.session();if(!account)return;
  sending=true;
  try{
    const rows=listOutgoing(account.user.id).filter(row=>row.status==='pending'||row.status==='failed');
    for(const row of rows){
      db().runSync("UPDATE outgoing SET status='sending',error=NULL WHERE id=? AND user_id=?",row.id,account.user.id);
      try{
        if(!new File(row.fileUri).exists)throw new Error('Ảnh chờ gửi đã mất khỏi thiết bị.');
        const momentId=String(await api.sendMoment(row.fileUri,row.caption,row.recipientIds,row.id));
        db().runSync("UPDATE outgoing SET status='sent',moment_id=?,error=NULL WHERE id=?",momentId,row.id);
        try{new File(row.fileUri).delete();}catch{}
      }catch(e){
        db().runSync("UPDATE outgoing SET status='failed',error=? WHERE id=?",e instanceof Error?e.message:String(e),row.id);
        // A network outage affects the remaining queue; leave them ready for the next retry.
        if(!(e instanceof api.HttpError))break;
      }
    }
  }finally{sending=false;}
}
export function discardOutgoing(userId:string,id:string){
  const row=db().getFirstSync<Row>('SELECT * FROM outgoing WHERE user_id=? AND id=?',userId,id);
  if(!row||row.status==='sending')return;
  db().runSync('DELETE FROM outgoing WHERE user_id=? AND id=?',userId,id);
  const file=new File(row.file_uri);if(file.exists)file.delete();
}
