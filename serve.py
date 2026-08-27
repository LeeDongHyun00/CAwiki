#!/usr/bin/env python3
"""CAwiki 개발 서버 — 정적 파일을 캐시 없이 제공한다.

python -m http.server 는 Cache-Control 헤더를 보내지 않아,
브라우저가 ES 모듈(.js)을 메모리 캐시에 붙들고 재검증하지 않는 일이 있다.
그러면 파일을 고쳐도 새로고침 때 옛 코드가 그대로 실행된다.
이 서버는 no-store 를 붙여 매번 최신 파일을 강제한다 (개발 전용).
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 조용히

if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
        print(f"CAwiki (no-cache) → http://localhost:{PORT}")
        print("종료: Control-C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버 종료")
