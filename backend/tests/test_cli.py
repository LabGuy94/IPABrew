import json

from app import cli


TREE_JSON = json.dumps(
    {
        "label": "Proto-Test",
        "children": [
            {
                "label": "Western",
                "children": [
                    {"label": "French", "ipa": "pɛːr"},
                    {"label": "Spanish", "ipa": "padre"},
                ],
            },
            {
                "label": "Eastern",
                "children": [
                    {"label": "Italian", "ipa": "padre"},
                    {"label": "Romanian", "ipa": "patre"},
                ],
            },
        ],
    }
)


def run_cli(capsys, *args):
    exit_code = cli.main(list(args))
    captured = capsys.readouterr()
    return exit_code, captured.out, captured.err


def parse_stdout(stdout):
    return json.loads(stdout)


class StubFlaskApp:
    def __init__(self):
        self.run_calls = []

    def run(self, **kwargs):
        self.run_calls.append(kwargs)


def stub_web_app(monkeypatch):
    app = StubFlaskApp()
    opened_urls = []
    monkeypatch.setattr(cli, "_load_web_app", lambda: app)
    monkeypatch.setattr(cli, "_open_browser", opened_urls.append)
    return app, opened_urls


def test_bare_command_prints_simplified_help(capsys):
    exit_code, stdout, stderr = run_cli(capsys)

    assert exit_code == 0
    assert stderr == ""
    assert "IPABrew" in stdout
    assert "Common commands:" in stdout
    assert "ipabrew web" in stdout
    assert "ipabrew docs" in stdout
    assert "pip install -e ." in stdout


