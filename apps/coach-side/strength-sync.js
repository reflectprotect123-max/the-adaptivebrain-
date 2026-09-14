/** RIPPED 2026-09-03 — athlete engine wiring removed. Package libraries remain under packages/. See docs/superpowers/specs/2026-09-03-autopilot-clean-rebuild-plan.md */
(function(g){
  var api = { ripped: true, hasStrength: function(){return false}, hasEngine: function(){return false} };
  if (typeof module !== "undefined") module.exports = api;
  g.StrengthAdapter = g.StrengthAdapter || api;
  g.EngineAdapter = g.EngineAdapter || api;
  g.BigMacBridge = g.BigMacBridge || { ripped: true };
  g.CondIntervalAutoreg = g.CondIntervalAutoreg || { ripped: true };
  g.StrengthOneSetLogger = g.StrengthOneSetLogger || { ripped: true };
  g.CondSessionLogger = g.CondSessionLogger || { ripped: true };
  g.CoordinatorAdapter = g.CoordinatorAdapter || { ripped: true };
})(typeof window !== "undefined" ? window : globalThis);
