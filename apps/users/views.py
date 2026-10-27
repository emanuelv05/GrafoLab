from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import LoginView
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.views import View
from django.views.generic import (CreateView, DeleteView, DetailView,
                                  ListView, UpdateView)

from .forms import ProfileForm, UserForm
from .mixins import AdminRequiredMixin
from .models import User
from apps.core.metrics import student_summary


# ---------- Autenticación ----------

class SignupView(CreateView):
    form_class = UserForm
    template_name = "signup.html"
    success_url = reverse_lazy("users:signin")

    def form_valid(self, form):
        messages.success(self.request, "Usuario registrado exitosamente.")
        return super().form_valid(form)


class SigninView(LoginView):
    template_name = "signin.html"
    redirect_authenticated_user = True


class SignoutView(LoginRequiredMixin, View):
    def post(self, request):
        logout(request)
        return redirect("users:signin")


# ---------- Perfil propio (admin y estudiante) ----------

class ProfileView(LoginRequiredMixin, DetailView):
    template_name = "users/profile.html"

    def get_object(self, queryset=None):
        return self.request.user


class ProfileUpdateView(LoginRequiredMixin, UpdateView):
    form_class = ProfileForm
    template_name = "users/update_profile.html"
    success_url = reverse_lazy("users:profile")

    def get_object(self, queryset=None):
        return self.request.user

    def form_valid(self, form):
        messages.success(self.request, "Perfil actualizado correctamente.")
        return super().form_valid(form)


# ---------- Gestión de estudiantes (solo admin) ----------

class StudentQuerysetMixin(AdminRequiredMixin):
    def get_queryset(self):
        return (User.objects.filter(role=User.Role.STUDENT).order_by("last_name", "first_name", "username"))


class StudentListView(StudentQuerysetMixin, ListView):
    template_name = "users/student_list.html"
    context_object_name = "students"
    paginate_by = 10


class StudentDetailView(StudentQuerysetMixin, DetailView):
    template_name = "users/student_detail.html"
    context_object_name = "student"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["summary"] = student_summary(self.object)
        context["semesters"] = self.object.semesters.all()
        return context

class StudentUpdateView(StudentQuerysetMixin, UpdateView):
    form_class = ProfileForm
    template_name = "users/student_update.html"
    context_object_name = "student"          
    success_url = reverse_lazy("users:student_list")

    def form_valid(self, form):
        messages.success(self.request, "Estudiante actualizado correctamente.")
        return super().form_valid(form)


class StudentDeleteView(StudentQuerysetMixin, DeleteView):
    template_name = "users/student_confirm_delete.html"
    context_object_name = "student"
    success_url = reverse_lazy("users:student_list")

    def form_valid(self, form):
        messages.success(self.request, "Estudiante eliminado.")
        return super().form_valid(form)


class UserToggleActiveView(AdminRequiredMixin, View):
    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk, role=User.Role.STUDENT)
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        return JsonResponse({"success": True, "is_active": user.is_active})