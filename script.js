'use strict';

/* =====================================================
   学校のネットワークトラブル診断ゲーム - script.js

   【ファイルの構成】
   1. 設定・問題データ ← 先生が問題や解説を書き換えるのはここだけ
   2. ネットワークの仕組み（機器の接続・故障の計算）
   3. ネットワーク図の描画
   4. 問題画面の処理
   5. 結果画面・振り返りの処理
   6. 先生モードの処理
   7. 起動処理
   ===================================================== */


/* =====================================================
   1. 設定・問題データ
   ===================================================== */

// 振り返りの文字数（最小・最大）
const REFLECTION_MIN = 100;
const REFLECTION_MAX = 300;

// 何回まちがえたら「答えを見る」ボタンを出すか
const MISS_BEFORE_REVEAL = 2;

// 振り返りの模範例（結果画面で「提出」後に表示）
const MODEL_REFLECTION = [
  '通信できる機器と通信できない機器を比較した。',
  'たとえばタブレットだけ通信できないときは、有線のPCが使えているので、ルーターやスイッチは正常だと考えた。',
  'Wi-Fiだけに関係するアクセスポイントの故障だと判断した。'
];

// 選択ボタンの一覧（id は下の DEVICES の id と同じにする）
const CHOICES = [
  { id: 'router',   label: 'ルーター' },
  { id: 'switch',   label: 'スイッチ' },
  { id: 'ap',       label: 'アクセスポイント' },
  { id: 'internet', label: 'インターネット回線' }
];

/* ---------- 問題データ ----------
   ケースを増やすときは、下の {…} を1つコピーして書き換える。

   title       : 問題タイトル
   story       : 問題文（1行ずつ配列に入れる）
   observations: 観察結果の表。
                 label = 表の左側に出る名前 / ok = true(○) か false(×)
                 nodes = 図の中で色をつける機器のid（色をつけない行は [] にする）
   answer      : 正解の機器id（'router' / 'switch' / 'ap' / 'internet'）
   broken      : 正解後に図で故障として表示する機器id（配列）
   hint        : まちがえたときに出す共通のヒント
   wrongHints  : 選んだ機器ごとのヒント（まちがえた機器に合わせて出る）
   explanation : 正解後の解説（1行ずつ配列に入れる）
   point       : 学習ポイント
*/
const CASES = [
  {
    title: 'ケース1：タブレットだけつながらない',
    story: [
      '職員室のPCはインターネットを利用できる。',
      'しかし授業用タブレットはインターネットに接続できない。'
    ],
    observations: [
      { label: 'PC1',       ok: true,  nodes: ['pc1'] },
      { label: 'PC2',       ok: true,  nodes: ['pc2'] },
      { label: 'タブレット', ok: false, nodes: ['tablet'] }
    ],
    answer: 'ap',
    broken: ['ap'],
    hint: 'PCは正常に通信できています。故障している機器は、タブレットだけに影響しているようです。',
    wrongHints: {
      router:   'ルーターが壊れると、有線のPCもインターネットに出られなくなるはずです。',
      switch:   'スイッチが壊れると、PC1・PC2も通信できなくなるはずです。',
      internet: '回線が切れると、PCもインターネットを使えなくなるはずです。'
    },
    explanation: [
      'アクセスポイントはWi-Fi接続を提供する機器です。',
      'そのため故障すると、タブレットは通信できません。',
      '一方で有線接続のPCには影響しません。'
    ],
    point: 'アクセスポイントはWi-Fi接続を担当する'
  },
  {
    title: 'ケース2：どの端末もつながらない',
    story: [
      'PC1もPC2もタブレットも、通信できない。',
      '校内のPC同士でファイルを共有することもできない。',
      'ただし、ルーターの電源ランプは点灯している。'
    ],
    observations: [
      { label: 'PC1',                 ok: false, nodes: ['pc1'] },
      { label: 'PC2',                 ok: false, nodes: ['pc2'] },
      { label: 'タブレット',           ok: false, nodes: ['tablet'] },
      { label: 'ルーターの電源ランプ', ok: true,  nodes: ['router'] }
    ],
    answer: 'switch',
    broken: ['switch'],
    hint: '有線のPCも、Wi-Fiのタブレットも通信できません。全員がつながる「中心」の機器を考えてみましょう。',
    wrongHints: {
      router:   'ルーターが壊れても、校内のPC同士の通信はできるはずです。しかもルーターのランプは点灯しています。',
      ap:       'アクセスポイントの故障で困るのはWi-Fiのタブレットだけです。有線のPCまで通信できない理由を説明できません。',
      internet: '回線が切れても、校内のPC同士は通信できるはずです。'
    },
    explanation: [
      'スイッチはLAN内の機器をつなぐ中心の機器です。',
      '故障すると、PC1・PC2・アクセスポイント（タブレット）のすべてが通信できなくなります。'
    ],
    point: 'スイッチはLAN内の通信を支える'
  },
  {
    title: 'ケース3：Webサイトだけ見られない',
    story: [
      '校内のPC同士は通信できる。',
      'しかしWebサイトには接続できない。',
      'ルーターの設定画面（校内のPCから開く画面）も開けない。'
    ],
    observations: [
      { label: '校内PC同士の通信',       ok: true,  nodes: ['pc1', 'pc2'] },
      { label: 'Webサイトの閲覧',        ok: false, nodes: [] },
      { label: 'ルーターの設定画面を開く', ok: false, nodes: [] }
    ],
    answer: 'router',
    broken: ['router'],
    hint: '校内の通信はできるのに、外（インターネット）にだけ出られません。「校内」と「外」の境目にある機器を考えてみましょう。',
    wrongHints: {
      switch:   'スイッチが壊れると、校内のPC同士も通信できなくなるはずです。',
      ap:       'アクセスポイントの故障で困るのは、Wi-Fiのタブレットだけです。',
      internet: '回線の故障でもWebは見られませんが、そのときルーターの設定画面は開けるはずです。'
    },
    explanation: [
      'ルーターはLANとインターネットを接続する機器です。',
      '故障すると、校内（LAN内）の通信はできても、外のWebサイトには出られません。'
    ],
    point: 'ルーターはLANとインターネットを接続する'
  }
];


