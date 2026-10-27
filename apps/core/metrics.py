from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from apps.modules.models import Attempt, Exercise
from apps.modules.selectors import visible_exercises

User = get_user_model()


def percentage(part, total):
    return round(part * 100 / total, 1) if total else 0.0


def teacher_summary(semester=None):
    attempts = Attempt.objects.all()
    exercises = Exercise.objects.all()
    students = User.objects.filter(role=User.Role.STUDENT)
    if semester:
        attempts = attempts.filter(exercise__semester=semester)
        exercises = exercises.filter(semester=semester)
        students = students.filter(semesters=semester)

    total = attempts.count()
    correct = attempts.filter(is_correct=True).count()
    return {
        "students": students.count(),
        "exercises": exercises.count(),
        "published": exercises.filter(is_published=True).count(),
        "attempts": total,
        "correct": correct,
        "accuracy": percentage(correct, total),
    }


def exercise_stats(semester=None):
    """Intentos y % de aciertos por ejercicio."""
    exercises = Exercise.objects.select_related("semester")
    if semester:
        exercises = exercises.filter(semester=semester)
    exercises = exercises.annotate(
        attempts_count=Count("attempts"),
        correct_count=Count("attempts", filter=Q(attempts__is_correct=True)),
        students_count=Count("attempts__student", distinct=True),
    )
    rows = list(exercises)
    for row in rows:
        row.accuracy = percentage(row.correct_count, row.attempts_count)
    return rows


def student_stats(semester=None):
    """Intentos, aciertos y ejercicios resueltos por estudiante."""
    students = User.objects.filter(role=User.Role.STUDENT)
    scope = Q()
    if semester:
        students = students.filter(semesters=semester)
        scope = Q(attempts__exercise__semester=semester)

    students = students.annotate(
        attempts_count=Count("attempts", filter=scope),
        correct_count=Count("attempts", filter=scope & Q(attempts__is_correct=True)),
        solved_count=Count("attempts__exercise",
                           filter=scope & Q(attempts__is_correct=True), distinct=True),
    ).order_by("last_name", "first_name", "username")

    rows = list(students)
    for row in rows:
        row.accuracy = percentage(row.correct_count, row.attempts_count)
    return rows


def student_summary(user):
    """Resumen del propio estudiante para su dashboard."""
    available = visible_exercises(user)
    attempts = Attempt.objects.filter(student=user)

    total = attempts.count()
    correct = attempts.filter(is_correct=True).count()
    available_count = available.count()
    solved = (attempts.filter(is_correct=True, exercise__in=available)
              .values("exercise").distinct().count())
    return {
        "available": available_count,
        "solved": solved,
        "pending": available_count - solved,
        "progress": percentage(solved, available_count),
        "attempts": total,
        "correct": correct,
        "accuracy": percentage(correct, total),
        "recent": list(attempts.select_related("exercise")[:5]),
    }