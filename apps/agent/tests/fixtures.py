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


def make_planted_timeline_script() -> Script:
    """Two-scene script with a planted timeline continuity error.

    Scene 1: 11:58 PM at an apartment across town, established as NIGHT.
    Scene 2: Seconds later per the action line, DAY at a downtown rooftop —
    an impossible jump in both time-of-day and travel time.
    """
    now = datetime.now(timezone.utc).isoformat()

    char_jane = Character(
        id="char-jane",
        script_id="script-timeline-test",
        name="JANE",
        aliases=[],
    )

    scene1 = Scene(
        id="scene-timeline-1",
        script_id="script-timeline-test",
        number=1,
        heading="INT. JANE'S APARTMENT - NIGHT",
        location="JANE'S APARTMENT",
        time_of_day="NIGHT",
        character_ids=["char-jane"],
        lines=[
            Line(
                id="line-timeline-1-1",
                scene_id="scene-timeline-1",
                type=LineType.action,
                text="A wall clock reads 11:58 PM. JANE grabs her coat and bolts out the door.",
                scene_heading="INT. JANE'S APARTMENT - NIGHT",
            ),
        ],
    )

    scene2 = Scene(
        id="scene-timeline-2",
        script_id="script-timeline-test",
        number=2,
        heading="EXT. DOWNTOWN ROOFTOP - DAY",
        location="DOWNTOWN ROOFTOP",
        time_of_day="DAY",
        character_ids=["char-jane"],
        lines=[
            Line(
                id="line-timeline-2-1",
                scene_id="scene-timeline-2",
                type=LineType.action,
                text="Moments later, JANE steps onto the rooftop downtown, sunlight blazing overhead.",
                scene_heading="EXT. DOWNTOWN ROOFTOP - DAY",
            ),
        ],
    )

    return Script(
        id="script-timeline-test",
        title="Timeline Continuity Test",
        raw_text="",
        format="fountain",
        characters=[char_jane],
        scenes=[scene1, scene2],
        uploaded_at=now,
        updated_at=now,
    )


def make_planted_geography_script() -> Script:
    """Three-scene script with a planted geography continuity error.

    Scene 1 establishes the house has no basement. Scene 3 has a character
    go down into the house's basement with no explanation (renovation,
    different house, etc).
    """
    now = datetime.now(timezone.utc).isoformat()

    char_tom = Character(
        id="char-tom",
        script_id="script-geo-test",
        name="TOM",
        aliases=[],
    )

    scene1 = Scene(
        id="scene-geo-1",
        script_id="script-geo-test",
        number=1,
        heading="INT. FAMILY HOUSE - KITCHEN - DAY",
        location="FAMILY HOUSE",
        time_of_day="DAY",
        character_ids=["char-tom"],
        lines=[
            Line(
                id="line-geo-1-1",
                scene_id="scene-geo-1",
                type=LineType.dialogue,
                character_id="char-tom",
                text="This house doesn't even have a basement, we built the shed for storage instead.",
                scene_heading="INT. FAMILY HOUSE - KITCHEN - DAY",
            ),
        ],
    )

    scene2 = Scene(
        id="scene-geo-2",
        script_id="script-geo-test",
        number=2,
        heading="EXT. FAMILY HOUSE - BACKYARD - DAY",
        location="FAMILY HOUSE",
        time_of_day="DAY",
        character_ids=["char-tom"],
        lines=[
            Line(
                id="line-geo-2-1",
                scene_id="scene-geo-2",
                type=LineType.action,
                text="TOM crosses the yard toward the shed, keys jangling in his hand.",
                scene_heading="EXT. FAMILY HOUSE - BACKYARD - DAY",
            ),
        ],
    )

    scene3 = Scene(
        id="scene-geo-3",
        script_id="script-geo-test",
        number=3,
        heading="INT. FAMILY HOUSE - BASEMENT - NIGHT",
        location="FAMILY HOUSE",
        time_of_day="NIGHT",
        character_ids=["char-tom"],
        lines=[
            Line(
                id="line-geo-3-1",
                scene_id="scene-geo-3",
                type=LineType.action,
                text="TOM descends the creaking stairs into the house's basement and pulls the light cord.",
                scene_heading="INT. FAMILY HOUSE - BASEMENT - NIGHT",
            ),
        ],
    )

    return Script(
        id="script-geo-test",
        title="Geography Continuity Test",
        raw_text="",
        format="fountain",
        characters=[char_tom],
        scenes=[scene1, scene2, scene3],
        uploaded_at=now,
        updated_at=now,
    )