/* =====================================================
   2. ネットワークの仕組み
   ===================================================== */

/* 機器の一覧。
   x, y   : 図の中での位置
   parent : つながっている上流の機器（線はここから自動で引かれる）
   kind   : 'end' = 端末（PC・タブレット） / 'infra' = ネットワーク機器 */
const DEVICES = [
  { id: 'internet', name: 'インターネット',   x: 210, y: 45,  parent: null,       kind: 'infra' },
  { id: 'router',   name: 'ルーター',         x: 210, y: 150, parent: 'internet', kind: 'infra' },
  { id: 'switch',   name: 'スイッチ',         x: 210, y: 255, parent: 'router',   kind: 'infra' },
  { id: 'pc1',      name: 'PC1',              x: 70,  y: 365, parent: 'switch',   kind: 'end' },
  { id: 'pc2',      name: 'PC2',              x: 210, y: 365, parent: 'switch',   kind: 'end' },
  { id: 'ap',       name: 'アクセスポイント', x: 350, y: 365, parent: 'switch',   kind: 'infra' },
  { id: 'tablet',   name: 'タブレット',       x: 350, y: 485, parent: 'ap',       kind: 'end' }
];

// id から機器を引くための辞書
const DEV = {};
DEVICES.forEach(function (d) { DEV[d.id] = d; });

/* 自分から上流へたどって、途中に故障機器がないか調べる。
   stopId まで（stopIdも含む）調べる。stopId が null なら一番上（インターネット）まで調べる。 */
function pathClear(id, stopId, broken) {
  let cur = id;
  while (cur) {
    if (broken.includes(cur)) return false;
    if (cur === stopId) return true;
    cur = DEV[cur].parent;
  }
  return true;
}

