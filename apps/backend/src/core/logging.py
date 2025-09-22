import logging, sys

def setup_logging(level=logging.DEBUG):
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        ))
        root.addHandler(handler)
    root.setLevel(level)
