<?php

namespace App\Console\Commands;

use App\Models\Event;
use App\Services\ElasticsearchService;
use Illuminate\Console\Command;

class EsReindexCommand extends Command
{
    protected $signature = 'icon:es-reindex {--limit=0 : Max events to index (0 = all)}';
    protected $description = 'Index existing PostgreSQL events into Elasticsearch with generated prompt/response content';

    private array $promptTemplates = [
        'chatgpt' => [
            "Peux-tu m'aider à rédiger un cahier des charges pour le projet %s ?",
            "Génère un email professionnel pour informer l'équipe du changement de planning.",
            "Explique-moi comment fonctionne l'algorithme de tri rapide en Python.",
            "Traduis ce texte en anglais : « Le rapport financier du T3 montre une croissance de 15%% »",
            "Rédige un résumé de la réunion du comité de direction du %s.",
            "Analyse les données de vente suivantes et propose des recommandations : CA T1 = 2.3M€, T2 = 1.8M€",
            "Comment configurer un VPN site-to-site entre nos bureaux d'Abidjan et de Paris ?",
            "Écris un script PowerShell pour automatiser la sauvegarde des dossiers partagés.",
            "Quelles sont les meilleures pratiques de sécurité pour une API REST ?",
            "Crée un tableau comparatif des offres cloud : AWS vs Azure vs GCP pour notre infrastructure.",
        ],
        'claude' => [
            "Aide-moi à analyser ce contrat de sous-traitance et identifie les clauses problématiques.",
            "Rédige une politique de confidentialité conforme au RGPD pour notre application mobile.",
            "Explique les différences entre les architectures microservices et monolithique.",
            "Propose un plan de migration de notre base Oracle vers PostgreSQL.",
            "Génère un rapport d'audit de sécurité pour notre infrastructure réseau.",
            "Comment implémenter l'authentification OAuth2 avec Laravel ?",
            "Analyse ce code et identifie les vulnérabilités potentielles.",
            "Rédige les spécifications techniques pour le module de facturation.",
            "Propose une stratégie de monitoring pour nos 200 serveurs de production.",
            "Écris les tests unitaires pour cette classe de gestion des utilisateurs.",
        ],
        'copilot' => [
            "// Implémente une fonction de validation d'IBAN\nfunction validateIBAN(iban: string): boolean {",
            "# Script de déploiement automatisé pour les serveurs de production\nimport paramiko",
            "/// Gestionnaire de connexions à la base de données avec pool\npub struct DbPool {",
            "// Composant React pour le tableau de bord des ventes\nconst SalesDashboard = () => {",
            "# Requête SQL pour le rapport mensuel des performances\nSELECT department, SUM(revenue)",
            "// API endpoint pour la gestion des factures\n[HttpPost(\"api/invoices\")]",
            "# Ansible playbook pour le provisioning des serveurs\n- hosts: production",
            "// Middleware d'authentification JWT\nconst authMiddleware = (req, res, next) => {",
            "# Dockerfile multi-stage pour l'application Node.js\nFROM node:20-alpine AS builder",
            "// Hook personnalisé pour la gestion du panier\nconst useCart = () => {",
        ],
        'gemini' => [
            "Analyse cette image de notre architecture réseau et propose des améliorations.",
            "Compare les frameworks JavaScript modernes pour notre prochain projet web.",
            "Rédige un business plan pour notre expansion en Afrique de l'Ouest.",
            "Quels sont les risques juridiques liés à l'utilisation de l'IA en entreprise ?",
            "Propose un plan de formation sur la cybersécurité pour nos employés.",
            "Génère un diagramme de séquence UML pour le processus de commande.",
            "Analyse les tendances du marché des télécommunications en Côte d'Ivoire.",
            "Comment optimiser les performances de notre base de données PostgreSQL ?",
            "Rédige un document d'architecture pour notre système de monitoring.",
            "Propose des KPI pour mesurer l'efficacité de notre service client.",
        ],
        'mistral' => [
            "Génère un template de rapport mensuel pour le département finance.",
            "Explique le fonctionnement du protocole OAuth 2.0 avec PKCE.",
            "Propose une architecture de microservices pour notre plateforme e-commerce.",
            "Rédige une note de service sur la nouvelle politique de télétravail.",
            "Comment mettre en place un pipeline CI/CD avec GitLab ?",
            "Analyse les logs serveur suivants et identifie les anomalies.",
            "Crée un modèle de données pour un système de gestion des tickets.",
            "Quelles sont les étapes pour obtenir la certification ISO 27001 ?",
            "Propose un plan de reprise d'activité (PRA) pour notre infrastructure IT.",
            "Rédige les procédures de backup et de restauration pour nos serveurs.",
        ],
    ];

