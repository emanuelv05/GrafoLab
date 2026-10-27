/**
 * GrafoLab — Interfaces del estudiante para ejercicios de árboles
 * ----------------------------------------------------------------------------
 * Registra los constructores de interfaz de los cinco tipos de árboles en
 * window.GrafoLab.treeSolvers. exercise_solve.js los suma a los suyos.
 *
 * Cada constructor recibe (contenedor, datos del ejercicio) y devuelve:
 *   getAnswer()        -> la respuesta (o lanza Error si está incompleta)
 *   highlight(errors)  -> marca en pantalla lo que el servidor señaló
 *
 * Tipos: bst_build · traversal · balance · tree_metrics · expression_tree
 * Debe cargarse DESPUÉS de tree-view.js y ANTES de exercise_solve.js.
 */
(function () {
  'use strict';

  const GrafoLab = window.GrafoLab;
  if (!GrafoLab || !GrafoLab.TreeView) return;
  const TreeView = GrafoLab.TreeView;


  /* ==========================================================================
     1. UTILIDADES
     ========================================================================== */
  function create(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createButton(label, onClick) {
    const button = create('button', 'btn btn-secondary btn-sm', label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  function createNumberField(labelText) {
    const row = create('label', 'answer-row');
    row.appendChild(create('span', null, labelText));
    const input = create('input', 'field-input');
    input.type = 'number';
    input.step = 'any';
    row.appendChild(input);
    return { row: row, input: input };
  }

  /** Crea un recuadro para el árbol y devuelve una función que lo (re)dibuja. */
  function createTreeBox(root) {
    const box = create('div', 'graph-box');
    root.appendChild(box);
    return function (tree, options) { return TreeView.render(box, tree, options); };
  }

  /** Pregunta de Sí/No con botones de opción. Devuelve { set, value() }. */
  function createYesNo(root, name, text) {
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
    return {
      set: set,
      value: function () {
        const checked = set.querySelector('input:checked');
        return checked ? checked.value === 'true' : null;
      },
    };
  }

  /**
   * El servidor señala un nodo con un texto como "raíz → izq → der".
   * Lo convierte a una ruta ('LR'), o null si el mensaje no trae ninguna.
   */
  function pathFromMessage(message) {
    const match = /raíz((?: → (?:izq|der))*)/.exec(message || '');
    if (!match) return null;
    return (match[1].match(/izq|der/g) || [])
      .map(function (word) { return word === 'izq' ? 'L' : 'R'; })
      .join('');
  }

  /** Prefijo más largo de la ruta que existe en el árbol del estudiante. */
  function nearestPath(tree, path) {
    let current = path;
    while (current !== '' && !TreeView.nodeAt(tree, current)) current = current.slice(0, -1);
    return current;
  }


  /* ==========================================================================
     2. CONSTRUCCIÓN DE UN ÁRBOL DE BÚSQUEDA (bst_build)
     El estudiante inserta los valores uno por uno, en el orden dado, haciendo
     clic en el círculo punteado (+) donde cree que va cada uno.
     ========================================================================== */
  function buildBst(root, exercise) {
    const values = exercise.values;
    let tree = null;
    let inserted = 0;                  // cuántos valores ya colocó
    let history = [];                  // estados anteriores, para deshacer
    let wrongPath = null;
    let allCorrect = false;

    root.appendChild(create('h3', 'solver-title', 'Construcción del árbol de búsqueda'));
    root.appendChild(create('p', 'text-muted',
      'Inserta los valores uno por uno, en este orden. Haz clic en el círculo punteado (+) ' +
      'donde crees que va el siguiente valor.'));

    const chips = create('div', 'chip-list');
    root.appendChild(chips);
    const mount = createTreeBox(root);
    const info = create('p', 'graph-caption');
    root.appendChild(info);

    const bar = create('div', 'answer-row');
    bar.appendChild(createButton('Deshacer', function () {
      const previous = history.pop();
      if (!previous) return;
      tree = previous.tree;
      inserted = previous.inserted;
      clearMarks();
      redraw();
    }));
    bar.appendChild(createButton('Reiniciar', function () {
      tree = null;
      inserted = 0;
      history = [];
      clearMarks();
      redraw();
    }));
    root.appendChild(bar);

    function clearMarks() {
      wrongPath = null;
      allCorrect = false;
    }

    function redraw() {
      // Lista de valores: hechos, el siguiente y los pendientes
      chips.replaceChildren();
      values.forEach(function (value, index) {
        const state = index < inserted ? ' is-done' : (index === inserted ? ' is-next' : '');
        chips.appendChild(create('span', 'chip' + state, String(value)));
      });

      const options = { label: 'Árbol en construcción' };
      if (inserted < values.length) {
        options.onSlotClick = function (path) {
          history.push({ tree: tree, inserted: inserted });
          tree = TreeView.withNode(tree, path, { value: values[inserted], left: null, right: null });
          inserted += 1;
          clearMarks();
          redraw();
        };
      }
      const view = mount(tree, options);

      if (view.svg) {
        if (allCorrect) view.paths.forEach(function (path) { view.setNodeState(path, 'is-correct'); });
        if (wrongPath !== null) view.setNodeState(nearestPath(tree, wrongPath), 'is-wrong');
      }

      info.textContent = inserted < values.length
        ? 'Siguiente valor: ' + values[inserted] + ' (' + inserted + ' de ' + values.length + ' colocados)'
        : 'Ya colocaste todos los valores. Pulsa «Validar respuesta».';
    }

    redraw();

    return {
      getAnswer: function () {
        if (inserted < values.length) {
          throw new Error('Aún faltan valores por insertar (' + inserted + ' de ' + values.length + ').');
        }
        return { tree: TreeView.normalize(tree) };
      },
      highlight: function (errors) {
        clearMarks();
        allCorrect = errors.length === 0;
        errors.forEach(function (error) {
          if (error.where === 'tree') wrongPath = pathFromMessage(error.message);
        });
        redraw();
      },
    };
  }


  /* ==========================================================================
     3. RECORRIDOS (traversal)
     El estudiante hace clic en los nodos en el orden del recorrido pedido.
     ========================================================================== */
  const ORDER_NAMES = {
    inorder: 'inorden (izquierda, raíz, derecha)',
    preorder: 'preorden (raíz, izquierda, derecha)',
    postorder: 'postorden (izquierda, derecha, raíz)',
  };

  function buildTraversal(root, exercise) {
    const tree = TreeView.normalize(exercise.tree);
    let picked = [];                   // [{ path, value }]
    let wrongIndex = null;             // posición señalada por el servidor
    let allCorrect = false;

    root.appendChild(create('h3', 'solver-title', 'Recorrido ' + (ORDER_NAMES[exercise.order] || exercise.order)));
    root.appendChild(create('p', 'text-muted',
      'Haz clic en los nodos en el orden en que los visitaría el recorrido. ' +
      'Cada nodo se puede elegir una sola vez.'));

    const mount = createTreeBox(root);
    const view = mount(tree, {
      label: 'Árbol del ejercicio',
      onNodeClick: function (path, value) {
        if (picked.some(function (item) { return item.path === path; })) return;
        picked.push({ path: path, value: value });
        touch();
      },
    });

    const bar = create('div', 'answer-row');
    const sequenceText = create('span', 'path-text');
    bar.appendChild(create('strong', null, 'Secuencia:'));
    bar.appendChild(sequenceText);
    bar.appendChild(createButton('Deshacer', function () { picked.pop(); touch(); }));
    bar.appendChild(createButton('Reiniciar', function () { picked = []; touch(); }));
    root.appendChild(bar);

    function paint() {
      view.clearStates();
      picked.forEach(function (item, index) {
        const state = index === wrongIndex ? 'is-wrong' : (allCorrect ? 'is-correct' : 'is-selected');
        view.setNodeState(item.path, state);
      });
      sequenceText.textContent = picked.length
        ? picked.map(function (item) { return item.value; }).join(', ')
        : '—';
    }

    function touch() {
      wrongIndex = null;
      allCorrect = false;
      paint();
    }

    paint();

    return {
      getAnswer: function () {
        return { sequence: picked.map(function (item) { return item.value; }) };
      },
      highlight: function (errors) {
        allCorrect = errors.length === 0;
        wrongIndex = null;
        errors.forEach(function (error) {
          // El mensaje dice "Revisa la posición 3 de la secuencia"
          const match = /posición (\d+)/.exec(error.message);
          if (match) wrongIndex = Number(match[1]) - 1;
        });
        paint();
      },
    };
  }


  /* ==========================================================================
     4. BALANCEO (balance)
     El árbol se ve en la columna lateral; aquí solo se responde Sí/No.
     ========================================================================== */
  function buildBalance(root) {
    root.appendChild(create('p', 'text-muted',
      'Un árbol está balanceado si, en cada nodo, las alturas de sus dos subárboles ' +
      'difieren como máximo en 1.'));
    const question = createYesNo(root, 'balanced', '¿El árbol está balanceado?');

    return {
      getAnswer: function () {
        const value = question.value();
        if (value === null) throw new Error('Responde la pregunta antes de validar.');
        return { balanced: value };
      },
      highlight: function (errors) {
        question.set.classList.toggle('is-wrong', errors.some(function (e) { return e.where === 'balanced'; }));
      },
    };
  }


  /* ==========================================================================
     5. ALTURA, PROFUNDIDAD Y HOJAS (tree_metrics)
     El árbol se ve en la columna lateral (con el nodo objetivo marcado).
     ========================================================================== */
  function buildMetrics(root, exercise) {
    const hasTarget = exercise.target !== undefined && exercise.target !== null;

    root.appendChild(create('p', 'text-muted',
      'Convenciones: la altura se mide en aristas (un árbol de un solo nodo tiene altura 0) ' +
      'y la profundidad de la raíz es 0.'));

    const fields = {
      height: createNumberField('Altura del árbol'),
      leaves: createNumberField('Número de hojas'),
    };
    if (hasTarget) fields.depth = createNumberField('Profundidad del nodo ' + exercise.target + ' (marcado en naranja)');

    Object.keys(fields).forEach(function (name) {
      fields[name].input.step = '1';
      fields[name].input.addEventListener('input', function () { fields[name].input.classList.remove('is-wrong'); });
      root.appendChild(fields[name].row);
    });

    return {
      getAnswer: function () {
        const answer = { height: fields.height.input.value, leaves: fields.leaves.input.value };
        if (hasTarget) answer.depth = fields.depth.input.value;
        return answer;
      },
      highlight: function (errors) {
        Object.keys(fields).forEach(function (name) {
          fields[name].input.classList.toggle('is-wrong', errors.some(function (e) { return e.where === name; }));
        });
      },
    };
  }


  /* ==========================================================================
     6. ÁRBOL DE EXPRESIÓN (expression_tree)
     El estudiante construye el árbol agregando símbolos (números y operadores)
     en los círculos punteados, y escribe el valor de la expresión.
     ========================================================================== */
  const MAX_NODES = 63;
  const SYMBOL_PATTERN = /^(\d+(\.\d+)?|[+\-*/])$/;

  function buildExpression(root, exercise) {
    let tree = null;
    let tool = 'add';                  // 'add' | 'delete'
    let wrongPath = null;
    let allCorrect = false;

    root.appendChild(create('h3', 'solver-title', 'Árbol de expresión'));
    root.appendChild(create('p', 'expression-text', exercise.expression));
    root.appendChild(create('p', 'text-muted',
      'Escribe un número o un operador y haz clic en un círculo punteado (+) para colocarlo. ' +
      'Los operadores van en los nodos internos y los números en las hojas.'));

    // --- Barra de herramientas ---
    const toolbar = create('div', 'editor-toolbar');
    const toolButtons = {};
    [['add', 'Agregar'], ['delete', 'Borrar']].forEach(function (item) {
      const button = create('button', 'tool' + (item[0] === 'delete' ? ' tool-danger' : ''), item[1]);
      button.type = 'button';
      button.addEventListener('click', function () {
        tool = item[0];
        redraw();
      });
      toolButtons[item[0]] = button;
      toolbar.appendChild(button);
    });
    root.appendChild(toolbar);

    // --- Símbolo a colocar ---
    const symbolRow = create('div', 'answer-row');
    symbolRow.appendChild(create('span', null, 'Símbolo'));
    const symbol = create('input', 'field-input');
    symbol.type = 'text';
    symbol.maxLength = 6;
    symbol.placeholder = 'ej. 2';
    symbol.setAttribute('aria-label', 'Símbolo a colocar');
    symbolRow.appendChild(symbol);
    [['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷']].forEach(function (op) {
      symbolRow.appendChild(createButton(op[1], function () { symbol.value = op[0]; }));
    });
    root.appendChild(symbolRow);

    const note = create('p', 'answer-note');
    root.appendChild(note);

    const mount = createTreeBox(root);

    const value = createNumberField('Valor de la expresión');
    value.input.addEventListener('input', function () { value.input.classList.remove('is-wrong'); });
    root.appendChild(value.row);

    function say(message) { note.textContent = message || ''; }

    function clearMarks() {
      wrongPath = null;
      allCorrect = false;
    }

    function redraw() {
      Object.keys(toolButtons).forEach(function (name) {
        toolButtons[name].classList.toggle('is-active', name === tool);
        toolButtons[name].setAttribute('aria-pressed', String(name === tool));
      });

      const options = { label: 'Árbol de expresión en construcción' };
      if (tool === 'add') {
        options.onSlotClick = function (path) {
          const text = symbol.value.trim();
          if (!SYMBOL_PATTERN.test(text)) { say('Escribe un número o un operador (+ - * /).'); return; }
          if (TreeView.countNodes(tree) >= MAX_NODES) { say('El máximo es de ' + MAX_NODES + ' nodos.'); return; }
          say('');
          tree = TreeView.withNode(tree, path, { value: text, left: null, right: null });
          clearMarks();
          redraw();
        };
      } else {
        options.onNodeClick = function (path) {
          tree = TreeView.withNode(tree, path, null);
          clearMarks();
          redraw();
        };
      }

      const view = mount(tree, options);
      if (view.svg) {
        if (allCorrect) view.paths.forEach(function (path) { view.setNodeState(path, 'is-correct'); });
        if (wrongPath !== null) view.setNodeState(nearestPath(tree, wrongPath), 'is-wrong');
      }
    }

    redraw();

    return {
      getAnswer: function () {
        if (!tree) throw new Error('Construye el árbol antes de validar.');
        return { tree: TreeView.normalize(tree), value: value.input.value };
      },
      highlight: function (errors) {
        clearMarks();
        allCorrect = errors.length === 0;
        errors.forEach(function (error) {
          if (error.where === 'tree') wrongPath = pathFromMessage(error.message);
        });
        value.input.classList.toggle('is-wrong', errors.some(function (e) { return e.where === 'value'; }));
        redraw();
      },
    };
  }


  GrafoLab.treeSolvers = {
    bst_build: buildBst,
    traversal: buildTraversal,
    balance: buildBalance,
    tree_metrics: buildMetrics,
    expression_tree: buildExpression,
  };
})();