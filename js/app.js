// ═══════════════════════════════════════════════════════
// CONFIG — Google Apps Script Web App (sin OAuth popup)
// Ver README_SHEETS.md para instrucciones de configuración
// ═══════════════════════════════════════════════════════
const APPS_SCRIPT_URL = 'TU_APPS_SCRIPT_URL_AQUI';

// ═══════════════════════════════════════════════════════
// QR EXPANDIBLE
// ═══════════════════════════════════════════════════════
function toggleQR(el) {
  const banner = el.closest('.qr-banner');
  banner.classList.toggle('qr-expanded');
}

// ═══════════════════════════════════════════════════════
// GOOGLE SHEETS — Sin OAuth, sin popup
// ═══════════════════════════════════════════════════════
async function saveToSheets(row) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('TU_APPS')) {
    continueToExam();
    return;
  }
  try {
    const params = new URLSearchParams({
      nombre: row[0], carrera: row[1],
      fecha: row[2], hora: row[3], ua: row[4]
    });
    await fetch(APPS_SCRIPT_URL + '?' + params.toString(), { method: 'GET', mode: 'no-cors' });
    showToast('✅ Registro guardado', 'ok');
  } catch(e) { /* silencioso */ }
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
  student = { name, carrera, fecha: now.toLocaleDateString('es-BO'), hora: now.toLocaleTimeString('es-BO') };

  document.getElementById('btn-start').disabled = true;
  document.getElementById('saving-msg').style.display = 'block';

  saveToSheets([student.name, student.carrera, student.fecha, student.hora, navigator.userAgent.substring(0,80)]);
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
  verdict.className = 'verdict ' + (pass ? 'pass' : 'fail');
  verdict.textContent = pass
    ? `🎉 ¡Felicidades! Aprobaste con ${pct}%. Mínimo requerido: 51%`
    : `😔 Obtuviste ${pct}%, no alcanzaste el 51%. ¡Sigue estudiando!`;

  showScreen('results');
}

function restart() {
  current = 0; correct = 0; wrong = 0;
  showScreen('landing');
}
