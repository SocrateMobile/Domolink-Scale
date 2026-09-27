# Domolink-Scale ⚖️

Composant Home Assistant et panneau tactile universel dédié au suivi du poids, de la composition corporelle BIA et de l'activité physique quotidienne multi-marques.

Fait partie de la suite **DomoLink**.

![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ Fonctionnalités Principales

- 🌐 **Compatibilité Universelle Multi-Marques** : Fonctionne avec n'importe quelle balance connectée dont les données remontent dans Home Assistant (Bluetooth BLE direct, Wi-Fi, Zigbee, MQTT, ou Cloud constructeur).
- 🧬 **Attribution Biométrique Croisée (Poids + Impédance $\Omega$)** : Lève toute ambiguïté lorsque deux membres de la famille ont un poids proche (à 1 ou 2 kg d'écart) en comparant leur signature de résistance bioélectrique.
- ⚡ **Création Automatique de Profils ($> 5\text{ kg}$)** : Si une pesée s'écarte de plus de $5\text{ kg}$ de tous les profils connus, un profil (ex: `Utilisateur 3` ou `Enfant 2`) est créé automatiquement avec initialisation immédiate de ses capteurs.
- 🔀 **Fusion de Profils en 1 Clic** : Fusionnez facilement un profil temporaire avec un profil existant depuis le panneau tactile pour regrouper l'historique et recalculer les métriques santé.
- 👶🐱🐶 **Profils Dédiés (Adultes, Enfants, Animaux & Bagages)** : Seuil minimal abaissé à **2.0 kg**, avec affichage adapté et icônes spécifiques (`👤 Adulte`, `👶 Enfant`, `🐱 Chat`, `🐶 Chien`, `🧳 Bagage`).
- ⚖️ **Mode Tare Automatique (Bébé / Chat / Valise dans les bras)** : Détection intelligente du surplus lorsque vous vous repesez avec votre enfant ou animal dans les bras. Le poids de tare est isolé sur un capteur dédié sans fausser votre propre courbe de poids !
- 🚶‍♂️ **Moteur d'Activité & Marche Quotidienne Conseillée** : Calcul scientifique personnalisé du nombre de pas par jour, de la durée de marche conseillée (heures & minutes), de la distance (km) et des calories dépensées selon les recommandations de l'OMS et votre morphologie.
- 📈 **Tendance Pondérale sur 7 Jours** : Moyenne mobile lissée pour éliminer le bruit des fluctuations d'eau quotidiennes.
- 📊 **Panneau Tactile Dédié dans la barre latérale gauche (Sidebar)** :
  - Graphique multi-courbes vectoriel SVG ultra-fluide avec filtres temporels (7j, 30j, 3m, 1a, Tout).
  - Lignes d'objectifs cibles en pointillés avec couleurs personnalisées par utilisateur.
  - Cartes de composition corporelle de la dernière pesée (IMC, Masse grasse, Masse musculaire, Eau, Graisse viscérale, BMR, Âge métabolique, Score corporel).
  - Historique complet avec réassignation de pesées et suppression.
  - Onglet Paramètres avec sélecteur de couleur hexadécimal natif (`type="color"`).
- 🎆 **Easter Egg "Socrate Rules"** : Cliquez 3 fois rapidement sur le logo ou le titre dans le bandeau supérieur pour lancer l'expérience visuelle synthwave interactive !

---

## 🔍 Balances Connectées Compatibles

Domolink-Scale est universelle et s'interface avec n'importe quel capteur de poids dans Home Assistant :

| Famille / Marque | Modèles Populaires | Liaison Home Assistant | Métriques Prises en Charge |
| :--- | :--- | :--- | :--- |
| **Xiaomi / Amazfit** | Mi Body Composition Scale 2 (`XMTZC02HM`, `XMTZC05HM`), Mi Smart Scale 1, Scale S400, Amazfit Smart Scale | `Xiaomi Miot Auto`, `Xiaomi BLE`, `ESPHome BLE`, `BTHome` | Poids stabilisé, non-stabilisé, impédance brute $\Omega$, batterie |
| **Withings** | Withings Body, Body+, Body Smart, Body Cardio, Body Scan | Intégration officielle `Withings` (Wi-Fi) | Poids, masse grasse %, muscle, eau, rythme cardiaque, onde de pouls |
| **Garmin** | Garmin Index Smart Scale, Garmin Index S2 | Intégration `Garmin Connect` (Wi-Fi) | Poids, masse grasse, eau, muscle squelettique, os |
| **Eufy (Anker)** | Smart Scale C1, P1, P2, P2 Pro | `BLE Monitor`, `ESPHome` ou Wi-Fi | Poids, impédance, fréquence cardiaque |
| **Tuya / Smart Life** | Sinocare, InnoBeta, Silvercrest, marques blanches | Intégration `Tuya` ou `LocalTuya` | Poids, impédance, batterie |
| **Beurer / Sanitas** | Beurer BF 700 / 720 / 800, Sanitas SBF 70 / 72 | `BLE Monitor`, `ESPHome` (Bluetooth) | Poids, impédance brute |
| **Renpho / Yunmai** | Renpho Smart Scale Bluetooth/Wi-Fi, Yunmai Color | `OpenScale` (MQTT) ou `BLE Monitor` | Poids, impédance, graisse native |
| **DIY / Open Hardware** | OpenScale (Android Bluetooth vers MQTT), ESPHome HX711 | MQTT ou ESPHome natif | Poids, impédance brute |

---

## 🚀 Installation & Configuration

1. Copiez le dossier `custom_components/domolink_scale` dans le répertoire `custom_components` de votre Home Assistant.
2. Redémarrez Home Assistant.
3. Allez dans **Paramètres > Appareils et services > Ajouter une intégration**, puis sélectionnez **Domolink-Scale**.
4. Associez vos capteurs :
   - **Capteur de poids stabilisé** *(ex: `sensor.mi_body_composition_scale_cb4c_mass`)*
   - **Capteur non-stabilisé** *(optionnel, ex: `sensor.mi_body_composition_scale_cb4c_mass_non_stabilized`)*
   - **Capteur d'impédance** *(optionnel, ex: `sensor.mi_body_composition_scale_cb4c_impedance`)*
   - **Capteurs avancés** *(optionnels : fréquence cardiaque, batterie...)*
5. Accédez à votre panneau **Domolink Scale** dans le menu de gauche de Home Assistant !

---

## 🚶‍♂️ Formules de Calcul de l'Activité & Marche

L'algorithme détermine l'effort quotidien adapté en croisant la biomécanique et les objectifs de santé :
1. **Longueur de pas individualisée** : $\text{Longueur (cm)} = \text{Taille (cm)} \times 0.415$.
2. **Objectif de Pas** :
   - Base de maintien (OMS) : **8 000 pas / jour**.
   - Si objectif de perte de poids ($\Delta W > 0$) : $+350\text{ pas}$ par kg à perdre (pour un déficit d'environ $350\text{ à }450\text{ kcal/jour}$).
3. **Durée de marche conseillée** : Basée sur une allure modérée normale de $4.8\text{ km/h}$.
4. **Dépense calorique estimée** : Environ $0.75\text{ kcal}$ par kg de poids corporel par kilomètre parcouru.

---

## 📊 Entités Générées par Utilisateur

Pour chaque membre du foyer, Domolink-Scale génère automatiquement les capteurs suivants :
- `sensor.domolink_scale_<user>_poids` (Poids actuel en kg)
- `sensor.domolink_scale_<user>_tendance_7_jours` (Moyenne mobile lissée sur 7 jours)
- `sensor.domolink_scale_<user>_poids_cible` (Objectif de poids en kg)
- `sensor.domolink_scale_<user>_ecart_cible` (Différence $\pm kg$ avec la cible)
- `sensor.domolink_scale_<user>_pas_conseilles_jour` (Objectif quotidien de pas)
- `sensor.domolink_scale_<user>_duree_marche_conseillee` (Temps de marche conseillé en heures/minutes)
- `sensor.domolink_scale_<user>_distance_marche_conseillee` (Distance équivalente en km)
- `sensor.domolink_scale_<user>_calories_marche_estimees` (Énergie brûlée en kcal)
- `sensor.domolink_scale_<user>_imc` (Indice de Masse Corporelle)
- `sensor.domolink_scale_<user>_masse_grasse` (Taux de masse grasse %)
- `sensor.domolink_scale_<user>_masse_musculaire` (Masse musculaire en kg)
- `sensor.domolink_scale_<user>_eau_corporelle` (Hydratation en %)
- `sensor.domolink_scale_<user>_masse_osseuse` (Masse osseuse en kg)
- `sensor.domolink_scale_<user>_graisse_viscerale` (Score de graisse viscérale 1-50)
- `sensor.domolink_scale_<user>_metabolisme_de_base` (BMR en kcal/jour)
- `sensor.domolink_scale_<user>_age_metabolique` (Âge métabolique estimé)
- `sensor.domolink_scale_<user>_score_corporel` (Score global de santé sur 100)

Et pour le Hub de la balance :
- `sensor.domolink_scale_hub_derniere_tare_bebe_animal_bagage` (Poids de la dernière pesée avec tare en kg)

---

## 🛠️ Services Home Assistant

- `domolink_scale.add_profile` : Ajoute un profil utilisateur, enfant ou animal.
- `domolink_scale.update_profile` : Met à jour les paramètres d'un profil.
- `domolink_scale.merge_profiles` : Fusionne un profil temporaire dans un autre profil.
- `domolink_scale.delete_profile` : Supprime un profil existant.
- `domolink_scale.add_weigh_in` : Enregistre manuellement une pesée.
- `domolink_scale.reassign_weigh_in` : Réassigne une pesée historique à un autre utilisateur.

---

## 📄 Licence

MIT License © 2026 DomoLink
