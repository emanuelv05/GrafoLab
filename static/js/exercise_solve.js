/**
 * GrafoLab — Pantalla de resolver ejercicios (estudiante)
 * ----------------------------------------------------------------------------
 * Estructura:
 *   1. Datos y elementos de la página
 *   2. Utilidades
 *   3. Constructores de interfaz por tipo de ejercicio
 *        - adjacency_matrix : tabla de 0/1 y grados
 *        - dijkstra         : clic en los vértices del camino
 *        - mst              : clic en las aristas del árbol de expansión
 *        - coloring         : paleta de colores y clic en los vértices
 *        - connectivity     : preguntas de Sí/No
 *        - resto de tipos   : cuadro de texto JSON (temporal, hasta tener su SVG)
 *   4. Selección del constructor
 *   5. Envío de la respuesta con fetch y presentación del resultado
 *
 * Cada constructor recibe el contenedor y los datos del ejercicio, y devuelve
 * un objeto con dos funciones:
 *   getAnswer()        -> devuelve la respuesta (o lanza Error si está mal formada)
 *   highlight(errors)  -> marca en pantalla lo que el servidor señaló como erróneo
 * Para agregar un tipo nuevo basta con escribir su constructor y registrarlo
 * en BUILDERS; el resto del archivo no cambia.
 */
