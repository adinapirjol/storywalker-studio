"""Bounded, streaming, review-only Health export adapter. No persistence or alerts."""
from datetime import datetime
from hashlib import sha256
from pathlib import PurePosixPath
from zipfile import ZipFile
from defusedxml.ElementTree import iterparse
from .models import Observation, Heart
MAX_BYTES=256*1024*1024
MAX_RECORDS=1_000_000
class LimitedReader:
    def __init__(self,stream):self.stream=stream;self.count=0
    def read(self,size=-1):
        data=self.stream.read(min(size if size>=0 else 65536,65536));self.count+=len(data)
        if self.count>MAX_BYTES:raise ValueError('import_byte_limit')
        return data

def stream_heart_records(stream,cancelled=lambda:False):
    reader=LimitedReader(stream);count=0
    for event,element in iterparse(reader,events=('end',),forbid_dtd=True,forbid_entities=True,forbid_external=True):
        if cancelled():raise ValueError('import_cancelled')
        if element.tag=='Record':
            count+=1
            if count>MAX_RECORDS:raise ValueError('import_record_limit')
            attrs=element.attrib
            if attrs.get('type')=='HKQuantityTypeIdentifierHeartRate':
                if attrs.get('unit')!='count/min':raise ValueError('unsupported_unit')
                start=datetime.strptime(attrs['startDate'],'%Y-%m-%d %H:%M:%S %z')
                end=datetime.strptime(attrs['endDate'],'%Y-%m-%d %H:%M:%S %z')
                received=datetime.strptime(attrs.get('creationDate',attrs['endDate']),'%Y-%m-%d %H:%M:%S %z')
                source=attrs.get('sourceName','unknown')
                identity=sha256(str(sorted(attrs.items())).encode()).hexdigest()
                yield Observation(id=identity,source_type='apple_health_export',source_id='apple-health:'+sha256(source.encode()).hexdigest()[:16],source_revision=attrs.get('sourceVersion','unknown'),event_start=start,event_end=end,received_at=received,original_offset=start.strftime('%z'),semantics='measurement',acquisition='historical',provenance='source_recorded',payload=Heart(value=float(attrs['value'])))
        element.clear()

def stream_archive(path,cancelled=lambda:False):
    with ZipFile(path) as archive:
        entries=archive.infolist()
        if len(entries)>2048:raise ValueError('archive_entry_limit')
        for entry in entries:
            p=PurePosixPath(entry.filename)
            if p.is_absolute() or '..' in p.parts or '\\' in entry.filename or (entry.external_attr>>16)&0o170000==0o120000:raise ValueError('unsafe_archive_path')
            if entry.file_size>MAX_BYTES:raise ValueError('archive_size_limit')
        xml=[e for e in entries if e.filename in ('export.xml','apple_health_export/export.xml')]
        if len(xml)!=1:raise ValueError('missing_export')
        with archive.open(xml[0]) as stream:yield from stream_heart_records(stream,cancelled)