/* 故障している機器のリスト broken から、図に必要な状態をすべて計算する。
   戻り値：
     nodeStatus … 機器ごとの 'ok' / 'ng'
     edgeStatus … 通信線ごとの 'ok' / 'ng'（キーは線の下側の機器id）
     table      … 端末ごとの「校内の通信」「インターネット」の可否 */
function simulate(broken) {
  const nodeStatus = {};
  const edgeStatus = {};
  const table = [];

  DEVICES.forEach(function (d) {
    // 端末は、スイッチまでの経路が切れていたら「通信できない」
    const lan = d.kind === 'end' ? pathClear(d.id, 'switch', broken) : true;

    nodeStatus[d.id] = (broken.includes(d.id) || !lan) ? 'ng' : 'ok';

    if (d.parent) {
      const bad = broken.includes(d.id) || broken.includes(d.parent) || !lan;
      edgeStatus[d.id] = bad ? 'ng' : 'ok';
    }
    if (d.kind === 'end') {
      table.push({ name: d.name, lan: lan, net: pathClear(d.id, null, broken) });
    }
  });

  return { nodeStatus: nodeStatus, edgeStatus: edgeStatus, table: table };
}


/* =====================================================
   3. ネットワーク図の描画（SVGをJavaScriptで作る）
   ===================================================== */

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_W = 124;   // 機器カードの幅
const NODE_H = 54;    // 機器カードの高さ
const nodeEls = {};   // 機器id → <g>要素
const edgeEls = {};   // 機器id → <line>要素
const statusEls = {}; // 機器id → 状態表示の<text>要素

// 状態に応じて、カードに書く文字（色だけに頼らないため）
const LABEL_INFRA = { ok: '正常', ng: '故障', unknown: '未確認' };
const LABEL_END   = { ok: '通信できる', ng: '通信できない', unknown: '未確認' };

function svgEl(name, attrs) {
  const e = document.createElementNS(SVG_NS, name);
  Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
  return e;
}

// 図を最初に1回だけ作る
function buildDiagram() {
  const svg = svgEl('svg', { viewBox: '0 0 420 540', role: 'img', 'aria-label': '学校のネットワーク図' });

  // 通信線（先に描いてカードの後ろに回す）
  DEVICES.forEach(function (d) {
    if (!d.parent) return;
    const p = DEV[d.parent];
    const line = svgEl('line', {
      x1: p.x, y1: p.y + NODE_H / 2,
      x2: d.x, y2: d.y - NODE_H / 2,
      'class': 'edge unknown'
    });
    svg.appendChild(line);
    edgeEls[d.id] = line;
  });

  // 機器カード
  DEVICES.forEach(function (d) {
    const g = svgEl('g', { 'class': 'node unknown' });
    g.appendChild(svgEl('rect', {
      x: d.x - NODE_W / 2, y: d.y - NODE_H / 2,
      width: NODE_W, height: NODE_H, rx: 10
    }));
    const name = svgEl('text', { x: d.x, y: d.y - 4, 'class': 'node-name' });
    name.textContent = d.name;
    const st = svgEl('text', { x: d.x, y: d.y + 15, 'class': 'node-status' });
    g.appendChild(name);
    g.appendChild(st);
    svg.appendChild(g);
    nodeEls[d.id] = g;
    statusEls[d.id] = st;
  });

  document.getElementById('diagram-wrap').appendChild(svg);
}

/* 図に色をつける。
   nodeStatus / edgeStatus : { 機器id: 'ok' | 'ng' | 'unknown' }（無い機器は 'unknown'）
   selectedId : 選択中の機器id（なければ null） */
function paintDiagram(nodeStatus, edgeStatus, selectedId) {
  DEVICES.forEach(function (d) {
    const s = nodeStatus[d.id] || 'unknown';
    const labels = d.kind === 'end' ? LABEL_END : LABEL_INFRA;
    nodeEls[d.id].setAttribute('class', 'node ' + s + (d.id === selectedId ? ' selected' : ''));
    statusEls[d.id].textContent = labels[s];
    if (d.parent) {
      edgeEls[d.id].setAttribute('class', 'edge ' + (edgeStatus[d.id] || 'unknown'));
    }
  });
}

