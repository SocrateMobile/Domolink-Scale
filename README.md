# Domolink-Scale ⚖️

Composant Home Assistant et panneau tactile dédié au suivi du poids et de la composition corporelle multi-marques.

Fait partie de la suite **DomoLink**.

---

## ✨ Fonctionnalités Principales

- 🌐 **Compatibilité Multi-Marques Universelle** : Xiaomi, Withings, Garmin, Eufy, Renpho, Tuya, Beurer, ESPHome / OpenScale, etc.
- 👥 **Gestion Multi-Utilisateurs & Profils** : Attribution automatique des pesées selon une fenêtre de tolérance ($\pm kg$) autour du dernier poids connu.
- 🧬 **Moteur d'Analyse Corporelle BIA Intégré** : Calcul scientifique certifié de 13 métriques corporelles (IMC, Masse grasse, Masse musculaire, Eau, Graisse viscérale, Masse osseuse, BMR, Âge métabolique, Score corporel).
- 📈 **Panneau Tactile Dédié dans la barre latérale gauche (Sidebar)** :
  - **Graphique multi-courbes SVG interactif** : Affichage simultané de plusieurs utilisateurs avec **couleur personnalisée par profil** et ligne en pointillés pour le poids cible.
  - **Filtres temporels** : 7 jours, 30 jours, 3 mois, 1 an, Tout.
  - **Jauges et cartes de santé** avec codes couleur contextuels.
  - **Gestionnaire d'historique** avec réassignation et suppression de pesées.
  - **Onglet Paramètres** avec sélecteur de couleur hexadécimal natif pour chaque profil.
- ⚡ **Capteurs Home Assistant générés automatiquement** pour chaque utilisateur (`sensor.domolink_scale_<user>_weight`, `_bmi`, `_body_fat`, etc.).

---

## 🚀 Installation & Configuration

1. Déposez le dossier `custom_components/domolink_scale` dans le répertoire `custom_components` de votre Home Assistant.
2. Redémarrez Home Assistant.
3. Rendez-vous dans **Paramètres > Appareils et services > Ajouter une intégration**, puis recherchez **Domolink-Scale**.
4. Sélectionnez le capteur de poids stabilisé de votre balance (ex: `sensor.mi_body_composition_scale_cb4c_mass`), le capteur non-stabilisé et l'impédance si disponible.
5. Retrouvez votre nouveau panneau **Domolink Scale** dans le menu de gauche !

---

## 📄 Licence

MIT License © 2026 DomoLink
