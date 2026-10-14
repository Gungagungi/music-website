#!/usr/bin/env python3
"""Pre-production check for pull requests — the `Pré-production` commit status.

    ./scripts/verifier-preprod.py            # every open PR whose head has no verdict
    ./scripts/verifier-preprod.py --pr 49    # only this one, verdict or not

Run every five minutes by scripts/systemd/verifier-preprod.timer. For each open,
non-draft PR whose head commit carries no `Pré-production` status yet, it:

  1. posts `pending` on that commit;
  2. deploys it with scripts/deployer-preprod.sh <branch> <commit>, which also
     checks /api/health from inside the container and through Caddy;
  3. runs the Playwright `api` project against the deployed slot;
  4. posts `success` or `failure`.

Why an agent on the host rather than a job in ci.yml: a GitHub runner has no
access to this machine, and opening one — an SSH key in the repository secrets,
or a self-hosted runner — would put a door to the production host in GitHub.
Here nothing listens: the agent polls and writes statuses with the `gh` session
already on the host. The price is a five-minute delay and a queue (ADR-007: one
slot, so PRs are deployed one after the other).

Only PRs whose branch lives in this repository are checked. The repository is
public: a fork's PR would otherwise get its Dockerfile built by the production
host's Docker daemon and its test code run under the `debian` account. Those
PRs get an `error` status saying so, so that the required check explains itself
instead of staying silently absent.

Test failures are a verdict, not an agent failure: the script exits 0. It exits
non-zero only when it could not do its job (GitHub unreachable, a crash), which
is what the systemd unit should report.
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import subprocess
import sys
import time
from pathlib import Path

DEPOT = Path(__file__).resolve().parent.parent
ETAT = Path.home() / ".local/share/fretline-preprod"
WORKTREE = Path(os.environ.get("PREPROD_WORKTREE", ETAT / "worktree"))
JOURNAUX = ETAT / "journaux"
# Same file as scripts/deployer-preprod.sh: held for the whole deploy-and-test
# sequence, so a manual deployment cannot swap the build under a running suite.
VERROU = ETAT / "deploy.lock"

# The context name is what branch protection requires: renaming it here without
# updating the protection leaves every PR waiting for a status nobody posts.
CONTEXTE = "Pré-production"
RETENTION_JOURNAUX_JOURS = 30


def gh_api(chemin: str, *args: str) -> object:
    # `{owner}/{repo}` is resolved by gh from the checkout's remote. gh 2.46 on
    # this host: `gh api` is enough, none of the newer `--json` subcommands.
    sortie = subprocess.run(
        ["gh", "api", *args, chemin],
        cwd=DEPOT, check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(sortie) if sortie.strip() else None


def poser_statut(sha: str, etat: str, description: str) -> None:
    # GitHub truncates nothing: past 140 characters it rejects the status.
    gh_api(
        f"repos/{{owner}}/{{repo}}/statuses/{sha}",
        "-X", "POST",
        "-f", f"state={etat}",
        "-f", f"context={CONTEXTE}",
        "-f", f"description={description[:140]}",
    )


def dernier_statut(sha: str) -> str | None:
    # The combined status lists the latest state per context.
    combine = gh_api(f"repos/{{owner}}/{{repo}}/commits/{sha}/status")
    for statut in combine.get("statuses", []):
        if statut["context"] == CONTEXTE:
            return statut["state"]
    return None


def lire_env(fichier: Path, cle: str) -> str:
    # Same reading as deployer-preprod.sh: last assignment wins, quotes dropped.
    valeur = ""
    if fichier.is_file():
        for ligne in fichier.read_text().splitlines():
            ligne = ligne.strip()
            if ligne.startswith(f"{cle}=") or ligne.startswith(f"{cle} ="):
                valeur = ligne.split("=", 1)[1].strip().strip("'\"")
    return valeur


def executer(commande: list[str], journal, **kwargs) -> int:
    journal.write(f"\n$ {' '.join(commande)}\n")
    journal.flush()
    return subprocess.run(commande, stdout=journal, stderr=subprocess.STDOUT, **kwargs).returncode


def bilan_playwright() -> str:
    try:
        stats = json.loads((WORKTREE / "e2e/reports/results.json").read_text())["stats"]
    except (OSError, ValueError, KeyError):
        return ""
    bilan = f"{stats.get('expected', 0)} verts"
    if stats.get("unexpected"):
        bilan += f", {stats['unexpected']} en échec"
    if stats.get("flaky"):
        bilan += f", {stats['flaky']} instables"
    return bilan


def verifier(pr: dict) -> None:
    numero, branche, sha = pr["number"], pr["head"]["ref"], pr["head"]["sha"]
    JOURNAUX.mkdir(parents=True, exist_ok=True)
    chemin_journal = JOURNAUX / f"pr-{numero}-{sha[:7]}.log"
    print(f"PR #{numero} {branche} @ {sha[:7]} → {chemin_journal}", flush=True)
    poser_statut(sha, "pending", "Déploiement en pré-production…")

    with chemin_journal.open("w") as journal:
        env = {**os.environ, "PREPROD_LOCK_HELD": "1"}
        code = executer([str(DEPOT / "scripts/deployer-preprod.sh"), branche, sha], journal, env=env)
        if code != 0:
            poser_statut(sha, "failure", f"Déploiement en échec — journal sur le VPS : {chemin_journal.name}")
            return

        poser_statut(sha, "pending", "Déployée, suite API en cours…")
        # Only the e2e workspace: the app's dependencies (next, sharp) are what the
        # image just built, and installing them on the host would cost minutes of
        # CPU shared with the store for nothing the suite reads.
        code = executer(
            ["npm", "ci", "--workspace", "e2e", "--no-audit", "--no-fund"],
            journal, cwd=WORKTREE,
        )
        if code != 0:
            poser_statut(sha, "error", f"npm ci en échec — journal sur le VPS : {chemin_journal.name}")
            return

        domaine = lire_env(DEPOT / ".env.production", "FRETLINE_PREPROD_DOMAIN")
        env_tests = {
            **os.environ,
            "BASE_URL": f"https://{domaine}" if domaine else "http://127.0.0.1:8083",
            "TEST_API_TOKEN": lire_env(DEPOT / ".env.preprod", "TEST_API_TOKEN"),
            "PREPROD_ACCESS_KEY": lire_env(DEPOT / ".env.production", "PREPROD_ACCESS_KEY"),
        }
        # Without CI, the config reuses the server at BASE_URL instead of starting
        # one: the pre-production is that server.
        env_tests.pop("CI", None)
        # One retry, as the CI does for its own runs: the suite goes through the
        # public network and Caddy here, and a reported flaky is still visible.
        code = executer(
            ["npx", "playwright", "test", "--project=api", "--retries=1"],
            journal, cwd=WORKTREE / "e2e", env=env_tests,
        )

    bilan = bilan_playwright()
    if code == 0:
        poser_statut(sha, "success", f"Déployée, santé OK, suite API : {bilan or 'verte'}")
    else:
        poser_statut(sha, "failure", f"Suite API : {bilan or 'en échec'} — journal sur le VPS : {chemin_journal.name}")


def purger_journaux() -> None:
    limite = time.time() - RETENTION_JOURNAUX_JOURS * 86400
    for journal in JOURNAUX.glob("pr-*.log"):
        if journal.stat().st_mtime < limite:
            journal.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--pr", type=int, help="check this PR even if its head already has a verdict")
    args = parser.parse_args()

    ETAT.mkdir(parents=True, exist_ok=True)
    verrou = VERROU.open("w")
    try:
        fcntl.flock(verrou, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        # The previous tick is still deploying, or a manual deployment is running:
        # the next tick will pick up whatever is left.
        print("Pre-production busy, nothing to do this tick.")
        return 0

    if args.pr:
        prs = [gh_api(f"repos/{{owner}}/{{repo}}/pulls/{args.pr}")]
    else:
        prs = gh_api("repos/{owner}/{repo}/pulls?state=open&per_page=100")

    a_verifier = []
    for pr in sorted(prs, key=lambda p: p["number"]):
        if pr["draft"] and not args.pr:
            continue
        sha = pr["head"]["sha"]
        tete = pr["head"]["repo"]
        if not tete or tete["full_name"] != pr["base"]["repo"]["full_name"]:
            if dernier_statut(sha) is None:
                poser_statut(sha, "error", "PR depuis un fork : jamais déployée sur l'hôte de production")
            continue
        # Holding the lock means no other run is in progress: a `pending` left
        # behind is a run that died (reboot, timeout) and gets redone.
        if args.pr or dernier_statut(sha) in (None, "pending"):
            a_verifier.append(pr)

    for pr in a_verifier:
        try:
            verifier(pr)
        except Exception as erreur:  # noqa: BLE001 — never leave a PR stuck on `pending`
            poser_statut(pr["head"]["sha"], "error", f"Erreur de l'agent : {type(erreur).__name__}")
            raise

    purger_journaux()
    return 0


if __name__ == "__main__":
    sys.exit(main())
