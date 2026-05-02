"""Local command-line interface for IPABrew domain functions and web app."""

from __future__ import annotations

import argparse
import json
import os
import sys
import webbrowser
from pathlib import Path
from typing import Any, Callable, Sequence

from app.glottochronology import estimate_divergence_years, estimate_from_ned
from app.ipa_utils import get_features, ipa_distance_report
from app.reconstruction import (
    align_words,
    get_sample,
    reconstruct_from_cognates,
    reconstruct_from_dataset_entry,
    reconstruct_tree,
    search_dataset,
)
from app.services import dpd_service


JsonResult = dict[str, Any]
CommandResult = JsonResult | int | None
CommandHandler = Callable[[argparse.Namespace], CommandResult]


class CliError(Exception):
    """Expected command-line validation/runtime error."""


class IPABrewArgumentParser(argparse.ArgumentParser):
    """ArgumentParser that raises instead of exiting so main() can be tested."""

    def error(self, message: str) -> None:  # pragma: no cover - exercised through main()
        raise CliError(message)


class NonNegativeInt:
    def __init__(self, name: str) -> None:
        self.name = name

    def __call__(self, value: str) -> int:
        try:
            parsed = int(value)
        except ValueError as exc:
            raise argparse.ArgumentTypeError(f"{self.name} must be an integer") from exc
        if parsed < 0:
            raise argparse.ArgumentTypeError(f"{self.name} must be non-negative")
        return parsed


class PositiveInt:
    def __init__(self, name: str) -> None:
        self.name = name

    def __call__(self, value: str) -> int:
        try:
            parsed = int(value)
        except ValueError as exc:
            raise argparse.ArgumentTypeError(f"{self.name} must be an integer") from exc
        if parsed <= 0:
            raise argparse.ArgumentTypeError(f"{self.name} must be positive")
        return parsed


def _json_default(value: Any) -> Any:
    if isinstance(value, tuple):
        return list(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _emit_json(result: JsonResult) -> None:
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True, default=_json_default))


