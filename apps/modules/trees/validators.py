from ..results import Result, same_number, to_int
from .algorithms import (MAX_NODES, ORDERS, build_bst, clean_tree, count_leaves,
                         depth_of, evaluate, first_difference, height,
                         is_balanced, parse_expression)


# ---------- Validación de los datos que crea el docente ----------

def _require_tree(data):
    tree = clean_tree(data.get("tree"))
    if tree is None:
        raise ValueError("El árbol no puede estar vacío.")
    return tree


def validate_bst_build_data(data):
    values = data.get("values")
    if not isinstance(values, list) or not 1 <= len(values) <= MAX_NODES:
        raise ValueError(f"Ingresa entre 1 y {MAX_NODES} valores.")
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in values):
        raise ValueError("Los valores deben ser enteros.")
    if len(set(values)) != len(values):
        raise ValueError("No se permiten valores repetidos.")


def validate_traversal_data(data):
    _require_tree(data)
    if data.get("order") not in ORDERS:
        raise ValueError("El recorrido debe ser inorder, preorder o postorder.")


def validate_balance_data(data):
    _require_tree(data)


def validate_tree_metrics_data(data):
    tree = _require_tree(data)
    target = data.get("target")
    if target is not None and depth_of(tree, target) is None:
        raise ValueError("El nodo 'target' no existe en el árbol.")


def validate_expression_tree_data(data):
    expression = data.get("expression")
    if not isinstance(expression, str) or not expression.strip():
        raise ValueError("Escribe una expresión aritmética.")
    evaluate(parse_expression(expression))  # lanza ValueError si no se puede


# ---------- Corrección de la respuesta del estudiante ----------

def check_bst_build(data, answer):
    expected = build_bst(data["values"])
    given = clean_tree(answer["tree"])
    diff = first_difference(given, expected)
    if diff is None:
        return Result(True)
    return Result(False, [{"where": "tree",
                           "message": f"El árbol no coincide. Revisa el nodo en: {diff}."}])


def check_traversal(data, answer):
    expected = ORDERS[data["order"]](clean_tree(data["tree"]))
    given = answer["sequence"]
    errors = []
    for i, (g, e) in enumerate(zip(given, expected)):
        if str(g) != str(e):
            errors.append({"where": "sequence",
                           "message": f"Revisa la posición {i + 1} de la secuencia."})
            break
    else:
        if len(given) != len(expected):
            errors.append({"where": "sequence",
                           "message": "La secuencia está incompleta o tiene elementos de más."})
    return Result(not errors, errors)


def check_balance(data, answer):
    if answer.get("balanced") == is_balanced(clean_tree(data["tree"])):
        return Result(True)
    return Result(False, [{"where": "balanced",
                           "message": "Revisa: un árbol está balanceado si en cada nodo la diferencia "
                                      "de alturas de sus subárboles es como máximo 1."}])


def check_tree_metrics(data, answer):
    tree = clean_tree(data["tree"])
    errors = []
    if to_int(answer.get("height")) != height(tree):
        errors.append({"where": "height", "message": "Revisa la altura."})
    if to_int(answer.get("leaves")) != count_leaves(tree):
        errors.append({"where": "leaves", "message": "Revisa el número de hojas."})
    target = data.get("target")
    if target is not None and to_int(answer.get("depth")) != depth_of(tree, target):
        errors.append({"where": "depth", "message": f"Revisa la profundidad del nodo {target}."})
    return Result(not errors, errors)


def check_expression_tree(data, answer):
    expected = parse_expression(data["expression"])
    given = clean_tree(answer["tree"])
    errors = []
    diff = first_difference(given, expected)
    if diff is not None:
        errors.append({"where": "tree", "message": f"Revisa el nodo en: {diff}."})
    if not same_number(answer.get("value"), evaluate(expected)):
        errors.append({"where": "value", "message": "Revisa el valor de la expresión."})
    return Result(not errors, errors)