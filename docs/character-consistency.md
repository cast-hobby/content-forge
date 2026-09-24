# Character Consistency

> Cómo mantener tu rostro consistente en todo el contenido generado. Esta es la feature killer para marca personal.

---

## Qué hace

Sin character consistency, cada imagen generada de "una mujer latina emprendedora" sale distinta. Con character consistency, el sistema usa 3-10 fotos tuyas como referencia y el modelo genera escenas nuevas manteniendo **tu rostro**, **tu complexión**, **tu estilo** — pero en contextos diferentes, poses diferentes, iluminaciones diferentes.

Resultado: **apareces tú** — el mismo tú — en cada carrusel. Autoridad visual construida slide a slide.

---

## Cómo funciona técnicamente

No es un LoRA entrenado (eso requiere GPU + horas). Content Forge usa un **pipeline de 2 fases** que desacopla composición e identidad:

El flujo por cada slide humano:

```
Fase A — Composición (gpt-image-2, OpenAI):
  1. El brief marca este slide como "requires character"
  2. gpt-image-2 genera la escena con un "placeholder humano genérico"
     (Latin American, 30s, warm presence) — sin detalle facial específico
  3. Se obtiene una imagen editorial de calidad premium
     (luz cinematográfica, composición dirigida, mood boutique)

Fase B — Identity swap (gemini-2.5-flash-image, Google):
  4. El character-director elige 2-4 refs apropiadas para el mood
  5. Gemini recibe: imagen de Fase A + refs reales + prompt de swap
  6. Reemplaza la identidad del placeholder por la tuya preservando
     composición, luz, pose, wardrobe silhouette y mood
```

**Fidelidad esperada: ~95%.** Al separar los dos problemas (composición vs identidad) cada modelo hace lo que mejor hace. Los rasgos faciales se reconocen mucho mejor que con un approach single-pass porque Gemini solo tiene que resolver la cara, no la escena completa.

Si Gemini no devuelve imagen en el swap, el pipeline hace fallback a la composición base (sin tu cara pero con calidad editorial). El manifest.json registra `swapFallback: true` cuando esto ocurre.

Para 100% fidelidad necesitas LoRA. Ver `docs/advanced/lora-training.md` (próximamente).

---

## Qué fotos subir

### Cantidad

- **Mínimo**: 3 (el sistema rechaza menos)
- **Recomendado**: 6-8 (balance calidad/tokens)
- **Máximo**: 10 (más no añade valor)

### Diversidad (orden de prioridad)

Cubre los 4 primeros antes de agregar más:

| # | Tipo | Por qué es crítica |
|---|---|---|
| 1 | **Frontal neutra** — mirada directa, expresión calmada | La "identidad base" que el modelo memoriza |
| 2 | **Tres cuartos sonriendo** | Le da rango emocional al modelo |
| 3 | **Perfil** | Ayuda con estructura facial 3D |
| 4 | **Plano medio outfit visible** | Mantiene tu estilo de vestir |
| 5 | Retrato cerrado serio/pensativo | Para slides de autoridad |
| 6 | Contrapicado o ángulo bajo | Para composiciones editoriales |
| 7 | Exterior con luz natural | Para escenas no-estudio |
| 8+ | Variaciones: diferentes ropa, contextos, expresiones | Más flexibilidad |

### Especificaciones técnicas

| Parámetro | Valor |
|---|---|
| Formato | JPG, PNG o WEBP |
| Tamaño mínimo | 512×512 px |
| Tamaño recomendado | 1024×1024 px o mayor |
| Luz | Natural si es posible, nunca flash directo |
| Fondo | Cualquiera, pero sin texto/logos distractores |
| Personas en foto | 1 (solo tú) |
| Peso mínimo del archivo | >10 KB (filtro contra placeholders) |

### Qué evitar

- ❌ Fotos borrosas
- ❌ Flash directo fuerte (aplana rasgos)
- ❌ Filtros heavy (Snapchat, Instagram pesados)
- ❌ Selfies con distorsión gran angular
- ❌ Fotos de hace 5+ años si quieres que el modelo te genere "como eres ahora"
- ❌ Con gafas de sol (tapan los ojos, pierde información)
- ❌ En blanco y negro (pierde información de color de piel y cabello)

---

## Proceso paso a paso

### 1. Activar en el wizard

Al correr `npm run setup`, pregunta 9 de 10:

> *¿Quieres consistencia de personaje?*
> - a) No
> - **b) Sí, soy marca personal y quiero aparecer yo**
> - c) Sí, tengo un personaje/mascota recurrente

Elige `b` o `c`.

### 2. Subir fotos

Coloca las fotos en:

