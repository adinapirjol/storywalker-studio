/** Synthetic canaries only; audit subprocesses operate in disposable directories. */
import {afterEach,expect,it} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const roots:string[]=[];
const canary='fictional-audit-'+ 'canary-value-'.repeat(3);
function sandbox(){const root=mkdtempSync(join(tmpdir(),'audit-fixture-'));roots.push(root);mkdirSync(join(root,'private-data/storywalker'),{recursive:true});mkdirSync(join(root,'.next/static'),{recursive:true});mkdirSync(join(root,'.next/server/app'),{recursive:true});writeFileSync(join(root,'.gitignore'),'private-data/\n.logfire/\n.next/\n');spawnSync('git',['init','-q'],{cwd:root});return root;}
function run(root:string,script:string){return spawnSync(process.execPath,[resolve('scripts',script)],{cwd:root,encoding:'utf8',env:{PATH:process.env.PATH,NODE_ENV:'test'}});}
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
it.each(['.next/static/chunk.js','.next/server/app/page.html','.next/server/app/page.rsc'])('detects recovery provenance canaries in %s without echoing them',file=>{
 const root=sandbox();writeFileSync(join(root,'private-data/storywalker/fictional.recovery.private.json'),JSON.stringify({moments:[{provenance:[{shortExcerpt:canary}]}]}));
 writeFileSync(join(root,file),'public safe text');expect(run(root,'audit-build-private.mjs').status).toBe(0);
 writeFileSync(join(root,file),canary);const result=run(root,'audit-build-private.mjs');expect(result.status).not.toBe(0);expect(result.stderr).toContain('local private marker');expect(result.stderr).not.toContain(canary);
});
it('detects discovered recovery and credential values in committable files',()=>{
 const root=sandbox();writeFileSync(join(root,'private-data/storywalker/fictional.recovery.private.json'),JSON.stringify({moments:[{title:canary}]}));
 writeFileSync(join(root,'public.txt'),'safe');expect(run(root,'audit-public-repo.mjs').status).toBe(0);
 writeFileSync(join(root,'public.txt'),canary);expect(run(root,'audit-public-repo.mjs').status).not.toBe(0);
 mkdirSync(join(root,'.logfire'));const token='fictional-short-key';writeFileSync(join(root,'.logfire/logfire_credentials.json'),JSON.stringify({token}));writeFileSync(join(root,'public.txt'),token);
 const result=run(root,'audit-public-repo.mjs');expect(result.status).not.toBe(0);expect(result.stderr).not.toContain(token);
 writeFileSync(join(root,'.next/static/chunk.js'),token);expect(run(root,'audit-build-private.mjs').status).not.toBe(0);
});
it.each(['malformed','symlink','dangling-symlink','oversize','invalid-shape'])('fails closed for %s audit inputs without private diagnostics',kind=>{
 const root=sandbox(),path=join(root,'private-data/storywalker/fictional.recovery.private.json');
 if(kind.includes('symlink'))symlinkSync(join(root,kind==='symlink'?'.gitignore':'missing'),path);else writeFileSync(path,kind==='oversize'?'x'.repeat(16_000_001):kind==='invalid-shape'?JSON.stringify({moments:'invalid'}):'{invalid');
 for(const script of ['audit-public-repo.mjs','audit-build-private.mjs']){const result=run(root,script);expect(result.status).not.toBe(0);expect(result.stderr).toContain('audit stopped');expect(result.stderr).not.toContain('fictional.recovery');}
});
