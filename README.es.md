# cc-telegram

[![npm version](https://badge.fury.io/js/cc-telegram.svg)](https://www.npmjs.com/package/cc-telegram)
[![GitHub](https://img.shields.io/github/license/hada0127/cc-telegram)](https://github.com/hada0127/cc-telegram)

🌍 **Language / 언어 / 语言**:
[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md) | [Español](README.es.md) | [हिन्दी](README.hi.md) | [العربية](README.ar.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

**GitHub**: [https://github.com/hada0127/cc-telegram](https://github.com/hada0127/cc-telegram)

**[Version History](VERSION_HISTORY.md)**

---

Ejecución remota de Claude Code a través de bot de Telegram.

Controla Claude Code desde cualquier lugar usando tu aplicación de Telegram. Crea tareas, monitorea el progreso y recibe notificaciones de finalización, todo desde tu teléfono.

## Características

- **Ejecución Remota de Tareas**: Envía tareas de codificación a Claude Code vía Telegram
- **Ejecución Paralela**: Ejecuta múltiples tareas simultáneamente (configurable)
- **Sistema de Prioridades**: Niveles de prioridad Urgente, Alta, Normal, Baja
- **Reintento Automático**: Reintento automático en caso de fallo con intentos configurables
- **Estado en Tiempo Real**: Monitorea el progreso de tareas y la salida de Claude
- **Rotación de Logs**: Limpieza automática de logs antiguos y tareas completadas

## Requisitos

- Node.js 18.0.0 o superior
- [Claude Code CLI](https://claude.ai/claude-code) instalado y autenticado
- Cuenta de Telegram

## Instalación

```bash
npx cc-telegram
```

O instalar globalmente:

```bash
npm install -g cc-telegram
cc-telegram
```

## Configuración Inicial

En la primera ejecución, cc-telegram te guiará a través del proceso de configuración:

1. **Crear un Bot de Telegram**
   - Abre Telegram y busca [@BotFather](https://t.me/BotFather)
   - Envía `/newbot` y sigue las instrucciones
   - Copia el token del bot proporcionado

2. **Ingresar Token del Bot**
   - Pega tu token del bot cuando se solicite
   - La herramienta verificará que el token sea válido

3. **Vincular Tu Cuenta**
   - Abre tu nuevo bot en Telegram
   - Envía `/start` al bot
   - El CLI detectará tu mensaje y mostrará tu chat ID
   - Ingresa el chat ID para confirmar

4. **Configurar Ajustes**
   - Establece el número de reintentos predeterminado (recomendado: 15)
   - Habilita/deshabilita la ejecución paralela
   - Establece el máximo de tareas concurrentes (si la paralela está habilitada)

Tu configuración se almacena localmente en `.cc-telegram/config.json` (encriptado).

## Uso

Después de la configuración, simplemente ejecuta:

```bash
npx cc-telegram
```

El bot se iniciará y escuchará comandos desde tu cuenta de Telegram.

## Comandos de Telegram

| Comando | Descripción |
|---------|-------------|
| `/new` | Crear una nueva tarea |
| `/list` | Ver tareas pendientes y en progreso |
| `/completed` | Ver tareas completadas |
| `/failed` | Ver tareas fallidas |
| `/status` | Verificar estado de ejecución actual y cancelar tareas en ejecución |
| `/debug` | Ver información del sistema |
| `/cancel` | Cancelar flujo de creación de tarea |
| `/reset` | Restablecer todos los datos (con confirmación) |

## Creación de Tareas

### Tareas Simples
Para ejecución única sin criterios de finalización:

1. Envía `/new`
2. Selecciona "Simple (sin criterios de finalización, sin reintento)"
3. Ingresa tu requerimiento
4. La tarea se encola inmediatamente

### Tareas Complejas
Para tareas con criterios de finalización y reintento automático:

1. Envía `/new`
2. Selecciona "Compleja (con criterios de finalización y reintento)"
3. Ingresa tu requerimiento
4. Ingresa los criterios de finalización (ej: "Todas las pruebas pasan")
5. Selecciona el nivel de prioridad
6. Elige el número de reintentos (10 o personalizado)

**Modo Plan**: Las tareas complejas ejecutan Claude automáticamente en modo plan (opción `--permission-mode plan`). Esto permite que Claude diseñe un enfoque de implementación antes de ejecutar, resultando en mejores resultados para requerimientos complejos.

### Archivos Adjuntos

Puedes adjuntar archivos al ingresar requisitos o criterios de finalización:

1. Cuando se te solicite requisitos/criterios, primero envía tus archivos (imágenes, documentos, etc.)
2. Aparecerá un mensaje de confirmación por cada archivo adjunto
3. Luego ingresa tus requisitos/criterios como texto
4. Los archivos adjuntos se pasarán a Claude junto con la tarea

**Nota**: Los archivos adjuntos se eliminan automáticamente cuando la tarea se completa, falla o se cancela.

## Prioridad de Tareas

Las tareas se ejecutan en orden de prioridad:

| Prioridad | Icono | Descripción |
|-----------|-------|-------------|
| Urgente | 🔴 | Ejecutar primero |
| Alta | 🟠 | Alta prioridad |
| Normal | 🟢 | Prioridad predeterminada |
| Baja | 🔵 | Ejecutar cuando esté inactivo |

## Ejecución Paralela

Cuando se habilita durante la configuración, múltiples tareas pueden ejecutarse simultáneamente:

- Configura el máximo de tareas concurrentes (1-10)
- Cada tarea muestra su prefijo de ID en la salida de consola
- `/status` muestra todas las tareas en ejecución con botones de detener para cancelarlas
- Las tareas de mayor prioridad aún obtienen slots primero

### Cancelar Tareas en Ejecución

Puedes cancelar tareas que están actualmente en ejecución:

1. Envía `/status` para ver las tareas en ejecución
2. Cada tarea en ejecución muestra un botón "Detener"
3. Haz clic en el botón para terminar la tarea inmediatamente
4. La tarea cancelada se marcará como fallida

### Salida de Consola (Modo Paralelo)

```
[a1b2c3d4] Iniciando tarea...
[e5f6g7h8] Compilando proyecto...
[a1b2c3d4] ¡Pruebas pasadas!
```

## Configuración

La configuración se almacena en `.cc-telegram/config.json`:

| Ajuste | Descripción | Predeterminado |
|--------|-------------|----------------|
| `botToken` | Token del bot de Telegram (encriptado) | - |
| `chatId` | Tu chat ID de Telegram (encriptado) | - |
| `debugMode` | Habilitar registro de depuración | `false` |
| `claudeCommand` | Comando CLI de Claude personalizado | `null` (auto-detectar) |
| `logRetentionDays` | Días para mantener archivos de log | `7` |
| `defaultMaxRetries` | Número de reintentos predeterminado | `15` |
| `parallelExecution` | Habilitar ejecución paralela | `false` |
| `maxParallel` | Máximo de tareas concurrentes | `3` |

### Comando de Claude Personalizado

Si Claude CLI está instalado en una ubicación no estándar:

```json
{
  "claudeCommand": "npx @anthropic-ai/claude-code"
}
```

## Estructura de Directorios

```
.cc-telegram/
├── config.json      # Configuración encriptada
├── tasks.json       # Índice de tareas pendientes
├── completed.json   # Índice de tareas completadas
├── failed.json      # Índice de tareas fallidas
├── tasks/           # Archivos de tareas individuales
├── completed/       # Detalles de tareas completadas
├── failed/          # Detalles de tareas fallidas
└── logs/            # Archivos de log diarios
```

## Detección de Finalización

Claude Code señala la finalización de tareas usando marcadores especiales:

- `<promise>COMPLETE</promise>` - Tarea completada exitosamente
- `<promise>FAILED</promise>` - Tarea fallida con razón

Si no se detecta señal, el sistema usa coincidencia de patrones para determinar éxito o fallo basado en el contenido de salida.

## Gestión de Logs

- Los archivos de log se crean diariamente: `YYYY-MM-DD.log`
- Los logs antiguos se eliminan automáticamente después de `logRetentionDays`
- Los archivos de tareas completadas/fallidas se limpian después de 30 días

## Seguridad

- El token del bot y chat ID están encriptados usando AES-256-GCM
- Solo se procesan mensajes de tu chat ID registrado
- Todos los datos se almacenan localmente en tu directorio de proyecto

## Solución de Problemas

### El bot no responde
- Asegúrate de que el bot esté ejecutándose (`npx cc-telegram`)
- Verifica si tu chat ID coincide con el configurado
- Verifica la conexión a internet

### Claude Code no encontrado
- Asegúrate de que Claude CLI esté instalado: `npm install -g @anthropic-ai/claude-code`
- O establece un comando personalizado en config: `"claudeCommand": "npx @anthropic-ai/claude-code"`

### Tareas atascadas en progreso
- Al reiniciar, las tareas huérfanas se restablecen automáticamente al estado "ready"
- Usa `/reset` para limpiar todos los datos si es necesario

## Licencia

MIT
