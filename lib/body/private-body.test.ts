import {expect,it} from 'vitest';
import {privateBodyWindow,nextAcceptedBodyBatch} from './private-body';
import type {BodyReview} from './body-review-contract';
import fixture from './body-preview.fictional.json';
it('private presentation excludes fictional evidence, leaves context unknown and removes absent support',()=>{
 const fictional=fixture.observations.find(o=>o.payload.kind==='heart_rate')!;
 const realShaped={...fictional,source_type:'healthkit',acquisition:'historical'};
 const review={observations:[fictional,realShaped],markers:[],notifications:0,canonical:false} as unknown as BodyReview;
 const result=privateBodyWindow('test-batch',2,review);
 expect(result[0].readings).toHaveLength(1);
 expect(result[0].locations).toEqual([]);expect(result[0].listening).toEqual([]);
 expect(result[0].relationship).toBe('source evidence only');
 expect(privateBodyWindow('test-batch',3,{...review,observations:[]})).toEqual([]);
});

it('follows only newly accepted HealthKit evidence, never staged, deleted or simulated batches',()=>{
 const base={id:'new',mode:'healthkit',status:'accepted-evidence',revision:2,count:3,deletionCount:0} as const;
 const items=[{...base,id:'mock',mode:'simulated' as const},{...base,id:'pending',status:'pending-review' as const},{...base,id:'deleted',status:'deleted' as const},{...base,id:'empty',count:0},{...base,id:'seen'},base];
 expect(nextAcceptedBodyBatch(items,new Set(['seen']))?.id).toBe('new');
 expect(nextAcceptedBodyBatch(items,new Set(['seen','new']))).toBeUndefined();
});
