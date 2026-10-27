/**
 * GrafoLab — Formulario de ejercicios (docente)
 * ----------------------------------------------------------------------------
 *   1. Filtra los tipos de ejercicio según la categoría elegida
 *   2. Muestra la ayuda de formato JSON del tipo seleccionado
 *   3. Permite insertar un ejemplo en el campo de datos
 *
 * Funciona junto con graph-editor.js: cuando este archivo cambia el contenido
 * del campo de datos, avisa con un evento "input" para que el dibujo se actualice.
 */
(function () {
  'use strict';

  const categoryField = document.getElementById('id_category');
  const kindField = document.getElementById('id_kind');
  const dataField = document.getElementById('id_data');
  const help = document.getElementById('data-help');
  const useExampleButton = document.getElementById('use-example');

  if (!categoryField || !kindField || !dataField) return;

  // Categoría a la que pertenece cada tipo (debe coincidir con registry.py)
  const CATEGORY_OF_KIND = {
    adjacency_matrix: 'graph',
    dijkstra: 'graph',
    mst: 'graph',
    connectivity: 'graph',
    coloring: 'graph',
    bst_build: 'tree',
    traversal: 'tree',
    balance: 'tree',
    tree_metrics: 'tree',
    expression_tree: 'tree',
  };

  /** Oculta los tipos que no corresponden a la categoría elegida. */
  function filterKinds() {
    const category = categoryField.value;

    Array.from(kindField.options).forEach(function (option) {
      const mismatch = option.value && category && CATEGORY_OF_KIND[option.value] !== category;
      option.hidden = mismatch;
      option.disabled = mismatch; // algunos navegadores ignoran "hidden" en <option>
    });

    // Si el tipo elegido ya no corresponde, volver a "sin seleccionar"
    const selected = kindField.options[kindField.selectedIndex];
    if (selected && selected.disabled) kindField.value = '';
  }

  /** Muestra solo la ayuda del tipo seleccionado. */
  function showHelp() {
    if (!help) return;
    let found = false;
    help.querySelectorAll('.example').forEach(function (example) {
      const match = example.dataset.kind === kindField.value;
      example.hidden = !match;
      if (match) found = true;
    });
    help.hidden = !found;
  }

  // Al elegir un tipo, se fija también la categoría correspondiente
  kindField.addEventListener('change', function () {
    const category = CATEGORY_OF_KIND[kindField.value];
    if (category) categoryField.value = category;
    filterKinds();
    showHelp();
  });

  categoryField.addEventListener('change', function () {
    filterKinds();
    showHelp();
  });

  // Botón "Usar este ejemplo": copia el JSON mostrado al campo de datos
  if (useExampleButton) {
    useExampleButton.addEventListener('click', function () {
      const visible = help.querySelector('.example:not([hidden]) pre');
      if (!visible) return;

      // Si el campo ya tiene contenido, no pisarlo sin avisar
      const hasContent = dataField.value.trim() && dataField.value.trim() !== '{}';
      const proceed = hasContent
        ? window.GrafoLab.showDialog({
            title: 'Reemplazar datos',
            message: 'El campo ya tiene contenido. ¿Reemplazarlo por el ejemplo?',
            confirmText: 'Reemplazar',
          })
        : Promise.resolve(true);

      proceed.then(function (accepted) {
        if (!accepted) return;
        dataField.value = visible.textContent;
        // Avisar al editor gráfico de que el contenido cambió
        dataField.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }

  // Estado inicial (importante al editar un ejercicio existente)
  filterKinds();
  showHelp();
})();