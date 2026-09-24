# Iniciar producción de carruseles

## Comandos de uso

**Carrusel nuevo:**
```
"Hazme un carrusel educativo de 10 slides sobre [tema]"
```

**Con referencia externa (clonado):**
```
"Replica este carrusel: [link] pero con mi marca"
```

**Reel / vertical:**
```
"Reel de TikTok de 30 segundos sobre [tema], pilar BTS"
```

**Solo brief (sin generar):**
```
"Muéstrame el brief antes de generar"
```

---

## Flujo automático (9 fases)

| Fase | Acción | Tiempo |
|------|--------|--------|
| 0 | Carga brand + memory | 10 seg |
| 1 | Brief architect (10 slides) | 3 min |
| 2 | WaveSpeed genera imágenes | 2-3 min |
| 3 | Detecta logos (SimpleIcons) | 30 seg |
| 4 | Layout analysis (safe zones) | 1 min |
| 5 | Overlay copy (100% editable) | 2 min |
| 6 | Compose final PNG | 1 min |
| 7 | QA automático visual + texto | 1 min |
| 8 | Caption Instagram/LinkedIn | 30 seg |
| 9 | Calendario + memory.json | 30 seg |

**Total: 5-10 minutos**

---

## Edición visual post-generación

```bash
npm run editor
# Abre http://localhost:4321
```

Editar:
- Textos (sin regenerar imágenes)
- Logos (añadir/quitar badges)
- Colores de fondo CSS
- Posiciones de elementos

---

## Comandos avanzados

- "Regenera la imagen del slide 5" → solo ese slide
- "Cambia slide 3, está muy genérico" → re-genera slide-03
- "Usa solo estas plataformas: [n8n, supabase]" → override badges
- "Muéstrame memory.json" → historial + patterns
- "Cambia fondo a light-wall" → re-compose sin regenerar imagen

---

## Arranque rápido

```bash
# Terminal 1: editor web
npm run editor

# Terminal 2 (si generas desde CLI)
npm run generate -- --brief=drafts/brief.json --platform=ig-carousel
```
