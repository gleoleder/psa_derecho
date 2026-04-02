// ════════════════════════════════════════════════════════════════
// APPS SCRIPT — Pegar en https://script.google.com → Nuevo proyecto
// ════════════════════════════════════════════════════════════════
//
// PASOS DE DESPLIEGUE:
//   1. Ve a https://script.google.com → Nuevo proyecto
//   2. Borra el código por defecto y pega TODO este archivo
//   3. Menú: Implementar → Nueva implementación
//   4. Tipo: Aplicación web
//   5. Ejecutar como: Yo (tu cuenta Google)
//   6. Quién tiene acceso: Cualquier persona
//   7. Implementar → copia la URL que aparece
//   8. Pega esa URL como APPS_SCRIPT_URL en js/app.js
// ════════════════════════════════════════════════════════════════

const SHEET_ID = '1ouH_I009Vb1viVgFbpXGSRL1QbVWQomg-ae6kVswAYE';

function doGet(e) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheets()[0]; // primera pestaña

    // Crear cabecera si la hoja está vacía
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Nombre', 'Email', 'Carrera', 'Fecha', 'Hora',
        'Correctas', 'Incorrectas', 'Total', 'Porcentaje',
        'Resultado', 'Tiempo'
      ]);
    }

    const p = e.parameter;
    sheet.appendRow([
      p.nombre      || '',
      p.email       || '',
      p.carrera     || '',
      p.fecha       || '',
      p.hora        || '',
      Number(p.correctas)   || 0,
      Number(p.incorrectas) || 0,
      Number(p.total)       || 0,
      p.porcentaje  || '',
      p.resultado   || '',
      p.tiempo      || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
