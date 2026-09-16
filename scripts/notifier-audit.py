#!/usr/bin/env python3
"""Notifies on ntfy what *changed* between the last two security audits.

The daily report from `audit-securite.py` almost never moves: the same CVEs
stay listed as long as the images have not been bumped. One notification per
run would therefore be one notification a day saying the same thing, and an
alert people learn to swipe away no longer protects anything — exactly the
flaw the scanner already holds against overly broad secret patterns.

This script therefore only publishes the differences, in both directions:

  fixed      a finding present yesterday has disappeared — the signal being
             asked for, the one that confirms a fix took effect
  new        a finding has appeared
  worsened   the same finding has changed severity

With no change, it publishes nothing and exits with 0. `--forcer` publishes the
full state, to check the chain end to end after installing it.

Usage:
    notifier-audit.py --rapports ~/.local/share/audit-securite
    notifier-audit.py --forcer --format texte      # without sending anything
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

SEVERITES = ("critique", "eleve", "moyen", "faible", "info")

# ntfy's header-based API accepts keywords ("default", "high"...), but the JSON
# API — the one `publier()` uses — requires an integer 1-5 and rejects the
# string with a 400 "request body must be valid JSON", a misleading message that
# does not point at the offending field.
PRIORITES_NTFY = {"min": 1, "low": 2, "default": 3, "high": 4, "urgent": 5, "max": 5}


def cle(constat: dict) -> tuple[str, str]:
    """A finding's identity, insensitive to the numbers it contains.

    The title carries counters — « 19 CVE HIGH corrigeable(s) dans
    caddy:2-alpine ». Without this normalisation, one CVE more or less on the
    same image would read as a fixed finding *and* a new one, that is, two false
    notifications for an event that deserves none.
    """
    return constat.get("famille", ""), re.sub(r"\d+", "#", constat.get("titre", ""))


def charger(chemin: Path) -> dict[tuple[str, str], dict]:
    donnees = json.loads(chemin.read_text(encoding="utf-8"))
    return {cle(c): c for c in donnees.get("constats", [])}


def rapports(repertoire: Path) -> list[Path]:
    """Reports from oldest to newest.

    The name carries an ISO timestamp in UTC, so lexicographic order is
    chronological order. `dernier.json` is a link to one of them and is
    excluded: counting it would compare the latest report with itself.
    """
    return sorted(p for p in repertoire.glob("audit-*.json") if p.is_file())


def pire(severites: list[str]) -> str:
    return min(severites, key=lambda s: SEVERITES.index(s) if s in SEVERITES else len(SEVERITES))


def composer(avant: dict, apres: dict) -> tuple[str, str, str, list[str]] | None:
    """Returns (title, message, priority, tags), or None when there is nothing to say."""
    corriges = [avant[k] for k in avant.keys() - apres.keys()]
    nouveaux = [apres[k] for k in apres.keys() - avant.keys()]
    aggraves = [
        (avant[k], apres[k])
        for k in avant.keys() & apres.keys()
        if avant[k].get("severite") != apres[k].get("severite")
    ]

    if not (corriges or nouveaux or aggraves):
        return None

    lignes: list[str] = []
    if corriges:
        lignes.append(f"✅ Corrigés ({len(corriges)})")
        lignes += [f"  [{c['severite']}] {c['titre']}" for c in corriges]
    if nouveaux:
        lignes.append(f"⚠️ Nouveaux ({len(nouveaux)})")
        lignes += [f"  [{c['severite']}] {c['titre']}" for c in nouveaux]
    if aggraves:
        lignes.append(f"↕️ Sévérité modifiée ({len(aggraves)})")
        lignes += [f"  {a['severite']} → {b['severite']} : {b['titre']}" for a, b in aggraves]

    lignes.append("")
    lignes.append(f"Restent {len(apres)} constat(s) au total.")

    resume = []
    if corriges:
        resume.append(f"{len(corriges)} corrigé(s)")
    if nouveaux:
        resume.append(f"{len(nouveaux)} nouveau(x)")
    if aggraves:
        resume.append(f"{len(aggraves)} modifié(s)")

    # A regression wakes people up; a fix can be read at leisure. Priority
    # therefore follows the severity of what *appeared*, never the volume of
    # what disappeared.
    graves = [c["severite"] for c in nouveaux] + [b["severite"] for _, b in aggraves]
    urgent = bool(graves) and SEVERITES.index(pire(graves)) <= SEVERITES.index("eleve")

    tags = []
    if nouveaux or aggraves:
        tags.append("rotating_light" if urgent else "warning")
    if corriges:
        tags.append("white_check_mark")

    return (
        "Audit Fretline — " + ", ".join(resume),
        "\n".join(lignes),
        "high" if urgent else "default",
        tags,
    )


def etat_complet(apres: dict) -> tuple[str, str, str, list[str]]:
    if not apres:
        return ("Audit Fretline — aucun constat", "Tous les contrôles passent.", "low", ["white_check_mark"])
    par_severite: dict[str, int] = {}
    for constat in apres.values():
        par_severite[constat["severite"]] = par_severite.get(constat["severite"], 0) + 1
    resume = ", ".join(f"{n} {s}" for s, n in sorted(par_severite.items(), key=lambda kv: SEVERITES.index(kv[0])))
    lignes = [f"[{c['severite']}] {c['titre']}" for c in sorted(apres.values(), key=lambda c: SEVERITES.index(c["severite"]))]
    return (f"Audit Fretline — {len(apres)} constat(s)", f"{resume}\n\n" + "\n".join(lignes), "default", ["shield"])


def publier(base: str, topic: str, token: str, titre: str, message: str, priorite: str, tags: list[str]) -> None:
    """Publishes as JSON on the server root, not as headers on /topic.

    ntfy accepts both, but the header-based API requires RFC 2047 encoding for
    anything that is not ASCII: « Corrigés », « Sévérité » — that is, nearly all
    of this repository's titles — would arrive mangled. The JSON body is UTF-8
    by construction.
    """
    corps = json.dumps(
        {
            "topic": topic,
            "title": titre,
            "message": message,
            "priority": PRIORITES_NTFY.get(priorite, 3),
            "tags": tags,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    entetes = {"Content-Type": "application/json"}
    if token:
        entetes["Authorization"] = f"Bearer {token}"
    demande = urllib.request.Request(base.rstrip("/") + "/", data=corps, headers=entetes, method="POST")
    with urllib.request.urlopen(demande, timeout=20) as reponse:
        reponse.read()


def main() -> int:
    analyseur = argparse.ArgumentParser(description="Notifies on ntfy the changes between two audits.")
    analyseur.add_argument(
        "--rapports",
        type=Path,
        default=Path(os.environ.get("AUDIT_REPERTOIRE", Path.home() / ".local/share/audit-securite")),
        help="Directory of timestamped JSON reports.",
    )
    # `NTFY_BASE_URL` is already in .env.production — it is what the ntfy
    # container announces as its own address. Making it the default avoids
    # writing the same URL twice; `NTFY_URL` remains for the case where one
    # publishes somewhere other than where one subscribes.
    analyseur.add_argument(
        "--url",
        default=os.environ.get("NTFY_URL") or os.environ.get("NTFY_BASE_URL", ""),
        help="Base URL of the ntfy server.",
    )
    analyseur.add_argument("--topic", default=os.environ.get("NTFY_TOPIC", "fretline-securite"))
    analyseur.add_argument("--token", default=os.environ.get("NTFY_TOKEN", ""))
    analyseur.add_argument("--forcer", action="store_true", help="Publishes the full state even without changes.")
    analyseur.add_argument("--format", choices=("texte", "ntfy"), default="ntfy",
                           help="\"texte\" prints the notification without sending it.")
    arguments = analyseur.parse_args()

    fichiers = rapports(arguments.rapports)
    if not fichiers:
        print(f"Aucun rapport dans {arguments.rapports}.", file=sys.stderr)
        return 1

    try:
        apres = charger(fichiers[-1])
        avant = charger(fichiers[-2]) if len(fichiers) > 1 else {}
    except (json.JSONDecodeError, OSError) as erreur:
        print(f"Rapport illisible : {erreur}", file=sys.stderr)
        return 1

    if arguments.forcer:
        notification = etat_complet(apres)
    elif len(fichiers) == 1:
        # The machine's first audit: there is nothing to compare, but the
        # initial state is an event in itself.
        notification = etat_complet(apres)
    else:
        notification = composer(avant, apres)

    if notification is None:
        print("Aucun changement depuis l'audit précédent : rien à notifier.")
        return 0

    titre, message, priorite, tags = notification

    if arguments.format == "texte" or not arguments.url:
        if not arguments.url and arguments.format != "texte":
            print("NTFY_URL absent : notification affichée au lieu d'être envoyée.", file=sys.stderr)
        print(f"{titre}\n\n{message}")
        return 0

    try:
        publier(arguments.url, arguments.topic, arguments.token, titre, message, priorite, tags)
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as erreur:
        # A sending failure must not hide the result of the audit itself: it is
        # reported on stderr, the systemd journal keeps it, and the exit code
        # stays 0 so that the unit keeps reflecting the security state and not
        # the notification server's.
        print(f"Envoi ntfy impossible : {erreur}", file=sys.stderr)
        print(f"{titre}\n\n{message}", file=sys.stderr)
        return 0

    print(f"Notifié : {titre}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
