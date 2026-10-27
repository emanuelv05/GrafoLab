from django.urls import path
from . import views

app_name = "modules"

urlpatterns = [
    # Docente
    path("manage/", views.ExerciseListView.as_view(), name="manage_list"),
    path("manage/new/", views.ExerciseCreateView.as_view(), name="manage_create"),
    path("manage/<int:pk>/", views.ExerciseDetailView.as_view(), name="manage_detail"),
    path("manage/<int:pk>/edit/", views.ExerciseUpdateView.as_view(), name="manage_update"),
    path("manage/<int:pk>/delete/", views.ExerciseDeleteView.as_view(), name="manage_delete"),
    path("manage/<int:pk>/attempts/", views.ExerciseAttemptListView.as_view(), name="manage_attempts"),

    # Estudiante
    path("exercises/", views.StudentExerciseListView.as_view(), name="exercise_list"),
    path("exercises/<int:pk>/", views.StudentExerciseDetailView.as_view(), name="exercise_solve"),
    path("exercises/<int:pk>/submit/", views.SubmitAnswerView.as_view(), name="exercise_submit"),
    path("history/", views.StudentAttemptListView.as_view(), name="attempt_list"),
]