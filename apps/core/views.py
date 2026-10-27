from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.views import View
from django.views.generic import (CreateView, DeleteView, DetailView,
                                  ListView, TemplateView, UpdateView)
from apps.users.mixins import AdminRequiredMixin
from .forms import EnrollForm, SemesterForm
from .metrics import exercise_stats, student_stats, student_summary, teacher_summary
from .mixins import QueryStringMixin
from .models import Semester


# ---------- Dashboard ----------

class DashboardView(LoginRequiredMixin, TemplateView):
    def get_template_names(self):
        if self.request.user.is_teacher:
            return ["core/dashboard_admin.html"]
        return ["core/dashboard_student.html"]

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        if user.is_teacher:
            semester = self.selected_semester()
            context.update(
                semesters=Semester.objects.all(),
                semester=semester,
                summary=teacher_summary(semester),
                exercise_stats=exercise_stats(semester),
                student_stats=student_stats(semester),
            )
        else:
            context["summary"] = student_summary(user)
        return context

    def selected_semester(self):
        pk = self.request.GET.get("semester", "")
        return Semester.objects.filter(pk=pk).first() if pk.isdigit() else None


# ---------- Semestres (solo docente) ----------

class SemesterListView(AdminRequiredMixin, QueryStringMixin, ListView):
    template_name = "core/semester_list.html"
    context_object_name = "semesters"
    paginate_by = 10

    def get_queryset(self):
        return Semester.objects.annotate(
            students_count=Count("students", distinct=True),
            exercises_count=Count("exercises", distinct=True),
        ).order_by("-name")


class SemesterCreateView(AdminRequiredMixin, CreateView):
    form_class = SemesterForm
    template_name = "core/semester_form.html"
    success_url = reverse_lazy("core:semester_list")

    def form_valid(self, form):
        messages.success(self.request, "Semestre creado correctamente.")
        return super().form_valid(form)


class SemesterUpdateView(AdminRequiredMixin, UpdateView):
    model = Semester
    form_class = SemesterForm
    template_name = "core/semester_form.html"
    success_url = reverse_lazy("core:semester_list")

    def form_valid(self, form):
        messages.success(self.request, "Semestre actualizado correctamente.")
        return super().form_valid(form)


class SemesterDetailView(AdminRequiredMixin, DetailView):
    model = Semester
    template_name = "core/semester_detail.html"
    context_object_name = "semester"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        semester = self.object
        context["enrolled"] = semester.students.order_by("last_name", "first_name", "username")
        context["exercises"] = semester.exercises.all()
        context["enroll_form"] = EnrollForm(semester=semester)
        return context


class SemesterDeleteView(AdminRequiredMixin, DeleteView):
    model = Semester
    template_name = "core/semester_confirm_delete.html"
    context_object_name = "semester"
    success_url = reverse_lazy("core:semester_list")

    def form_valid(self, form):
        # Borrar un semestre eliminaría en cascada sus ejercicios y todos los intentos
        if self.object.exercises.exists():
            messages.error(
                self.request,
                "Este semestre tiene ejercicios. Desactívalo en lugar de eliminarlo.",
            )
            return redirect("core:semester_detail", pk=self.object.pk)
        messages.success(self.request, "Semestre eliminado.")
        return super().form_valid(form)


class SemesterEnrollView(AdminRequiredMixin, View):
    def post(self, request, pk):
        semester = get_object_or_404(Semester, pk=pk)
        form = EnrollForm(request.POST, semester=semester)
        if form.is_valid():
            students = form.cleaned_data["students"]
            semester.students.add(*students)
            messages.success(request, f"{len(students)} estudiante(s) inscrito(s).")
        else:
            messages.error(request, "Selecciona al menos un estudiante válido.")
        return redirect("core:semester_detail", pk=pk)


class SemesterRemoveStudentView(AdminRequiredMixin, View):
    def post(self, request, pk, student_pk):
        semester = get_object_or_404(Semester, pk=pk)
        student = get_object_or_404(semester.students, pk=student_pk)
        semester.students.remove(student)
        messages.success(request, f"{student.get_username()} fue retirado del semestre.")
        return redirect("core:semester_detail", pk=pk)