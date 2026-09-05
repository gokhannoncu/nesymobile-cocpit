#!/usr/bin/env python3
"""Analyze exported host spans. Raw inclusive sums are never added together."""
import argparse, json, collections, statistics
from pathlib import Path

def union_ms(ranges):
    total=0.; end=float('-inf')
    for a,b in sorted(ranges):
        total+=max(0.,b-max(a,end)); end=max(end,b)
    return total

def analyze(folder):
    events=[json.loads(l) for l in (folder/'events.jsonl').read_text().splitlines()]
    root=next(e for e in events if e['name']=='run.total')
    groups=collections.defaultdict(list)
    for e in events:groups[e['name']].append(e)
    def duration_union(es):return union_ms([(e['startMs'],e['startMs']+e['durationMs']) for e in es])
    categories={
        'db': [e for e in events if e['name'].startswith('db.')],
        'bridge_client': groups['bridge.client_request'],
        'sdk_control': groups['sdk.control'],
        'adb_control': groups['adb.control_command'],
        'oracle': groups['oracle.continue_gate']+groups['oracle.final'],
        'remote_port': groups['port.remoteRuntime.execute'],
    }
    wall={k:duration_union(es) for k,es in categories.items()}
    # Parent+child durations overlap. Per-step union gives distinct DB occupancy,
    # while other categories retain explicitly inclusive labels.
    steps=[]
    for step in sorted(groups['executor.step'],key=lambda e:e['startMs']):
        sid=step['attrs']['stepId']; a=step['startMs']; b=a+step['durationMs']
        within=lambda es:[(max(a,e['startMs']),min(b,e['startMs']+e['durationMs'])) for e in es
                          if e['startMs']<b and e['startMs']+e['durationMs']>a]
        steps.append({'stepId':sid,'durationMs':step['durationMs'],
                      **{k+'Ms':union_ms(within(es)) for k,es in categories.items()}})
    commands=collections.defaultdict(list)
    for e in categories['bridge_client']:commands[e['attrs'].get('command','unknown')].append(e['durationMs'])
    sqls=collections.Counter(e['name'] for e in events if e['name'].startswith('db.') and e['name']!='db.transaction')
    result={'runDurationMs':root['durationMs'],'categoryUnionMs':wall,
            'allMeasuredCategoryUnionMs':duration_union([e for es in categories.values() for e in es]),
            'commands':{k:{'count':len(v),'totalMs':sum(v),'p50Ms':statistics.median(v),
                           'maxMs':max(v)} for k,v in commands.items()},
            'dbCallCounts':dict(sqls),'steps':steps,
            'limitations':['Category unions may overlap each other; do not sum.',
              'DB includes client/transport/transaction/lock time, not server CPU alone.',
              'Bridge client includes pool/transport/device execution, not gesture alone.',
              'SDK control includes ADB; SDK pure in-app CPU is not inferred.',
              'Only work in the run async context is attributed; background workers can contend outside it.']}
    (folder/'analysis.json').write_text(json.dumps(result,indent=2))
    lines=['# Gerçek koşu performans tablosu','',
           f"Run: {folder.name}",'',f"Profil kapsamı: {root['durationMs']/1000:.3f} saniye.",'',
           '## Katmanların kapsadığı duvar saati aralıkları','',
           'Satırlar iç içe olabilir; birbirine eklenmez.','',
           '| Katman | Süre (sn) |','|---|---:|']
    lines += [f'| {k} | {v/1000:.3f} |' for k,v in wall.items()]
    lines += ['','## Gerçek Bridge istekleri','',
              '| Komut | Adet | Toplam ms | Medyan ms | En büyük ms |','|---|---:|---:|---:|---:|']
    lines += [f"| {k} | {v['count']} | {v['totalMs']:.1f} | {v['p50Ms']:.1f} | {v['maxMs']:.1f} |" for k,v in result['commands'].items()]
    lines += ['','## Adımlar','',
              '| Adım | Toplam ms | DB ms | Bridge ms | SDK ms | Oracle ms |',
              '|---|---:|---:|---:|---:|---:|']
    lines += [f"| {s['stepId']} | {s['durationMs']:.1f} | {s['dbMs']:.1f} | {s['bridge_clientMs']:.1f} | {s['sdk_controlMs']:.1f} | {s['oracleMs']:.1f} |" for s in steps]
    lines += ['','## Sınırlar','']+['- '+s for s in result['limitations']]
    (folder/'TIMINGS.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ['steps','dbCallCounts']},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('folder',type=Path);ns=parser.parse_args()
    analyze(ns.folder)
