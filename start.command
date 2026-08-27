#!/bin/bash
# CAwiki 실행 — 더블클릭하면 정적 서버를 띄우고 브라우저를 엽니다.
#
# 왜 서버가 필요한가:
#   이 프로젝트는 ES 모듈(<script type="module">)을 쓰는데,
#   브라우저는 file:// 에서 모듈 로딩을 CORS 정책으로 차단합니다.
#   그래서 index.html을 직접 더블클릭하면 백지가 됩니다.

cd "$(dirname "$0")" || exit 1

PORT=4173
# 이미 떠 있으면 그 서버를 쓰고, 아니면 빈 포트를 찾는다
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  if curl -s -o /dev/null "http://localhost:$PORT/index.html"; then
    echo "이미 실행 중인 서버를 사용합니다 → http://localhost:$PORT"
    open "http://localhost:$PORT/index.html"
    exit 0
  fi
  PORT=$((PORT + 1))
done

echo "CAwiki 서버 시작 → http://localhost:$PORT"
echo "종료하려면 이 창에서 Control-C 를 누르세요."
echo

python3 serve.py "$PORT" &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

sleep 1
open "http://localhost:$PORT/index.html"
wait $SERVER_PID
