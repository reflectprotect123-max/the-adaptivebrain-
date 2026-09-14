/**
 * Coach V1 views — calendars, roster, assign, nutrition UI.
 * Initialized from coach.html after domain state is ready.
 */
(function (root) {
  'use strict';

  var ctx = {};

  function C() {
    return ctx;
  }

  function esc(s) {
    return ctx.esc(s);
  }

  function persist() {
    ctx.persist();
  }

  function pushBridge() {
    if (root.CoachBridge) root.CoachBridge.push(ctx.S);
  }

  function L() {
    return ctx.L;
  }

  function S() {
    return ctx.S;
  }

  function ui() {
    return ctx.ui;
  }

  function monthKey() {
    return ui().calMonth || L().today().slice(0, 7);
  }

  function setMonth(k) {
    ui().calMonth = k;
    ctx.render();
  }

  function shiftCalMonth(delta) {
    ui().calMonth = L().shiftMonth(monthKey(), delta);
    ctx.render();
  }

  /* ---------- Assign ---------- */

  function assignHtml() {
    var p = ctx.prog(ui().programId);
    if (!p) {
      return (
        '<div class="empty-panel"><div class="eyebrow">Assign</div><h2>Pick a program</h2>' +
        '<p class="muted">Open Library → Programs, then Assign from a program row.</p>' +
        '<div class="empty-actions"><button type="button" class="btn primary small" onclick="go(\'library\',{lib:\'programs\'})">Go to programs</button></div></div>'
      );
    }
    var teams = (S().teams || [])
      .map(function (t) {
        var sel = ui().assignTeamId === t.id ? ' selected' : '';
        return (
          '<option value="' +
          esc(t.id) +
          '"' +
          sel +
          '>' +
          esc(t.name) +
          ' (' +
          (t.athleteIds || []).length +
          ')</option>'
        );
      })
      .join('');
    var start = ui().assignStart || L().mondayOf(L().today());
    return (
      '<div class="fade-in"><button type="button" class="btn ghost small page-back" onclick="go(\'library\',{lib:\'programs\'})">← Back</button>' +
      '<div class="page-intro" style="margin-top:12px"><div class="eyebrow">Assign</div><h1>' +
      esc(p.name) +
      '</h1><p class="lede">Stamp program cells onto each athlete calendar as unpublished sessions. Publish from the team or athlete calendar.</p></div>' +
      '<div class="card stack">' +
      '<div class="field"><label>Team</label><select onchange="ui.assignTeamId=this.value;render()">' +
      teams +
      '</select></div>' +
      '<div class="field"><label>Start week (Monday)</label><input type="date" value="' +
      esc(start) +
      '" onchange="ui.assignStart=this.value;persist()"></div>' +
      '<button type="button" class="btn primary block" onclick="CoachViews.confirmAssign()">Assign program</button></div></div>'
    );
  }

  function confirmAssign() {
    var p = ctx.prog(ui().programId);
    if (!p) return;
    var teamId = ui().assignTeamId || (S().teams[0] && S().teams[0].id);
    try {
      L().assignProgram(S(), {
        programId: p.id,
        teamId: teamId,
        startDate: ui().assignStart || L().mondayOf(L().today()),
      });
      persist();
      ui().view = 'team';
      ui().teamId = teamId;
      ui().calMonth = (ui().assignStart || L().today()).slice(0, 7);
      ctx.render();
    } catch (e) {
      alert(String(e.message || e));
    }
  }

  /* ---------- Roster ---------- */

  function saveAthleteCloudId(athleteId, cloudUserId) {
    var a = ctx.athleteBy(athleteId);
    if (!a) return;
    var id = String(cloudUserId || '').trim();
    if (!id) {
      if (typeof root.showCoachToast === 'function') root.showCoachToast('Paste the athlete Supabase user id (UUID).', 'warn');
      else alert('Paste the athlete Supabase user id (UUID).');
      return;
    }
    a.cloudUserId = id;
    persist();
    ctx.render();
    if (typeof root.showCoachToast === 'function') root.showCoachToast('Linked ' + a.name + ' for cloud publish.', 'ok');
  }

  function notifyPublishResult(result, athleteName) {
    if (!result) return;
    if (typeof root.coachPortalToast === 'function') {
      root.coachPortalToast(result, athleteName);
      return;
    }
    if (result.ok) {
      alert('Published to ' + (athleteName || 'athlete') + '. Phone syncs on next open.');
    } else if (result.errors && result.errors.length) {
      alert('Cloud push: ' + result.errors.map(function (e) { return e.error; }).join('; '));
    }
  }


  function athleteListHtml() {
    var rows = (S().athletes || [])
      .map(function (a) {
        var cloud = a.cloudUserId
          ? '<span class="pill ok">Cloud linked</span>'
          : '<span class="pill warn">Needs link</span>';
        var linkBtn =
          '<button type="button" class="btn small" onclick="bindMyCloudIdToAthlete(\'' +
          a.id +
          '\')">Link my account</button>';
        var pasteRow =
          '<div class="field" style="margin-top:6px;min-width:200px"><label>Supabase user id</label>' +
          '<input type="text" value="' +
          esc(a.cloudUserId || '') +
          '" placeholder="auth.users uuid" onchange="CoachViews.saveAthleteCloudId(\'' +
          a.id +
          '\',this.value)"></div>';
        return (
          '<tr><td><input type="checkbox" aria-label="Select ' + esc(a.name) + '"></td><td><button type="button" class="linkish" onclick="go(\'athlete\',{athleteId:\'' +
          a.id +
          '\'})">' +
          esc(a.name) +
          '</button><div class="muted" style="font-size:11px">' +
          esc(a.cloudUserId || 'No cloud user id') +
          '</div>' +
          pasteRow +
          '</td><td><span class="pill">Coach Plan</span></td><td class="muted">' +
          esc((function () {
            var tm = (S().teams || []).find(function (t) {
              return (t.athleteIds || []).indexOf(a.id) >= 0;
            });
            return (tm && tm.name) || '—';
          })()) +
          '</td><td><button type="button" class="btn small" onclick="go(\'athlete\',{athleteId:\'' +
          a.id +
          '\'})">Calendar</button> ' +
          cloud +
          ' ' +
          linkBtn +
          '</td></tr>'
        );
      })
      .join('');
    var n = (S().athletes || []).length;
    return (
      '<div class="fade-in"><div class="toolbar-row">' +
      '<div class="filter-pill"><label>GROUP</label><select aria-label="GROUP"><option>All Athletes (' + n + ')</option></select></div>' +
      '<div class="filter-pill"><label>STATUS</label><select aria-label="STATUS"><option>Active</option><option>Invited</option><option>Archived</option></select></div>' +
      '<button type="button" class="btn primary small">Invite Athletes</button></div>' +
      (rows
        ? '<div class="table-wrap"><table class="th-table data-table roster-table"><thead><tr><th></th><th>Athlete Name</th><th>Athlete Type</th><th>Teams</th><th>Actions</th></tr></thead><tbody>' +
          rows +
          '</tbody></table></div><div class="table-foot"><span class="rows-per-page">Rows per page: 100</span><span>1–' + n + ' of ' + n + '</span></div>'
        : '<div class="empty-panel"><div class="eyebrow">Roster</div><h2>No athletes yet</h2><p class="muted">Reset demo data to load the seeded roster, or add athletes from your workflow.</p></div>') +
      '</div>'
    );
  }

  function teamListHtml() {
    var rows = (S().teams || [])
      .map(function (t) {
        return (
          '<tr><td><button type="button" class="linkish" onclick="go(\'team\',{teamId:\'' +
          t.id +
          '\'})">' +
          esc(t.name) +
          '</button></td><td class="muted">' +
          (t.athleteIds || []).length +
          '</td><td><button type="button" class="btn small" onclick="go(\'team\',{teamId:\'' +
          t.id +
          '\'})">Calendar</button></td></tr>'
        );
      })
      .join('');
    return (
      '<div class="fade-in"><div class="toolbar-row"><h1 style="margin:0;font-size:18px">My Teams</h1>' +
      '<button type="button" class="btn primary small" onclick="CoachViews.openCreateTeam()">Create Team</button></div>' +
      (rows
        ? '<div class="table-wrap"><table class="th-table data-table roster-table"><thead><tr><th>Title</th><th>Athletes</th><th>Actions</th></tr></thead><tbody>' +
          rows +
          '</tbody></table></div><div class="table-foot"><span class="rows-per-page">Rows per page: 100</span><span>1–' + (S().teams || []).length + ' of ' + (S().teams || []).length + '</span></div>'
        : '<div class="empty-panel"><div class="eyebrow">Teams</div><h2>No teams yet</h2><p class="muted">Create a team, then open its calendar to assign programs.</p><div class="empty-actions"><button type="button" class="btn primary small" onclick="CoachViews.openCreateTeam()">Create Team</button></div></div>') +
      (ui().createTeam ? teamCreateDialog() : '') +
      '</div>'
    );
  }

  function teamCreateDialog() {
    return (
      '<div class="picker-overlay" onclick="if(event.target===this){ui().createTeam=false;ctx.render()}">' +
      '<div class="picker-panel team-create-dialog" role="dialog" aria-label="Create Team">' +
      '<h2>Create Team</h2>' +
      '<div class="field"><label>Team Name</label><input id="team-name-in" maxlength="75" oninput="CoachViews.teamNameCount(this)" placeholder="Team name">' +
      '<div class="muted" id="team-name-count">0/75</div></div>' +
      '<div class="row" style="margin-top:16px"><button type="button" class="btn" onclick="ui().createTeam=false;ctx.render()">Cancel</button>' +
      '<button type="button" class="btn primary" id="team-create-save" disabled onclick="CoachViews.saveCreateTeam()">Create Team</button></div>' +
      '</div></div>'
    );
  }

  function teamNameCount(el) {
    var n = String(el.value || '').length;
    var c = document.getElementById('team-name-count');
    if (c) c.textContent = n + '/75';
    var b = document.getElementById('team-create-save');
    if (b) b.disabled = n < 1;
  }

  function saveCreateTeam() {
    var el = document.getElementById('team-name-in');
    var name = el && el.value;
    if (!name || !String(name).trim()) return;
    S().teams.push({
      id: L().uid('team'),
      name: String(name).trim(),
      athleteIds: (S().athletes || []).map(function (a) {
        return a.id;
      }),
    });
    ui().createTeam = false;
    persist();
    ctx.render();
  }

  function openCreateTeam() {
    ui().createTeam = true;
    ctx.render();
  }

  /* ---------- Calendar shared ---------- */

  function chipMenu(sessionId) {
    var m = ui().chipMenu;
    if (!m || m.id !== sessionId) return '';
    return (
      '<div class="kebab-menu" role="menu" onclick="event.stopPropagation()">' +
      '<button type="button" onclick="CoachViews.publishChip(\'' +
      sessionId +
      '\')">Publish</button>' +
      '<button type="button" onclick="CoachViews.unpublishChip(\'' +
      sessionId +
      '\')">Unpublish</button>' +
      '<button type="button" onclick="CoachViews.deleteChip(\'' +
      sessionId +
      '\')">Delete</button>' +
      '</div>'
    );
  }

  function sessionChip(s, opts) {
    opts = opts || {};
    var pub = s.published ? 'published' : 'unpublished';
    var completed = s.status === 'completed';
    if (completed) pub = s.published ? 'published completed' : 'unpublished completed';
    var title = s.sessionTitle || s.name;
    var athleteName =
      opts.showAthlete && s.athleteId
        ? (ctx.athleteBy(s.athleteId) || {}).name
        : '';
    var statusPill =
      completed
        ? '<span class="pill ok">Completed</span>'
        : '<span class="pill ' +
          (s.published ? 'ok' : 'warn') +
          '">' +
          (s.published ? 'Published' : 'UNPUBLISHED') +
          '</span>';
    var macroPill = s.hasNutritionBundle ? ' · <span class="pill">Macros</span>' : '';
    return (
      '<div class="cal-chip ' +
      pub +
      '">' +
      (athleteName
        ? '<div class="cal-chip-ath">' + esc(athleteName) + '</div>'
        : '') +
      '<div class="cal-chip-top">' +
      '<span class="cal-chip-title">' +
      esc(title) +
      '</span>' +
      '<button type="button" class="kebab-btn" onclick="CoachViews.toggleChipMenu(\'' +
      s.id +
      '\',event)">⋯</button></div>' +
      '<div class="cal-chip-meta">' +
      esc(s.name) +
      ' · ' +
      statusPill +
      macroPill +
      '</div>' +
      chipMenu(s.id) +
      '</div>'
    );
  }

  function toggleChipMenu(id, ev) {
    if (ev) ev.stopPropagation();
    var cur = ui().chipMenu;
    ui().chipMenu = cur && cur.id === id ? null : { id: id };
    ui().cellMenu = null;
    ctx.render();
  }

  function revertPublishOnCloudFail(sessions, wasPublished) {
    (sessions || []).forEach(function (s, i) {
      if (wasPublished[i]) return;
      L().unpublishSession(s);
      s.hasNutritionBundle = false;
    });
    persist();
    ctx.render();
  }

  function publishChip(id) {
    var s = ctx.ses(id);
    var athlete = s ? ctx.athleteBy(s.athleteId) : null;
    var wasPublished = s ? !!s.published : true;
    if (s) {
      L().publishSession(s);
      s.hasNutritionBundle = !!(root.CoachCloud && CoachCloud.nutritionSnapshot && CoachCloud.nutritionSnapshot(S(), s.athleteId, s.date));
    }
    ui().chipMenu = null;
    persist();
    ctx.render();
    if (root.CoachCloud && CoachCloud.pushPublished) {
      CoachCloud.pushPublished(S(), { sessionIds: [id] })
        .then(function (r) {
          if (!r.ok && s && !wasPublished) {
            revertPublishOnCloudFail([s], [wasPublished]);
          }
          notifyPublishResult(r, athlete && athlete.name);
        })
        .catch(function (e) {
          if (s && !wasPublished) {
            revertPublishOnCloudFail([s], [wasPublished]);
          }
          notifyPublishResult(
            { ok: false, errors: [{ error: String((e && e.message) || e) }] },
            athlete && athlete.name,
          );
        });
    }
  }

  function unpublishChip(id) {
    var s = ctx.ses(id);
    var wasPublished = s ? !!s.published : false;
    if (s) L().unpublishSession(s);
    ui().chipMenu = null;
    persist();
    ctx.render();
    if (root.CoachCloud && CoachCloud.unpublishSession) {
      CoachCloud.unpublishSession(S(), s)
        .then(function (r) {
          if (r && !r.ok && wasPublished && s) {
            L().publishSession(s);
            s.hasNutritionBundle = !!(root.CoachCloud && CoachCloud.nutritionSnapshot && CoachCloud.nutritionSnapshot(S(), s.athleteId, s.date));
            persist();
            ctx.render();
            notifyPublishResult(
              r,
              s && ctx.athleteBy(s.athleteId) && ctx.athleteBy(s.athleteId).name,
            );
          }
        })
        .catch(function (e) {
          if (wasPublished && s) {
            L().publishSession(s);
            s.hasNutritionBundle = !!(root.CoachCloud && CoachCloud.nutritionSnapshot && CoachCloud.nutritionSnapshot(S(), s.athleteId, s.date));
            persist();
            ctx.render();
          }
          notifyPublishResult(
            { ok: false, errors: [{ error: String((e && e.message) || e) }] },
            s && ctx.athleteBy(s.athleteId) && ctx.athleteBy(s.athleteId).name,
          );
        });
    }
  }

  function deleteChip(id) {
    var s = ctx.ses(id);
    ui().chipMenu = null;
    if (!confirm('Delete this session from the calendar?')) return;
    function removeLocal() {
      S().sessions = (S().sessions || []).filter(function (x) {
        return x.id !== id;
      });
      persist();
      ctx.render();
    }
    if (s && s.cloudAssignedId && root.CoachCloud && CoachCloud.unpublishSession) {
      CoachCloud.unpublishSession(S(), s)
        .catch(function () {})
        .finally(removeLocal);
      return;
    }
    removeLocal();
  }

  function publishAllForSessions(list) {
    var wasPublished = (list || []).map(function (s) {
      return !!s.published;
    });
    L().publishAllSessions(list);
    (list || []).forEach(function (s) {
      s.hasNutritionBundle = !!(root.CoachCloud && CoachCloud.nutritionSnapshot && CoachCloud.nutritionSnapshot(S(), s.athleteId, s.date));
    });
    persist();
    ctx.render();
    if (root.CoachCloud && CoachCloud.pushPublished) {
      var ids = (list || []).map(function (s) {
        return s.id;
      });
      var athlete = list && list[0] ? ctx.athleteBy(list[0].athleteId) : null;
      CoachCloud.pushPublished(S(), { sessionIds: ids })
        .then(function (r) {
          if (!r.ok && list && list.length) {
            var failed = new Set(
              (r.errors || []).map(function (e) {
                return e.sessionId;
              }),
            );
            var revertList = [];
            var revertWas = [];
            list.forEach(function (s, i) {
              if (!wasPublished[i] && (failed.size === 0 || failed.has(s.id))) {
                revertList.push(s);
                revertWas.push(wasPublished[i]);
              }
            });
            if (revertList.length) revertPublishOnCloudFail(revertList, revertWas);
          }
          notifyPublishResult(r, athlete && athlete.name);
        })
        .catch(function (e) {
          var revertList = [];
          var revertWas = [];
          (list || []).forEach(function (s, i) {
            if (!wasPublished[i]) {
              revertList.push(s);
              revertWas.push(wasPublished[i]);
            }
          });
          if (revertList.length) revertPublishOnCloudFail(revertList, revertWas);
          notifyPublishResult(
            { ok: false, errors: [{ error: String((e && e.message) || e) }] },
            athlete && athlete.name,
          );
        });
    }
  }

  function calDayCell(date, sessions, athleteId, teamMode) {
    var expanded = ui().calDay === date;
    var visible = expanded ? sessions : sessions.slice(0, 2);
    var chips = visible
      .map(function (s) {
        return sessionChip(s, { showAthlete: !!teamMode });
      })
      .join('');
    var more =
      !expanded && sessions.length > 2
        ? '<div class="cal-chip-meta">+' + (sessions.length - 2) + ' more</div>'
        : '';
    var empty =
      !sessions.length && expanded
        ? teamMode
          ? '<div class="cal-empty-actions"><button type="button" class="btn small" onclick="CoachViews.openAddFromLibrary(\'' +
            date +
            '\',\'\',true)">Add from library</button></div>'
          : '<div class="cal-empty-actions"><button type="button" class="btn small" onclick="CoachViews.openAddFromLibrary(\'' +
            date +
            "','" +
            athleteId +
            '\')">Add from library</button></div>'
        : '';
    return (
      '<div class="cal-day' +
      (expanded ? ' expanded' : '') +
      (sessions.length ? ' has-sessions' : '') +
      '">' +
      '<button type="button" class="cal-day-num" onclick="CoachViews.toggleCalDay(\'' +
      date +
      '\')">' +
      esc(String(Number(date.slice(8)))) +
      (sessions.length ? ' · ' + sessions.length : '') +
      '</button>' +
      '<div class="cal-day-body">' +
      chips +
      more +
      empty +
      '</div></div>'
    );
  }

  function toggleCalDay(date) {
    ui().calDay = ui().calDay === date ? null : date;
    ctx.render();
  }

  function openAddFromLibrary(date, athleteId, teamMode) {
    if (teamMode || (!athleteId && ui().view === 'team')) {
      ui().libPick = { date: date, teamId: ui().teamId, pickAthlete: true };
    } else {
      ui().libPick = { date: date, athleteId: athleteId };
    }
    ctx.render();
  }

  function pickLibraryAthlete(athleteId) {
    var pick = ui().libPick;
    if (!pick || !pick.pickAthlete) return;
    ui().libPick = { date: pick.date, athleteId: athleteId };
    ctx.render();
  }

  function pickLibraryTemplate(tid) {
    var pick = ui().libPick;
    if (!pick) return;
    L().addCalendarSession(S(), {
      athleteId: pick.athleteId,
      date: pick.date,
      templateId: tid,
    });
    ui().libPick = null;
    persist();
    ctx.render();
  }

  function libraryPickOverlay() {
    var pick = ui().libPick;
    if (!pick) return '';
    if (pick.pickAthlete) {
      var team = ctx.team(pick.teamId);
      var athleteList = (team && team.athleteIds) || [];
      var athletes = athleteList
        .map(function (aid) {
          var a = ctx.athleteBy(aid);
          if (!a) return '';
          return (
            '<button type="button" class="picker-item" onclick="CoachViews.pickLibraryAthlete(\'' +
            aid +
            '\')"><span>' +
            esc(a.name) +
            '</span></button>'
          );
        })
        .join('');
      return (
        '<div class="picker-overlay" onclick="if(event.target===this)ui.libPick=null;render()">' +
        '<div class="picker-panel"><div class="row"><b>Choose athlete</b><button type="button" class="btn ghost small" onclick="ui.libPick=null;render()">Close</button></div>' +
        '<p class="muted">' +
        esc(pick.date) +
        '</p><div class="picker-list">' +
        (athletes || '<div class="muted">No athletes on this team.</div>') +
        '</div></div></div>'
      );
    }
    var list = (S().templates || [])
      .map(function (t) {
        return (
          '<button type="button" class="picker-item" onclick="CoachViews.pickLibraryTemplate(\'' +
          t.id +
          '\')"><span>' +
          esc(t.name) +
          '</span></button>'
        );
      })
      .join('');
    return (
      '<div class="picker-overlay" onclick="if(event.target===this)ui.libPick=null;render()">' +
      '<div class="picker-panel"><div class="row"><b>Add from library</b><button type="button" class="btn ghost small" onclick="ui.libPick=null;render()">Close</button></div>' +
      '<p class="muted">' +
      esc(pick.date) +
      '</p><div class="picker-list">' +
      list +
      '</div></div></div>'
    );
  }

  function calendarShell(title, backView, backExtra, sessions, athleteId, teamMode) {
    var mk = monthKey();
    var grid = L().monthGridCells ? L().monthGridCells(mk) : L().monthDays(mk);
    var canPublish = L().hasUnpublished(sessions);
    var cells = grid
      .map(function (d) {
        if (!d) return '<div class="cal-day cal-pad" aria-hidden="true"></div>';
        var daySessions = sessions.filter(function (s) {
          return s.date === d;
        });
        return calDayCell(d, daySessions, athleteId, teamMode);
      })
      .join('');
    var dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      .map(function (d) {
        return '<div class="cal-dow">' + d + '</div>';
      })
      .join('');
    return (
      '<div class="fade-in"><button type="button" class="btn ghost small page-back" onclick="go(\'' +
      backView +
      "'" +
      (backExtra ? ',' + backExtra : '') +
      ')">← Back</button>' +
      '<div class="cal-toolbar">' +
      '<div class="page-intro" style="margin:0"><div class="eyebrow">Calendar</div><h1>' +
      esc(title) +
      '</h1><p class="lede" style="margin-top:4px">' +
      esc(L().monthLabel(mk)) +
      ' · select a day to add or publish</p></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn small" aria-label="Previous month" onclick="CoachViews.shiftCalMonth(-1)">‹</button>' +
      '<button type="button" class="btn small" aria-label="Next month" onclick="CoachViews.shiftCalMonth(1)">›</button>' +
      '<button type="button" class="btn primary small"' +
      (canPublish ? '' : ' disabled') +
      ' onclick="CoachViews.publishAllVisible()">Publish all</button></div></div>' +
      '<div class="cal-month"><div class="cal-dow-row">' +
      dow +
      '</div><div class="cal-grid">' +
      cells +
      '</div></div>' +
      libraryPickOverlay() +
      '</div>'
    );
  }

  function publishAllVisible() {
    var view = ui().view;
    var list = [];
    if (view === 'athlete' && ui().athleteId) {
      list = L().calendarFor(S(), ui().athleteId, monthKey());
    } else if (view === 'team' && ui().teamId) {
      list = L().teamCalendar(S(), ui().teamId, monthKey());
    }
    publishAllForSessions(list.filter(function (s) {
      return !s.published && s.status !== 'completed';
    }));
  }

  function athleteCalHtml() {
    var a = ctx.athleteBy(ui().athleteId);
    if (!a) return athleteListHtml();
    var sessions = L().calendarFor(S(), a.id, monthKey());
    return calendarShell(a.name, 'athletes', '', sessions, a.id);
  }

  function teamCalHtml() {
    var t = ctx.team(ui().teamId);
    if (!t) return teamListHtml();
    var sessions = L().teamCalendar(S(), t.id, monthKey());
    return calendarShell(t.name, 'teams', '', sessions, '', true);
  }

  /* ---------- Nutrition N1–N3 ---------- */

  function nutritionHtml() {
    var N = root.CoachNutrition;
    if (!N) return '<div class="card muted">Nutrition module missing.</div>';
    var nut = N.ensureNutrition(S());
    var athletes = S().athletes || [];
    var aid = ui().nutAthleteId || (athletes[0] && athletes[0].id);
    var a = ctx.athleteBy(aid);
    var resolved = N.resolveActiveTargets(nut.targetsByAthlete[aid], null);
    var t = resolved.active;
    var opts = athletes
      .map(function (x) {
        return (
          '<option value="' +
          x.id +
          '"' +
          (x.id === aid ? ' selected' : '') +
          '>' +
          esc(x.name) +
          '</option>'
        );
      })
      .join('');
    var targets = t
      ? '<div class="card"><div class="eyebrow">Active targets</div><div class="metrics cols-4" style="margin-top:10px">' +
        '<div class="metric"><b>' +
        t.calories +
        '</b><span>kcal</span></div>' +
        '<div class="metric"><b>' +
        t.proteinG +
        'g</b><span>Protein</span></div>' +
        '<div class="metric"><b>' +
        t.carbsG +
        'g</b><span>Carbs</span></div>' +
        '<div class="metric"><b>' +
        t.fatG +
        'g</b><span>Fat</span></div></div>' +
        '<p class="muted" style="margin-top:8px">Source: ' +
        esc(resolved.reason) +
        '</p></div>'
      : '<div class="empty-panel"><div class="eyebrow">Targets</div><h2>No targets set</h2><p class="muted">Save an override below to set coach macros for this athlete.</p></div>';
    if (!athletes.length) {
      return (
        '<div class="empty-panel"><div class="eyebrow">Nutrition</div><h2>No athletes</h2>' +
        '<p class="muted">Add athletes to the roster before setting targets or meals.</p></div>'
      );
    }
    return (
      '<div class="fade-in"><div class="page-intro"><div class="eyebrow">Nutrition</div><h1>Coach targets & meals</h1>' +
      '<p class="lede">Override macros and publish a meal day for ' +
      esc((a && a.name) || 'the selected athlete') +
      '.</p></div>' +
      '<div class="card" style="margin-bottom:16px"><div class="field" style="margin:0"><label>Athlete</label><select onchange="ui.nutAthleteId=this.value;render()">' +
      opts +
      '</select></div></div>' +
      targets +
      '<div class="card stack" style="margin-top:16px"><div class="eyebrow">Override macros</div>' +
      '<div class="rx-grid cols-4"><div class="field"><label>kcal</label><input id="nutKcal" type="number" value="' +
      esc((t && t.calories) || 2800) +
      '"></div>' +
      '<div class="field"><label>Protein (g)</label><input id="nutP" type="number" value="' +
      esc((t && t.proteinG) || 180) +
      '"></div>' +
      '<div class="field"><label>Carbs (g)</label><input id="nutC" type="number" value="' +
      esc((t && t.carbsG) || 300) +
      '"></div>' +
      '<div class="field"><label>Fat (g)</label><input id="nutF" type="number" value="' +
      esc((t && t.fatG) || 80) +
      '"></div></div>' +
      '<div class="row" style="justify-content:flex-start;gap:8px;flex-wrap:wrap;margin-top:4px">' +
      '<button type="button" class="btn primary" onclick="CoachViews.saveNutOverride()">Save override</button>' +
      '<button type="button" class="btn ghost small" onclick="CoachViews.clearNutOverride()">Clear override</button></div></div>' +
      '<div class="card stack" style="margin-top:16px"><div class="eyebrow">Meal day</div>' +
      '<div class="field"><label>Date</label><input id="nutMealDate" type="date" value="' +
      esc(L().today()) +
      '"></div>' +
      '<div class="field"><label>Meal title</label><input id="nutMealTitle" value="Training day"></div>' +
      '<div class="field"><label>Food line</label><input id="nutFoodLine" placeholder="Chicken breast · 200g"></div>' +
      '<button type="button" class="btn primary" onclick="CoachViews.addMealDay()">Add meal & publish day</button></div></div>'
    );
  }

  function saveNutOverride() {
    var N = root.CoachNutrition;
    var aid = ui().nutAthleteId || S().athletes[0].id;
    var el = function (id) {
      return document.getElementById(id);
    };
    N.setCoachOverride(N.ensureNutrition(S()), aid, {
      calories: Number(el('nutKcal') && el('nutKcal').value) || 0,
      proteinG: Number(el('nutP') && el('nutP').value) || 0,
      carbsG: Number(el('nutC') && el('nutC').value) || 0,
      fatG: Number(el('nutF') && el('nutF').value) || 0,
    });
    persist();
    ctx.render();
    if (typeof root.showCoachToast === 'function') root.showCoachToast('Macro override saved.', 'ok');
  }

  function clearNutOverride() {
    var N = root.CoachNutrition;
    var aid = ui().nutAthleteId || S().athletes[0].id;
    N.clearCoachOverride(N.ensureNutrition(S()), aid);
    persist();
    ctx.render();
  }

  function addMealDay() {
    var N = root.CoachNutrition;
    var aid = ui().nutAthleteId || S().athletes[0].id;
    var titleEl = document.getElementById('nutMealTitle');
    var foodEl = document.getElementById('nutFoodLine');
    var dateEl = document.getElementById('nutMealDate');
    var mealDate = (dateEl && dateEl.value) || L().today();
    var day = N.makeMealDay({
      athleteId: aid,
      date: mealDate,
      meals: [
        N.makeMeal({
          title: (titleEl && titleEl.value) || 'Meal',
          items: [
            N.makeMealItem({
              name: (foodEl && foodEl.value) || 'Food',
            }),
          ],
        }),
      ],
    });
    N.publishMealDay(day);
    N.upsertMealDay(N.ensureNutrition(S()), day);
    persist();
    ctx.render();
    if (typeof root.showCoachToast === 'function') root.showCoachToast('Meal day saved and published.', 'ok');
  }

  function init(context) {
    ctx = context;
  }

  function bindState(state) {
    ctx.S = state;
  }

  root.CoachViews = {
    init: init,
    bindState: bindState,
    assignHtml: assignHtml,
    confirmAssign: confirmAssign,
    athleteListHtml: athleteListHtml,
    teamListHtml: teamListHtml,
    athleteCalHtml: athleteCalHtml,
    teamCalHtml: teamCalHtml,
    nutritionHtml: nutritionHtml,
    openCreateTeam: openCreateTeam,
    teamNameCount: teamNameCount,
    saveCreateTeam: saveCreateTeam,
    toggleChipMenu: toggleChipMenu,
    publishChip: publishChip,
    unpublishChip: unpublishChip,
    deleteChip: deleteChip,
    publishAllVisible: publishAllVisible,
    shiftCalMonth: shiftCalMonth,
    toggleCalDay: toggleCalDay,
    openAddFromLibrary: openAddFromLibrary,
    pickLibraryAthlete: pickLibraryAthlete,
    pickLibraryTemplate: pickLibraryTemplate,
    saveNutOverride: saveNutOverride,
    clearNutOverride: clearNutOverride,
    addMealDay: addMealDay,
    pushBridge: pushBridge,
    saveAthleteCloudId: saveAthleteCloudId,
  };
})(typeof window !== 'undefined' ? window : globalThis);
