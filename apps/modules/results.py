import math
from dataclasses import dataclass, field


@dataclass
class Result:
    is_correct: bool
    errors: list = field(default_factory=list)  # [{"where": "...", "message": "..."}]

    def as_dict(self):
        return {"is_correct": self.is_correct, "errors": self.errors}


def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def to_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(number) else number


def same_number(given, expected):
    number = to_number(given)
    return number is not None and math.isclose(number, expected, abs_tol=1e-9)