// 故障機器 broken を反映した図を表示する
function paintScenario(broken) {
  const r = simulate(broken);
  paintDiagram(r.nodeStatus, r.edgeStatus, null);
  return r;
}

// 問題を解いている最中の図（観察できた端末だけ色がつき、他は灰色）
function paintQuestion() {
  const c = CASES[state.caseIndex];
  const nodeStatus = {};
  c.observations.forEach(function (o) {
    o.nodes.forEach(function (id) { nodeStatus[id] = o.ok ? 'ok' : 'ng'; });
  });
  paintDiagram(nodeStatus, {}, state.selected);
}


/* =====================================================
   4. 問題画面の処理
   ===================================================== */

// アプリ全体の状態
const state = {
  view: 'game',      // 'game'（問題）か 'result'（結果）
  teacher: false,    // 先生モードか
  caseIndex: 0,      // 今のケース番号（0始まり）
  selected: null,    // 選んでいる機器id
  attempts: 0,       // 今のケースで診断した回数
  solved: false,     // 今のケースが終わったか
  results: []        // ケースごとの結果 { title, firstTry }
};

const $ = function (id) { return document.getElementById(id); };

// 要素を作る小さな道具（textContentを使うので、問題文に < > があっても安全）
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// 右エリアの表示を切り替える（'game' / 'result' / 'teacher'）
function showView(name) {
  $('view-game').hidden = name !== 'game';
  $('view-result').hidden = name !== 'result';
  $('view-teacher').hidden = name !== 'teacher';
}

// 選択ボタンを作る
function buildChoices() {
  const box = $('choices');
  CHOICES.forEach(function (c) {
    const b = el('button', 'choice-btn', c.label);
    b.type = 'button';
    b.dataset.id = c.id;
    b.addEventListener('click', function () { onChoose(c.id); });
    box.appendChild(b);
  });
}

// ケースを画面に表示する
function renderCase() {
  const c = CASES[state.caseIndex];
  state.selected = null;
  state.attempts = 0;
  state.solved = false;

  $('case-progress').textContent = 'ケース ' + (state.caseIndex + 1) + ' / ' + CASES.length;
  $('case-title').textContent = c.title;

  const story = $('story');
  story.textContent = '';
  c.story.forEach(function (line) { story.appendChild(el('p', '', line)); });

  const body = $('obs-body');
  body.textContent = '';
  c.observations.forEach(function (o) {
    const tr = el('tr');
    tr.appendChild(el('td', '', o.label));
    tr.appendChild(el('td', 'mark ' + (o.ok ? 'ok' : 'ng'), o.ok ? '○' : '×'));
    body.appendChild(tr);
  });

  $('feedback').hidden = true;
  $('next-btn').hidden = true;
  $('reveal-btn').hidden = true;
  $('diagnose-btn').hidden = false;
  updateChoiceButtons();
  paintQuestion();
}

// 選択ボタンの見た目と「診断する」の有効・無効を更新
function updateChoiceButtons() {
  document.querySelectorAll('.choice-btn').forEach(function (b) {
    b.classList.toggle('selected', b.dataset.id === state.selected);
    b.disabled = state.solved;
  });
  $('diagnose-btn').disabled = state.solved || !state.selected;
}

// 機器を選んだとき
function onChoose(id) {
  if (state.solved) return;
  state.selected = id;
  updateChoiceButtons();
  paintQuestion();   // 選んだ機器に枠をつける
}

