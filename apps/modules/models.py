import json
from django.db import models
from django.conf import settings
from apps.core.models import Semester
from django.core.exceptions import ValidationError
from apps.modules.registry import validate_exercise_data

# Create your models here.

# Modelo Ejercicio
class Exercise(models.Model):
    class Category(models.TextChoices):
        GRAPH = "graph", "Grafos"
        TREE = "tree", "Árboles binarios"

    class Kind(models.TextChoices):
        ADJACENCY_MATRIX = "adjacency_matrix", "Matriz de adyacencia y grados"
        DIJKSTRA = "dijkstra", "Dijkstra"
        MST = "mst", "Árbol de expansión mínima"
        CONNECTIVITY = "connectivity", "Conexidad y ciclos"
        COLORING = "coloring", "Coloreo de grafos"
        BST_BUILD = "bst_build", "Construcción de BST"
        TRAVERSAL = "traversal", "Recorridos"
        BALANCE = "balance", "Balanceo"
        TREE_METRICS = "tree_metrics", "Altura, profundidad y hojas"
        EXPRESSION_TREE = "expression_tree", "Árbol de expresión"

    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="exercises")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    title = models.CharField(max_length=150)
    statement = models.TextField()                      # enunciado
    category = models.CharField(max_length=10, choices=Category.choices)
    kind = models.CharField(max_length=30, choices=Kind.choices)
    data = models.JSONField(default=dict)               # grafo/árbol inicial
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    def clean(self):
        try:
            validate_exercise_data(self.kind, self.category, self.data)
        except ValueError as e:
            raise ValidationError({"data": str(e)})

    @property
    def data_pretty(self):
        return json.dumps(self.data, indent=2, ensure_ascii=False)

# Modelo intentos
class Attempt(models.Model):
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name="attempts")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts")
    answer = models.JSONField()
    is_correct = models.BooleanField()
    feedback = models.JSONField(default=dict)           # qué celdas/grados están mal
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        estado = "correcto" if self.is_correct else "incorrecto"
        return f"{self.student} - {self.exercise} ({estado})"

    @property
    def answer_pretty(self):
        return json.dumps(self.answer, indent=2, ensure_ascii=False)
