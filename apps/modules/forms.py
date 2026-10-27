from django import forms
from .models import Exercise

# Formulario para crear/editar ejercicios
class ExerciseForm(forms.ModelForm):
    data = forms.JSONField(
        label="Datos del ejercicio (JSON)",
        widget=forms.Textarea(attrs={"rows": 12, "spellcheck": "false", "class": "code-input"}),
        help_text="Se completa al dibujar. También puedes editarlo a mano.",    
    )
    class Meta:
        model = Exercise
        fields = ["semester", "title", "statement", "category", "kind", "data", "is_published"]
        widgets = {"statement": forms.Textarea(attrs={"rows": 4})}

