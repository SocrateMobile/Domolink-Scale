"""DataUpdateCoordinator and profile manager for Domolink-Scale."""

import asyncio
from datetime import datetime, timezone
import logging
import uuid
from typing import Any, Dict, List, Optional

from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .body_metrics import calculate_metrics
from .const import (
    CONF_BATTERY_ENTITY,
    CONF_BMR_ENTITY,
    CONF_BODY_FAT_ENTITY,
    CONF_BONE_MASS_ENTITY,
    CONF_HEART_RATE_ENTITY,
    CONF_IMPEDANCE_ENTITY,
    CONF_MASS_ENTITY,
    CONF_MUSCLE_MASS_ENTITY,
    CONF_NON_STABILIZED_ENTITY,
    CONF_PWV_ENTITY,
    CONF_VISCERAL_FAT_ENTITY,
    CONF_WATER_ENTITY,
    DEFAULT_COLOR,
    DEFAULT_TARGET_WEIGHT,
    DEFAULT_TOLERANCE,
    DOMAIN,
    EVENT_WEIGH_IN,
    STORAGE_KEY,
    STORAGE_VERSION,
)

_LOGGER = logging.getLogger(__name__)


def _calculate_age(birthdate_str: str) -> int:
    """Calculate age from YYYY-MM-DD string."""
    try:
        born = datetime.strptime(birthdate_str, "%Y-%m-%d").date()
        today = dt_util.now().date()
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except Exception:
        return 35


