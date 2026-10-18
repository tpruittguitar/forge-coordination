"""Validate serialized producer bytes before queue creation; never submits a request."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

from build_runtime import validate_payload

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('payload',type=Path)
    parser.add_argument('--accounting',type=Path,help='Separate disposition counters; not sent to Writer')
    args=parser.parse_args()
    try:
        data=args.payload.read_bytes()
        payload=json.loads(data.decode('utf-8'))
        accounting=json.loads(args.accounting.read_text(encoding='utf-8')) if args.accounting else None
        validate_payload(payload,accounting)
    except (ValueError,OSError,KeyError,TypeError) as exc:
        print('PAYLOAD INVALID: '+str(exc),file=sys.stderr)
        sys.exit(1)
    print(f'PAYLOAD VALID bytes={len(data)} sha256={hashlib.sha256(data).hexdigest()}')
