/**
 * GrafoLab — Visor de árboles binarios (SVG)
 * ----------------------------------------------------------------------------
 * Dibuja un árbol anidado como el que usa el servidor:
 *
 *   { "value": 8,
 *     "left":  { "value": 3, "left": null, "right": null },
 *     "right": null }
 *
 * Uso:
 *   const view = GrafoLab.TreeView.render(contenedor, arbol, opciones);
 *   view.setNodeState('LR', 'is-selected');
 *
 * Opciones:
 *   label           texto accesible del dibujo
 *   highlightValue  valor del nodo que se marca como objetivo
 *   onNodeClick     function(ruta, valor)   -> nodos clicables
 *   onSlotClick     function(ruta)          -> muestra círculos punteados (+) donde
 *                                              se puede agregar un hijo, y los hace clicables
 *
 * Cada nodo se identifica por su RUTA desde la raíz: '' es la raíz,
 * 'L' su hijo izquierdo, 'LR' el hijo derecho de ese, etc.
 *
 * Además del dibujo, expone utilidades para manipular los datos del árbol
 * (normalize, nodeAt, withNode, countNodes, bstInsert) que usan los editores.
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Medidas (coordenadas internas del SVG; el tamaño real es responsivo)
  const X_GAP = 50;          // separación horizontal entre posiciones
  const Y_GAP = 68;          // separación vertical entre niveles
  const RADIUS = 18;         // radio de un nodo
  const GHOST_RADIUS = 11;   // radio de un círculo punteado (+)
  const MARGIN = 30;
  const MIN_WIDTH = 300;

  const TRANSIENT_STATES = ['is-selected', 'is-wrong', 'is-correct'];


  /* ==========================================================================
     1. UTILIDADES SOBRE LOS DATOS DEL ÁRBOL
     ========================================================================== */

  /** Copia profunda con la forma exacta { value, left, right }. Devuelve null si no es un nodo. */
  function normalize(node) {
    if (node === null || node === undefined || typeof node !== 'object' || !('value' in node)) return null;
    return { value: node.value, left: normalize(node.left), right: normalize(node.right) };
  }

  function directionOf(letter) {
    return letter === 'L' ? 'left' : 'right';
  }

  /** Nodo que está en esa ruta, o null. */
  function nodeAt(tree, path) {
    let current = tree;
    for (let i = 0; i < path.length && current; i++) current = current[directionOf(path[i])];
    return current || null;
  }

  /**
   * Devuelve un árbol NUEVO donde la posición `path` contiene `node`
   * (o queda vacía si node es null). No modifica el árbol original.
   */
  function withNode(tree, path, node) {
    if (path === '') return node;
    const copy = normalize(tree);
    let cursor = copy;
    for (let i = 0; i < path.length - 1; i++) {
      cursor = cursor ? cursor[directionOf(path[i])] : null;
    }
    if (!cursor) return copy;     // ruta inválida: no hacer nada
    cursor[directionOf(path[path.length - 1])] = node;
    return copy;
  }

  function countNodes(node) {
    return node ? 1 + countNodes(node.left) + countNodes(node.right) : 0;
  }

  /** Inserta un valor en un árbol de búsqueda (ignora repetidos, igual que el servidor). */
  function bstInsert(root, value) {
    if (!root) return { value: value, left: null, right: null };
    if (value < root.value) root.left = bstInsert(root.left, value);
    else if (value > root.value) root.right = bstInsert(root.right, value);
    return root;
  }

  /** Ruta del primer nodo con ese valor, buscando en preorden (igual que el servidor). */
  function findPath(node, value, path) {
    if (!node) return null;
    if (String(node.value) === String(value)) return path;
    const left = findPath(node.left, value, path + 'L');
    return left !== null ? left : findPath(node.right, value, path + 'R');
  }


  /* ==========================================================================
     2. DISEÑO (posición de cada nodo)
     x: orden "inorden" (izquierda, nodo, derecha), así nada se cruza.
     y: nivel del nodo.
     Si se piden ranuras, cada hijo vacío ocupa una posición como círculo punteado.
     ========================================================================== */
  function layout(tree, withSlots) {
    const entries = [];
    let counter = 0;
    let maxDepth = 0;

    function walk(node, path, depth) {
      maxDepth = Math.max(maxDepth, depth);

      if (!node) {
        if (!withSlots) return null;
        const ghost = { path: path, ghost: true, depth: depth, index: counter++ };
        entries.push(ghost);
        return ghost;
      }

      const entry = { path: path, ghost: false, value: node.value, depth: depth };
      entry.left = walk(node.left, path + 'L', depth + 1);
      entry.index = counter++;
      entry.right = walk(node.right, path + 'R', depth + 1);
      entries.push(entry);
      return entry;
    }

    walk(tree, '', 0);
    return { entries: entries, count: counter, maxDepth: maxDepth };
  }


  /* ==========================================================================
     3. DIBUJO
     ========================================================================== */
  function svgElement(tag, attributes, className) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attributes || {}).forEach(function (name) { node.setAttribute(name, attributes[name]); });
    if (className) node.setAttribute('class', className);
    return node;
  }

  /** Hace que un elemento SVG responda a clic y a teclado (Enter / Espacio). */
  function makeClickable(node, handler) {
    node.classList.add('is-clickable');
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.addEventListener('click', handler);
    node.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handler();
      }
    });
  }

  function render(container, tree, options) {
    const opts = options || {};
    const root = normalize(tree);
    const withSlots = typeof opts.onSlotClick === 'function';
    const plan = layout(root, withSlots);

    // Árbol vacío y sin ranuras: solo un aviso
    if (plan.count === 0) {
      const empty = document.createElement('p');
      empty.className = 'tree-empty';
      empty.textContent = 'Árbol vacío';
      container.replaceChildren(empty);
      return { svg: null, paths: [], setNodeState: function () {}, clearStates: function () {} };
    }

    // Tamaño del lienzo según la cantidad de posiciones
    const span = (plan.count - 1) * X_GAP;
    const width = Math.max(MIN_WIDTH, span + MARGIN * 2);
    const height = MARGIN * 2 + plan.maxDepth * Y_GAP;
    const offsetX = (width - span) / 2;       // centra los árboles pequeños

    const xOf = function (entry) { return offsetX + entry.index * X_GAP; };
    const yOf = function (entry) { return MARGIN + entry.depth * Y_GAP; };

    const svg = svgElement('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      role: 'img',
      'aria-label': opts.label || 'Árbol binario',
    }, 'tree-svg');
    svg.style.maxWidth = width + 'px';        // los árboles chicos no se agrandan de más

    const edgeLayer = svgElement('g');
    const nodeLayer = svgElement('g');
    svg.appendChild(edgeLayer);
    svg.appendChild(nodeLayer);

    // --- Aristas: de cada nodo real a sus hijos (o a su ranura vacía) ---
    plan.entries.forEach(function (entry) {
      if (entry.ghost) return;
      [entry.left, entry.right].forEach(function (child) {
        if (!child) return;
        edgeLayer.appendChild(svgElement('line', {
          x1: xOf(entry), y1: yOf(entry), x2: xOf(child), y2: yOf(child),
        }, 'tree-edge' + (child.ghost ? ' is-ghost' : '')));
      });
    });

    // --- Nodos y ranuras ---
    const nodeElements = {};
    const paths = [];

    plan.entries.forEach(function (entry) {
      const group = svgElement('g', {
        transform: 'translate(' + xOf(entry) + ',' + yOf(entry) + ')',
      }, entry.ghost ? 'tree-slot' : 'tree-node');

      if (entry.ghost) {
        group.appendChild(svgElement('circle', { r: GHOST_RADIUS }));
        const plus = svgElement('text');
        plus.textContent = '+';
        group.appendChild(plus);
        makeClickable(group, function () { opts.onSlotClick(entry.path); });
        group.setAttribute('aria-label', 'Agregar un nodo aquí');
      } else {
        group.appendChild(svgElement('circle', { r: RADIUS }));
        const label = svgElement('text');
        label.textContent = String(entry.value);
        if (label.textContent.length > 3) label.setAttribute('font-size', '11');
        group.appendChild(label);

        if (opts.onNodeClick) {
          makeClickable(group, function () { opts.onNodeClick(entry.path, entry.value); });
          group.setAttribute('aria-label', 'Nodo ' + entry.value);
        }
        nodeElements[entry.path] = group;
        paths.push(entry.path);
      }
      nodeLayer.appendChild(group);
    });

    // --- Nodo objetivo (por valor; se marca el primero en preorden) ---
    if (opts.highlightValue !== undefined && opts.highlightValue !== null) {
      const targetPath = findPath(root, opts.highlightValue, '');
      if (targetPath !== null && nodeElements[targetPath]) nodeElements[targetPath].classList.add('is-target');
    }

    container.replaceChildren(svg);

    return {
      svg: svg,
      paths: paths,

      /** Activa o desactiva un estado visual en el nodo de esa ruta. */
      setNodeState: function (path, state, on) {
        const node = nodeElements[path];
        if (node) node.classList.toggle(state, on !== false);
      },

      /** Quita los estados temporales de todos los nodos. */
      clearStates: function () {
        Object.keys(nodeElements).forEach(function (path) {
          TRANSIENT_STATES.forEach(function (state) { nodeElements[path].classList.remove(state); });
        });
      },
    };
  }

  window.GrafoLab = window.GrafoLab || {};
  window.GrafoLab.TreeView = {
    render: render,
    normalize: normalize,
    nodeAt: nodeAt,
    withNode: withNode,
    countNodes: countNodes,
    bstInsert: bstInsert,
  };
})();