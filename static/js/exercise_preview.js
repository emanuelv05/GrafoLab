/**
 * GrafoLab — Vista previa del ejercicio (docente)
 * ----------------------------------------------------------------------------
 * Lee los datos del ejercicio (etiqueta json_script "exercise-data") y los
 * dibuja dentro de #exercise-figure, sea un grafo, un árbol, los valores de
 * un BST o una expresión.
 */
(function () {
  'use strict';

  const figure = document.getElementById('exercise-figure');
  const dataTag = document.getElementById('exercise-data');
  if (!figure || !dataTag) return;

  const data = JSON.parse(dataTag.textContent);
  const GrafoLab = window.GrafoLab;

  /** Agrega una línea de texto bajo el dibujo. */
  function addCaption(text) {
    const caption = document.createElement('p');
    caption.className = 'graph-caption';
    caption.textContent = text;
    figure.appendChild(caption);
  }

  if (Array.isArray(data.vertices)) {
    GrafoLab.GraphView.render(figure, data, { label: 'Vista previa del grafo' });

  } else if (data.tree !== undefined) {
    GrafoLab.TreeView.render(figure, data.tree, {
      label: 'Vista previa del árbol',
      highlightValue: data.target,
    });
    if (data.order) addCaption('Recorrido pedido: ' + data.order);
    if (data.target !== undefined && data.target !== null) addCaption('Nodo objetivo: ' + data.target);

  } else if (Array.isArray(data.values)) {
    GrafoLab.TreeView.render(figure, data.values.reduce(GrafoLab.TreeView.bstInsert, null), {
      label: 'Árbol que resulta de insertar los valores',
    });
    addCaption('Valores en orden de inserción: ' + data.values.join(', '));

  } else if (typeof data.expression === 'string') {
    const code = document.createElement('p');
    code.className = 'expression-text';
    code.textContent = data.expression;
    figure.replaceChildren(code);
  }
})();