class DomolinkScaleCoordinator(DataUpdateCoordinator):
    """Coordinator to manage scale data, profiles, and history."""

    def __init__(self, hass: HomeAssistant, config_entry) -> None:
        """Initialize coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
        )
        self.config_entry = config_entry
        self._store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}_{config_entry.entry_id}")
        self.profiles: Dict[str, Dict[str, Any]] = {}
        self.history: List[Dict[str, Any]] = []
        self._unsub_trackers: List[Any] = []
        self._last_processed_weight: Optional[float] = None
        self._last_processed_time: float = 0.0

    async def async_setup(self) -> None:
        """Load stored data and setup state listeners."""
        # 1. Load storage
        stored = await self._store.async_load()
        if stored and isinstance(stored, dict):
            self.profiles = stored.get("profiles", {})
            self.history = stored.get("history", [])
        else:
            # Create default profile if none exists
            default_id = "user_default"
            self.profiles = {
                default_id: {
                    "id": default_id,
                    "name": "Utilisateur",
                    "gender": "male",
                    "birthdate": "1985-01-01",
                    "height": 178,
                    "reference_weight": 80.0,
                    "target_weight": 75.0,
                    "tolerance": DEFAULT_TOLERANCE,
                    "color": DEFAULT_COLOR,
                    "is_athlete": False,
                    "latest_metrics": {},
                }
            }
            self.history = []
            await self._async_save()

        # 2. Track scale state changes
        mass_entity = self.config_entry.data.get(CONF_MASS_ENTITY) or self.config_entry.options.get(CONF_MASS_ENTITY)
        if mass_entity:
            _LOGGER.info("Domolink-Scale: Enregistrement de l'écouteur sur %s", mass_entity)
            unsub = async_track_state_change_event(
                self.hass, [mass_entity], self._async_handle_mass_change
            )
            self._unsub_trackers.append(unsub)

        self.async_set_updated_data(self._get_data_payload())

    async def _async_save(self) -> None:
        """Save data to store."""
        await self._store.async_save({
            "profiles": self.profiles,
            "history": self.history[-1500:],  # keep last 1500 weigh-ins
        })

    def _get_data_payload(self) -> Dict[str, Any]:
        """Format data payload for coordinator and UI."""
        return {
            "profiles": list(self.profiles.values()),
            "history": self.history[-100:],  # last 100 for fast UI payload
            "history_count": len(self.history),
            "config": dict(self.config_entry.data),
            "options": dict(self.config_entry.options),
        }

    async def _async_handle_mass_change(self, event: Event) -> None:
        """Handle state change of the mass entity."""
        new_state = event.data.get("new_state")
        if not new_state or new_state.state in ["unknown", "unavailable", None, ""]:
            return

        try:
            raw_weight = float(str(new_state.state).replace(",", "."))
        except (ValueError, TypeError):
            return

        # Filter out noise, tare or light objects (< 10 kg)
        if raw_weight < 10.0:
            return

        now_ts = dt_util.now().timestamp()
        # Debounce: avoid processing identical weight within 8 seconds
        if (
            self._last_processed_weight is not None
            and abs(self._last_processed_weight - raw_weight) < 0.05
            and (now_ts - self._last_processed_time) < 8.0
        ):
            return

        self._last_processed_weight = raw_weight
        self._last_processed_time = now_ts

        _LOGGER.info("Domolink-Scale: Nouvelle pesée détectée : %.2f kg", raw_weight)
        await self.async_process_weigh_in(raw_weight)

    async def async_process_weigh_in(
        self,
        weight: float,
        timestamp: Optional[str] = None,
        manual_user_id: Optional[str] = None,
        manual_impedance: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Process and attribute a weigh-in measurement."""
        ts = timestamp or dt_util.now().isoformat()

        # 1. Fetch sensor values (impedance, heart rate, native metrics)
        impedance = manual_impedance
        if impedance is None:
            imp_entity = self.config_entry.data.get(CONF_IMPEDANCE_ENTITY) or self.config_entry.options.get(CONF_IMPEDANCE_ENTITY)
            if imp_entity:
                st = self.hass.states.get(imp_entity)
                if st and st.state not in ["unknown", "unavailable", None, ""]:
                    try:
                        impedance = float(str(st.state).replace(",", "."))
                    except (ValueError, TypeError):
                        impedance = None

        heart_rate = None
        hr_entity = self.config_entry.data.get(CONF_HEART_RATE_ENTITY) or self.config_entry.options.get(CONF_HEART_RATE_ENTITY)
        if hr_entity:
            st = self.hass.states.get(hr_entity)
            if st and st.state not in ["unknown", "unavailable", None, ""]:
                try:
                    heart_rate = float(str(st.state).replace(",", "."))
                except (ValueError, TypeError):
                    heart_rate = None

        # 2. Determine Profile Attribution
        matched_user_id = manual_user_id
        if not matched_user_id:
            # Check closest profile within tolerance
            best_diff = float("inf")
            best_user = None

            for u_id, prof in self.profiles.items():
                ref_w = prof.get("reference_weight", prof.get("target_weight", 75.0))
                tol = prof.get("tolerance", DEFAULT_TOLERANCE)
                diff = abs(weight - ref_w)
                if diff <= tol and diff < best_diff:
                    best_diff = diff
                    best_user = u_id

            matched_user_id = best_user or "guest"

        # 3. Calculate metrics for matched profile
        if matched_user_id in self.profiles:
            profile = self.profiles[matched_user_id]
            user_name = profile.get("name", "Utilisateur")
            height = float(profile.get("height", 175))
            birthdate = profile.get("birthdate", "1985-01-01")
            age = _calculate_age(birthdate)
            gender = profile.get("gender", "male")
            is_athlete = bool(profile.get("is_athlete", False))
            target_weight = float(profile.get("target_weight", DEFAULT_TARGET_WEIGHT))
        else:
            profile = None
            user_name = "Invité"
            height = 175.0
            age = 35
            gender = "male"
            is_athlete = False
            target_weight = 75.0

        metrics = calculate_metrics(
            weight=weight,
            height=height,
            age=age,
            gender=gender,
            impedance=impedance,
            is_athlete=is_athlete,
        )

        if heart_rate is not None:
            metrics["heart_rate"] = heart_rate

        metrics["target_weight"] = target_weight
        metrics["target_delta"] = round(weight - target_weight, 2)

        # 4. Create history entry
        entry_id = f"scale_{int(dt_util.now().timestamp())}_{uuid.uuid4().hex[:6]}"
        history_item = {
            "id": entry_id,
            "timestamp": ts,
            "user_id": matched_user_id,
            "user_name": user_name,
            "weight": round(weight, 2),
            "impedance": impedance,
            "metrics": metrics,
        }
        self.history.append(history_item)

        # 5. Update profile latest state and reference weight if recognized
        if profile is not None:
            profile["reference_weight"] = round(weight, 2)
            profile["latest_metrics"] = metrics
            profile["last_weigh_in"] = ts

        await self._async_save()

        # 6. Notify coordinator and fire HA event
        self.async_set_updated_data(self._get_data_payload())
        self.hass.bus.async_fire(EVENT_WEIGH_IN, history_item)

        _LOGGER.info(
            "Domolink-Scale: Pesée de %.2f kg attribuée à %s (IMC: %.1f, Graisse: %s%%)",
            weight,
            user_name,
            metrics.get("bmi", 0),
            metrics.get("fat_percentage", "N/A"),
        )
        return history_item

    async def async_add_profile(self, profile_data: Dict[str, Any]) -> str:
        """Add a new user profile."""
        name = profile_data.get("name", "Nouvel Utilisateur").strip()
        user_id = profile_data.get("id") or f"user_{uuid.uuid4().hex[:8]}"

        new_profile = {
            "id": user_id,
            "name": name,
            "gender": profile_data.get("gender", "male"),
            "birthdate": profile_data.get("birthdate", "1990-01-01"),
            "height": float(profile_data.get("height", 175)),
            "reference_weight": float(profile_data.get("reference_weight", profile_data.get("target_weight", 75.0))),
            "target_weight": float(profile_data.get("target_weight", 70.0)),
            "tolerance": float(profile_data.get("tolerance", DEFAULT_TOLERANCE)),
            "color": profile_data.get("color", DEFAULT_COLOR),
            "is_athlete": bool(profile_data.get("is_athlete", False)),
            "latest_metrics": {},
        }

        self.profiles[user_id] = new_profile
        await self._async_save()
        self.async_set_updated_data(self._get_data_payload())
        return user_id

    async def async_update_profile(self, user_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing profile."""
        if user_id not in self.profiles:
            return False

        prof = self.profiles[user_id]
        for field in ["name", "gender", "birthdate", "color", "is_athlete"]:
            if field in updates:
                prof[field] = updates[field]

        for num_field in ["height", "reference_weight", "target_weight", "tolerance"]:
            if num_field in updates and updates[num_field] is not None:
                try:
                    prof[num_field] = float(updates[num_field])
                except (ValueError, TypeError):
                    pass

        await self._async_save()
        self.async_set_updated_data(self._get_data_payload())
        return True

    async def async_delete_profile(self, user_id: str) -> bool:
        """Delete a profile."""
        if user_id in self.profiles:
            del self.profiles[user_id]
            # Reassign user's history entries to guest
            for item in self.history:
                if item.get("user_id") == user_id:
                    item["user_id"] = "guest"
                    item["user_name"] = "Invité"
            await self._async_save()
            self.async_set_updated_data(self._get_data_payload())
            return True
        return False

    async def async_delete_weigh_in(self, entry_id: str) -> bool:
        """Delete a single weigh-in entry from history."""
        initial_len = len(self.history)
        self.history = [h for h in self.history if h.get("id") != entry_id]
        if len(self.history) < initial_len:
            await self._async_save()
            self.async_set_updated_data(self._get_data_payload())
            return True
        return False

    async def async_reassign_weigh_in(self, entry_id: str, target_user_id: str) -> bool:
        """Reassign an existing weigh-in to a different user."""
        target_entry = None
        for item in self.history:
            if item.get("id") == entry_id:
                target_entry = item
                break

        if not target_entry:
            return False

        if target_user_id in self.profiles:
            prof = self.profiles[target_user_id]
            user_name = prof.get("name", "Utilisateur")
            target_entry["user_id"] = target_user_id
            target_entry["user_name"] = user_name

            # Recalculate metrics for new user
            age = _calculate_age(prof.get("birthdate", "1985-01-01"))
            recalc = calculate_metrics(
                weight=target_entry["weight"],
                height=float(prof.get("height", 175)),
                age=age,
                gender=prof.get("gender", "male"),
                impedance=target_entry.get("impedance"),
                is_athlete=bool(prof.get("is_athlete", False)),
            )
            recalc["target_weight"] = float(prof.get("target_weight", 75.0))
            recalc["target_delta"] = round(target_entry["weight"] - recalc["target_weight"], 2)
            target_entry["metrics"] = recalc

            # If this is the latest entry, update profile reference weight
            prof["reference_weight"] = target_entry["weight"]
            prof["latest_metrics"] = recalc
            prof["last_weigh_in"] = target_entry["timestamp"]
        else:
            target_entry["user_id"] = "guest"
            target_entry["user_name"] = "Invité"

        await self._async_save()
        self.async_set_updated_data(self._get_data_payload())
        return True

    def async_unload(self) -> None:
        """Unload coordinator and state trackers."""
        for unsub in self._unsub_trackers:
            unsub()
        self._unsub_trackers.clear()
