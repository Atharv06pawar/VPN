#!/bin/bash
/usr/local/bin/xray run -config /tmp/test-client.json > /tmp/client.log 2>&1 &
PID=$!
sleep 2
curl -4 -x socks5h://127.0.0.1:10808 -Iv --connect-timeout 8 https://cp.cloudflare.com/generate_204
kill $PID
cat /tmp/client.log
