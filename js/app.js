// ═══════════════════════════════════════════════════════
// CONFIG GOOGLE SHEETS
// ═══════════════════════════════════════════════════════
const CONFIG = {
  GOOGLE_SHEET_ID: '1ouH_I009Vb1viVgFbpXGSRL1QbVWQomg-ae6kVswAYE',
  CLIENT_ID: '814005655098-8csk41qts3okv4b2fjnq7ls4qc2kq0vc.apps.googleusercontent.com',
  API_KEY: 'AIzaSyAOhGTjJXHhuUhqf1g2DPCla59xNzftb-Q',
  SHEET_NAME: 'Registros_PSA',
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets'
};

let tokenClient;
let gapiInited = false;
let gisInited = false;
let pendingData = null;

function gapiLoaded() {
  gapi.load('client', async () => {
    await gapi.client.init({ apiKey: CONFIG.API_KEY, discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'] });
    gapiInited = true;
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: async (resp) => {
      if (resp.error) { showToast('❌ Error de autenticación Google','err'); enableRegister(); return; }
      if (pendingData) { await appendToSheet(pendingData); pendingData = null; }
    }
  });
  gisInited = true;
}

async function saveToSheets(row) {
  if (!gapiInited || !gisInited) { showToast('ℹ️ Registro local guardado (sin conexión Google)','ok'); continueToExam(); return; }
  pendingData = row;
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    await appendToSheet(row);
    pendingData = null;
  }
}

async function appendToSheet(row) {
  try {
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
      range: `${CONFIG.SHEET_NAME}!A:E`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] }
    });
    showToast('✅ Registro guardado correctamente','ok');
  } catch(e) {
    showToast('⚠️ No se pudo guardar en Sheets','err');
  }
  continueToExam();
}

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let student = {};
let current = 0;
let correct = 0;
let wrong = 0;
let answered = false;

const catColors = { CPE:'#D4A017', DUDDHH:'#60a5fa', Rousseau:'#a78bfa', Historia:'#34d399' };

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function enableRegister() {
  document.getElementById('btn-start').disabled = false;
  document.getElementById('saving-msg').style.display = 'none';
}

function showToast(msg, type='ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3500);
}

function startExam() {
  const name = document.getElementById('inp-name').value.trim();
  const carrera = document.getElementById('inp-carrera').value;
  if (!name || !carrera) { showToast('⚠️ Por favor completa todos los campos','err'); return; }

  const now = new Date();
  const fecha = now.toLocaleDateString('es-BO');
  const hora = now.toLocaleTimeString('es-BO');

  student = { name, carrera, fecha, hora };

  document.getElementById('btn-start').disabled = true;
  document.getElementById('saving-msg').style.display = 'block';

  const row = [name, carrera, fecha, hora, navigator.userAgent.substring(0,80)];
  saveToSheets(row);
}

function continueToExam() {
  current = 0; correct = 0; wrong = 0;
  enableRegister();
  updateScore();
  showScreen('exam');
  renderQuestion();
}

function renderQuestion() {
  const q = examQuestions[current];
  const pct = ((current + 1) / examQuestions.length * 100).toFixed(1);
  document.getElementById('prog-text').textContent = `${current + 1} / ${examQuestions.length}`;
  document.getElementById('prog-bar').style.width = pct + '%';

  const cat = q.category || 'CPE';
  const color = catColors[cat] || '#D4A017';
  answered = false;

  const wrapper = document.getElementById('question-wrapper');
  wrapper.innerHTML = `
    <div class="question-category" style="color:${color};border-color:${color}40;background:${color}18">
      ${cat} &mdash; Pregunta ${current + 1} de ${examQuestions.length}
    </div>
    <div class="question-text">${q.text}</div>
    <div class="options-list" id="opts-list">
      ${q.options.map(opt => `
        <button class="option-btn" onclick="selectOption('${opt.letter}')">
          <span class="opt-letter">${opt.letter}</span>
          <span>${opt.text}</span>
        </button>
      `).join('')}
    </div>
    <div class="feedback-msg" id="feedback"></div>
    <button class="next-btn" id="next-btn" onclick="nextQuestion()">
      ${current < examQuestions.length - 1 ? 'Siguiente →' : 'Ver Resultados 🏆'}
    </button>
  `;
  wrapper.style.animation = 'none';
  requestAnimationFrame(() => { wrapper.style.animation = 'fadeUp 0.4s ease'; });
}

