# A long sample book for the throwaway database: enough text to exercise pagination, the
# reader, word counts and the outline. Prints SQL; pipe it to psql. Throwaway database only.
#
#   PYTHONIOENCODING=utf-8 python seed-long-book.py [owner-email] > long.sql
#   PGCLIENTENCODING=UTF8 psql -h localhost -p 54329 -U bb -d bookbuilder -q -f long.sql
#
# The owner (default wren@example.test, the browser helper's test user) must have signed up
# first. Story text is compact Tiptap JSON (it must start exactly with {"type":"doc"), with a
# scene break, a heading, a quote, emphasis and a three-line drop cap in chapter 2.
import json
import random
import sys

random.seed(7)
EMAIL = sys.argv[1] if len(sys.argv) > 1 else 'wren@example.test'

SENTENCES = [
    "The Meridian drifted on her last reserves, every system dimmed to a whisper.",
    "Juno walked the spine of the ship with one hand on the cold rail, counting rivets out of habit.",
    "Somewhere below, Pell was singing to the engines again, low and tuneless, the way his mother had sung to hers.",
    "Ade had not slept in two days and had stopped pretending otherwise.",
    "The map lay open on the chart table, its dead stars turning slowly, like a clock that had forgotten the hour.",
    "Outside, the gate burned a pale and patient blue.",
    "Nobody aboard had ever seen a light that old, and nobody could stop looking at it.",
    "She thought about the rules again, and about how easy they had been to write and how hard they were to keep.",
    "The hull answered every note the beacon sent, a half-beat late, as if it were learning the words.",
    "There was salt on the air scrubbers from the moon's frozen sea.",
    "Tamsin would have known what to do. Tamsin always knew, right up until the moment she didn't.",
    "In the galley someone had left a cup of tea to go cold beside a deck of cards dealt for a game nobody finished.",
    "Pell came up the ladder with grease to the elbows and a look on his face that Juno had never seen there before.",
    "“It's not a song,” he said. “Not exactly. It's a set of directions.”",
    "Every hour the signal grew a little clearer and a little stranger, and every hour Juno liked it less.",
]


def text(value, marks=None):
    node = {'type': 'text', 'text': value}
    if marks:
        node['marks'] = marks
    return node


def paragraph(words):
    out, count = [], 0
    while count < words:
        sentence = random.choice(SENTENCES)
        out.append(sentence)
        count += len(sentence.split())
    content = [text(' '.join(out))]
    if random.random() < 0.25:
        content.append(text(' She did not say it aloud.', [{'type': 'italic'}]))
    return {'type': 'paragraph', 'content': content}


def story(words, extras=True, cap=None):
    blocks, total = [], 0
    while total < words:
        n = random.choice([25, 40, 60, 80, 110])
        blocks.append(paragraph(n))
        total += n
        if extras and len(blocks) == 7:
            blocks.append({'type': 'horizontalRule'})
        if extras and len(blocks) == 13:
            blocks.append({'type': 'heading', 'attrs': {'level': 2}, 'content': [text('The Second Watch')]})
        if extras and len(blocks) == 17:
            blocks.append({'type': 'blockquote', 'content': [paragraph(30)]})
    doc = {'type': 'doc', 'content': blocks}
    if cap:
        doc['attrs'] = {'dropCap': cap}
    return json.dumps(doc, ensure_ascii=False, separators=(',', ':'))


def q(value):
    return "'" + value.replace("'", "''") + "'"


PARTS = [
    ('Prologue', '', 0, None),
    ('The Drowned Moon', 'Juno finds a signal under the ice.', 1, [
        ('Salvage Rights', 1900, 'The beacon wakes.'),
        ('The Map of Dead Stars', 2600, ''),
        ('Through the Gate', 1300, 'No way home.'),
    ]),
    ('The Far Side', '', 1, [
        ('Glasswater', 1500, ''),
        ('An Empty Chapter', 0, ''),
    ]),
]

sql = ['begin;', f'select id as uid from "user" where email = {q(EMAIL)} \\gset']
sql.append("insert into book (title, description, user_id) values ('The Long Light', 'A salvage crew answers a song three hundred years old.', :'uid') returning id \\gset")
for position, (title, desc, has_chapters, chapters) in enumerate(PARTS):
    sql.append(
        'insert into part (title, description, book_id, user_id, has_chapters, show_description, position) '
        f"values ({q(title)}, {q(desc)}, :id, :'uid', {has_chapters}, true, {position}) returning id as part_id \\gset"
    )
    if not has_chapters:
        sql.append(f'insert into story_text (content, part_id) values ({q(story(650, extras=False))}, :part_id);')
        continue
    for chapter_position, (chapter_title, words, chapter_desc) in enumerate(chapters):
        sql.append(
            'insert into chapter (title, description, part_id, position, show_description) '
            f'values ({q(chapter_title)}, {q(chapter_desc)}, :part_id, {chapter_position}, true) returning id as chapter_id \\gset'
        )
        if words:
            cap = {'style': 'drop', 'lines': 3, 'font': 'display', 'color': 'accent'} if chapter_position == 1 else None
            sql.append(f'insert into story_text (content, chapter_id) values ({q(story(words, cap=cap))}, :chapter_id);')
sql.append('commit;')
sql.append('select :id as new_book;')
print('\n'.join(sql))
