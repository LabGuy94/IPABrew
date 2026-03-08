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


@api.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@api.route("/dataset/sample", methods=["GET"])
def dataset_sample():
    count = request.args.get("count", 20, type=int)
    offset = request.args.get("offset", 0, type=int)
    count = min(count, 100)
    return jsonify(get_sample(count, offset))


@api.route("/dataset/search", methods=["GET"])
def dataset_search():
    query = request.args.get("q", "")
    limit = request.args.get("limit", 20, type=int)
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400
    return jsonify(search_dataset(query, min(limit, 100)))


@api.route("/reconstruct", methods=["POST"])
def reconstruct():
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    if "index" in data:
        result = reconstruct_from_dataset_entry(int(data["index"]))
        return jsonify(result)

    words = data.get("words", [])
    languages = data.get("languages", [])
    if not words or len(words) < 2:
        return jsonify({"error": "Need at least 2 cognate words"}), 400

    result = reconstruct_from_cognates(words, languages if languages else None)
    return jsonify(result)


@api.route("/reconstruct_tree", methods=["POST"])
def reconstruct_tree_route():
    data = request.get_json()
    if not data or "tree" not in data:
        return jsonify({"error": "JSON body with 'tree' field required"}), 400

    tree = data["tree"]
    tree["_is_root"] = True
    method = data.get("method", "ml")
    result = reconstruct_tree(tree, method=method)
    return jsonify(result)



@api.route("/model/status", methods=["GET"])
def model_status():
    return jsonify({"available": dpd_service.is_available()})

@api.route("/align", methods=["POST"])
def align():
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    words = data.get("words", [])
    result = align_words(words)
    return jsonify(result)


@api.route("/ipa/distance", methods=["POST"])
def ipa_distance():
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    word1 = data.get("word1", "")
    word2 = data.get("word2", "")
    if not word1 or not word2:
        return jsonify({"error": "Both word1 and word2 are required"}), 400

    report = ipa_distance_report(word1, word2)
    divergence = estimate_from_ned(report["normalized_edit_distance"])
    report["divergence"] = divergence
    return jsonify(report)


@api.route("/ipa/features", methods=["POST"])
def ipa_features():
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    word = data.get("word", "")
    if not word:
        return jsonify({"error": "Field 'word' is required"}), 400

    return jsonify({"word": word, "features": get_features(word)})


@api.route("/date", methods=["POST"])
def date_divergence():
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    if "cognate_pct" in data:
        pct = float(data["cognate_pct"])
        rate = float(data.get("retention_rate", 0.86))
        years = estimate_divergence_years(pct, rate)
        return jsonify({
            "cognate_pct": pct,
            "retention_rate": rate,
            "estimated_years": round(years) if years else None,
        })

    if "ned" in data:
        ned = float(data["ned"])
        return jsonify(estimate_from_ned(ned))

    return jsonify({"error": "Provide 'cognate_pct' or 'ned'"}), 400


@api.route("/date/curve", methods=["GET"])
def date_curve():
    return jsonify({"curve": retention_curve()})


@api.route("/date/calibration", methods=["GET"])
def date_calibration():
    return jsonify({"calibration": get_calibration_dates()})
