import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async request=>{
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL');
  const anon=Deno.env.get('SUPABASE_ANON_KEY');
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!service)return json({error:'Server not configured'},503);
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer '))return json({error:'Authentication required'},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return json({error:'Invalid session'},401);
  let momentId:string;
  try{momentId=(await request.json()).momentId;}catch{return json({error:'Invalid body'},400);}
  if(!/^[0-9a-f-]{36}$/i.test(momentId||''))return json({error:'Invalid moment'},400);
  const admin=createClient(url,service);
  const {data:moment,error:momentError}=await admin.from('moments').select('id,owner_id,push_sent_at').eq('id',momentId).single();
  if(momentError||!moment||moment.owner_id!==user.id)return json({error:'Moment unavailable'},404);
  if(moment.push_sent_at)return json({delivered:true,duplicate:true});
  const {data:claimed,error:claimError}=await admin.from('moments').update({push_sent_at:new Date().toISOString()})
    .eq('id',momentId).is('push_sent_at',null).select('id');
  if(claimError)return json({error:'Cannot claim notification'},500);
  if(!claimed?.length)return json({delivered:true,duplicate:true});
  try{
    const {data:recipients,error:recipientError}=await admin.from('moment_recipients').select('recipient_id').eq('moment_id',momentId);
    if(recipientError)throw recipientError;
    const ids=[...new Set((recipients||[]).map(r=>r.recipient_id))];
    if(!ids.length)return json({delivered:true,count:0});
    const {data:tokens,error:tokenError}=await admin.from('push_tokens').select('token').in('user_id',ids);
    if(tokenError)throw tokenError;
    const unique=[...new Set((tokens||[]).map(t=>t.token))];
    if(!unique.length)return json({delivered:true,count:0});
    const response=await fetch('https://exp.host/--/api/v2/push/send',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(unique.map(to=>({to,title:'LUMA Moments',body:'Bạn vừa nhận một khoảnh khắc mới',data:{momentId},channelId:'moments'}))),
    });
    if(!response.ok)throw new Error(`Push API ${response.status}`);
    return json({delivered:true,count:unique.length});
  }catch(error){
    await admin.from('moments').update({push_sent_at:null}).eq('id',momentId);
    return json({error:String(error)},503);
  }
});
