# cc-telegram

[![npm version](https://badge.fury.io/js/cc-telegram.svg)](https://www.npmjs.com/package/cc-telegram)
[![GitHub](https://img.shields.io/github/license/hada0127/cc-telegram)](https://github.com/hada0127/cc-telegram)

🌍 **Language / 언어 / 语言**:
[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md) | [Español](README.es.md) | [हिन्दी](README.hi.md) | [العربية](README.ar.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

**GitHub**: [https://github.com/hada0127/cc-telegram](https://github.com/hada0127/cc-telegram)

---

Exécution à distance de Claude Code via bot Telegram.

Contrôlez Claude Code de n'importe où en utilisant votre application Telegram. Créez des tâches, surveillez la progression et recevez des notifications de complétion - le tout depuis votre téléphone.

## Fonctionnalités

- **Exécution de Tâches à Distance** : Envoyez des tâches de codage à Claude Code via Telegram
- **Exécution Parallèle** : Exécutez plusieurs tâches simultanément (configurable)
- **Système de Priorités** : Niveaux de priorité Urgent, Élevé, Normal, Faible
- **Réessai Automatique** : Réessai automatique en cas d'échec avec tentatives configurables
- **Statut en Temps Réel** : Surveillez la progression des tâches et la sortie de Claude
- **Rotation des Logs** : Nettoyage automatique des anciens logs et tâches terminées

## Prérequis

- Node.js 18.0.0 ou supérieur
- [Claude Code CLI](https://claude.ai/claude-code) installé et authentifié
- Compte Telegram

## Installation

```bash
npx cc-telegram
```

Ou installer globalement :

```bash
npm install -g cc-telegram
cc-telegram
```

## Configuration Initiale

Lors de la première exécution, cc-telegram vous guidera à travers le processus de configuration :

1. **Créer un Bot Telegram**
   - Ouvrez Telegram et recherchez [@BotFather](https://t.me/BotFather)
   - Envoyez `/newbot` et suivez les instructions
   - Copiez le token du bot fourni

2. **Entrer le Token du Bot**
   - Collez votre token du bot lorsque demandé
   - L'outil vérifiera que le token est valide

3. **Lier Votre Compte**
   - Ouvrez votre nouveau bot dans Telegram
   - Envoyez `/start` au bot
   - Le CLI détectera votre message et affichera votre chat ID
   - Entrez le chat ID pour confirmer

4. **Configurer les Paramètres**
   - Définissez le nombre de réessais par défaut (recommandé : 15)
   - Activez/désactivez l'exécution parallèle
   - Définissez le maximum de tâches concurrentes (si parallèle activé)

Votre configuration est stockée localement dans `.cc-telegram/config.json` (chiffré).

## Utilisation

Après la configuration, exécutez simplement :

```bash
npx cc-telegram
```

Le bot démarrera et écoutera les commandes de votre compte Telegram.

## Commandes Telegram

| Commande | Description |
|----------|-------------|
| `/new` | Créer une nouvelle tâche |
| `/list` | Voir les tâches en attente et en cours |
| `/completed` | Voir les tâches terminées |
| `/failed` | Voir les tâches échouées |
| `/status` | Vérifier l'état d'exécution actuel et annuler les tâches en cours |
| `/debug` | Voir les informations système |
| `/cancel` | Annuler le flux de création de tâche |
| `/reset` | Réinitialiser toutes les données (avec confirmation) |

## Création de Tâches

### Tâches Simples
Pour une exécution unique sans critères de complétion :

1. Envoyez `/new`
2. Sélectionnez "Simple (sans critères de complétion, sans réessai)"
3. Entrez votre exigence
4. La tâche est immédiatement mise en file d'attente

### Tâches Complexes
Pour les tâches avec critères de complétion et réessai automatique :

1. Envoyez `/new`
2. Sélectionnez "Complexe (avec critères de complétion et réessai)"
3. Entrez votre exigence
4. Entrez les critères de complétion (ex : "Tous les tests passent")
5. Sélectionnez le niveau de priorité
6. Choisissez le nombre de réessais (10 ou personnalisé)

**Mode Plan** : Les tâches complexes exécutent automatiquement Claude en mode plan (drapeau `--plan`). Cela permet à Claude de concevoir une approche d'implémentation avant l'exécution, ce qui donne de meilleurs résultats pour les exigences complexes.

### Pièces Jointes

Vous pouvez joindre des fichiers lors de la saisie des exigences ou des critères de complétion :

1. Lorsque vous êtes invité à entrer des exigences/critères, envoyez d'abord vos fichiers (images, documents, etc.)
2. Un message de confirmation s'affichera pour chaque fichier joint
3. Ensuite, entrez vos exigences/critères sous forme de texte
4. Les fichiers joints seront transmis à Claude avec la tâche

**Remarque** : Les pièces jointes sont automatiquement supprimées lorsque la tâche est terminée, échoue ou est annulée.

## Priorité des Tâches

Les tâches sont exécutées par ordre de priorité :

| Priorité | Icône | Description |
|----------|-------|-------------|
| Urgent | 🔴 | Exécuter en premier |
| Élevé | 🟠 | Priorité élevée |
| Normal | 🟢 | Priorité par défaut |
| Faible | 🔵 | Exécuter quand inactif |

## Exécution Parallèle

Lorsqu'activée pendant la configuration, plusieurs tâches peuvent s'exécuter simultanément :

- Configurez le maximum de tâches concurrentes (1-10)
- Chaque tâche affiche son préfixe ID dans la sortie console
- `/status` affiche toutes les tâches en cours avec des boutons d'arrêt pour les annuler
- Les tâches de priorité supérieure obtiennent toujours les slots en premier

### Annuler les Tâches en Cours

Vous pouvez annuler les tâches actuellement en cours d'exécution :

1. Envoyez `/status` pour voir les tâches en cours
2. Chaque tâche en cours affiche un bouton "Arrêter"
3. Cliquez sur le bouton pour terminer immédiatement la tâche
4. La tâche annulée sera marquée comme échouée

### Sortie Console (Mode Parallèle)

```
[a1b2c3d4] Démarrage de la tâche...
[e5f6g7h8] Compilation du projet...
[a1b2c3d4] Tests réussis !
```

## Configuration

La configuration est stockée dans `.cc-telegram/config.json` :

| Paramètre | Description | Par défaut |
|-----------|-------------|------------|
| `botToken` | Token du bot Telegram (chiffré) | - |
| `chatId` | Votre chat ID Telegram (chiffré) | - |
| `debugMode` | Activer la journalisation de débogage | `false` |
| `claudeCommand` | Commande CLI Claude personnalisée | `null` (auto-détection) |
| `logRetentionDays` | Jours de conservation des fichiers de log | `7` |
| `defaultMaxRetries` | Nombre de réessais par défaut | `15` |
| `parallelExecution` | Activer l'exécution parallèle | `false` |
| `maxParallel` | Maximum de tâches concurrentes | `3` |

### Commande Claude Personnalisée

Si Claude CLI est installé dans un emplacement non standard :

```json
{
  "claudeCommand": "npx @anthropic-ai/claude-code"
}
```

## Structure des Répertoires

```
.cc-telegram/
├── config.json      # Configuration chiffrée
├── tasks.json       # Index des tâches en attente
├── completed.json   # Index des tâches terminées
├── failed.json      # Index des tâches échouées
├── tasks/           # Fichiers de tâches individuels
├── completed/       # Détails des tâches terminées
├── failed/          # Détails des tâches échouées
└── logs/            # Fichiers de log quotidiens
```

## Détection de Complétion

Claude Code signale la complétion des tâches en utilisant des marqueurs spéciaux :

- `<promise>COMPLETE</promise>` - Tâche terminée avec succès
- `<promise>FAILED</promise>` - Tâche échouée avec raison

Si aucun signal n'est détecté, le système utilise la correspondance de motifs pour déterminer le succès ou l'échec basé sur le contenu de sortie.

## Gestion des Logs

- Les fichiers de log sont créés quotidiennement : `YYYY-MM-DD.log`
- Les anciens logs sont automatiquement supprimés après `logRetentionDays`
- Les fichiers de tâches terminées/échouées sont nettoyés après 30 jours

## Sécurité

- Le token du bot et le chat ID sont chiffrés avec AES-256-GCM
- Seuls les messages de votre chat ID enregistré sont traités
- Toutes les données sont stockées localement dans votre répertoire de projet

## Dépannage

### Le bot ne répond pas
- Assurez-vous que le bot est en cours d'exécution (`npx cc-telegram`)
- Vérifiez si votre chat ID correspond à celui configuré
- Vérifiez la connexion internet

### Claude Code non trouvé
- Assurez-vous que Claude CLI est installé : `npm install -g @anthropic-ai/claude-code`
- Ou définissez une commande personnalisée dans config : `"claudeCommand": "npx @anthropic-ai/claude-code"`

### Tâches bloquées en cours
- Au redémarrage, les tâches orphelines sont automatiquement réinitialisées à l'état "ready"
- Utilisez `/reset` pour effacer toutes les données si nécessaire

## Licence

MIT
