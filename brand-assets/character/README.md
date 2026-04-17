# Character reference images

**Esta carpeta es donde van las fotos del personaje** que quieres mantener consistente en tus imágenes generadas (típicamente **tú**, si eres marca personal).

## Cuándo usarla

Solo si durante `npm run setup` elegiste **opción b o c** en la pregunta de character consistency. Si no, ignora esta carpeta — puede quedar vacía.

## Qué fotos subir (3-10 imágenes)

Orden de importancia — cubre los primeros, después añade el resto si tienes:

| # | Qué | Por qué |
|---|---|---|
| 1 | **Frontal neutra** (mirada a cámara, expresión calmada) | Es la "identidad base" que el modelo memoriza |
| 2 | **Tres cuartos sonriendo** | Para slides BTS y casuales |
| 3 | **Perfil** | Ayuda al modelo a entender tu estructura facial en 3D |
| 4 | **Plano medio mostrando outfit** | Para que mantenga tu estilo de vestir |
| 5 | **Retrato cerrado serio/pensativo** | Para slides educativos y de autoridad |
| 6 | **Ángulo bajo (contrapicado)** | Para slides con peso editorial |
| 7-10 | **Diferentes escenarios** (interior + exterior, luz natural + estudio) | Le da al modelo flexibilidad para escenas variadas |

## Especificaciones técnicas

- **Formato**: JPG o PNG
- **Tamaño mínimo**: 512×512 px
- **Tamaño recomendado**: 1024×1024 px o mayor
- **Luz**: preferiblemente natural, sin flash directo
- **Fondo**: cualquiera, pero preferible que no tenga logos ni texto que distraiga
- **Una persona por foto**: no grupales

## Nombrado sugerido

```
01-frontal-neutral.jpg
02-tres-cuartos-sonriendo.jpg
03-perfil-pensativo.jpg
04-plano-medio-outfit.jpg
05-retrato-serio.jpg
06-contrapicado-exterior.jpg
...
```

El script `npm run analyze-character` no depende del nombre (mira los pixels), pero los nombres descriptivos te ayudan a ti a mantener el orden.

## Qué hace el sistema con estas fotos

1. `npm run setup` → activa character consistency
2. `npm run analyze-character` → Gemini Vision analiza las fotos y genera `character.md` con tu descripción detallada
3. Cuando generas un carrusel, el **character-director** agent decide slide por slide si tu personaje aparece (slides humanos sí, slides abstractos/productos no)
4. En los slides donde aparece, el generador adjunta 2-4 refs al call de Nanobanana y el modelo genera una escena nueva manteniendo tu rostro

## Privacidad

Esta carpeta está en `.gitignore` — **tus fotos no se commitean jamás** a menos que tú lo fuerces. Son tuyas, viven solo en tu máquina.

Si clonas este repo en otra máquina tuya, tienes que volver a cargar las fotos manualmente (o sincronizarlas aparte fuera de git).
