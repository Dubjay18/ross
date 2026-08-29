"""Test fixtures for the agent.

These are hand-built Script objects with planted continuity errors so we can
verify continuity reasoning without needing the full API parser online.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models import Character, Line, LineType, Scene, Script


def make_planted_injury_script() -> Script:
    """Two-scene script with a planted injury-side continuity error.

    Scene 1 establishes Sarah's broken right arm in a cast.
    Scene 2 has her catch a thrown keys with her right hand with no explanation.
    """
    now = datetime.now(timezone.utc).isoformat()

    char_sarah = Character(
        id="char-sarah",
        script_id="script-test",
        name="SARAH",
        aliases=[],
    )

    scene1 = Scene(
        id="scene-1",
        script_id="script-test",
        number=1,
        heading="INT. HOSPITAL ROOM - DAY",
        location="HOSPITAL ROOM",
        time_of_day="INT",
        character_ids=["char-sarah"],
        lines=[
            Line(
                id="line-1-1",
                scene_id="scene-1",
                type=LineType.action,
                text="SARAH sits on the bed, her right arm in a thick plaster cast.",
                scene_heading="INT. HOSPITAL ROOM - DAY",
            ),
            Line(
                id="line-1-2",
                scene_id="scene-1",
                type=LineType.dialogue,
                character_id="char-sarah",
                text="The doctor says it will be six weeks before I can use this arm again.",
                scene_heading="INT. HOSPITAL ROOM - DAY",
            ),
        ],
    )

    scene2 = Scene(
        id="scene-2",
        script_id="script-test",
        number=2,
        heading="EXT. PARKING LOT - DAY",
        location="PARKING LOT",
        time_of_day="EXT",
        character_ids=["char-sarah"],
        lines=[
            Line(
                id="line-2-1",
                scene_id="scene-2",
                type=LineType.action,
                text="MIKE tosses his car keys across the roof of the car.",
                scene_heading="EXT. PARKING LOT - DAY",
            ),
            Line(
                id="line-2-2",
                scene_id="scene-2",
                type=LineType.action,
                text="SARAH snatches them out of the air with her right hand and unlocks the door.",
                scene_heading="EXT. PARKING LOT - DAY",
            ),
        ],
    )

    return Script(
        id="script-test",
        title="Injury Continuity Test",
        raw_text="",
        format="fountain",
        characters=[char_sarah],
        scenes=[scene1, scene2],
        uploaded_at=now,
        updated_at=now,
    )


def make_planted_prop_script() -> Script:
    """Two-scene script with a planted prop continuity error.

    Scene 1: Mike is empty-handed.
    Scene 2: Mike pulls a gun that was never introduced.
    """
    now = datetime.now(timezone.utc).isoformat()

    char_mike = Character(
        id="char-mike",
        script_id="script-prop-test",
        name="MIKE",
        aliases=[],
    )

    scene1 = Scene(
        id="scene-prop-1",
        script_id="script-prop-test",
        number=1,
        heading="INT. APARTMENT - NIGHT",
        location="APARTMENT",
        time_of_day="INT",
        character_ids=["char-mike"],
        lines=[
            Line(
                id="line-prop-1-1",
                scene_id="scene-prop-1",
                type=LineType.action,
                text="MIKE paces the room, hands in his pockets, clearly unarmed.",
                scene_heading="INT. APARTMENT - NIGHT",
            ),
        ],
    )

    scene2 = Scene(
        id="scene-prop-2",
        script_id="script-prop-test",
        number=2,
        heading="EXT. ALLEY - NIGHT",
        location="ALLEY",
        time_of_day="EXT",
        character_ids=["char-mike"],
        lines=[
            Line(
                id="line-prop-2-1",
                scene_id="scene-prop-2",
                type=LineType.action,
                text="MIKE draws a pistol from his waistband and fires.",
                scene_heading="EXT. ALLEY - NIGHT",
            ),
        ],
    )

    return Script(
        id="script-prop-test",
        title="Prop Continuity Test",
        raw_text="",
        format="fountain",
        characters=[char_mike],
        scenes=[scene1, scene2],
        uploaded_at=now,
        updated_at=now,
    )