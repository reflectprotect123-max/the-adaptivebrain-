/**
 * Coach intent LLM — parses prose into validated hints for deterministic engines.
 * LLM never returns load kg, reps, watts, or rounds directly.
 */
(function (global) {
  'use strict';

  var ENDPOINT = '/.netlify/functions/ai-coach-intent';
  var TIMEOUT_MS = 12000;
  var ALLOWED_GATES = { ok: true, caution: true, hold: true };
  var ALLOWED_EFFORT = { easy: true, medium: true, hard: true };
  var ALLOWED_FLAGS = { pain: true, illness: true, travel: true, deload: true, test: true };

  function validateCoachIntent(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var out = {
      recoveryGate: null,
      condEffort: null,
      sessionTone: null,
      flags: [],
      athleteCue: null,
      reasonCodes: [],
      confidence: 0.5,
      source: 'ai_openrouter',
    };
    var gate = String(raw.recovery_gate || raw.recoveryGate || '').toLowerCase();
    if (gate && ALLOWED_GATES[gate]) {
      out.recoveryGate = gate;
      out.reasonCodes.push('llm_recovery_gate_' + gate);
    }
    var effort = String(raw.cond_effort || raw.condEffort || '').toLowerCase();
    if (effort && ALLOWED_EFFORT[effort]) {
      out.condEffort = effort;
      out.reasonCodes.push('llm_cond_effort_' + effort);
    }
    var tone = String(raw.session_tone || raw.sessionTone || '').trim();
    if (tone) out.sessionTone = tone.slice(0, 120);
    var flags = Array.isArray(raw.flags) ? raw.flags : [];
    flags.forEach(function (f) {
      var k = String(f || '').toLowerCase();
      if (ALLOWED_FLAGS[k] && out.flags.indexOf(k) < 0) out.flags.push(k);
    });
    if (out.flags.indexOf('pain') >= 0) {
      out.recoveryGate = out.recoveryGate || 'caution';
      out.reasonCodes.push('llm_pain_flag');
    }
    if (out.flags.indexOf('illness') >= 0) {
      out.recoveryGate = 'hold';
      out.reasonCodes.push('llm_illness_flag');
    }
    if (out.flags.indexOf('deload') >= 0) {
      out.recoveryGate = out.recoveryGate || 'caution';
      out.reasonCodes.push('llm_deload_flag');
    }
    var cue = String(raw.athlete_cue || raw.athleteCue || '').trim();
    if (cue) out.athleteCue = cue.slice(0, 280);
    var conf = Number(raw.confidence);
    if (Number.isFinite(conf) && conf >= 0 && conf <= 1) out.confidence = conf;
    var reasons = Array.isArray(raw.reason_codes)
      ? raw.reason_codes
      : Array.isArray(raw.reasonCodes)
        ? raw.reasonCodes
        : [];
    reasons.slice(0, 8).forEach(function (r) {
      var s = String(r || '').trim();
      if (s && out.reasonCodes.indexOf(s) < 0) out.reasonCodes.push(s);
    });
    if (!out.recoveryGate && !out.condEffort && !out.athleteCue && !out.flags.length) return null;
    return out;
  }

  function buildIntentPayload(session) {
    session = session || {};
    var blocks = (session.blocks || []).slice(0, 12).map(function (b) {
      if (!b) return null;
      return {
        type: b.type,
        heading: b.heading,
        modality: b.modality,
        condFmt: b.condFmt,
        effort: b.effort,
        exerciseCount: (b.exercises || []).length,
      };
    }).filter(Boolean);
    return {
      coach_instructions: String(session.coachInstructions || '').slice(0, 4000),
      session_name: String(session.name || '').slice(0, 120),
      blocks: blocks,
    };
  }

  function fetchWithTimeout(url, options, ms) {
    if (typeof AbortController === 'undefined') return fetch(url, options);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, Object.assign({}, options, { signal: ctrl.signal }))
      .finally(function () { clearTimeout(timer); });
  }

  function llmEnabled(state) {
    state = state || {};
    var s = state.settings || {};
    if (s.llmCoachIntent === false) return false;
    return true;
  }

  function fetchCoachIntent(session) {
    return fetchWithTimeout(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session: buildIntentPayload(session) }),
    }, TIMEOUT_MS).then(function (res) {
      if (!res.ok) throw new Error('coach_ai_http_' + res.status);
      return res.json();
    }).then(function (body) {
      var validated = validateCoachIntent(body && body.intent ? body.intent : body);
      if (!validated) throw new Error('coach_ai_invalid_intent');
      return validated;
    });
  }

  /**
   * Apply validated LLM hints to session — engines still own numeric prescription.
   */
  function applyCoachIntentToSession(session, intent) {
    if (!session || !intent) return session;
    session.llmIntent = intent;
    if (intent.recoveryGate) session.llmRecoveryGate = intent.recoveryGate;
    if (intent.flags && intent.flags.indexOf('pain') >= 0 && !session.sessionPain) {
      session.sessionPain = 'yes';
    }
    (session.tasks || []).forEach(function (t) {
      if (!t || t.kind !== 'conditioning') return;
      if (intent.condEffort) t.effort = intent.condEffort;
      if (intent.athleteCue && !t.notes) t.notes = intent.athleteCue;
    });
    return session;
  }

  function enrichSessionWithCoachIntent(state, session) {
    if (!llmEnabled(state)) return Promise.resolve(null);
    if (!session || !String(session.coachInstructions || '').trim()) return Promise.resolve(null);
    if (session.llmIntent && session.llmIntentAt) return Promise.resolve(session.llmIntent);
    return fetchCoachIntent(session).then(function (intent) {
      applyCoachIntentToSession(session, intent);
      session.llmIntentAt = Date.now();
      return intent;
    }).catch(function (err) {
      if (state.settings && state.settings.llmDebug) console.warn('CoachAI:', err);
      return null;
    });
  }

  function athleteCueForSession(session) {
    if (!session || !session.llmIntent) return '';
    return session.llmIntent.athleteCue || '';
  }

  function escHtml(value) {
    if (typeof global.esc === 'function') return global.esc(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function athleteCueHtml(session) {
    var cue = athleteCueForSession(session);
    if (!cue) return '';
    return (
      '<div class="liftcue" style="margin-top:8px;font-size:12px;line-height:1.35">' +
      escHtml(cue) +
      '</div>'
    );
  }

  global.CoachAI = {
    ENDPOINT: ENDPOINT,
    llmEnabled: llmEnabled,
    athleteCueForSession: athleteCueForSession,
    athleteCueHtml: athleteCueHtml,
    validateCoachIntent: validateCoachIntent,
    buildIntentPayload: buildIntentPayload,
    fetchCoachIntent: fetchCoachIntent,
    applyCoachIntentToSession: applyCoachIntentToSession,
    enrichSessionWithCoachIntent: enrichSessionWithCoachIntent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
