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

    # httpx의 상세한 HTTP/2 디버그 로그 억제
    httpx_logger = logging.getLogger("httpx")
    httpx_logger.setLevel(logging.WARNING)

    # hpack 디코딩 로그도 억제
    hpack_logger = logging.getLogger("hpack")
    hpack_logger.setLevel(logging.WARNING)

    # h2 라이브러리 로그도 억제 (HTTP/2 관련)
    h2_logger = logging.getLogger("h2")
    h2_logger.setLevel(logging.WARNING)
