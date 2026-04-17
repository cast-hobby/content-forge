# Troubleshooting

> Errores comunes y cómo resolverlos.

---

## Setup

### "node: command not found"
Node.js no está instalado. Reinstala desde [nodejs.org](https://nodejs.org) (LTS).

### "npm install" falla
- Verifica versión de Node: `node --version` debe ser **20+**
- Borra `node_modules/` y `package-lock.json`, corre `npm install` de nuevo
- Si sigue fallando, prueba: `npm install --legacy-peer-deps`

### "sharp installation failed" (Windows)
Sharp a veces requiere build tools en Windows:
```bash
npm install --global --production windows-build-tools
npm install
```

### "git clone" da error de SSL (Windows)
Configura:
```bash
git config --global http.sslbackend schannel
```

### Wizard no muestra nada colorido
En Windows, asegúrate de usar **Windows Terminal** (no cmd.exe clásico). Descarga desde Microsoft Store gratis.

---

## API key

### "Falta GEMINI_API_KEY en .env.local"
El archivo no existe o está vacío.

Mac/Linux:
```bash
echo "GEMINI_API_KEY=TU_KEY_AQUI" > .env.local
```

Windows (PowerShell):
```powershell
echo "GEMINI_API_KEY=TU_KEY_AQUI" | Out-File -FilePath .env.local -Encoding ASCII
```

### "API key invalid" al generar
- Verifica que no hay espacios extra ni comillas en el archivo
- Formato correcto: `GEMINI_API_KEY=AIzaSy...` (sin comillas, sin espacios)
- Obtén una key fresca en https://aistudio.google.com/apikey

### "quota exceeded" o "rate limit"
Gemini free tier tiene límites diarios. Espera hasta la próxima ventana (suele ser 24h) o actualiza a plan pago.

---

## Character consistency

### "Se necesitan mínimo 3 fotos"
Añade fotos a `brand-assets/character/` con extensión `.jpg`, `.png` o `.webp`. Mínimo 10 KB cada una.

### "El rostro generado no se parece"
Ver [character-consistency.md § Troubleshooting](./character-consistency.md). Añade más refs con variedad de ángulos.

### "analyze-character tarda mucho"
Normal — depende del tamaño de las fotos. Si tardas >2 min, reduce el tamaño a max 1024×1024 px antes.

### "character.md salió genérico / impreciso"
Edítalo directamente. Es solo un archivo markdown, se lee en cada generación.

---

## Generación de imágenes

### "No genera imágenes, respuesta vacía"
- Tu prompt puede estar triggering safety filters (ej. menciones a violencia, política, celebridades reales). Revisa el concept del brief y ajusta.
- Gemini Vision puede estar en mantenimiento. Reintenta en 5 min.

### "Las imágenes tienen texto espurio"
El BRAND_NEGATIVE está reforzado, pero Nanobanana a veces ignora. Soluciones:

1. Regenera solo ese slide con prompt más estricto
2. Añade en el concept: "render any surface that would normally carry text completely blank"
3. Si persiste, pide a Claude que reescriba el concept con otro approach (ej. cambiar "magazine cover" por "documentary photograph")

### "Imagen generada es completamente diferente al concept"
Esto pasa con prompts abstractos. Soluciones:
- Sé más específico sobre el sujeto (ej. en vez de "a product", "a small ceramic amber perfume bottle with brushed metal cap")
- Añade detalles de iluminación y composición
- Menciona materiales, colores, texturas concretas

### "Las fotos son 896×1152 en lugar de 1080×1350"
Nanobanana tiende a cappear el tamaño. Las imágenes son perfectamente usables para IG (sí puedes subir 896px, IG las escala). Si quieres forzar 1080, upscale con herramienta externa (Photoshop, Preview, waifu2x).

---

## Overlay y composición

### "compose-overlay falla con 'cannot read layout-plan'"
No se ejecutó el layout-architect. Invoca primero:

> En Claude Code: *"ejecuta el layout-architect en el dir de mi último carrusel"*

O salta y usa defaults (calidad menor):
```bash
# Borra temporalmente layout-plan.json si existe y corre:
npm run compose -- --dir=output/social/<dir>
```

### "El texto se sale de la imagen / desalineado"
- El layout-plan puede tener safeAreas mal medidas. Regenera layout-architect con instrucción específica:
  > *"re-analiza el layout del slide X, el texto se sale por la derecha"*
- Si el issue es sistémico (en muchos slides), ajusta los multiplicadores de `sizes` en layout-plan.json a 0.9

### "El logo se ve pixelado"
Tu logo PNG es de baja resolución. Reemplaza con uno de al menos 1024×300 px en `brand-assets/`.

### "El logo tapa al sujeto"
Edita `layout-plan.json` → `slides.<id>.logo.position` a otra esquina.

---

## Caption

### "El caption suena genérico / como ChatGPT"
- Revisa `brand.config.json.voice` — ¿el estilo seleccionado refleja tu voz real?
- Añade más `forbiddenPhrases` (frases que detectaste que caen a ChatGPTese)
- Añade `preferredPhrases` que uses tú naturalmente
- Pídele a Claude: *"reescribe el caption con el tono de este ejemplo: [pega un caption tuyo real]"*

### "Los hashtags son random / no relevantes"
Tus `hashtags` en el config están vacíos. Pobla:
- 5 nicho específicos de tu industria
- 10 medios amplios (tu vertical)
- 5 genéricos (Instagram, Negocios, etc.)

### "El CTA al lead magnet sale raro"
Edita `brand.config.json.leadMagnet.url` y `.name`. Si no tienes lead magnet, deja ambos en string vacío `""` — el caption usará "Link en bio".

---

## Calendario

### "La fecha sugerida es hoy"
El calendar publisher respeta `content.cadence`. Ajusta:
- Si quieres agendar ya para un día específico: *"agéndalo para el [fecha]"*
- Si no te gustan los días default: edita `cadence.ig-carousel.preferredDays` en config

### "Dice hora 7pm COT pero estoy en México"
Tu `brand.timezone` está mal. Edita a tu timezone real (IANA format: `America/Mexico_City`, `Europe/Madrid`, etc.)

---

## Claude Code

### "Claude Code no activa la skill content-forge"
Posibles causas:
- Claude Code no tiene la carpeta abierta. Ciérrala y vuelve a `File → Open Folder`.
- El archivo `.claude/skills/content-forge/SKILL.md` se borró. Verifica que exista.
- El nombre de la skill debe ser **exacto**: `content-forge` (no `Content Forge` ni `content_forge`).

### "Claude Code no encuentra los sub-agentes"
Verifica que `.claude/agents/*.md` existan. Cada agente debe tener el frontmatter con `name:` correcto.

### "Claude Code pide permisos constantemente"
Es el sistema de seguridad. Puedes agregar permisos en `.claude/settings.json`:
```json
{
  "permissions": {
    "allow": [
      "Write(output/**)",
      "Write(drafts/**)",
      "Bash(npm run:*)"
    ]
  }
}
```

---

## Performance

### "El pipeline entero tarda >15 min"
Normal si es primera vez (descarga deps, calienta caches). Segunda vez suele ser 5-8 min.

Para acelerar:
- Reduce `character.maxRefsPerCall` a 3 (de 4)
- Reduce número de slides (7 en vez de 10)
- Activa `keepRawBackup: false` (ahorra tiempo de copia)

### "npm install tarda mucho"
Sharp descarga binarios nativos (~30 MB). Es de una sola vez. Siguientes `npm install` son rápidos.

---

## Cuando nada funciona

1. **Limpia y empieza de nuevo:**
   ```bash
   rm -rf node_modules package-lock.json  # Mac/Linux
   # O en Windows: borra las carpetas manualmente
   npm install
   ```

2. **Borra y regenera config:**
   ```bash
   mv brand.config.json brand.config.json.backup
   npm run setup
   ```

3. **Reporta un issue:**
   https://github.com/AlexanderKast/content-forge/issues

   Incluye:
   - Sistema operativo y versión
   - Versión de Node (`node --version`)
   - Mensaje de error completo
   - Qué estabas intentando hacer

---

## Preguntas frecuentes

### "¿Puedo usar Content Forge sin Claude Code, solo desde terminal?"
Sí. El wizard + scripts funcionan standalone. Los sub-agentes solo se activan desde Claude Code, pero puedes hacer las etapas de IA manualmente (generar brief a mano, escribir overlay-copy a mano, etc.).

### "¿Puedo cambiar el modelo de generación (no Gemini)?"
Requiere editar `scripts/generate-social.mjs`. Por ahora solo Gemini 2.5 Flash Image está soportado. Un fork con OpenAI DALL-E, Flux o Stability es bienvenido.

### "¿Funciona en Linux?"
Sí, aunque no está explícitamente probado. Sigue los pasos de Mac (ajustando `brew` por `apt`/`pacman`).

### "¿Puedo usarlo comercialmente?"
Sí. MIT license. Úsalo para clientes, contenido propio, lo que quieras.

### "¿Puedo eliminar el crédito?"
Sí, la atribución es apreciada pero no obligatoria. Lee [LICENSE](../LICENSE).