function selectOption(letter) {
  if (answered) return;
  answered = true;
  const q = examQuestions[current];
  const isCorrect = letter === q.correctAnswer;
  if (isCorrect) correct++; else wrong++;
  updateScore();

  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    const l = btn.querySelector('.opt-letter').textContent;
    if (l === q.correctAnswer) btn.classList.add('correct');
    else if (l === letter && !isCorrect) btn.classList.add('wrong');
  });

  const fb = document.getElementById('feedback');
  if (isCorrect) {
    fb.className = 'feedback-msg correct show';
    fb.textContent = '✅ ¡Correcto! Muy bien.';
  } else {
    fb.className = 'feedback-msg wrong show';
    fb.textContent = `❌ Incorrecto. La respuesta correcta era: ${q.correctAnswer}. ${q.options.find(o=>o.letter===q.correctAnswer).text}`;
  }
  document.getElementById('next-btn').classList.add('show');
}

function nextQuestion() {
  if (current < examQuestions.length - 1) { current++; renderQuestion(); }
  else showResults();
}

function updateScore() {
  document.getElementById('correct-count').textContent = correct;
  document.getElementById('wrong-count').textContent = wrong;
}

function showResults() {
  const total = examQuestions.length;
  const pct = Math.round(correct / total * 100);
  const pass = pct >= 51;

  document.getElementById('res-name').textContent = student.name;
  document.getElementById('res-info').textContent = `${student.carrera} | ${student.fecha} ${student.hora}`;

  const scoreEl = document.getElementById('res-score');
  scoreEl.textContent = pct + '%';
  scoreEl.className = 'big-score ' + (pass ? 'pass' : 'fail');

  document.getElementById('res-correct').textContent = correct;
  document.getElementById('res-wrong').textContent = wrong;
  document.getElementById('res-total').textContent = total;
  document.getElementById('res-title').textContent = pass ? '¡Simulacro Aprobado!' : 'Simulacro No Aprobado';

  const verdict = document.getElementById('res-verdict');
  if (pass) {
    verdict.className = 'verdict pass';
    verdict.textContent = `🎉 ¡Felicidades! Aprobaste con ${pct}%. Mínimo requerido: 51%`;
  } else {
    verdict.className = 'verdict fail';
    verdict.textContent = `😔 Obtuviste ${pct}%, no alcanzaste el 51%. ¡Sigue estudiando!`;
  }
  showScreen('results');
}

function restart() {
  current = 0; correct = 0; wrong = 0;
  showScreen('landing');
}

// ═══════════════════════════════════════════════════════
// INIT GOOGLE APIs
// ═══════════════════════════════════════════════════════
window.addEventListener('load', () => {
  const s1 = document.createElement('script');
  s1.src = 'https://apis.google.com/js/api.js';
  s1.onload = () => gapi.load('client', async () => {
    try {
      await gapi.client.init({ apiKey: CONFIG.API_KEY, discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'] });
      gapiInited = true;
    } catch(e) {}
  });
  document.head.appendChild(s1);

  const s2 = document.createElement('script');
  s2.src = 'https://accounts.google.com/gsi/client';
  s2.onload = () => {
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: async (resp) => {
          if (resp.error) { showToast('ℹ️ Continuando sin guardar en Sheets','err'); continueToExam(); return; }
          if (pendingData) { await appendToSheet(pendingData); pendingData = null; }
        }
      });
      gisInited = true;
    } catch(e) {}
  };
  document.head.appendChild(s2);
});
