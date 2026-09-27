"""Body composition, Bioelectrical Impedance Analysis (BIA), Pet/Child metrics and Activity goals."""

import math
from typing import Any, Dict, Optional


def clamp(val: float, min_val: float, max_val: float) -> float:
    """Clamp a value between min and max."""
    return max(min_val, min(val, max_val))


def calculate_activity_goals(
    weight: float,
    target_weight: float,
    height: float,
    age: int,
    category: str = "adult",
) -> Dict[str, Any]:
    """Calculate daily recommended steps, walking hours, distance and calories based on physiology."""
    category = (category or "adult").lower()

    # Animal categories
    if category in ["cat", "chat"]:
        return {
            "daily_steps_goal": 3000,
            "walking_duration_hours": 0.5,
            "walking_duration_minutes": 30,
            "walking_distance_km": 1.2,
            "walking_calories_kcal": 40,
            "activity_advice": "30 minutes de stimulation et jeux actifs par jour",
        }
    elif category in ["dog", "chien"]:
        duration = 1.0 if weight > 15 else 0.75
        dist = round(duration * 4.0, 1)
        return {
            "daily_steps_goal": 8000,
            "walking_duration_hours": duration,
            "walking_duration_minutes": int(duration * 60),
            "walking_distance_km": dist,
            "walking_calories_kcal": int(dist * weight * 0.8),
            "activity_advice": f"{int(duration * 60)} minutes de promenade quotidienne conseillée",
        }
    elif category in ["child", "enfant"]:
        return {
            "daily_steps_goal": 11500,
            "walking_duration_hours": 1.5,
            "walking_duration_minutes": 90,
            "walking_distance_km": 5.5,
            "walking_calories_kcal": 220,
            "activity_advice": "Jeux libres, récréation et activités dynamiques (OMS)",
        }
    elif category in ["luggage", "bagage"]:
        return {}

    # Adult Human activity calculation
    h_cm = max(120.0, height or 175.0)
    # Stride length in meters: Height (cm) * 0.415 / 100
    stride_m = (h_cm * 0.415) / 100.0

    target_w = target_weight if target_weight and target_weight > 20 else weight
    delta_w = max(0.0, weight - target_w)

    # Base steps: 8,000 for maintenance. If weight loss needed: +350 steps per kg to lose
    if delta_w > 0.5:
        surplus_steps = min(4500, int(delta_w * 350))
        steps = 8000 + surplus_steps
    else:
        steps = 8000 if age < 65 else 7000

    # Age adjustment
    if age > 65:
        steps = int(steps * 0.85)
    elif age < 25:
        steps = int(steps * 1.1)

    steps = int(clamp(steps, 6000, 14000))
    # Round to nearest 50 steps
    steps = round(steps / 50.0) * 50

    # Distance in km
    distance_km = round((steps * stride_m) / 1000.0, 2)

    # Walking duration in hours at 4.8 km/h
    duration_hours = round(distance_km / 4.8, 2)
    duration_minutes = int(round(duration_hours * 60))

    # Estimated calories burned (approx 0.75 kcal per kg per km of walking)
    calories = int(round(distance_km * weight * 0.75))

    return {
        "daily_steps_goal": steps,
        "walking_duration_hours": duration_hours,
        "walking_duration_minutes": duration_minutes,
        "walking_distance_km": distance_km,
        "walking_calories_kcal": calories,
        "stride_length_cm": round(stride_m * 100.0, 1),
    }


