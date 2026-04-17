# Writing Prompts · Cómo pedirle a Claude Code

> El "prompt" que tú escribes en el chat de Claude Code es lo que dispara todo. Mientras mejor lo escribas, mejor sale el contenido.

---

## Anatomía de un buen pedido

Un pedido completo tiene 4 ingredientes:

```
[TIPO] de [CANTIDAD] sobre [TEMA] · firma [quién] · pilar [qué]
```

Ejemplo:
> *"Hazme un **carrusel IG educativo** de **10 slides** sobre **los 3 errores más comunes al escribir copys de venta** · firma Laura · pilar educativo"*

Si algo falta, Claude te pregunta. Pero si lo pones todo al inicio, empieza directo.

---

## Ingredientes explicados

### 1. TIPO (qué formato)

| Qué pides | Dímelo así |
|---|---|
| Carrusel Instagram | "carrusel IG", "carrusel de Instagram" |
| Carrusel LinkedIn | "carrusel LinkedIn" |
| Reel o TikTok | "reel", "tiktok", "video vertical" |
| Story | "story", "frames de story" |
| Post LinkedIn | "post de LinkedIn", "artículo LinkedIn" |
| Thumbnail YouTube | "miniatura", "thumbnail YouTube" |
| Broadcast WhatsApp | "mensaje para mi lista" |

### 2. CANTIDAD (opcional)

