import math

from app.glottochronology import (
    estimate_divergence_years,
    estimate_from_ned,
    retention_curve,
    CALIBRATION_DATES,
)


class TestEstimateDivergenceYears:
    def test_known_calibration_romance(self):
        """~81% cognate retention should yield roughly 1500-2000 years."""
        # 0.81 cognate percentage -> should produce a value in the Romance range
        years = estimate_divergence_years(0.81)
        assert years is not None
        assert 500 < years < 3000

    def test_high_cognate_pct_short_divergence(self):
        """Very high cognate percentage -> recent divergence."""
        years = estimate_divergence_years(0.95)
        assert years is not None
        assert years > 0
        assert years < 1000

    def test_low_cognate_pct_deep_divergence(self):
        """Low cognate percentage -> deep divergence."""
        years = estimate_divergence_years(0.30)
        assert years is not None
        assert years > 3000

    def test_boundary_zero_returns_none(self):
        assert estimate_divergence_years(0) is None

    def test_boundary_one_returns_none(self):
        assert estimate_divergence_years(1) is None

    def test_negative_returns_none(self):
        assert estimate_divergence_years(-0.5) is None

    def test_custom_retention_rate(self):
        years_default = estimate_divergence_years(0.5)
        years_fast = estimate_divergence_years(0.5, retention_rate=0.80)
        # Faster decay rate -> fewer years to reach same cognate %
        assert years_fast < years_default


class TestEstimateFromNed:
    def test_ned_zero(self):
        result = estimate_from_ned(0.0)
        assert result["estimated_years"] == 0
        assert result["category"] == "Dialects"

    def test_ned_mid(self):
        result = estimate_from_ned(0.5)
        assert result is not None
        assert result["estimated_years"] > 0
        assert "category" in result

    def test_ned_one(self):
        """ned=1.0 should hit the fallback (upper boundary)."""
        result = estimate_from_ned(1.0)
        assert result["estimated_years"] == 10000
        assert result["category"] == "Deep/uncertain"

    def test_ned_negative_clamped(self):
        result = estimate_from_ned(-0.5)
        assert result["estimated_years"] == 0

    def test_ned_above_one_clamped(self):
        result = estimate_from_ned(1.5)
        assert result["estimated_years"] == 10000

    def test_romance_range(self):
        """NED 0.15 should fall in Romance languages category."""
        result = estimate_from_ned(0.15)
        assert result["category"] == "Romance languages"
        assert 500 <= result["estimated_years"] <= 1500

    def test_result_has_ned_field(self):
        result = estimate_from_ned(0.42)
        assert "ned" in result
        assert result["ned"] == 0.42


class TestRetentionCurve:
    def test_returns_nonempty(self):
        points = retention_curve()
        assert len(points) > 0

    def test_monotonic_decrease(self):
        """Cognate retention should decrease monotonically with time."""
        points = retention_curve()
        pcts = [p["cognate_pct"] for p in points]
        for i in range(1, len(pcts)):
            assert pcts[i] <= pcts[i - 1], (
                f"Non-monotonic at index {i}: {pcts[i]} > {pcts[i-1]}"
            )

    def test_starts_at_one(self):
        points = retention_curve()
        assert points[0]["years"] == 0
        assert points[0]["cognate_pct"] == 1.0

    def test_entries_have_expected_keys(self):
        points = retention_curve()
        for p in points:
            assert "years" in p
            assert "cognate_pct" in p


class TestDateDivergenceRoute:
    def test_rejects_non_numeric_cognate_pct(self, client):
        response = client.post("/api/date", json={"cognate_pct": "not-a-number"})

        assert response.status_code == 400
        assert response.get_json() == {"error": "Field 'cognate_pct' must be a number"}

    def test_rejects_non_numeric_ned(self, client):
        response = client.post("/api/date", json={"ned": {"bad": "type"}})

        assert response.status_code == 400
        assert response.get_json() == {"error": "Field 'ned' must be a number"}