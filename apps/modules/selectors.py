from .models import Exercise


def visible_exercises(user):
    """Ejercicios que un estudiante puede ver: publicados y de sus semestres activos."""
    return (Exercise.objects
            .filter(is_published=True, semester__is_active=True, semester__students=user)
            .select_related("semester"))