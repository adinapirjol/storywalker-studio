import type {Observation} from '@/lib/native/native-transfer-contract';
import type {BodyWindow} from './body-composition';
/** Presentation freshness only. Older evidence can retain a clearly labelled last-known pose. */
export const BODY_FRESH_MS=120_000;
export const BODY_LINK_MS=15_000;
export type BodyLiveSample={observation:Observation;arrivedAt:string;lastContactAt?:string};
export function liveSampleValid(value:BodyLiveSample|null,now=Date.now()){
 if(!value)return false;
 const measured=Date.parse(value.observation.event_start),arrived=Date.parse(value.arrivedAt),contact=Date.parse(value.lastContactAt??value.arrivedAt);
 return [measured,arrived,contact].every(Number.isFinite)&&measured<=now&&arrived<=now&&contact<=now;
}
export function liveSampleFresh(value:BodyLiveSample|null,now=Date.now()){
 return liveSampleValid(value,now)&&!!value&&now-Date.parse(value.observation.event_start)<=BODY_FRESH_MS&&now-Date.parse(value.lastContactAt??value.arrivedAt)<=BODY_LINK_MS;
}
export function sampleAge(value:BodyLiveSample,now=Date.now()){
 const seconds=Math.max(0,Math.floor((now-Date.parse(value.observation.event_start))/1000));
 if(seconds<60)return `${seconds} seconds`;
 const minutes=Math.floor(seconds/60);if(minutes<60)return `${minutes} ${minutes===1?'minute':'minutes'}`;
 const hours=Math.floor(minutes/60);if(hours<24)return `${hours} ${hours===1?'hour':'hours'}`;
 const days=Math.floor(hours/24);return `${days} ${days===1?'day':'days'}`;
}
export function liveSampleStatus(value:BodyLiveSample|null,now=Date.now()){
 if(!liveSampleValid(value,now)||!value)return 'Mac receiver ready · waiting for a Watch reading. On iPhone, tap Start companion feed.';
 const link=now-Date.parse(value.lastContactAt??value.arrivedAt)<=BODY_LINK_MS;
 return `${liveSampleFresh(value,now)?'Recent reading':'Last-known pose · not current'} · measured ${sampleAge(value,now)} ago.${link?' Waiting for the next measurement.':' Phone delivery quiet; keeping the last-known pose.'}`;
}
export function liveBodyWindows(value:BodyLiveSample|null,now=Date.now()):BodyWindow[]{
 if(!liveSampleValid(value,now)||!value)return [];
 const o=value.observation;
 return [{id:'incoming-preview',revision:0,start:o.event_start,end:o.event_end,readings:[o],listening:[],locations:[],relationship:'temporary incoming preview',support:'not accepted evidence',stale:!liveSampleFresh(value,now)}];
}
