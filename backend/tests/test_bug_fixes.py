import pytest

from app import reconstruction
from app.glottochronology import estimate_from_ned
from app.reconstruction import MAX_TREE_DEPTH, _reconstruct_ml, get_sample, reconstruct_tree


def _simple_tree():
    return {
        "label": "Proto-Test",
        "_is_root": True,
        "children": [
            {
                "label": "Western",
                "ipa": "",
                "children": [
                    {"label": "French", "ipa": "pere"},
                    {"label": "Spanish", "ipa": "padre"},
                ],
            },
        ],
    }


class TestTreeAgesUseNedTable:
    def test_ages_match_estimate_from_ned(self, monkeypatch):
        monkeypatch.setattr(reconstruction, "normalized_edit_distance", lambda a, b: 0.2)
        result = reconstruct_tree(_simple_tree(), method="algorithm")
        root = result["results"][0]["tree"]
        expected = estimate_from_ned(0.2)["estimated_years"]
        assert root["estimated_age_years"] == expected
        assert root["children"][0]["estimated_age_years"] == expected


class TestReconstructMlKeys:
    def _capture(self, monkeypatch):
        captured = {}

        def fake_predict(cognates):
            captured.update(cognates)
            return "x"

        monkeypatch.setattr(reconstruction.dpd_service, "predict_proto", fake_predict)
        return captured

    def test_duplicate_labels_keep_every_cognate(self, monkeypatch):
        captured = self._capture(monkeypatch)
        children = [
            {"label": "Spanish", "ipa": "padre"},
            {"label": "Spanish", "ipa": "pai"},
            {"label": "Spanish", "ipa": "pare"},
        ]
        ipa, error = _reconstruct_ml("root", children)
        assert error is None
        assert captured == {"Spanish": "padre", "Spanish#2": "pai", "Spanish#3": "pare"}

    def test_unlabeled_children_are_included(self, monkeypatch):
        captured = self._capture(monkeypatch)
        children = [{"label": "", "ipa": "padre"}, {"label": "French", "ipa": "pere"}]
        _reconstruct_ml("root", children)
        assert sorted(captured.values()) == ["padre", "pere"]
        assert "French" in captured


class TestTreeValidation:
    @pytest.mark.parametrize("tree", [[], "tree", 5])
    def test_non_object_tree(self, tree):
        assert "error" in reconstruct_tree(tree)

    def test_non_object_child(self):
        assert "error" in reconstruct_tree({"children": ["oops"]})

    def test_children_must_be_list(self):
        assert "error" in reconstruct_tree({"children": {"label": "x"}})

    def test_non_string_label(self):
        tree = {"children": [{"label": 5, "children": [{"label": "a", "ipa": "pa"}]}]}
        assert "error" in reconstruct_tree(tree)

    def test_very_deep_tree_is_rejected_without_recursion_error(self):
        node = {"label": "leaf", "ipa": "pa"}
        for _ in range(5000):
            node = {"label": "n", "children": [node]}
        result = reconstruct_tree(node)
        assert str(MAX_TREE_DEPTH) in result["error"]


class TestGetSampleBounds:
    def test_negative_offset_is_clamped(self):
        assert get_sample(count=2, offset=-5) == get_sample(count=2, offset=0)

    def test_negative_count_returns_nothing(self):
        assert get_sample(count=-3)["samples"] == []


class TestRouteValidation:
    @pytest.mark.parametrize("tree", [[], "x", None])
    def test_reconstruct_tree_rejects_non_object_tree(self, client, tree):
        response = client.post("/api/reconstruct_tree", json={"tree": tree})
        assert response.status_code == 400

    def test_reconstruct_tree_rejects_unknown_method(self, client):
        response = client.post("/api/reconstruct_tree", json={"tree": _simple_tree(), "method": "magic"})
        assert response.status_code == 400

    def test_reconstruct_tree_invalid_tree_is_400(self, client):
        response = client.post("/api/reconstruct_tree", json={"tree": {"children": ["x"]}})
        assert response.status_code == 400

    @pytest.mark.parametrize(
        "endpoint", ["/api/reconstruct", "/api/reconstruct_tree", "/api/align", "/api/ipa/distance", "/api/date"]
    )
    def test_non_object_body_is_400(self, client, endpoint):
        response = client.post(endpoint, json=[1, 2, 3])
        assert response.status_code == 400

    def test_reconstruct_rejects_non_string_words(self, client):
        response = client.post("/api/reconstruct", json={"words": [1, 2]})
        assert response.status_code == 400

    def test_reconstruct_rejects_non_list_languages(self, client):
        response = client.post("/api/reconstruct", json={"words": ["pa", "pe"], "languages": "French"})
        assert response.status_code == 400

    def test_align_rejects_non_list(self, client):
        response = client.post("/api/align", json={"words": "padre"})
        assert response.status_code == 400

    def test_ipa_distance_rejects_non_string(self, client):
        response = client.post("/api/ipa/distance", json={"word1": 1, "word2": "pa"})
        assert response.status_code == 400

    def test_ipa_features_rejects_non_string(self, client):
        response = client.post("/api/ipa/features", json={"word": ["pa"]})
        assert response.status_code == 400

    @pytest.mark.parametrize("value", ["nan", "inf"])
    def test_date_rejects_non_finite_ned(self, client, value):
        response = client.post("/api/date", json={"ned": value})
        assert response.status_code == 400

    @pytest.mark.parametrize("params", ["count=-1", "offset=-1"])
    def test_sample_rejects_negative(self, client, params):
        assert client.get(f"/api/dataset/sample?{params}").status_code == 400

    def test_search_rejects_negative_limit(self, client):
        assert client.get("/api/dataset/search?q=a&limit=-1").status_code == 400
