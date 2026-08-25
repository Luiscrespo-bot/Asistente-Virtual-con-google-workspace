# 🤝 Guía de Contribución

¡Gracias por tu interés en contribuir a este proyecto! Las contribuciones son lo que hace que la comunidad de código abierto sea un lugar increíble para aprender, inspirar y crear. Cualquier contribución que hagas será **apreciada**.

## 📌 Antes de Empezar

- Lee nuestro [Código de Conducta](CODE_OF_CONDUCT.md)
- Asegúrate de tener una [cuenta de GitHub](https://github.com/signup)
- Familiarízate con [Git](https://git-scm.com/doc)
- Revisa los [issues abiertos](https://github.com/Luiscrespo-bot/Asistente-Virtual-con-google-workspace/issues) para evitar duplicados

## 🎯 Tipos de Contribuciones

Podemos aceptar muchos tipos de contribuciones, incluyendo:

### 🐛 Reportar Bugs

Un bug excelente y reportado tiene:

- Un **resumen claro y descriptivo** del problema
- **Pasos detallados** para reproducir el problema
- **Comportamiento observado** vs **comportamiento esperado**
- **Capturas de pantalla o GIFs** (si es aplicable)
- Tu **entorno** (SO, versión de Node, etc.)

**¿Cómo reportar?**
1. Abre un [nuevo issue](https://github.com/Luiscrespo-bot/Asistente-Virtual-con-google-workspace/issues/new)
2. Usa el título descriptivo
3. Sigue la plantilla proporcionada
4. Incluye ejemplos específicos y contextual

### ✨ Sugerir Mejoras o Nuevas Características

Las sugerencias de mejora son muy valiosas. Cuando crees una sugerencia:

- Usa un **título claro y descriptivo**
- Proporciona una **descripción detallada** de la característica sugerida
- Describe el **comportamiento actual** y el **comportamiento esperado**
- Explica **por qué esta mejora sería útil**
- Lista otros **proyectos similares** donde existe esta característica

### 🧹 Limpiar Código Generado por IA

**¡Especialmente bienvenidas!** Contribuciones que:

- Reemplacen código generado por IA con **soluciones de Inteligencia Humana (IH)**
- Mejoren la **legibilidad y mantenibilidad** del código
- Agreguen **documentación clara** y comentarios en español/inglés
- Refuercen **pruebas y calidad de código**

### 📚 Mejorar Documentación

- Corregir typos o errores
- Clarificar secciones confusas
- Agregar ejemplos y casos de uso
- Traducir documentación

### 🧪 Escribir Pruebas

Las pruebas son críticas:

- Pruebas unitarias para funciones
- Pruebas de integración
- Pruebas end-to-end
- Cobertura de casos edge

## 🚀 Guía de Desarrollo

### 1. Fork el Repositorio

```bash
# Haz un fork en GitHub
# Luego clona tu fork
git clone https://github.com/tu-usuario/Asistente-Virtual-con-google-workspace.git
cd Asistente-Virtual-con-google-workspace
```

### 2. Crea una Rama

```bash
# Actualiza main
git checkout main
git pull upstream main

# Crea tu rama de feature
git checkout -b feature/nombre-descriptivo
# o para bugs
git checkout -b fix/descripcion-del-bug
```

**Convención de nombres:**
- `feature/descripcion` - Para nuevas características
- `fix/descripcion` - Para correcciones de bugs
- `docs/descripcion` - Para cambios de documentación
- `refactor/descripcion` - Para refactorización de código
- `test/descripcion` - Para agregar pruebas

### 3. Instala Dependencias

```bash
npm install
```

### 4. Haz tus Cambios

- Escribe código limpio y mantenible
- Sigue la guía de estilo del proyecto
- Agrega comentarios explicativos
- Mantén las líneas razonablemente cortas

### 5. Prueba tu Código

```bash
# Ejecutar pruebas
npm test

# Ejecutar en modo desarrollo
npm run dev

# Compilar
npm run build

# Verificar tipos (TypeScript)
npm run type-check
```

### 6. Commit tus Cambios

```bash
# Revisa los cambios
git diff

# Agrega los archivos
git add .

# Commit con mensaje descriptivo
git commit -m "type: descripción concisa

Descripción más detallada si es necesaria.
Explica el por qué, no solo el qué."
```

**Formato de commit:**
```
feat: agregar nueva característica
fix: corregir un bug
docs: cambios en documentación
style: cambios de formato (espacios, etc)
refactor: refactorizar código
test: agregar o mejorar pruebas
chore: cambios en build, dependencias, etc
```

### 7. Push a tu Rama

```bash
git push origin nombre-de-tu-rama
```

### 8. Abre un Pull Request

**En tu PR, incluye:**

- ✅ Descripción clara de qué hace el PR
- ✅ Enlace al issue relacionado (si existe)
- ✅ Capturas de pantalla (para cambios visuales)
- ✅ Confirmación de que cumple con las guías de estilo
- ✅ Nota si reemplaza código generado por IA

**Template sugerido:**

```markdown
## Descripción
Descripción concisa de los cambios.

## Tipo de Cambio
- [ ] Bug fix (cambio que no rompe funcionalidad)
- [ ] New feature (nueva funcionalidad)
- [ ] Breaking change (cambio que afecta funcionalidad)
- [ ] Documentation update

## Relacionado con Issue
Closes #(issue number)

## Cambios Propuestos
- Punto 1
- Punto 2

## Testing
Describe cómo se probó:
- [ ] Test A
- [ ] Test B

## Checklist
- [ ] Mi código sigue la guía de estilo del proyecto
- [ ] He realizado una auto-revisión de mi propio código
- [ ] He comentado mi código, especialmente en partes complejas
- [ ] He hecho cambios correspondientes a la documentación
- [ ] Mis cambios no generan nuevas advertencias
- [ ] He añadido pruebas que prueban que mi fix es efectivo
```

## 📋 Guía de Estilo

### TypeScript

- Usa **nombres descriptivos** para variables y funciones
- Prefiere **const** sobre **let** y evita **var**
- Usa **tipos explícitos** cuando sea posible
- Mantén las funciones **pequeñas y enfocadas**
- Usa **comments en español o inglés** de manera consistente

### Ejemplo:

```typescript
// ✅ Bien
interface Usuario {
  id: string;
  nombre: string;
  email: string;
}

function obtenerUsuario(id: string): Promise<Usuario> {
  // Descripción de qué hace
  return fetch(`/api/usuarios/${id}`).then(res => res.json());
}

// ❌ Evitar
function getUser(id: any) {
  return fetch(`/api/usuarios/${id}`).then(r => r.json());
}
```

## 🧪 Pruebas

Asegúrate de:

- Escribir pruebas para nuevas características
- Actualizar pruebas existentes si es necesario
- Mantener una cobertura de código >80%
- Ejecutar `npm test` antes de hacer commit

## 🔄 Proceso de Review

1. Un mantenedor revisará tu PR
2. Puede haber solicitudes de cambios
3. Realiza los cambios en tu rama (no es necesario crear un nuevo PR)
4. Re-solicita review
5. Una vez aprobado, tu PR será mergeado

## 📖 Recursos Útiles

- [GitHub Guides](https://guides.github.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Google Workspace APIs](https://developers.google.com/workspace)

## ❓ Preguntas o Necesitas Ayuda?

- Abre un [Discussion](https://github.com/Luiscrespo-bot/Asistente-Virtual-con-google-workspace/discussions)
- Revisa [Issues abiertos](https://github.com/Luiscrespo-bot/Asistente-Virtual-con-google-workspace/issues)
- Contacta a los mantenedores

## 🌱 Filosofía: IA → IH (Inteligencia Humana)

Reconocemos que este proyecto comenzó con asistencia de IA, pero **valoramos enormemente las contribuciones que:**

- Reemplacen código generado por IA con soluciones de **Inteligencia Orgánica (IO)** y **Inteligencia Humana (IH)**
- Demuestren **pensamiento crítico** y **creatividad**
- Muestren **comprensión profunda** del dominio
- Reflejen **experiencia y juicio humano**

Juntos, estamos construyendo algo mejor. 🚀

---

**¡Gracias por contribuir! Eres increíble.** 💫
