import math

from ..results import Result, same_number, to_int
from .algorithms import (UnionFind, adjacency_matrix, chromatic_number, degrees,
                         dijkstra, has_cycle, is_connected, kruskal,
                         normalize_edges)

MAX_VERTICES = 12


# ---------- Validación de los datos que crea el docente ----------

def _check_graph(data, weighted=False):
    vertices, edges = data.get("vertices"), data.get("edges")
    if not isinstance(vertices, list) or not isinstance(edges, list):
        raise ValueError("El grafo necesita 'vertices' y 'edges'.")
    if not 2 <= len(vertices) <= MAX_VERTICES:
        raise ValueError(f"El grafo debe tener entre 2 y {MAX_VERTICES} vértices.")
    if not all(isinstance(v, str) and v for v in vertices):
        raise ValueError("Los vértices deben ser textos no vacíos.")
    if len(set(vertices)) != len(vertices):
        raise ValueError("Hay vértices repetidos.")

    seen = set()
    expected_len = 3 if weighted else 2
    for edge in edges:
        if not isinstance(edge, list) or len(edge) != expected_len:
            raise ValueError("Cada arista debe ser [u, v, peso]." if weighted
                             else "Cada arista debe ser [u, v] (sin pesos).")
        u, v = edge[0], edge[1]
        if u not in vertices or v not in vertices:
            raise ValueError(f"La arista {u}-{v} usa un vértice que no existe.")
        if u == v:
            raise ValueError(f"No se permiten lazos ({u}-{u}).")
        key = frozenset((u, v))
        if key in seen:
            raise ValueError(f"La arista {u}-{v} está repetida.")
        seen.add(key)
        if weighted:
            w = edge[2]
            if isinstance(w, bool) or not isinstance(w, (int, float)) or w <= 0:
                raise ValueError("Los pesos deben ser números positivos.")
    _check_positions(data)


def validate_adjacency_matrix_data(data):
    _check_graph(data)
    vertices = data["vertices"]
    if not 4 <= len(vertices) <= 6:
        raise ValueError("Este ejercicio requiere entre 4 y 6 vértices.")
    if not all(len(v) == 1 and "A" <= v <= "Z" for v in vertices):
        raise ValueError("Los vértices deben ser letras mayúsculas (A, B, C...).")


def validate_dijkstra_data(data):
    _check_graph(data, weighted=True)
    source, target = data.get("source"), data.get("target")
    if source not in data["vertices"] or target not in data["vertices"]:
        raise ValueError("Origen y destino deben ser vértices del grafo.")
    if source == target:
        raise ValueError("Origen y destino deben ser distintos.")
    dist, _ = dijkstra(data["vertices"], data["edges"], source)
    if math.isinf(dist[target]):
        raise ValueError("No existe camino entre el origen y el destino.")


def validate_mst_data(data):
    _check_graph(data, weighted=True)
    if not is_connected(data["vertices"], data["edges"]):
        raise ValueError("El grafo debe ser conexo para tener árbol de expansión.")


def validate_connectivity_data(data):
    _check_graph(data)


def validate_coloring_data(data):
    _check_graph(data)
    max_colors = data.get("max_colors")
    if max_colors is not None and (not isinstance(max_colors, int) or max_colors < 1):
        raise ValueError("'max_colors' debe ser un entero mayor o igual a 1.")


# ---------- Corrección de la respuesta del estudiante ----------

def check_adjacency_matrix(data, answer):
    vertices, edges = data["vertices"], data["edges"]
    expected_matrix = adjacency_matrix(vertices, edges)
    expected_degrees = degrees(vertices, edges)
    given, given_degrees = answer["matrix"], answer["degrees"]
    n = len(vertices)

    if len(given) != n or any(len(row) != n for row in given):
        return Result(False, [{"where": "matrix",
                               "message": f"La matriz debe ser de {n} x {n}."}])
    errors = []
    for i, row_v in enumerate(vertices):
        for j, col_v in enumerate(vertices):
            if to_int(given[i][j]) != expected_matrix[i][j]:
                errors.append({"where": f"cell:{row_v}:{col_v}",
                               "message": f"Revisa la celda ({row_v}, {col_v}): está vacía o es incorrecta."})
    for v in vertices:
        if to_int(given_degrees.get(v)) != expected_degrees[v]:
            errors.append({"where": f"degree:{v}",
                           "message": f"Revisa el grado del vértice {v}."})
    return Result(not errors, errors)


