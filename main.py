import os
import sys
from collections import Counter
from game.kingdom import Kingdom
from game.constants import BUILDINGS, WIN_PRESTIGE

W = 65


def clear():
    os.system("cls" if os.name == "nt" else "clear")


def line(char="─", w=W):
    return char * w


def fill_bar(value, max_val, width=22):
    filled = int((min(value, max_val) / max(max_val, 1)) * width)
    return "█" * filled + "░" * (width - filled)


def render_header(k: Kingdom) -> str:
    season_mark = {"Spring": "~*~", "Summer": "-o-", "Autumn": "~o~", "Winter": "-+-"}
    mark = season_mark.get(k.season, "   ")
    rows = [
        line("═"),
        f"  {k.name}   {mark}  Year {k.year}, {k.season}  {mark}   Prestige: {k.prestige}/{WIN_PRESTIGE}",
        line("─"),
        f"  Gold: {k.resources['gold']:>5}   Food: {k.resources['food']:>5}   "
        f"Wood: {k.resources['wood']:>5}   Stone: {k.resources['stone']:>5}",
        f"  Pop:  {k.population:>5}   Soldiers: {k.soldiers}/{k.soldier_capacity}   "
        f"Defense: {k.defense}   Morale: {k.morale}%",
        f"  Progress  [{fill_bar(k.prestige, WIN_PRESTIGE)}]  {k.prestige}/{WIN_PRESTIGE}",
        line("═"),
    ]
    return "\n".join(rows)


def render_buildings(k: Kingdom) -> str:
    if not k.buildings:
        return "  (none built yet)"
    counts = Counter(k.buildings)
    parts = [f"{BUILDINGS[b]['name']}" + (f" x{n}" if n > 1 else "") for b, n in counts.items()]
    return "  " + "  |  ".join(parts)


def render_log(k: Kingdom, n: int = 5) -> str:
    if not k.log:
        return "  (all is quiet...)"
    return "\n".join(f"  > {entry}" for entry in k.log[-n:])


def render_forecast(k: Kingdom) -> str:
    net, morale_d, prestige_d = k.per_turn_totals()
    res_parts = [
        f"Gold {'+' if net['gold'] >= 0 else ''}{net['gold']}",
        f"Food {'+' if net['food'] >= 0 else ''}{net['food']}",
        f"Wood {'+' if net['wood'] >= 0 else ''}{net['wood']}",
        f"Stone {'+' if net['stone'] >= 0 else ''}{net['stone']}",
    ]
    morale_s = f"{'+' if morale_d >= 0 else ''}{morale_d}"
    prestige_s = f"{'+' if prestige_d >= 0 else ''}{prestige_d}"
    return (
        "  Forecast: " + "  ".join(res_parts)
        + f"  Morale {morale_s}  Prestige {prestige_s}"
    )


# ── Screens ────────────────────────────────────────────────────────────────────

def screen_main(k: Kingdom):
    clear()
    print(render_header(k))
    print()
    print("  BUILDINGS:")
    print(render_buildings(k))
    print()
    print("  RECENT LOG:")
    print(render_log(k))
    print()
    print(render_forecast(k))
    print()
    print(line("─"))
    print("  [1] Build Structure    [2] Recruit Soldiers    [3] Dismiss Soldiers")
    print("  [4] End Turn           [5] View All Buildings  [0] Quit")
    print(line("─"))


def screen_build(k: Kingdom):
    while True:
        clear()
        print(render_header(k))
        print()
        print("  BUILD A STRUCTURE")
        print(line("─"))
        items = list(BUILDINGS.items())
        for i, (bid, b) in enumerate(items, 1):
            ok, reason = k.can_build(bid)
            cost_parts = [f"{v} {r}" for r, v in b["cost"].items() if v > 0]
            cost_str = ", ".join(cost_parts) if cost_parts else "free"
            prod_parts = [f"+{v} {r}/turn" for r, v in b.get("production", {}).items()]
            prod_str = ("  |  " + ", ".join(prod_parts)) if prod_parts else ""
            lock_str = "" if ok else f"   [LOCKED: {reason}]"
            marker = " " if ok else "~"
            print(f"  [{i}] {marker} {b['name']:<18}  Cost: {cost_str}{prod_str}")
            print(f"         {b['description']}{lock_str}")
        print()
        print("  [0] Back")
        print(line("─"))
        choice = input("  Build which? ").strip()
        if not choice or choice == "0":
            return
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(items):
                bid, _ = items[idx]
                ok, msg = k.build(bid)
                tag = "OK" if ok else "ERROR"
                input(f"\n  {tag}: {msg}   (Press Enter)")
            else:
                input("  Invalid choice. (Press Enter)")
        except ValueError:
            input("  Invalid input. (Press Enter)")


