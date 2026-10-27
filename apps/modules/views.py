import json
from django.db.models import Count, Q
from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse_lazy
from django.utils.functional import cached_property
from django.views import View
from django.views.generic import (CreateView, DeleteView, DetailView, ListView, UpdateView)
from django.db.models import Count
from apps.core.mixins import QueryStringMixin
from apps.core.models import Semester
from apps.users.mixins import AdminRequiredMixin, StudentRequiredMixin
from .forms import ExerciseForm
from .models import Attempt, Exercise
from .registry import evaluate_answer

MAX_ANSWER_BYTES = 100_000

def visible_exercises(user):
    """Ejercicios que un estudiante puede ver: publicados y de sus semestres activos."""
    return (Exercise.objects
            .filter(is_published=True, semester__is_active=True, semester__students=user)
            .select_related("semester"))


# ---------- Docente: gestión de ejercicios ----------

class ExerciseListView(AdminRequiredMixin, ListView):
    template_name = "modules/manage_list.html"
    context_object_name = "exercises"
    paginate_by = 10

    def get_queryset(self):
        queryset = (Exercise.objects.select_related("semester").annotate(attempts_count=Count("attempts")).order_by("-created_at", "-pk"))      
        semester = self.request.GET.get("semester")
        category = self.request.GET.get("category")
        if semester:
            queryset = queryset.filter(semester_id=semester)
        if category in Exercise.Category.values:
            queryset = queryset.filter(category=category)
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["semesters"] = Semester.objects.all()
        context["categories"] = Exercise.Category.choices
        return context


class ExerciseCreateView(AdminRequiredMixin, CreateView):
    form_class = ExerciseForm
    template_name = "modules/exercise_form.html"
    success_url = reverse_lazy("modules:manage_list")

    def form_valid(self, form):
        form.instance.created_by = self.request.user
        messages.success(self.request, "Ejercicio creado correctamente.")
        return super().form_valid(form)


class ExerciseDetailView(AdminRequiredMixin, DetailView):
    model = Exercise
    template_name = "modules/manage_detail.html"
    context_object_name = "exercise"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        attempts = self.object.attempts
        total = attempts.count()
        correct = attempts.filter(is_correct=True).count()
        context["stats"] = {
            "attempts": total,
            "correct": correct,
            "students": attempts.values("student").distinct().count(),
            "accuracy": round(correct * 100 / total, 1) if total else 0.0,
        }
        return context


class ExerciseUpdateView(AdminRequiredMixin, UpdateView):
    model = Exercise
    form_class = ExerciseForm
    template_name = "modules/exercise_form.html"
    success_url = reverse_lazy("modules:manage_list")

    def form_valid(self, form):
        messages.success(self.request, "Ejercicio actualizado correctamente.")
        return super().form_valid(form)


class ExerciseDeleteView(AdminRequiredMixin, DeleteView):
    model = Exercise
    template_name = "modules/exercise_confirm_delete.html"
    context_object_name = "exercise"
    success_url = reverse_lazy("modules:manage_list")

    def form_valid(self, form):
        messages.success(self.request, "Ejercicio eliminado.")
        return super().form_valid(form)


class ExerciseAttemptListView(AdminRequiredMixin, ListView):
    """El docente ve las respuestas de los estudiantes a un ejercicio."""
    template_name = "modules/manage_attempts.html"
    context_object_name = "attempts"
    paginate_by = 20

    @cached_property
    def exercise(self):
        return get_object_or_404(Exercise, pk=self.kwargs["pk"])

    def get_queryset(self):
        return self.exercise.attempts.select_related("student")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["exercise"] = self.exercise
        return context


# ---------- Estudiante: resolver ejercicios ----------

class StudentExerciseListView(StudentRequiredMixin, QueryStringMixin, ListView):   # ← QueryStringMixin
    template_name = "modules/exercise_list.html"
    context_object_name = "exercises"
    paginate_by = 9

    def get_queryset(self):
        user = self.request.user
        queryset = visible_exercises(user).annotate(
            my_attempts=Count("attempts", filter=Q(attempts__student=user)),
            my_correct=Count("attempts", filter=Q(attempts__student=user, attempts__is_correct=True)),
        ).order_by("-created_at", "-pk")
        category = self.request.GET.get("category")
        if category in Exercise.Category.values:
            queryset = queryset.filter(category=category)
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["categories"] = Exercise.Category.choices
        return context


class StudentExerciseDetailView(StudentRequiredMixin, DetailView):
    template_name = "modules/exercise_solve.html"
    context_object_name = "exercise"

    def get_queryset(self):
        return visible_exercises(self.request.user)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["last_attempts"] = self.object.attempts.filter(student=self.request.user)[:5]
        return context


class SubmitAnswerView(StudentRequiredMixin, View):
    """Recibe la respuesta por fetch (JSON), la corrige y guarda el intento."""

    def post(self, request, pk):
        exercise = get_object_or_404(visible_exercises(request.user), pk=pk)

        if len(request.body) > MAX_ANSWER_BYTES:
            return JsonResponse({"success": False, "error": "La respuesta es demasiado grande."}, status=413)
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "error": "JSON inválido."}, status=400)

        answer = payload.get("answer") if isinstance(payload, dict) else None
        if not isinstance(answer, dict):
            return JsonResponse({"success": False, "error": "Falta la respuesta."}, status=400)

        result = evaluate_answer(exercise.kind, exercise.data, answer)
        Attempt.objects.create(
            exercise=exercise,
            student=request.user,
            answer=answer,
            is_correct=result.is_correct,
            feedback=result.as_dict(),
        )
        return JsonResponse({"success": True, **result.as_dict()})


class StudentAttemptListView(StudentRequiredMixin, ListView):
    """Historial de intentos del propio estudiante."""
    template_name = "modules/attempt_list.html"
    context_object_name = "attempts"
    paginate_by = 20

    def get_queryset(self):
        return Attempt.objects.filter(student=self.request.user).select_related("exercise")