#!/bin/bash
/usr/local/bin/xray run -config /tmp/test-client.json > /tmp/client.log 2>&1 &
PID=$!
sleep 2
curl -x socks5://127.0.0.1:10808 -Iv --connect-timeout 5 https://www.google.com/generate_204
kill $PID
cat /tmp/client.log
