# 📊 Cómo conectar Google Sheets SIN popup de login

## Pasos (5 minutos):

### 1. Abre tu Google Sheet
Ve a: https://docs.google.com/spreadsheets/d/1ouH_I009Vb1viVgFbpXGSRL1QbVWQomg-ae6kVswAYE

Asegúrate de que la hoja se llame: `Registros_PSA`
Con estas columnas en la fila 1: `Nombre | Carrera | Fecha | Hora | Dispositivo`

---

### 2. Abre el editor de Apps Script
En el Sheet: **Extensiones → Apps Script**

---

### 3. Pega este código (reemplaza todo lo que hay):

```javascript
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById('1ouH_I009Vb1viVgFbpXGSRL1QbVWQomg-ae6kVswAYE');
    var sheet = ss.getSheetByName('Registros_PSA');
    if (!sheet) sheet = ss.insertSheet('Registros_PSA');

    var p = e.parameter;
    sheet.appendRow([
      p.nombre || '',
      p.carrera || '',
      p.fecha || '',
      p.hora || '',
      p.ua || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', msg: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

### 4. Despliega como Web App
- Haz clic en **Implementar → Nueva implementación**
- Tipo: **Aplicación web**
- Ejecutar como: **Yo** (tu cuenta Google)
- Quién tiene acceso: **Cualquier persona**
- Clic en **Implementar**
- Copia la **URL** que aparece (empieza con `https://script.google.com/macros/s/...`)

---

### 5. Pega la URL en js/app.js
Abre `js/app.js` y reemplaza la línea:

```javascript
const APPS_SCRIPT_URL = 'TU_APPS_SCRIPT_URL_AQUI';
```

Por:

```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/TU_ID/exec';
```

---

¡Listo! Desde ese momento cada registro del simulacro se guarda automáticamente en tu Sheet sin ningún popup ni login.
