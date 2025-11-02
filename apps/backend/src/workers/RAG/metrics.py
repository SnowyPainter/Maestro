from __future__ import annotations

import os
import socket
import threading
from typing import Callable

_MULTIPROC_DIR = os.getenv("PROMETHEUS_MULTIPROC_DIR")
if not _MULTIPROC_DIR:
    _MULTIPROC_DIR = ".prometheus-multiproc"
    os.environ["PROMETHEUS_MULTIPROC_DIR"] = _MULTIPROC_DIR

from prometheus_client import CollectorRegistry, Counter, Histogram, multiprocess, start_http_server
def _create_counter(name: str, documentation: str, labelnames: tuple[str, ...] = ()) -> Callable:
    if Counter is None:
        def noop_counter(*_args, **_kwargs):
            return noop_counter

        def noop(*_args, **_kwargs):
            return None

        return noop

    metric = Counter(name, documentation, labelnames=labelnames)

    def observe(*labelvalues: str):
        if labelnames:
            metric.labels(*labelvalues).inc()
        else:
            metric.inc()
        return None
    return observe


def _create_histogram(name: str, documentation: str, labelnames: tuple[str, ...] = ()):
    if Histogram is None:
        class _Noop:
            def labels(self, *_args, **_kwargs):
                return self

            def time(self):
                class _Ctx:
                    def __enter__(self): return self
                    def __exit__(self, exc_type, exc, tb): return False
                return _Ctx()

            def observe(self, *_args, **_kwargs):
                return None
        return _Noop()

    return Histogram(name, documentation, labelnames=labelnames)


NODE_PROCESSED = _create_counter(
    "rag_nodes_processed_total",
    "Number of graph nodes processed by the sidecar",
    labelnames=("node_type", "status"),
)

EMBEDDING_FAILURES = _create_counter(
    "rag_embeddings_failures_total",
    "Number of embedding failures observed during sidecar processing",
    labelnames=("node_type",),
)

WATCH_DURATION = _create_histogram(
    "rag_watch_duration_seconds",
    "Watcher task duration in seconds",
    labelnames=("watcher",),
)

_METRICS_SERVER_STARTED = False
_LOCK = threading.Lock()


def _is_port_in_use(port: int) -> bool:
    """Check if a port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("localhost", port))
            return False
        except OSError:
            return True


def ensure_metrics_server() -> None:
    global _METRICS_SERVER_STARTED
    if Counter is None or start_http_server is None:
        return
    if _METRICS_SERVER_STARTED:
        return
    with _LOCK:
        if _METRICS_SERVER_STARTED:
            return
        port_str = os.getenv("MAESTRO_SIDECAR_METRICS_PORT", "9600")
        try:
            port = int(port_str)
        except ValueError:
            port = 9600

        # Check if port is already in use (server might be running from another process)
        if _is_port_in_use(port):
            print(f"Metrics server port {port} already in use, skipping server start")
            _METRICS_SERVER_STARTED = True  # Mark as started to prevent further attempts
            return

        registry: CollectorRegistry | None = None
        multiproc_dir = os.environ.get("PROMETHEUS_MULTIPROC_DIR")
        if multiproc_dir:
            os.makedirs(multiproc_dir, exist_ok=True)
            # Clean up stale metric files before starting
            for filename in os.listdir(multiproc_dir):
                filepath = os.path.join(multiproc_dir, filename)
                try:
                    if os.path.isfile(filepath):
                        os.remove(filepath)
                except OSError:
                    pass
            registry = CollectorRegistry()
            multiprocess.MultiProcessCollector(registry)

        try:
            start_http_server(port, registry=registry)
            _METRICS_SERVER_STARTED = True
        except OSError as e:
            print(f"Failed to start metrics server on port {port}: {e}")
            # Don't set _METRICS_SERVER_STARTED = True here so it will retry next time
