import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {followReceiver} from './receiver-client';
const viewerID='00000000-0000-4000-8000-000000000000';
const ended=()=>new Response(new ReadableStream({start(c){c.close();}}),{status:200});
const closed=(code:string)=>new Response(`data: ${JSON.stringify({type:'closed',code})}\n\n`,{status:200});
beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
it('recovers transport interruption through the existing stream without restarting the receiver',async()=>{
 const abort=new AbortController(),states:string[]=[];
 const fetcher=vi.fn<typeof fetch>().mockRejectedValueOnce(Error('PRIVATE-NETWORK-CANARY')).mockResolvedValueOnce(ended());
 const task=followReceiver({signal:abort.signal,viewerID,fetcher,onEvent:vi.fn(),onState:s=>{states.push(s.message);if(s.phase==='connected')abort.abort();}});
 await vi.advanceTimersByTimeAsync(1000);await task;
 expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls.every(([url])=>url==='/api/context-receiver/stream')).toBe(true);
 expect(fetcher.mock.calls[1][1]?.headers).toEqual({'X-Storywalker-Viewer':viewerID,'X-Storywalker-Reconnect':'1'});
 expect(states.join(' ')).not.toContain('PRIVATE-');
});
it.each(['VAULT_LOCKED','VIEWER_REPLACED','HEALTHKIT_RECEIVER_REQUIRED'])('does not retry a terminal %s or reopen private access',async code=>{
 const onState=vi.fn(),fetcher=vi.fn<typeof fetch>().mockResolvedValue(closed(code));
 await followReceiver({signal:new AbortController().signal,viewerID,fetcher,onEvent:vi.fn(),onState});
 expect(fetcher).toHaveBeenCalledOnce();expect(onState.mock.calls.at(-1)?.[0].phase).toBe('stopped');
});
it('does not retry an expired session even when the HTTP body is missing',async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:401})),onState=vi.fn();
 await followReceiver({signal:new AbortController().signal,viewerID,fetcher,onEvent:vi.fn(),onState});
 expect(fetcher).toHaveBeenCalledOnce();expect(onState.mock.calls.at(-1)?.[0].message).toContain('Vault session expired');
});
it('cancels a scheduled reconnect when the page hides or the user stops',async()=>{
 const abort=new AbortController(),fetcher=vi.fn<typeof fetch>().mockResolvedValue(ended());
 const task=followReceiver({signal:abort.signal,viewerID,fetcher,onEvent:vi.fn(),onState:s=>{if(s.phase==='retrying')abort.abort();}});
 await task;await vi.advanceTimersByTimeAsync(10000);expect(fetcher).toHaveBeenCalledOnce();
});
it('bounds retries and ends with a helpful message rather than a raw exception',async()=>{
 const fetcher=vi.fn<typeof fetch>().mockRejectedValue(Error('network error PRIVATE-CANARY')),onState=vi.fn();
 const task=followReceiver({signal:new AbortController().signal,viewerID,fetcher,onEvent:vi.fn(),onState});
 await vi.advanceTimersByTimeAsync(8000);await task;
 expect(fetcher).toHaveBeenCalledTimes(4);expect(onState.mock.calls.at(-1)?.[0]).toEqual({phase:'stopped',message:expect.stringContaining('Click Go live')});
 expect(JSON.stringify(onState.mock.calls)).not.toContain('PRIVATE-');
});
it('rejects a malformed stream instead of retrying arbitrary data',async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('data: invalid-json\n\n')),onState=vi.fn();
 await followReceiver({signal:new AbortController().signal,viewerID,fetcher,onEvent:vi.fn(),onState});
 expect(fetcher).toHaveBeenCalledOnce();expect(onState.mock.calls.at(-1)?.[0].message).toContain('could not be read');
});
