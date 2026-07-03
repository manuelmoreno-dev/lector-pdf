# 📚 Lector PDF Inteligente & Audiolibro

Un lector de libros en formato PDF y reproductor de audiolibros interactivo, móvil y moderno, diseñado en **React Native** con **Expo**. La aplicación combina la lectura fluida con herramientas de **Inteligencia Artificial**, gamificación de hábitos de lectura y sincronización de portadas oficiales.

---

## 🚀 Características Principales

### 📖 Lector & Audiolibro Interactivo
* **Motor de PDF Dual**: Renderizado nativo fluido de PDFs con gestos de zoom y scroll en compilaciones standalone (`react-native-pdf`), junto con un simulador fallback inteligente para entornos de desarrollo en **Expo Go**.
* **Audio-Narración (TTS)**: Escucha tus libros favoritos con controles de reproducción (reproducir, pausar, adelantar y retroceder página) mediante el sintetizador de voz nativo de tu dispositivo.
* **Tipografías Personalizables**: Cambia de fuente de lectura al instante entre 4 familias premium (*Serif*, *Sans-Serif*, *Monospace*, *Sans-Serif-Light*) y ajusta el tamaño del texto.
* **Brillo y Modos de Lectura**: Soporte para temas **Claro**, **Oscuro** y **Sepia (Cálido)** ideales para lecturas nocturnas, con control deslizante de brillo integrado.
* **Lectura Inmersiva**: Modo de pantalla completa ocultando controles y barras del sistema. Sal de este modo haciendo doble clic en cualquier parte de la pantalla.

### 🧠 Asistente de Lectura con IA
* **Explicar Conceptos**: ¿Encontraste una palabra difícil? Escríbela dentro del lector y la IA te proporcionará una definición y contexto al instante.
* **Resumir Páginas**: Obtén un resumen condensado en puntos clave de la página actual que estás leyendo con un solo toque.

### 🎨 Biblioteca Inteligente & Editor de Portadas
* **Metadatos e Imágenes Automáticas**: Al importar un PDF, la app lee su información interna y busca en internet la portada original del libro y su autor.
* **Descarga Local Offline**: Las portadas encontradas se descargan localmente en el almacenamiento del dispositivo, permitiéndote navegar por tu estantería 100% sin conexión a internet.
* **Edición Híbrida (Manual + IA)**: Corrige manualmente el título y autor con un formulario vertical espacioso, o deja que el buscador de OpenLibrary encuentre la ficha oficial del libro y su portada.
* **Carga de Portadas desde Galería**: Elige cualquier imagen desde la galería de tu celular para asignarla como portada de tu libro.

### 🏆 Gamificación & Hábitos (Rachas)
* **Meta Diaria de Lectura**: Configura tus minutos de lectura propuestos para hoy (5, 10, 15 o 30 min) mediante un modal de bienvenida diario.
* **Racha de Días (Streaks)**: Mantén tu racha de días de lectura consecutivos activa. Se muestra un indicador de fuego (`🔥 3 días`) en tu biblioteca como motivación.
* **Dashboard de Estadísticas**: Monitorea tu racha, los minutos totales leídos hoy y tu barra de progreso diario en la pestaña **Explorar**.
* **Estantería de Completados**: Una sección especial que reúne todos los libros que has terminado al 100%, con opción de releerlos cuando gustes.

---

## 🛠️ Tecnologías Utilizadas

* **Framework**: React Native & Expo (SDK 57)
* **Enrutador**: Expo Router (unstable-native-tabs)
* **Almacenamiento Local**: `@react-native-async-storage/async-storage`
* **Manejo de Archivos**: `expo-file-system` & `expo-document-picker`
* **Narración de Voz**: `expo-speech`
* **Renderizado PDF**: `react-native-pdf` & `react-native-blob-util`
* **Componentes Visuales**: `lucide-react-native` & `expo-image`

---

## 📦 Instalación y Uso Local

Sigue estos pasos para clonar el repositorio y ejecutar la aplicación en modo de desarrollo:

### 1. Clonar el repositorio
```bash
git clone https://github.com/manuelmoreno-dev/lector-pdf.git
cd lector-pdf
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar el servidor de desarrollo de Expo
```bash
npx expo start
```
* Presiona **`a`** para abrir en un emulador de Android.
* Escanea el **código QR** desde tu celular con la aplicación de **Expo Go** para probarlo en vivo.

---

## 📱 Compilar el APK con Expo EAS (Servidores Cloud)

Para generar el archivo de instalación `.apk` directamente en los servidores en la nube de Expo (sin necesidad de Android Studio local):

1. **Instala la CLI de EAS de forma global**:
   ```bash
   npm install -g eas-cli
   ```
2. **Inicia sesión en tu cuenta de Expo**:
   ```bash
   eas login
   ```
3. **Inicia la compilación del APK**:
   ```bash
   eas build --platform android --profile preview
   ```
4. Al finalizar la compilación en la nube (5-10 minutos), el terminal te mostrará un **código QR** y un enlace para descargar tu APK e instalarlo en tu celular.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.
