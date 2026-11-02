"""Extract declared JobPosting microdata; no browser, network or guessed identity."""
import json
import sys
from html.parser import HTMLParser


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = {'tag': '', 'attrs': {}, 'children': []}
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = {'tag': tag, 'attrs': dict(attrs), 'children': []}
        self.stack[-1]['children'].append(node)
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for n in range(len(self.stack) - 1, 0, -1):
            if self.stack[n]['tag'] == tag:
                self.stack = self.stack[:n]
                break

    def handle_data(self, data):
        self.stack[-1]['children'].append(data)


def descendants(node):
    yield node
    for child in node['children']:
        if isinstance(child, dict):
            yield from descendants(child)


def text(node):
    if node['tag'] in {'script', 'style'}:
        return ''
    return ' '.join(text(c) if isinstance(c, dict) else c for c in node['children']).strip()


def prop(node, name):
    matches = [n for n in descendants(node) if name in n['attrs'].get('itemprop', '').split()]
    return matches[0] if len(matches) == 1 else None


def value(node):
    return node['attrs'].get('content') or node['attrs'].get('datetime') or text(node) if node else None


def postings(raw):
    parser = Parser()
    parser.feed(raw)
    out = []
    for node in descendants(parser.root):
        if not any(t.rstrip('/').endswith('/JobPosting') for t in node['attrs'].get('itemtype', '').split()):
            continue
        org = prop(node, 'hiringOrganization')
        location = prop(node, 'jobLocation')
        description = prop(node, 'description')
        if not org or not location or not description:
            continue
        out.append({'@type': 'JobPosting', 'title': value(prop(node, 'title')),
                    'hiringOrganization': {'name': value(prop(org, 'name')) or value(org)},
                    'jobLocation': {'address': {k: value(prop(location, k)) for k in ('addressLocality', 'addressRegion', 'addressCountry')}},
                    'description': text(description), 'validThrough': value(prop(node, 'validThrough')),
                    'datePosted': value(prop(node, 'datePosted'))})
    return out


if __name__ == '__main__':
    print(json.dumps(postings(sys.stdin.read())))
