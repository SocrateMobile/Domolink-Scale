"""Sensors for Domolink-Scale."""

import logging
from typing import Any, Dict, List, Optional

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    PERCENTAGE,
    UnitOfMass,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, NAME, VERSION
from .coordinator import DomolinkScaleCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Domolink-Scale sensors based on a config entry."""
    data = hass.data[DOMAIN][entry.entry_id]
    coordinator: DomolinkScaleCoordinator = data["coordinator"]

    registered_users = set()

    # Always add the Tare sensor for the scale hub
    tare_sensor = DomolinkScaleTareSensor(coordinator, entry)
    async_add_entities([tare_sensor])

    @callback
    def _update_entities() -> None:
        """Dynamically add sensors when new profiles are added or auto-created."""
        new_entities: List[SensorEntity] = []
        for user_id in list(coordinator.profiles.keys()):
            if user_id not in registered_users:
                registered_users.add(user_id)
                new_entities.extend([
                    DomolinkScaleWeightSensor(coordinator, entry, user_id),
                    DomolinkScaleTrendSensor(coordinator, entry, user_id),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "bmi", "IMC", None, None),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "target_weight", "Poids Cible", UnitOfMass.KILOGRAMS, SensorDeviceClass.WEIGHT),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "target_delta", "Écart Cible", UnitOfMass.KILOGRAMS, SensorDeviceClass.WEIGHT),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "fat_percentage", "Masse Grasse", PERCENTAGE, None),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "muscle_mass", "Masse Musculaire", UnitOfMass.KILOGRAMS, SensorDeviceClass.WEIGHT),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "water_percentage", "Eau Corporelle", PERCENTAGE, None),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "bone_mass", "Masse Osseuse", UnitOfMass.KILOGRAMS, SensorDeviceClass.WEIGHT),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "visceral_fat", "Graisse Viscérale", None, None),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "bmr", "Métabolisme de Base", "kcal", None),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "metabolic_age", "Âge Métabolique", "ans", None),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "body_score", "Score Corporel", "/100", None),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "daily_steps_goal", "Pas Conseillés Jour", "pas", None, "mdi:walk"),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "walking_duration_hours", "Durée Marche Conseillée", "h", None, "mdi:timer-sand"),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "walking_distance_km", "Distance Marche Conseillée", "km", None, "mdi:map-marker-distance"),
                    DomolinkScaleMetricSensor(coordinator, entry, user_id, "walking_calories_kcal", "Calories Marche Estimées", "kcal", None, "mdi:fire"),
                ])
        if new_entities:
            async_add_entities(new_entities)

    _update_entities()
    entry.async_on_unload(coordinator.async_add_listener(_update_entities))


class DomolinkScaleBaseSensor(CoordinatorEntity, SensorEntity):
    """Base sensor for Domolink-Scale with clean entity naming."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: DomolinkScaleCoordinator,
        entry: ConfigEntry,
        user_id: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self.entry = entry
        self.user_id = user_id

    @property
    def profile(self) -> Dict[str, Any]:
        """Return the user profile dict."""
        return self.coordinator.profiles.get(self.user_id, {})

    @property
    def user_name(self) -> str:
        """Return the user name."""
        return self.profile.get("name", self.user_id)

    @property
    def device_info(self) -> DeviceInfo:
        """Link sensor to user profile device."""
        cat = self.profile.get("category", "adult")
        cat_label = {
            "child": "Enfant",
            "cat": "Chat",
            "dog": "Chien",
            "luggage": "Bagage",
        }.get(cat, "Membre du foyer")

        return DeviceInfo(
            identifiers={(DOMAIN, f"{self.entry.entry_id}_{self.user_id}")},
            name=f"Domolink Scale - {self.user_name}",
            manufacturer="DomoLink",
            model=f"Profil {cat_label}",
            sw_version=VERSION,
        )


