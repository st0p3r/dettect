import contextlib
import io
import os
import tempfile
import unittest

from data_source_mapping import plot_data_sources_graph
from technique_mapping import plot_graph

TECHNIQUES_WITHOUT_SCORES = """version: 1.2
file_type: technique-administration
name: test
domain: enterprise-attack
platform: [Windows]
techniques:
  - technique_id: T1059
    technique_name: Command and Scripting Interpreter
    detection:
      - applicable_to: [all]
        location: []
        comment: ''
        score_logbook: [{date: null, score: -1, comment: ''}]
    visibility:
      - applicable_to: [all]
        comment: ''
        score_logbook: [{date: null, score: 0, comment: '', auto_generated: false}]
"""

DATA_SOURCES_WITHOUT_DATES = """version: 1.1
file_type: data-source-administration
name: test
domain: enterprise-attack
systems:
  - applicable_to: default
    platform: [Windows]
data_sources:
  - data_source_name: Process Creation
    data_source:
      - applicable_to: [all]
        date_registered: null
        date_connected: null
        products: []
        available_for_data_analytics: false
        comment: ''
        data_quality: {device_completeness: 1, data_field_completeness: 1, timeliness: 1, consistency: 1, retention: 1}
"""


class EmptyGraphTest(unittest.TestCase):
    def _run(self, content, func, *args):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, 'file.yaml')
            with open(path, 'w') as f:
                f.write(content)
            output = os.path.join(tmpdir, 'graph')
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                func(path, *args, output, True)
            self.assertFalse(os.path.exists(output + '.html'))
            return stdout.getvalue()

    def test_technique_graph_without_scores_does_not_crash(self):
        for graph_type in ('visibility', 'detection'):
            self.assertIn('No graph is created', self._run(TECHNIQUES_WITHOUT_SCORES, plot_graph, graph_type))

    def test_data_source_graph_without_dates_does_not_crash(self):
        self.assertIn('No graph is created', self._run(DATA_SOURCES_WITHOUT_DATES, plot_data_sources_graph))


if __name__ == '__main__':
    unittest.main()
