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
2. gets an agent key — the key that came in the **Connect another PC** download,
   or, on a PC that also has the PulseDB backend (`..\backend\.env`), a new one it
   creates automatically,
3. starts the agent in the background and makes it start at every sign-in
   (Startup folder; a small supervisor restarts it if it ever exits),
4. waits until PulseDB has registered the databases and lists them.

Each database then appears in PulseDB → **Connections** with a **VIA AGENT** badge.

Connections you add in PulseDB the ordinary way (**New Connection**, host such as
`MYPC\SQLEXPRESS`, `localhost` or `192.168.x.x`, with a SQL login) also work from the
cloud while an agent of yours is online: PulseDB sends that connection's host and
login to the agent, which dials it (read-only). Turn this off with
`"relayConnections": false` in `agent.config.json`.

Run `setup.cmd` again any time (new databases, new instance): it refreshes the
list and keeps the same key and connections. `uninstall-agent.cmd` removes it.

Deleting one of these connections in PulseDB is remembered: the agent's periodic
re-registration (every 10 minutes and at sign-in) does not bring it back. Running
`setup.cmd` again restores the deleted ones.

## Connect another PC

Monitor the SQL Server on any other Windows PC — nothing to type: no server
details, passwords or keys. Illustrated guide:
**[Connect a PC to PulseDB](https://pulsedb-o8ax.vercel.app/agent-setup-guide.html)**
(served by PulseDB at `/agent-setup-guide.html`).

**Before you start** (on the other PC)

- Windows 10 or 11 with SQL Server installed.
- The Windows user you sign in as can open that SQL Server (if it connects in
  SQL Server Management Studio without a password, it's fine).
- Internet access. No admin rights needed; Windows may ask permission once to
  install the SQL Server ODBC driver.

**Steps**

1. **Download the agent — on your PC.** Open PulseDB (e.g.
   `https://pulsedb-o8ax.vercel.app`), sign in as an administrator, go to
   **Connections → Manage Connections** and click **Connect another PC**.
   `PulseDB-Agent.zip` downloads with PulseDB's address and a new agent key inside.
   Keep it private and download a fresh one for each PC.
2. **Copy the zip to the other PC** — USB drive, email, Teams or a shared folder.
3. **Extract it — on the other PC.** Right-click → **Extract All… → Extract**, then
   move the `PulseDB-Agent` folder somewhere permanent, e.g. `C:\PulseDB-Agent`
   (the agent runs from it).
4. **Run `setup.cmd` — on the other PC.** Double-click it (if Windows shows *Windows
   protected your PC*, click **More info → Run anyway**). In 1–3 minutes it installs
   Node.js and the ODBC driver if missing, finds the databases, starts the agent and
   makes it start at every sign-in. It ends with:

   ```
   Done. PulseDB Agent is running and registered with https://pulsedb-o8ax.vercel.app:
       OFFICE-PC · SalesDB   -> connection #81
       OFFICE-PC · Inventory -> connection #82
   ```

5. **Check in PulseDB.** Refresh (**Ctrl + Shift + R**) and open **Connections**:
   each database appears as `<PC name> · <database>` with a **VIA AGENT** badge.
   Click **Test** (expect *Connection successful via PulseDB Agent*), then select it
   and open the **SQL Server** screens.

SQL Servers that the other PC can reach on its network (e.g. `SERVER01\SQLEXPRESS`,
`192.168.1.20`) can then be added in PulseDB with **New Connection** and a SQL
login — they go through that PC's agent automatically. With agents on several PCs,
use the PC's name as the host rather than `localhost`.

**Removing a PC:** run `uninstall-agent.cmd` on it, delete `<PC name> agent` in
PulseDB under **Observability → SDK Integration** (the key stops working at once),
then delete its connections.

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
| setup: *skipped — Login failed* | This Windows user has no SQL Server login — ask the DBA to add one, or add the server in PulseDB with **New Connection** and a SQL login |
| setup: *No SQL Server databases found* | SQL Server isn't installed on this PC or its service is stopped (**Services → SQL Server**) |
| setup: *This agent has no valid key* | Its key was deleted in PulseDB — download a fresh package (**Connections → Connect another PC**) and run its `setup.cmd` |
| `setup.cmd` closes at once / Node.js error | Install Node.js LTS from https://nodejs.org and run `setup.cmd` again |
| *Blocked by the PulseDB Agent* | A write statement in read-only mode (`"allowWrites": true` to permit) |
| Agent log: *rejected the agent key (401)* | Wrong `agentKey`, or the SDK application was deleted/regenerated |
