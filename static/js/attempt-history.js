(function () {
  'use strict';

  document.querySelectorAll('[data-tree-answer-json]').forEach(function (container) {
    try {
      const tree = JSON.parse(container.dataset.treeAnswerJson);
      if (window.GrafoLab && window.GrafoLab.TreeView) {
        window.GrafoLab.TreeView.render(container, tree, { label: 'Árbol enviado en el intento' });
      }
    } catch (_) {
      container.textContent = 'No se pudo mostrar el árbol.';
    }
  });
})();
