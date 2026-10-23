#!/usr/bin/env python3
"""
Genera repos.json con los repositorios publicos de los propietarios listados en projects.json.
Los topics de GitHub son la fuente de los tags; "overrides" completa los repos que GitHub no deja
editar (por ejemplo los archivados). Uso:  python scripts/update_repos.py
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

API = 'https://api.github.com'


def get(url):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'projects-page'}
    token = os.environ.get('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = 'Bearer ' + token
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
        return json.load(response)


def listRepos(owner):
    for kind in ('orgs', 'users'):
        repos, page = [], 1
        try:
            while True:
                chunk = get(f'{API}/{kind}/{owner}/repos?type=public&per_page=100&page={page}')
                repos += chunk
                if len(chunk) < 100:
                    return repos
                page += 1
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
    raise SystemExit(f'No se encontro el propietario {owner}')


def main():
    config = json.load(open('projects.json', encoding='utf-8'))
    overrides = config.get('overrides', {})
    result = []
    for owner in config['owners']:
        for repo in listRepos(owner):
            full_name = repo['full_name']
            if full_name in config.get('exclude', []) or repo['private']:
                continue
            if repo['fork'] and not config.get('include_forks', False):
                continue
            override = overrides.get(full_name, {})
            topics = sorted(set(repo.get('topics') or []) | set(override.get('topics', [])))
            result.append({
                'owner': repo['owner']['login'],
                'name': repo['name'],
                'full_name': full_name,
                'url': repo['html_url'],
                'description': override.get('description') or repo.get('description') or '',
                'language': repo.get('language'),
                'topics': topics,
                'archived': repo['archived'],
                'pushed_at': repo['pushed_at'],
                'stars': repo['stargazers_count'],
            })
    result.sort(key=lambda r: r['pushed_at'], reverse=True)
    output = {'generated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'repos': result}
    with open('repos.json', 'w', encoding='utf-8') as file:
        json.dump(output, file, indent=2, ensure_ascii=False)
        file.write('\n')
    print(f'{len(result)} repositorios escritos en repos.json')


if __name__ == '__main__':
    sys.exit(main())
