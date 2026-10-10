/** Fictional configuration only; filesystem and transport are intercepted. */
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({project:'https://logfire-eu.pydantic.dev/fictional/one',saved:{} as Record<string,unknown>}));
vi.mock('node:fs/promises',()=>({
 lstat:async()=>({isSymbolicLink:()=>false}),mkdir:async()=>{},chmod:async()=>{},
 readFile:async(path:string)=>JSON.stringify(path.endsWith('logfire_credentials.json')?{project_url:io.project,logfire_api_url:'https://logfire-eu.pydantic.dev',token:'fictional-token'}:io.saved),
 writeFile:async(_path:string,body:string)=>{io.saved=JSON.parse(body);},rename:async()=>{},unlink:async()=>{io.saved={};},
}));
beforeEach(()=>{vi.resetModules();Reflect.deleteProperty(globalThis,'__storywalkerSummary');io.project='https://logfire-eu.pydantic.dev/fictional/one';io.saved={};});
afterEach(()=>{vi.unstubAllEnvs();Reflect.deleteProperty(globalThis,'__storywalkerSummary');});
it.each(['','https://example.com/team/project','https://logfire-eu.pydantic.dev/team/project?redirect=x','https://logfire-eu.pydantic.dev/team/project/extra'])('fails closed for missing or invalid target %s',async target=>{
 vi.stubEnv('STORYWALKER_HEALTH_PROJECT_URL',target);
 const api=await import('./health-summary');
 expect(api.STORYWALKER_PROJECT).toBe('');
 await expect(api.configureSummary(true)).rejects.toThrow('TARGET_UNAVAILABLE');
 expect((await api.summaryStatus()).enabled).toBe(false);
});
it('requires exact credential match and never silently adopts a new target',async()=>{
 vi.stubEnv('STORYWALKER_HEALTH_PROJECT_URL',io.project);
 const first=await import('./health-summary');await first.configureSummary(true);
 expect((await first.summaryStatus()).enabled).toBe(true);
 vi.stubEnv('STORYWALKER_HEALTH_PROJECT_URL','https://logfire-eu.pydantic.dev/fictional/two');
 expect(first.STORYWALKER_PROJECT).toBe(io.project); // Pinned until restart.
 vi.resetModules();Reflect.deleteProperty(globalThis,'__storywalkerSummary');
 const second=await import('./health-summary');
 expect((await second.summaryStatus()).enabled).toBe(false);
 await expect(second.configureSummary(true)).rejects.toThrow('TARGET_UNAVAILABLE');
 io.project=second.STORYWALKER_PROJECT;
 expect((await second.summaryStatus()).enabled).toBe(false);
 await second.configureSummary(true);
 expect((await second.summaryStatus()).enabled).toBe(true);
 expect(io.saved.project).toBe(io.project);
});
