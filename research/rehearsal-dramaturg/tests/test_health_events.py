from datetime import datetime, timedelta, timezone
import pytest
from pydantic import ValidationError
from dramaturg.context.models import Observation
from dramaturg.native_transfer import ValidatedTransfer
from dramaturg.health_events import ThresholdRule, ThresholdInput, RestContext, evaluate

BASE = datetime(2030, 5, 1, 12, tzinfo=timezone.utc)

def sample(t, bpm, id=None, watch=True, source='private-source-canary', quality=None):
    at = BASE+timedelta(seconds=t)
    return Observation.model_validate(dict(id=id or f'private-sample-canary-{t}',source_id=source,source_type='healthkit',event_start=at,event_end=at,received_at=at,original_offset='unknown',semantics='measurement',acquisition='live',provenance='source_recorded',quality=quality if quality is not None else ['recorded_on_apple_watch'] if watch else [],payload=dict(kind='heart_rate',value=bpm)))

def step(rows, rule=None, state=None, now=None, rest=True, deletions=None, mode='healthkit'):
    now = now if now is not None else max((o.event_start-BASE).total_seconds() for o in rows)
    data = dict(rule=rule or ThresholdRule(),batch=ValidatedTransfer(version=1,batch_id='invented',mode=mode,observations=rows,deletions=deletions or []),now=BASE+timedelta(seconds=now),context=RestContext(start=BASE,end=BASE+timedelta(seconds=300)) if rest else None)
    if state is not None: data['state'] = state
    return evaluate(ThresholdInput(**data))

def test_rest_gate_baseline_unset_and_repeated_absolute_markers():
    assert ThresholdRule().resting_baseline_bpm is None
    assert not step([sample(0,130),sample(5,130)],rest=False).events
    first = step([sample(0,120)])
    assert not first.events
    second = step([sample(5,120)],state=first.state)
    assert [e.kind for e in second.events] == ['absolute-high']
    assert second.events[0].sample_count == 2
    assert second.events[0].support == 'repeated-observations'
    assert second.events[0].context == 'author-reported-rest'
    assert not step([sample(0,50),sample(5,50)]).events
    assert [e.kind for e in step([sample(0,49),sample(5,49)]).events] == ['absolute-low']

def test_duplicates_delayed_archive_future_stale_and_deletions_do_not_trigger():
    result = step([sample(0,130),sample(0,130,id='different-id')])
    assert not result.events
    result = step([sample(5,130)],state=result.state)
    assert len(result.events) == 1
    assert not step([sample(5,130)],state=result.state).events
    assert not step([sample(0,130),sample(5,130)],now=300).events
    assert not step([sample(5,130)],now=0).events
    assert not step([sample(0,130),sample(5,130)],deletions=['private-sample-canary-5']).events
    assert not step([sample(0,130),sample(5,130)],mode='simulated').events

def test_watch_preference_phone_fallback_and_live_to_archive_dedup():
    assert not step([sample(0,150,watch=False),sample(0,80)]).events
    rule = ThresholdRule(min_samples=1,rest_only=False)
    watch = step([sample(0,80)],rule=rule,rest=False)
    assert not step([sample(5,150,watch=False)],rule=rule,state=watch.state,rest=False).events
    fallback = step([sample(130,150,watch=False)],rule=rule,state=watch.state,rest=False)
    assert fallback.events[0].source == 'phone-health'
    assert fallback.events[0].context_confounded
    assert fallback.events[0].support == 'single-observation'