def _read_tree_json(raw: str) -> JsonResult:
    text = raw.strip()
    if not text:
        raise CliError("--tree-json must not be empty")

    if text[0] in "[{":
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise CliError(f"--tree-json is not valid JSON: {exc.msg}") from exc
    else:
        path = Path(text)
        if not path.is_file():
            raise CliError("--tree-json must be an inline JSON object or a path to a JSON file")
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
        except OSError as exc:
            raise CliError(f"Could not read --tree-json file: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise CliError(f"--tree-json file is not valid JSON: {exc.msg}") from exc

    if not isinstance(parsed, dict):
        raise CliError("--tree-json must resolve to a JSON object")
    return parsed


def _sample(args: argparse.Namespace) -> JsonResult:
    return get_sample(args.count, args.offset)


def _search(args: argparse.Namespace) -> JsonResult:
    if not args.query.strip():
        raise CliError("QUERY must not be empty")
    return search_dataset(args.query, args.limit)


def _reconstruct(args: argparse.Namespace) -> JsonResult:
    if args.index is None and not args.words:
        raise CliError("Provide --index or --words")
    if args.index is not None and args.words:
        raise CliError("Provide either --index or --words, not both")

    if args.index is not None:
        return reconstruct_from_dataset_entry(args.index)

    words = args.words or []
    if len(words) < 2:
        raise CliError("--words requires at least two cognate words")
    languages = args.languages
    if languages is not None and len(languages) != len(words):
        raise CliError("--languages must have the same number of entries as --words")
    return reconstruct_from_cognates(words, languages)


def _reconstruct_tree(args: argparse.Namespace) -> JsonResult:
    tree = _read_tree_json(args.tree_json)
    tree = dict(tree)
    tree["_is_root"] = True
    if args.method == "ml":
        dpd_service.init()
    return reconstruct_tree(tree, method=args.method)


def _align(args: argparse.Namespace) -> JsonResult:
    if len(args.words) < 2:
        raise CliError("align requires at least two words")
    return align_words(args.words)


def _distance(args: argparse.Namespace) -> JsonResult:
    report = ipa_distance_report(args.word1, args.word2)
    report["divergence"] = estimate_from_ned(report["normalized_edit_distance"])
    return report


def _features(args: argparse.Namespace) -> JsonResult:
    return {"word": args.word, "features": get_features(args.word)}


def _date(args: argparse.Namespace) -> JsonResult:
    if args.cognate_pct is not None:
        years = estimate_divergence_years(args.cognate_pct, args.retention_rate)
        return {
            "cognate_pct": args.cognate_pct,
            "retention_rate": args.retention_rate,
            "estimated_years": round(years) if years else None,
        }
    return estimate_from_ned(args.ned)


def _model_status(args: argparse.Namespace) -> JsonResult:
    if args.load:
        dpd_service.init()
    return {"available": dpd_service.is_available()}


def _load_web_app():
    from app import create_app

    return create_app()


def _resolve_browser_host(host: str) -> str:
    if host in {"", "0.0.0.0", "::", "[::]"}:
        return "127.0.0.1"
    return host


def _should_open_browser(args: argparse.Namespace) -> bool:
    if args.no_open:
        return False

    use_reloader = args.debug and not args.no_reload
    if not use_reloader:
        return True

    return os.environ.get("WERKZEUG_RUN_MAIN") == "true"


def _open_browser(url: str) -> None:
    try:
        opened = webbrowser.open(url, new=2)
    except Exception as exc:
        print(f"ipabrew: warning: could not open browser ({exc}).", file=sys.stderr)
        return

    if not opened:
        print(
            "ipabrew: warning: no browser was opened automatically. "
            f"Open this URL manually: {url}",
            file=sys.stderr,
        )


def _serve_web(args: argparse.Namespace, start_path: str) -> int:
    app = _load_web_app()
    browser_host = _resolve_browser_host(args.host)
    url = f"http://{browser_host}:{args.port}{start_path}"
    if _should_open_browser(args):
        _open_browser(url)

    app.run(
        host=args.host,
        port=args.port,
        debug=args.debug,
        use_reloader=args.debug and not args.no_reload,
    )
    return 0


def _web(args: argparse.Namespace) -> int:
    return _serve_web(args, "/")


def _server(args: argparse.Namespace) -> int:
    args.no_open = True
    return _serve_web(args, "/")


def _docs(args: argparse.Namespace) -> int:
    return _serve_web(args, "/docs")


def _print_quick_help() -> None:
    print("""IPABrew

Usage:
  ipabrew web / app                   Start the web app and open it in your browser
  ipabrew docs                        Start the web app and open /docs in your browser
  ipabrew server / serve              Start the web app without opening a browser
  ipabrew help                        Show full command list
  ipabrew help COMMAND                Show help for one command

Common commands:
  ipabrew sample --count 3
  ipabrew reconstruct --words pɛːr padre --languages French Spanish
  ipabrew reconstruct-tree --tree-json tree.json --method algorithm
  ipabrew distance WORD1 WORD2
  ipabrew model-status

Run 'pip install -e .' once after cloning to install the ipabrew command.
""")


def _help(args: argparse.Namespace) -> int:
    parser = build_parser()
    subcommands = getattr(parser, "_ipabrew_subcommands")
    topic = args.topic

    if topic is None:
        parser.print_help()
        return 0

    command_parser = subcommands.choices.get(topic)
    if command_parser is None:
        raise CliError(f"Unknown help topic '{topic}'. Run 'ipabrew help' for commands.")

    command_parser.print_help()
    return 0


def _add_web_run_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--host", default="0.0.0.0", help="Host interface to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=PositiveInt("--port"), default=8080, help="Port to bind (default: 8080)")
    parser.add_argument("--debug", action="store_true", help="Run Flask in debug mode")
    parser.add_argument("--no-reload", action="store_true", help="Disable Flask's debug reloader")
    parser.add_argument("--no-open", action="store_true", help="Do not open a browser automatically")


