#!/usr/bin/env python3
"""Audit de sécurité récurrent : l'hôte, la pile de conteneurs, le dépôt, la cible publique.

Un seul fichier, sans dépendance Python tierce : ce script tourne depuis un
timer systemd sur le VPS de production, et une chaîne d'installation qui peut
casser au renouvellement d'un paquet transforme une surveillance en angle mort
silencieux. Les seuls binaires externes sont optionnels et détectés à l'exécution
(`trivy`, `nuclei`) — leur absence dégrade le rapport, elle ne l'interrompt pas.

Quatre familles de contrôles, activables séparément :

  hote        sshd, nftables, fail2ban, mises à jour, permissions des secrets
  images      CVE des images de la pile (trivy)
  depot       CVE des dépendances de production, secrets committés, .env
  web         en-têtes, TLS, endpoints de test, cookies, signatures (nuclei)

Chaque contrôle produit zéro ou plusieurs constats. Le code de sortie vaut 0
quand rien ne dépasse le seuil demandé, 1 sinon — c'est ce qui fait rougir
l'unité systemd, et ce qui rend l'échec visible sans lire le rapport.

Usage :
    scripts/audit-securite.py --cible https://exemple.fr
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

# --- Modèle ----------------------------------------------------------------

# Ordonnées de la plus grave à la moins grave : l'index sert de comparaison,
# ce qui évite d'éparpiller des `if severite == ...` dans tout le fichier.
SEVERITES = ("critique", "eleve", "moyen", "faible", "info")


@dataclass
class Constat:
    """Un problème observé, ou une observation neutre lorsqu'il n'y en a pas."""

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
    """Lance une commande et rend (code, sortie). N'échoue jamais par exception.

    Un audit qui s'interrompt parce qu'un binaire a changé d'avis sur son code
    de retour ne rapporte rien du tout, ce qui est pire que de rapporter un
    contrôle ignoré.
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


# --- Famille « hote » -------------------------------------------------------


def controler_sshd() -> list[Constat]:
    """Lit la configuration *effective* de sshd, pas le fichier principal.

    La distinction n'est pas théorique : c'est précisément ce qui a été trouvé
    sur ce serveur. `/etc/ssh/sshd_config` portait `PasswordAuthentication no`,
    mais un `Include` placé plus haut tirait un fichier cloud-init qui disait
    `yes` — et en sshd, la première valeur obtenue gagne. Relire le fichier
    principal aurait conclu que tout allait bien.
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


# Les ports que cette machine est censée exposer publiquement. Tout le reste
# constitue un écart à signaler — c'est la liste qu'on met à jour quand on
# ouvre délibérément un service, et l'oubli de le faire est exactement ce que
# le contrôle doit attraper.
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
        # On ne cherche la politique que sur la chaîne d'entrée : `policy accept`
        # en sortie est normal, en entrée il annule le pare-feu.
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

    # Écoutes sur une adresse non locale. Un processus qui écoute sur 0.0.0.0
    # n'est pas joignable tant que le pare-feu tient — mais il le devient à la
    # première règle assouplie, et personne ne relit la liste des écoutes à ce
    # moment-là.
    # TCP seulement. Les écoutes UDP de cette machine sont celles d'avahi (5353
    # et ses ports éphémères) et du client DHCP (68) : elles réapparaissent à
    # chaque démarrage sur un numéro différent, donc les signaler produit un
    # constat neuf à chaque exécution, qui ne désigne jamais rien. Les services
    # qu'on cherche — un serveur oublié, une base publiée par mégarde — écoutent
    # en TCP.
    # `-u` est conservé pour que `ss` émette la colonne Netid : sans elle, les
    # champs se décalent d'un cran et l'adresse est lue au mauvais endroit — ce
    # qui a fait disparaître un vrai constat du rapport en silence. Le filtrage
    # TCP se fait donc sur la colonne, pas sur les options.
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

    # Mises à jour de sécurité en attente. `apt-get -s` simule : aucune écriture,
    # et pas de dépendance à un binaire absent comme `jq`.
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
    """Les fichiers d'environnement ne doivent être lisibles que par leur propriétaire.

    Un `.env.production` en 0644 met AUTH_SECRET, le mot de passe PostgreSQL et
    celui de Matomo à la portée de tout compte local — et de tout processus
    compromis tournant sous un autre utilisateur.
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