    private array $responseTemplates = [
        "Voici une analyse détaillée de votre demande. Tout d'abord, il est important de considérer les aspects suivants :\n\n1. **Contexte** : Votre situation nécessite une approche structurée.\n2. **Recommandations** : Je suggère de procéder par étapes.\n3. **Mise en œuvre** : Commencez par un audit de l'existant.",
        "D'après mon analyse, voici les points clés à retenir :\n\n- Le processus actuel présente des opportunités d'optimisation\n- La migration devrait être planifiée sur 3 phases\n- Budget estimé : entre 50K€ et 80K€\n- Délai recommandé : 4-6 mois",
        "Voici le code demandé :\n\n```python\ndef process_data(input_data):\n    results = []\n    for item in input_data:\n        if validate(item):\n            results.append(transform(item))\n    return results\n```\n\nCe code gère la validation et la transformation des données.",
        "Excellente question ! Voici les meilleures pratiques recommandées :\n\n1. Utilisez le chiffrement TLS 1.3 pour toutes les communications\n2. Implémentez l'authentification multi-facteurs (MFA)\n3. Effectuez des audits de sécurité réguliers\n4. Mettez en place un WAF (Web Application Firewall)\n5. Formez régulièrement vos équipes à la cybersécurité",
        "Après avoir analysé les données fournies, voici mon rapport :\n\n**Synthèse** : Les indicateurs montrent une tendance positive avec une croissance de 12% sur le trimestre.\n\n**Points d'attention** :\n- Le taux de rétention client a baissé de 3%\n- Les coûts opérationnels ont augmenté de 8%\n\n**Actions recommandées** :\n- Lancer un programme de fidélisation\n- Optimiser les processus internes",
    ];

    public function handle(ElasticsearchService $elasticsearch): int
    {
        $limit = (int) $this->option('limit');

        $query = Event::with('machine:id,hostname,assigned_user,department')
            ->orderBy('occurred_at', 'desc');

        if ($limit > 0) {
            $query->limit($limit);
        }

        $total = $limit > 0 ? $limit : Event::count();
        $this->info("Indexing {$total} events into Elasticsearch...");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $indexed = 0;
        $failed = 0;

        $query->chunk(100, function ($events) use ($elasticsearch, &$indexed, &$failed, $bar) {
            foreach ($events as $event) {
                $prompt = $this->generatePrompt($event);
                $response = $this->generateResponse($event);

                $esId = $elasticsearch->indexExchange([
                    'event_id' => $event->id,
                    'machine_id' => $event->machine_id,
                    'platform' => $event->platform,
                    'domain' => $event->domain,
                    'event_type' => $event->event_type,
                    'prompt' => $prompt,
                    'response' => $response,
                    'content_hash' => md5($prompt),
                    'content_length' => strlen($prompt),
                    'matched_rules' => $event->rule_id ? [$event->rule_id] : [],
                    'severity' => $event->severity ?? 'info',
                    'assigned_user' => $event->machine?->assigned_user,
                    'department' => $event->machine?->department,
                    'occurred_at' => $event->occurred_at->toISOString(),
                ]);

                if ($esId) {
                    // Update the event with the ES ID
                    $event->update(['elasticsearch_id' => $esId]);
                    $indexed++;
                } else {
                    $failed++;
                }

                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);

        $this->info("Indexed: {$indexed} | Failed: {$failed}");

        return $failed > 0 ? 1 : 0;
    }

    private function generatePrompt(Event $event): string
    {
        $platform = $event->platform ?? 'chatgpt';
        $templates = $this->promptTemplates[$platform] ?? $this->promptTemplates['chatgpt'];
        $template = $templates[array_rand($templates)];

        $date = $event->occurred_at?->format('d/m/Y') ?? now()->format('d/m/Y');
        $projects = ['Atlas', 'Horizon', 'Phoenix', 'Nexus', 'Titan', 'Aurora'];
        $project = $projects[array_rand($projects)];

        return sprintf($template, $project, $date);
    }

    private function generateResponse(Event $event): ?string
    {
        // Block events don't have responses
        if (in_array($event->event_type, ['block', 'clipboard_block', 'clipboard_alert'])) {
            return null;
        }

        // Prompts might not have responses yet
        if ($event->event_type === 'prompt') {
            return null;
        }

        return $this->responseTemplates[array_rand($this->responseTemplates)];
    }
}
