/**
 * Corps Node.js du hook de démarrage, isolé dans son propre module.
 *
 * La séparation n'est pas cosmétique. Next compile `instrumentation.ts` pour
 * les deux runtimes, et son analyse est **statique** : elle voit `process.exit`
 * dans le texte du module et avertit qu'il n'existe pas sur le runtime edge,
 * quand bien même le garde `NEXT_RUNTIME !== 'nodejs'` en interdit l'exécution.
 * Un contrôle statique ne peut pas lire un test d'exécution. Déplacer l'appel
 * derrière un `import()` dynamique conditionnel est ce qui le sort réellement du
 * graphe edge — c'est la forme recommandée par Next, et la seule qui fasse
 * disparaître l'avertissement sans le masquer.
 *
 * Concrètement : ne pas réintroduire d'API Node.js dans `instrumentation.ts`.
 * Elles vivent ici.
 */
export async function verifierConfiguration(): Promise<void> {
  const { assertDeploymentConfig, deploymentWarnings } = await import('@/lib/deployment');

  for (const warning of deploymentWarnings()) {
    console.warn(`[fretline] ATTENTION — ${warning}`);
  }

  try {
    assertDeploymentConfig();
  } catch (error) {
    console.error(`[fretline] configuration refusée : ${(error as Error).message}`);
    // An explicit exit rather than a rethrow: a thrown error here is reported
    // but leaves the server listening, which is exactly the outcome this guard
    // exists to prevent.
    //
    // Note that the server prints "Ready" just before this runs. Nothing is
    // signed in that window: `authSecret()` throws on every call in production,
    // so a request arriving between the two would fail rather than mint a token
    // with the published demo key. The exit is there to make the mistake
    // impossible to miss, not to close a hole.
    process.exit(1);
  }
}