# --- Famille « images » -----------------------------------------------------


def controler_images(seuil_trivy: str = "HIGH,CRITICAL") -> list[Constat]:
    """CVE des images de la pile.

    Les images tierces (postgres, mariadb, matomo, caddy) ne sont couvertes par
    aucun `npm audit` : elles se mettent à jour en repoussant le tag, et rien
    dans ce dépôt ne dit quand c'est devenu nécessaire.
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
                "--ignore-unfixed",  # une CVE sans correctif publié n'appelle aucune action
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


# --- Famille « depot » ------------------------------------------------------

# Motifs de secrets committés. Volontairement peu nombreux et très spécifiques :
# une expression large produit des faux positifs à chaque exécution, et un
# rapport qu'on apprend à survoler ne protège plus de rien.
MOTIFS_SECRETS = [
    (re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"), "clé privée"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "clé d'accès AWS"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}"), "jeton GitHub"),
    (re.compile(r"\bsk-[A-Za-z0-9]{32,}"), "clé d'API"),
    # L'hôte est exclu de la classe : une URL pointant vers `localhost`, `db`
    # ou `postgres` désigne une base de développement ou le service d'un job CI,
    # dont le mot de passe n'est un secret pour personne. Sans cette exclusion,
    # le contrôle signalait trois fichiers à chaque exécution — et un rapport
    # dont on apprend à ignorer les trois premières lignes ne protège plus.
    (
        re.compile(
            r"postgres(?:ql)?://[^\s:@/]+:[^\s:@/]+@"
            r"(?!localhost|127\.0\.0\.1|db[:/]|postgres[:/]|matomo-db[:/])"
        ),
        "URL PostgreSQL avec mot de passe",
    ),
]

# Les fichiers dont le rôle est justement de porter des valeurs de démonstration.
CHEMINS_EXEMPTES = re.compile(r"(\.example$|^docs/|\.md$|package-lock\.json$)")


def controler_depot(racine: Path) -> list[Constat]:
    constats: list[Constat] = []

    # CVE des dépendances réellement déployées. `--omit=dev` est essentiel :
    # sans lui le rapport est dominé par l'outillage de test, qui ne tourne
    # jamais en production, et le signal se noie.
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

    # Secrets dans les fichiers suivis par git. On interroge git plutôt que le
    # système de fichiers : ce qui n'est pas versionné ne fuit pas par le dépôt,
    # et node_modules ferait exploser la durée du contrôle.
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

    # AUTH_SECRET de démonstration en production. La valeur est publiée dans ce
    # dépôt : quiconque la connaît forge une session pour n'importe quel compte.
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


# --- Famille « web » --------------------------------------------------------


def requete(url: str, *, methode: str = "GET", entetes: dict | None = None, delai: int = 20):
    """Requête HTTP qui rend la réponse même sur code d'erreur.

    urllib lève sur 4xx/5xx, or un 404 est ici le résultat *attendu* de
    plusieurs contrôles : l'exception est donc rattrapée et son objet, qui est
    une réponse complète, est rendu tel quel.
    """
    demande = urllib.request.Request(url, method=methode, headers=entetes or {})
    try:
        return urllib.request.urlopen(demande, timeout=delai)
    except urllib.error.HTTPError as erreur:
        return erreur
    except Exception:
        return None


# En-têtes attendus sur la cible, avec la sévérité de leur absence.
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
        # Une CSP réduite au seul `frame-ancestors` interdit le cadrage et rien
        # d'autre. C'est l'état exact dans lequel l'audit initial a trouvé ce
        # déploiement, d'où un contrôle dédié plutôt qu'une simple présence.
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

    # Ouvreur qui ne suit pas les redirections. `urllib.request.urlopen` les
    # suit par défaut, donc ce contrôle observait le 200 servi en HTTPS à
    # l'arrivée et concluait à l'absence de redirection — un faux constat, du
    # type le plus coûteux : il désigne un problème inexistant sur le contrôle
    # dont la réussite compte le plus.
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


# Ces routes effacent et réécrivent la base. Trois gardes les protègent, dont
# `E2E_TEST_MODE` : un 404 est le seul résultat acceptable en production.
#
# Chaque route est sondée avec le verbe qu'elle expose réellement, et c'est
# indispensable : Next rejette un verbe non exporté par un 405 émis *avant* le
# corps du handler, donc avant la garde qui renvoie 404. Sonder GET sur une
# route qui n'expose que POST rapportait quatre constats critiques sur un
# déploiement parfaitement sain — le 405 y prouve seulement que le fichier de
# route existe dans le build, ce qui est vrai de toute construction du dépôt.
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
    """Vérifie les attributs du cookie de session sur une tentative de connexion.

    Les identifiants sont volontairement faux : un 401 pose le cookie de panier
    et suffit à juger les attributs, sans créer ni compte ni commande sur la
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
            # Caddy renouvelle à 30 jours de l'échéance : sous 15, le
            # renouvellement automatique a déjà échoué au moins une fois.
            constats.append(
                Constat("eleve", "web", f"Certificat TLS expirant dans {jours} jour(s)",
                        "Caddy renouvelle normalement à 30 jours : ce délai "
                        "signale un renouvellement en échec.",
                        "Consulter `docker compose logs caddy`."))

    return constats


