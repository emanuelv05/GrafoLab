/**
 * GrafoLab — Editor de grafos (docente)
 * ----------------------------------------------------------------------------
 * Permite dibujar el grafo de un ejercicio y escribe el resultado, como JSON,
 * en el campo "data" del formulario. También funciona al revés: si el docente
 * edita el JSON a mano, el dibujo se actualiza.
 *
 * Estructura:
 *   1. Elementos y constantes
 *   2. Estado y utilidades
 *   3. Lectura y escritura del JSON
 *   4. Dibujo y herramientas (mover, vértice, arista, peso, origen, destino, borrar)
 *   5. Eventos
 *
 * Depende de graph-view.js. El servidor vuelve a validar todo al guardar
 * (graphs/validators.py), así que este archivo solo ayuda; no es la autoridad.
 */
(function () {
  'use strict';

  /* ==========================================================================
     1. ELEMENTOS Y CONSTANTES
     ========================================================================== */
  const editor = document.getElementById('graph-editor');
  const dataField = document.getElementById('id_data');
  const kindField = document.getElementById('id_kind');
  const categoryField = document.getElementById('id_category');
  if (!editor || !dataField || !kindField || !window.GrafoLab || !window.GrafoLab.GraphView) return;

  const canvas = document.getElementById('editor-canvas');
  const hint = document.getElementById('editor-hint');
  const status = document.getElementById('editor-status');
  const weightInput = document.getElementById('editor-weight');
  const maxColorsInput = document.getElementById('editor-max-colors');
  const clearButton = document.getElementById('editor-clear');
  const toolButtons = Array.from(editor.querySelectorAll('[data-tool]'));

  // Tipos de ejercicio que se dibujan con este editor (coinciden con registry.py)
  const GRAPH_KINDS = new Set(['adjacency_matrix', 'dijkstra', 'mst', 'connectivity', 'coloring']);
  const WEIGHTED_KINDS = new Set(['dijkstra', 'mst']);

  const MAX_VERTICES = 12;                 // mismo límite que el servidor
  const LETTERS = 'ABCDEFGHIJKL';          // nombres automáticos de los vértices
  const WIDTH = 480;                       // tamaño del lienzo (igual que graph-view.js)
  const HEIGHT = 360;
  const MARGIN = 26;                       // distancia mínima al borde al colocar o mover

  const HINTS = {
    move: 'Arrastra un vértice para moverlo.',
    vertex: 'Haz clic en un espacio vacío para agregar un vértice.',
    edge: 'Haz clic en un vértice y luego en otro para unirlos con una arista.',
    weight: 'Haz clic en una arista para asignarle el peso indicado arriba.',
    source: 'Haz clic en el vértice que será el origen.',
    target: 'Haz clic en el vértice que será el destino.',
    delete: 'Haz clic en un vértice o en una arista para eliminarlo.',
  };


  /* ==========================================================================
     2. ESTADO Y UTILIDADES
     ========================================================================== */
  const state = {
    vertices: [],     // ["A", "B", ...]
    edges: [],        // [["A","B"]] o [["A","B", 3]] si el tipo lleva pesos
    positions: {},    // { "A": {x, y} }
    source: null,
    target: null,
  };

  let tool = 'move';          // herramienta activa
  let pendingVertex = null;   // primer vértice elegido al crear una arista
  let dragging = null;        // vértice que se está arrastrando
  let view = null;            // control devuelto por GraphView.render

  function currentKind() { return kindField.value; }
  function isWeighted() { return WEIGHTED_KINDS.has(currentKind()); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function clampPoint(point) {
    return { x: clamp(point.x, MARGIN, WIDTH - MARGIN), y: clamp(point.y, MARGIN, HEIGHT - MARGIN) };
  }

  /** Índice de la arista u-v (sin importar el orden) o -1 si no existe. */
  function findEdge(u, v) {
    return state.edges.findIndex(function (edge) {
      return (edge[0] === u && edge[1] === v) || (edge[0] === v && edge[1] === u);
    });
  }

  /** Peso indicado en la barra de opciones, o null si no es válido (debe ser > 0). */
  function readWeight() {
    const value = Number(weightInput.value);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /** Muestra un aviso breve en la línea de ayuda y luego vuelve al texto normal. */
  let hintTimer = null;
  function flashHint(message) {
    hint.textContent = message;
    hint.classList.add('is-warning');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(refreshHint, 2800);
  }

  function refreshHint() {
    hint.classList.remove('is-warning');
    hint.textContent = (tool === 'edge' && pendingVertex)
      ? 'Ahora haz clic en el vértice que quieres unir con ' + pendingVertex + '. (Esc para cancelar)'
      : HINTS[tool];
  }

  /** Resumen bajo el dibujo, con avisos según el tipo de ejercicio. */
  function updateStatus() {
    const kind = currentKind();
    const count = state.vertices.length;
    const warnings = [];

    if (kind === 'adjacency_matrix' && (count < 4 || count > 6)) warnings.push('este tipo requiere de 4 a 6 vértices');
    if (kind === 'dijkstra' && (!state.source || !state.target)) warnings.push('falta elegir origen y destino');

    status.textContent = count + ' vértice(s) · ' + state.edges.length + ' arista(s)' +
      (warnings.length ? ' — Atención: ' + warnings.join('; ') + '.' : '');
    status.classList.toggle('is-warning', warnings.length > 0);
  }


  /* ==========================================================================
     3. LECTURA Y ESCRITURA DEL JSON
     ========================================================================== */

  /** Devuelve el contenido del campo como objeto, o null si no es un JSON válido. */
  function parseTextarea() {
    try {
      const value = JSON.parse(dataField.value || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  /** Ajusta la forma de las aristas al tipo: con peso [u,v,w] o sin peso [u,v]. */
  function normalizeEdges() {
    state.edges = state.edges.map(function (edge) {
      if (!isWeighted()) return [edge[0], edge[1]];
      const weight = typeof edge[2] === 'number' && edge[2] > 0 ? edge[2] : 1;
      return [edge[0], edge[1], weight];
    });
  }

  /** Carga el estado interno desde un objeto JSON (ignorando lo que esté mal formado). */
  function loadFromObject(object) {
    const vertices = [];
    (Array.isArray(object.vertices) ? object.vertices : []).forEach(function (vertex) {
      if (typeof vertex === 'string' && vertex && vertices.indexOf(vertex) === -1) vertices.push(vertex);
    });

    const edges = [];
    (Array.isArray(object.edges) ? object.edges : []).forEach(function (edge) {
      if (!Array.isArray(edge) || edge.length < 2) return;
      const u = edge[0];
      const v = edge[1];
      const valid = vertices.indexOf(u) !== -1 && vertices.indexOf(v) !== -1 && u !== v;
      if (valid && !edges.some(function (e) { return (e[0] === u && e[1] === v) || (e[0] === v && e[1] === u); })) {
        edges.push(edge.slice(0, 3));
      }
    });

    const positions = {};
    if (object.positions && typeof object.positions === 'object') {
      vertices.forEach(function (vertex) {
        const point = object.positions[vertex];
        if (point && isFinite(point.x) && isFinite(point.y)) positions[vertex] = { x: Number(point.x), y: Number(point.y) };
      });
    }

    state.vertices = vertices;
    state.edges = edges;
    state.positions = positions;
    state.source = vertices.indexOf(object.source) !== -1 ? object.source : null;
    state.target = vertices.indexOf(object.target) !== -1 ? object.target : null;
    maxColorsInput.value = Number.isInteger(object.max_colors) ? object.max_colors : '';
    normalizeEdges();
  }

  /** Escribe el estado en el campo "data", conservando las claves que el editor no maneja. */
  function syncTextarea() {
    const result = Object.assign({}, parseTextarea() || {});
    result.vertices = state.vertices.slice();
    result.edges = state.edges.map(function (edge) { return edge.slice(); });

    result.positions = {};
    state.vertices.forEach(function (vertex) {
      const point = state.positions[vertex];
      if (point) result.positions[vertex] = { x: Math.round(point.x), y: Math.round(point.y) };
    });

    // Origen y destino solo existen en Dijkstra
    delete result.source;
    delete result.target;
    if (currentKind() === 'dijkstra') {
      if (state.source) result.source = state.source;
      if (state.target) result.target = state.target;
    }

    // Máximo de colores solo en coloreo
    delete result.max_colors;
    const maxColors = parseInt(maxColorsInput.value, 10);
    if (currentKind() === 'coloring' && Number.isInteger(maxColors) && maxColors >= 1) result.max_colors = maxColors;

    dataField.value = JSON.stringify(result, null, 2);
  }


  /* ==========================================================================
     4. DIBUJO Y HERRAMIENTAS
     ========================================================================== */

  /** Vuelve a dibujar todo el grafo desde el estado (son pocos vértices, es instantáneo). */
  function redraw() {
    view = window.GrafoLab.GraphView.render(canvas, {
      vertices: state.vertices,
      edges: state.edges,
      positions: state.positions,
      source: state.source,
      target: state.target,
    }, {
      label: 'Editor del grafo',
      editing: true,
      onVertexClick: handleVertexClick,
      onEdgeClick: handleEdgeClick,
      onCanvasClick: handleCanvasClick,
      onVertexPointerDown: handleVertexPointerDown,
    });

    // Guardar también las posiciones que el visor calculó por defecto (círculo)
    state.positions = Object.assign({}, view.positions);
    view.svg.dataset.tool = tool;
    if (pendingVertex) view.setVertexState(pendingVertex, 'is-selected');

    // Arrastre: los eventos van en el SVG para no perder el puntero al moverse rápido
    view.svg.addEventListener('pointermove', handlePointerMove);
    view.svg.addEventListener('pointerup', handlePointerEnd);
    view.svg.addEventListener('pointercancel', handlePointerEnd);

    updateStatus();
  }

  /** Aplica un cambio estructural: redibuja y actualiza el JSON. */
  function commit() {
    redraw();
    syncTextarea();
  }

  /** Marca la herramienta activa y actualiza la ayuda. */
  function setTool(name) {
    tool = name;
    pendingVertex = null;
    toolButtons.forEach(function (button) {
      const active = button.dataset.tool === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (view) {
      view.svg.dataset.tool = name;
      view.clearStates();
    }
    refreshHint();
  }

  /** Muestra u oculta controles según el tipo (pesos, origen/destino, colores). */
  function updateToolVisibility() {
    const available = {
      weighted: isWeighted(),
      dijkstra: currentKind() === 'dijkstra',
      coloring: currentKind() === 'coloring',
    };
    editor.querySelectorAll('[data-needs]').forEach(function (node) {
      node.hidden = !available[node.dataset.needs];
    });
    // Si la herramienta activa ya no está disponible, volver a "mover"
    const active = toolButtons.find(function (button) { return button.dataset.tool === tool; });
    if (active && active.hidden) setTool('move');
  }

  /* --- Acciones sobre el grafo --- */

  function addVertex(point) {
    if (state.vertices.length >= MAX_VERTICES) {
      flashHint('El máximo es de ' + MAX_VERTICES + ' vértices.');
      return;
    }
    const letter = LETTERS.split('').find(function (l) { return state.vertices.indexOf(l) === -1; });
    state.vertices.push(letter);
    state.positions[letter] = clampPoint(point);
    commit();
  }

  function addEdge(u, v) {
    if (findEdge(u, v) !== -1) {
      flashHint('Ya existe una arista entre ' + u + ' y ' + v + '.');
      return;
    }
    if (isWeighted()) {
      const weight = readWeight();
      if (weight === null) { flashHint('Escribe un peso mayor que 0.'); return; }
      state.edges.push([u, v, weight]);
    } else {
      state.edges.push([u, v]);
    }
    commit();
  }

  function deleteVertex(vertex) {
    state.vertices = state.vertices.filter(function (v) { return v !== vertex; });
    state.edges = state.edges.filter(function (edge) { return edge[0] !== vertex && edge[1] !== vertex; });
    delete state.positions[vertex];
    if (state.source === vertex) state.source = null;
    if (state.target === vertex) state.target = null;
    pendingVertex = null;
    commit();
  }

  function setRole(role, vertex) {
    const other = role === 'source' ? 'target' : 'source';
    if (state[other] === vertex) {
      flashHint('El origen y el destino deben ser vértices distintos.');
      return;
    }
    state[role] = vertex;
    commit();
  }

  /* --- Respuestas a los clics sobre el dibujo --- */

  function handleCanvasClick(point) {
    if (tool === 'vertex') addVertex(point);
  }

  function handleVertexClick(vertex) {
    if (tool === 'edge') {
      if (!pendingVertex) {
        pendingVertex = vertex;
        view.setVertexState(vertex, 'is-selected');
        refreshHint();
      } else if (pendingVertex === vertex) {
        pendingVertex = null;           // segundo clic en el mismo vértice: cancelar
        view.setVertexState(vertex, 'is-selected', false);
        refreshHint();
      } else {
        const first = pendingVertex;
        pendingVertex = null;
        addEdge(first, vertex);
      }
    } else if (tool === 'source') {
      setRole('source', vertex);
    } else if (tool === 'target') {
      setRole('target', vertex);
    } else if (tool === 'delete') {
      deleteVertex(vertex);
    }
  }

  function handleEdgeClick(u, v) {
    const index = findEdge(u, v);
    if (index === -1) return;

    if (tool === 'delete') {
      state.edges.splice(index, 1);
      commit();
    } else if (tool === 'weight' && isWeighted()) {
      const weight = readWeight();
      if (weight === null) { flashHint('Escribe un peso mayor que 0.'); return; }
      state.edges[index][2] = weight;
      commit();
    }
  }

  /* --- Arrastre de vértices (herramienta "mover") --- */

  function handleVertexPointerDown(vertex, event) {
    if (tool !== 'move') return;
    event.preventDefault();
    dragging = vertex;
    view.svg.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragging) return;
    const point = clampPoint(view.pointFromEvent(event));
    state.positions[dragging] = point;
    view.moveVertex(dragging, point.x, point.y);
  }

  function handlePointerEnd() {
    if (!dragging) return;
    dragging = null;
    syncTextarea();
  }


  /* ==========================================================================
     5. EVENTOS
     ========================================================================== */

  /** Muestra el editor solo para los tipos de grafos y lo ajusta al tipo elegido. */
  function applyKind(shouldSync) {
    const isGraph = GRAPH_KINDS.has(currentKind());
    editor.hidden = !isGraph;
    if (!isGraph) return;

    normalizeEdges();
    updateToolVisibility();
    setTool(tool);
    redraw();
    if (shouldSync) syncTextarea();
  }

  // Cambio de tipo de ejercicio: ajustar herramientas y forma de las aristas
  kindField.addEventListener('change', function () { applyKind(true); });

  // Cambio de categoría: exercise_form.js puede borrar el tipo; esperar a que lo haga
  if (categoryField) {
    categoryField.addEventListener('change', function () {
      setTimeout(function () { applyKind(false); }, 0);
    });
  }

  // Barra de herramientas
  toolButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setTool(button.dataset.tool);
      redraw();   // quita marcas de selección pendientes
    });
  });

  // Máximo de colores (solo coloreo): actualizar el JSON al escribir
  maxColorsInput.addEventListener('input', syncTextarea);

  // Esc cancela una arista a medias
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && pendingVertex) {
      pendingVertex = null;
      refreshHint();
      redraw();
    }
  });

  // Limpiar todo (con confirmación si ya hay algo dibujado)
  clearButton.addEventListener('click', async function () {
    if (state.vertices.length) {
      const accepted = await window.GrafoLab.showDialog({
        title: 'Limpiar el dibujo',
        message: 'Se borrarán todos los vértices y aristas.',
        confirmText: 'Limpiar',
        danger: true,
      });
      if (!accepted) return;
    }
    state.vertices = [];
    state.edges = [];
    state.positions = {};
    state.source = null;
    state.target = null;
    pendingVertex = null;
    commit();
  });

  // Edición manual del JSON: el dibujo sigue lo que escribe el docente
  let typingTimer = null;
  dataField.addEventListener('input', function () {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function () {
      const object = parseTextarea();
      if (!object) {
        status.textContent = 'El JSON no es válido; el dibujo muestra el último estado correcto.';
        status.classList.add('is-warning');
        return;
      }
      loadFromObject(object);
      redraw();   // no se reescribe el campo, para no reformatear mientras se escribe
    }, 400);
  });

  // Estado inicial (importante al editar un ejercicio que ya existe)
  loadFromObject(parseTextarea() || {});
  applyKind(false);
})();