- **Mac:** `~/Documents/GitHub/content-forge/brand-assets/character/`
- **Windows:** `Documents\GitHub\content-forge\brand-assets\character\`

Nombres sugeridos:

```
01-frontal-neutral.jpg
02-tres-cuartos-sonriendo.jpg
03-perfil-pensativo.jpg
04-plano-medio-outfit.jpg
05-retrato-serio.jpg
06-contrapicado-exterior.jpg
```

(Los nombres no afectan el análisis, pero te ayudan a ti.)

### 3. Ejecutar analyze-character

Cuando el wizard te pregunta si las fotos están listas, responde `y` (o presiona Enter si lo dejaste en default).

O manualmente:

```bash
npm run analyze-character
```

Esto:
1. Lista las fotos detectadas
2. Las envía a Gemini Vision para análisis
3. Escribe `brand-assets/character/character.md` con tu descripción
4. Actualiza `brand.config.json` con el array de referenceImages

Tarda ~30-60 segundos.

### 4. Revisar el character.md generado

Abre `brand-assets/character/character.md`. Vas a ver algo como:

```markdown
# Character: Laura

## Características físicas
- Mujer latinoamericana, mediados de 30s
- Pelo castaño oscuro, largo hasta los hombros, liso
- Ojos cafés, mandíbula definida...

## Estilo habitual
- Tops neutros en tonos tierra
- Cabello suelto o semi-recogido
- Accesorios minimalistas...

## Uso recomendado por mood
- Slides educativos: refs 03, 05 (seria, frontal)
- BTS: refs 02 (sonriendo, casual)
...
```

**Si algo no te gusta**, edita el archivo directamente. Se lee en cada generación.

### 5. Prueba generar un carrusel

En Claude Code:

> *"hazme un carrusel educativo sobre [tu tema] con 10 slides"*

El pipeline marcará automáticamente qué slides usan al personaje (portadas, retratos humanos) y cuáles no (flat lays, abstractos).

---

## Ajustar el comportamiento

### Modo `useInSlides`

```json
"character": {
  "useInSlides": "auto"  // opciones: "auto" | "always" | "manual"
}
```

- **`auto`** (default recomendado): el sistema decide por slide según el concepto
- **`always`**: fuerza aparición en todos los slides humanos
- **`manual`**: solo aparece cuando el brief lo marca explícitamente

### Refs por call

```json
"maxRefsPerCall": 4
```

Más refs = más fidelidad pero más tokens (más caro). Default 4 es balance óptimo.

Rango útil: 2 (mínimo) - 6 (máximo práctico).

---

## Refrescar fotos con el tiempo

Si cambias de look, de corte de pelo, de edad:

1. Reemplaza fotos viejas en `brand-assets/character/`
2. Corre `npm run analyze-character` de nuevo
3. Regenera `character.md` con tu nuevo look

Las piezas generadas antes mantienen tu look de esa época. Las nuevas usan el look actual.

---

## Privacidad

Tus fotos están en `.gitignore` — **nunca** se commitean al repo público. Viven solo en tu máquina.

Si quieres sincronizar entre tus máquinas (Mac y Windows), copia la carpeta `brand-assets/character/` a mano o usa un servicio privado de sincronización (1Password, iCloud Drive, Dropbox privado).

**Gemini no retiene tus fotos**. Según su política, las imágenes de entrada se procesan en memoria y se descartan. Pero si esto te preocupa, no actives character consistency.

---

## Troubleshooting

### "El rostro generado no se parece a mí"

Causas probables:
- Muy pocas refs (<4) o poca diversidad de ángulos
- Fotos con filtros heavy o mala iluminación
- Rasgos muy sutiles (el modelo generaliza)

Fix:
- Sube más refs con diferentes ángulos
- Fotos sin filtro, luz natural
- Añade refs con close-up del rostro

### "El outfit no es el mismo"

Esperado. Gemini genera "estilo similar", no outfit exacto. Si quieres un outfit específico, pídelo explícitamente en el topic:

> *"un carrusel donde aparezco con camisa blanca y fondo negro, sobre [tema]"*

### "En algunos slides salgo yo y en otros alguien diferente"

Probablemente `useInSlides: "auto"` estaba activado y el detector marcó ciertos slides como abstractos. Revisa el brief antes de generar:

> Claude: *"muéstrame qué slides van con character antes de generar"*

---

## Avanzado: LoRA para 100% fidelidad

Si necesitas fidelidad absoluta (ej. para productos con tu imagen, contenido corporativo donde el rostro es crítico), puedes entrenar un LoRA propio con herramientas como Replicate, Flux, o Stable Diffusion.

Guía completa: `docs/advanced/lora-training.md` *(próximamente)*

Con LoRA entrenado, Content Forge puede sustituir el generator de Gemini por tu modelo custom.
