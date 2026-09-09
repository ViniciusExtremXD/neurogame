"""Acquire a pinned public SPL atlas; source volumes stay private."""
from concurrent.futures import ThreadPoolExecutor
import argparse, hashlib, json, pathlib, urllib.request

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache',type=pathlib.Path,default=pathlib.Path('.private-assets/spl-source'))
args=parser.parse_args()
lock=json.loads(pathlib.Path(__file__).with_name('source-lock.json').read_text())
def get(expected):
    path=expected['path']
    dst = args.cache / path
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists():
        req = urllib.request.Request(expected['url'], headers={'User-Agent': 'NeuroGame asset pipeline'})
        with urllib.request.urlopen(req) as response:
            dst.write_bytes(response.read())
    data = dst.read_bytes()
    assert len(data) == expected['bytes'], path
    assert hashlib.sha256(data).hexdigest()==expected['sha256'], f'SHA256 mismatch: {path}'
    git_hash = hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    assert git_hash == expected['gitBlobSha1'], f'Git object mismatch: {path}'
    return expected
if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=12) as pool:
        records = list(pool.map(get, lock['files']))
    print(f'Verified {len(records)} files, {sum(x["bytes"] for x in records):,} bytes')
