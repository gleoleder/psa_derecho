// Referencia al array definido en questions.js (carga antes en el HTML)
/* global examQuestions */

// ═══════════════════════════════════════════════════════
// CONFIGURACIÓN GOOGLE
// ═══════════════════════════════════════════════════════

// CLIENT_ID de tu proyecto en https://console.cloud.google.com
// (puedes reusar el de colegio_asistencia si agregas este dominio
//  en Authorized JavaScript Origins de ese mismo proyecto)
const GOOGLE_CLIENT_ID = '814005655098-8csk41qts3okv4b2fjnq7ls4qc2kq0vc.apps.googleusercontent.com';

// URL del Apps Script desplegado (ver APPS_SCRIPT.js para instrucciones)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzsyL3yG5kD1WOuJeenAgmbSuQDnPO0EzDwhp1415VG1nvfcINX-G1mvMwxXJe67GAuQA/exec';

// ═══════════════════════════════════════════════════════
// ESTADO DE AUTH
// ═══════════════════════════════════════════════════════
const AUTH = {
  tokenClient: null,
  accessToken: null,
  user: null   // { name, email, picture }
};

// ─── INIT SDK (solo GIS — sin api.js) ───────────────────
function onGisLoad() {
  try {
    AUTH.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      // Solo perfil básico — sin spreadsheets → no aparece pantalla de permisos
      scope: 'email profile',
      callback: ''  // se asigna en handleGoogleLogin()
    });
    // SDKs listos: mostrar botón
    document.getElementById('google-loading').style.display = 'none';
    document.getElementById('google-btn').style.display     = 'flex';
  } catch (e) {
    showGoogleError('Error al cargar Google Sign-In. Recarga la página.');
  }
}

// ─── HELPERS UI (login) ─────────────────────────────────
function showGoogleLoading(text) {
  document.getElementById('google-loading').style.display    = 'flex';
  document.getElementById('google-loading-text').textContent = text || 'Conectando...';
  document.getElementById('google-btn').style.display        = 'none';
  document.getElementById('google-error').style.display      = 'none';
}
function showGoogleBtn() {
  document.getElementById('google-loading').style.display = 'none';
  document.getElementById('google-btn').style.display     = 'flex';
}
function showGoogleError(msg) {
  document.getElementById('google-loading').style.display = 'none';
  document.getElementById('google-btn').style.display     = 'flex';
  const el = document.getElementById('google-error');
  el.style.display = 'block';
  el.textContent   = msg;
}

// ─── LOGIN CON GOOGLE ────────────────────────────────────
// Con scope 'email profile' Google muestra SOLO el selector de cuenta
// sin pantalla de permisos avanzados
function handleGoogleLogin() {
  showGoogleLoading('Conectando...');

  AUTH.tokenClient.callback = async (resp) => {
    if (resp.error) {
      showGoogleError('No se pudo conectar con Google. Intenta de nuevo.');
      return;
    }

    AUTH.accessToken = resp.access_token;
    showGoogleLoading('Obteniendo perfil...');

    try {
      const r    = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + AUTH.accessToken }
      });
      const data = await r.json();

      AUTH.user = {
        name:    (data.name  || data.email || '').trim(),
        email:   (data.email || '').toLowerCase().trim(),
        picture: data.picture || ''
      };

      renderGoogleProfile(AUTH.user);
      // Pasar al paso 2: solo elegir carrera
      document.getElementById('google-login-section').style.display = 'none';
      document.getElementById('carrera-section').style.display      = 'block';

    } catch (e) {
      showGoogleError('No se pudo obtener tu perfil. Verifica tu conexión.');
    }
  };

  // 'select_account' muestra solo el selector de cuenta, sin pantalla de consentimiento
  AUTH.tokenClient.requestAccessToken({ prompt: 'select_account' });
}

function renderGoogleProfile(user) {
  const avatarEl = document.getElementById('gp-avatar');
  if (user.picture) {
    avatarEl.innerHTML = `<img src="${user.picture}" alt="${user.name}" referrerpolicy="no-referrer">`;
  } else {
    avatarEl.textContent = user.name.charAt(0).toUpperCase();
  }
  document.getElementById('gp-name').textContent  = user.name;
  document.getElementById('gp-email').textContent = user.email;
}

