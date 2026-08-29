#!/usr/bin/env python3
"""
Hourly PostHog ingestion monitor for tenant401.com and stillplaying.music.

Queries PostHog project 544341 for real (non-canary) events from each site
in the last 2 hours. Writes failure state to a JSON artifact so consecutive
failures can be detected across runs.

Exits 0 if both sites have events (or fewer than 2 consecutive failures).
Exits 1 if either site has 2+ consecutive zero-event periods — triggers
GitHub Actions alert notification.

Environment variables:
  POSTHOG_PERSONAL_KEY=phx_...  (personal key — read)
  STATE_FILE  (optional path for state JSON; defaults to /tmp/monitor-state.json)
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

PROJECT_ID = 544341
QUERY_URL = f'https://us.posthog.com/api/projects/{PROJECT_ID}/query/'
HOSTS = {
    'tenant401.com': {
        'label': 'tenant401',
        'window_hours': 2,
        'max_consecutive_failures': 2,
    },
    'stillplaying.music': {
        'label': 'stillplaying',
        'window_hours': 4,      # lower-traffic site; wider window
        'max_consecutive_failures': 2,
    },
}
STATE_FILE = os.environ.get('STATE_FILE', '/tmp/monitor-state.json')


def log(msg):
    ts = datetime.now(timezone.utc).strftime('%H:%M:%S')
    print(f'[monitor {ts}] {msg}', flush=True)


def query_event_count(personal_key, host, window_hours):
    q = (
        f"SELECT count() FROM events "
        f"WHERE properties.\\$host = '{host}' "
        f"AND properties.is_test IS NULL OR properties.is_test = false "
        f"AND event != 'analytics_canary' "
        f"AND timestamp >= now() - interval {window_hours} hour"
    )
    payload = json.dumps({'query': {'kind': 'HogQLQuery', 'query': q}}).encode()
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
        return int(rows[0][0]) if rows else 0
    except Exception as e:
        log(f'WARN query error for {host}: {e}')
        return None  # None = query error, treat as failure


def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(state):
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        log(f'WARN could not save state: {e}')


def main():
    personal_key = os.environ.get('POSTHOG_PERSONAL_KEY', '').strip()
    if not personal_key:
        log('ERROR POSTHOG_PERSONAL_KEY must be set')
        sys.exit(1)

    state = load_state()
    alert = False
    now_iso = datetime.now(timezone.utc).isoformat()

    for host, cfg in HOSTS.items():
        label = cfg['label']
        window = cfg['window_hours']
        max_fails = cfg['max_consecutive_failures']

        count = query_event_count(personal_key, host, window)
        host_state = state.get(host, {'consecutive_failures': 0})

        if count is None:
            # Query error — treat as zero
            log(f'{label}: query error — treating as failure')
            host_state['consecutive_failures'] = host_state.get('consecutive_failures', 0) + 1
        elif count > 0:
            log(f'{label}: {count} events in last {window}h ✓ (resetting failure count)')
            host_state['consecutive_failures'] = 0
        else:
            host_state['consecutive_failures'] = host_state.get('consecutive_failures', 0) + 1
            log(f'{label}: 0 events in last {window}h (consecutive failures: {host_state["consecutive_failures"]})')

        host_state['last_checked'] = now_iso
        host_state['last_count'] = count
        state[host] = host_state

        if host_state['consecutive_failures'] >= max_fails:
            log(f'ALERT {label}: {host_state["consecutive_failures"]} consecutive zero-event periods — pipeline may be broken')
            alert = True

    save_state(state)

    if alert:
        log('Exiting 1 — alert triggered')
        sys.exit(1)

    log('All sites healthy — exiting 0')
    sys.exit(0)


if __name__ == '__main__':
    main()
