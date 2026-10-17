/** Comparable evidence identity. Raw history namespaces and actuals are never rewritten. */
(function(root) {
  const CONVENTIONS=['barbell_total','per_hand','single','added_bodyweight'];
  function tempo(value) {
    if(typeof value!=='string')return null;
    const text=value.trim();let phases;
    if(/^\d\d[\dxX]\d$/.test(text))phases=[...text];
    else {
      const delimited=text.match(/^(\d+)\s*([-/,])\s*(\d+)\s*\2\s*(\d+|[xX])\s*\2\s*(\d+)$/);
      const spaced=text.match(/^(\d+)\s+(\d+)\s+(\d+|[xX])\s+(\d+)$/);
      if(delimited)phases=[delimited[1],delimited[3],delimited[4],delimited[5]];
      else if(spaced)phases=spaced.slice(1);
      else return null;
    }
    const canonical=phases.map((phase,index)=>index===2&&/^[xX]$/.test(phase)?'X':Number(phase));
    if(canonical.some(phase=>phase!=='X'&&(!Number.isSafeInteger(phase)||phase<0)))return null;
    return canonical.join('-');
  }
  function key(p) {
    for(const name of ['athleteId','exerciseId','equipmentId']) {
      const id=p?.[name];
      if(typeof id!=='string'||!id||id.trim()!==id)throw new RangeError(`Invalid strength context ${name}`);
    }
    // Callers must normalize physical load first; plates are never a learning convention.
    if(!CONVENTIONS.includes(p.convention))throw new RangeError('Invalid normalized strength convention');
    return JSON.stringify([p.athleteId,p.exerciseId,p.equipmentId,p.convention,tempo(p.tempo)]);
  }
  function normalizeLoad(load) {
    if(!load||load.version!==3||!root.StrengthLoad)return null;
    const normalized=root.StrengthLoad.normalize({value:load.rawValue,unit:load.rawUnit,convention:load.convention,barKg:load.barKg,provenance:load.provenance});
    // Recompute once at the boundary to reject corrupt or mismatched envelope fields.
    return normalized&&Object.keys(normalized).every(name=>normalized[name]===load[name])?normalized:null;
  }
  function classifyLegacy(payload) {
    const load=normalizeLoad(payload?.normalizedLoad);
    if(load?.provenance==='explicit')return 'known_legacy_version';
    // No proven producer-version mapping: 5de771e7 and c4792bd4 both emit
    // contractVersion:2, across the change from total-bar to plates-only behavior.
    // Neither dates/titles nor a claimed known_legacy_version can resolve that ambiguity.
    return 'ambiguous_legacy';
  }
  root.StrengthContext={tempo,key,normalizeLoad,classifyLegacy};
})(typeof window!=='undefined'?window:globalThis);
