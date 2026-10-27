/**
 * GrafoLab — Editor de árboles (docente)
 * ----------------------------------------------------------------------------
 * Escribe en el campo "data" el JSON de los ejercicios de árboles, y se
 * actualiza si el docente edita ese JSON a mano.
 *
 * Según el tipo de ejercicio:
 *   bst_build        -> campo de valores; vista previa del árbol que resulta
 *   traversal        -> dibujo del árbol + tipo de recorrido
 *   balance          -> dibujo del árbol
 *   tree_metrics     -> dibujo del árbol + nodo objetivo (para la profundidad)
 *   expression_tree  -> campo de texto con la expresión
 *
 * Depende de tree-view.js. El servidor vuelve a validar todo al guardar.
 */
(function () {
  'use strict';

  /* ==========================================================================
     1. ELEMENTOS Y CONSTANTES
     ========================================================================== */
  const editor = document.getElementById('tree-editor');
  const dataField = document.getElementById('id_data');
  const kindField = document.getElementById('id_kind');
  const categoryField = document.getElementById('id_category');
  if (!editor || !dataField || !kindField || !window.GrafoLab || !window.GrafoLab.TreeView) return;

  const TreeView = window.GrafoLab.TreeView;

  const canvas = document.getElementById('tree-canvas');
  const hint = document.getElementById('tree-hint');
  const status = document.getElementById('tree-status');
  const valueInput = document.getElementById('tree-value');
  const orderSelect = document.getElementById('tree-order');
  const valuesInput = document.getElementById('tree-values');
  const expressionInput = document.getElementById('tree-expression');
  const clearButton = document.getElementById('tree-clear');
  const toolButtons = Array.from(editor.querySelectorAll('[data-tool]'));

  // Qué controles necesita cada tipo (se comparan con data-needs en la plantilla)
  const FEATURES = {
    bst_build: ['values', 'canvas'],
    traversal: ['tools', 'order', 'canvas'],
    balance: ['tools', 'canvas'],
    tree_metrics: ['tools', 'target', 'canvas'],
    expression_tree: ['expression'],
  };

  const ORDERS = ['inorder', 'preorder', 'postorder'];
  const MAX_NODES = 63;                      // mismo límite que el servidor

  const HINTS = {
    add: 'Haz clic en un círculo punteado (+) para agregar un nodo con el valor indicado.',
    edit: 'Haz clic en un nodo para cambiarle el valor por el indicado.',
    delete: 'Haz clic en un nodo para eliminarlo junto con sus hijos.',
    target: 'Haz clic en el nodo cuya profundidad se pedirá (otro clic en el mismo lo quita).',
  };


  /* ==========================================================================
     2. ESTADO Y UTILIDADES
     ========================================================================== */
  const state = {
    tree: null,           // árbol { value, left, right } o null
    values: [],           // enteros, en orden de inserción (bst_build)
    order: 'inorder',     // recorrido (traversal)
    target: null,         // valor del nodo objetivo (tree_metrics)
    expression: '',       // expresión aritmética (expression_tree)
  };

  let tool = 'add';
  let valuesInvalid = false;                 // el texto de valores tiene algo que no es entero
  let hintTimer = null;

  function currentKind() { return kindField.value; }
  function has(feature) { return (FEATURES[currentKind()] || []).indexOf(feature) !== -1; }

  /** "12" -> 12 (número); cualquier otro texto se conserva como texto. Vacío -> null. */
  function readNodeValue() {
    const text = valueInput.value.trim();
    if (!text) return null;
    return /^-?\d+$/.test(text) ? parseInt(text, 10) : text;
  }

  function containsValue(node, value) {
    if (!node) return false;
    return String(node.value) === String(value) || containsValue(node.left, value) || containsValue(node.right, value);
  }

  /** Si el valor objetivo ya no existe en el árbol, se quita. */
  function cleanTarget() {
    if (state.target !== null && !containsValue(state.tree, state.target)) state.target = null;
  }

  function flashHint(message) {
    hint.textContent = message;
    hint.classList.add('is-warning');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(refreshHint, 2800);
  }

  function refreshHint() {
    hint.classList.remove('is-warning');
    hint.textContent = HINTS[tool] || '';
  }

  /** Resumen bajo el dibujo, con avisos según el tipo. */
  function updateStatus() {
    const kind = currentKind();
    const warnings = [];
    let summary = '';

    if (kind === 'bst_build') {
      summary = state.values.length + ' valor(es)';
      if (!state.values.length) warnings.push('escribe al menos un valor');
      if (valuesInvalid) warnings.push('solo se permiten números enteros');
      if (new Set(state.values).size !== state.values.length) warnings.push('hay valores repetidos');
    } else if (kind === 'expression_tree') {
      if (!state.expression.trim()) warnings.push('escribe una expresión');
    } else {
      const count = TreeView.countNodes(state.tree);
      summary = count + ' nodo(s)';
      if (!count) warnings.push('el árbol no puede estar vacío');
      if (kind === 'tree_metrics' && state.target !== null) summary += ' · objetivo: ' + state.target;
    }

    status.textContent = summary + (warnings.length ? (summary ? ' — ' : '') + 'Atención: ' + warnings.join('; ') + '.' : '');
    status.classList.toggle('is-warning', warnings.length > 0);
  }


  /* ==========================================================================
     3. LECTURA Y ESCRITURA DEL JSON
     ========================================================================== */
  function parseTextarea() {
    try {
      const value = JSON.parse(dataField.value || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  function loadFromObject(object) {
    state.tree = TreeView.normalize(object.tree);
    state.values = Array.isArray(object.values) ? object.values.filter(Number.isInteger) : [];
    state.order = ORDERS.indexOf(object.order) !== -1 ? object.order : 'inorder';
    state.target = object.target === undefined ? null : object.target;
    state.expression = typeof object.expression === 'string' ? object.expression : '';

    valuesInvalid = false;
    valuesInput.value = state.values.join(', ');
    orderSelect.value = state.order;
    expressionInput.value = state.expression;
  }

  /** Escribe en el campo solo las claves que usa el tipo de ejercicio elegido. */
  function syncTextarea() {
    const kind = currentKind();
    const result = {};

    if (kind === 'bst_build') {
      result.values = state.values;
    } else if (kind === 'expression_tree') {
      result.expression = state.expression;
    } else {
      result.tree = state.tree;
      if (kind === 'traversal') result.order = state.order;
      if (kind === 'tree_metrics' && state.target !== null) result.target = state.target;
    }
    dataField.value = JSON.stringify(result, null, 2);
  }


  /* ==========================================================================
     4. DIBUJO Y HERRAMIENTAS
     ========================================================================== */
  function redraw() {
    if (!has('canvas')) { updateStatus(); return; }

    let tree = state.tree;
    const options = { label: 'Árbol del ejercicio', highlightValue: state.target };

    if (currentKind() === 'bst_build') {
      // Solo vista previa: el árbol que resulta de insertar los valores en orden
      tree = state.values.reduce(TreeView.bstInsert, null);
    } else if (tool === 'add') {
      options.onSlotClick = handleSlotClick;      // muestra los círculos (+)
    } else {
      options.onNodeClick = handleNodeClick;
    }

    TreeView.render(canvas, tree, options);
    updateStatus();
  }

  function commit() {
    redraw();
    syncTextarea();
  }

  function setToolUI() {
    toolButtons.forEach(function (button) {
      const active = button.dataset.tool === tool;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    refreshHint();
  }

  /* --- Acciones --- */
  function handleSlotClick(path) {
    const value = readNodeValue();
    if (value === null) { flashHint('Escribe primero el valor del nodo.'); return; }
    if (TreeView.countNodes(state.tree) >= MAX_NODES) { flashHint('El máximo es de ' + MAX_NODES + ' nodos.'); return; }

    state.tree = TreeView.withNode(state.tree, path, { value: value, left: null, right: null });
    commit();
  }

  function handleNodeClick(path) {
    const node = TreeView.nodeAt(state.tree, path);
    if (!node) return;

    if (tool === 'edit') {
      const value = readNodeValue();
      if (value === null) { flashHint('Escribe primero el nuevo valor.'); return; }
      state.tree = TreeView.withNode(state.tree, path, { value: value, left: node.left, right: node.right });
    } else if (tool === 'delete') {
      state.tree = TreeView.withNode(state.tree, path, null);
    } else if (tool === 'target') {
      state.target = String(state.target) === String(node.value) ? null : node.value;
    }
    cleanTarget();
    commit();
  }


  /* ==========================================================================
     5. EVENTOS
     ========================================================================== */

  /** Muestra el editor solo para los tipos de árboles y ajusta los controles. */
  function applyKind(shouldSync) {
    const isTree = Boolean(FEATURES[currentKind()]);
    editor.hidden = !isTree;
    if (!isTree) return;

    editor.querySelectorAll('[data-needs]').forEach(function (node) {
      node.hidden = !has(node.dataset.needs);
    });

    // Si la herramienta activa no existe en este tipo, volver a "agregar"
    const active = toolButtons.find(function (button) { return button.dataset.tool === tool; });
    if (active && active.hidden) tool = 'add';

    setToolUI();
    redraw();
    if (shouldSync) syncTextarea();
  }

  kindField.addEventListener('change', function () { applyKind(true); });

  if (categoryField) {
    categoryField.addEventListener('change', function () {
      setTimeout(function () { applyKind(false); }, 0);
    });
  }

  toolButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      tool = button.dataset.tool;
      setToolUI();
      redraw();
    });
  });

  // Valores del BST: texto separado por comas o espacios
  valuesInput.addEventListener('input', function () {
    const tokens = valuesInput.value.split(/[\s,;]+/).filter(Boolean);
    valuesInvalid = tokens.some(function (token) { return !/^-?\d+$/.test(token); });
    state.values = tokens.filter(function (token) { return /^-?\d+$/.test(token); }).map(Number);
    commit();
  });

  expressionInput.addEventListener('input', function () {
    state.expression = expressionInput.value;
    syncTextarea();
    updateStatus();
  });

  orderSelect.addEventListener('change', function () {
    state.order = orderSelect.value;
    syncTextarea();
  });

  clearButton.addEventListener('click', async function () {
    if (state.tree) {
      const accepted = await window.GrafoLab.showDialog({
        title: 'Limpiar el árbol',
        message: 'Se borrarán todos los nodos.',
        confirmText: 'Limpiar',
        danger: true,
      });
      if (!accepted) return;
    }
    state.tree = null;
    state.target = null;
    commit();
  });

  // Edición manual del JSON: el dibujo sigue lo que escribe el docente
  let typingTimer = null;
  dataField.addEventListener('input', function () {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function () {
      if (!Boolean(FEATURES[currentKind()])) return;
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