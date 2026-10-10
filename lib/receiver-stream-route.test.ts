import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({active:vi.fn(),status:vi.fn(),stream:vi.fn(),connection:vi.fn()}));
vi.mock('./native-receiver',()=>({receiverSessionActive:mocks.active,receiverStatus:mocks.status,assertReceiverConnection:mocks.connection}));
vi.mock('./receiver-stream',()=>({receiverStream:mocks.stream}));
vi.mock('./vault-session',()=>({VAULT_SESSION_COOKIE:'test-session'}));
import {POST} from '../app/api/context-receiver/stream/route';
const request=(origin='http://127.0.0.1:3000')=>new NextRequest('http://127.0.0.1:3000/api/context-receiver/stream',{method:'POST',headers:{origin,host:'127.0.0.1:3000',cookie:'test-session=fictional-cookie'}});
beforeEach(()=>{vi.clearAllMocks();mocks.connection.mockReset();mocks.active.mockReturnValue(true);mocks.status.mockReturnValue({running:true,mode:'healthkit'});mocks.stream.mockReturnValue(new ReadableStream({start(c){c.close();}}));});
it('requires local same-origin and a live cookie session before creating a stream',async()=>{
 expect((await POST(request('https://other.example'))).status).toBe(403);
 mocks.active.mockReturnValue(false);expect((await POST(request())).status).toBe(401);
 expect(mocks.stream).not.toHaveBeenCalled();
});
it('rejects unavailable and fictional receivers without restarting or creating pairing',async()=>{
 mocks.status.mockReturnValue({running:true,mode:'simulated'});expect((await POST(request())).status).toBe(422);
 mocks.status.mockReturnValue({running:false,mode:'healthkit'});expect((await POST(request())).status).toBe(422);expect(mocks.stream).not.toHaveBeenCalled();
});
it('uses an uncached SSE response and passes cancellation through to the viewer',async()=>{
 const r=request(),response=await POST(r);expect(response.status).toBe(200);
 expect(response.headers.get('content-type')).toBe('text/event-stream');expect(response.headers.get('cache-control')).toContain('no-store');
 expect(mocks.stream).toHaveBeenCalledWith('fictional-cookie',r.signal,undefined);
});
it('reconnects only the same viewer and rejects malformed viewer identifiers',async()=>{
 const r=request();r.headers.set('X-Storywalker-Viewer','00000000-0000-4000-8000-000000000000');r.headers.set('X-Storywalker-Reconnect','1');
 expect((await POST(r)).status).toBe(200);expect(mocks.connection).toHaveBeenCalledWith('fictional-cookie',{id:'00000000-0000-4000-8000-000000000000',reconnect:true});
 mocks.connection.mockImplementation(()=>{throw Error('VIEWER_REPLACED');});
 expect(await (await POST(r)).json()).toEqual({code:'VIEWER_REPLACED'});
 const malformed=request();malformed.headers.set('X-Storywalker-Reconnect','1');expect((await POST(malformed)).status).toBe(400);
});
