import re

MAX_NODES = 63


def make_node(value, left=None, right=None):
    return {"value": value, "left": left, "right": right}


def clean_tree(node):
    """Valida la forma de un árbol anidado y lo normaliza."""
    count = [0]

    def walk(n):
        if n is None:
            return None
        if not isinstance(n, dict) or "value" not in n:
            raise ValueError("El árbol tiene un formato inválido.")
        count[0] += 1
        if count[0] > MAX_NODES:
            raise ValueError(f"El árbol no puede tener más de {MAX_NODES} nodos.")
        return {"value": n["value"], "left": walk(n.get("left")), "right": walk(n.get("right"))}

    return walk(node)


# ---------- BST y recorridos ----------

def bst_insert(root, value):
    if root is None:
        return make_node(value)
    if value < root["value"]:
        root["left"] = bst_insert(root["left"], value)
    elif value > root["value"]:
        root["right"] = bst_insert(root["right"], value)
    return root  # los duplicados se ignoran


def build_bst(values):
    root = None
    for value in values:
        root = bst_insert(root, value)
    return root


def inorder(node):
    return [] if node is None else inorder(node["left"]) + [node["value"]] + inorder(node["right"])


def preorder(node):
    return [] if node is None else [node["value"]] + preorder(node["left"]) + preorder(node["right"])


def postorder(node):
    return [] if node is None else postorder(node["left"]) + postorder(node["right"]) + [node["value"]]


ORDERS = {"inorder": inorder, "preorder": preorder, "postorder": postorder}


# ---------- Propiedades ----------

def height(node):
    return -1 if node is None else 1 + max(height(node["left"]), height(node["right"]))


def count_leaves(node):
    if node is None:
        return 0
    if node["left"] is None and node["right"] is None:
        return 1
    return count_leaves(node["left"]) + count_leaves(node["right"])


def depth_of(node, value, depth=0):
    if node is None:
        return None
    if node["value"] == value:
        return depth
    found = depth_of(node["left"], value, depth + 1)
    return found if found is not None else depth_of(node["right"], value, depth + 1)


def is_balanced(node):
    """Balanceado: en cada nodo, las alturas de sus subárboles difieren como máximo en 1."""
    def check(n):
        if n is None:
            return True, -1
        left_ok, left_h = check(n["left"])
        right_ok, right_h = check(n["right"])
        return left_ok and right_ok and abs(left_h - right_h) <= 1, 1 + max(left_h, right_h)

    return check(node)[0]


def first_difference(a, b, path="raíz"):
    """Ruta del primer nodo que difiere, o None si los árboles son iguales."""
    if a is None and b is None:
        return None
    if a is None or b is None or str(a["value"]) != str(b["value"]):
        return path
    return (first_difference(a["left"], b["left"], path + " → izq")
            or first_difference(a["right"], b["right"], path + " → der"))


# ---------- Expresiones aritméticas ----------

TOKEN_RE = re.compile(r"\s*(\d+(?:\.\d+)?|[+\-*/()])")


def tokenize(expression):
    expression = expression.strip()
    tokens, pos = [], 0
    while pos < len(expression):
        match = TOKEN_RE.match(expression, pos)
        if not match:
            raise ValueError(f"Carácter no válido en la posición {pos + 1}.")
        tokens.append(match.group(1))
        pos = match.end()
    return tokens


def parse_expression(expression):
    """Soporta números, + - * / y paréntesis (sin signo unario)."""
    tokens = tokenize(expression)
    position = 0

    def peek():
        return tokens[position] if position < len(tokens) else None

    def advance():
        nonlocal position
        token = peek()
        position += 1
        return token

    def parse_binary(operators, parse_operand):
        node = parse_operand()
        while peek() in operators:
            op = advance()
            node = make_node(op, node, parse_operand())
        return node

    def parse_factor():
        token = advance()
        if token is None:
            raise ValueError("La expresión está incompleta.")
        if token == "(":
            node = parse_expr()
            if advance() != ")":
                raise ValueError("Falta cerrar un paréntesis.")
            return node
        if token in ("+", "-", "*", "/", ")"):
            raise ValueError(f"Símbolo inesperado: {token}")
        return make_node(token)

    def parse_term():
        return parse_binary(("*", "/"), parse_factor)

    def parse_expr():
        return parse_binary(("+", "-"), parse_term)

    tree = parse_expr()
    if position != len(tokens):
        raise ValueError("La expresión está mal formada.")
    return tree


def evaluate(node):
    if node["left"] is None and node["right"] is None:
        return float(node["value"])
    a, b = evaluate(node["left"]), evaluate(node["right"])
    op = node["value"]
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op == "/":
        if b == 0:
            raise ValueError("División entre cero.")
        return a / b
    raise ValueError(f"Operador desconocido: {op}")