# Sound Competition

A Swiss-system tournament application designed to simulate an **Instrumental Battle** competition. Built with Python and PostgreSQL, and powered by a Vagrant virtual environment.

---

## Table of Contents

- [About](#about)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Running the Application](#running-the-application)
- [Key Functions](#key-functions)
- [Author](#author)

---

## About

Sound Competition manages a Swiss-system music tournament where artists compete head-to-head with their instrumental tracks. The app tracks players, matches, scores, and standings across one or more tournaments.

---

## Project Structure

```
Sound_Competition/
├── LICENSE.md
├── README.md
└── vagrant/
    ├── Vagrantfile
    ├── pg_config.sh
    └── vagrant/
        └── tournament/
            ├── tournament.sql       # Database schema & seed data
            ├── tournament.py        # Core tournament logic
            └── tournament_test.py   # Test suite
```

---

## Database Schema

The application uses four tables in a PostgreSQL database named `tournament`:

| Table | Description |
|---|---|
| `T_TOURNAMENTS` | Tournament info: title, organizer, dates, total players |
| `T_PLAYERS` | Artist details: name, email, song, city, state |
| `T_MATCHES` | Match records: winner and loser per match |
| `T_RESULTS` | Per-player results: score, win/loss/draw flag, elimination status |

---

## Prerequisites

- [VirtualBox](https://www.virtualbox.org/)
- [Vagrant](https://www.vagrantup.com/)
- Git

---

## Setup & Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Sound_Competition
   ```

2. **Start the Vagrant virtual machine**
   ```bash
   cd vagrant
   vagrant up
   ```

   > If you encounter SSH connection timeouts, open the VirtualBox GUI and change the VM's OS type to **Ubuntu (64-bit)**, then retry `vagrant up`.

3. **SSH into the VM**
   ```bash
   vagrant ssh
   ```

4. **Navigate to the tournament directory**
   ```bash
   cd /vagrant/tournament
   ```

---

## Running the Application

1. **Create the database**
   ```bash
   psql
   \i tournament.sql
   \q
   ```

2. **Run the test suite**
   ```bash
   ./tournament_test.py
   ```

---

## Key Functions

Defined in `tournament.py`:

| Function | Description |
|---|---|
| `registerPlayer(name, id_tourn)` | Registers an artist in a tournament |
| `countPlayers(id_tourn)` | Returns the number of registered players |
| `playerStandings(id_tourn)` | Returns players ranked by wins |
| `reportMatch(winner, loser, id_tourn)` | Records the outcome of a match |
| `swissPairings(id_tourn)` | Generates next-round pairings using Swiss system |
| `deleteMatches()` | Clears all match records |
| `deletePlayers()` | Clears all player records |

---

## Author

**Serge Nganou**
Developer — HP