def test_gaps_and_source_changes_do_not_prove_persistence_or_recovery():
    rule = ThresholdRule(cooldown_s=0)
    first = step([sample(0,130)],rule=rule)
    gap = step([sample(65,130)],rule=rule,state=first.state)
    assert not gap.events
    crossed = step([sample(70,130)],rule=rule,state=gap.state)
    assert crossed.events
    missing = step([sample(150,130)],rule=rule,state=crossed.state)
    assert not missing.events  # A gap does not re-arm the already high episode.
    recovered = step([sample(155,110)],rule=rule,state=missing.state)
    one = step([sample(160,130)],rule=rule,state=recovered.state)
    assert step([sample(165,130)],rule=rule,state=one.state).events
    switched = step([sample(5,130,source='other-source')],rule=rule,state=first.state)
    assert not switched.events

def test_baseline_sustained_span_and_cooldown_are_supported_by_samples():
    rule = ThresholdRule(resting_baseline_bpm=75,baseline_confirmed=True)
    result = None
    all_events = []
    for t in range(0,301,30):
        result = step([sample(t,105)],rule=rule,state=result.state if result else None)
        all_events.extend(result.events)
    assert [e.kind for e in all_events] == ['relative-elevation','sustained-change']
    assert (all_events[-1].measured_end-all_events[-1].measured_start).total_seconds() == 300
    assert not any(e.kind.startswith('absolute') for e in all_events)
    short_context = RestContext(start=BASE+timedelta(seconds=5),end=BASE+timedelta(seconds=300))
    data = ThresholdInput(rule=rule,batch=ValidatedTransfer(version=1,batch_id='invented',mode='healthkit',observations=[sample(0,150),sample(5,150)],deletions=[]),now=BASE+timedelta(seconds=5),context=short_context)
    assert not evaluate(data).events  # Rest confirmation cannot retroactively label earlier data.

def test_rapid_change_requires_same_watch_source_time_order_and_quality():
    rule = ThresholdRule(rest_only=False)
    result = step([sample(0,70),sample(100,105)],rule=rule,rest=False)
    rapid = [e for e in result.events if e.kind=='rapid-change']
    assert len(rapid) == 1 and rapid[0].extreme_bpm == 35
    assert rapid[0].support == 'observed-delta' and rapid[0].context_confounded
    for rows in ([sample(0,70),sample(121,105)], [sample(0,70),sample(100,105,source='other')], [sample(0,70,watch=False),sample(100,105,watch=False)], [sample(0,70),sample(100,105,quality=['recorded_on_apple_watch','poor_signal'])]):
        assert not step(rows,rule=rule,rest=False).events
    assert 'private-source-canary' not in result.model_dump_json()
    assert 'private-sample-canary' not in result.model_dump_json()

def test_invalid_personal_baseline_or_rule_is_rejected():
    for raw in ({'lower_bpm':130,'upper_bpm':100},{'resting_baseline_bpm':75},{'lower_bpm':float('nan')},{'unknown':True},{'grouping_s':0}):
        with pytest.raises(ValidationError): ThresholdRule.model_validate(raw)

def test_recovery_does_not_defeat_cooldown_and_rest_context_is_bounded():
    rule = ThresholdRule(min_samples=1, rest_only=False)
    first = step([sample(0,130)], rule=rule, rest=False)
    recovered = step([sample(10,110)], rule=rule, state=first.state, rest=False)
    too_soon = step([sample(20,130)], rule=rule, state=recovered.state, rest=False)
    assert not too_soon.events
    after_cooldown = step([sample(301,130)], rule=rule, state=too_soon.state, rest=False)
    assert [e.kind for e in after_cooldown.events] == ['absolute-high']
    with pytest.raises(ValidationError):
        RestContext(start=BASE,end=BASE+timedelta(seconds=601))

def test_poor_signal_breaks_support_and_comparison_even_across_arrivals():
    first = step([sample(0,130)])
    poor = step([sample(5,80,quality=['recorded_on_apple_watch','poor_signal'])],state=first.state)
    assert not poor.events
    next_good = step([sample(10,130)],state=poor.state)
    assert not next_good.events  # The first good sample after the break starts fresh.
    assert [e.kind for e in step([sample(15,130)],state=next_good.state).events] == ['absolute-high']
