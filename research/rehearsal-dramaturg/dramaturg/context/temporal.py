"""Bounded persisted indexes, selected interval queries; no whole-Vault traversal."""
from bisect import bisect_left, bisect_right
from datetime import timedelta
class TemporalIndex:
    def __init__(self,state):
        self.records={o.id:o for o in state.observations}
        self.start_ids=state.event_index
        self.end_ids=state.end_index
        self.starts=[self.records[id].event_start for id in self.start_ids]
        self.ends=[self.records[id].event_end for id in self.end_ids]
    def window(self,start,end,trigger,tolerance=5):
        before=set(self.start_ids[:bisect_right(self.starts,end+timedelta(seconds=tolerance))])
        after=set(self.end_ids[bisect_left(self.ends,start-timedelta(seconds=tolerance)):])
        ids=before&after
        # Carry forward only a permitted approximate location and expose its age.
        for id in self.start_ids[bisect_left(self.starts,trigger-timedelta(seconds=120)):bisect_right(self.starts,trigger)]:
            if self.records[id].payload.kind=='location':ids.add(id)
        return [self.records[id] for id in self.start_ids if id in ids]
