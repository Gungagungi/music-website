#!/usr/bin/env python3
"""Recurring security audit: the host, the container stack, the repository, the public target.

A single file, with no third-party Python dependency: this script runs from a
systemd timer on the production VPS, and an install chain that can break when a
package is upgraded turns monitoring into a silent blind spot. The only external
binaries are optional and detected at run time (`trivy`, `nuclei`) — their
absence degrades the report, it does not interrupt it.

Five families of checks, each can be enabled on its own:

  hote        sshd, nftables, fail2ban, updates, secret file permissions
  images      CVEs in the stack's images (trivy)
  eol         end of support of deployed components (endoflife.date)
  depot       CVEs in production dependencies, committed secrets, .env
  web         headers, TLS, test endpoints, cookies, signatures (nuclei)

Each check produces zero or more findings. The exit code is 0 when nothing
exceeds the requested threshold, 1 otherwise — that is what turns the systemd
unit red, and what makes the failure visible without reading the report.

Usage:
    scripts/audit-securite.py --cible https://example.com
    scripts/audit-securite.py --familles hote,depot --format texte
    scripts/audit-securite.py --seuil eleve --sortie /var/lib/audit/rapport.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import socket
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

# --- Model -----------------------------------------------------------------

# Ordered from most to least severe: the index is used for comparison, which
# avoids scattering `if severite == ...` throughout the file.
SEVERITES = ("critique", "eleve", "moyen", "faible", "info")


@dataclass
class Constat:
    """An observed problem, or a neutral observation when there is none."""

    severite: str
    famille: str
    titre: str
    detail: str
    correctif: str = ""

    def __post_init__(self) -> None:
        if self.severite not in SEVERITES:
            raise ValueError(f"sévérité inconnue : {self.severite}")


@dataclass
class Rapport:
    horodatage: str
    hote: str
    cible: str
    constats: list[Constat] = field(default_factory=list)
    controles_ignores: list[str] = field(default_factory=list)

    def ajouter(self, *constats: Constat) -> None:
        self.constats.extend(constats)

    def au_dessus_de(self, seuil: str) -> list[Constat]:
        limite = SEVERITES.index(seuil)
        return [c for c in self.constats if SEVERITES.index(c.severite) <= limite]


def executer(commande: list[str], *, delai: int = 60) -> tuple[int, str]:
    """Runs a command and returns (code, output). Never fails with an exception.

    An audit that stops because a binary changed its mind about its exit code
    reports nothing at all, which is worse than reporting a skipped check.
    """
    try:
        acheve = subprocess.run(
            commande,
            capture_output=True,
            text=True,
            timeout=delai,
            check=False,
        )
        return acheve.returncode, (acheve.stdout + acheve.stderr).strip()
    except FileNotFoundError:
        return 127, f"binaire introuvable : {commande[0]}"
    except subprocess.TimeoutExpired:
        return 124, f"délai dépassé après {delai} s"


# --- "hote" family ----------------------------------------------------------


def controler_sshd() -> list[Constat]:
    """Reads sshd's *effective* configuration, not the main file.

    The distinction is not theoretical: it is exactly what was found on this
    server. `/etc/ssh/sshd_config` had `PasswordAuthentication no`, but an
    `Include` placed higher up pulled in a cloud-init file that said `yes` — and
    in sshd, the first value obtained wins. Re-reading the main file would have
    concluded that all was well.
    """
    code, sortie = executer(["sshd", "-T"])
    if code != 0:
        code, sortie = executer(["sudo", "-n", "sshd", "-T"])
    if code != 0:
        return [
            Constat(
                "info",
                "hote",
                "Configuration sshd illisible",
                f"`sshd -T` a échoué ({code}). Contrôle non effectué.",
                "Lancer l'audit en root, ou autoriser `sudo -n sshd -T`.",
            )
        ]

    reglages = {}
    for ligne in sortie.splitlines():
        morceaux = ligne.split(None, 1)
        if len(morceaux) == 2:
            reglages[morceaux[0].lower()] = morceaux[1].strip()

    constats: list[Constat] = []

    if reglages.get("passwordauthentication") == "yes":
        constats.append(
            Constat(
                "critique",
                "hote",
                "SSH accepte l'authentification par mot de passe",
                "`sshd -T` rapporte passwordauthentication=yes. Le service est "
                "exposé à la devinette de mot de passe, que fail2ban ralentit "
                "sans l'empêcher.",
                "Poser `PasswordAuthentication no` dans le fichier de "
                "/etc/ssh/sshd_config.d/ qui est inclus en premier, vérifier "
                "l'accès par clé, puis `systemctl reload ssh`.",
            )
        )

    if reglages.get("permitrootlogin") == "yes":
        constats.append(
            Constat(
                "eleve",
                "hote",
                "Connexion root autorisée par mot de passe",
                "permitrootlogin=yes autorise root à se connecter par mot de passe.",
                "`PermitRootLogin prohibit-password`, voire `no`.",
            )
        )

    if reglages.get("permitemptypasswords") == "yes":
        constats.append(
            Constat(
                "critique",
                "hote",
                "Mots de passe vides acceptés par SSH",
                "permitemptypasswords=yes.",
                "`PermitEmptyPasswords no`.",
            )
        )

    return constats


# The ports this machine is expected to expose publicly. Anything else is a
# deviation to report — this is the list to update when a service is opened on
# purpose, and forgetting to do so is exactly what the check must catch.
PORTS_PUBLICS_ATTENDUS = {80, 443, 54410}


def controler_pare_feu() -> list[Constat]:
    constats: list[Constat] = []

    code, sortie = executer(["sudo", "-n", "nft", "list", "ruleset"])
    if code != 0:
        constats.append(
            Constat(
                "info",
                "hote",
                "Jeu de règles nftables illisible",
                f"`nft list ruleset` a échoué ({code}).",
                "Lancer l'audit en root ou autoriser `sudo -n nft`.",
            )
        )
    elif "hook input" in sortie:
        # The policy is only looked up on the input chain: `policy accept` on
        # output is normal, on input it cancels the firewall.
        entree = sortie.split("hook input", 1)[1][:400]
        if "policy drop" not in entree and "policy reject" not in entree:
            constats.append(
                Constat(
                    "eleve",
                    "hote",
                    "Chaîne d'entrée nftables en politique permissive",
                    "La chaîne input n'est ni en `policy drop` ni en "
                    "`policy reject` : tout port ouvert par un processus est "
                    "joignable depuis l'extérieur.",
                    "Passer la chaîne input en `policy drop` et n'accepter que "
                    "les ports nécessaires.",
                )
            )
    else:
        constats.append(
            Constat(
                "eleve",
                "hote",
                "Aucune chaîne d'entrée nftables",
                "Le jeu de règles ne comporte pas de hook input : la machine ne "
                "filtre pas son trafic entrant.",
                "Installer un jeu de règles nftables en politique `drop`.",
            )
        )

    # Listeners on a non-local address. A process listening on 0.0.0.0 is not
    # reachable as long as the firewall holds — but it becomes reachable at the
    # first relaxed rule, and nobody re-reads the list of listeners at that
    # moment.
    # TCP only. This machine's UDP listeners are avahi's (5353 and its ephemeral
    # ports) and the DHCP client's (68): they reappear on a different number at
    # every boot, so reporting them produces a new finding on every run, which
    # never points at anything. The services being looked for — a forgotten
    # server, a database published by mistake — listen on TCP.
    # `-u` is kept so that `ss` emits the Netid column: without it, the fields
    # shift by one and the address is read from the wrong place — which
    # silently made a real finding disappear from the report. TCP filtering is
    # therefore done on the column, not through the options.
    code, sortie = executer(["ss", "-tulnpH"])
    if code == 0:
        for ligne in sortie.splitlines():
            champs = ligne.split()
            if len(champs) < 5 or champs[0] != "tcp":
                continue
            adresse = champs[4]
            hote, _, port = adresse.rpartition(":")
            if not port.isdigit():
                continue
            if hote.strip("[]") in ("127.0.0.1", "::1", "127.0.0.53%lo", "127.0.0.54"):
                continue
            if hote.startswith("127."):
                continue
            numero = int(port)
            if numero in PORTS_PUBLICS_ATTENDUS:
                continue
            processus = champs[6] if len(champs) > 6 else ""
            constats.append(
                Constat(
                    "moyen",
                    "hote",
                    f"Écoute inattendue sur toutes les interfaces (port {numero})",
                    f"{adresse} {processus}. Le pare-feu la bloque aujourd'hui ; "
                    "elle deviendra publique à la première règle assouplie.",
                    "Restreindre l'écoute à 127.0.0.1, arrêter le service, ou "
                    "ajouter le port à PORTS_PUBLICS_ATTENDUS s'il est voulu.",
                )
            )

    return constats


def controler_durcissement_hote() -> list[Constat]:
    constats: list[Constat] = []

    for unite, titre, severite in (
        ("fail2ban", "fail2ban n'est pas actif", "moyen"),
        ("unattended-upgrades", "Les mises à jour automatiques sont inactives", "eleve"),
    ):
        code, sortie = executer(["systemctl", "is-active", unite])
        if sortie.strip() != "active":
            constats.append(
                Constat(
                    severite,
                    "hote",
                    titre,
                    f"`systemctl is-active {unite}` rapporte « {sortie.strip() or 'inconnu'} ».",
                    f"`systemctl enable --now {unite}`.",
                )
            )

    # Pending security updates. `apt-get -s` simulates: no writes, and no
    # dependency on a missing binary such as `jq`.
    code, sortie = executer(["apt-get", "-s", "upgrade"], delai=120)
    if code == 0:
        paquets = [l for l in sortie.splitlines() if l.startswith("Inst ")]
        securite = [l for l in paquets if "security" in l.lower()]
        if securite:
            noms = ", ".join(sorted({l.split()[1] for l in securite}))[:300]
            constats.append(
                Constat(
                    "eleve",
                    "hote",
                    f"{len(securite)} mise(s) à jour de sécurité en attente",
                    noms,
                    "`apt-get update && apt-get upgrade`.",
                )
            )
        elif paquets:
            constats.append(
                Constat(
                    "faible",
                    "hote",
                    f"{len(paquets)} mise(s) à jour en attente (hors sécurité)",
                    ", ".join(sorted({l.split()[1] for l in paquets}))[:300],
                    "`apt-get upgrade` à la prochaine fenêtre.",
                )
            )

    if Path("/var/run/reboot-required").exists():
        constats.append(
            Constat(
                "moyen",
                "hote",
                "Redémarrage requis",
                "/var/run/reboot-required est présent : un correctif installé "
                "(souvent le noyau) n'est pas encore appliqué au système en cours.",
                "Planifier un redémarrage.",
            )
        )

    return constats


def controler_permissions_secrets(racine: Path) -> list[Constat]:
    """Environment files must be readable by their owner only.

    A `.env.production` in 0644 puts AUTH_SECRET, the PostgreSQL password and
    Matomo's within reach of every local account — and of any compromised
    process running as another user.
    """
    constats: list[Constat] = []
    for chemin in sorted(racine.glob(".env*")):
        if chemin.name.endswith(".example") or not chemin.is_file():
            continue
        mode = chemin.stat().st_mode & 0o777
        if mode & 0o077:
            constats.append(
                Constat(
                    "eleve",
                    "hote",
                    f"Secrets lisibles au-delà du propriétaire : {chemin.name}",
                    f"Permissions {mode:04o}. Ce fichier porte AUTH_SECRET et les "
                    "mots de passe des bases.",
                    f"chmod 600 {chemin}",
                )
            )
    return constats


# --- "images" family --------------------------------------------------------


def controler_images(seuil_trivy: str = "HIGH,CRITICAL") -> list[Constat]:
    """CVEs in the stack's images.

    Third-party images (postgres, mariadb, matomo, caddy) are covered by no
    `npm audit`: they are updated by bumping the tag, and nothing in this
    repository says when that became necessary.
    """
    if not shutil.which("trivy"):
        return [
            Constat(
                "info",
                "images",
                "Trivy absent",
                "Le scan de CVE des images n'a pas été effectué.",
                "Installer trivy (dépôt apt aquasecurity).",
            )
        ]

    code, sortie = executer(
        ["docker", "ps", "--format", "{{.Image}}"],
        delai=30,
    )
    if code != 0:
        return [
            Constat(
                "info",
                "images",
                "Images en cours d'exécution introuvables",
                f"`docker ps` a échoué ({code}).",
                "Vérifier l'appartenance au groupe docker.",
            )
        ]

    constats: list[Constat] = []
    for image in sorted(set(filter(None, sortie.splitlines()))):
        code, brut = executer(
            [
                "trivy", "image",
                "--quiet",
                "--scanners", "vuln",
                "--severity", seuil_trivy,
                "--ignore-unfixed",  # a CVE with no published fix calls for no action
                "--format", "json",
                image,
            ],
            delai=600,
        )
        if code != 0:
            constats.append(
                Constat(
                    "info", "images", f"Scan échoué : {image}", brut[:300], ""
                )
            )
            continue

        try:
            donnees = json.loads(brut)
        except json.JSONDecodeError:
            continue

        trouvees: dict[str, list[str]] = {"CRITICAL": [], "HIGH": []}
        for resultat in donnees.get("Results") or []:
            for vuln in resultat.get("Vulnerabilities") or []:
                niveau = vuln.get("Severity", "")
                if niveau in trouvees:
                    trouvees[niveau].append(
                        f"{vuln.get('VulnerabilityID')} ({vuln.get('PkgName')} "
                        f"→ {vuln.get('FixedVersion', '?')})"
                    )

        for niveau, severite in (("CRITICAL", "eleve"), ("HIGH", "moyen")):
            liste = trouvees[niveau]
            if liste:
                constats.append(
                    Constat(
                        severite,
                        "images",
                        f"{len(liste)} CVE {niveau} corrigeable(s) dans {image}",
                        "; ".join(sorted(set(liste))[:12]),
                        f"Repousser le tag de {image} et redéployer.",
                    )
                )

    return constats


# --- "eol" family -----------------------------------------------------------
#
# What the "images" family cannot see. Trivy compares packages against a
# database of published CVEs: a version whose security support has ended looks
# no more vulnerable than any other there, because nobody publishes advisories
# for it any more. The blind spot is the exact opposite of the CVE scan — the
# deader the version, the quieter the report.
#
# Cycles and their dates come from endoflife.date. A table frozen here would age
# without a sound, and a table that lies about an end-of-support date is worse
# than no check at all: it reassures.

# Docker image name → endoflife.date product. The stack's third-party images
# are read from the compose file, not listed here: the file that deploys is the
# source of truth, and a second list would end up diverging from the first.
PRODUITS_EOL = {
    "postgres": "postgresql",
    "mariadb": "mariadb",
    "matomo": "matomo",
    "caddy": "caddy",
    "node": "nodejs",
}

# Below this, end of support is close enough that an upgrade should be planned
# rather than endured. A PostgreSQL or MariaDB major version is migrated with a
# downtime window: 90 days is a short lead time.
JOURS_AVANT_EOL = 90


def versions_de_la_pile(racine: Path) -> list[tuple[str, str, str]]:
    """Returns (endoflife.date product, cycle, source) for each deployed component.

    Everything is read from the files that deploy — compose, Dockerfile,
    package.json, /etc/os-release — and nothing is hard-coded: the day a tag is
    bumped, the check follows without anyone having to think about it.
    """
    releves: list[tuple[str, str, str]] = []

    def ajouter(image: str, origine: str) -> None:
        nom, _, tag = image.partition(":")
        produit = PRODUITS_EOL.get(nom.rsplit("/", 1)[-1])
        if not produit:
            return
        # `17-alpine`, `5-apache`, `11` → `17`, `5`, `11`. The distribution
        # suffix says nothing about the support cycle.
        cycle = re.match(r"(\d+(?:\.\d+)*)", tag or "")
        if cycle:
            releves.append((produit, cycle.group(1), origine))

    compose = racine / "docker-compose.yml"
    if compose.is_file():
        for image in re.findall(r"^\s*image:\s*([^\s#]+)", compose.read_text(encoding="utf-8"), re.M):
            ajouter(image, "docker-compose.yml")

    fichier_docker = racine / "Dockerfile"
    if fichier_docker.is_file():
        version = re.search(r"^ARG\s+NODE_VERSION=(\S+)", fichier_docker.read_text(encoding="utf-8"), re.M)
        if version:
            ajouter(f"node:{version.group(1)}", "Dockerfile")

    paquet = racine / "app" / "package.json"
    if paquet.is_file():
        try:
            donnees = json.loads(paquet.read_text(encoding="utf-8"))
            brut = (donnees.get("dependencies") or {}).get("next", "")
            majeure = re.match(r"[^\d]*(\d+)", brut)
            if majeure:
                releves.append(("nextjs", majeure.group(1), "app/package.json"))
        except (json.JSONDecodeError, OSError):
            pass

    # The host operating system. It carries the kernel, OpenSSL and the SSH
    # daemon: an unsupported Debian no longer receives fixes for any of the
    # three.
    osrelease = Path("/etc/os-release")
    if osrelease.is_file():
        texte = osrelease.read_text(encoding="utf-8")
        identifiant = re.search(r'^ID=("?)(\w+)\1', texte, re.M)
        version = re.search(r'^VERSION_ID="?(\d+(?:\.\d+)?)"?', texte, re.M)
        if identifiant and version and identifiant.group(2) in ("debian", "ubuntu"):
            releves.append((identifiant.group(2), version.group(1), "/etc/os-release"))

    return releves


def cycle_correspondant(cycles: list[dict], cycle: str) -> dict | None:
    """Finds the endoflife.date entry for a cycle, Docker tags included.

    An exact match is not enough: the `mariadb:11` tag follows the latest 11.x
    released, yet endoflife.date knows no "11" cycle — only 11.0 to 11.8.
    Without the prefix fallback, the most exposed component of the stack would
    be silently left out of the check.
    """
    for entree in cycles:
        if entree.get("cycle") == cycle:
            return entree

    familles = [e for e in cycles if str(e.get("cycle", "")).startswith(f"{cycle}.")]
    if not familles:
        return None
    return max(familles, key=lambda e: [int(n) for n in str(e["cycle"]).split(".") if n.isdigit()])


def controler_eol(racine: Path) -> list[Constat]:
    constats: list[Constat] = []
    releves = versions_de_la_pile(racine)
    if not releves:
        return [Constat("info", "eol", "Aucune version relevée", "Ni compose, ni Dockerfile, ni os-release exploitables.", "")]

    aujourdhui = datetime.now(timezone.utc).date()
    # What the check actually covered. Without this trace, a component that
    # drops out of the scan — a renamed service, a tag that loses its number —
    # makes the report greener, not redder: a check's silence and its success
    # are written the same way.
    couvertes: list[str] = []

    for produit, cycle, origine in sorted(set(releves)):
        reponse = requete(f"https://endoflife.date/api/{produit}.json", delai=20)
        if reponse is None or getattr(reponse, "status", 0) != 200:
            constats.append(
                Constat(
                    "info",
                    "eol",
                    f"Veille de fin de support indisponible : {produit}",
                    "endoflife.date n'a pas répondu. Le contrôle est ignoré pour ce produit, "
                    "pas concluant.",
                    "",
                )
            )
            continue

        try:
            entree = cycle_correspondant(json.loads(reponse.read().decode("utf-8")), cycle)
        except (json.JSONDecodeError, UnicodeDecodeError):
            entree = None

        if entree is None:
            constats.append(
                Constat(
                    "info",
                    "eol",
                    f"Cycle inconnu d'endoflife.date : {produit} {cycle}",
                    f"Relevé dans {origine}. Vérifier manuellement, ou corriger PRODUITS_EOL.",
                    "",
                )
            )
            continue

        # `eol` is `false` as long as no date is announced, and `true` when the
        # cycle is already dead with no known date. Only a string can be
        # compared.
        echeance = entree.get("eol")
        connu = f"{produit} {entree.get('cycle')} (relevé {cycle} dans {origine})"

        if echeance is True:
            constats.append(
                Constat("eleve", "eol", f"Fin de support atteinte : {connu}",
                        "endoflife.date marque ce cycle comme terminé.",
                        f"Monter vers un cycle maintenu (dernier publié : {entree.get('latest', '?')}).")
            )
            continue
        if not isinstance(echeance, str):
            continue

        try:
            date_eol = datetime.strptime(echeance, "%Y-%m-%d").date()
        except ValueError:
            continue

        restants = (date_eol - aujourdhui).days
        couvertes.append(f"{produit} {entree.get('cycle')} → {echeance}")
        if restants < 0:
            constats.append(
                Constat("eleve", "eol", f"Fin de support dépassée depuis {-restants} j : {connu}",
                        f"Support de sécurité terminé le {echeance}. Les CVE publiées depuis ne "
                        "seront pas corrigées, et un scan de CVE ne les verra pas davantage.",
                        f"Monter vers un cycle maintenu (dernier publié : {entree.get('latest', '?')}).")
            )
        elif restants <= JOURS_AVANT_EOL:
            constats.append(
                Constat("moyen", "eol", f"Fin de support dans {restants} j : {connu}",
                        f"Support de sécurité jusqu'au {echeance}.",
                        "Planifier la montée de version avant cette date.")
            )

    if couvertes:
        constats.append(
            Constat(
                "info",
                "eol",
                f"Briques dont la fin de support est datée : {len(couvertes)}",
                " ; ".join(couvertes),
                "",
            )
        )

    return constats


# --- "depot" family ---------------------------------------------------------

# Patterns of committed secrets. Deliberately few and very specific: a broad
# expression produces false positives on every run, and a report people learn
# to skim no longer protects anything.
MOTIFS_SECRETS = [
    (re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"), "clé privée"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "clé d'accès AWS"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}"), "jeton GitHub"),
    (re.compile(r"\bsk-[A-Za-z0-9]{32,}"), "clé d'API"),
    # The host is excluded from the class: a URL pointing at `localhost`, `db`
    # or `postgres` refers to a development database or a CI job's service,
    # whose password is a secret to nobody. Without this exclusion, the check
    # flagged three files on every run — and a report whose first three lines
    # people learn to ignore no longer protects anything.
    (
        re.compile(
            r"postgres(?:ql)?://[^\s:@/]+:[^\s:@/]+@"
            r"(?!localhost|127\.0\.0\.1|db[:/]|postgres[:/]|matomo-db[:/])"
        ),
        "URL PostgreSQL avec mot de passe",
    ),
]

# Files whose very purpose is to carry demonstration values.
CHEMINS_EXEMPTES = re.compile(r"(\.example$|^docs/|\.md$|package-lock\.json$)")


def controler_depot(racine: Path) -> list[Constat]:
    constats: list[Constat] = []

    # CVEs in the dependencies actually deployed. `--omit=dev` is essential:
    # without it the report is dominated by test tooling, which never runs in
    # production, and the signal drowns.
    code, brut = executer(
        ["npm", "audit", "--omit=dev", "--json"],
        delai=180,
    )
    try:
        donnees = json.loads(brut)
        totaux = donnees.get("metadata", {}).get("vulnerabilities", {})
        for niveau, severite in (("critical", "critique"), ("high", "eleve"), ("moderate", "moyen")):
            nombre = totaux.get(niveau, 0)
            if nombre:
                noms = ", ".join(sorted(donnees.get("vulnerabilities", {}))[:15])
                constats.append(
                    Constat(
                        severite,
                        "depot",
                        f"{nombre} vulnérabilité(s) {niveau} en dépendances de production",
                        noms,
                        "`npm audit fix`, ou relever la dépendance concernée.",
                    )
                )
    except json.JSONDecodeError:
        constats.append(
            Constat("info", "depot", "npm audit illisible", brut[:200], "")
        )

    # Secrets in files tracked by git. Git is queried rather than the file
    # system: what is not versioned does not leak through the repository, and
    # node_modules would blow up the check's duration.
    code, sortie = executer(["git", "-C", str(racine), "ls-files"], delai=60)
    if code == 0:
        for relatif in sortie.splitlines():
            if CHEMINS_EXEMPTES.search(relatif):
                continue
            chemin = racine / relatif
            try:
                if chemin.stat().st_size > 1_000_000:
                    continue
                contenu = chemin.read_text(errors="ignore")
            except (OSError, ValueError):
                continue
            for motif, libelle in MOTIFS_SECRETS:
                if motif.search(contenu):
                    constats.append(
                        Constat(
                            "critique",
                            "depot",
                            f"Secret potentiel committé : {libelle}",
                            f"Dans {relatif}.",
                            "Révoquer le secret, puis le retirer de l'historique "
                            "(git filter-repo). Le retirer du seul HEAD ne suffit pas.",
                        )
                    )

    # Demonstration AUTH_SECRET in production. The value is published in this
    # repository: anyone who knows it can forge a session for any account.
    env_production = racine / ".env.production"
    if env_production.is_file():
        try:
            texte = env_production.read_text(errors="ignore")
        except OSError:
            texte = ""
        if "fretline-demo-secret-do-not-use-in-production" in texte:
            constats.append(
                Constat(
                    "critique",
                    "depot",
                    "AUTH_SECRET de démonstration en production",
                    "La valeur publiée dans ce dépôt est utilisée par le "
                    "déploiement : n'importe qui peut forger une session.",
                    "openssl rand -base64 48, puis redéployer.",
                )
            )

    return constats


# --- "web" family -----------------------------------------------------------


def requete(url: str, *, methode: str = "GET", entetes: dict | None = None, delai: int = 20):
    """HTTP request that returns the response even on an error status.

    urllib raises on 4xx/5xx, yet a 404 is the *expected* result of several
    checks here: the exception is therefore caught and its object, which is a
    complete response, is returned as-is.
    """
    demande = urllib.request.Request(url, method=methode, headers=entetes or {})
    try:
        return urllib.request.urlopen(demande, timeout=delai)
    except urllib.error.HTTPError as erreur:
        return erreur
    except Exception:
        return None


# Headers expected on the target, with the severity of their absence.
ENTETES_ATTENDUS = {
    "content-security-policy": ("eleve", "Aucune politique de sécurité du contenu : une injection de script s'exécute sans obstacle."),
    "strict-transport-security": ("eleve", "Sans HSTS, la première visite peut être dégradée en clair."),
    "x-content-type-options": ("moyen", "Sans nosniff, le navigateur peut réinterpréter un type MIME."),
    "referrer-policy": ("faible", "L'URL complète peut fuiter vers les sites tiers visités."),
    "permissions-policy": ("faible", "Caméra, micro et géolocalisation restent demandables par tout script."),
}


def controler_entetes(cible: str) -> list[Constat]:
    constats: list[Constat] = []
    reponse = requete(cible)
    if reponse is None:
        return [
            Constat("eleve", "web", "Cible injoignable", f"Aucune réponse de {cible}.", "")
        ]

    entetes = {clef.lower(): valeur for clef, valeur in reponse.headers.items()}

    for nom, (severite, explication) in ENTETES_ATTENDUS.items():
        if nom not in entetes:
            constats.append(
                Constat(
                    severite, "web", f"En-tête absent : {nom}", explication,
                    "Ajouter l'en-tête (app/src/proxy.ts pour la CSP, Caddyfile sinon).",
                )
            )

    csp = entetes.get("content-security-policy", "")
    if csp:
        # A CSP reduced to `frame-ancestors` alone forbids framing and nothing
        # else. That is the exact state the initial audit found this deployment
        # in, hence a dedicated check rather than a mere presence test.
        if "script-src" not in csp and "default-src" not in csp:
            constats.append(
                Constat(
                    "eleve", "web", "CSP sans directive de script",
                    f"La politique servie est « {csp[:160]} » : ni script-src ni "
                    "default-src, donc aucune atténuation d'injection de script.",
                    "Poser une politique complète, à nonce (app/src/proxy.ts).",
                )
            )
        elif "'unsafe-inline'" in csp.split("script-src", 1)[-1].split(";", 1)[0]:
            constats.append(
                Constat(
                    "moyen", "web", "CSP : script-src autorise 'unsafe-inline'",
                    "Un script injecté dans le document s'exécute malgré la politique.",
                    "Passer à un nonce par requête avec 'strict-dynamic'.",
                )
            )

    if "server" in entetes and any(c.isdigit() for c in entetes["server"]):
        constats.append(
            Constat(
                "faible", "web", "L'en-tête Server annonce une version",
                f"Server: {entetes['server']}.",
                "Retirer l'en-tête au niveau du proxy (`-Server` dans le Caddyfile).",
            )
        )

    return constats


def controler_redirection(cible: str) -> list[Constat]:
    if not cible.startswith("https://"):
        return []
    en_clair = "http://" + cible[len("https://") :]

    # Opener that does not follow redirects. `urllib.request.urlopen` follows
    # them by default, so this check used to observe the 200 served over HTTPS
    # at the end and conclude there was no redirect — a false finding, of the
    # most expensive kind: it points at a non-existent problem on the check
    # whose success matters most.
    class SansRedirection(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *_args, **_kwargs):  # noqa: D102
            return None

    ouvreur = urllib.request.build_opener(SansRedirection)
    try:
        reponse = ouvreur.open(
            urllib.request.Request(en_clair, method="HEAD"), timeout=20
        )
    except urllib.error.HTTPError as erreur:
        reponse = erreur
    except Exception:
        return []
    emplacement = reponse.headers.get("location", "")
    if reponse.status not in (301, 308) or not emplacement.startswith("https://"):
        return [
            Constat(
                "eleve", "web", "Le trafic en clair n'est pas redirigé vers HTTPS",
                f"HTTP {reponse.status}, Location: {emplacement or '(absent)'}.",
                "Rediriger en 308 vers https au niveau du proxy.",
            )
        ]
    return []


# These routes wipe and rewrite the database. Three guards protect them,
# including `E2E_TEST_MODE`: a 404 is the only acceptable result in production.
#
# Each route is probed with the verb it actually exposes, and that is essential:
# Next rejects a non-exported verb with a 405 emitted *before* the handler body,
# hence before the guard that returns 404. Probing GET on a route that only
# exposes POST reported four critical findings on a perfectly healthy
# deployment — the 405 only proves there that the route file exists in the
# build, which is true of every build of the repository.
ENDPOINTS_DE_TEST = (
    ("POST", "/api/test/reset"),
    ("POST", "/api/test/seed"),
    ("GET", "/api/test/state"),
    ("POST", "/api/test/purge"),
)


def controler_endpoints_de_test(cible: str) -> list[Constat]:
    constats: list[Constat] = []
    for methode, chemin in ENDPOINTS_DE_TEST:
        reponse = requete(cible.rstrip("/") + chemin, methode=methode)
        if reponse is None:
            continue
        if reponse.status != 404:
            constats.append(
                Constat(
                    "critique",
                    "web",
                    f"Endpoint de test atteignable : {methode} {chemin}",
                    f"HTTP {reponse.status} au lieu de 404. Ces routes "
                    "tronquent la base et rejouent les graines.",
                    "Retirer E2E_TEST_MODE de l'environnement du déploiement "
                    "et redémarrer la pile.",
                )
            )
    return constats


def controler_sante(cible: str) -> list[Constat]:
    reponse = requete(cible.rstrip("/") + "/api/health")
    if reponse is None or reponse.status != 200:
        return []
    try:
        donnees = json.loads(reponse.read().decode())
    except (ValueError, OSError):
        return []

    constats: list[Constat] = []
    if donnees.get("testMode"):
        constats.append(
            Constat(
                "critique", "web", "Le déploiement tourne en mode test",
                "/api/health rapporte testMode=true : les endpoints de test sont ouverts.",
                "Retirer E2E_TEST_MODE et redémarrer.",
            )
        )
    if donnees.get("seededBugs"):
        constats.append(
            Constat(
                "eleve", "web", "Les défauts délibérés sont actifs en production",
                "/api/health rapporte seededBugs=true.",
                "Reconstruire l'image sans SEED_BUGS / NEXT_PUBLIC_SEED_BUGS.",
            )
        )
    return constats


def controler_cookies(cible: str) -> list[Constat]:
    """Checks the session cookie's attributes on a login attempt.

    The credentials are deliberately wrong: a 401 sets the cart cookie and is
    enough to judge the attributes, without creating an account or an order on
    production.
    """
    corps = json.dumps({"email": "audit@exemple.invalid", "password": "x"}).encode()
    demande = urllib.request.Request(
        cible.rstrip("/") + "/api/auth/login",
        data=corps,
        method="POST",
        headers={"content-type": "application/json"},
    )
    try:
        reponse = urllib.request.urlopen(demande, timeout=20)
    except urllib.error.HTTPError as erreur:
        reponse = erreur
    except Exception:
        return []

    constats: list[Constat] = []
    for brut in reponse.headers.get_all("set-cookie") or []:
        nom = brut.split("=", 1)[0].strip()
        minuscule = brut.lower()
        manquants = [
            attribut
            for attribut, present in (
                ("Secure", "secure" in minuscule),
                ("HttpOnly", "httponly" in minuscule),
                ("SameSite", "samesite" in minuscule),
            )
            if not present
        ]
        if manquants:
            constats.append(
                Constat(
                    "eleve" if "Secure" in manquants else "moyen",
                    "web",
                    f"Cookie {nom} sans {', '.join(manquants)}",
                    f"Set-Cookie: {brut[:120]}",
                    "Compléter les attributs (app/src/lib/auth.ts, "
                    "sessionCookieOptions).",
                )
            )
    return constats


def controler_tls(cible: str) -> list[Constat]:
    if not cible.startswith("https://"):
        return []
    hote = cible[len("https://") :].split("/", 1)[0].split(":")[0]
    contexte = ssl.create_default_context()
    try:
        with socket.create_connection((hote, 443), timeout=15) as brut:
            with contexte.wrap_socket(brut, server_hostname=hote) as tls:
                certificat = tls.getpeercert()
                version = tls.version()
    except Exception as erreur:
        return [
            Constat(
                "eleve", "web", "Échec de la négociation TLS",
                f"{hote}:443 — {erreur}",
                "Vérifier le certificat et la configuration du proxy.",
            )
        ]

    constats: list[Constat] = []

    if version in ("TLSv1", "TLSv1.1"):
        constats.append(
            Constat(
                "eleve", "web", f"Version TLS obsolète négociée : {version}",
                "TLS 1.0 et 1.1 sont dépréciés.",
                "N'accepter que TLS 1.2 et 1.3.",
            )
        )

    expiration = certificat.get("notAfter")
    if expiration:
        echeance = datetime.strptime(expiration, "%b %d %H:%M:%S %Y %Z").replace(
            tzinfo=timezone.utc
        )
        jours = (echeance - datetime.now(timezone.utc)).days
        if jours < 0:
            constats.append(
                Constat("critique", "web", "Certificat TLS expiré",
                        f"Expiré depuis {-jours} jour(s).", "Renouveler immédiatement."))
        elif jours < 15:
            # Caddy renews 30 days before expiry: under 15, automatic renewal
            # has already failed at least once.
            constats.append(
                Constat("eleve", "web", f"Certificat TLS expirant dans {jours} jour(s)",
                        "Caddy renouvelle normalement à 30 jours : ce délai "
                        "signale un renouvellement en échec.",
                        "Consulter `docker compose logs caddy`."))

    return constats


def controler_nuclei(cible: str) -> list[Constat]:
    """Signature-based scan.

    The `dos`, `intrusive` and `fuzz` templates are excluded: the target is
    production, and an audit that brings it to its knees costs more than it
    yields. The rate is throttled for the same reason — the breaking-point test
    puts this machine's wall at around 80 requests per second.
    """
    if not shutil.which("nuclei"):
        return [
            Constat("info", "web", "Nuclei absent",
                    "Le scan par signatures n'a pas été effectué.",
                    "Installer nuclei (release GitHub projectdiscovery).")
        ]

    # Without templates, nuclei exits with an error *and writes nothing to
    # stdout*: the scan then produced zero findings, presented as a clean scan.
    # That is the worst possible failure mode for monitoring, and it actually
    # happened — `nuclei -update-templates` was failing silently on this
    # machine. The directory is therefore checked first, and its absence is
    # reported as a check not performed, never as a success.
    modeles = next(
        (
            chemin
            for chemin in (
                Path(os.environ.get("NUCLEI_TEMPLATES", "")),
                Path.home() / "nuclei-templates",
                Path.home() / ".local" / "nuclei-templates",
            )
            if chemin.name and chemin.is_dir() and any(chemin.rglob("*.yaml"))
        ),
        None,
    )
    if modeles is None:
        return [
            Constat(
                "info", "web", "Modèles nuclei introuvables",
                "Le scan par signatures n'a pas été effectué : aucun répertoire "
                "de modèles utilisable. Un scan sans modèle ne rapporte rien et "
                "ressemble à un scan réussi.",
                "git clone --depth 1 "
                "https://github.com/projectdiscovery/nuclei-templates ~/nuclei-templates",
            )
        ]

    code, brut = executer(
        [
            "nuclei", "-target", cible,
            "-templates", str(modeles),
            "-jsonl", "-silent", "-no-color",
            "-severity", "low,medium,high,critical",
            "-exclude-tags", "dos,intrusive,fuzz",
            "-rate-limit", "20",
            "-timeout", "10",
            "-disable-update-check",
        ],
        delai=1800,
    )

    correspondance = {
        "critical": "critique",
        "high": "eleve",
        "medium": "moyen",
        "low": "faible",
        "info": "info",
    }

    constats: list[Constat] = []
    for ligne in brut.splitlines():
        ligne = ligne.strip()
        if not ligne.startswith("{"):
            continue
        try:
            trouvaille = json.loads(ligne)
        except json.JSONDecodeError:
            continue
        info = trouvaille.get("info", {})
        constats.append(
            Constat(
                correspondance.get(info.get("severity", "info"), "info"),
                "web",
                f"Nuclei : {info.get('name', trouvaille.get('template-id', 'inconnu'))}",
                f"{trouvaille.get('matched-at', cible)} "
                f"[{trouvaille.get('template-id', '')}]",
                (info.get("remediation") or "Voir la fiche du modèle nuclei.")[:300],
            )
        )
    return constats


# --- Rendering --------------------------------------------------------------

SYMBOLES = {
    "critique": "!!",
    "eleve": " !",
    "moyen": " ~",
    "faible": " -",
    "info": " .",
}


def rendre_texte(rapport: Rapport) -> str:
    lignes = [
        "═" * 78,
        f"  Audit de sécurité — {rapport.horodatage}",
        f"  Hôte : {rapport.hote}    Cible : {rapport.cible or '(aucune)'}",
        "═" * 78,
        "",
    ]

    if not rapport.constats:
        lignes.append("  Aucun constat. Tous les contrôles exécutés sont passés.")
        lignes.append("")
        return "\n".join(lignes)

    par_severite: dict[str, list[Constat]] = {}
    for constat in rapport.constats:
        par_severite.setdefault(constat.severite, []).append(constat)

    resume = "  ".join(
        f"{niveau} : {len(par_severite[niveau])}"
        for niveau in SEVERITES
        if niveau in par_severite
    )
    lignes.append(f"  {resume}")
    lignes.append("")

    for niveau in SEVERITES:
        for constat in par_severite.get(niveau, []):
            lignes.append(f"{SYMBOLES[niveau]} [{niveau.upper()}] [{constat.famille}] {constat.titre}")
            lignes.append(f"      {constat.detail}")
            if constat.correctif:
                lignes.append(f"      → {constat.correctif}")
            lignes.append("")

    if rapport.controles_ignores:
        lignes.append("  Contrôles ignorés : " + ", ".join(rapport.controles_ignores))
        lignes.append("")

    return "\n".join(lignes)


# --- Entry point ------------------------------------------------------------


def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Security audit of the VPS, the stack and the public target.",
    )
    analyseur.add_argument(
        "--cible",
        default=os.environ.get("AUDIT_CIBLE", ""),
        help="URL of the site to probe (e.g. https://example.com). Without it, the \"web\" family is skipped.",
    )
    analyseur.add_argument(
        "--familles",
        default="hote,images,eol,depot,web",
        help="Comma-separated families to run.",
    )
    analyseur.add_argument(
        "--racine",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Root of the repository to inspect.",
    )
    analyseur.add_argument(
        "--seuil",
        choices=SEVERITES,
        default="eleve",
        help="Severity from which the exit code is 1 (default: eleve).",
    )
    analyseur.add_argument("--format", choices=("texte", "json"), default="texte")
    analyseur.add_argument(
        "--sortie",
        type=Path,
        help="Also writes the full JSON report to this path, whatever --format is.",
    )
    arguments = analyseur.parse_args()

    familles = {f.strip() for f in arguments.familles.split(",") if f.strip()}

    rapport = Rapport(
        horodatage=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        hote=socket.gethostname(),
        cible=arguments.cible,
    )

    if "hote" in familles:
        rapport.ajouter(*controler_sshd())
        rapport.ajouter(*controler_pare_feu())
        rapport.ajouter(*controler_durcissement_hote())
        rapport.ajouter(*controler_permissions_secrets(arguments.racine))

    if "images" in familles:
        rapport.ajouter(*controler_images())

    if "eol" in familles:
        rapport.ajouter(*controler_eol(arguments.racine))

    if "depot" in familles:
        rapport.ajouter(*controler_depot(arguments.racine))

    if "web" in familles:
        if not arguments.cible:
            rapport.controles_ignores.append("web (aucune --cible fournie)")
        else:
            rapport.ajouter(*controler_entetes(arguments.cible))
            rapport.ajouter(*controler_redirection(arguments.cible))
            rapport.ajouter(*controler_endpoints_de_test(arguments.cible))
            rapport.ajouter(*controler_sante(arguments.cible))
            rapport.ajouter(*controler_cookies(arguments.cible))
            rapport.ajouter(*controler_tls(arguments.cible))
            rapport.ajouter(*controler_nuclei(arguments.cible))

    serialise = json.dumps(
        {
            "horodatage": rapport.horodatage,
            "hote": rapport.hote,
            "cible": rapport.cible,
            "controles_ignores": rapport.controles_ignores,
            "constats": [asdict(c) for c in rapport.constats],
        },
        ensure_ascii=False,
        indent=2,
    )

    if arguments.sortie:
        arguments.sortie.parent.mkdir(parents=True, exist_ok=True)
        arguments.sortie.write_text(serialise + "\n", encoding="utf-8")

    print(serialise if arguments.format == "json" else rendre_texte(rapport))

    retenus = rapport.au_dessus_de(arguments.seuil)
    if retenus:
        print(
            f"ÉCHEC : {len(retenus)} constat(s) de sévérité « {arguments.seuil} » ou pire.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