- Carruseles: max 10 slides (IG), max 12 (LinkedIn)
- Stories: 3-7 frames
- Reels: 15-60s (se calcula el # de frames)

Si no especificas, default es **10 slides** para carruseles.

### 3. TEMA (lo más importante)

El tema es la **idea específica** del contenido. Mientras más específico, mejor.

**Mal (genérico):**
- ❌ "Un carrusel sobre marketing"
- ❌ "Algo sobre emprendimiento"

**Bien (específico):**
- ✅ "Los 3 errores que cometen los coaches cuando venden por Instagram"
- ✅ "Cómo escribir captions que conviertan en Instagram para una tienda de skincare"
- ✅ "Por qué el email marketing supera al social media en 2026 (con datos)"

**Tip:** si tu tema es largo, divídelo en "tema principal" + "ángulo específico":

- Tema principal: hooks virales en video
- Ángulo: "3 errores que matan un hook antes del primer segundo"

### 4. FIRMA y PILAR (opcional pero útil)

- **Firma** — quién firma internamente (para trazabilidad, no aparece público). Default: dueño de la marca.
- **Pilar** — si quieres forzar uno:
  - `educativo` — tips, errores, cómo-s
  - `bts` — detrás de cámaras, proceso
  - `casos` — clientes, resultados, tracción
  - `debate` — opinión contrarian, reframe
  - `estrategico` — marcos, visión

Si no lo especificas, Claude elige según el tema + tu pillar mix del config.

---

## Plantillas por objetivo

### Generar autoridad

> *"Hazme un carrusel LinkedIn de 8 slides con voz de autoridad sobre [tema de tu industria], aportando 3 datos concretos que mi audiencia no conozca · pilar estratégico"*

### Educar a tu audiencia

> *"Carrusel IG educativo de 10 slides sobre [problema común] · incluye 3 errores y 3 fixes · firma [tu nombre]"*

### Mostrar proceso (BTS)

> *"Story de 5 frames mostrando mi proceso para [actividad]: desde la preparación hasta el resultado final · voz cercana"*

### Debate / reframe

> *"Post LinkedIn provocador sobre por qué [creencia común] está mal · aporta un caso concreto · pilar debate"*

### Caso de éxito

> *"Carrusel IG de 10 slides con el caso de [cliente o resultado tuyo]: situación inicial, lo que hicimos, resultado · pilar casos"*

### Lanzamiento

> *"Carrusel de 8 slides anunciando [producto/servicio] · slide 1 teaser, slide 8 CTA al link en bio · voz de emoción contenida (no histeria)"*

---

## Controlar detalles específicos

Si quieres precisión sobre algo, añádelo como frase extra:

### Ajustar el mood visual

> *"...sobre [tema]. Quiero que las imágenes sean más bien oscuras y cinematográficas, con mucha luz ambar cálida."*

### Incluirte a ti

> *"...sobre [tema]. Quiero aparecer yo en la portada y en 2 slides de autoridad."*

### Pedir un hook específico

> *"...sobre [tema]. El hook de la primera línea del caption debe ser: '[tu hook exacto]'"*

### Excluir algo

> *"...sobre [tema]. No menciones a [competidor] y no uses la palabra 'hack'."*

### Copiar formato de uno anterior

> *"...sobre [nuevo tema]. Usa la misma estructura que el carrusel de [tema anterior] pero cambiando los ejemplos."*

---

## Lo que Claude Code hace con tu pedido

1. **Lee `brand.config.json`** — sabe tu marca, voz, colores, handle
2. **Detecta plataforma + pilar** — si omitiste algo, pregunta
3. **Diseña el brief** (sub-agente brief-architect) — 10 slides con prompts visuales
4. **Te muestra el brief** antes de ejecutar — tú apruebas
5. **Genera imágenes, valida, compone, escribe caption, agenda** — las 7 etapas

Tú solo ves el brief al inicio y el entregable al final. En medio el sistema avanza solo.

---

## Cómo iterar después de ver el brief

Si Claude te muestra el brief y hay algo que ajustar, dile en español:

- *"Cambia el hook del slide 1"*
- *"El slide 3 está muy genérico, hazlo más específico a la industria skincare"*
- *"Quita el slide 7 y pasa el CTA al slide 9"*
- *"Quiero que aparezca el personaje en los slides 4 y 5 también"*

Claude ajusta el brief y te muestra la versión nueva.

---

## Cómo iterar después de ver las imágenes

Si una imagen no te gusta:

- *"Regenera el slide 3, el producto no se ve bien, quiero que sea una botella de cristal oscuro con tapa dorada"*
- *"El slide 8 salió demasiado claro, que sea más cinematográfico como el slide 1"*
- *"Todos los retratos están muy serios, quiero uno de ellos sonriendo"*

Claude ajusta el concept específico del slide y regenera solo ese (no los 10).

---

## Cómo cambiar captions y copy

Si el caption no te encaja:

- *"El caption está muy 'coach', bájale al drama y sube el reframe"*
- *"Cambia el hook a: '[tu hook]'"*
- *"Quita el CTA al lead magnet, usa solo 'Link en bio'"*
- *"Hazlo más largo, añade un párrafo sobre [detalle]"*

No hace falta regenerar imágenes — solo el caption.

---

## Errores comunes al pedir

### 1. Tema demasiado amplio
❌ *"un carrusel sobre redes sociales"*
✅ *"un carrusel sobre cómo un coach fitness puede aumentar saves en IG usando reels de 15s"*

### 2. Mezclar 2 temas
❌ *"un carrusel sobre hooks virales y también cómo vender en WhatsApp"*
✅ Haz dos carruseles separados.

### 3. No decir plataforma
❌ *"hazme algo sobre X"*
✅ *"hazme un carrusel IG sobre X"*

### 4. Voz contradictoria al pilar
❌ *"un carrusel provocador sobre tutorial paso a paso"*
Los pilares educativos funcionan con voz friendly-expert o educator-calm, no provocador. Si fuerzas, sale raro.

### 5. Pedir demasiados slides
❌ *"15 slides"*
Max 10 para IG carousel. Instagram corta después de 10.

---

## Pro tips

### Pide múltiples ángulos

Cuando un tema puede tratarse de varias formas, di explícitamente:

> *"Hazme un carrusel sobre hooks virales, pero desde el ángulo del **copy**, no de la producción visual"*

### Usa ejemplos como referencia

> *"Un carrusel con la energía de estos 3 posts que me gustaron: [link1], [link2], [link3]. Pero con mi voz."*

### Pide draft primero

> *"Antes de generar imágenes, muéstrame solo el brief y los headlines para que los valide"*

Claude te muestra solo eso, tú ajustas, y después él procede.

### Reúsa conceptos

> *"Usa la misma estructura del carrusel de '3 errores UGC' pero adapta el tema a 'errores en lanzamientos de productos'"*

### Estilo de un creador de referencia

> *"Quiero que el tono se sienta como los carruseles de [creador referencia], sin copiar pero con esa energía"*

---

## Qué NO pedirle

- ❌ Publicar automáticamente a Instagram (Meta lo detecta, rompe autenticidad)
- ❌ Generar imágenes de celebridades reales o políticos
- ❌ Crear contenido sobre temas médicos / legales / financieros con consejo específico sin disclaimer
- ❌ Replicar exactamente contenido de otro creador (plagio)

---

## Cuando Claude te pregunta algo

Si te pide aclaración, responde breve y directo:

> *Claude: "¿Qué pilar prefieres?"*
> *Tú: "educativo"*

O si quieres que decida:

> *Tú: "tú decides según mi pilar mix"*

Claude respeta lo que le digas. No reasuma por ti si puedes ser específico.
