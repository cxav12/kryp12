import fs from 'node:fs/promises';

const file=new URL('../../data/builds.json',import.meta.url);
const data=JSON.parse(await fs.readFile(file,'utf8'));
const slug=value=>String(value||'').normalize('NFKD').replace(/[’']/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();

for(const build of data.builds){
  build.classAssetId=`class:${slug(build.class)}`;
  if(build.mercenarySetup){
    build.mercenarySetup.mercenary.assetId=`mercenary:${slug(build.mercenarySetup.mercenary.name)}`;
    for(const selection of build.mercenarySetup.mercenary.selections)selection.assetId=`mercenary-skill:${slug(selection.name)}`;
    build.mercenarySetup.reinforcement.assetId=`mercenary:${slug(build.mercenarySetup.reinforcement.name)}`;
    build.mercenarySetup.reinforcement.skillAssetId=`mercenary-skill:${slug(build.mercenarySetup.reinforcement.skill)}`;
  }
  for(const variant of Object.values(build.variants)){
    for(const item of variant.equipment||[]){
      item.assetId=item.rarity==='Legendary'&&item.aspect?`aspect:${slug(item.aspect)}`:`item:${slug(item.name)}`;
      delete item.image;delete item.asset;
    }
    for(const item of variant.talismans||[]){
      const name=/damage multiplier seal/i.test(item.name)?'legendary-horadric-seal':slug(item.name);
      item.assetId=`talisman:${name}`;delete item.image;delete item.asset;
    }
    for(const skill of variant.skills||[]){
      skill.skillId=`skill:${slug(skill.name)}`;
      for(const modifier of skill.modifiers||[])if(typeof modifier==='object')modifier.assetId=`skill-modifier:${slug(modifier.name)}`;
    }
    for(const glyph of variant.glyphs||[])glyph.assetId=`glyph:${slug(glyph.name)}`;
    for(const expertise of variant.expertise||[])expertise.assetId=`class-mechanic:${slug(expertise.name)}`;
    for(const pair of variant.runePairs||[]){pair.trigger.assetId=`rune:${slug(pair.trigger.name)}`;pair.invoke.assetId=`rune:${slug(pair.invoke.name)}`}
    for(const system of variant.seasonalSystems||[])system.assetId=`seasonal:${slug(system.name)}`;
  }
}
await fs.writeFile(file,`${JSON.stringify(data,null,2)}\n`);
console.log('Normalized Diablo build entities to central asset IDs.');
