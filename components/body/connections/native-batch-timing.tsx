'use client';
import type {NativeSummary} from '@/lib/native/native-transfer';
import styles from './context-native-transfer.module.css';

function timestamp(value:string){
 return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'medium'}).format(new Date(value));
}
function range(start:string,end:string){return start===end?timestamp(start):`${timestamp(start)} → ${timestamp(end)}`;}
export function NativeBatchTimestamp({item}:{item:NativeSummary}){
 const format=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});
 const start=item.timing?.measuredStart??item.validatedAt;
 const end=item.timing?.measuredEnd??start;
 return <span className={styles.batchTimestamp} title={`Times shown in ${format.resolvedOptions().timeZone}`}>
  <span><strong>Received by app:</strong> {item.timing?.receivedStart&&item.timing?.receivedEnd?range(item.timing.receivedStart,item.timing.receivedEnd):'unavailable'}</span><br/>
  {start&&end?`${item.timing?'Measured':'Staged'} ${format.formatRange(new Date(start),new Date(end))}`:'Measurement date unavailable'}
 </span>;
}
export function NativeBatchTiming({item}:{item:NativeSummary}){
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 return <details className={styles.timingDetails}><summary>Timing & receipt details</summary><dl className={styles.timing} aria-label={`Batch ${item.id.slice(-8)} timing`}>
  <dt>Measured</dt><dd>{item.timing?range(item.timing.measuredStart,item.timing.measuredEnd):item.count?'Timing unavailable; reload saved transfers':'No retained measurements'}</dd>
  <dt>Received by app</dt><dd>{item.timing?range(item.timing.receivedStart,item.timing.receivedEnd):item.count?'Timing unavailable; reload saved transfers':'No retained receipt times'}</dd>
  <dt>Staged on Mac</dt><dd>{item.validatedAt?timestamp(item.validatedAt):'Time not recorded by the earlier version'}</dd>
  <dt>Accepted on Mac</dt><dd>{item.acceptedAt?timestamp(item.acceptedAt):item.status==='pending-review'?'Awaiting review':'Time not recorded'}</dd>
  <dt>Display timezone</dt><dd>{zone}</dd>
 </dl></details>;
}
