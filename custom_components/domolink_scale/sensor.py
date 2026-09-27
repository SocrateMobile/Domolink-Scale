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

    @callback
    def _update_entities() -> None:
        """Dynamically add sensors when profiles are added."""
        new_entities: List[SensorEntity] = []
        for user_id, profile in coordinator.profiles.items():
            if user_id not in registered_users:
                registered_users.add(user_id)
                new_entities.extend([
                    DomolinkScaleWeightSensor(coordinator, entry, user_id),
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
                ])
        if new_entities:
            async_add_entities(new_entities)

    _update_entities()
    entry.async_on_unload(coordinator.async_add_listener(_update_entities))


class DomolinkScaleBaseSensor(CoordinatorEntity, SensorEntity):
    """Base sensor for Domolink-Scale."""

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
        return DeviceInfo(
            identifiers={(DOMAIN, f"{self.entry.entry_id}_{self.user_id}")},
            name=f"Domolink Scale - {self.user_name}",
            manufacturer="DomoLink",
            model="Balance Connectée Universelle",
            sw_version=VERSION,
        )


class DomolinkScaleWeightSensor(DomolinkScaleBaseSensor):
    """Primary weight sensor for a user."""

    _attr_device_class = SensorDeviceClass.WEIGHT
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfMass.KILOGRAMS
    _attr_icon = "mdi:scale-bathroom"

    def __init__(
        self,
        coordinator: DomolinkScaleCoordinator,
        entry: ConfigEntry,
        user_id: str,
    ) -> None:
        """Initialize the weight sensor."""
        super().__init__(coordinator, entry, user_id)
        self._attr_unique_id = f"{entry.entry_id}_{user_id}_weight"
        self._attr_name = f"{self.user_name} Poids"

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
            "target_weight": self.profile.get("target_weight"),
            "target_delta": metrics.get("target_delta"),
            "bmi": metrics.get("bmi"),
            "bmi_label": metrics.get("bmi_label"),
            "ideal_weight": metrics.get("ideal_weight"),
            "fat_percentage": metrics.get("fat_percentage"),
            "fat_mass": metrics.get("fat_mass"),
            "fat_label": metrics.get("fat_label"),
            "muscle_mass": metrics.get("muscle_mass"),
            "muscle_percentage": metrics.get("muscle_percentage"),
            "water_percentage": metrics.get("water_percentage"),
            "bone_mass": metrics.get("bone_mass"),
            "visceral_fat": metrics.get("visceral_fat"),
            "visceral_label": metrics.get("visceral_label"),
            "bmr": metrics.get("bmr"),
            "metabolic_age": metrics.get("metabolic_age"),
            "protein_percentage": metrics.get("protein_percentage"),
            "body_score": metrics.get("body_score"),
            "body_type": metrics.get("body_type"),
            "impedance": metrics.get("impedance"),
            "last_weigh_in": self.profile.get("last_weigh_in"),
            "curve_color": self.profile.get("color"),
        }


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
    ) -> None:
        """Initialize metric sensor."""
        super().__init__(coordinator, entry, user_id)
        self.metric_key = metric_key
        self._attr_unique_id = f"{entry.entry_id}_{user_id}_{metric_key}"
        self._attr_name = f"{self.user_name} {label}"
        self._attr_native_unit_of_measurement = unit
        if device_class:
            self._attr_device_class = device_class

    @property
    def native_value(self) -> Any:
        """Return the metric value."""
        if self.metric_key == "target_weight":
            return self.profile.get("target_weight")
        metrics = self.profile.get("latest_metrics", {})
        return metrics.get(self.metric_key)
