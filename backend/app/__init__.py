from flask import Flask, send_from_directory
from flask_cors import CORS


def create_app():
    app = Flask(__name__, static_folder="static", static_url_path="/static")
    CORS(app)

    from app.routes import api

    app.register_blueprint(api, url_prefix="/api")

    @app.route("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    return app
