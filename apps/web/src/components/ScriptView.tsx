import type { Script } from "@ross/shared";

interface ScriptViewProps {
  script: Script;
  highlightedSceneIds: Set<string>;
}

export function ScriptView({ script, highlightedSceneIds }: ScriptViewProps) {
  const characterNameById = new Map(script.characters.map((c) => [c.id, c.name]));
  let lastCharacterId: string | null = null;

  return (
    <section className="card script-view">
      <h2>
        {script.title} <span className="muted mono">· {script.format}</span>
      </h2>
      <div className="scene-list">
        {script.scenes.map((scene) => {
          lastCharacterId = null;
          return (
            <div
              key={scene.id}
              id={`scene-${scene.id}`}
              className={`scene${highlightedSceneIds.has(scene.id) ? " scene-highlight" : ""}`}
            >
              <p className="scene-heading">
                {scene.number}. {scene.heading}
              </p>
              {scene.lines.map((line) => {
                const showSpeaker =
                  line.type === "dialogue" && line.characterId !== lastCharacterId;
                lastCharacterId = line.type === "dialogue" ? line.characterId : null;
                return (
                  <div key={line.id}>
                    {showSpeaker && line.characterId && (
                      <p className="line-character">
                        {characterNameById.get(line.characterId) ?? "UNKNOWN"}
                      </p>
                    )}
                    <p className={`line line-${line.type}`}>{line.text}</p>
                  </div>
                );
              })}
            </div>
          );
        })}
        {script.scenes.length === 0 && <p className="muted">No scenes parsed from this script.</p>}
      </div>
    </section>
  );
}
