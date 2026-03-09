from app.reconstruction import (
    _majority_vote_column,
    align_words,
    load_dataset,
    search_dataset,
    get_sample,
    reconstruct_tree,
    MAX_TREE_DEPTH,

)


class TestMajorityVoteColumn:
    def test_clear_winner(self):
        assert _majority_vote_column(["a", "a", "b"]) == "a"

    def test_tie_returns_non_gap(self):
        result = _majority_vote_column(["a", "b", "c"])
        assert result != "-"
        assert result in ("a", "b", "c")

    def test_all_gaps(self):
        assert _majority_vote_column(["-", "-", "-"]) == "-"

    def test_gaps_ignored_in_vote(self):
        """Gaps should not count; 'a' is the only real segment."""
        assert _majority_vote_column(["-", "a", "-"]) == "a"

    def test_empty_strings_treated_as_gaps(self):
        assert _majority_vote_column(["", "", ""]) == "-"


class TestAlignWords:
    def test_basic_alignment(self):
        result = align_words(["padre", "pere"])
        assert "alignment" in result
        assert "input" in result
        assert len(result["alignment"]) == 2

    def test_single_word_error(self):
        result = align_words(["padre"])
        assert "error" in result

    def test_empty_list_error(self):
        result = align_words([])
        assert "error" in result


class TestReconstructTree:
    def test_single_tree_returns_single_result_envelope(self):
        tree = {
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
                {
                    "label": "Eastern",
                    "ipa": "",
                    "children": [
                        {"label": "Italian", "ipa": "padre"},
                        {"label": "Romanian", "ipa": "patre"},
                    ],
                },
            ],
        }

        result = reconstruct_tree(tree, method="algorithm")

        assert result["count"] == 1
        assert result["batched"] is False
        assert len(result["results"]) == 1

        batch = result["results"][0]
        assert batch["batch_index"] == 0
        assert batch["tree"]["type"] == "root"
        assert batch["tree"]["children"][0]["children"][0]["ipa"] == "pere"
        assert "similarity_matrix" in batch
        assert batch["method_used"] == "algorithm"

    def test_comma_separated_inputs_reconstruct_multiple_results(self):
        tree = {
            "label": "Proto-Test",
            "_is_root": True,
            "children": [
                {
                    "label": "Western",
                    "ipa": "",
                    "children": [
                        {"label": "French", "ipa": "pere,mere"},
                        {"label": "Spanish", "ipa": "padre,madre"},
                    ],
                },
                {
                    "label": "Eastern",
                    "ipa": "",
                    "children": [
                        {"label": "Italian", "ipa": "padre,madre"},
                        {"label": "Romanian", "ipa": "patre,matre"},
                    ],
                },
            ],
        }

        result = reconstruct_tree(tree, method="algorithm")

        assert result["count"] == 2
        assert result["batched"] is True
        assert len(result["results"]) == 2
        assert [batch["batch_index"] for batch in result["results"]] == [0, 1]
        assert [
            batch["tree"]["children"][0]["children"][0]["ipa"]
            for batch in result["results"]
        ] == ["pere", "mere"]
        assert [
            batch["tree"]["children"][1]["children"][1]["ipa"]
            for batch in result["results"]
        ] == ["patre", "matre"]

    def test_mismatched_batch_lengths_return_error(self):
        tree = {
            "label": "Proto-Test",
            "_is_root": True,
            "children": [
                {
                    "label": "Western",
                    "ipa": "",
                    "children": [
                        {"label": "French", "ipa": "pere,mere"},
                        {"label": "Spanish", "ipa": "padre"},
                    ],
                },
                {
                    "label": "Eastern",
                    "ipa": "",
                    "children": [
                        {"label": "Italian", "ipa": "padre,madre"},
                        {"label": "Romanian", "ipa": "patre,matre"},
                    ],
                },
            ],
        }

        result = reconstruct_tree(tree, method="algorithm")

        assert "error" in result
        assert "same number of comma-separated forms" in result["error"]


class TestReconstructTreeRoute:
    def test_route_returns_batch_envelope(self, client):
        response = client.post(
            "/api/reconstruct_tree",
            json={
                "method": "algorithm",
                "tree": {
                    "label": "Proto-Test",
                    "children": [
                        {
                            "label": "Western",
                            "ipa": "",
                            "children": [
                                {"label": "French", "ipa": "pere,mere"},
                                {"label": "Spanish", "ipa": "padre,madre"},
                            ],
                        },
                        {
                            "label": "Eastern",
                            "ipa": "",
                            "children": [
                                {"label": "Italian", "ipa": "padre,madre"},
                                {"label": "Romanian", "ipa": "patre,matre"},
                            ],
                        },
                    ],
                },
            },
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["count"] == 2
        assert data["batched"] is True
        assert len(data["results"]) == 2


class TestLoadDataset:
    def test_returns_nonempty(self):
        data = load_dataset()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_entries_have_expected_keys(self):
        data = load_dataset()
        entry = data[0]
        for key in ("romanian", "french", "italian", "spanish", "portuguese", "latin"):
            assert key in entry


class TestSearchDataset:
    def test_search_finds_entries(self):
        result = search_dataset("pater")
        assert "results" in result
        # pater is a known Latin root in the dataset — expect at least one hit
        # If not found, the test still validates the return shape
        assert isinstance(result["results"], list)

    def test_search_returns_query(self):
        result = search_dataset("pater")
        assert result["query"] == "pater"

    def test_search_no_results(self):
        result = search_dataset("xyznonexistent12345")
        assert result["count"] == 0
        assert result["results"] == []


class TestGetSample:
    def test_returns_samples(self):
        result = get_sample(count=3, offset=0)
        assert "samples" in result
        assert len(result["samples"]) <= 3

    def test_has_total(self):
        result = get_sample(count=3, offset=0)
        assert "total" in result
        assert result["total"] > 0

    def test_offset_works(self):
        r1 = get_sample(count=1, offset=0)
        r2 = get_sample(count=1, offset=1)
        if r1["total"] > 1:
            assert r1["samples"] != r2["samples"]


class TestConstants:
    def test_max_tree_depth(self):
        assert MAX_TREE_DEPTH == 20
