import datetime
import unittest

from server.attack_data import _score_at, _score_history


class CoverageScoreTest(unittest.TestCase):
    def test_latest_score_with_mixed_and_missing_dates(self):
        history = _score_history({'score_logbook': [
            {'date': datetime.datetime(2023, 5, 1), 'score': 2},
            {'date': None, 'score': 1},
            {'date': datetime.date(2024, 1, 10), 'score': 3},
            {'date': '2022-01-01', 'score': 4},
        ]})
        # the most recent dated entry wins, undated entries count as the oldest
        self.assertEqual(_score_at([history], 0), 3)

    def test_score_at_a_date(self):
        history = _score_history({'score_logbook': [{'date': '2023-01-01', 'score': 1}, {'date': '2024-01-01', 'score': 3}]})
        self.assertEqual(_score_at([history], 0, datetime.date(2022, 12, 31)), 0)
        self.assertEqual(_score_at([history], 0, datetime.date(2023, 6, 1)), 1)
        self.assertEqual(_score_at([history], 0, datetime.date(2024, 6, 1)), 3)

    def test_highest_score_over_all_objects(self):
        a = _score_history({'score_logbook': {'date': '2023-01-01', 'score': 2}})
        b = _score_history({'score_logbook': [{'date': '2023-01-01', 'score': 4}]})
        self.assertEqual(_score_at([a, b], -1), 4)
        self.assertEqual(_score_at([], -1), -1)


if __name__ == '__main__':
    unittest.main()
