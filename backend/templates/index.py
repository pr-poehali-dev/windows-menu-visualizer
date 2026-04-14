"""
Управление шаблонами INI-файлов.
GET  / — список всех шаблонов со структурой (секции + параметры)
POST / — сохранить секции и параметры шаблона
"""
import json
import os
import psycopg2

SCHEMA = 't_p50847085_windows_menu_visuali'
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    if method == 'GET':
        return get_templates()

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        return save_template(body)

    return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}


def get_templates():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(f'SELECT id, name FROM {SCHEMA}.templates ORDER BY id')
    templates_rows = cur.fetchall()

    result = []
    for tmpl_id, tmpl_name in templates_rows:
        cur.execute(
            f'SELECT id, name, sort_order FROM {SCHEMA}.template_sections WHERE template_id = %s ORDER BY sort_order, id',
            (tmpl_id,)
        )
        sections_rows = cur.fetchall()
        sections = []
        for sec_id, sec_name, _ in sections_rows:
            cur.execute(
                f'SELECT id, comment, key, value, sort_order FROM {SCHEMA}.template_params WHERE section_id = %s ORDER BY sort_order, id',
                (sec_id,)
            )
            params = [
                {'id': p[0], 'comment': p[1], 'key': p[2], 'value': p[3]}
                for p in cur.fetchall()
            ]
            sections.append({'id': sec_id, 'name': sec_name, 'params': params})

        result.append({'id': tmpl_id, 'name': tmpl_name, 'sections': sections})

    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps(result, ensure_ascii=False)
    }


def save_template(body: dict):
    template_id = body.get('template_id')
    sections = body.get('sections', [])

    if not template_id:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'template_id required'})}

    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        f'SELECT id FROM {SCHEMA}.template_sections WHERE template_id = %s',
        (template_id,)
    )
    old_section_ids = [r[0] for r in cur.fetchall()]
    if old_section_ids:
        ids_str = ','.join(str(i) for i in old_section_ids)
        cur.execute(f'DELETE FROM {SCHEMA}.template_params WHERE section_id IN ({ids_str})')
        cur.execute(f'DELETE FROM {SCHEMA}.template_sections WHERE template_id = %s', (template_id,))

    for sec_order, section in enumerate(sections):
        cur.execute(
            f'INSERT INTO {SCHEMA}.template_sections (template_id, name, sort_order) VALUES (%s, %s, %s) RETURNING id',
            (template_id, section.get('name', ''), sec_order)
        )
        sec_id = cur.fetchone()[0]
        for param_order, param in enumerate(section.get('params', [])):
            cur.execute(
                f'INSERT INTO {SCHEMA}.template_params (section_id, comment, key, value, sort_order) VALUES (%s, %s, %s, %s, %s)',
                (sec_id, param.get('comment', ''), param.get('key', ''), param.get('value', ''), param_order)
            )

    conn.commit()
    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps({'ok': True}, ensure_ascii=False)
    }
