#!/usr/bin/env python3
"""
PostHog deployment canary for tenant401.com.

Sends an analytics_canary event directly to PostHog and polls for its
arrival using HogQL. Exits 0 if confirmed, exits 1 if not seen within
the timeout — which means the analytics pipeline is broken.

Usage:
  POSTHOG_API_KEY=phc_...  (project token — write)
  POSTHOG_PERSONAL_KEY=phx_...  (personal key — read)
  python3 scripts/posthog-canary.py

Environment variables are read from the environment (set as GitHub Actions secrets).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import timezone, datetime

PROJECT_ID = 544341
CAPTURE_URL = 'https://a.tenant401.com/i/v0/e'   # via first-party proxy
QUERY_URL = f'https://us.posthog.com/api/projects/{PROJECT_ID}/query/'
POLL_INTERVAL = 30   # seconds between readback polls
MAX_WAIT = 300       # 5 minutes total

def log(msg):
    ts = datetime.now(timezone.utc).strftime('%H:%M:%S')
    print(f'[canary {ts}] {msg}', flush=True)


def send_canary(api_key, run_id):
    payload = json.dumps({
        'api_key': api_key,
        'event': 'analytics_canary',
        'distinct_id': f'canary-{run_id}',
        'properties': {
            '$process_person_profile': False,
            '$host': 'tenant401.com',
            'is_test': True,
            'surface': 'canary',
            'monitor_run_id': run_id,
        },
    }).encode()
    req = urllib.request.Request(
        CAPTURE_URL, data=payload, method='POST',
        headers={'Content-Type': 'application/json'},
    )
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        if not resp.status == 200:
            log(f'WARN capture returned HTTP {resp.status}')
    except urllib.error.HTTPError as e:
        log(f'ERROR capture HTTP {e.code}: {e.read().decode()[:200]}')
        sys.exit(1)
    except Exception as e:
        log(f'ERROR capture exception: {e}')
        sys.exit(1)


def poll_readback(personal_key, run_id):
    query = {
        'query': {
            'kind': 'HogQLQuery',
            'query': (
                "SELECT count() FROM events "
                "WHERE event = 'analytics_canary' "
                f"AND properties.monitor_run_id = '{run_id}' "
                "AND timestamp >= now() - interval 10 minute"
            ),
        }
    }
    payload = json.dumps(query).encode()
    req = urllib.request.Request(
        QUERY_URL, data=payload, method='POST',
        headers={
            'Authorization': f'Bearer {personal_key}',
            'Content-Type': 'application/json',
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        data = json.loads(resp.read())
        rows = data.get('results', [])
        count = rows[0][0] if rows else 0
        return int(count) > 0
    except Exception as e:
        log(f'WARN readback error (will retry): {e}')
        return False


def main():
    api_key = os.environ.get('POSTHOG_API_KEY', '').strip()
    personal_key = os.environ.get('POSTHOG_PERSONAL_KEY', '').strip()

    if not api_key or not personal_key:
        log('ERROR POSTHOG_API_KEY and POSTHOG_PERSONAL_KEY must be set')
        sys.exit(1)

    # Unique run ID: timestamp + 6-char suffix
    run_id = f'{int(time.time())}-{os.urandom(3).hex()}'
    log(f'Starting canary run_id={run_id}')

    log('Sending analytics_canary event...')
    send_canary(api_key, run_id)
    log('Event sent. Polling PostHog for readback...')

    deadline = time.time() + MAX_WAIT
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        time.sleep(POLL_INTERVAL)
        elapsed = int(time.time() - (deadline - MAX_WAIT))
        log(f'Poll {attempt} ({elapsed}s elapsed)...')
        if poll_readback(personal_key, run_id):
            log(f'✓ Canary event confirmed in PostHog after {elapsed}s')
            sys.exit(0)

    log(f'✗ Canary event NOT seen in PostHog after {MAX_WAIT}s — analytics pipeline may be broken')
    sys.exit(1)


if __name__ == '__main__':
    main()
