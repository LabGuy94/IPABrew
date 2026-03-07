import math


CALIBRATION_DATES = {
    "Romance from Latin": {"years": 1750, "range": (1500, 2000)},
    "Proto-Germanic": {"years": 2500, "range": (2300, 2700)},
    "Balto-Slavic": {"years": 3500, "range": (3000, 4000)},
    "Proto-Indo-European (Steppe)": {"years": 6000, "range": (5500, 6500)},
    "Austronesian": {"years": 5200, "range": (4800, 5600)},
}

NED_DIVERGENCE_TABLE = [
    {"ned_min": 0.0, "ned_max": 0.1, "years_min": 0, "years_max": 500, "label": "Dialects"},
    {"ned_min": 0.1, "ned_max": 0.3, "years_min": 500, "years_max": 1500, "label": "Romance languages"},
    {"ned_min": 0.3, "ned_max": 0.5, "years_min": 1500, "years_max": 3000, "label": "Germanic family"},
    {"ned_min": 0.5, "ned_max": 0.7, "years_min": 3000, "years_max": 5000, "label": "IE subfamilies"},
    {"ned_min": 0.7, "ned_max": 1.0, "years_min": 5000, "years_max": 10000, "label": "Deep/uncertain"},
]


def estimate_divergence_years(cognate_pct, retention_rate=0.86):
    if cognate_pct <= 0 or cognate_pct >= 1:
        return None
    return (math.log(cognate_pct) / (2 * math.log(retention_rate))) * 1000


def estimate_from_ned(ned):
    if ned < 0:
        ned = 0
    if ned > 1:
        ned = 1

    for entry in NED_DIVERGENCE_TABLE:
        if entry["ned_min"] <= ned < entry["ned_max"]:
            frac = (ned - entry["ned_min"]) / (entry["ned_max"] - entry["ned_min"])
            years = entry["years_min"] + frac * (entry["years_max"] - entry["years_min"])
            return {
                "estimated_years": round(years),
                "range": (entry["years_min"], entry["years_max"]),
                "category": entry["label"],
                "ned": round(ned, 4),
            }

    return {
        "estimated_years": 10000,
        "range": (5000, 10000),
        "category": "Deep/uncertain",
        "ned": round(ned, 4),
    }


def retention_curve():
    points = []
    for years in range(0, 10001, 500):
        pct = 0.86 ** (2 * years / 1000)
        points.append({"years": years, "cognate_pct": round(pct, 4)})
    return points


def get_calibration_dates():
    return CALIBRATION_DATES
