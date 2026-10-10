import type {BodyReview} from './body-review-contract';
import type {BodyWindow} from './body-composition';
import type {NativeSummary} from './native-transfer';

/** Only explicitly accepted, nonempty HealthKit batches can enter automatic review. */
export function nextAcceptedBodyBatch(items:NativeSummary[],seen:ReadonlySet<string>){
 return items.find(item=>item.mode==='healthkit'&&item.status==='accepted-evidence'&&item.count>0&&!seen.has(item.id));
}

/** Private presentation adapter. Never feeds the fictional ContextState or saved scenes. */
export function privateBodyWindow(id:string,revision:number,review:BodyReview):BodyWindow[]{
 const readings=review.observations.filter(o=>o.source_type==='healthkit'&&o.acquisition!=='simulated'&&o.payload.kind==='heart_rate');
 if(!readings.length)return [];
 return [{id,revision,start:readings[0].event_start,end:readings.at(-1)!.event_end,readings,listening:[],locations:[],relationship:'source evidence only',support:'no canonical account',stale:true}];
}
