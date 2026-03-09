import logging

logger = logging.getLogger(__name__)

import panphon
import panphon.distance


_ft = None
_dst = None


def _get_feature_table():
    global _ft
    if _ft is None:
        _ft = panphon.FeatureTable()
    return _ft


def _get_distance():
    global _dst
    if _dst is None:
        _dst = panphon.distance.Distance()
    return _dst


def feature_edit_distance(word1, word2):
    dst = _get_distance()
    return dst.feature_edit_distance(word1, word2)


def weighted_feature_edit_distance(word1, word2):
    dst = _get_distance()
    return dst.weighted_feature_edit_distance(word1, word2)


def normalized_edit_distance(word1, word2):
    fed = feature_edit_distance(word1, word2)
    ft = _get_feature_table()
    seg_count1 = len(ft.segs_safe(word1))
    seg_count2 = len(ft.segs_safe(word2))
    max_len = max(seg_count1, seg_count2)
    if max_len == 0:
        return 0.0
    return fed / max_len


def get_features(word):
    ft = _get_feature_table()
    try:
        fts = ft.word_fts(word)
        return [
            {"segment": seg, "features": dict(zip(ft.names, fv.numeric()))}
            for seg, fv in zip(word, fts)
        ]
    except Exception:
        logger.debug("Failed to get features for '%s'", word, exc_info=True)
        return []


def ipa_distance_report(word1, word2):
    fed = feature_edit_distance(word1, word2)
    ned = normalized_edit_distance(word1, word2)
    return {
        "word1": word1,
        "word2": word2,
        "feature_edit_distance": round(fed, 4),
        "normalized_edit_distance": round(ned, 4),
    }
