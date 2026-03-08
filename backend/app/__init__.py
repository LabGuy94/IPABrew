import logging

from flask import Flask, send_from_directory
from flask_cors import CORS

logging.getLogger("lingpy").setLevel(logging.WARNING)


def create_app():
    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
    )
    CORS(app)

    # Load DPD neural model (ML reconstruction)
    from app.services import dpd_service
    dpd_service.init()

    from app.routes import api

    app.register_blueprint(api, url_prefix="/api")

    @app.route("/")
    def index():
        return send_from_directory(app.template_folder, "index.html")

    return app
