"use strict";
var HybridBrain = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // packages/brain/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    buildBrainPacket: () => buildBrainPacket,
    coachContextFromPacket: () => coachContextFromPacket,
    scoreReadiness: () => scoreReadiness
  });

  // packages/brain/src/readiness.ts
  function n(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }
  function whoopRecoveryPenalty(v) {
    if (!v) return 0;
    if (v >= 67) return -10;
    if (v >= 34) return 0;
    if (v >= 20) return 10;
    return 20;
  }
  function scoreReadiness(metrics, checkin) {
    const recovery = n(metrics.recovery);
    const sleepQ = n(checkin.sleepQuality);
    const energy = n(checkin.energy);
    const soreness = n(checkin.muscleSoreness);
    const joint = n(checkin.jointStress);
    const mental = n(checkin.mentalStress);
    const wearable = Math.max(0, whoopRecoveryPenalty(recovery));
    const subjective = Math.max(0, (10 - sleepQ) * 2) + Math.max(0, (10 - energy) * 2) + soreness * 2.5 + joint * 4 + mental * 3;
    const score = wearable + subjective;
    const signals = [
      ["WHOOP recovery", Math.max(0, whoopRecoveryPenalty(recovery))],
      ["sleep quality", Math.max(0, (10 - sleepQ) * 2)],
      ["energy", Math.max(0, (10 - energy) * 2)],
      ["soreness", soreness * 2.5],
      ["joint stress", joint * 4],
      ["mental stress", mental * 3]
    ];
    signals.sort((a, b) => b[1] - a[1]);
    const reason = signals.find(([, v]) => v > 0)?.[0] ?? "balanced";
    let todayCall = "control";
    let label = "Control";
    if (score <= 8 && recovery >= 67) {
      todayCall = "build";
      label = "Build";
    } else if (score >= 28 || recovery < 25) {
      todayCall = "minimum";
      label = "Minimum";
    }
    return { todayCall, label, reason, score };
  }

  // packages/brain/src/packet.ts
  function buildBrainPacket(input) {
    const checkin = input.checkin ?? {};
    const readiness = scoreReadiness(input.metrics, checkin);
    return {
      date: input.date,
      room: input.room,
      metrics: input.metrics,
      checkin,
      todayCall: readiness.todayCall,
      label: readiness.label,
      reason: readiness.reason,
      connected: {
        whoop: !!input.connected?.whoop,
        concept2: !!input.connected?.concept2
      }
    };
  }
  function coachContextFromPacket(packet) {
    return {
      date: packet.date,
      room: packet.room,
      today_call: packet.todayCall,
      label: packet.label,
      main_limiter: packet.reason,
      metrics: packet.metrics,
      checkin: packet.checkin,
      connected: packet.connected
    };
  }
  return __toCommonJS(index_exports);
})();
