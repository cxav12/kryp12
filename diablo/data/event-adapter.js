/** Provider-neutral event state and a clock-based schedule adapter. */
export class EventSourceAdapter {
  async fetchState(){throw new Error('A provider adapter must implement fetchState()')}
  normalize(_payload){throw new Error('A provider adapter must implement normalize()')}
}

export function validateEventState(state){
  return Boolean(state&&Number.isInteger(state.schemaVersion)&&['live','cached','stale','unavailable'].includes(state.freshness)&&Array.isArray(state.upcoming));
}

const addMinutes=(date,minutes)=>new Date(date.getTime()+minutes*60000);

function occurrence(anchor,cadenceMinutes,now){
  const cadence=cadenceMinutes*60000;
  const cycles=Math.floor((now.getTime()-anchor.getTime())/cadence);
  const start=new Date(anchor.getTime()+cycles*cadence);
  return start.getTime()>now.getTime()?addMinutes(start,-cadenceMinutes):start;
}

function normalizedEvent(type,label,start,durationMinutes,extra={}){
  return {id:`${type}-${start.toISOString()}`,type,label,start:start.toISOString(),end:addMinutes(start,durationMinutes).toISOString(),...extra};
}

export class ProjectedScheduleAdapter extends EventSourceAdapter {
  constructor(config,now=()=>new Date()){super();this.config=config;this.now=now}
  async fetchState(){return this.normalize(this.config)}
  normalize(config){
    const now=this.now();
    const bossConfig=config.schedules.worldBoss;
    const bossCurrent=occurrence(new Date(bossConfig.anchor),bossConfig.cadenceMinutes,now);
    const bossActive=now<addMinutes(bossCurrent,bossConfig.durationMinutes);
    const bossStart=bossActive?bossCurrent:addMinutes(bossCurrent,bossConfig.cadenceMinutes);
    const worldBoss=normalizedEvent('world-boss','World Boss',bossStart,bossConfig.durationMinutes,{active:bossActive,name:null,location:null});

    const hellConfig=config.schedules.helltide;
    const hourStart=new Date(now);hourStart.setUTCMinutes(0,0,0);
    const hellActive=now<addMinutes(hourStart,hellConfig.durationMinutes);
    const hellStart=hellActive?hourStart:addMinutes(hourStart,hellConfig.cadenceMinutes);
    const helltide=normalizedEvent('helltide','Helltide',hellStart,hellConfig.durationMinutes,{active:hellActive,location:null});

    const upcoming=[];
    const horizon=addMinutes(now,config.upcomingHorizonMinutes);
    const pushSeries=(type,label,start,cadence,duration)=>{
      let cursor=start;
      while(cursor<horizon){if(addMinutes(cursor,duration)>now)upcoming.push(normalizedEvent(type,label,cursor,duration));cursor=addMinutes(cursor,cadence)}
    };
    pushSeries('world-boss','World Boss',bossStart,bossConfig.cadenceMinutes,bossConfig.durationMinutes);
    pushSeries('helltide','Helltide',hellStart,hellConfig.cadenceMinutes,hellConfig.durationMinutes);
    const legion=config.schedules.legion;
    const legionCurrent=occurrence(new Date(legion.anchor),legion.cadenceMinutes,now);
    const legionStart=now<addMinutes(legionCurrent,legion.durationMinutes)?legionCurrent:addMinutes(legionCurrent,legion.cadenceMinutes);
    pushSeries('legion','Legion',legionStart,legion.cadenceMinutes,legion.durationMinutes);
    upcoming.sort((a,b)=>new Date(a.start)-new Date(b.start));

    return {schemaVersion:1,freshness:'cached',projection:true,provider:config.provider,verifiedAt:config.verifiedAt,lastSuccessfulUpdate:new Date().toISOString(),advisory:config.advisory,worldBoss,helltide,upcoming};
  }
}