(function () {
  'use strict';

  /* ==========================================================================
     1. DATOS Y ELEMENTOS
     ========================================================================== */
  const solver = document.getElementById('solver');
  if (!solver) return;

  const kind = solver.dataset.kind;
  const submitUrl = solver.dataset.submitUrl;
  const data = JSON.parse(document.getElementById('exercise-data').textContent);

  const submitButton = document.getElementById('submit-answer');
  const feedbackBox = document.getElementById('feedback');
  const attemptList = document.getElementById('attempt-list');
  const MAX_LISTED_ATTEMPTS = 5;

  // Tipos que dibujan su propio grafo interactivo dentro de la respuesta.
  // Para ellos se oculta la tarjeta lateral con el grafo estático.
    // Tipos que dibujan su propia figura interactiva dentro de la respuesta.
  // Para ellos se oculta la tarjeta lateral con la figura estática.
  const INTERACTIVE_KINDS = new Set([
    'dijkstra', 'mst', 'coloring',
    'bst_build', 'traversal', 'expression_tree',
  ]);

  const figure = document.getElementById('exercise-figure');
  if (figure) {
    if (INTERACTIVE_KINDS.has(kind)) {
      figure.closest('.card').hidden = true;
    } else if (Array.isArray(data.vertices)) {
      window.GrafoLab.GraphView.render(figure, data, { label: 'Grafo del ejercicio' });
    } else if (data.tree) {
      window.GrafoLab.TreeView.render(figure, data.tree, {
        label: 'Árbol del ejercicio',
        highlightValue: data.target,       // marca el nodo objetivo (altura, profundidad, hojas)
      });
    }
  }


  /* ==========================================================================
     2. UTILIDADES
     ========================================================================== */

  /** Crea un elemento con clase y texto opcionales (usa textContent: es seguro). */
  function create(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** Botón secundario pequeño con su acción. */
  function createButton(label, onClick) {
    const button = create('button', 'btn btn-secondary btn-sm', label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  /** Campo numérico con etiqueta. Devuelve { row, input }. */
  function createNumberField(labelText) {
    const row = create('label', 'answer-row');
    row.appendChild(create('span', null, labelText));
    const input = create('input', 'field-input');
    input.type = 'number';
    input.step = 'any';
    row.appendChild(input);
    return { row: row, input: input };
  }

  /** Dibuja el grafo del ejercicio dentro de la respuesta, con las opciones dadas. */
  function mountGraph(root, options) {
    const box = create('div', 'graph-box');
    root.appendChild(box);
    return window.GrafoLab.GraphView.render(box, data, options);
  }

  /** Clave de una arista sin dirección: A-B y B-A son la misma. */
  function edgeKey(u, v) {
    return [u, v].sort().join('|');
  }


  /* ==========================================================================
     3a. MATRIZ DE ADYACENCIA Y GRADOS
     Tabla n x n donde el estudiante escribe 1 (hay arista) o 0 (no hay),
     y una fila de campos con el grado de cada vértice.
     ========================================================================== */
  function buildAdjacencyMatrix(root, exercise) {
    const vertices = exercise.vertices;

    // --- Matriz ---
    root.appendChild(create('h3', 'solver-title', 'Matriz de adyacencia'));
    root.appendChild(create('p', 'text-muted', 'Escribe 1 si existe una arista entre los dos vértices y 0 si no existe.'));

    const table = create('table', 'matrix-table');
    const head = create('tr');
    head.appendChild(create('th'));                       // esquina vacía
    vertices.forEach(function (v) { head.appendChild(create('th', null, v)); });
    table.appendChild(head);

    vertices.forEach(function (rowVertex) {
      const row = create('tr');
      row.appendChild(create('th', null, rowVertex));
      vertices.forEach(function (colVertex) {
        const cell = create('td');
        const input = create('input', 'matrix-input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.maxLength = 1;
        input.dataset.cell = rowVertex + ':' + colVertex;
        input.setAttribute('aria-label', 'Fila ' + rowVertex + ', columna ' + colVertex);
        cell.appendChild(input);
        row.appendChild(cell);
      });
      table.appendChild(row);
    });

    const wrap = create('div', 'matrix-wrap');
    wrap.appendChild(table);
    root.appendChild(wrap);

    // --- Grados ---
    root.appendChild(create('h3', 'solver-title', 'Grado de cada vértice'));
    root.appendChild(create('p', 'text-muted', 'El grado es la cantidad de aristas que inciden en el vértice.'));

    const degrees = create('div', 'degrees-row');
    vertices.forEach(function (v) {
      const item = create('label', 'degree-item');
      item.appendChild(create('span', null, v));
      const input = create('input', 'matrix-input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.maxLength = 2;
      input.dataset.degree = v;
      item.appendChild(input);
      degrees.appendChild(item);
    });
    root.appendChild(degrees);

    // --- Restringir lo que se puede escribir y quitar la marca de error al editar ---
    root.querySelectorAll('input[data-cell]').forEach(function (input) {
      input.addEventListener('input', function () {
        input.value = input.value.replace(/[^01]/g, '').slice(-1);   // solo 0 o 1
        input.classList.remove('is-wrong');
      });
    });
    root.querySelectorAll('input[data-degree]').forEach(function (input) {
      input.addEventListener('input', function () {
        input.value = input.value.replace(/\D/g, '');                // solo dígitos
        input.classList.remove('is-wrong');
      });
    });

    return {
      getAnswer: function () {
        const matrix = vertices.map(function (r) {
          return vertices.map(function (c) {
            return root.querySelector('[data-cell="' + r + ':' + c + '"]').value;
          });
        });
        const degreeValues = {};
        vertices.forEach(function (v) {
          degreeValues[v] = root.querySelector('[data-degree="' + v + '"]').value;
        });
        return { matrix: matrix, degrees: degreeValues };
      },

      highlight: function (errors) {
        root.querySelectorAll('.is-wrong').forEach(function (n) { n.classList.remove('is-wrong'); });
        errors.forEach(function (error) {
          // "where" llega como "cell:A:C" o "degree:B"
          const parts = error.where.split(':');
          let target = null;
          if (parts[0] === 'cell') target = root.querySelector('[data-cell="' + parts[1] + ':' + parts[2] + '"]');
          if (parts[0] === 'degree') target = root.querySelector('[data-degree="' + parts[1] + '"]');
          if (target) target.classList.add('is-wrong');
        });
      },
    };
  }


  /* ==========================================================================
     3b. DIJKSTRA: CAMINO MÁS CORTO
     El camino empieza en el origen; cada clic en un vértice lo agrega al final.
     El estudiante escribe además la distancia total.
     ========================================================================== */
  function buildDijkstra(root, exercise) {
    const source = exercise.source;
    let path = [source];
    let pathState = null;       // null | 'is-wrong' | 'is-correct'

    root.appendChild(create('h3', 'solver-title', 'Camino más corto'));
    root.appendChild(create('p', 'text-muted',
      'Haz clic en los vértices del camino, en orden. Ya empiezas en ' + source +
      ' y debes llegar a ' + exercise.target + '.'));

    const view = mountGraph(root, {
      label: 'Grafo del ejercicio',
      onVertexClick: function (vertex) {
        if (path[path.length - 1] === vertex) return;   // ya es el último del camino
        path.push(vertex);
        touch();
      },
    });

    // Camino elegido y botones para corregirlo
    const bar = create('div', 'answer-row');
    const pathText = create('span', 'path-text');
    bar.appendChild(create('strong', null, 'Camino:'));
    bar.appendChild(pathText);
    bar.appendChild(createButton('Deshacer', function () {
      if (path.length > 1) path.pop();
      touch();
    }));
    bar.appendChild(createButton('Reiniciar', function () {
      path = [source];
      touch();
    }));
    root.appendChild(bar);

    const distance = createNumberField('Distancia total');
    distance.input.addEventListener('input', function () { distance.input.classList.remove('is-wrong'); });
    root.appendChild(distance.row);

    /** Repinta el camino sobre el grafo según el estado actual. */
    function paint() {
      view.clearStates();
      const state = pathState || 'is-selected';
      path.forEach(function (vertex) { view.setVertexState(vertex, state); });
      path.slice(1).forEach(function (vertex, index) {
        view.setEdgeState(path[index], vertex, state);
      });
      pathText.textContent = path.join(' → ');
    }

    /** Toda edición del camino borra las marcas de la validación anterior. */
    function touch() {
      pathState = null;
      paint();
    }

    paint();

    return {
      getAnswer: function () {
        return { path: path.slice(), distance: distance.input.value };
      },
      highlight: function (errors) {
        const pathWrong = errors.some(function (e) { return e.where === 'path'; });
        distance.input.classList.toggle('is-wrong', errors.some(function (e) { return e.where === 'distance'; }));
        pathState = errors.length === 0 ? 'is-correct' : (pathWrong ? 'is-wrong' : null);
        paint();
      },
    };
  }


  /* ==========================================================================
     3c. ÁRBOL DE EXPANSIÓN MÍNIMA
     Cada clic en una arista la elige o la quita. El estudiante escribe
     además el peso total.
     ========================================================================== */
  function buildMst(root, exercise) {
    let selected = [];          // [{ u, v }]
    let edgeState = null;       // null | 'is-wrong' | 'is-correct'

    root.appendChild(create('h3', 'solver-title', 'Árbol de expansión mínima'));
    root.appendChild(create('p', 'text-muted',
      'Haz clic en las aristas que forman el árbol. Vuelve a hacer clic para quitar una.'));

    const view = mountGraph(root, {
      label: 'Grafo del ejercicio',
      onEdgeClick: function (u, v) {
        const key = edgeKey(u, v);
        const index = selected.findIndex(function (e) { return edgeKey(e.u, e.v) === key; });
        if (index === -1) selected.push({ u: u, v: v });
        else selected.splice(index, 1);
        touch();
      },
    });

    const bar = create('div', 'answer-row');
    const listText = create('span', 'path-text');
    bar.appendChild(create('strong', null, 'Aristas elegidas:'));
    bar.appendChild(listText);
    bar.appendChild(createButton('Reiniciar', function () {
      selected = [];
      touch();
    }));
    root.appendChild(bar);

    const total = createNumberField('Peso total');
    total.input.addEventListener('input', function () { total.input.classList.remove('is-wrong'); });
    root.appendChild(total.row);

    function paint() {
      view.clearStates();
      const state = edgeState || 'is-selected';
      selected.forEach(function (edge) { view.setEdgeState(edge.u, edge.v, state); });
      listText.textContent = selected.length
        ? selected.map(function (e) { return e.u + '–' + e.v; }).join(', ')
        : 'ninguna';
    }

    function touch() {
      edgeState = null;
      paint();
    }

    paint();

    return {
      getAnswer: function () {
        return {
          edges: selected.map(function (e) { return [e.u, e.v]; }),
          total: total.input.value,
        };
      },
      highlight: function (errors) {
        const edgesWrong = errors.some(function (e) { return e.where === 'edges'; });
        total.input.classList.toggle('is-wrong', errors.some(function (e) { return e.where === 'total'; }));
        edgeState = errors.length === 0 ? 'is-correct' : (edgesWrong ? 'is-wrong' : null);
        paint();
      },
    };
  }


  /* ==========================================================================
     3d. COLOREO DE GRAFOS
     El estudiante elige un color de la paleta y hace clic en los vértices.
     Si el ejercicio fija "max_colors", la paleta tiene solo esa cantidad.
     ========================================================================== */
  const PALETTE = [
    { name: 'Rojo', hex: '#ef4444' },
    { name: 'Azul', hex: '#3b82f6' },
    { name: 'Verde', hex: '#22c55e' },
    { name: 'Amarillo', hex: '#eab308' },
    { name: 'Morado', hex: '#a855f7' },
    { name: 'Naranja', hex: '#f97316' },
    { name: 'Turquesa', hex: '#14b8a6' },
    { name: 'Rosa', hex: '#ec4899' },
    { name: 'Marrón', hex: '#92400e' },
    { name: 'Gris', hex: '#6b7280' },
    { name: 'Celeste', hex: '#38bdf8' },
    { name: 'Lima', hex: '#84cc16' },
  ];

  function buildColoring(root, exercise) {
    const vertices = exercise.vertices;
    const maxColors = exercise.max_colors || null;
    const size = Math.max(1, Math.min(maxColors || vertices.length, PALETTE.length));
    const palette = PALETTE.slice(0, size);

    const colors = {};          // vértice -> posición en la paleta
    let active = 0;             // color elegido (-1 = quitar color)
    let allCorrect = false;
    let wrongVertices = [];
    let wrongEdges = [];

    root.appendChild(create('h3', 'solver-title', 'Coloreo del grafo'));
    root.appendChild(create('p', 'text-muted',
      'Pinta los vértices para que dos vértices unidos por una arista nunca tengan el mismo color' +
      (maxColors ? ', usando como máximo ' + maxColors + ' colores.' : ', usando la menor cantidad de colores posible.')));

    // --- Paleta ---
    const paletteBar = create('div', 'palette');
    const swatches = [];

    function addSwatch(index, label, hex) {
      const swatch = create('button', 'swatch');
      swatch.type = 'button';
      swatch.title = label;
      swatch.setAttribute('aria-label', label);
      if (hex) swatch.style.background = hex;
      else swatch.textContent = '×';
      swatch.addEventListener('click', function () {
        active = index;
        updateSwatches();
      });
      swatches.push({ index: index, node: swatch });
      paletteBar.appendChild(swatch);
    }
    palette.forEach(function (color, index) { addSwatch(index, color.name, color.hex); });
    addSwatch(-1, 'Quitar color', null);
    root.appendChild(paletteBar);

    const view = mountGraph(root, {
      label: 'Grafo del ejercicio',
      onVertexClick: function (vertex) {
        if (active === -1) delete colors[vertex];
        else colors[vertex] = active;
        allCorrect = false;
        wrongVertices = [];
        wrongEdges = [];
        paint();
      },
    });

    const usedText = create('p', 'graph-caption');
    root.appendChild(usedText);

    function updateSwatches() {
      swatches.forEach(function (item) {
        const on = item.index === active;
        item.node.classList.toggle('is-active', on);
        item.node.setAttribute('aria-pressed', String(on));
      });
    }

    function paint() {
      view.clearStates();
      vertices.forEach(function (vertex) {
        view.setVertexColor(vertex, colors[vertex] !== undefined ? palette[colors[vertex]].hex : '');
        if (allCorrect) view.setVertexState(vertex, 'is-correct');
      });
      wrongVertices.forEach(function (vertex) { view.setVertexState(vertex, 'is-wrong'); });
      wrongEdges.forEach(function (edge) { view.setEdgeState(edge[0], edge[1], 'is-wrong'); });

      const used = new Set(Object.keys(colors).map(function (v) { return colors[v]; })).size;
      usedText.textContent = 'Colores usados: ' + used + (maxColors ? ' de ' + maxColors : '');
    }

    updateSwatches();
    paint();

    return {
      getAnswer: function () {
        const result = {};
        vertices.forEach(function (vertex) {
          if (colors[vertex] !== undefined) result[vertex] = palette[colors[vertex]].name;
        });
        return { colors: result };
      },
      highlight: function (errors) {
        allCorrect = errors.length === 0;
        wrongVertices = [];
        wrongEdges = [];
        errors.forEach(function (error) {
          // "where" llega como "edge:A:B" cuando dos vértices unidos tienen el mismo color
          const parts = error.where.split(':');
          if (parts[0] === 'edge') {
            wrongVertices.push(parts[1], parts[2]);
            wrongEdges.push([parts[1], parts[2]]);
          }
        });
        paint();
      },
    };
  }


  /* ==========================================================================
     3e. CONEXIDAD Y CICLOS
     El grafo se ve en la columna lateral; aquí solo se responden dos preguntas.
     ========================================================================== */
  function buildConnectivity(root) {
    const fieldsets = {};

    /** Agrega una pregunta de Sí/No con botones de opción. */
    function addQuestion(name, text) {
      const set = create('fieldset', 'choice');
      set.appendChild(create('legend', null, text));

      [['true', 'Sí'], ['false', 'No']].forEach(function (option) {
        const label = create('label');
        const input = create('input');
        input.type = 'radio';
        input.name = name;
        input.value = option[0];
        input.addEventListener('change', function () { set.classList.remove('is-wrong'); });
        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + option[1]));
        set.appendChild(label);
      });

      root.appendChild(set);
      fieldsets[name] = set;
    }

    addQuestion('connected', '¿El grafo es conexo?');
    addQuestion('has_cycle', '¿El grafo tiene ciclos?');

    function valueOf(name) {
      const checked = root.querySelector('input[name="' + name + '"]:checked');
      return checked ? checked.value === 'true' : null;
    }

    return {
      getAnswer: function () {
        const connected = valueOf('connected');
        const hasCycle = valueOf('has_cycle');
        if (connected === null || hasCycle === null) {
          throw new Error('Responde las dos preguntas antes de validar.');
        }
        return { connected: connected, has_cycle: hasCycle };
      },
      highlight: function (errors) {
        Object.keys(fieldsets).forEach(function (name) { fieldsets[name].classList.remove('is-wrong'); });
        errors.forEach(function (error) {
          if (fieldsets[error.where]) fieldsets[error.where].classList.add('is-wrong');
        });
      },
    };
  }


  /* ==========================================================================
     3f. EDITOR JSON (temporal) PARA LOS TIPOS QUE AÚN NO TIENEN SVG
     Muestra un ejemplo del formato esperado; el estudiante lo edita.
     ========================================================================== */
  const ANSWER_EXAMPLES = {
    bst_build: { tree: { value: 8, left: { value: 3 }, right: null } },
    traversal: { sequence: [1, 3, 6] },
    balance: { balanced: true },
    tree_metrics: { height: 2, leaves: 3, depth: 1 },
    expression_tree: { tree: { value: '+', left: { value: '2' }, right: { value: '3' } }, value: 5 },
  };

  function buildJsonEditor(root) {
    root.appendChild(create('p', 'text-muted',
      'Escribe tu respuesta en formato JSON, siguiendo este ejemplo. ' +
      'Es una vista temporal: pronto podrás responder dibujando.'));

    const textarea = create('textarea', 'json-answer');
    textarea.rows = 10;
    textarea.spellcheck = false;
    textarea.setAttribute('aria-label', 'Respuesta en JSON');
    textarea.value = JSON.stringify(ANSWER_EXAMPLES[kind] || {}, null, 2);
    root.appendChild(textarea);

    return {
      getAnswer: function () {
        let parsed;
        try {
          parsed = JSON.parse(textarea.value);
        } catch (error) {
          throw new Error('El JSON no es válido. Revisa comillas, comas y llaves.');
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('La respuesta debe ser un objeto JSON, por ejemplo { "clave": valor }.');
        }
        return parsed;
      },
      highlight: function () { /* sin marcas visuales en este modo */ },
    };
  }


  /* ==========================================================================
     4. SELECCIÓN DEL CONSTRUCTOR SEGÚN EL TIPO DE EJERCICIO
     ========================================================================== */
  const BUILDERS = {
    adjacency_matrix: buildAdjacencyMatrix,
    dijkstra: buildDijkstra,
    mst: buildMst,
    coloring: buildColoring,
    connectivity: buildConnectivity,
    // Aquí se irán agregando los tipos de árboles cuando tengan su SVG
  };
  // Sumar los constructores de árboles (los registra solve-trees.js)
  Object.assign(BUILDERS, window.GrafoLab.treeSolvers || {});
  const builder = (BUILDERS[kind] || buildJsonEditor)(solver, data);


  /* ==========================================================================
     5. ENVÍO Y RESULTADO
     ========================================================================== */

  /** Muestra el cuadro de resultado: tipo 'success' o 'error', título y lista de mensajes. */
  function showFeedback(type, title, messages) {
    feedbackBox.className = 'feedback feedback-' + type;
    feedbackBox.replaceChildren(create('p', 'feedback-title', title));

    if (messages && messages.length) {
      const list = create('ul');
      messages.forEach(function (message) { list.appendChild(create('li', null, message)); });
      feedbackBox.appendChild(list);
    }
    feedbackBox.hidden = false;
    feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /** Agrega el intento recién hecho a la lista lateral, sin recargar la página. */
  function addAttemptToList(isCorrect) {
    const empty = document.getElementById('attempt-empty');
    if (empty) empty.remove();

    const item = create('li');
    item.appendChild(create('span', 'badge ' + (isCorrect ? 'badge-success' : 'badge-danger'),
      isCorrect ? 'Correcto' : 'Incorrecto'));
    item.appendChild(create('span', 'text-muted', new Date().toLocaleString('es-CO')));
    attemptList.prepend(item);

    // Mantener solo los más recientes
    while (attemptList.children.length > MAX_LISTED_ATTEMPTS) {
      attemptList.lastElementChild.remove();
    }
  }

  submitButton.addEventListener('click', async function () {
    // 1. Leer la respuesta de la interfaz
    let answer;
    try {
      answer = builder.getAnswer();
    } catch (error) {
      showFeedback('error', 'Revisa tu respuesta', [error.message]);
      return;
    }

    // 2. Enviarla al servidor (el token CSRF lo agrega GrafoLab.postJSON)
    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Validando…';

    try {
      const result = await window.GrafoLab.postJSON(submitUrl, { answer: answer });

      if (result.ok && result.data && result.data.success) {
        const errors = result.data.errors || [];
        builder.highlight(errors);
        addAttemptToList(result.data.is_correct);

        if (result.data.is_correct) {
          showFeedback('success', '¡Correcto!', ['Tu respuesta es correcta.']);
        } else {
          showFeedback('error', 'Hay cosas por corregir', errors.map(function (e) { return e.message; }));
        }
      } else {
        const message = result.data && result.data.error ? result.data.error : 'No se pudo validar la respuesta.';
        showFeedback('error', 'No se pudo validar', [message]);
      }
    } catch (error) {
      showFeedback('error', 'Error de conexión', ['Revisa tu conexión e intenta de nuevo.']);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  });
})();