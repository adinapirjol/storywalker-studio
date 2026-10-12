"""Compare private Spotify Labs occurrence exports without inferring history.

Usage: python3 scripts/spotify-snapshot-diff.py BEFORE AFTER OUTPUT
Writes exclusively (never overwrites). Output is deterministic for identical bytes.
"""
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


def instant(value):
    if value is None:
        return None
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.utcoffset() is None:
        raise ValueError('Timestamp must include a timezone')
    return parsed.timestamp()


def validate(snapshot):
    rows = snapshot['occurrences']
    metadata = snapshot.get('metadata', snapshot)
    playlist_id = metadata['playlistId']
    if sorted(row['position'] for row in rows) != list(range(len(rows))):
        raise ValueError('Positions must cover 0 through occurrence count minus one')
    for row in rows:
        if row['playlistId'] != playlist_id:
            raise ValueError('Mixed playlist identities')
        if instant(row['addedAtUtc']) != instant(row['addedAt']):
            raise ValueError('UTC timestamp differs from source added_at')
    return playlist_id


def identity(row):
    # Local and unavailable items have no stable Spotify ID: explicitly heuristic.
    track = ('id', row['trackId']) if row['trackId'] else (
        'fallback', row['spotifyUrl'], row['trackName'],
        tuple(row['artistNames']), row['albumName'], row['isLocal'])
    return track, instant(row['addedAtUtc'])


def compare(before, after):
    playlist_id = validate(before)
    if validate(after) != playlist_id:
        raise ValueError('Snapshots belong to different playlists')
    groups = []
    for snapshot in (before, after):
        grouped = defaultdict(list)
        for row in sorted(snapshot['occurrences'], key=lambda row: row['position']):
            grouped[identity(row)].append(row)
        groups.append(grouped)
    old, new = groups
    added, removed, retained, ambiguous = [], [], [], []
    for key in sorted(old.keys() | new.keys(), key=repr):
        left, right = old.get(key, []), new.get(key, [])
        matched = min(len(left), len(right))
        if max(len(left), len(right)) > 1:
            ambiguous.append({'beforePositions': [r['position'] for r in left],
                              'afterPositions': [r['position'] for r in right],
                              'matchedCount': matched})
        for a, b in zip(left, right):
            changed = [field for field in sorted(a.keys() | b.keys())
                       if field not in ('position', 'addedAt', 'addedAtUtc', 'addedAtLocal')
                       and a.get(field) != b.get(field)]
            retained.append({'beforePosition': a['position'], 'afterPosition': b['position'],
                             'positionChanged': a['position'] != b['position'],
                             'metadataChangedFields': changed, 'before': a, 'after': b})
        removed.extend(left[matched:])
        added.extend(right[matched:])
    added.sort(key=lambda r: r['position'])
    removed.sort(key=lambda r: r['position'])
    retained.sort(key=lambda r: r['beforePosition'])
    counts = [Counter(r['trackId'] for r in s['occurrences'] if r['trackId'])
              for s in (before, after)]
    duplicate_changes = [
        {'trackId': key, 'beforeCount': counts[0][key], 'afterCount': counts[1][key]}
        for key in sorted(counts[0].keys() | counts[1].keys())
        if counts[0][key] != counts[1][key] and max(counts[0][key], counts[1][key]) > 1]
    return {
        'diffVersion': 1, 'playlistId': playlist_id, 'timezone': 'Europe/Bucharest',
        'matching': {
            'key': ['trackId', 'addedAtUtc'], 'timestampComparison': 'UTC instant',
            'duplicatePairing': 'ascending position within identical identity and timestamp',
            'missingIdFallback': ['spotifyUrl', 'trackName', 'artistNames', 'albumName', 'isLocal'],
            'limitations': [
                'Matching is observational; Spotify does not expose persistent occurrence IDs.',
                'Identical keys are paired deterministically, not proven to be the same occurrence.',
                'Position changes can result from insertions or removals; they do not prove manual reordering.',
                'An unmatched occurrence is a snapshot difference, not a dated removal or listening event.',
                'Changes to track identity or addition timestamp appear as removal and addition.'
            ]},
        'summary': {
            'beforeOccurrenceCount': len(before['occurrences']),
            'afterOccurrenceCount': len(after['occurrences']),
            'addedOccurrenceCount': len(added), 'removedOccurrenceCount': len(removed),
            'retainedOccurrenceCount': len(retained),
            'positionChangedOccurrenceCount': sum(r['positionChanged'] for r in retained),
            'metadataChangedOccurrenceCount': sum(bool(r['metadataChangedFields']) for r in retained),
            'beforeUniqueTrackIdCount': len(counts[0]), 'afterUniqueTrackIdCount': len(counts[1]),
            'beforeDuplicateOccurrenceCount': sum(c - 1 for c in counts[0].values()),
            'afterDuplicateOccurrenceCount': sum(c - 1 for c in counts[1].values()),
            'beforeMissingTimestampCount': sum(r['addedAtUtc'] is None for r in before['occurrences']),
            'afterMissingTimestampCount': sum(r['addedAtUtc'] is None for r in after['occurrences']),
        },
        'addedOccurrences': added, 'removedOccurrences': removed,
        'retainedOccurrences': retained, 'duplicateCountChanges': duplicate_changes,
        'diagnostics': {
            'ambiguousIdentityGroups': ambiguous,
            'beforeFallbackIdentityPositions': [r['position'] for r in before['occurrences'] if not r['trackId']],
            'afterFallbackIdentityPositions': [r['position'] for r in after['occurrences'] if not r['trackId']],
        },
    }


def build(before_path, after_path):
    paths = [Path(before_path), Path(after_path)]
    raw = [p.read_bytes() for p in paths]
    snapshots = [json.loads(data) for data in raw]
    result = compare(*snapshots)
    result['sources'] = {
        label: {'filename': path.name, 'sha256': hashlib.sha256(data).hexdigest(),
                'generatedAt': snapshot.get('generatedAt', snapshot.get('exportedAt'))}
        for label, path, data, snapshot in zip(('before', 'after'), paths, raw, snapshots)
    }
    return (json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode()


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    payload = build(sys.argv[1], sys.argv[2])
    import os
    with os.fdopen(os.open(sys.argv[3], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as output:
        output.write(payload)
    print(json.dumps(json.loads(payload)['summary'], indent=2))