def make_planted_character_knowledge_script() -> Script:
    """Two-scene script with a planted character-knowledge continuity error.

    Scene 1: ANNA and BEN discuss a secret affair with no one else present.
    Scene 2: CARL, who was never told and never present, confronts ANNA about
    the affair by name — information he has no in-story way of knowing yet.
    """
    now = datetime.now(timezone.utc).isoformat()

    char_anna = Character(
        id="char-anna",
        script_id="script-knowledge-test",
        name="ANNA",
        aliases=[],
    )
    char_ben = Character(
        id="char-ben",
        script_id="script-knowledge-test",
        name="BEN",
        aliases=[],
    )
    char_carl = Character(
        id="char-carl",
        script_id="script-knowledge-test",
        name="CARL",
        aliases=[],
    )

    scene1 = Scene(
        id="scene-knowledge-1",
        script_id="script-knowledge-test",
        number=1,
        heading="INT. ANNA'S OFFICE - DAY",
        location="ANNA'S OFFICE",
        time_of_day="DAY",
        character_ids=["char-anna", "char-ben"],
        lines=[
            Line(
                id="line-knowledge-1-1",
                scene_id="scene-knowledge-1",
                type=LineType.action,
                text="ANNA locks the office door. She and BEN are alone.",
                scene_heading="INT. ANNA'S OFFICE - DAY",
            ),
            Line(
                id="line-knowledge-1-2",
                scene_id="scene-knowledge-1",
                type=LineType.dialogue,
                character_id="char-ben",
                text="No one can ever know about us. Not Carl, not anyone.",
                scene_heading="INT. ANNA'S OFFICE - DAY",
            ),
        ],
    )

    scene2 = Scene(
        id="scene-knowledge-2",
        script_id="script-knowledge-test",
        number=2,
        heading="INT. ANNA'S KITCHEN - NIGHT",
        location="ANNA'S KITCHEN",
        time_of_day="NIGHT",
        character_ids=["char-anna", "char-carl"],
        lines=[
            Line(
                id="line-knowledge-2-1",
                scene_id="scene-knowledge-2",
                type=LineType.dialogue,
                character_id="char-carl",
                text="I know about you and Ben. I know everything.",
                scene_heading="INT. ANNA'S KITCHEN - NIGHT",
            ),
        ],
    )

    return Script(
        id="script-knowledge-test",
        title="Character Knowledge Continuity Test",
        raw_text="",
        format="fountain",
        characters=[char_anna, char_ben, char_carl],
        scenes=[scene1, scene2],
        uploaded_at=now,
        updated_at=now,
    )


def make_clean_two_scene_script() -> Script:
    """Two ordinary, internally-consistent scenes with no planted error.

    Used to assert the agent doesn't over-flag when the script gives a clear
    on-page explanation for everything it shows.
    """
    now = datetime.now(timezone.utc).isoformat()

    char_lee = Character(
        id="char-lee",
        script_id="script-clean-test",
        name="LEE",
        aliases=[],
    )

    scene1 = Scene(
        id="scene-clean-1",
        script_id="script-clean-test",
        number=1,
        heading="INT. COFFEE SHOP - MORNING",
        location="COFFEE SHOP",
        time_of_day="MORNING",
        character_ids=["char-lee"],
        lines=[
            Line(
                id="line-clean-1-1",
                scene_id="scene-clean-1",
                type=LineType.action,
                text="LEE orders a black coffee and sits by the window with a paperback.",
                scene_heading="INT. COFFEE SHOP - MORNING",
            ),
            Line(
                id="line-clean-1-2",
                scene_id="scene-clean-1",
                type=LineType.dialogue,
                character_id="char-lee",
                text="I'll head to the office once I finish this chapter.",
                scene_heading="INT. COFFEE SHOP - MORNING",
            ),
        ],
    )

    scene2 = Scene(
        id="scene-clean-2",
        script_id="script-clean-test",
        number=2,
        heading="INT. OFFICE - LATER THAT MORNING",
        location="OFFICE",
        time_of_day="MORNING",
        character_ids=["char-lee"],
        lines=[
            Line(
                id="line-clean-2-1",
                scene_id="scene-clean-2",
                type=LineType.action,
                text="LEE sets the same paperback on the desk and opens a laptop.",
                scene_heading="INT. OFFICE - LATER THAT MORNING",
            ),
        ],
    )

    return Script(
        id="script-clean-test",
        title="Clean Script (No Planted Errors)",
        raw_text="",
        format="fountain",
        characters=[char_lee],
        scenes=[scene1, scene2],
        uploaded_at=now,
        updated_at=now,
    )