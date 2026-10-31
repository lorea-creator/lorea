# Lorea · web app para iPhone (v0.3)

Dirección de la app: **https://lorea-creator.github.io/lorea/**

La app se instala en el iPhone desde Safari, sin App Store. Los datos (plantas, diario y fotos) se guardan **solo en tu iPhone**. La app no tiene ninguna conexión con Google ni con ninguna cuenta: la copia de seguridad la guardas tú en Drive con el menú Compartir del iPhone.

> ⚠️ Si borras el icono de Lorea de la pantalla de inicio, iOS borra también sus datos. Haz la copia semanal.

---

## 1 · Subir la app a GitHub

1. Entra en https://github.com con tu cuenta `lorea-creator`.
2. Arriba a la derecha, **+ → New repository**.
   - Repository name: `lorea` (exactamente así, en minúsculas)
   - Visibilidad: **Public** (GitHub Pages es gratis solo en repositorios públicos)
   - *Create repository*
3. En la pantalla siguiente pulsa **uploading an existing file**.
4. Descomprime el zip en tu ordenador y arrastra **el contenido** de la carpeta `lorea-github` (index.html, app.js, styles.css, store.js, sw.js, manifest.webmanifest, README.md y la carpeta `icons`). No arrastres la carpeta entera.
5. Abajo, **Commit changes**.
6. **Settings → Pages** → *Source*: `Deploy from a branch` → *Branch*: `main` y `/ (root)` → **Save**.
7. Espera 1–2 minutos y abre https://lorea-creator.github.io/lorea/

En el repositorio público solo hay código. Tus datos no se suben nunca.

## 2 · Instalarla en el iPhone

1. Abre https://lorea-creator.github.io/lorea/ en **Safari**.
2. **Compartir → Añadir a pantalla de inicio → Añadir**.
3. Usa siempre el icono. Funciona sin conexión; solo necesita internet para el tiempo.

## 3 · Preparar Google Drive (una vez)

1. Instala la app **Google Drive** en el iPhone e inicia sesión.
2. Abre la app **Archivos** → *Explorar* → los tres puntos (···) → **Editar** → activa **Drive**.
3. En Google Drive, crea una carpeta `Lorea`.

## 4 · Copia semanal

- Si han pasado 7 días desde la última copia, la pantalla **Hoy** muestra un aviso con **Hacer copia**.
- Al pulsarlo: **Guardar en Archivos → Drive → Lorea → Guardar**.
- Cada copia es un archivo `lorea-AAAA-MM-DD.json`. Borra de vez en cuando las antiguas si quieres.
- **Restaurar**: Ajustes → *Restaurar copia* → elige el archivo más reciente de Drive/Lorea.

## Actualizar la app más adelante

Sube los archivos modificados al repositorio (*Add file → Upload files*) y cambia el número de `VERSION` en `sw.js` (por ejemplo `lorea-v4`) para que el iPhone descargue la nueva versión. Tus datos no se tocan.

## Probar en local (opcional)

En el ordenador, dentro de la carpeta: `python3 -m http.server 8080` y abre http://localhost:8080. Los datos de esa prueba quedan en el navegador del ordenador, separados de los del iPhone.
