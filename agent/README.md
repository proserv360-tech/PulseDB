# PulseDB Agent

Lets a **cloud** PulseDB (e.g. `https://pulsedb-o8ax.vercel.app`) work with a
database it cannot reach — a SQL Server on your PC or office network.

```
Your PC / LAN                                         Cloud
┌──────────────────────────────┐   outbound HTTPS    ┌──────────────┐
│ SQL Server ◄── PulseDB Agent ├────────────────────►│   PulseDB    │
│ (credentials stay here)      │  "any work for me?" │              │
└──────────────────────────────┘  ◄── jobs / results │              │
                                                      └──────────────┘
```

- **No inbound ports.** The agent only makes outbound HTTPS requests.
- **Credentials stay local** in `agent.config.json`; PulseDB only learns each
  target's name, engine, host, port and database name.
- **Read-only by default:** only `SELECT` / `WITH` statements run unless you set
  `"allowWrites": true`.
- Supported engine: **SQL Server** (`mssql`).

Through the agent, PulseDB shows the full **SQL Server** section (overview,
performance & waits, Query Store, sessions & locks, tables & indexes, memory,
storage & I/O, backups & jobs, security, Always On), and can **test the
connection**, run **SQL console** queries and list **schemas**. Each screen
refresh is a single round trip to the agent.

## Automatic setup (Windows) — recommended

Double-click **`setup.cmd`** (no admin rights needed). It:

1. finds every SQL Server instance on this PC and its databases, signing in with
   **Windows authentication** (no SQL password anywhere),
2. gets an agent key — on a PC that also has the PulseDB backend (`..\backend\.env`)
   it creates one automatically; otherwise it asks you to paste one into
   `agent.config.json` (see step 1 below),
3. starts the agent in the background and makes it start at every sign-in
   (Startup folder; a small supervisor restarts it if it ever exits),
4. waits until PulseDB has registered the databases and lists them.

Each database then appears in PulseDB → **Connections** with a **VIA AGENT** badge.
Run `setup.cmd` again any time (new databases, new instance): it refreshes the
list and keeps the same key and connections. `uninstall-agent.cmd` removes it.

## Manual setup (Windows)

1. **Create an agent key in PulseDB.** Sign in as an admin, open **Observability →
   SDK Integration** and register an application (e.g. name `My PC agent`, platform
   **Custom / PulseDB Agent**). Copy the key shown — it is displayed **once**.
2. **Install Node.js 20 or 22 LTS** on the PC next to the database (https://nodejs.org).
3. **Extract this folder** somewhere permanent, e.g. `C:\PulseDB-Agent`.
4. **Configure it:** copy `agent.config.example.json` to `agent.config.json` and set
   - `pulsedbUrl` — your PulseDB address
   - `agentKey` — the key from step 1
   - each target: `name` (how it appears in PulseDB), `host`
     (`localhost`, `MYPC\SQLEXPRESS`, `192.168.1.20`…), `port`, `database`, and either
     - `"windowsAuth": true` — sign in as the Windows account running the agent
       (no SQL password in the file; uses ODBC Driver 18 or 17 for SQL Server), or
     - `user` and `password` of a SQL login.

     For a local SQL Server keep `"encrypt": false`.
5. **Install it as a startup task:** right-click **`install-agent.cmd` → Run as
   administrator.** It installs the drivers and starts the agent. With SQL logins it
   runs at boot as SYSTEM; with `windowsAuth` it runs as **you** whenever you are
   signed in to Windows (SYSTEM normally has no rights in SQL Server).
6. In PulseDB, open **Connections**: your database is listed with a **VIA AGENT**
   badge. Click **Test**.

To try it without installing, run it in a console instead of step 5:

```
cd C:\PulseDB-Agent
npm.cmd ci --omit=dev
node pulsedb-agent.mjs
```

## SQL Server prerequisites

- **TCP/IP enabled** for the instance (SQL Server Configuration Manager →
  Network Configuration → Protocols → TCP/IP → Enable, then restart SQL Server).
- With **Windows authentication** (`windowsAuth`): the Windows account running the
  agent needs a SQL Server login, and **ODBC Driver 18 or 17 for SQL Server** must be
  installed (it usually comes with SQL Server Management Studio / sqlcmd).
- With a **SQL login**: SQL Server authentication enabled (Server properties →
  Security → *SQL Server and Windows Authentication mode*).
- Either way, `VIEW SERVER STATE` plus read access to msdb (backup history) is
  enough for every monitoring screen.

## Operate

| Task | How |
| --- | --- |
| Logs | `logs\agent.log` |
| Restart | Task Scheduler → **PulseDB Agent** → End, then Run |
| Change databases | Edit `agent.config.json`, restart the agent — targets re-register automatically |
| Remove | Right-click `uninstall-agent.cmd` → Run as administrator |

## Troubleshooting

| PulseDB says | Meaning |
| --- | --- |
| *PulseDB Agent "…" is offline* | The agent is not running or cannot reach PulseDB — check `logs\agent.log` |
| *did not answer within 20s* | The agent just stopped, or the query is taking too long |
| *Login failed for user …* | Wrong `user`/`password` in `agent.config.json`, or SQL authentication is off |
| *Windows authentication via ODBC Driver … failed* | The Windows account running the agent has no SQL Server login, or the ODBC driver is missing |
| *Blocked by the PulseDB Agent* | A write statement in read-only mode (`"allowWrites": true` to permit) |
| Agent log: *rejected the agent key (401)* | Wrong `agentKey`, or the SDK application was deleted/regenerated |