def screen_recruit(k: Kingdom):
    clear()
    print(render_header(k))
    print()
    slots = k.soldier_capacity - k.soldiers
    print("  RECRUIT SOLDIERS")
    if k.soldier_capacity == 0:
        print("  You have no Barracks. Build one first!")
        input("  (Press Enter)")
        return
    print(f"  Available slots: {slots}   Cost: 10 gold + 5 food each")
    print(f"  Upkeep: 1 gold + 2 food per soldier per turn")
    if slots == 0:
        print("  All slots are filled. Build more Barracks for more soldiers.")
        input("  (Press Enter)")
        return
    print()
    try:
        raw = input(f"  How many to recruit (0 to cancel, max {slots}): ").strip()
        n = int(raw)
        if n > 0:
            ok, msg = k.recruit(n)
            tag = "OK" if ok else "ERROR"
            input(f"\n  {tag}: {msg}   (Press Enter)")
    except ValueError:
        input("  Invalid input. (Press Enter)")


def screen_dismiss(k: Kingdom):
    if k.soldiers == 0:
        input("  You have no soldiers to dismiss. (Press Enter)")
        return
    clear()
    print(render_header(k))
    print(f"\n  DISMISS SOLDIERS   (current: {k.soldiers})")
    try:
        raw = input("  How many to dismiss (0 to cancel): ").strip()
        n = int(raw)
        if n > 0:
            ok, msg = k.dismiss(n)
            input(f"\n  {msg}   (Press Enter)")
    except ValueError:
        input("  Invalid input. (Press Enter)")


def screen_all_buildings(k: Kingdom):
    clear()
    print(line("═"))
    print("  ALL BUILDINGS REFERENCE")
    print(line("─"))
    for bid, b in BUILDINGS.items():
        owned = k.building_count(bid)
        cost_parts = [f"{v} {r}" for r, v in b["cost"].items() if v > 0]
        print(f"  {b['name']}" + (f"  [owned: {owned}]" if owned else ""))
        print(f"    Cost:  {', '.join(cost_parts)}")
        print(f"    Desc:  {b['description']}")
        if b.get("requires"):
            print(f"    Needs: {BUILDINGS[b['requires']]['name']}")
        print()
    input("  (Press Enter to go back)")


def screen_end_of_turn(k: Kingdom, event: dict | None):
    clear()
    print(line("═"))
    prev_season_idx = (k.season_idx - 1) % 4
    from game.constants import SEASONS
    prev_season = SEASONS[prev_season_idx]
    prev_year = k.year if k.season_idx != 0 else k.year - 1
    print(f"  END OF TURN -- Year {prev_year}, {prev_season}")
    print(line("─"))
    if event:
        print(f"  EVENT: {event['name']}")
    else:
        print("  No special events this season.")
    print()
    print("  Log:")
    print(render_log(k, 8))
    print(line("═"))
    input("\n  Press Enter to continue...")


def screen_game_over(k: Kingdom):
    clear()
    print(line("═"))
    if k.victory:
        title = "*** VICTORY ***"
        subtitle = f"The Kingdom of {k.name} stands as a legend!"
    else:
        title = "*** DEFEAT ***"
        subtitle = f"The Kingdom of {k.name} has fallen into ruin."
    pad = (W - len(title)) // 2
    print(" " * pad + title)
    pad2 = (W - len(subtitle)) // 2
    print(" " * pad2 + subtitle)
    print()
    print(f"  Final Year: {k.year}   Prestige: {k.prestige}/{WIN_PRESTIGE}")
    print(f"  Population: {k.population}   Buildings: {len(k.buildings)}")
    print(f"  Soldiers: {k.soldiers}   Morale: {k.morale}%")
    if k.log:
        print()
        print(f"  {k.log[-1]}")
    print(line("═"))
    input("\n  Press Enter to exit.")


def intro() -> str:
    clear()
    print(line("═"))
    pad = (W - len("GAME OF G")) // 2
    print(" " * pad + "GAME OF G")
    pad2 = (W - len("Medieval Kingdom Builder")) // 2
    print(" " * pad2 + "Medieval Kingdom Builder")
    print(line("─"))
    print()
    print("  Build farms, recruit soldiers, and earn prestige")
    print(f"  to reach {WIN_PRESTIGE} prestige before your kingdom falls!")
    print()
    print("  Resources:  Gold  Food  Wood  Stone")
    print("  Tip: Build a Farm immediately — your people need food!")
    print()
    print(line("─"))
    name = input("  Name your kingdom: ").strip() or "Valoria"
    print()
    input(f"  Welcome, ruler of {name}! Your reign begins. (Press Enter)")
    return name


def run():
    name = intro()
    k = Kingdom(name)
    while not k.game_over:
        screen_main(k)
        choice = input("  Your command: ").strip()
        if choice == "1":
            screen_build(k)
        elif choice == "2":
            screen_recruit(k)
        elif choice == "3":
            screen_dismiss(k)
        elif choice == "4":
            event = k.advance_turn()
            screen_end_of_turn(k, event)
        elif choice == "5":
            screen_all_buildings(k)
        elif choice == "0":
            confirm = input("  Abandon your kingdom? (y/n): ").strip().lower()
            if confirm == "y":
                print("\n  Your people will remember you... perhaps.")
                sys.exit(0)
    screen_game_over(k)


if __name__ == "__main__":
    run()