def controler_nuclei(cible: str) -> list[Constat]:
    """Scan par signatures.

    Les modèles `dos`, `intrusive` et `fuzz` sont exclus : la cible est une
    production, et un audit qui la met à genoux coûte plus qu'il ne rapporte.
    Le débit est bridé pour la même raison — le test de rupture situe le mur de
    cette machine autour de 80 requêtes par seconde.
    """
    if not shutil.which("nuclei"):
        return [
            Constat("info", "web", "Nuclei absent",
                    "Le scan par signatures n'a pas été effectué.",
                    "Installer nuclei (release GitHub projectdiscovery).")
        ]

    # Sans modèles, nuclei sort en erreur *et n'écrit rien sur la sortie* : le
    # scan produisait alors zéro constat, présenté comme un scan propre. C'est
    # le pire mode de panne possible pour une surveillance, et il s'est
    # effectivement produit — `nuclei -update-templates` échouait en silence sur
    # cette machine. Le répertoire est donc vérifié avant, et son absence est
    # rapportée comme un contrôle non effectué, jamais comme une réussite.
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


# --- Restitution ------------------------------------------------------------

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


# --- Point d'entrée ---------------------------------------------------------


def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Audit de sécurité du VPS, de la pile et de la cible publique.",
    )
    analyseur.add_argument(
        "--cible",
        default=os.environ.get("AUDIT_CIBLE", ""),
        help="URL du site à sonder (ex. https://exemple.fr). Sans elle, la famille « web » est ignorée.",
    )
    analyseur.add_argument(
        "--familles",
        default="hote,images,depot,web",
        help="Familles à exécuter, séparées par des virgules.",
    )
    analyseur.add_argument(
        "--racine",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Racine du dépôt à inspecter.",
    )
    analyseur.add_argument(
        "--seuil",
        choices=SEVERITES,
        default="eleve",
        help="Sévérité à partir de laquelle le code de sortie vaut 1 (défaut : eleve).",
    )
    analyseur.add_argument("--format", choices=("texte", "json"), default="texte")
    analyseur.add_argument(
        "--sortie",
        type=Path,
        help="Écrit aussi le rapport JSON complet à ce chemin, quel que soit --format.",
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
