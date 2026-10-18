"""Read-only verification of the teammate's CSV/workbook mirrors (Python stdlib only)."""
from pathlib import Path
import csv
import json
import zipfile
import xml.etree.ElementTree as ET

root = Path('data')
checks = []
failures = []

def check(name, predicate):
    (checks if predicate else failures).append(name)


def load_json(path):
    return json.loads(path.read_text())


def load_csv(path):
    with path.open(newline='', encoding='utf-8-sig') as handle:
        return list(csv.DictReader(handle))


def normalized(value):
    if value is None:
        return ''
    if isinstance(value, list):
        return '|'.join(map(str, value))
    if isinstance(value, bool):
        return str(value).lower()
    return str(value)

for name in ['courses', 'sections', 'info_winter_inventory']:
    rows = load_csv(root / 'target_courses' / (name + '.csv'))
    records = load_json(root / 'target_courses' / (name + '.json'))
    check(name + ': CSV/JSON row count', len(rows) == len(records))
    mismatches = []
    for index, (row, record) in enumerate(zip(rows, records)):
        for key, value in row.items():
            if normalized(record.get(key)) != value:
                try:
                    equal = float(value) == float(record[key])
                except (TypeError, ValueError, KeyError):
                    equal = False
                if not equal:
                    mismatches.append((index, key))
    check(name + ': CSV/JSON field parity', not mismatches)
    if mismatches:
        print(name, 'mismatches:', mismatches[:10])

rules = load_json(root / 'target_courses/prerequisites.json')
rows = load_csv(root / 'target_courses/prerequisites.csv')
expected_count = sum(max(1, len(branch['all_of'])) for rule in rules.values() for branch in rule['any_of'])
check('prerequisites: flattened CSV row count preserves all alternatives', len(rows) == expected_count)
for course_id, rule in rules.items():
    course_rows = [row for row in rows if row['course_id'] == course_id]
    groups = list(dict.fromkeys(row['alternative_group'] for row in course_rows))
    check(course_id + ': CSV prerequisite alternative count', len(groups) == len(rule['any_of']))
    for group, branch in zip(groups, rule['any_of']):
        entries = [row for row in course_rows if row['alternative_group'] == group]
        actual = {row['required_course_id'] for row in entries if row['required_course_id']}
        check(course_id + '/' + group + ': AND members', actual == set(branch['all_of']))
        for row in entries:
            identifier = row['required_course_id']
            expected_grade = branch.get('min_grades', {}).get(identifier)
            actual_grade = None if not row['min_grade'] else float(row['min_grade'])
            check(course_id + '/' + group + '/' + identifier + ': grade', actual_grade == expected_grade)
            expected_concurrent = identifier in branch.get('concurrent_allowed', [])
            check(course_id + '/' + group + '/' + identifier + ': concurrency', (row['concurrent_allowed'].lower() in ['true', '1', 'yes']) == expected_concurrent)

major = load_json(root / 'major_requirements/major_requirements.json')
source_ids = {row['source_id'] for row in major['source_registry']}
rule_ids = {row['rule_id'] for row in major['requirements']}
for path in (root / 'major_requirements').glob('*.csv'):
    rows = load_csv(path)
    check(path.name + ': readable nonempty CSV', bool(rows))
    if path.name == 'requirement_groups.csv':
        check(path.name + ': complete group IDs', {r['rule_id'] for r in rows} == rule_ids)
    if path.name == 'requirement_course_map.csv':
        check(path.name + ': mapped rules exist', all(r['rule_id'] in rule_ids for r in rows))
    if path.name == 'policy_sources.csv':
        check(path.name + ': registry IDs preserved', {r['source_id'] for r in rows} == source_ids)

workbooks = []
for path in root.rglob('*.xlsx'):
    with zipfile.ZipFile(path) as archive:
        check(str(path) + ': ZIP CRC integrity', archive.testzip() is None)
        sheets = [name for name in archive.namelist() if name.startswith('xl/worksheets/') and name.endswith('.xml')]
        formula_errors = 0
        for name in sheets:
            sheet = ET.fromstring(archive.read(name))
            formula_errors += sum(cell.get('t') == 'e' for cell in sheet.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'))
        check(str(path) + ': no stored Excel error cells', formula_errors == 0)
        workbooks.append({'path': str(path), 'worksheet_xml_count': len(sheets), 'stored_error_cells': formula_errors})

result = {'passed': len(checks), 'failed': len(failures), 'failures': failures, 'workbooks': workbooks,
          'scope': 'CSV parity, prerequisite semantics, references, XLSX structural integrity; no full spreadsheet calculation or degree-audit engine.'}
Path('docs/reports/backend-data-artifacts.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
if failures:
    raise SystemExit(1)
