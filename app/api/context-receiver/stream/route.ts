import {NextRequest,NextResponse} from 'next/server';
import {isLocalSameOrigin} from '@/lib/local-origin';
import {VAULT_SESSION_COOKIE} from '@/lib/vault-session';
import {receiverSessionActive,receiverStatus,assertReceiverConnection} from '@/lib/native-receiver';
import {receiverStream} from '@/lib/receiver-stream';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 if(!isLocalSameOrigin(request))return NextResponse.json({code:'LOCAL_ORIGIN_REQUIRED'},{status:403});
 const id=request.cookies.get(VAULT_SESSION_COOKIE)?.value;
 if(!receiverSessionActive(id))return NextResponse.json({code:'VAULT_LOCKED'},{status:401,headers:{'Cache-Control':'no-store'}});
 const status=receiverStatus();
 if(!status.running||status.mode!=='healthkit')return NextResponse.json({code:'HEALTHKIT_RECEIVER_REQUIRED'},{status:422,headers:{'Cache-Control':'no-store'}});
 const viewerID=request.headers.get('X-Storywalker-Viewer'),reconnect=request.headers.get('X-Storywalker-Reconnect')==='1';
 if((viewerID!==null&&!/^[a-f0-9-]{36}$/i.test(viewerID))||(reconnect&&!viewerID))return NextResponse.json({code:'STREAM_INVALID'},{status:400,headers:{'Cache-Control':'no-store'}});
 const connection=viewerID?{id:viewerID,reconnect}:undefined;
 try{assertReceiverConnection(id!,connection);}catch{return NextResponse.json({code:'VIEWER_REPLACED'},{status:409,headers:{'Cache-Control':'no-store'}});}
 return new Response(receiverStream(id!,request.signal,connection),{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'}});
}
