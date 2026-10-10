import type {ContextState} from './context-contract';
import {xrSceneSchema,type XRScene,type Decision} from './xr-scene';
/** Bounded, silent adapter into the existing room renderer. No life entities created. */
export function contextRoom(state:ContextState):{scene:XRScene;decisions:Record<string,Decision>} {
 const decisions:Record<string,Decision>={};
 const cues:XRScene['cues']=state.captures.slice(0,3).flatMap((capture,index)=>{
  const proposals=state.proposals.filter(p=>p.capture_id===capture.id);const proposal=proposals.at(-1);
  const currentDecision=state.decisions.filter(d=>d.proposal_id===proposal?.id).at(-1);
  const previousDecision=state.decisions.filter(d=>proposals.some(p=>p.id===d.proposal_id)).at(-1);
  const decision=currentDecision??(previousDecision&&['refused','unresolved'].includes(previousDecision.status)?previousDecision:undefined);
  const memory=state.memories.filter(m=>m.id.startsWith(capture.id)).at(-1);
  const heart=state.observations.find(o=>o.id===capture.triggering_ids[0]);
  return ['WORLD','TIME','BODY','MEMORY'].map((dimension,i)=>{
   const id=`context-${index}-${dimension.toLowerCase()}`;
   const approved=dimension!=='MEMORY'||Boolean(memory&&memory.support==='supported'&&decision&&['accepted','revised'].includes(decision.status));
   decisions[id]=dimension==='MEMORY'&&decision?.status==='refused'?'refused':approved?'accepted':'pending';
   const note=dimension==='WORLD'?`Approximate fictional geography; ${capture.context.stale_location?'stale or missing':'uncertain'}. No exact venue or route.`:dimension==='TIME'?`${capture.context.start} to ${capture.context.end}; current revision ${capture.context.revision}; approved revision ${memory?.context_revision??'none'}.`:dimension==='BODY'?`${heart?.payload.kind==='heart_rate'?heart.payload.value+' bpm':'Source deleted'}. Display scale 0–200 bpm. Sample span ${capture.context.coverage_s}s is coverage, not confidence in emotional meaning.`:memory?`${memory.text} Support: ${memory.support}. Relationship: ${decision?.status??'awaiting review'}.`:`Meaning relationship: ${decision?.status??'awaiting Author'}.`;
   return {id,title:`${dimension} · window ${index+1}`,source:'demo' as const,provenance:'Explicitly fictional scenario; selected context and retained Author decision references.',note:note.slice(0,1000),x:dimension==='MEMORY'&&memory?(state.placements??[]).filter(p=>p.memory_id===memory.id).at(-1)?.x??12:-12+i*8,z:-8+index*8,radius:3,frequency:174,treatment:'silent' as const,colour:'#a8bba5',minutes:1,evidence:{kind:'source-analysis' as const,sourceId:capture.id,facts:[`Context revision ${capture.context.revision}`,`Evidence references: ${capture.context.observation_ids.join(', ')}`],authorLabels:[],interpretation:dimension==='MEMORY'?decision?.status??'unresolved':'source-recorded fictional evidence'}};
  });
 });
 if(!cues.length){decisions['context-empty']='pending';cues.push({id:'context-empty',title:'No context captured',source:'demo',provenance:'Empty fictional scenario sandbox.',note:'Replay observations to capture a window. No evidence or meaning is present.',x:0,z:0,radius:1,frequency:174,treatment:'silent',minutes:1});}
 return {scene:xrSceneSchema.parse({version:1,title:'BODY–WORLD–TIME–MEMORY · fictional review',cues}),decisions};
}
