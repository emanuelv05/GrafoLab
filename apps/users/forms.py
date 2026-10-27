from django import forms
from django.conf import settings
from django.contrib.auth.forms import UserCreationForm
from .models import User


class InstitutionalEmailMixin:
    """Exige correo institucional y que no esté repetido."""

    def clean_email(self):
        domain = settings.INSTITUTIONAL_EMAIL_DOMAIN
        email = self.cleaned_data["email"].strip().lower()
        if not email.endswith(f"@{domain}"):
            raise forms.ValidationError(f"Usa tu correo institucional (@{domain}).")
        if User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk).exists():
            raise forms.ValidationError("Ya existe una cuenta con ese correo.")
        return email


# Formulario para el registro de usuario
class UserForm(InstitutionalEmailMixin, UserCreationForm):
    email = forms.EmailField(required=True, label="Correo institucional")

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "first_name", "last_name", "email")


# Formulario del perfil
class ProfileForm(InstitutionalEmailMixin, forms.ModelForm):
    email = forms.EmailField(required=True, label="Correo institucional")

    class Meta:
        model = User
        fields = ("first_name", "last_name", "email")