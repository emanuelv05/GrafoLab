from collections import namedtuple

from .graphs import validators as g
from .results import Result
from .trees import validators as t

Handler = namedtuple("Handler", "category validate_data check_answer")

REGISTRY = {
    "adjacency_matrix": Handler("graph", g.validate_adjacency_matrix_data, g.check_adjacency_matrix),
    "dijkstra":         Handler("graph", g.validate_dijkstra_data, g.check_dijkstra),
    "mst":              Handler("graph", g.validate_mst_data, g.check_mst),
    "connectivity":     Handler("graph", g.validate_connectivity_data, g.check_connectivity),
    "coloring":         Handler("graph", g.validate_coloring_data, g.check_coloring),
    "bst_build":        Handler("tree", t.validate_bst_build_data, t.check_bst_build),
    "traversal":        Handler("tree", t.validate_traversal_data, t.check_traversal),
    "balance":          Handler("tree", t.validate_balance_data, t.check_balance),
    "tree_metrics":     Handler("tree", t.validate_tree_metrics_data, t.check_tree_metrics),
    "expression_tree":  Handler("tree", t.validate_expression_tree_data, t.check_expression_tree),
}


def validate_exercise_data(kind, category, data):
    """Lanza ValueError si el tipo, la categoría o los datos no sirven."""
    handler = REGISTRY.get(kind)
    if handler is None:
        raise ValueError("Tipo de ejercicio desconocido.")
    if handler.category != category:
        raise ValueError("El tipo de ejercicio no corresponde a la categoría elegida.")
    if not isinstance(data, dict):
        raise ValueError("Los datos deben ser un objeto JSON.")
    handler.validate_data(data)


def evaluate_answer(kind, data, answer):
    """Corrige una respuesta y devuelve un Result."""
    invalid = Result(False, [{"where": "answer",
                              "message": "La respuesta está incompleta o tiene un formato inválido."}])
    if not isinstance(answer, dict):
        return invalid
    try:
        return REGISTRY[kind].check_answer(data, answer)
    except (KeyError, IndexError, TypeError, ValueError, AttributeError):
        return invalid