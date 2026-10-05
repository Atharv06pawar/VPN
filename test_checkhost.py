import urllib.request
import json
import time

req = urllib.request.Request('https://check-host.net/check-tcp?host=137.23.44.209:443&max_nodes=10', headers={'Accept': 'application/json', 'User-Agent': 'curl/8.0'})
res = urllib.request.urlopen(req)
data = json.loads(res.read())
req_id = data['request_id']
time.sleep(5)
res2 = urllib.request.urlopen(f'https://check-host.net/check-result/{req_id}')
data2 = json.loads(res2.read())
for k, v in data2.items():
    print(k, v)