def test_help_flags_and_command_list_web_commands(capsys):
    exit_code = cli.main(["--help"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "help" in captured.out
    assert "web" in captured.out
    assert "app" in captured.out
    assert "docs" in captured.out
    assert "server" in captured.out
    assert "serve" in captured.out


def test_help_command_prints_general_help(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "help")

    assert exit_code == 0
    assert stderr == ""
    assert "usage: ipabrew" in stdout
    assert "Show general or command-specific help" in stdout


def test_help_command_prints_command_help(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "help", "web")

    assert exit_code == 0
    assert stderr == ""
    assert "usage: ipabrew web" in stdout
    assert "--port PORT" in stdout


def test_help_command_rejects_unknown_topic(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "help", "missing")

    assert exit_code != 0
    assert stdout == ""
    assert "Unknown help topic 'missing'" in stderr


def test_sample_emits_samples_and_honors_count(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "sample", "--count", "3")

    assert exit_code == 0
    assert stderr == ""
    data = parse_stdout(stdout)
    assert "samples" in data
    assert data["count"] == len(data["samples"])
    assert len(data["samples"]) <= 3


def test_search_emits_query_and_results(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "search", "pater", "--limit", "5")

    assert exit_code == 0
    assert stderr == ""
    data = parse_stdout(stdout)
    assert data["query"] == "pater"
    assert "results" in data
    assert isinstance(data["results"], list)
    assert len(data["results"]) <= 5


def test_align_rejects_fewer_than_two_words(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "align", "padre")

    assert exit_code != 0
    assert stdout == ""
    assert "at least two words" in stderr


def test_invalid_subcommand_argument_returns_nonzero(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "sample", "--count", "not-an-int")

    assert exit_code != 0
    assert stdout == ""
    assert "--count must be an integer" in stderr


def test_reconstruct_words_with_languages_emits_result_shape(capsys):
    exit_code, stdout, stderr = run_cli(
        capsys,
        "reconstruct",
        "--words",
        "pɛːr",
        "padre",
        "--languages",
        "French",
        "Spanish",
    )

    assert exit_code == 0
    assert stderr == ""
    data = parse_stdout(stdout)
    assert "proto_form" in data or "error" in data
    if "proto_form" in data:
        assert data["input_words"] == ["pɛːr", "padre"]
        assert data["languages"] == ["French", "Spanish"]


def test_reconstruct_words_rejects_mismatched_languages(capsys):
    exit_code, stdout, stderr = run_cli(
        capsys,
        "reconstruct",
        "--words",
        "pɛːr",
        "padre",
        "--languages",
        "French",
    )

    assert exit_code != 0
    assert stdout == ""
    assert "same number" in stderr


def test_reconstruct_from_dataset_index_emits_dataset_fields(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "reconstruct", "--index", "0")

    assert exit_code == 0
    assert stderr == ""
    data = parse_stdout(stdout)
    assert data["dataset_index"] == 0
    assert "actual_latin" in data
    assert "proto_form" in data or "error" in data


def test_reconstruct_tree_inline_json_algorithm_emits_batch_envelope(capsys):
    exit_code, stdout, stderr = run_cli(
        capsys,
        "reconstruct-tree",
        "--tree-json",
        TREE_JSON,
        "--method",
        "algorithm",
    )

    assert exit_code == 0
    assert stderr == ""
    data = parse_stdout(stdout)
    assert data["count"] == 1
    assert data["batched"] is False
    assert data["results"][0]["method_used"] == "algorithm"


def test_date_from_ned_emits_expected_keys(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "date", "--ned", "0.3")

    assert exit_code == 0
    assert stderr == ""
    data = parse_stdout(stdout)
    assert {"estimated_years", "range", "category", "ned"} <= data.keys()
    assert data["ned"] == 0.3


def test_date_from_cognate_pct_emits_expected_keys(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "date", "--cognate-pct", "0.6")

    assert exit_code == 0
    assert stderr == ""
    data = parse_stdout(stdout)
    assert data["cognate_pct"] == 0.6
    assert data["retention_rate"] == 0.86
    assert "estimated_years" in data


def test_distance_emits_divergence(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "distance", "pɛːr", "padre")

    assert exit_code == 0
    assert stderr == ""
    data = parse_stdout(stdout)
    assert data["word1"] == "pɛːr"
    assert data["word2"] == "padre"
    assert "feature_edit_distance" in data
    assert "divergence" in data


def test_features_emits_word_and_features(capsys):
    exit_code, stdout, stderr = run_cli(capsys, "features", "padre")

    assert exit_code == 0
    assert stderr == ""
    data = parse_stdout(stdout)
    assert data["word"] == "padre"
    assert "features" in data
    assert isinstance(data["features"], list)


def test_web_command_runs_flask_app_and_opens_browser(monkeypatch, capsys):
    app, opened_urls = stub_web_app(monkeypatch)

    exit_code, stdout, stderr = run_cli(capsys, "web", "--host", "127.0.0.1", "--port", "9090")

    assert exit_code == 0
    assert stdout == ""
    assert stderr == ""
    assert app.run_calls == [{"host": "127.0.0.1", "port": 9090, "debug": False, "use_reloader": False}]
    assert opened_urls == ["http://127.0.0.1:9090/"]


def test_app_alias_runs_web_command(monkeypatch, capsys):
    app, opened_urls = stub_web_app(monkeypatch)

    exit_code, stdout, stderr = run_cli(capsys, "app", "--debug", "--no-reload")

    assert exit_code == 0
    assert stdout == ""
    assert stderr == ""
    assert app.run_calls == [{"host": "0.0.0.0", "port": 8080, "debug": True, "use_reloader": False}]
    assert opened_urls == ["http://127.0.0.1:8080/"]


def test_docs_command_runs_web_app_and_opens_docs(monkeypatch, capsys):
    app, opened_urls = stub_web_app(monkeypatch)

    exit_code, stdout, stderr = run_cli(capsys, "docs", "--host", "127.0.0.1", "--port", "9091")

    assert exit_code == 0
    assert stdout == ""
    assert stderr == ""
    assert app.run_calls == [{"host": "127.0.0.1", "port": 9091, "debug": False, "use_reloader": False}]
    assert opened_urls == ["http://127.0.0.1:9091/docs"]


def test_web_no_open_flag_skips_browser(monkeypatch, capsys):
    app, opened_urls = stub_web_app(monkeypatch)

    exit_code, stdout, stderr = run_cli(capsys, "web", "--no-open")

    assert exit_code == 0
    assert stdout == ""
    assert stderr == ""
    assert app.run_calls == [{"host": "0.0.0.0", "port": 8080, "debug": False, "use_reloader": False}]
    assert opened_urls == []


def test_server_command_runs_without_opening_browser(monkeypatch, capsys):
    app, opened_urls = stub_web_app(monkeypatch)

    exit_code, stdout, stderr = run_cli(capsys, "server", "--host", "127.0.0.1", "--port", "9092")

    assert exit_code == 0
    assert stdout == ""
    assert stderr == ""
    assert app.run_calls == [{"host": "127.0.0.1", "port": 9092, "debug": False, "use_reloader": False}]
    assert opened_urls == []


def test_serve_alias_runs_server_without_opening_browser(monkeypatch, capsys):
    app, opened_urls = stub_web_app(monkeypatch)

    exit_code, stdout, stderr = run_cli(capsys, "serve")

    assert exit_code == 0
    assert stdout == ""
    assert stderr == ""
    assert app.run_calls == [{"host": "0.0.0.0", "port": 8080, "debug": False, "use_reloader": False}]
    assert opened_urls == []


def test_model_status_does_not_force_load(monkeypatch, capsys):
    def fail_init():
        raise AssertionError("model-status without --load must not call init")

    monkeypatch.setattr(cli.dpd_service, "init", fail_init)
    monkeypatch.setattr(cli.dpd_service, "is_available", lambda: False)

    exit_code, stdout, stderr = run_cli(capsys, "model-status")

    assert exit_code == 0
    assert stderr == ""
    assert parse_stdout(stdout) == {"available": False}
