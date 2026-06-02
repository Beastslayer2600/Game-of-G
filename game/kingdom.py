import random
from .constants import SEASONS, BUILDINGS, EVENTS, WIN_PRESTIGE, STARTING_RESOURCES, STARTING_POPULATION


class Kingdom:
    def __init__(self, name: str):
        self.name = name
        self.year = 1
        self.season_idx = 0
        self.resources: dict[str, int] = dict(STARTING_RESOURCES)
        self.population = STARTING_POPULATION
        self.soldiers = 0
        self.morale = 60
        self.prestige = 0
        self.buildings: list[str] = []
        self.defense = 0
        self.attack_bonus = 0
        self.soldier_capacity = 0
        self.log: list[str] = []
        self.starvation_turns = 0
        self.game_over = False
        self.victory = False

    @property
    def season(self) -> str:
        return SEASONS[self.season_idx]

    def building_count(self, bid: str) -> int:
        return self.buildings.count(bid)

    def has_building(self, bid: str) -> bool:
        return bid in self.buildings

    def can_build(self, bid: str) -> tuple[bool, str]:
        if bid not in BUILDINGS:
            return False, "Unknown building"
        b = BUILDINGS[bid]
        req = b.get("requires")
        if req and not self.has_building(req):
            return False, f"Requires {BUILDINGS[req]['name']}"
        for r, v in b["cost"].items():
            if v > 0 and self.resources.get(r, 0) < v:
                return False, f"Not enough {r}"
        return True, ""

    def build(self, bid: str) -> tuple[bool, str]:
        ok, reason = self.can_build(bid)
        if not ok:
            return False, reason
        b = BUILDINGS[bid]
        for r, v in b["cost"].items():
            self.resources[r] -= v
        self.buildings.append(bid)
        self.defense += b.get("defense_bonus", 0)
        self.soldier_capacity += b.get("soldier_capacity", 0)
        self.attack_bonus += b.get("attack_bonus", 0)
        msg = f"Built {b['name']}!"
        self.log.append(msg)
        return True, msg

    def recruit(self, count: int) -> tuple[bool, str]:
        slots = self.soldier_capacity - self.soldiers
        if count <= 0:
            return False, "Enter a positive number."
        if count > slots:
            return False, f"Only {slots} slot(s) available. Build more Barracks."
        gold_cost = count * 10
        food_cost = count * 5
        if self.resources["gold"] < gold_cost:
            return False, f"Need {gold_cost} gold (have {self.resources['gold']})."
        if self.resources["food"] < food_cost:
            return False, f"Need {food_cost} food (have {self.resources['food']})."
        self.resources["gold"] -= gold_cost
        self.resources["food"] -= food_cost
        self.soldiers += count
        label = "soldier" if count == 1 else "soldiers"
        msg = f"Recruited {count} {label}."
        self.log.append(msg)
        return True, msg

    def dismiss(self, count: int) -> tuple[bool, str]:
        count = min(count, self.soldiers)
        if count <= 0:
            return False, "No soldiers to dismiss."
        self.soldiers -= count
        label = "soldier" if count == 1 else "soldiers"
        msg = f"Dismissed {count} {label}."
        self.log.append(msg)
        return True, msg

    def per_turn_totals(self) -> tuple[dict, int, int]:
        """Return (net resource changes, morale delta, prestige delta) for one turn."""
        food_prod = 0
        wood_prod = 0
        stone_prod = 0
        gold_prod = 0
        morale_delta = 0
        prestige_delta = 0
        gold_upkeep = self.soldiers  # 1 gold/soldier/turn

        for bid in self.buildings:
            b = BUILDINGS[bid]
            food_prod += b.get("production", {}).get("food", 0)
            wood_prod += b.get("production", {}).get("wood", 0)
            stone_prod += b.get("production", {}).get("stone", 0)
            gold_prod += b.get("production", {}).get("gold", 0)
            gold_upkeep += b.get("upkeep", 0)
            morale_delta += b.get("morale_per_turn", 0)
            prestige_delta += b.get("prestige_per_turn", 0)

        food_consumed = self.population + self.soldiers * 2

        # Season modifiers apply to production only, not consumption
        season = self.season
        if season == "Winter":
            food_prod = int(food_prod * 0.5)
            morale_delta -= 5
        elif season == "Summer":
            food_prod += 10
            morale_delta += 3
        elif season == "Spring":
            morale_delta += 5
        elif season == "Autumn":
            wood_prod += 8

        morale_delta -= 2  # natural decay without investment

        net = {
            "food": food_prod - food_consumed,
            "wood": wood_prod,
            "stone": stone_prod,
            "gold": gold_prod - gold_upkeep,
        }
        return net, morale_delta, prestige_delta

    def advance_turn(self) -> dict | None:
        if self.game_over:
            return None

        net, morale_delta, prestige_delta = self.per_turn_totals()

        for r, v in net.items():
            self.resources[r] = self.resources.get(r, 0) + v

        if self.resources["food"] < 0:
            self.resources["food"] = 0
            self.starvation_turns += 1
            morale_delta -= 15
            self.log.append("Your people are starving!")
        else:
            self.starvation_turns = 0

        for r in ["gold", "wood", "stone"]:
            self.resources[r] = max(0, self.resources[r])

        # Population growth when well-fed and happy
        if self.resources["food"] > 50 and self.morale >= 50 and self.starvation_turns == 0:
            growth = max(1, int(self.population * 0.04))
            self.population += growth

        self.morale = max(0, min(100, self.morale + morale_delta))

        if self.morale >= 70:
            prestige_delta += 1
        self.prestige = max(0, self.prestige + prestige_delta)

        event = self._random_event()

        self.season_idx = (self.season_idx + 1) % 4
        if self.season_idx == 0:
            self.year += 1

        if self.prestige >= WIN_PRESTIGE:
            self.game_over = True
            self.victory = True
            self.log.append("Your kingdom has achieved legendary greatness!")
        elif self.starvation_turns >= 3:
            self.game_over = True
            self.victory = False
            self.log.append("Your people have starved. The kingdom falls.")
        elif self.population <= 0:
            self.game_over = True
            self.victory = False
            self.log.append("All your people have perished.")

        return event

    def _random_event(self) -> dict | None:
        if random.random() > 0.35:
            return None

        weights = [e["weight"] for e in EVENTS]
        total = sum(weights)
        pick = random.uniform(0, total)
        cumulative = 0
        chosen = None
        for ev, w in zip(EVENTS, weights):
            cumulative += w
            if pick <= cumulative:
                chosen = ev
                break

        if not chosen:
            return None

        self.log.append(f"[Event] {chosen['name']}: {chosen.get('message', '')}")

        if chosen["id"] == "bandit_raid":
            defense_score = self.defense + self.soldiers * 3 + self.attack_bonus
            if defense_score >= 25:
                effects = chosen.get("defended", {})
                self.log.append(chosen.get("defended_message", ""))
            else:
                effects = chosen.get("undefended", {})
                self.log.append(chosen.get("undefended_message", ""))
        else:
            resource_keys = {"gold", "food", "wood", "stone", "population", "morale", "prestige"}
            effects = {k: v for k, v in chosen.items() if k in resource_keys}

        self._apply_effects(effects)
        return chosen

    def _apply_effects(self, effects: dict):
        for key, val in effects.items():
            if key == "population":
                self.population = max(0, self.population + val)
            elif key == "morale":
                self.morale = max(0, min(100, self.morale + val))
            elif key == "prestige":
                self.prestige = max(0, self.prestige + val)
            elif key in self.resources:
                self.resources[key] = max(0, self.resources[key] + val)
