# Elk uur bijwerken

cron-job.org start de Action `update.yml` op werkdagen elk uur van 8 tot en met 19 uur. Reden: GitHub start
geplande runs (`schedule`) 8 tot 11 uur te laat (gemeten nov 2026). Het schema in `update.yml` blijft als vangnet.
Een run duurt ongeveer 9 minuten; tegelijk draaien kan niet (`concurrency`).

Token (GitHub, Settings > Developer settings > Fine-grained tokens): alleen repo `milieubeleid-checker`,
alleen "Actions: Read and write". Het token staat alleen bij cron-job.org, nooit in deze repo.

| Veld bij cron-job.org | Waarde |
|---|---|
| URL | `https://api.github.com/repos/TobiasRaucher/milieubeleid-checker/actions/workflows/update.yml/dispatches` |
| Schema | `0 8-19 * * 1-5`, tijdzone Europe/Amsterdam |
| Methode | POST |
| Headers | `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `Content-Type: application/json` |
| Body | `{"ref":"main"}` |

Goed antwoord: 200 of 204. 401 betekent dat het token is verlopen; 403 of 404 dat het token geen recht op Actions van deze repo heeft.
