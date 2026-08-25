#!/usr/bin/env python3
"""Notifie sur ntfy ce qui a *changé* entre les deux derniers audits de sécurité.

Le rapport quotidien de `audit-securite.py` ne bouge presque jamais : les mêmes
CVE y figurent tant que les images n'ont pas été repoussées. Une notification par
exécution serait donc une notification par jour disant la même chose, et une
alerte qu'on apprend à balayer ne protège plus de rien — c'est exactement le
défaut que le scanner reproche déjà aux motifs de secrets trop larges.

Ce script ne publie donc que les différences, dans les deux sens :

  corrigé   un constat présent hier a disparu — c'est le signal demandé, celui
            qui confirme qu'un correctif a produit son effet
  nouveau   un constat est apparu
  aggravé   le même constat a changé de sévérité

Sans changement, il ne publie rien et sort en 0. `--forcer` publie l'état
complet, pour vérifier la chaîne de bout en bout après l'avoir installée.

Usage :
    notifier-audit.py --rapports ~/.local/share/audit-securite
    notifier-audit.py --forcer --format texte      # sans rien envoyer
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

# L'API JSON de ntfy veut un entier là où l'API par en-têtes accepte le nom.
# Une chaîne y est refusée par un 400 « request body must be valid JSON », qui
# désigne le corps entier plutôt que le champ fautif : la traduction est faite
# ici une fois, et le reste du script continue de raisonner en noms.
PRIORITES = {"min": 1, "low": 2, "default": 3, "high": 4, "urgent": 5}


def cle(constat: dict) -> tuple[str, str]:
    """Identité d'un constat, insensible aux nombres qu'il contient.

    Le titre porte des compteurs — « 19 CVE HIGH corrigeable(s) dans
    caddy:2-alpine ». Sans cette normalisation, une CVE de plus ou de moins sur
    la même image se lirait comme un constat corrigé *et* un constat nouveau,
    soit deux notifications fausses pour un événement qui n'en mérite aucune.
    """
    return constat.get("famille", ""), re.sub(r"\d+", "#", constat.get("titre", ""))


def charger(chemin: Path) -> dict[tuple[str, str], dict]:
    donnees = json.loads(chemin.read_text(encoding="utf-8"))
    return {cle(c): c for c in donnees.get("constats", [])}


def rapports(repertoire: Path) -> list[Path]:
    """Les rapports du plus ancien au plus récent.

    Le nom porte un horodatage ISO en UTC, donc l'ordre lexicographique est
    l'ordre chronologique. `dernier.json` est un lien vers l'un d'eux et est
    exclu : le compter donnerait le dernier rapport comparé à lui-même.
    """
    return sorted(p for p in repertoire.glob("audit-*.json") if p.is_file())


def pire(severites: list[str]) -> str:
    return min(severites, key=lambda s: SEVERITES.index(s) if s in SEVERITES else len(SEVERITES))


def composer(avant: dict, apres: dict) -> tuple[str, str, str, list[str]] | None:
    """Rend (titre, message, priorité, tags), ou None s'il n'y a rien à dire."""
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

    # Une régression réveille ; une correction se lit à tête reposée. La
    # priorité suit donc la gravité de ce qui est *apparu*, jamais le volume de
    # ce qui a disparu.
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
    """Publie en JSON sur la racine du serveur, et non en en-têtes sur /topic.

    ntfy accepte les deux, mais l'API par en-têtes impose un encodage RFC 2047
    pour tout ce qui n'est pas ASCII : « Corrigés », « Sévérité » — c'est-à-dire
    la quasi-totalité des titres de ce dépôt — y arriveraient mutilés. Le corps
    JSON est en UTF-8 par construction.
    """
    corps = json.dumps(
        {"topic": topic, "title": titre, "message": message, "priority": PRIORITES[priorite], "tags": tags},
        ensure_ascii=False,
    ).encode("utf-8")
    entetes = {"Content-Type": "application/json"}
    if token:
        entetes["Authorization"] = f"Bearer {token}"
    demande = urllib.request.Request(base.rstrip("/") + "/", data=corps, headers=entetes, method="POST")
    with urllib.request.urlopen(demande, timeout=20) as reponse:
        reponse.read()


def main() -> int:
    analyseur = argparse.ArgumentParser(description="Notifie sur ntfy les changements entre deux audits.")
    analyseur.add_argument(
        "--rapports",
        type=Path,
        default=Path(os.environ.get("AUDIT_REPERTOIRE", Path.home() / ".local/share/audit-securite")),
        help="Répertoire des rapports JSON horodatés.",
    )
    # `NTFY_BASE_URL` est déjà dans .env.production — c'est ce que le conteneur
    # ntfy annonce comme sa propre adresse. En faire le défaut évite d'écrire la
    # même URL deux fois ; `NTFY_URL` reste là pour le cas où l'on publierait
    # ailleurs que là où l'on s'abonne.
    analyseur.add_argument(
        "--url",
        default=os.environ.get("NTFY_URL") or os.environ.get("NTFY_BASE_URL", ""),
        help="Base du serveur ntfy.",
    )
    analyseur.add_argument("--topic", default=os.environ.get("NTFY_TOPIC", "fretline-securite"))
    analyseur.add_argument("--token", default=os.environ.get("NTFY_TOKEN", ""))
    analyseur.add_argument("--forcer", action="store_true", help="Publie l'état complet même sans changement.")
    analyseur.add_argument("--format", choices=("texte", "ntfy"), default="ntfy",
                           help="« texte » affiche la notification sans l'envoyer.")
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
        # Premier audit de la machine : il n'y a rien à comparer, mais l'état
        # initial est en lui-même un événement.
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
        # Un échec d'envoi ne doit pas masquer le résultat de l'audit lui-même :
        # on rapporte sur stderr, le journal systemd le garde, et le code de
        # sortie reste 0 pour que l'unité continue de refléter l'état de
        # sécurité et non celui du serveur de notifications.
        print(f"Envoi ntfy impossible : {erreur}", file=sys.stderr)
        print(f"{titre}\n\n{message}", file=sys.stderr)
        return 0

    print(f"Notifié : {titre}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