// ═══════════════════════════════════════════════════════
// GUARDAR EN SHEETS — via Apps Script (no requiere OAuth extra)
// ═══════════════════════════════════════════════════════
async function saveResultToSheets(row) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('TU_')) return false;
  try {
    const params = new URLSearchParams({
      nombre:      row[0],
      email:       row[1],
      carrera:     row[2],
      fecha:       row[3],
      hora:        row[4],
      correctas:   row[5],
      incorrectas: row[6],
      total:       row[7],
      porcentaje:  row[8],
      resultado:   row[9],
      tiempo:      row[10],
      comentario:  row[11] || ''
    });
    await fetch(APPS_SCRIPT_URL + '?' + params.toString(), {
      method: 'GET',
      mode:   'no-cors'  // Apps Script no necesita CORS
    });
    return true;
  } catch (e) {
    console.warn('Sheets save error:', e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// MODAL QR FULLSCREEN
// ═══════════════════════════════════════════════════════
function openQRModal() {
  document.getElementById('qr-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeQRModal() {
  document.getElementById('qr-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
// Cerrar con Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeQRModal();
});

// ═══════════════════════════════════════════════════════
// STATE DEL EXAMEN
// ═══════════════════════════════════════════════════════
let student   = {};
let current   = 0;
let correct   = 0;
let wrong     = 0;
let answered  = false;
let catScores = {};

// Timer
let examTimer   = null;
let examSeconds = 0;

const catColors = { CPE:'#D4A017', DUDDHH:'#60a5fa', Rousseau:'#a78bfa', Historia:'#34d399' };

// ─── TIMER ──────────────────────────────────────────────
function startTimer() {
  examSeconds = 0;
  if (examTimer) clearInterval(examTimer);
  updateTimerDisplay();
  examTimer = setInterval(() => { examSeconds++; updateTimerDisplay(); }, 1000);
}
function stopTimer() {
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
}
function updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  const m = String(Math.floor(examSeconds / 60)).padStart(2, '0');
  const s = String(examSeconds % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;
}
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s} seg`;
  return `${m} min${s > 0 ? ' ' + s + ' seg' : ''}`;
}

// ─── ATAJOS DE TECLADO ──────────────────────────────────
document.addEventListener('keydown', e => {
  const examScreen = document.getElementById('exam');
  if (examScreen.classList.contains('hidden')) return;
  const key = e.key.toUpperCase();
  if (['A','B','C','D','E'].includes(key) && !answered) {
    e.preventDefault(); selectOption(key);
  } else if ((e.key === 'Enter' || e.key === 'ArrowRight') && answered) {
    e.preventDefault();
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn && nextBtn.classList.contains('show')) nextQuestion();
  }
});

// ─── NAVEGACIÓN ─────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3500);
}

// ─── FLUJO DEL EXAMEN ───────────────────────────────────
function startExam() {
  if (!AUTH.user) { showToast('⚠️ Primero inicia sesión con Google', 'err'); return; }
  const carrera = document.getElementById('inp-carrera').value;
  if (!carrera) { showToast('⚠️ Selecciona tu carrera', 'err'); return; }

  const comentario = (document.getElementById('inp-comentario').value || '').trim();
  const now = new Date();
  student = {
    name:       AUTH.user.name,
    email:      AUTH.user.email,
    carrera,
    comentario,
    fecha:      now.toLocaleDateString('es-BO'),
    hora:       now.toLocaleTimeString('es-BO')
  };

  current = 0; correct = 0; wrong = 0;
  catScores = {};
  updateScore();
  showScreen('exam');
  startTimer();
  renderQuestion();
}

function renderQuestion() {
  const scroll = document.getElementById('exam-scroll');
  if (scroll) scroll.scrollTo({ top: 0, behavior: 'smooth' });

  const q     = examQuestions[current];
  const pct   = ((current + 1) / examQuestions.length * 100).toFixed(1);
  document.getElementById('prog-text').textContent = `${current + 1} / ${examQuestions.length}`;
  document.getElementById('prog-bar').style.width  = pct + '%';

  const cat   = q.category || 'CPE';
  const color = catColors[cat] || '#D4A017';
  answered    = false;

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
  const q   = examQuestions[current];
  const cat = q.category || 'CPE';
  const isOk = letter === q.correctAnswer;
  if (isOk) correct++; else wrong++;
  updateScore();

  if (!catScores[cat]) catScores[cat] = { c: 0, t: 0 };
  catScores[cat].t++;
  if (isOk) catScores[cat].c++;

  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    const l = btn.querySelector('.opt-letter').textContent;
    if (l === q.correctAnswer)      btn.classList.add('correct');
    else if (l === letter && !isOk) btn.classList.add('wrong');
  });

  const fb = document.getElementById('feedback');
  if (isOk) {
    fb.className   = 'feedback-msg correct show';
    fb.textContent = '✅ ¡Correcto! Muy bien.';
  } else {
    fb.className   = 'feedback-msg wrong show';
    fb.textContent = `❌ Incorrecto. La respuesta correcta era: ${q.correctAnswer}. ${q.options.find(o => o.letter === q.correctAnswer).text}`;
  }
  document.getElementById('next-btn').classList.add('show');
}

function nextQuestion() {
  if (current < examQuestions.length - 1) { current++; renderQuestion(); }
  else showResults();
}

function updateScore() {
  document.getElementById('correct-count').textContent = correct;
  document.getElementById('wrong-count').textContent   = wrong;
}

// ─── RESULTADOS ─────────────────────────────────────────
function renderCatBreakdown() {
  const entries = Object.entries(catScores);
  if (!entries.length) return '';
  const rows = entries.map(([cat, { c, t }]) => {
    const pct   = t > 0 ? Math.round(c / t * 100) : 0;
    const color = catColors[cat] || '#D4A017';
    return `
      <div class="cat-row">
        <span class="cat-row-name">${cat}</span>
        <div class="cat-bar-wrap">
          <div class="cat-bar-fill" style="width:0%;background:${color}" data-pct="${pct}"></div>
        </div>
        <span class="cat-stats">${c}/${t} &nbsp;${pct}%</span>
      </div>`;
  }).join('');
  return `
    <div class="cat-breakdown">
      <div class="cat-breakdown-title">Desempeño por Área</div>
      ${rows}
    </div>`;
}

async function showResults() {
  stopTimer();
  const total = examQuestions.length;
  const pct   = Math.round(correct / total * 100);
  const pass  = pct >= 51;

  document.getElementById('res-name').textContent = student.name;
  document.getElementById('res-info').textContent = `${student.carrera} | ${student.fecha} ${student.hora}`;
  document.getElementById('res-time').textContent = `⏱ Tiempo: ${formatTime(examSeconds)}`;

  const scoreEl = document.getElementById('res-score');
  scoreEl.textContent = pct + '%';
  scoreEl.className   = 'big-score ' + (pass ? 'pass' : 'fail');

  const bar = document.getElementById('score-bar');
  bar.className   = 'score-bar-fill ' + (pass ? 'pass' : 'fail');
  bar.style.width = '0%';

  document.getElementById('res-correct').textContent = correct;
  document.getElementById('res-wrong').textContent   = wrong;
  document.getElementById('res-total').textContent   = total;
  document.getElementById('res-title').textContent   = pass ? '¡Simulacro Aprobado!' : 'Simulacro No Aprobado';

  document.getElementById('cat-breakdown').innerHTML = renderCatBreakdown();

  const verdict = document.getElementById('res-verdict');
  verdict.className   = 'verdict ' + (pass ? 'pass' : 'fail');
  verdict.textContent = pass
    ? `🎉 ¡Felicidades! Aprobaste con ${pct}%. Mínimo requerido: 51%`
    : `😔 Obtuviste ${pct}%, no alcanzaste el 51%. ¡Sigue estudiando!`;

  showScreen('results');

  // Animar barras
  requestAnimationFrame(() => {
    setTimeout(() => {
      bar.style.width = pct + '%';
      document.querySelectorAll('.cat-bar-fill').forEach(b => {
        b.style.width = b.dataset.pct + '%';
      });
    }, 120);
  });

  // Guardar en Sheets via Apps Script
  const saved = await saveResultToSheets([
    student.name, student.email, student.carrera,
    student.fecha, student.hora,
    correct, wrong, total,
    pct + '%',
    pass ? 'APROBADO' : 'REPROBADO',
    formatTime(examSeconds),
    student.comentario   // carrera solicitada
  ]);
  if (saved) showToast('✅ Resultado guardado', 'ok');
}

function restart() {
  current = 0; correct = 0; wrong = 0;
  catScores = {}; examSeconds = 0;
  // Si ya tiene sesión de Google, saltarse el paso 1 directamente al 2
  if (AUTH.user) {
    document.getElementById('google-login-section').style.display = 'none';
    document.getElementById('carrera-section').style.display      = 'block';
    document.getElementById('inp-carrera').value = '';
  } else {
    document.getElementById('google-login-section').style.display = 'block';
    document.getElementById('carrera-section').style.display      = 'none';
  }
  showScreen('landing');
}
