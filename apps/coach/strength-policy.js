/** Versioned conservative strength policy. Simulator may compare overrides. */
(function(root) {
  root.StrengthPolicy=Object.freeze({
    version:'strength-v3-conservative',
    learningMode:'default',
    learningVersion:'online-v1',
    upCap:.05,
    warmupUpCap:.10,
    downCap:.10,
    observationBlend:.15,
    learningBlend:.10
  });
})(typeof window!=='undefined'?window:globalThis);
