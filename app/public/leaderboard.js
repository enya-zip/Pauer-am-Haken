import { LEADERBOARD } from './leaderboard-config.js';

const BOARD_SIZE = 10;
const PLAYER_KEY = 'pauer-am-haken-player';

const words = {
  saving: 'WIRD GESPEICHERT …',
  submit: 'EINTRAGEN ↗',
  loading: 'Rangliste wird geladen …',
  error: 'Die Rangliste ist gerade nicht erreichbar. Versuch es später nochmal.',
  notConfigured: 'Die Rangliste ist noch nicht verbunden.',
  tooMany: 'Zu viele Einträge in kurzer Zeit. Versuch es später nochmal.',
  empty: 'Noch keine Einträge. Sei die erste Person auf der Rangliste!',
  yourRank: 'Dein Platz: {rank} von {total}',
  you: 'DU',
  metres: '{height} m'
};

const configured = () => Boolean(LEADERBOARD.url && LEADERBOARD.key);
const number = n => Math.round(Number(n) || 0).toLocaleString('de-CH');

async function rpc(name, body) {
  const response = await fetch(LEADERBOARD.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: LEADERBOARD.key,
      // Alte "anon"-Schlüssel (JWT) brauchen zusätzlich Authorization. Neue "sb_publishable_"-Schlüssel nicht.
      ...(LEADERBOARD.key.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + LEADERBOARD.key })
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text.includes('too_many_entries') ? 'tooMany' : 'error');
  }
  return response.json();
}

function readPlayer() {
  try { const v = JSON.parse(localStorage.getItem(PLAYER_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
function writePlayer(value) {
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(value)); } catch {}
}

// Rangliste nach dem Spiel: Formular (Name, E-Mail) -> Bestenliste mit eigenem Platz.
// getRun() liefert das zuletzt beendete Spiel: { id, score, height, floors, perfects, bestStreak } oder null.
export function setupLeaderboard({ getRun }) {
  const $ = id => document.getElementById(id);
  const dialog = $('board-dialog');
  const form = $('board-form');
  const list = $('board-list');
  const message = $('board-message');
  const submit = $('board-submit');
  let submittedRunId = null, lastResult = null, busy = false;

  function show(view) {
    $('board-entry').hidden = view !== 'form';
    $('board-view').hidden = view !== 'list';
  }
  function setMessage(key) {
    message.textContent = key ? words[key] : '';
    message.hidden = !key;
  }
  function row(rank, name, score, height, mine) {
    const li = document.createElement('li');
    if (mine) li.className = 'mine';
    const r = document.createElement('span'); r.className = 'board-rank'; r.textContent = rank;
    const n = document.createElement('span'); n.className = 'board-name'; n.textContent = name;
    if (mine) { const you = document.createElement('small'); you.textContent = words.you; n.append(' ', you); }
    const s = document.createElement('strong'); s.textContent = number(score);
    const h = document.createElement('span'); h.className = 'board-height'; h.textContent = words.metres.replace('{height}', number(height));
    li.append(r, n, h, s);
    return li;
  }

  async function loadBoard() {
    show('list');
    list.replaceChildren();
    $('board-rank').hidden = true;
    if (!configured()) { setMessage('notConfigured'); return; }
    setMessage('loading');
    try {
      const rows = await rpc('pauer_am_haken_board', { p_limit: BOARD_SIZE });
      let marked = false;
      for (const entry of rows) {
        const mine = Boolean(lastResult) && !marked && Number(entry.rank) === lastResult.rank && entry.name === lastResult.name;
        if (mine) marked = true;
        list.append(row(entry.rank, entry.name, entry.score, entry.height, mine));
      }
      if (lastResult && !marked) {
        const gap = document.createElement('li'); gap.className = 'board-gap'; gap.textContent = '…';
        list.append(gap, row(lastResult.rank, lastResult.name, lastResult.best, lastResult.height, true));
      }
      if (lastResult) {
        $('board-rank').textContent = words.yourRank.replace('{rank}', lastResult.rank).replace('{total}', lastResult.total);
        $('board-rank').hidden = false;
      }
      setMessage(rows.length ? '' : 'empty');
    } catch {
      setMessage('error');
    }
  }

  function open() {
    const run = getRun();
    setMessage('');
    $('board-score-box').hidden = !run;
    if (run) $('board-score').textContent = number(run.score);
    const saved = readPlayer();
    if (!$('board-name').value) $('board-name').value = saved.name || '';
    if (!$('board-email').value) $('board-email').value = saved.email || '';
    document.dispatchEvent(new Event('pauer:pause'));
    if (!run || submittedRunId === run.id) loadBoard();
    else { lastResult = null; show('form'); }
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    if (run && submittedRunId !== run.id) (!$('board-name').value ? $('board-name') : submit).focus();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const run = getRun();
    if (!run) return;
    const name = $('board-name').value.trim().replace(/\s+/g, ' ');
    const email = $('board-email').value.trim();
    if (!configured()) { setMessage('notConfigured'); return; }
    busy = true; submit.disabled = true; submit.textContent = words.saving; setMessage('');
    try {
      const [result] = await rpc('pauer_am_haken_submit', {
        p_name: name, p_email: email, p_score: run.score, p_height: run.height, p_floors: run.floors,
        p_perfects: run.perfects, p_streak: run.bestStreak
      });
      writePlayer({ name, email });
      submittedRunId = run.id;
      lastResult = { name, rank: Number(result.rank), best: result.best_score, height: result.best_height, total: Number(result.total) };
      await loadBoard();
    } catch (error) {
      setMessage(error.message === 'tooMany' ? 'tooMany' : 'error');
    } finally {
      busy = false; submit.disabled = false; submit.textContent = words.submit;
    }
  });

  document.addEventListener('pauer:board', open);
  document.querySelectorAll('[data-board]').forEach(button => button.addEventListener('click', open));
  $('board-view-only').addEventListener('click', () => { lastResult = null; loadBoard(); });
  $('board-again').addEventListener('click', () => { dialog.close(); document.dispatchEvent(new Event('pauer:again')); });
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; });
  dialog.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });

  return {
    // Neues Spiel: Ansicht für den nächsten Eintrag zurücksetzen.
    reset() { lastResult = null; setMessage(''); }
  };
}