// 判定メッセージを表示する
function showFeedback(kind, title, paragraphs, point, think) {
  const fb = $('feedback');
  fb.textContent = '';
  fb.className = 'feedback ' + kind;
  fb.appendChild(el('h3', '', title));
  paragraphs.forEach(function (t) { fb.appendChild(el('p', '', t)); });
  if (point) fb.appendChild(el('p', 'point', '学習ポイント：' + point));
  if (think) fb.appendChild(el('p', 'think', think));
  fb.hidden = false;
}

// 「診断する」を押したとき
function onDiagnose() {
  if (!state.selected || state.solved) return;
  const c = CASES[state.caseIndex];
  const choice = CHOICES.find(function (x) { return x.id === state.selected; });
  state.attempts += 1;

  if (state.selected === c.answer) {
    // ---- 正解 ----
    finishCase(false);
    showFeedback('ok', '正解！',
      [choice.label + 'が故障しています。'].concat(c.explanation),
      c.point,
      '考えてみよう：観察結果のどこを比べて、この機器だと判断できた？　隣の人に説明してみよう。');
  } else {
    // ---- 不正解 ----
    const hints = [];
    if (c.wrongHints[state.selected]) hints.push(c.wrongHints[state.selected]);
    hints.push(c.hint);
    showFeedback('ng', 'もう一度考えてみましょう', hints, null,
      '考えてみよう：「通信できる機器」と「通信できない機器」の違いはどこにある？');
    if (state.attempts >= MISS_BEFORE_REVEAL) $('reveal-btn').hidden = false;
  }
}

// 「答えを見る」を押したとき（この場合は不正解扱い）
function onReveal() {
  const c = CASES[state.caseIndex];
  const ans = CHOICES.find(function (x) { return x.id === c.answer; });
  finishCase(true);
  showFeedback('ok', '答えは「' + ans.label + '」です',
    c.explanation, c.point,
    '考えてみよう：どの観察結果に注目すれば、この答えにたどりつけたかな？');
}

// ケースを終える共通処理（revealed = 答えを見た場合 true）
function finishCase(revealed) {
  const c = CASES[state.caseIndex];
  state.solved = true;
  state.results.push({ title: c.title, firstTry: !revealed && state.attempts === 1 });

  paintScenario(c.broken);   // 故障機器と影響を受ける通信線を赤くする
  updateChoiceButtons();
  $('diagnose-btn').hidden = true;
  $('reveal-btn').hidden = true;

  const isLast = state.caseIndex === CASES.length - 1;
  $('next-btn').textContent = isLast ? '結果を見る' : '次のケースへ';
  $('next-btn').hidden = false;
}

// 「次のケースへ」を押したとき
function onNext() {
  if (state.caseIndex < CASES.length - 1) {
    state.caseIndex += 1;
    renderCase();
  } else {
    showResult();
  }
}


/* =====================================================
   5. 結果画面・振り返りの処理
   ===================================================== */

function showResult() {
  state.view = 'result';
  const total = state.results.length;
  const correct = state.results.filter(function (r) { return r.firstTry; }).length;
  const rate = total === 0 ? 0 : Math.round(correct / total * 100);

  $('res-summary').textContent = total + '問中' + correct + '問正解';
  $('res-rate').textContent = '正答率 ' + rate + '%（挑戦した問題数：' + total + '問）';

  const list = $('res-list');
  list.textContent = '';
  state.results.forEach(function (r) {
    list.appendChild(el('li', '', r.title + '　' + (r.firstTry ? '○ 最初の回答で正解' : '△ 何度か考えて解決')));
  });

  // 振り返り欄を初期状態に戻す
  const ta = $('reflection');
  ta.value = '';
  ta.disabled = false;
  $('model-box').hidden = true;
  $('restart-btn').hidden = true;
  $('submit-btn').hidden = false;
  updateCharCount();

  showView('result');
  paintScenario([]);   // 図は「全正常」の状態にしておく
}

// 文字数の表示と、提出ボタンの有効・無効
function updateCharCount() {
  const len = $('reflection').value.length;
  const msg = len + ' / ' + REFLECTION_MAX + '文字（' + REFLECTION_MIN + '文字以上で提出できます）';
  $('char-count').textContent = msg;
  $('submit-btn').disabled = len < REFLECTION_MIN;
}

