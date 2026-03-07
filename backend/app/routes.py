from flask import Blueprint, jsonify

api = Blueprint("api", __name__)


@api.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})
