import heapq
import math


def normalize_edges(edges):
    """[["A","B"], ["B","C",4]] -> [("A","B",1), ("B","C",4)]"""
    return [(e[0], e[1], e[2] if len(e) > 2 else 1) for e in edges]


def adjacency_list(vertices, edges):
    graph = {v: [] for v in vertices}
    for u, v, w in normalize_edges(edges):
        graph[u].append((v, w))
        graph[v].append((u, w))
    return graph


def adjacency_matrix(vertices, edges):
    index = {v: i for i, v in enumerate(vertices)}
    n = len(vertices)
    matrix = [[0] * n for _ in range(n)]
    for u, v, _ in normalize_edges(edges):
        matrix[index[u]][index[v]] = 1
        matrix[index[v]][index[u]] = 1
    return matrix


def degrees(vertices, edges):
    matrix = adjacency_matrix(vertices, edges)
    return {v: sum(row) for v, row in zip(vertices, matrix)}


class UnionFind:
    def __init__(self, items):
        self.parent = {i: i for i in items}

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        self.parent[ra] = rb
        return True


def is_connected(vertices, edges):
    if not vertices:
        return True
    graph = adjacency_list(vertices, edges)
    seen = {vertices[0]}
    stack = [vertices[0]]
    while stack:
        current = stack.pop()
        for neighbor, _ in graph[current]:
            if neighbor not in seen:
                seen.add(neighbor)
                stack.append(neighbor)
    return len(seen) == len(vertices)


def has_cycle(vertices, edges):
    uf = UnionFind(vertices)
    for u, v, _ in normalize_edges(edges):
        if not uf.union(u, v):
            return True
    return False


def dijkstra(vertices, edges, source):
    graph = adjacency_list(vertices, edges)
    dist = {v: math.inf for v in vertices}
    prev = {}
    dist[source] = 0
    heap = [(0, source)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        for v, w in graph[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                prev[v] = u
                heapq.heappush(heap, (nd, v))
    return dist, prev


def shortest_path(vertices, edges, source, target):
    dist, prev = dijkstra(vertices, edges, source)
    if math.isinf(dist[target]):
        return None, []
    path = [target]
    while path[-1] != source:
        path.append(prev[path[-1]])
    return dist[target], path[::-1]


def kruskal(vertices, edges):
    uf = UnionFind(vertices)
    mst, total = [], 0
    for u, v, w in sorted(normalize_edges(edges), key=lambda e: e[2]):
        if uf.union(u, v):
            mst.append((u, v, w))
            total += w
    return mst, total


def chromatic_number(vertices, edges):
    """Mínimo de colores (backtracking; válido para grafos pequeños)."""
    graph = adjacency_list(vertices, edges)
    order = sorted(vertices, key=lambda v: -len(graph[v]))

    def can_color(k):
        assignment = {}

        def backtrack(i):
            if i == len(order):
                return True
            v = order[i]
            used = {assignment[n] for n, _ in graph[v] if n in assignment}
            for c in range(k):
                if c not in used:
                    assignment[v] = c
                    if backtrack(i + 1):
                        return True
                    del assignment[v]
            return False

        return backtrack(0)

    for k in range(1, len(vertices) + 1):
        if can_color(k):
            return k
    return 0