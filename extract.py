import json
import re

with open('apps/web/src/data/engineering/field-ticket-records.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the JSON array
match = re.search(r'export const FIELD_TICKET_RECORDS: FieldTicket\[\] = (\[.*\]);?', content, re.DOTALL)
if not match:
    print("Could not find array")
    exit(1)

json_str = match.group(1)
try:
    data = json.loads(json_str)
except Exception as e:
    print("JSON load error:", e)
    exit(1)

texts_to_translate = {}
fields = ['title', 'group', 'symptom', 'location', 'rootNote', 'pastAttempt', 'whyInsufficient', 'fix']

for item in data:
    for field in fields:
        if field in item and isinstance(item[field], str):
            # Only add if there are Turkish characters or we just translate everything
            texts_to_translate[item[field]] = ""

with open('to_translate.json', 'w', encoding='utf-8') as f:
    json.dump(texts_to_translate, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(texts_to_translate)} unique strings.")