class DomolinkScaleWeightSensor(DomolinkScaleBaseSensor):
    """Primary weight sensor for a user."""

    _attr_device_class = SensorDeviceClass.WEIGHT
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfMass.KILOGRAMS
    _attr_icon = "mdi:scale-bathroom"
    _attr_name = "Poids"

    def __init__(
        self,
        coordinator: DomolinkScaleCoordinator,
        entry: ConfigEntry,
        user_id: str,
    ) -> None:
        """Initialize the weight sensor."""
        super().__init__(coordinator, entry, user_id)
        self._attr_unique_id = f"{entry.entry_id}_{user_id}_weight"

    @property
    def native_value(self) -> Optional[float]:
        """Return latest weight."""
        metrics = self.profile.get("latest_metrics", {})
        if "weight" in metrics:
            return metrics["weight"]
        return self.profile.get("reference_weight")

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return comprehensive attributes for dashboard cards."""
        metrics = self.profile.get("latest_metrics", {})
        return {
            "user_id": self.user_id,
            "user_name": self.user_name,
            "category": self.profile.get("category", "adult"),
            "target_weight": self.profile.get("target_weight"),
            "target_delta": metrics.get("target_delta"),
            "trend_7d": self.profile.get("trend_7d"),
            "bmi": metrics.get("bmi"),
            "bmi_label": metrics.get("bmi_label"),
            "ideal_weight": metrics.get("ideal_weight"),
            "fat_percentage": metrics.get("fat_percentage"),
            "fat_mass": metrics.get("fat_mass"),
            "muscle_mass": metrics.get("muscle_mass"),
            "water_percentage": metrics.get("water_percentage"),
            "bone_mass": metrics.get("bone_mass"),
            "visceral_fat": metrics.get("visceral_fat"),
            "bmr": metrics.get("bmr"),
            "metabolic_age": metrics.get("metabolic_age"),
            "body_score": metrics.get("body_score"),
            "body_type": metrics.get("body_type"),
            "impedance": metrics.get("impedance"),
            "last_weigh_in": self.profile.get("last_weigh_in"),
            "curve_color": self.profile.get("color"),
        }


class DomolinkScaleTrendSensor(DomolinkScaleBaseSensor):
    """7-Day moving average trend sensor."""

    _attr_device_class = SensorDeviceClass.WEIGHT
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfMass.KILOGRAMS
    _attr_icon = "mdi:chart-line"
    _attr_name = "Tendance 7 jours"

    def __init__(
        self,
        coordinator: DomolinkScaleCoordinator,
        entry: ConfigEntry,
        user_id: str,
    ) -> None:
        """Initialize trend sensor."""
        super().__init__(coordinator, entry, user_id)
        self._attr_unique_id = f"{entry.entry_id}_{user_id}_trend_7d"

    @property
    def native_value(self) -> Optional[float]:
        """Return 7-day smoothed weight."""
        return self.profile.get("trend_7d")


class DomolinkScaleMetricSensor(DomolinkScaleBaseSensor):
    """Specific metric sensor for a user."""

    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(
        self,
        coordinator: DomolinkScaleCoordinator,
        entry: ConfigEntry,
        user_id: str,
        metric_key: str,
        label: str,
        unit: Optional[str],
        device_class: Optional[SensorDeviceClass],
        icon: Optional[str] = None,
    ) -> None:
        """Initialize metric sensor."""
        super().__init__(coordinator, entry, user_id)
        self.metric_key = metric_key
        self._attr_unique_id = f"{entry.entry_id}_{user_id}_{metric_key}"
        self._attr_name = label
        self._attr_native_unit_of_measurement = unit
        if icon:
            self._attr_icon = icon
        if device_class:
            self._attr_device_class = device_class

    @property
    def native_value(self) -> Any:
        """Return the metric value."""
        if self.metric_key == "target_weight":
            return self.profile.get("target_weight")
        metrics = self.profile.get("latest_metrics", {})
        return metrics.get(self.metric_key)


class DomolinkScaleTareSensor(CoordinatorEntity, SensorEntity):
    """Global Tare / Baby / Pet / Luggage sensor."""

    _attr_has_entity_name = True
    _attr_device_class = SensorDeviceClass.WEIGHT
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfMass.KILOGRAMS
    _attr_icon = "mdi:baby-face-outline"
    _attr_name = "Dernière Tare (Bébé / Animal / Bagage)"

    def __init__(
        self,
        coordinator: DomolinkScaleCoordinator,
        entry: ConfigEntry,
    ) -> None:
        """Initialize tare sensor."""
        super().__init__(coordinator)
        self.entry = entry
        self._attr_unique_id = f"{entry.entry_id}_scale_tare"

    @property
    def device_info(self) -> DeviceInfo:
        """Link to main scale hub device."""
        return DeviceInfo(
            identifiers={(DOMAIN, f"{self.entry.entry_id}_hub")},
            name="Domolink Scale - Hub",
            manufacturer="DomoLink",
            model="Balance Connectée Universelle",
            sw_version=VERSION,
        )

    @property
    def native_value(self) -> Optional[float]:
        """Return last tare weight."""
        if self.coordinator.last_tare:
            return self.coordinator.last_tare.get("tare_weight")
        return None

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return tare details."""
        if not self.coordinator.last_tare:
            return {}
        return {
            "total_weight": self.coordinator.last_tare.get("total_weight"),
            "base_weight": self.coordinator.last_tare.get("base_weight"),
            "base_user_name": self.coordinator.last_tare.get("base_user_name"),
            "timestamp": self.coordinator.last_tare.get("timestamp"),
        }
