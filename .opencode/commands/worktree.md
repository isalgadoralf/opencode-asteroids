---
description: Crea un git worktree en .worktrees/<nombre-del-worktree>
---

Crea un git worktree siguiendo estas instrucciones exactas:

1. Toma el argumento recibido: "$ARGUMENTS"
   - Si el argumento está vacío, deduce un nombre corto y descriptivo a partir del contexto actual de la conversación.
   - Si el argumento contiene espacios o mezcla mayúsculas, conviértelo a formato `kebab-case` (minúsculas, palabras separadas por guiones, sin espacios ni caracteres especiales).
2. Con ese nombre, ejecuta únicamente este comando con la herramienta `shell`:

   git worktree add .worktrees/<nombre-del-worktree>

3. Reglas estrictas:
   - No hagas nada más: no cambies de directorio (no uses `cd`, `workdir` distinto ni `session_move`), no modifiques ni crees archivos adicionales, no ejecutes comandos extra (ni `git status`, `git branch`, etc.).
   - Ejecuta el comando de creación del worktree una sola vez y reporta el resultado tal como lo devuelva git.
4. Si los argumentos son muy largo, simplifícalo a un nombre significativo. 