def check_dijkstra(data, answer):
    vertices, edges = data["vertices"], data["edges"]
    source, target = data["source"], data["target"]
    dist, _ = dijkstra(vertices, edges, source)
    best = dist[target]
    weights = {frozenset((u, v)): w for u, v, w in normalize_edges(edges)}
    path = answer["path"]
    errors = []

    if not path or path[0] != source or path[-1] != target:
        errors.append({"where": "path",
                       "message": f"El camino debe empezar en {source} y terminar en {target}."})
    else:
        cost, valid = 0, True
        for a, b in zip(path, path[1:]):
            w = weights.get(frozenset((a, b)))
            if w is None:
                errors.append({"where": "path", "message": f"No existe la arista {a}-{b}."})
                valid = False
                break
            cost += w
        if valid and not math.isclose(cost, best):
            errors.append({"where": "path",
                           "message": "El camino es válido, pero no es el más corto."})
    if not same_number(answer.get("distance"), best):
        errors.append({"where": "distance", "message": "Revisa la distancia total."})
    return Result(not errors, errors)


def check_mst(data, answer):
    vertices, edges = data["vertices"], data["edges"]
    _, best = kruskal(vertices, edges)
    weights = {frozenset((u, v)): w for u, v, w in normalize_edges(edges)}
    errors, keys = [], []

    for edge in answer["edges"]:
        key = frozenset((edge[0], edge[1]))
        if key not in weights:
            errors.append({"where": "edges",
                           "message": f"La arista {edge[0]}-{edge[1]} no existe en el grafo."})
        keys.append(key)

    if not errors:
        if len(set(keys)) != len(keys):
            errors.append({"where": "edges", "message": "Hay aristas repetidas."})
        elif len(keys) != len(vertices) - 1:
            errors.append({"where": "edges",
                           "message": f"Un árbol de expansión de {len(vertices)} vértices tiene {len(vertices) - 1} aristas."})
        else:
            uf = UnionFind(vertices)
            if not all(uf.union(*tuple(k)) for k in keys):
                errors.append({"where": "edges", "message": "Las aristas elegidas forman un ciclo."})
            elif not math.isclose(sum(weights[k] for k in keys), best):
                errors.append({"where": "edges",
                               "message": "Es un árbol de expansión, pero no es de peso mínimo."})
    if not same_number(answer.get("total"), best):
        errors.append({"where": "total", "message": "Revisa el peso total."})
    return Result(not errors, errors)


def check_connectivity(data, answer):
    vertices, edges = data["vertices"], data["edges"]
    errors = []
    if answer.get("connected") != is_connected(vertices, edges):
        errors.append({"where": "connected", "message": "Revisa si el grafo es conexo."})
    if answer.get("has_cycle") != has_cycle(vertices, edges):
        errors.append({"where": "has_cycle", "message": "Revisa si el grafo tiene ciclos."})
    return Result(not errors, errors)


def check_coloring(data, answer):
    vertices, edges = data["vertices"], data["edges"]
    colors = answer["colors"]
    missing = [v for v in vertices if colors.get(v) in (None, "")]
    if missing:
        return Result(False, [{"where": "colors",
                               "message": f"Falta asignar color a: {', '.join(missing)}."}])
    errors = []
    for u, v, _ in normalize_edges(edges):
        if colors[u] == colors[v]:
            errors.append({"where": f"edge:{u}:{v}",
                           "message": f"{u} y {v} son adyacentes y tienen el mismo color."})
    if not errors:
        used = len({colors[v] for v in vertices})
        max_colors = data.get("max_colors")
        if max_colors:
            if used > max_colors:
                errors.append({"where": "colors",
                               "message": f"El enunciado permite máximo {max_colors} colores."})
        elif used > chromatic_number(vertices, edges):
            errors.append({"where": "colors",
                           "message": "El coloreo es válido, pero se puede usar menos colores."})
    return Result(not errors, errors)


# Mismos límites que el lienzo del editor (graph-view.js)
CANVAS_WIDTH = 480
CANVAS_HEIGHT = 360


def _check_positions(data):
    """'positions' es opcional; si viene, debe tener coordenadas numéricas dentro del lienzo."""
    positions = data.get("positions")
    if positions is None:
        return
    if not isinstance(positions, dict):
        raise ValueError("'positions' debe ser un objeto.")

    for vertex, point in positions.items():
        if vertex not in data["vertices"]:
            raise ValueError(f"'positions' incluye un vértice que no existe: {vertex}.")
        if not isinstance(point, dict):
            raise ValueError(f"La posición de {vertex} debe tener x e y.")
        for axis, limit in (("x", CANVAS_WIDTH), ("y", CANVAS_HEIGHT)):
            value = point.get(axis)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= limit:
                raise ValueError(f"La coordenada {axis} de {vertex} debe ser un número entre 0 y {limit}.")