import {describe,it,expect} from 'vitest';
import {summaryPacket} from './health-summary';

describe('allowlisted external summaries',()=>{
 it('exports only aggregate values and app receipt times, never raw source extras',()=>{
  const summary={version:1 as const,summary_id:'a'.repeat(64),source:'watch' as const,received_count:20,preferred_count:18,maximum_bpm:91.123,received_start:'2026-10-08T10:00:00Z',received_end:'2026-10-08T10:00:20Z',observations:[{source_id:'private-canary',notes:'private-note',location:'private-place'}]};
  const packet=summaryPacket(summary,'received-batch',1000);
  const record=packet.resourceLogs[0].scopeLogs[0].logRecords[0];
  expect(record.timeUnixNano).toBe('1000000000');
  expect(record.attributes.find(a=>a.key==='maximum_bpm')?.value).toEqual({doubleValue:91.123});
  expect(record.attributes.map(a=>a.key)).toEqual(['summary_id','source','pipeline','received_count','preferred_count','maximum_bpm','app_received_start','app_received_end','logfire.span_type']);
  expect(JSON.stringify(packet)).not.toContain('private-canary');expect(JSON.stringify(packet)).not.toContain('private-note');expect(JSON.stringify(packet)).not.toContain('private-place');
 });
});