def build_parser() -> argparse.ArgumentParser:
    parser = IPABrewArgumentParser(
        prog="ipabrew",
        description="Local CLI for IPABrew reconstruction, IPA utilities, dating, and the web app.",
    )
    subcommands = parser.add_subparsers(
        dest="command",
        parser_class=IPABrewArgumentParser,
    )
    parser._ipabrew_subcommands = subcommands

    help_parser = subcommands.add_parser("help", help="Show general or command-specific help")
    help_parser.add_argument("topic", nargs="?", metavar="COMMAND", help="Command to show help for")
    help_parser.set_defaults(handler=_help)

    web = subcommands.add_parser(
        "web",
        aliases=("app",),
        help="Run the IPABrew Flask web app and open it in a browser",
    )
    _add_web_run_options(web)
    web.set_defaults(handler=_web)

    docs = subcommands.add_parser(
        "docs",
        help="Run the web app and open the in-app docs in a browser",
    )
    _add_web_run_options(docs)
    docs.set_defaults(handler=_docs)

    server = subcommands.add_parser(
        "server",
        aliases=("serve",),
        help="Run the IPABrew Flask web app without opening a browser",
    )
    _add_web_run_options(server)
    server.set_defaults(handler=_server)

    sample = subcommands.add_parser("sample", help="Show sample Romance dataset entries")
    sample.add_argument("--count", type=NonNegativeInt("--count"), default=20)
    sample.add_argument("--offset", type=NonNegativeInt("--offset"), default=0)
    sample.set_defaults(handler=_sample)

    search = subcommands.add_parser("search", help="Search bundled dataset by IPA substring")
    search.add_argument("query", metavar="QUERY")
    search.add_argument("--limit", type=NonNegativeInt("--limit"), default=20)
    search.set_defaults(handler=_search)

    reconstruct = subcommands.add_parser("reconstruct", help="Reconstruct from dataset index or cognate words")
    reconstruct.add_argument("--index", type=NonNegativeInt("--index"))
    reconstruct.add_argument("--words", nargs="+", metavar="WORD")
    reconstruct.add_argument("--languages", nargs="+", metavar="LANG")
    reconstruct.set_defaults(handler=_reconstruct)

    tree = subcommands.add_parser("reconstruct-tree", help="Reconstruct every missing node in a JSON language tree")
    tree.add_argument("--tree-json", required=True, help="Inline JSON object or path to a JSON file")
    tree.add_argument("--method", choices=("ml", "algorithm"), default="ml")
    tree.set_defaults(handler=_reconstruct_tree)

    align = subcommands.add_parser("align", help="Align two or more IPA words")
    align.add_argument("words", nargs="*", metavar="WORD")
    align.set_defaults(handler=_align)

    distance = subcommands.add_parser("distance", help="Compute IPA distance and divergence estimate")
    distance.add_argument("word1", metavar="WORD1")
    distance.add_argument("word2", metavar="WORD2")
    distance.set_defaults(handler=_distance)

    features = subcommands.add_parser("features", help="Show panphon feature vectors for an IPA word")
    features.add_argument("word", metavar="WORD")
    features.set_defaults(handler=_features)

    date = subcommands.add_parser("date", help="Estimate divergence date")
    date_mode = date.add_mutually_exclusive_group(required=True)
    date_mode.add_argument("--cognate-pct", type=float)
    date_mode.add_argument("--ned", type=float)
    date.add_argument("--retention-rate", type=float, default=0.86)
    date.set_defaults(handler=_date)

    model_status = subcommands.add_parser("model-status", help="Report DPD model availability")
    model_status.add_argument("--load", action="store_true", help="Load the model before reporting status")
    model_status.set_defaults(handler=_model_status)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
        if args.command is None:
            _print_quick_help()
            return 0
        result = args.handler(args)
    except SystemExit as exc:
        return int(exc.code or 0)
    except KeyboardInterrupt:
        return 130
    except CliError as exc:
        print(f"ipabrew: error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"ipabrew: error: {exc}", file=sys.stderr)
        return 1

    if isinstance(result, dict):
        _emit_json(result)
        return 0
    if isinstance(result, int):
        return result
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
