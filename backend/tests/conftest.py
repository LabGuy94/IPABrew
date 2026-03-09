import pytest
from app import create_app


@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()


# Sample IPA words for testing
SAMPLE_IPA = {
    "padre": "padre",
    "pere": "pɛːr",
    "padre_it": "padre",
    "pai": "pai",
}
