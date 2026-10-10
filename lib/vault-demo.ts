import {xrSceneSchema, type XRScene} from './xr-scene';

/** A view over existing episodes, never a new autobiography or listening analysis. */
export function buildVaultDemo(source: XRScene, selected: string[]): XRScene {
 const ids = new Set(selected);
 if (!ids.size || ids.size > 3 || ids.size !== selected.length || !source.journeyLayout) throw Error('Invalid demo selection');
 const episodes = (source.journeyEpisodes ?? []).filter(e=>ids.has(e.id)).map(e=>{
  const nodes=e.provenance.nodes.filter(n=>n.type!=='lastfm');
  const kept=new Set(nodes.map(n=>n.id));
  return {...e,listening:undefined,provenance:{nodes,edges:e.provenance.edges.filter(x=>kept.has(x.evidenceId))},context:e.context.filter(c=>kept.has(c.evidenceId))};
 });
 if (episodes.length!==ids.size) throw Error('Source window unavailable');
 const sourceIds=new Set(episodes.flatMap(e=>e.provenance.nodes.map(n=>n.sourceId)));
 return xrSceneSchema.parse({version:1,title:'One window, several possible readings',
  draft:{status:'draft',privacy:'private',canonical:false,authorLabels:[],assemblyReason:'Selected existing Vault windows. Positions retain their source basis; meaning remains open. BODY and listening are not included in this rehearsal.',sourceRequest:'Private subset rehearsal from the existing encrypted XR draft. No new imports or external calls.'},
  journeyEpisodes:episodes,
  journeyLayout:{...source.journeyLayout,from:episodes[0].start,toExclusive:episodes.at(-1)!.end,sources:source.journeyLayout.sources.filter(s=>s.type!=='lastfm'&&sourceIds.has(s.id)),coverage:{...source.journeyLayout.coverage,visits:episodes.filter(e=>e.provenance.nodes.some(n=>n.type==='timeline')).length,baselinePlays:0,duplicatePlays:0,matchedPlays:0,ambiguousPlays:0,unmatchedPlays:0},rules:['Subset of previously reviewed source windows; original coordinates and timing uncertainty retained.','Coverage outside these windows is not represented. BODY and listening are absent.']},
  experience:{regime:'WORLD',memoryBase:'WORLD',fragmentDecisions:[]},
  cues:episodes.map((e,i)=>({id:`subset-window-${i+1}`,title:e.label.slice(0,120),source:'google-maps',provenance:'Display marker for an existing source-linked window; inspect the source desk for its actual geography basis.',note:'Silent display marker. No new Author statement or interpretation.',x:e.worldPosition!.position.x,z:e.worldPosition!.position.z,radius:3,frequency:220,minutes:5,treatment:'silent'})),
 });
}
