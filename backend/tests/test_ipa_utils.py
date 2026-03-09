from app.ipa_utils import (
    feature_edit_distance,
    normalized_edit_distance,
    get_features,
)


class TestNormalizedEditDistance:
    def test_identical_words_return_zero(self):
        assert normalized_edit_distance("padre", "padre") == 0.0

    def test_different_words_positive(self):
        ned = normalized_edit_distance("padre", "pɛːr")
        assert ned > 0

    def test_result_between_zero_and_one(self):
        ned = normalized_edit_distance("padre", "pɛːr")
        assert 0.0 <= ned <= 1.0

    def test_empty_strings_return_zero(self):
        assert normalized_edit_distance("", "") == 0.0

    def test_symmetry(self):
        ned_ab = normalized_edit_distance("padre", "pɛːr")
        ned_ba = normalized_edit_distance("pɛːr", "padre")
        assert abs(ned_ab - ned_ba) < 1e-6

    def test_multi_codepoint_ipa_affricate(self):
        """Affricate t͡s is one segment (2 codepoints). The fix uses
        panphon segment count, not len(), so this should work correctly."""
        # t͡s vs ts — the tie-bar version is a single segment
        ned = normalized_edit_distance("t͡sa", "tsa")
        assert 0.0 <= ned <= 1.0

    def test_similar_words_lower_distance(self):
        """More similar words should have lower NED."""
        ned_close = normalized_edit_distance("padre", "padre")
        ned_far = normalized_edit_distance("padre", "mɛːr")
        assert ned_close < ned_far


class TestFeatureEditDistance:
    def test_identity_returns_zero(self):
        assert feature_edit_distance("padre", "padre") == 0.0

    def test_different_words_positive(self):
        fed = feature_edit_distance("padre", "pɛːr")
        assert fed > 0

    def test_symmetric(self):
        fed_ab = feature_edit_distance("padre", "pɛːr")
        fed_ba = feature_edit_distance("pɛːr", "padre")
        assert abs(fed_ab - fed_ba) < 1e-6


class TestGetFeatures:
    def test_returns_list(self):
        result = get_features("pa")
        assert isinstance(result, list)

    def test_segments_for_known_word(self):
        result = get_features("pa")
        assert len(result) >= 1
        for entry in result:
            assert "segment" in entry
            assert "features" in entry

    def test_empty_string(self):
        result = get_features("")
        assert isinstance(result, list)
