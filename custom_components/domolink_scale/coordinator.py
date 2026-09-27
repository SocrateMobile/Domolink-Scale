"""DataUpdateCoordinator and profile manager for Domolink-Scale."""

import asyncio
from datetime import datetime, timedelta, timezone
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

COLOR_PALETTE = [
    "#0284c7", "#10b981", "#f59e0b", "#ec4899",
    "#8b5cf6", "#06b6d4", "#f97316", "#14b8a6", "#6366f1"
]


def _calculate_age(birthdate_str: str) -> int:
    """Calculate age from YYYY-MM-DD string."""
    try:
        born = datetime.strptime(birthdate_str, "%Y-%m-%d").date()
        today = dt_util.now().date()
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except Exception:
        return 35


class DomolinkScaleCoordinator(DataUpdateCoordinator):
    """Coordinator to manage scale data, multi-user profiles, tare mode, and history."""

    def __init__(self, hass: HomeAssistant, config_entry) -> None:
        """Initialize coordinator."""
        super().__init__(hass, _LOGGER, name=DOMAIN)
        self.config_entry = config_entry
        self._store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}_{config_entry.entry_id}")
        self.profiles: Dict[str, Dict[str, Any]] = {}
        self.history: List[Dict[str, Any]] = []
        self.last_tare: Optional[Dict[str, Any]] = None
        self._unsub_trackers: List[Any] = []
        self._last_processed_weight: Optional[float] = None
        self._last_processed_time: float = 0.0
        self._debounce_task: Optional[asyncio.Task] = None

    async def async_setup(self) -> None:
        """Load stored data and setup state listeners."""
        stored = await self._store.async_load()
        if stored and isinstance(stored, dict):
            self.profiles = stored.get("profiles", {})
            self.history = stored.get("history", [])
            self.last_tare = stored.get("last_tare")
        else:
            default_id = "user_1"
            self.profiles = {
                default_id: {
                    "id": default_id,
                    "name": "Jean-Frédéric",
                    "category": "adult",
                    "gender": "male",
                    "birthdate": "1980-01-01",
                    "height": 180,
                    "reference_weight": 92.35,
                    "target_weight": 85.0,
                    "tolerance": 5.0,
                    "color": "#0284c7",
                    "is_athlete": False,
                    "last_impedance": 683.0,
                    "trend_7d": 92.35,
                    "latest_metrics": {},
                }
            }
            self.history = []
            await self._async_save()

        for u_id, prof in self.profiles.items():
            weight = prof.get("reference_weight") or 70.0
            imp = prof.get("last_impedance")
            prof["latest_metrics"] = calculate_metrics(
                weight=weight,
                height=prof.get("height", 175.0),
                age=prof.get("age", 35),
                gender=prof.get("gender", "male"),
                impedance=imp,
                is_athlete=prof.get("is_athlete", False),
                category=prof.get("category", "adult"),
                target_weight=prof.get("target_weight"),
            )

        # Listen to mass entity
        mass_entity = self.config_entry.data.get(CONF_MASS_ENTITY) or self.config_entry.options.get(CONF_MASS_ENTITY)
        if mass_entity:
            _LOGGER.info("Domolink-Scale: Surveillance du capteur de masse : %s", mass_entity)
            unsub = async_track_state_change_event(
                self.hass, [mass_entity], self._async_handle_mass_change
            )
            self._unsub_trackers.append(unsub)

        self._recalculate_trends()
        self.async_set_updated_data(self._get_data_payload())

    async def _async_save(self) -> None:
        """Save data to store."""
        await self._store.async_save({
            "profiles": self.profiles,
            "history": self.history[-2000:],
            "last_tare": self.last_tare,
        })

    def _get_data_payload(self) -> Dict[str, Any]:
        """Format data payload for coordinator and UI."""
        return {
            "profiles": list(self.profiles.values()),
            "history": self.history[-150:],
            "history_count": len(self.history),
            "last_tare": self.last_tare,
            "config": dict(self.config_entry.data),
            "options": dict(self.config_entry.options),
        }

    def _recalculate_trends(self) -> None:
        """Calculate 7-day moving average per profile."""
        now = dt_util.now()
        seven_days_ago = now - timedelta(days=7)

        for u_id, prof in self.profiles.items():
            user_weights = [
                h["weight"] for h in self.history
                if h.get("user_id") == u_id and dt_util.parse_datetime(h["timestamp"]) >= seven_days_ago
            ]
            if user_weights:
                prof["trend_7d"] = round(sum(user_weights) / len(user_weights), 2)
            else:
                prof["trend_7d"] = prof.get("reference_weight")

    async def _async_handle_mass_change(self, event: Event) -> None:
        """Handle state change of the mass entity with BLE sync debounce."""
        new_state = event.data.get("new_state")
        if not new_state or new_state.state in ["unknown", "unavailable", None, ""]:
            return

        try:
            raw_weight = float(str(new_state.state).replace(",", "."))
        except (ValueError, TypeError):
            return

        # Threshold set to 2.0 kg to capture children, cats, and dogs
        if raw_weight < 2.0:
            return

        now_ts = dt_util.now().timestamp()
        if (
            self._last_processed_weight is not None
            and abs(self._last_processed_weight - raw_weight) < 0.05
            and (now_ts - self._last_processed_time) < 8.0
        ):
            return

        self._last_processed_weight = raw_weight
        self._last_processed_time = now_ts

        # Debounce 1.2s to wait for BLE impedance synchronization
        if self._debounce_task and not self._debounce_task.done():
            self._debounce_task.cancel()

        self._debounce_task = self.hass.async_create_task(
            self._delayed_process_weigh_in(raw_weight)
        )

    async def _delayed_process_weigh_in(self, weight: float) -> None:
        """Wait for BLE impedance to arrive, then process."""
        try:
            await asyncio.sleep(1.2)
            await self.async_process_weigh_in(weight)
        except asyncio.CancelledError:
            pass

    async def async_process_weigh_in(
        self,
        weight: float,
        timestamp: Optional[str] = None,
        manual_user_id: Optional[str] = None,
        manual_impedance: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Process and attribute a weigh-in measurement with intelligent biometric cross-referencing."""
        ts = timestamp or dt_util.now().isoformat()
        now_dt = dt_util.now()

        # 1. Read Impedance & Cardio sensors
        impedance = manual_impedance
        if impedance is None:
            imp_entity = self.config_entry.data.get(CONF_IMPEDANCE_ENTITY) or self.config_entry.options.get(CONF_IMPEDANCE_ENTITY)
            if imp_entity:
                st = self.hass.states.get(imp_entity)
                if st and st.state not in ["unknown", "unavailable", None, ""]:
                    try:
                        val = float(str(st.state).replace(",", "."))
                        if 50 <= val <= 1500:
                            impedance = val
                    except (ValueError, TypeError):
                        pass

        heart_rate = None
        hr_entity = self.config_entry.data.get(CONF_HEART_RATE_ENTITY) or self.config_entry.options.get(CONF_HEART_RATE_ENTITY)
        if hr_entity:
            st = self.hass.states.get(hr_entity)
            if st and st.state not in ["unknown", "unavailable", None, ""]:
                try:
                    heart_rate = float(str(st.state).replace(",", "."))
                except (ValueError, TypeError):
                    pass

        # 2. Tare Mode Detection: Check if an adult weighed in within the last 180 seconds
        recent_adult_entry = None
        if self.history:
            last_entry = self.history[-1]
            last_ts = dt_util.parse_datetime(last_entry["timestamp"])
            if last_ts and (now_dt - last_ts).total_seconds() <= 180:
                user_cat = self.profiles.get(last_entry["user_id"], {}).get("category", "adult")
                if user_cat == "adult" and weight > (last_entry["weight"] + 0.8) and weight <= (last_entry["weight"] + 40.0):
                    recent_adult_entry = last_entry

        if recent_adult_entry and not manual_user_id:
            tare_delta = round(weight - recent_adult_entry["weight"], 2)
            _LOGGER.info(
                "Domolink-Scale: Mode Tare détecté ! Poids de base: %.2f kg, Total: %.2f kg -> Tare: %.2f kg",
                recent_adult_entry["weight"], weight, tare_delta
            )
            self.last_tare = {
                "tare_weight": tare_delta,
                "total_weight": round(weight, 2),
                "base_weight": recent_adult_entry["weight"],
                "base_user_id": recent_adult_entry["user_id"],
                "base_user_name": recent_adult_entry["user_name"],
                "timestamp": ts,
            }
            await self._async_save()
            self.async_set_updated_data(self._get_data_payload())
            self.hass.bus.async_fire("domolink_scale_tare_detected", self.last_tare)
            return {"type": "tare", "tare": self.last_tare}

        # 3. Attribution Logic (Weight + Impedance Cross-Referencing)
        matched_user_id = manual_user_id

        if not matched_user_id:
            candidate_profiles = []

            for u_id, prof in self.profiles.items():
                ref_w = prof.get("reference_weight", prof.get("target_weight", 70.0))
                tol = prof.get("tolerance", 5.0)  # default 5kg
                w_diff = abs(weight - ref_w)

                if w_diff <= tol:
                    # Score based on weight distance (0 to 1)
                    w_score = w_diff / max(1.0, tol)

                    # Biometric impedance signature cross-referencing
                    last_imp = prof.get("last_impedance")
                    if impedance and last_imp:
                        imp_diff = abs(impedance - last_imp)
                        imp_score = min(1.0, imp_diff / 150.0)
                        combined_score = (w_score * 0.65) + (imp_score * 0.35)
                    else:
                        combined_score = w_score

                    candidate_profiles.append((combined_score, w_diff, u_id))

            if candidate_profiles:
                # Pick profile with smallest combined biometric score
                candidate_profiles.sort(key=lambda x: x[0])
                matched_user_id = candidate_profiles[0][2]
                _LOGGER.info("Domolink-Scale: Attribution automatique au profil %s (score: %.2f)", matched_user_id, candidate_profiles[0][0])
            else:
                # Ecart > 5 kg par rapport à TOUT LE MONDE -> Création automatique d'un nouvel utilisateur !
                new_num = len(self.profiles) + 1
                is_child_range = (weight < 25.0)
                new_name = f"Enfant {new_num}" if is_child_range else f"Utilisateur {new_num}"
                new_category = "child" if is_child_range else "adult"
                color_idx = (new_num - 1) % len(COLOR_PALETTE)

                matched_user_id = await self.async_add_profile({
                    "name": new_name,
                    "category": new_category,
                    "reference_weight": weight,
                    "target_weight": round(weight - 3.0, 1) if not is_child_range else weight,
                    "tolerance": 5.0,
                    "height": 110 if is_child_range else 175,
                    "birthdate": "2020-01-01" if is_child_range else "1990-01-01",
                    "color": COLOR_PALETTE[color_idx],
                })
                _LOGGER.info(
                    "Domolink-Scale: Écart > 5kg constaté. Création automatique du profil '%s' (ID: %s)",
                    new_name, matched_user_id
                )

        profile = self.profiles[matched_user_id]
        user_name = profile.get("name", "Utilisateur")
        height = float(profile.get("height", 175))
        birthdate = profile.get("birthdate", "1985-01-01")
        age = _calculate_age(birthdate)
        gender = profile.get("gender", "male")
        is_athlete = bool(profile.get("is_athlete", False))
        category = profile.get("category", "adult")
        target_weight = float(profile.get("target_weight", DEFAULT_TARGET_WEIGHT))

        metrics = calculate_metrics(
            weight=weight,
            height=height,
            age=age,
            gender=gender,
            impedance=impedance,
            is_athlete=is_athlete,
            category=category,
            target_weight=target_weight,
        )

        if heart_rate is not None:
            metrics["heart_rate"] = heart_rate

        metrics["target_weight"] = target_weight
        metrics["target_delta"] = round(weight - target_weight, 2)

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

        # Update profile stats
        profile["reference_weight"] = round(weight, 2)
        if impedance:
            profile["last_impedance"] = impedance
        profile["latest_metrics"] = metrics
        profile["last_weigh_in"] = ts

        self._recalculate_trends()
        await self._async_save()

        self.async_set_updated_data(self._get_data_payload())
        self.hass.bus.async_fire(EVENT_WEIGH_IN, history_item)

        return history_item

    async def async_add_profile(self, profile_data: Dict[str, Any]) -> str:
        """Add a new user/pet/child profile."""
        name = profile_data.get("name", "Nouvel Utilisateur").strip()
        user_id = profile_data.get("id") or f"user_{uuid.uuid4().hex[:8]}"

        new_profile = {
            "id": user_id,
            "name": name,
            "category": profile_data.get("category", "adult"),
            "gender": profile_data.get("gender", "male"),
            "birthdate": profile_data.get("birthdate", "1990-01-01"),
            "height": float(profile_data.get("height", 175)),
            "reference_weight": float(profile_data.get("reference_weight", profile_data.get("target_weight", 70.0))),
            "target_weight": float(profile_data.get("target_weight", 65.0)),
            "tolerance": float(profile_data.get("tolerance", 5.0)),
            "color": profile_data.get("color", COLOR_PALETTE[len(self.profiles) % len(COLOR_PALETTE)]),
            "is_athlete": bool(profile_data.get("is_athlete", False)),
            "last_impedance": None,
            "trend_7d": float(profile_data.get("reference_weight", 70.0)),
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
        for field in ["name", "category", "gender", "birthdate", "color", "is_athlete"]:
            if field in updates:
                prof[field] = updates[field]

        for num_field in ["height", "reference_weight", "target_weight", "tolerance"]:
            if num_field in updates and updates[num_field] is not None:
                try:
                    prof[num_field] = float(updates[num_field])
                except (ValueError, TypeError):
                    pass

        self._recalculate_trends()
        await self._async_save()
        self.async_set_updated_data(self._get_data_payload())
        return True

    async def async_merge_profiles(self, source_user_id: str, target_user_id: str) -> bool:
        """Merge source profile into target profile and delete source."""
        if source_user_id not in self.profiles or target_user_id not in self.profiles:
            return False
        if source_user_id == target_user_id:
            return False

        target_prof = self.profiles[target_user_id]
        target_name = target_prof.get("name", target_user_id)

        # 1. Reassign all history entries
        for item in self.history:
            if item.get("user_id") == source_user_id:
                item["user_id"] = target_user_id
                item["user_name"] = target_name
                # Recalculate metrics based on target profile parameters
                age = _calculate_age(target_prof.get("birthdate", "1985-01-01"))
                item["metrics"] = calculate_metrics(
                    weight=item["weight"],
                    height=float(target_prof.get("height", 175)),
                    age=age,
                    gender=target_prof.get("gender", "male"),
                    impedance=item.get("impedance"),
                    is_athlete=bool(target_prof.get("is_athlete", False)),
                    category=target_prof.get("category", "adult"),
                    target_weight=float(target_prof.get("target_weight", 70.0)),
                )
                item["metrics"]["target_weight"] = float(target_prof.get("target_weight", 70.0))
                item["metrics"]["target_delta"] = round(item["weight"] - item["metrics"]["target_weight"], 2)

        # 2. Update target's latest measurement if source had a more recent weigh-in
        user_history = [h for h in self.history if h.get("user_id") == target_user_id]
        if user_history:
            user_history.sort(key=lambda x: x["timestamp"])
            latest = user_history[-1]
            target_prof["reference_weight"] = latest["weight"]
            target_prof["latest_metrics"] = latest["metrics"]
            target_prof["last_weigh_in"] = latest["timestamp"]
            if latest.get("impedance"):
                target_prof["last_impedance"] = latest["impedance"]

        # 3. Delete source profile
        del self.profiles[source_user_id]

        self._recalculate_trends()
        await self._async_save()
        self.async_set_updated_data(self._get_data_payload())
        _LOGGER.info("Domolink-Scale: Profil '%s' fusionné avec succès dans '%s'", source_user_id, target_name)
        return True

    async def async_delete_profile(self, user_id: str) -> bool:
        """Delete a profile."""
        if user_id in self.profiles:
            del self.profiles[user_id]
            for item in self.history:
                if item.get("user_id") == user_id:
                    item["user_id"] = "guest"
                    item["user_name"] = "Invité"
            self._recalculate_trends()
            await self._async_save()
            self.async_set_updated_data(self._get_data_payload())
            return True
        return False

    async def async_delete_weigh_in(self, entry_id: str) -> bool:
        """Delete a single weigh-in entry from history."""
        initial_len = len(self.history)
        self.history = [h for h in self.history if h.get("id") != entry_id]
        if len(self.history) < initial_len:
            self._recalculate_trends()
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

            age = _calculate_age(prof.get("birthdate", "1985-01-01"))
            recalc = calculate_metrics(
                weight=target_entry["weight"],
                height=float(prof.get("height", 175)),
                age=age,
                gender=prof.get("gender", "male"),
                impedance=target_entry.get("impedance"),
                is_athlete=bool(prof.get("is_athlete", False)),
                category=prof.get("category", "adult"),
            )
            recalc["target_weight"] = float(prof.get("target_weight", 70.0))
            recalc["target_delta"] = round(target_entry["weight"] - recalc["target_weight"], 2)
            target_entry["metrics"] = recalc

            prof["reference_weight"] = target_entry["weight"]
            prof["latest_metrics"] = recalc
            prof["last_weigh_in"] = target_entry["timestamp"]
        else:
            target_entry["user_id"] = "guest"
            target_entry["user_name"] = "Invité"

        self._recalculate_trends()
        await self._async_save()
        self.async_set_updated_data(self._get_data_payload())
        return True

    def async_unload(self) -> None:
        """Unload coordinator and state trackers."""
        if self._debounce_task and not self._debounce_task.done():
            self._debounce_task.cancel()
        for unsub in self._unsub_trackers:
            unsub()
        self._unsub_trackers.clear()
