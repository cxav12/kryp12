import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const assetRoot=path.join(root,'assets');
const legacyRoots=['equipment','talismans','gear'];
const imageExtensions=new Set(['.png','.webp','.svg','.jpg','.jpeg']);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function walk(directory){const files=[];for(const entry of await fs.readdir(directory,{withFileTypes:true})){const full=path.join(directory,entry.name);if(entry.isDirectory())files.push(...await walk(full));else files.push(full)}return files}

const allFiles=await walk(root);
const searchable=allFiles.filter(file=>!file.includes(`${path.sep}assets${path.sep}`)&&!file.includes(`${path.sep}.git${path.sep}`)&&['.html','.js','.mjs','.json','.css','.md'].includes(path.extname(file).toLowerCase()));
const text=await Promise.all(searchable.map(async file=>({file,body:await fs.readFile(file,'utf8').catch(()=> '')})));
const manifest=JSON.parse(await fs.readFile(path.join(root,'data/assets.json'),'utf8'));
const inventory=[];
for(const folder of legacyRoots){
  const directory=path.join(assetRoot,folder);
  for(const file of (await walk(directory)).filter(file=>imageExtensions.has(path.extname(file).toLowerCase()))){
    const bytes=await fs.readFile(file),relative=path.relative(root,file).replaceAll('\\','/'),filename=path.basename(file);
    const references=text.filter(record=>record.body.includes(relative)||record.body.includes(filename)).map(record=>path.relative(root,record.file).replaceAll('\\','/'));
    const production=[...Object.values(manifest.assets)].filter(asset=>asset.provenance?.sourcePath===relative).map(asset=>asset.id);
    let classification='UNUSED',reason='No runtime or data reference remains.';
    if(production.length){classification='DUPLICATE';reason=`Copied into the centralized production tree for ${production.join(', ')}; source retained pending visual verification.`}
    else if(folder==='gear'){classification='KEEP';reason='Small approved legacy set retained until a verified DiabloTools/D4Analyzer replacement is available.'}
    else if(references.length){classification='UNKNOWN';reason='Referenced outside the centralized asset manifest and requires review.'}
    inventory.push({filename,path:relative,entity:path.basename(file,path.extname(file)),sha256:hash(bytes),bytes:bytes.length,references,productionAssetIds:production,classification,reason,provenance:folder==='gear'?'See assets/gear/SOURCES.md':'Legacy D4Guides-derived catalog; replacement pending'});
  }
}
const duplicateGroups=Object.values(Object.groupBy(inventory,item=>item.sha256)).filter(group=>group.length>1).map(group=>group.map(item=>item.path));
const summary={total:inventory.length,byClassification:Object.fromEntries(Object.entries(Object.groupBy(inventory,item=>item.classification)).map(([key,value])=>[key,value.length])),duplicateHashGroups:duplicateGroups.length};
const report={generatedAt:new Date().toISOString(),summary,inventory,duplicateGroups};
await fs.writeFile(path.join(root,'data/legacy-asset-inventory.json'),`${JSON.stringify(report,null,2)}\n`);
const retained=inventory.filter(item=>item.classification!=='UNUSED').map(item=>`- ${item.path} — ${item.classification}: ${item.reason}`);
const lines=['# Legacy Diablo asset audit','',`Generated: ${report.generatedAt}`,'',`- Total legacy images: ${summary.total}`,...Object.entries(summary.byClassification).map(([key,value])=>`- ${key}: ${value}`),`- Duplicate hash groups: ${summary.duplicateHashGroups}`,'','## Retained or review-required assets','',...retained,'','## Removal candidates','',`See legacy-asset-inventory.json for the ${summary.byClassification.UNUSED||0} individually identified unused files. Nothing is deleted by this audit.`];
await fs.writeFile(path.join(root,'data/legacy-asset-audit.md'),`${lines.join('\n')}\n`);
console.log(JSON.stringify(summary,null,2));
