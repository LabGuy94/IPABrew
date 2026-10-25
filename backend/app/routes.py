import math

from flask import Blueprint, jsonify, request

from app.reconstruction import (
    get_sample,
    search_dataset,
    align_words,
    reconstruct_from_cognates,
    reconstruct_from_dataset_entry,
    reconstruct_tree,
)
from app.ipa_utils import ipa_distance_report, get_features
from app.services import dpd_service
from app.glottochronology import (
    estimate_divergence_years,
    estimate_from_ned,
    retention_curve,
    get_calibration_dates,
)

api = Blueprint("api", __name__)


VALID_METHODS = ("ml", "algorithm")


def _json_object():
    """Return the request's JSON body if it is an object, else None."""
    data = request.get_json()
    return data if isinstance(data, dict) else None


def _is_string_list(value):
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def _parse_float_value(value, field_name):
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = math.nan
    if not math.isfinite(number):
        return None, (jsonify({"error": f"Field '{field_name}' must be a number"}), 400)
    return number, None


def _validate_open_unit_interval(value, field_name):
    if 0 < value < 1:
        return None
    return jsonify({"error": f"Field '{field_name}' must be greater than 0 and less than 1"}), 400


@api.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@api.route("/dataset/sample", methods=["GET"])
def dataset_sample():
    count = request.args.get("count", 20, type=int)
    offset = request.args.get("offset", 0, type=int)
    if count < 0 or offset < 0:
        return jsonify({"error": "Parameters 'count' and 'offset' must be non-negative"}), 400
    count = min(count, 100)
    return jsonify(get_sample(count, offset))


@api.route("/dataset/search", methods=["GET"])
def dataset_search():
    query = request.args.get("q", "")
    limit = request.args.get("limit", 20, type=int)
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400
    if limit < 0:
        return jsonify({"error": "Parameter 'limit' must be non-negative"}), 400
    return jsonify(search_dataset(query, min(limit, 100)))


@api.route("/reconstruct", methods=["POST"])
def reconstruct():
    data = _json_object()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    if "index" in data:
        try:
            index = int(data["index"])
        except (TypeError, ValueError):
            return jsonify({"error": "Field 'index' must be an integer"}), 400
        result = reconstruct_from_dataset_entry(index)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result)

    words = data.get("words", [])
    languages = data.get("languages", [])
    if not _is_string_list(words):
        return jsonify({"error": "Field 'words' must be a list of strings"}), 400
    if languages is not None and not _is_string_list(languages):
        return jsonify({"error": "Field 'languages' must be a list of strings"}), 400
    if len(words) < 2:
        return jsonify({"error": "Need at least 2 cognate words"}), 400

    result = reconstruct_from_cognates(words, languages if languages else None)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@api.route("/reconstruct_tree", methods=["POST"])
def reconstruct_tree_route():
    data = _json_object()
    if not data or "tree" not in data:
        return jsonify({"error": "JSON body with 'tree' field required"}), 400

    tree = data["tree"]
    if not isinstance(tree, dict):
        return jsonify({"error": "Field 'tree' must be an object"}), 400
    method = data.get("method", "ml")
    if method not in VALID_METHODS:
        return jsonify({"error": f"Field 'method' must be one of: {', '.join(VALID_METHODS)}"}), 400

    tree = dict(tree)
    tree["_is_root"] = True
    result = reconstruct_tree(tree, method=method)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)



@api.route("/model/status", methods=["GET"])
def model_status():
    return jsonify({"available": dpd_service.is_available()})

@api.route("/align", methods=["POST"])
def align():
    data = _json_object()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    words = data.get("words", [])
    if not _is_string_list(words):
        return jsonify({"error": "Field 'words' must be a list of strings"}), 400
    result = align_words(words)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@api.route("/ipa/distance", methods=["POST"])
def ipa_distance():
    data = _json_object()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    word1 = data.get("word1", "")
    word2 = data.get("word2", "")
    if not isinstance(word1, str) or not isinstance(word2, str):
        return jsonify({"error": "Fields 'word1' and 'word2' must be strings"}), 400
    if not word1 or not word2:
        return jsonify({"error": "Both word1 and word2 are required"}), 400

    report = ipa_distance_report(word1, word2)
    divergence = estimate_from_ned(report["normalized_edit_distance"])
    report["divergence"] = divergence
    return jsonify(report)


@api.route("/ipa/features", methods=["POST"])
def ipa_features():
    data = _json_object()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    word = data.get("word", "")
    if not isinstance(word, str):
        return jsonify({"error": "Field 'word' must be a string"}), 400
    if not word:
        return jsonify({"error": "Field 'word' is required"}), 400

    return jsonify({"word": word, "features": get_features(word)})


@api.route("/date", methods=["POST"])
def date_divergence():
    data = _json_object()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    if "cognate_pct" in data:
        pct, error = _parse_float_value(data["cognate_pct"], "cognate_pct")
        if error is not None:
            return error
        bounds_error = _validate_open_unit_interval(pct, "cognate_pct")
        if bounds_error is not None:
            return bounds_error

        rate, error = _parse_float_value(data.get("retention_rate", 0.86), "retention_rate")
        if error is not None:
            return error
        bounds_error = _validate_open_unit_interval(rate, "retention_rate")
        if bounds_error is not None:
            return bounds_error

        years = estimate_divergence_years(pct, rate)
        return jsonify({
            "cognate_pct": pct,
            "retention_rate": rate,
            "estimated_years": round(years) if years else None,
        })

    if "ned" in data:
        ned, error = _parse_float_value(data["ned"], "ned")
        if error is not None:
            return error

        return jsonify(estimate_from_ned(ned))

    return jsonify({"error": "Provide 'cognate_pct' or 'ned'"}), 400


@api.route("/date/curve", methods=["GET"])
def date_curve():
    return jsonify({"curve": retention_curve()})


@api.route("/date/calibration", methods=["GET"])
def date_calibration():
    return jsonify({"calibration": get_calibration_dates()})
