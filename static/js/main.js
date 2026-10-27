/**
 * GrafoLab — JavaScript global
 * ----------------------------------------------------------------------------
 * Funciones que se usan en todas las páginas:
 *   1. Menú lateral (abrir/cerrar en móvil)
 *   2. Mensajes de Django (cerrar y desaparecer solos)
 *   3. Confirmación en formularios con data-confirm
 *   4. Utilidades para peticiones fetch con CSRF (window.GrafoLab)
 *
 * Todo vive dentro de una función autoejecutable para no contaminar el
 * ámbito global; solo se expone el objeto window.GrafoLab.
 */
(function () {
  'use strict';


  /* ==========================================================================
    0. DIÁLOGO DE CONFIRMACIÓN
    Reemplaza window.confirm / window.alert por un modal propio.
    showDialog devuelve una promesa: true si el usuario acepta, false si no.

    Opciones: title, message, confirmText, cancelText,
               danger (botón rojo), hideCancel (solo aviso, sin cancelar)
    ========================================================================== */
  const dialog = document.getElementById('confirm-dialog');
  const dialogTitle = document.getElementById('confirm-title');
  const dialogMessage = document.getElementById('confirm-message');
  const dialogOk = document.getElementById('confirm-ok');
  const dialogCancel = document.getElementById('confirm-cancel');

  function showDialog(options) {
    const opts = options || {};

    // Respaldo: si el navegador no soporta <dialog>, usar el cuadro nativo
    if (!dialog || typeof dialog.showModal !== 'function') {
      return Promise.resolve(opts.hideCancel ? true : window.confirm(opts.message || ''));
    }

    dialogTitle.textContent = opts.title || 'Confirmar acción';
    dialogMessage.textContent = opts.message || '';
    dialogOk.textContent = opts.confirmText || 'Aceptar';
    dialogOk.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
    dialogCancel.textContent = opts.cancelText || 'Cancelar';
    dialogCancel.hidden = Boolean(opts.hideCancel);
    dialog.returnValue = '';

    return new Promise(function (resolve) {
      // 'close' se dispara con cualquier botón, con Esc o al hacer clic fuera
      dialog.addEventListener('close', function () {
        resolve(dialog.returnValue === 'ok');
      }, { once: true });
      dialog.showModal();
    });
  }

  // Clic en el fondo oscuro: cerrar como "cancelar"
  if (dialog) {
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close('cancel');
    });
  }


  /* ==========================================================================
     1. MENÚ LATERAL
     En escritorio el sidebar siempre está visible; en móvil se abre con el
     botón de la barra superior y se cierra con la capa oscura, la tecla Esc,
     al elegir un enlace o al pasar a pantalla grande.
     ========================================================================== */
  const sidebar = document.getElementById('sidebar');
  const toggleButton = document.querySelector('[data-sidebar-toggle]');
  const overlay = document.querySelector('[data-sidebar-overlay]');
  const desktopQuery = window.matchMedia('(min-width: 992px)');

  /** Abre o cierra el menú y mantiene sincronizados los atributos ARIA. */
  function setSidebar(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    if (overlay) overlay.classList.toggle('is-visible', open);
    document.body.classList.toggle('sidebar-open', open);
    if (toggleButton) toggleButton.setAttribute('aria-expanded', String(open));
  }

  if (sidebar && toggleButton) {
    // Botón hamburguesa: alterna el estado actual
    toggleButton.addEventListener('click', function () {
      setSidebar(!sidebar.classList.contains('is-open'));
    });

    // Clic en la capa oscura: cerrar
    if (overlay) {
      overlay.addEventListener('click', function () {
        setSidebar(false);
      });
    }

    // Tecla Esc: cerrar y devolver el foco al botón
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
        setSidebar(false);
        toggleButton.focus();
      }
    });

    // Al elegir un enlace en móvil, cerrar el menú
    sidebar.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        setSidebar(false);
      });
    });

    // Si la ventana pasa a tamaño escritorio, restablecer el estado
    desktopQuery.addEventListener('change', function (event) {
      if (event.matches) setSidebar(false);
    });
  }


  /* ==========================================================================
     2. MENSAJES DE DJANGO
     Los de éxito e información desaparecen solos; los de error y advertencia
     se quedan hasta que el usuario los cierre.
     ========================================================================== */
  const AUTO_HIDE_MS = 5000;     // tiempo antes de ocultar un mensaje
  const HIDE_ANIMATION_MS = 250; // debe coincidir con la transición del CSS

  /** Anima la salida del mensaje y luego lo elimina del DOM. */
  function dismissMessage(message) {
    message.classList.add('is-hiding');
    setTimeout(function () {
      message.remove();
    }, HIDE_ANIMATION_MS);
  }

  document.querySelectorAll('.message').forEach(function (message) {
    // Botón de cerrar
    const closeButton = message.querySelector('[data-message-close]');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        dismissMessage(message);
      });
    }

    // Ocultar automáticamente solo los mensajes no críticos
    const isCritical =
      message.classList.contains('message-error') ||
      message.classList.contains('message-warning');
    if (!isCritical) {
      setTimeout(function () {
        dismissMessage(message);
      }, AUTO_HIDE_MS);
    }
  });


  /* ==========================================================================
    3. CONFIRMACIÓN EN FORMULARIOS
    Uso: <form method="post" data-confirm="¿Retirar a este estudiante?">
    Atributos opcionales: data-confirm-title, data-confirm-ok,
                           data-confirm-style="danger"
    Si el usuario cancela, el formulario no se envía.
    ========================================================================== */
  document.addEventListener('submit', function (event) {
    const form = event.target;
    if (!form.dataset || !form.dataset.confirm) return;

    // Segundo paso: el usuario ya aceptó, dejar que el envío continúe
    if (form.dataset.confirmed === 'true') {
      delete form.dataset.confirmed;
      return;
    }

    event.preventDefault();
    showDialog({
      title: form.dataset.confirmTitle,
      message: form.dataset.confirm,
      confirmText: form.dataset.confirmOk,
      danger: form.dataset.confirmStyle === 'danger',
    }).then(function (accepted) {
      if (accepted) {
        form.dataset.confirmed = 'true';
        form.requestSubmit();
      }
    });
  });


  /* ==========================================================================
    3b. ENVÍO AUTOMÁTICO DE FILTROS
    Uso: <select name="semester" data-autosubmit> dentro de un <form method="get">
    Al cambiar la opción, el formulario se envía solo.
    ========================================================================== */
  document.querySelectorAll('[data-autosubmit]').forEach(function (field) {
    field.addEventListener('change', function () {
      if (field.form) field.form.submit();
    });
  });


  /* ==========================================================================
   3c. BARRAS DE PROGRESO
   Uso: <div class="progress-bar" data-width="66.7"></div>
   Aplica el ancho en % desde JavaScript, así el HTML no lleva estilos con
   etiquetas de plantilla y la barra se llena con una pequeña animación.
   ========================================================================== */
  document.querySelectorAll('.progress-bar[data-width]').forEach(function (bar) {
    // Limitar entre 0 y 100 por seguridad
    const value = Math.min(100, Math.max(0, parseFloat(bar.dataset.width) || 0));
    bar.style.width = value + '%';
  });

  
  /* ==========================================================================
     4. UTILIDADES PARA FETCH
     Las usará la pantalla de resolver ejercicios para enviar la respuesta.
     ========================================================================== */

  /** Lee el token CSRF de la etiqueta <meta> definida en base.html. */
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  /* ==========================================================================
   5. ACTIVAR / DESACTIVAR CUENTAS
   Uso: <button data-toggle-active data-url="..." data-active="true|false"
                data-confirm="..."> dentro de un contenedor con data-student.
    Envía un POST con fetch y actualiza el botón y la insignia de estado.
    ========================================================================== */

  /** Refleja el nuevo estado en el botón y en la insignia de su contenedor. */
  function applyActiveState(button, isActive) {
    button.dataset.active = String(isActive);
    button.textContent = isActive ? 'Desactivar' : 'Activar';

    const scope = button.closest('[data-student]') || document;
    const badge = scope.querySelector('[data-status-badge]');
    if (badge) {
      badge.className = 'badge ' + (isActive ? 'badge-success' : 'badge-danger');
      badge.textContent = isActive ? 'Activo' : 'Inactivo';
    }
  }

  document.querySelectorAll('[data-toggle-active]').forEach(function (button) {
    button.addEventListener('click', async function () {
      const isActive = button.dataset.active === 'true';

      // Solo se pide confirmación al desactivar; activar es inmediato
      if (isActive) {
        const accepted = await showDialog({
          title: 'Desactivar cuenta',
          message: button.dataset.confirm || '¿Desactivar esta cuenta?',
          confirmText: 'Desactivar',
          danger: true,
        });
        if (!accepted) return;
      }

      button.disabled = true;
      try {
        const result = await postJSON(button.dataset.url, {});
        if (result.ok && result.data && result.data.success) {
          applyActiveState(button, result.data.is_active);
        } else {
          await showDialog({
            title: 'No se pudo actualizar',
            message: 'Intenta de nuevo en unos segundos.',
            confirmText: 'Entendido',
            hideCancel: true,
          });
        }
      } catch (error) {
        await showDialog({
          title: 'Error de conexión',
          message: 'Revisa tu conexión e intenta de nuevo.',
          confirmText: 'Entendido',
          hideCancel: true,
        });
      } finally {
        button.disabled = false;
      }
    });
  });


  /* ==========================================================================
   6. SELECCIONAR TODOS
   Uso: <input type="checkbox" data-check-all="id-del-contenedor">
   Marca o desmarca todas las casillas dentro del contenedor indicado.
    ========================================================================== */
  document.querySelectorAll('[data-check-all]').forEach(function (master) {
    const container = document.getElementById(master.dataset.checkAll);
    if (!container) return;

    master.addEventListener('change', function () {
      container.querySelectorAll('input[type="checkbox"]').forEach(function (box) {
        box.checked = master.checked;
      });
    });
  });


  /**
   * GrafoLab — Formulario de ejercicios (docente)
   * ----------------------------------------------------------------------------
   *   1. Filtra los tipos de ejercicio según la categoría elegida
   *   2. Muestra la ayuda de formato JSON del tipo seleccionado
   *   3. Permite insertar un ejemplo en el campo de datos
   *
   * Es una solución temporal: cuando exista el editor SVG, el JSON se generará
   * al dibujar y este archivo ya no hará falta.
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

        // Si el campo ya tiene contenido, mejor no pisarlo sin avisar
        const hasContent = dataField.value.trim() && dataField.value.trim() !== '{}';
        const proceed = hasContent
          ? window.GrafoLab.showDialog({
              title: 'Reemplazar datos',
              message: 'El campo ya tiene contenido. ¿Reemplazarlo por el ejemplo?',
              confirmText: 'Reemplazar',
            })
          : Promise.resolve(true);

        proceed.then(function (accepted) {
          if (accepted) dataField.value = visible.textContent;
        });
      });
    }

    // Estado inicial (importante al editar un ejercicio existente)
    filterKinds();
    showHelp();
  })();
  

  /**
   * Envía datos como JSON por POST incluyendo el token CSRF.
   * Devuelve { ok, status, data }; `data` es null si la respuesta no es JSON.
   *
   * Ejemplo:
   *   const res = await GrafoLab.postJSON(url, { answer: { ... } });
   *   if (res.ok && res.data.is_correct) { ... }
   */
  async function postJSON(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(body),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      // La respuesta no era JSON (por ejemplo, una página de error)
    }
    return { ok: response.ok, status: response.status, data: data };
  }

  // Única API pública del archivo
  window.GrafoLab = { getCsrfToken: getCsrfToken, postJSON: postJSON, showDialog: showDialog };
})();