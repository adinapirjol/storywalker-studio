import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({subscribe:vi.fn(),stop:vi.fn(),renew:vi.fn()}));
vi.mock('./native-receiver',()=>({subscribeReceiver:mocks.subscribe}));
import {receiverStream} from './receiver-stream';
import type {ReceiverEvent} from './native-receiver';
let push:(event:ReceiverEvent)=>boolean,finish:(code?:string)=>void;
beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();mocks.renew.mockReturnValue(true);
 mocks.subscribe.mockImplementation((_id:string,emit:typeof push,close:typeof finish)=>{push=emit;finish=close;emit({type:'sample',sample:null});return {renew:mocks.renew,stop:mocks.stop};});
});
afterEach(()=>vi.useRealTimers());
it('streams updates immediately and abort releases the viewer without retaining a replay',async()=>{
 const abort=new AbortController(),reader=receiverStream('session',abort.signal).getReader();
 expect(new TextDecoder().decode((await reader.read()).value)).toContain('"sample":null');
 push({type:'contact',id:'fictional',at:'2030-05-01T12:00:00Z'});
 expect(new TextDecoder().decode((await reader.read()).value)).toContain('"type":"contact"');
 abort.abort();expect((await reader.read()).done).toBe(true);expect(mocks.stop).toHaveBeenCalledOnce();
});
it('expiry clears the subscription and closes with a fixed recovery code',async()=>{
 const reader=receiverStream('session',new AbortController().signal).getReader();await reader.read();
 mocks.renew.mockReturnValue(false);vi.advanceTimersByTime(1000);
 expect(new TextDecoder().decode((await reader.read()).value)).toContain('VAULT_LOCKED');
 expect((await reader.read()).done).toBe(true);expect(mocks.stop).toHaveBeenCalledOnce();
});
it('a slow reader coalesces a burst to its latest contact instead of disconnecting',async()=>{
 const reader=receiverStream('session',new AbortController().signal).getReader();
 for(let i=0;i<100;i++)expect(push({type:'contact',id:`fictional-${i}`,at:'2030-05-01T12:00:00Z'})).toBe(true);
 expect(new TextDecoder().decode((await reader.read()).value)).toContain('"sample":null');
 expect(new TextDecoder().decode((await reader.read()).value)).toContain('fictional-99');
 expect(mocks.stop).not.toHaveBeenCalled();await reader.cancel();
});
it('latest sample replaces superseded samples and absorbs only its own contact',async()=>{
 const reader=receiverStream('session',new AbortController().signal).getReader();
 const sample=(id:string)=>({type:'sample',sample:{observation:{id},arrivedAt:'2030-05-01T12:00:00Z'}} as ReceiverEvent);
 push(sample('superseded'));push(sample('latest'));
 push({type:'contact',id:'superseded',at:'2030-05-01T12:00:01Z'});
 push({type:'contact',id:'latest',at:'2030-05-01T12:00:02Z'});
 await reader.read();const frame=new TextDecoder().decode((await reader.read()).value);
 expect(frame).toContain('latest');expect(frame).not.toContain('superseded');expect(frame).toContain('lastContactAt');await reader.cancel();
});
it('expiry discards unread private data instead of draining it after revocation',async()=>{
 const reader=receiverStream('session',new AbortController().signal).getReader();
 push({type:'contact',id:'PRIVATE-CANARY',at:'2030-05-01T12:00:00Z'});
 mocks.renew.mockReturnValue(false);vi.advanceTimersByTime(1000);
 await expect(reader.read()).rejects.toThrow('STREAM_CLOSED');expect(mocks.stop).toHaveBeenCalledOnce();
});
it('replacing a viewer supplies an actionable terminal frame instead of a network error',async()=>{
 const reader=receiverStream('session',new AbortController().signal).getReader();await reader.read();
 finish('VIEWER_REPLACED');expect(new TextDecoder().decode((await reader.read()).value)).toContain('VIEWER_REPLACED');expect((await reader.read()).done).toBe(true);
});
it('reader cancellation performs cleanup without a controller error',async()=>{
 const reader=receiverStream('session',new AbortController().signal).getReader();await reader.cancel();expect(mocks.stop).toHaveBeenCalledOnce();
});
