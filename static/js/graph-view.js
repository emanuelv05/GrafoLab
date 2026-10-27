/**
 * GrafoLab — Visor de grafos (SVG)
 * ----------------------------------------------------------------------------
 * Dibuja un grafo a partir del JSON del ejercicio:
 *
 *   { "vertices": ["A","B","C"],
 *     "edges": [["A","B"], ["B","C", 4]],            // el 3er valor es el peso (opcional)
 *     "positions": { "A": {"x": 80, "y": 90} },      // opcional; si falta, se acomodan en círculo
 *     "source": "A", "target": "C" }                 // opcional; se marcan origen y destino
 *
 * Uso:
 *   const view = GrafoLab.GraphView.render(contenedor, datos, opciones);
 *   view.setVertexState('A', 'is-selected');
 *
 * Opciones:
 *   label               texto accesible del dibujo
 *   editing             true -> modo editor (desactiva el scroll táctil sobre el dibujo)
 *   onVertexClick       function(vertice)              -> vértices clicables
 *   onEdgeClick         function(u, v, peso)           -> aristas clicables
 *   onCanvasClick       function({x, y})               -> clic en el fondo vacío
 *   onVertexPointerDown function(vertice, evento)      -> inicio de arrastre
 *
 * Es solo dibujo: no valida ni guarda nada. Las pantallas (resolver, editor)
 * lo usan y deciden qué hacer con los clics.
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Lienzo y medidas (coordenadas internas del SVG; el tamaño real es responsivo).
  // Deben coincidir con los límites de "positions" en graphs/validators.py
  const VIEW_WIDTH = 480;
  const VIEW_HEIGHT = 360;
  const VERTEX_RADIUS = 22;

  // Estados temporales que clearStates() puede quitar
  const TRANSIENT_STATES = ['is-selected', 'is-wrong', 'is-correct', 'is-visited'];


  /* ==========================================================================
     UTILIDADES
     ========================================================================== */

  /** Crea un elemento SVG con atributos y clase opcionales. */
  function svgElement(tag, attributes, className) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attributes || {}).forEach(function (name) {
      node.setAttribute(name, attributes[name]);
    });
    if (className) node.setAttribute('class', className);
    return node;
  }

  /** Clave única de una arista sin dirección: A-B y B-A son la misma. */
  function edgeKey(a, b) {
    return [a, b].sort().join('|');
  }

  /**
   * Calcula la posición de cada vértice.
   * Usa la guardada en el JSON si existe; si no, los reparte en círculo.
   */
  function computePositions(vertices, saved) {
    const positions = {};
    const centerX = VIEW_WIDTH / 2;
    const centerY = VIEW_HEIGHT / 2;
    const radius = Math.min(VIEW_WIDTH, VIEW_HEIGHT) / 2 - VERTEX_RADIUS - 20;

    vertices.forEach(function (vertex, index) {
      const own = saved && saved[vertex];
      if (own && isFinite(own.x) && isFinite(own.y)) {
        positions[vertex] = { x: Number(own.x), y: Number(own.y) };
        return;
      }
      // Empieza arriba (-90°) y avanza en sentido horario
      const angle = -Math.PI / 2 + (2 * Math.PI * index) / vertices.length;
      positions[vertex] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
    return positions;
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


  /* ==========================================================================
     DIBUJO
     ========================================================================== */
  function render(container, data, options) {
    const opts = options || {};
    const vertices = data.vertices || [];
    const edges = data.edges || [];
    const positions = computePositions(vertices, data.positions);

    const root = svgElement('svg', {
      viewBox: '0 0 ' + VIEW_WIDTH + ' ' + VIEW_HEIGHT,
      role: 'img',
      'aria-label': opts.label || 'Grafo',
    }, 'graph-svg' + (opts.editing ? ' is-editing' : ''));

    /** Convierte la posición del puntero (píxeles de pantalla) a coordenadas del SVG. */
    function pointFromEvent(event) {
      const matrix = root.getScreenCTM();
      if (!matrix) return { x: 0, y: 0 };
      const point = root.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(matrix.inverse());
      return { x: local.x, y: local.y };
    }

    // Fondo invisible: recibe los clics en espacio vacío (agregar vértices)
    const background = svgElement('rect', {
      x: 0, y: 0, width: VIEW_WIDTH, height: VIEW_HEIGHT,
    }, 'graph-bg');
    if (opts.onCanvasClick) {
      background.addEventListener('click', function (event) {
        opts.onCanvasClick(pointFromEvent(event));
      });
    }
    root.appendChild(background);

    // Las aristas van en una capa inferior para que los vértices queden encima
    const edgeLayer = svgElement('g');
    const vertexLayer = svgElement('g');
    root.appendChild(edgeLayer);
    root.appendChild(vertexLayer);

    const edgeElements = {};     // clave de arista -> grupo SVG
    const edgeRecords = [];      // datos para reubicar aristas al mover vértices
    const vertexElements = {};   // vértice -> grupo SVG

    // --- Aristas ---
    edges.forEach(function (edge) {
      const u = edge[0];
      const v = edge[1];
      const weight = edge.length > 2 ? edge[2] : null;
      if (!positions[u] || !positions[v]) return;   // arista con vértice inexistente: se omite

      const from = positions[u];
      const to = positions[v];
      const group = svgElement('g', {}, 'graph-edge');
      const coords = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };

      const line = svgElement('line', coords, 'graph-edge-line');
      const hit = svgElement('line', coords, 'graph-edge-hit');   // zona de clic más ancha
      group.appendChild(line);
      group.appendChild(hit);

      let label = null;
      if (weight !== null) {
        label = svgElement('text', {
          x: (from.x + to.x) / 2,
          y: (from.y + to.y) / 2,
        }, 'graph-weight');
        label.textContent = String(weight);
        group.appendChild(label);
      }

      if (opts.onEdgeClick) {
        makeClickable(group, function () { opts.onEdgeClick(u, v, weight); });
        group.setAttribute('aria-label', 'Arista ' + u + ' a ' + v + (weight !== null ? ', peso ' + weight : ''));
      }

      edgeLayer.appendChild(group);
      edgeElements[edgeKey(u, v)] = group;
      edgeRecords.push({ u: u, v: v, lines: [line, hit], label: label });
    });

    // --- Vértices ---
    vertices.forEach(function (vertex) {
      const position = positions[vertex];
      const group = svgElement('g', {
        transform: 'translate(' + position.x + ',' + position.y + ')',
      }, 'graph-vertex');

      group.appendChild(svgElement('circle', { r: VERTEX_RADIUS }));
      const label = svgElement('text');
      label.textContent = vertex;
      group.appendChild(label);

      if (opts.onVertexClick) {
        makeClickable(group, function () { opts.onVertexClick(vertex); });
        group.setAttribute('aria-label', 'Vértice ' + vertex);
      }
      if (opts.onVertexPointerDown) {
        group.addEventListener('pointerdown', function (event) {
          opts.onVertexPointerDown(vertex, event);
        });
      }

      vertexLayer.appendChild(group);
      vertexElements[vertex] = group;
    });

    // --- Origen y destino (ejercicios de camino más corto) ---
    if (data.source && vertexElements[data.source]) vertexElements[data.source].classList.add('is-start');
    if (data.target && vertexElements[data.target]) vertexElements[data.target].classList.add('is-end');

    // --- Montaje en la página ---
    container.replaceChildren(root);
    if (data.source && data.target) {
      const caption = document.createElement('p');
      caption.className = 'graph-caption';
      caption.textContent = 'Origen: ' + data.source + ' (verde) · Destino: ' + data.target + ' (rojo)';
      container.appendChild(caption);
    }


    /* ------------------------------------------------------------------------
       CONTROL: lo que devuelve render() para manipular el dibujo después
       ------------------------------------------------------------------------ */
    return {
      svg: root,
      positions: positions,
      bounds: { width: VIEW_WIDTH, height: VIEW_HEIGHT, radius: VERTEX_RADIUS },
      pointFromEvent: pointFromEvent,

      /** Mueve un vértice y reubica sus aristas y pesos, sin volver a dibujar todo. */
      moveVertex: function (vertex, x, y) {
        const node = vertexElements[vertex];
        if (!node) return;
        positions[vertex] = { x: x, y: y };
        node.setAttribute('transform', 'translate(' + x + ',' + y + ')');

        edgeRecords.forEach(function (record) {
          if (record.u !== vertex && record.v !== vertex) return;
          const from = positions[record.u];
          const to = positions[record.v];
          record.lines.forEach(function (line) {
            line.setAttribute('x1', from.x);
            line.setAttribute('y1', from.y);
            line.setAttribute('x2', to.x);
            line.setAttribute('y2', to.y);
          });
          if (record.label) {
            record.label.setAttribute('x', (from.x + to.x) / 2);
            record.label.setAttribute('y', (from.y + to.y) / 2);
          }
        });
      },

      /** Activa o desactiva una clase de estado en un vértice. */
      setVertexState: function (vertex, state, on) {
        const node = vertexElements[vertex];
        if (node) node.classList.toggle(state, on !== false);
      },

      /** Activa o desactiva una clase de estado en una arista. */
      setEdgeState: function (u, v, state, on) {
        const node = edgeElements[edgeKey(u, v)];
        if (node) node.classList.toggle(state, on !== false);
      },

      /** Pinta un vértice con un color (coloreo de grafos). Sin color: vuelve al normal. */
      setVertexColor: function (vertex, color) {
        const node = vertexElements[vertex];
        if (!node) return;
        node.querySelector('circle').style.fill = color || '';
      },

      /** Quita los estados temporales (selección, errores) de todo el dibujo. */
      clearStates: function () {
        root.querySelectorAll('.graph-vertex, .graph-edge').forEach(function (node) {
          TRANSIENT_STATES.forEach(function (state) { node.classList.remove(state); });
        });
      },
    };
  }

  // Publicar en el espacio de nombres común (main.js ya creó window.GrafoLab)
  window.GrafoLab = window.GrafoLab || {};
  window.GrafoLab.GraphView = { render: render };
})();