// 「提出」を押したとき：模範例を表示
function onSubmit() {
  $('reflection').disabled = true;
  $('submit-btn').hidden = true;

  const box = $('model-text');
  box.textContent = '';
  MODEL_REFLECTION.forEach(function (line) { box.appendChild(el('p', '', line)); });
  $('model-box').hidden = false;
  $('restart-btn').hidden = false;
}

// 「もう一度挑戦する」
function onRestart() {
  state.view = 'game';
  state.caseIndex = 0;
  state.results = [];
  showView('game');
  renderCase();
}


/* =====================================================
   6. 先生モードの処理
   ===================================================== */

// 先生モードのボタン（増やしたいときはここに1行足す）
const TEACHER_SCENARIOS = [
  { label: 'ルーター故障',           broken: ['router'] },
  { label: 'スイッチ故障',           broken: ['switch'] },
  { label: 'アクセスポイント故障',   broken: ['ap'] },
  { label: 'インターネット回線故障', broken: ['internet'] },
  { label: '全正常',                 broken: [] }
];

function buildTeacherButtons() {
  const box = $('teacher-buttons');
  TEACHER_SCENARIOS.forEach(function (s, i) {
    const b = el('button', '', s.label);
    b.type = 'button';
    b.addEventListener('click', function () { applyScenario(i); });
    box.appendChild(b);
  });
}

// 選んだ故障パターンを図と表に反映する
function applyScenario(index) {
  const s = TEACHER_SCENARIOS[index];
  const r = paintScenario(s.broken);

  document.querySelectorAll('#teacher-buttons button').forEach(function (b, i) {
    b.classList.toggle('active', i === index);
  });

  // 影響を受ける端末の一覧
  const affected = r.table.filter(function (t) { return !t.lan || !t.net; })
                          .map(function (t) { return t.name; });
  $('teacher-summary').textContent = s.broken.length === 0
    ? '故障はありません。すべて正常です。'
    : '影響を受ける端末：' + (affected.length ? affected.join('、') : 'なし');

  const body = $('teacher-body');
  body.textContent = '';
  r.table.forEach(function (t) {
    const tr = el('tr');
    tr.appendChild(el('td', '', t.name));
    tr.appendChild(el('td', 'mark ' + (t.lan ? 'ok' : 'ng'), t.lan ? '○' : '×'));
    tr.appendChild(el('td', 'mark ' + (t.net ? 'ok' : 'ng'), t.net ? '○' : '×'));
    body.appendChild(tr);
  });
}

// 先生モードの入り・出
function toggleTeacher() {
  state.teacher = !state.teacher;
  $('teacher-btn').classList.toggle('active', state.teacher);
  $('teacher-btn').textContent = state.teacher ? '先生モードを終了' : '先生モード';

  if (state.teacher) {
    showView('teacher');
    applyScenario(TEACHER_SCENARIOS.length - 1);   // 最初は「全正常」
  } else {
    showView(state.view);
    // 元の画面に合わせて図を戻す
    if (state.view === 'result') paintScenario([]);
    else if (state.solved) paintScenario(CASES[state.caseIndex].broken);
    else paintQuestion();
  }
}


/* =====================================================
   7. 起動処理
   ===================================================== */

function init() {
  buildDiagram();
  buildChoices();
  buildTeacherButtons();

  $('diagnose-btn').addEventListener('click', onDiagnose);
  $('reveal-btn').addEventListener('click', onReveal);
  $('next-btn').addEventListener('click', onNext);
  $('teacher-btn').addEventListener('click', toggleTeacher);
  $('reflection').maxLength = REFLECTION_MAX;
  $('reflection').addEventListener('input', updateCharCount);
  $('submit-btn').addEventListener('click', onSubmit);
  $('restart-btn').addEventListener('click', onRestart);

  renderCase();
}

document.addEventListener('DOMContentLoaded', init);
