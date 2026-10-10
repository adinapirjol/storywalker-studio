import { z } from 'zod';
export const researchSessionSchema=z.object({
 study:z.enum(['refusal','echo','linz']),
 sourceContext:z.string().max(6000).default(''),
 title:z.string().trim().min(1).max(200),
 note:z.string().max(4000),
 entries:z.array(z.object({action:z.string().min(1).max(100),subject:z.string().max(300),wording:z.string().max(4000).optional(),at:z.string().datetime().optional()})).max(500),
 sourceWindowId:z.string().max(200).optional(),
 mode:z.enum(['fictional','simulation','live']).default('fictional'),
});
export type ResearchSession=z.infer<typeof researchSessionSchema>;
export function researchPayload(input:z.input<typeof researchSessionSchema>,at:string){
 const record=researchSessionSchema.parse(input);
 const evidence=[`Research study: ${record.study}. Mode: ${record.mode}. Editorial actions only; not attendance or geographic evidence.`,record.sourceContext,record.note,...record.entries.map(e=>`${e.action}: ${e.subject}${e.wording?` — ${e.wording}`:''}`)].join('\n');
 return {...record,evidence,source:'research-session',privacy:'private',canonical:false,reviewStatus:'pending',evidenceStatus:'author-stated',researchRecordedAt:at,
 description:[`Research study: ${record.study}. Mode: ${record.mode}. This records editorial actions, not attendance or geographic evidence.`,record.sourceContext,record.note,...record.entries.map(e=>`${e.action}: ${e.subject}${e.wording?` — ${e.wording}`:''}`)].join('\n'),
 boundary:'Explicit scene links are Author composition only. Recording time is not a historical event time.'};
}
