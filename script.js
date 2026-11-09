// ===== 設定（スタートを押したときに画面の入力欄から読み込む） =====
let workSeconds = 30;     // 動く秒数
let restSeconds = 30;     // 休む秒数
let totalSets = 5;        // セット数
let changeInterval = 2000; // 方向が変わる間隔（ミリ秒）

// 6つの方向のリスト
const directions = ['左前', '右前', '左横', '右横', '左奥', '右奥'];

// 画面の部品
const directionBox = document.getElementById('direction');
const statusBox = document.getElementById('status');
const timeBox = document.getElementById('time');
const startButton = document.getElementById('startButton');

// 設定の入力欄
const settingsBox = document.getElementById('settings');
const intervalInput = document.getElementById('intervalInput');
const workInput = document.getElementById('workInput');
const restInput = document.getElementById('restInput');
const setsInput = document.getElementById('setsInput');
const soundInput = document.getElementById('soundInput');

// ===== 音 =====
// ブラウザの中で音を作る仕組み（Web Audio API）。音のファイルはいらない
let audioContext = null;

// 音の準備。スマホは「人がボタンを押したとき」にしか音を出す許可をくれないので、
// スタートボタンが押されたときにこれを呼ぶ
function prepareSound() {
  if (audioContext === null) {
    audioContext = new AudioContext();
  }
  audioContext.resume(); // 止まっていたら動かす
}

// 「ピッ」と短く鳴らす
function beep() {
  if (!soundInput.checked || audioContext === null) {
    return; // 音オフなら何もしない
  }
  const now = audioContext.currentTime;     // 今の時刻（秒）
  const oscillator = audioContext.createOscillator(); // 音のもと（発振器）
  const volume = audioContext.createGain();           // 音量のつまみ

  oscillator.frequency.value = 880; // 音の高さ（880Hz＝高めの「ラ」）
  volume.gain.setValueAtTime(0.3, now);                    // 最初の音量
  volume.gain.exponentialRampToValueAtTime(0.001, now + 0.15); // 0.15秒でスッと消す

  oscillator.connect(volume);                 // 音のもと → 音量つまみ
  volume.connect(audioContext.destination);  // 音量つまみ → スピーカー
  oscillator.start(now);
  oscillator.stop(now + 0.15);
}

// 入力欄から数字を読む。空っぽや範囲外なら直してから返す
function readNumber(input, min, max) {
  let value = Number(input.value);
  if (input.value === '' || Number.isNaN(value)) {
    value = Number(input.defaultValue); // 空っぽなら最初の値に戻す
  }
  if (value < min) {
    value = min;
  }
  if (value > max) {
    value = max;
  }
  input.value = value; // 直した値を入力欄にも書き戻す
  return value;
}

// 入力欄の値を設定に読み込む
function loadSettings() {
  changeInterval = readNumber(intervalInput, 1, 4) * 1000; // 秒 → ミリ秒
  workSeconds = Math.round(readNumber(workInput, 5, 300));
  restSeconds = Math.round(readNumber(restInput, 5, 300));
  totalSets = Math.round(readNumber(setsInput, 1, 20));
}

// ===== スリープ防止（Wake Lock） =====
// ブラウザに「画面を消さないで」と頼む仕組み。対応していないブラウザでは何もしない
let wakeLock = null;

async function keepScreenOn() {
  if (!('wakeLock' in navigator)) {
    return; // このブラウザはWake Lockに対応していない
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (error) {
    // 電池残量が少ないときなどは断られることがある。アプリは止めずにそのまま続ける
    console.log('Wake Lockを取れなかった:', error.message);
  }
}

function allowScreenOff() {
  if (wakeLock !== null) {
    wakeLock.release(); // 「消さないで」のお願いを取り下げる
    wakeLock = null;
  }
}

// 別のアプリに切り替えたりするとWake Lockは自動で外れる。
// 練習中にこの画面へ戻ってきたら、もう一度お願いし直す
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && isRunning) {
    keepScreenOn();
  }
});

// ===== 練習の状態 =====
let lastDirection = '';   // 前回表示した方向
let isRunning = false;    // 動いている最中かどうか
let phase = 'work';       // 'work'（動く）か 'rest'（休み）
let currentSet = 1;       // 今何セット目か
let remaining = 0;        // 今の区間の残り秒数
let countdownTimer = null; // 1秒ごとのカウントダウン用タイマー
let directionTimer = null; // 方向切り替え用タイマー

// ランダムな方向を1つ選んで表示する（前回と同じ方向は出さない）
function showRandomDirection() {
  let next;
  do {
    const index = Math.floor(Math.random() * directions.length);
    next = directions[index];
  } while (next === lastDirection);

  directionBox.textContent = next;
  lastDirection = next;
  beep(); // 切り替わったら鳴らす
}

// 上の「何セット目・動く/休み」と、下の「残り秒数」を書き換える
function updateScreen() {
  let phaseName;
  if (phase === 'work') {
    phaseName = '動く';
  } else {
    phaseName = '休み';
  }
  statusBox.textContent = currentSet + ' / ' + totalSets + ' セット　' + phaseName;
  timeBox.textContent = '残り ' + remaining + ' 秒';
}

// 動く区間を始める
function startWork() {
  phase = 'work';
  document.body.className = 'work'; // CSSで「動く」の色にする
  remaining = workSeconds;
  showRandomDirection();
  directionTimer = setInterval(showRandomDirection, changeInterval);
  updateScreen();
}

// 休みの区間を始める
function startRest() {
  phase = 'rest';
  document.body.className = 'rest'; // CSSで「休み」の色にする
  remaining = restSeconds;
  clearInterval(directionTimer); // 方向の切り替えを止める
  directionBox.textContent = '休み';
  updateScreen();
}

// 1秒ごとに呼ばれる
function tick() {
  remaining = remaining - 1;

  // まだ時間が残っているなら、表示を更新するだけ
  if (remaining > 0) {
    updateScreen();
    return;
  }

  // 残りが0になったら、次の区間へ
  if (phase === 'work') {
    if (currentSet === totalSets) {
      finish();      // 最後のセットが終わった
    } else {
      startRest();   // 休みへ
    }
  } else {
    currentSet = currentSet + 1;
    startWork();     // 休みが終わったら次のセット
  }
}

// スタート
function start() {
  prepareSound(); // ボタンを押したこの瞬間に音の準備をしておく
  keepScreenOn(); // 練習中は画面を消さない
  loadSettings();
  settingsBox.disabled = true; // 練習中は設定をいじれないようにする
  isRunning = true;
  currentSet = 1;
  lastDirection = '';
  startButton.textContent = 'ストップ';
  startWork();
  countdownTimer = setInterval(tick, 1000);
}

// ストップ（途中でやめる）
function stop() {
  isRunning = false;
  allowScreenOff(); // 練習が終わったら、画面が消えてもいい状態に戻す
  settingsBox.disabled = false; // 設定をまたいじれるようにする
  document.body.className = ''; // 色を元に戻す
  clearInterval(countdownTimer);
  clearInterval(directionTimer);
  startButton.textContent = 'スタート';
  directionBox.textContent = '準備OK';
  statusBox.textContent = '';
  timeBox.textContent = '';
}

// 全セット終わった
function finish() {
  stop();
  directionBox.textContent = 'おわり';
}

// ボタンが押されたとき：動いていれば止める、止まっていれば始める
startButton.addEventListener('click', function () {
  if (isRunning) {
    stop();
  } else {
    start();
  }
});