def calculate_metrics(
    weight: float,
    height: float,
    age: int,
    gender: str,
    impedance: Optional[float] = None,
    is_athlete: bool = False,
    category: str = "adult",
    target_weight: Optional[float] = None,
) -> Dict[str, Any]:
    """Calculate comprehensive metrics based on profile category, biometric parameters and activity goals."""
    if weight <= 0:
        return {}

    category = (category or "adult").lower()
    activity = calculate_activity_goals(
        weight=weight,
        target_weight=target_weight or weight,
        height=height,
        age=age,
        category=category,
    )

    # 1. Pets (Chat, Chien) or Luggage (Bagage)
    if category in ["cat", "dog", "chat", "chien", "luggage", "bagage"]:
        res = {
            "weight": weight,
            "category": category,
            "is_pet": True,
            "bmi": None,
            "bmi_label": None,
            "ideal_weight": None,
            "fat_percentage": None,
            "fat_mass": None,
            "muscle_mass": None,
            "water_percentage": None,
            "bone_mass": None,
            "visceral_fat": None,
            "bmr": None,
            "metabolic_age": None,
            "protein_percentage": None,
            "body_type": "animal" if category in ["cat", "dog", "chat", "chien"] else "objet",
            "body_score": None,
            "impedance": None,
        }
        res.update(activity)
        return res

    # 2. Young children
    is_young_child = age < 6 or weight < 20.0 or category in ["child", "enfant"]
    h_m = max(0.4, height / 100.0)
    bmi = round(weight / (h_m * h_m), 1)

    if is_young_child:
        res = {
            "weight": weight,
            "category": "child",
            "is_child": True,
            "bmi": bmi,
            "bmi_label": "enfant",
            "ideal_weight": round(20.0 * (h_m * h_m), 1),
            "fat_percentage": None,
            "fat_mass": None,
            "muscle_mass": None,
            "water_percentage": round(clamp(70.0 - (age * 1.5), 55.0, 75.0), 1),
            "bone_mass": round(weight * 0.04, 1),
            "visceral_fat": 1.0,
            "bmr": round(weight * 50.0, 0),
            "metabolic_age": age,
            "protein_percentage": 15.0,
            "body_type": "enfant",
            "body_score": 90,
            "impedance": impedance,
        }
        res.update(activity)
        return res

    # 3. Adult human calculations
    gender = gender.lower()
    is_male = gender in ["male", "m", "homme"]

    if bmi < 18.5:
        bmi_label = "underweight"
    elif bmi < 25.0:
        bmi_label = "normal"
    elif bmi < 30.0:
        bmi_label = "overweight"
    elif bmi < 35.0:
        bmi_label = "obese_1"
    else:
        bmi_label = "obese_2"

    if is_male:
        ideal_weight = round(height - 100 - ((height - 150) / 4.0), 1)
    else:
        ideal_weight = round(height - 100 - ((height - 150) / 2.5), 1)
    if ideal_weight <= 20:
        ideal_weight = round(22.0 * (h_m * h_m), 1)

    if is_male:
        bmr = round(877.8 + (weight * 14.916) - (height * 0.726) - (age * 8.976), 0)
    else:
        bmr = round(864.6 + (weight * 10.2036) - (height * 0.39336) - (age * 6.204), 0)
    bmr = clamp(bmr, 500, 5000)

    if is_male:
        if height < weight * 1.6 + 63.0:
            v_fat = age * 0.15 + ((weight * 305.0) / ((height * 0.0826 * height - height * 0.4) + 48.0) - 2.9)
        else:
            v_fat = age * 0.15 + (weight * (height * -0.0015 + 0.765) - height * 0.143) - 5.0
    else:
        if weight <= height * 0.5 - 13.0:
            v_fat = age * 0.07 + (weight * (height * -0.0024 + 0.691) - height * 0.027) - 10.5
        else:
            v_fat = age * 0.07 + ((weight * 500.0) / ((height * 1.45 + height * 0.1158 * height) - 120.0) - 6.0)
    visceral_fat = round(clamp(v_fat, 1.0, 50.0), 1)
    visceral_label = "normal" if visceral_fat <= 9.0 else ("high" if visceral_fat <= 14.0 else "very_high")

    has_impedance = impedance is not None and 50.0 <= impedance <= 1500.0

    if has_impedance:
        lbm = (
            (height * 9.058 / 100.0) * (height / 100.0)
            + weight * 0.32
            + 12.226
            - impedance * 0.0068
            - age * 0.0542
        )
        lbm = min(lbm, weight * 0.98)

        if is_male:
            adjust = 0.8
            coeff = 0.98 if weight < 61 else 1.0
        else:
            adjust = 9.25 if age <= 49 else 7.25
            coeff = 1.0
            if weight > 60:
                coeff = 0.96 * (1.03 if height > 160 else 1.0)
            elif weight < 50:
                coeff = 1.02 * (1.03 if height > 160 else 1.0)

        raw_fat = (1.0 - ((lbm - adjust) * coeff / weight)) * 100.0
        fat_pct = round(clamp(raw_fat, 5.0, 75.0), 1)

        base = 0.18016894 if is_male else 0.245691014
        bone = (base - (lbm * 0.05158)) * -1
        bone += 0.1 if bone > 2.2 else -0.1
        bone_mass = round(clamp(bone, 0.5, 8.0), 1)

        muscle = weight - (fat_pct * 0.01 * weight) - bone_mass
        muscle_mass = round(clamp(muscle, 10.0, 120.0), 1)
        muscle_pct = round((muscle_mass / weight) * 100.0, 1)

        raw_water = (100.0 - fat_pct) * 0.7
        raw_water *= 1.02 if raw_water <= 50 else 0.98
        water_pct = round(clamp(raw_water, 35.0, 75.0), 1)

        protein_pct = round(clamp((muscle_mass / weight) * 100.0 - water_pct, 5.0, 32.0), 1)

        if is_male:
            metab_age = (height * -0.7471) + (weight * 0.9161) + (age * 0.4184) + (impedance * 0.0517) + 54.2267
        else:
            metab_age = (height * -1.1165) + (weight * 1.5784) + (age * 0.4615) + (impedance * 0.0415) + 83.2548
        metabolic_age = int(round(clamp(metab_age, 15, 85)))

    else:
        sex_val = 1 if is_male else 0
        raw_fat = (1.20 * bmi) + (0.23 * age) - (10.8 * sex_val) - 5.4
        fat_pct = round(clamp(raw_fat, 5.0, 65.0), 1)
        water_pct = round(clamp((100.0 - fat_pct) * 0.73, 38.0, 70.0), 1)
        bone_mass = round(2.9 if is_male else 2.3, 1)
        muscle_mass = round(clamp(weight - (fat_pct * 0.01 * weight) - bone_mass, 10.0, 120.0), 1)
        muscle_pct = round((muscle_mass / weight) * 100.0, 1)
        protein_pct = round(clamp(16.5 if is_male else 14.5, 5.0, 25.0), 1)
        metabolic_age = age

    fat_mass = round((fat_pct / 100.0) * weight, 1)
    water_mass = round((water_pct / 100.0) * weight, 1)

    if is_male:
        fat_label = "very_low" if fat_pct < 10.0 else ("normal" if fat_pct < 20.0 else ("elevated" if fat_pct < 25.0 else "high"))
    else:
        fat_label = "very_low" if fat_pct < 18.0 else ("normal" if fat_pct < 28.0 else ("elevated" if fat_pct < 35.0 else "high"))

    fat_level = 0 if fat_label in ["elevated", "high"] else (2 if fat_label == "very_low" else 1)
    muscle_level = 2 if muscle_pct >= (45.0 if is_male else 38.0) else (0 if muscle_pct < (38.0 if is_male else 30.0) else 1)
    type_idx = muscle_level + (fat_level * 3)
    types_list = [
        "obese", "overweight", "thick_set",
        "lack_exercise", "balanced", "balanced_muscular",
        "skinny", "balanced_skinny", "athletic"
    ]
    body_type = types_list[type_idx] if 0 <= type_idx < len(types_list) else "balanced"

    score = 100.0
    bmi_diff = abs(bmi - 22.0)
    score -= min(35.0, bmi_diff * 3.0)
    if visceral_fat > 9:
        score -= min(25.0, (visceral_fat - 9.0) * 2.5)
    optimal_fat = 15.0 if is_male else 22.0
    fat_diff = abs(fat_pct - optimal_fat)
    score -= min(25.0, fat_diff * 1.2)
    if metabolic_age > age:
        score -= min(15.0, (metabolic_age - age) * 1.5)
    else:
        score += min(5.0, (age - metabolic_age) * 0.5)

    body_score = int(round(clamp(score, 20.0, 100.0)))

    res = {
        "weight": weight,
        "category": "adult",
        "bmi": bmi,
        "bmi_label": bmi_label,
        "ideal_weight": ideal_weight,
        "fat_percentage": fat_pct,
        "fat_mass": fat_mass,
        "fat_label": fat_label,
        "muscle_mass": muscle_mass,
        "muscle_percentage": muscle_pct,
        "water_percentage": water_pct,
        "water_mass": water_mass,
        "bone_mass": bone_mass,
        "visceral_fat": visceral_fat,
        "visceral_label": visceral_label,
        "bmr": bmr,
        "metabolic_age": metabolic_age,
        "protein_percentage": protein_pct,
        "body_type": body_type,
        "body_score": body_score,
        "impedance": impedance if has_impedance else None,
    }
    res.update(activity)
    return res
