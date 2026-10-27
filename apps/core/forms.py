import re
from django import forms
from django.contrib.auth import get_user_model
from .models import Semester

User = get_user_model()

# Formulario para semestre
class SemesterForm(forms.ModelForm):
    class Meta:
        model = Semester
        fields = ["name", "is_active"]

    def clean_name(self):
        name = self.cleaned_data["name"].strip()
        if not re.fullmatch(r"\d{4}-[12]", name):
            raise forms.ValidationError("Usa el formato AAAA-1 o AAAA-2, por ejemplo 2026-2.")
        return name


class StudentChoiceField(forms.ModelMultipleChoiceField):
    def label_from_instance(self, user):
        return f"{user.get_full_name() or user.username} ({user.email or user.username})"


class EnrollForm(forms.Form):
    students = StudentChoiceField(
        queryset=User.objects.none(),
        widget=forms.CheckboxSelectMultiple,
        label="Estudiantes disponibles",
    )

    def __init__(self, *args, semester, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["students"].queryset = (
            User.objects.filter(role=User.Role.STUDENT, is_active=True)
            .exclude(semesters=semester)
            .order_by("last_name", "first_name", "username")
        )