# Tatkal Trainer

Race 50,000 bots to a Tatkal ticket, then see which part of a toy backend rejected you.

Live: https://tatkal-trainer.prayushkale.workers.dev

## Run the game (`web/`)

```bash
cd web
npm install
npm run dev
```

Run tests and parameter sweeps:

```bash
cd web
npm run test:unit -- --run
npm run test:e2e
npm run sweep
```

## Run the local lab (`lab/`)

Requires PostgreSQL 17 and Redis running locally with databases `tatkal_lab` and `tatkal_test`.

```bash
cd lab
source .venv/bin/activate
pip install -r requirements.txt
pytest -q
uvicorn app.main:app --port 8000
```

In a second terminal:

```bash
cd lab
source .venv/bin/activate
python load.py --strategy naive --limit off
python load.py --strategy for_update --limit off
python load.py --strategy skip_locked --limit off
python load.py --strategy skip_locked --limit on
```

---

Toy model I wrote. Not IRCTC's real architecture. Not affiliated with IRCTC or Indian Railways.

Built with Claude Opus 5.5
