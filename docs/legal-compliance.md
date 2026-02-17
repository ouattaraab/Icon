# Icon — Conformité Juridique et Réglementaire

## 1. Cadre juridique applicable

### Côte d'Ivoire
- **Loi n° 2013-450** relative à la protection des données à caractère personnel
- **ARTCI** (Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire) — Autorité de protection des données
- **Code du travail** ivoirien (Loi n° 2015-532) — Droits des salariés

### Principes RGPD (bonnes pratiques internationales)
Bien que le RGPD ne s'applique pas directement en Côte d'Ivoire, GS2E adopte ses principes comme standard de référence pour la protection des données.

---

## 2. Base légale du traitement

Le déploiement d'Icon repose sur **l'intérêt légitime de l'employeur** à protéger :
- Le patrimoine informationnel de l'entreprise
- Les secrets commerciaux et données clients
- La conformité aux obligations contractuelles de confidentialité

### Conditions de légitimité

1. **Information préalable des salariés** (obligatoire)
   - Note de service décrivant le dispositif
   - Mise à jour du règlement intérieur
   - Avenant au contrat de travail si nécessaire

2. **Proportionnalité** du dispositif
   - Seul le trafic vers les plateformes IA identifiées est intercepté
   - Les communications personnelles ne sont pas surveillées
   - Les contenus ne sont conservés que pour la durée nécessaire

3. **Consultation des représentants du personnel** (si applicable)
   - Information du comité d'entreprise ou des délégués du personnel

---

## 3. Données collectées

### Données traitées par Icon

| Donnée | Finalité | Durée de conservation |
|--------|----------|----------------------|
| Hostname / IP de la machine | Identification du poste | Durée d'utilisation de l'outil |
| Prompts envoyés aux IA | Détection de fuites de données | 90 jours (configurable) |
| Réponses reçues des IA | Contexte d'analyse | 90 jours (configurable) |
| Contenu presse-papier (hash + extrait) | Détection DLP | 90 jours |
| Domaines IA accédés | Statistiques d'usage | 90 jours |
| Alertes de sécurité | Suivi des incidents | 180 jours |
| Identifiant machine | Liaison machine-événement | Durée de vie de l'agent |

### Données NON collectées

- Historique de navigation général (hors domaines IA)
- Emails et messagerie
- Fichiers personnels
- Frappes clavier (keylogging)
- Captures d'écran
- Géolocalisation
- Communications vocales

---

## 4. Mesures de sécurité

### Chiffrement
- **En transit** : TLS 1.3 avec certificate pinning
- **Au repos (agent)** : SQLCipher (AES-256-CBC) pour la base locale
- **Au repos (serveur)** : Chiffrement applicatif des contenus sensibles dans Elasticsearch
- **Authentification** : HMAC-SHA256 par requête, API keys uniques

### Contrôle d'accès
- Accès dashboard limité aux administrateurs autorisés
- Rôles : admin, manager (lecture), viewer (lecture restreinte)
- Journal d'audit de toutes les actions administrateur

### Intégrité
- Vérification d'intégrité des binaires (SHA-256)
- Watchdog anti-tampering
- Signature des packages d'installation (Authenticode / codesign)

---

## 5. Droits des salariés

### Information
Chaque salarié doit être informé :
- De l'existence du dispositif de surveillance
- Des données collectées et de leur finalité
- De la durée de conservation
- De leurs droits d'accès et de rectification
- Du responsable du traitement (DPO / DSI)

### Modèle de note d'information

> **Objet : Mise en place d'un dispositif de contrôle de l'usage des plateformes d'intelligence artificielle**
>
> Dans le cadre de la protection du patrimoine informationnel de GS2E et conformément à la politique de sécurité informatique, un agent logiciel sera installé sur les postes de travail professionnels.
>
> Cet agent surveille exclusivement les échanges avec les plateformes d'intelligence artificielle publiques (ChatGPT, Claude, Copilot, Gemini, etc.) afin de prévenir le partage involontaire de données confidentielles de l'entreprise.
>
> **Données traitées :** contenu des échanges avec les plateformes IA, domaines accédés, alertes de sécurité.
>
> **Données NON traitées :** navigation personnelle, emails, messagerie, fichiers personnels.
>
> **Durée de conservation :** 90 jours pour les échanges, 180 jours pour les alertes.
>
> **Vos droits :** Vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour toute demande, contactez [dpo@gs2e.ci].
>
> **Responsable du traitement :** Direction des Systèmes d'Information — GS2E

---

## 6. Déclarations et formalités

### Auprès de l'ARTCI
- Déclaration du traitement de données personnelles
- Description des finalités, données traitées, durées de conservation
- Identification du responsable du traitement et du DPO

### Documentation interne
- [ ] Registre des traitements mis à jour
- [ ] Analyse d'impact relative à la protection des données (AIPD/DPIA)
- [ ] Politique de sécurité informatique mise à jour
- [ ] Règlement intérieur mis à jour
- [ ] Note d'information aux salariés diffusée
- [ ] PV de consultation des représentants du personnel (si applicable)
- [ ] Contrat de sous-traitance (si hébergement externe)

---

## 7. Recommandations de déploiement

1. **Avant le déploiement :**
   - Valider le dispositif avec le service juridique
   - Effectuer la déclaration ARTCI
   - Diffuser la note d'information aux salariés
   - Mettre à jour le règlement intérieur

2. **Pendant le pilote :**
   - Commencer en mode `log` uniquement (pas de blocage)
   - Collecter les retours des utilisateurs pilotes
   - Ajuster les règles pour minimiser les faux positifs

3. **En production :**
   - Activer le blocage progressivement
   - Mettre en place une procédure de recours pour les salariés
   - Auditer régulièrement les accès au dashboard
   - Purger les données au-delà de la durée de conservation

---

## 8. Contacts

| Rôle | Contact |
|------|---------|
| Responsable du traitement | DSI — GS2E |
| Délégué à la protection des données | dpo@gs2e.ci |
| Support technique Icon | dev@gs2e.ci |
