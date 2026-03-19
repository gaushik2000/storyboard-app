import { useState, useCallback, useRef, useEffect } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GENRES = ["Action","Drama","Comedy","Thriller","Horror","Sci-Fi","Fantasy","Romance","Documentary","Animation","Mystery","Adventure"];
const CAMERA_SHOTS = ["Extreme Wide Shot","Wide Shot","Medium Shot","Close-Up","Extreme Close-Up","Over the Shoulder","Point of View","Bird's Eye","Low Angle","Dutch Angle","Tracking Shot","Dolly Zoom"];
const MOODS = ["Tense","Melancholic","Joyful","Mysterious","Romantic","Suspenseful","Epic","Intimate","Chaotic","Peaceful","Ominous","Triumphant"];
const LIGHTING = ["Golden Hour","Blue Hour","High Key","Low Key","Chiaroscuro","Neon","Natural","Candlelight","Fluorescent","Backlit","Silhouette","Overcast"];

const SYSTEM_PROMPT = `You are a master film director and storyboard artist. Your task is to analyze the provided story/script and generate a comprehensive, professional storyboard.

Break the story into individual scenes. For EACH scene, return a JSON object with these exact fields:
- sceneNumber: integer
- sceneTitle: string (evocative, cinematic title)
- location: string
- timeOfDay: string
- duration: string (estimated screen time, e.g. "0:45")
- description: string (2-3 sentences, vivid visual description)
- visualComposition: string (detailed framing and composition notes)
- cameraAngle: string (specific shot type)
- cameraMovement: string (static, pan, tilt, dolly, handheld, etc.)
- charactersPresent: array of strings
- characterPositions: string (where each character stands/sits)
- dialogue: string (key lines, or "No dialogue" if none)
- emotion: string (primary emotional beat)
- mood: string (overall scene mood)
- lighting: string (detailed lighting description)
- colorPalette: string (dominant colors, e.g. "deep blues, amber highlights")
- soundscape: string (background sounds, music cue)
- actionBeat: string (the key action that drives the scene)
- transitionTo: string (how this scene transitions to the next)
- directorNotes: string (cinematic insights, references, tips)
- framePrompt: string (a detailed AI image generation prompt for this scene)

Return ONLY a valid JSON array of scene objects. No markdown, no explanation, just the JSON array.
Analyze CAREFULLY. Do not skip any important story moments. Every major beat deserves its own scene card.`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const callClaude = async (userMessage) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const text = data.content.map(b => b.text || "").join("\n");
  const clean = text.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(clean);
};

const moodColor = (mood) => {
  const map = { Tense:"#e74c3c", Melancholic:"#6c7ae0", Joyful:"#f1c40f", Mysterious:"#9b59b6", Romantic:"#e84393", Suspenseful:"#e67e22", Epic:"#c0392b", Intimate:"#27ae60", Chaotic:"#d35400", Peaceful:"#3498db", Ominous:"#2c3e50", Triumphant:"#f39c12" };
  return map[mood] || "#d4a017";
};

const exportJSON = (scenes, title) => {
  const blob = new Blob([JSON.stringify({ title, scenes }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${title || "storyboard"}.json`; a.click();
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function StoryboardApp() {
  const [scenes, setScenes] = useState([]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingScene, setEditingScene] = useState(null);
  const [activeTab, setActiveTab] = useState("input");
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [view, setView] = useState("board"); // board | timeline
  const [form, setForm] = useState({
    title: "", genre: "", characters: "", setting: "", timeOfDay: "",
    story: "", dialogue: "", cameraStyle: "", mood: "", lighting: "", specialNotes: ""
  });

  const handleGenerate = async () => {
    if (!form.story.trim()) { setError("Please enter your story or script."); return; }
    setLoading(true); setError(null); setScenes([]); setSelectedScene(null);
    const prompt = `
STORY TITLE: ${form.title || "Untitled"}
GENRE: ${form.genre || "Drama"}
CHARACTERS: ${form.characters || "Not specified"}
SETTING: ${form.setting || "Not specified"}
TIME OF DAY: ${form.timeOfDay || "Varies"}
PREFERRED CAMERA STYLE: ${form.cameraStyle || "Cinematic"}
MOOD/TONE: ${form.mood || "Dramatic"}
LIGHTING PREFERENCE: ${form.lighting || "Natural"}
SPECIAL NOTES: ${form.specialNotes || "None"}

STORY/SCRIPT:
${form.story}

ADDITIONAL DIALOGUE:
${form.dialogue || "See story above"}

Please generate a complete, detailed storyboard for this story. Break it into all necessary scenes. Be thorough and cinematic.`;
    try {
      const result = await callClaude(prompt);
      setScenes(result);
      setProjectTitle(form.title || "Untitled Storyboard");
      setActiveTab("board");
      if (result.length > 0) setSelectedScene(result[0]);
    } catch(e) {
      setError(`Generation failed: ${e.message}`);
    } finally { setLoading(false); }
  };

  const handleDragStart = (i) => setDragIdx(i);
  const handleDragOver = (e, i) => { e.preventDefault(); setDragOverIdx(i); };
  const handleDrop = (i) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOverIdx(null); return; }
    const arr = [...scenes];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(i, 0, moved);
    const renumbered = arr.map((s, idx) => ({ ...s, sceneNumber: idx + 1 }));
    setScenes(renumbered);
    setDragIdx(null); setDragOverIdx(null);
  };

  const handleEditSave = () => {
    setScenes(prev => prev.map(s => s.sceneNumber === editingScene.sceneNumber ? editingScene : s));
    if (selectedScene?.sceneNumber === editingScene.sceneNumber) setSelectedScene(editingScene);
    setEditingScene(null);
  };

  const handleDelete = (num) => {
    const filtered = scenes.filter(s => s.sceneNumber !== num).map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    setScenes(filtered);
    if (selectedScene?.sceneNumber === num) setSelectedScene(filtered[0] || null);
  };

  const handleAddScene = () => {
    const newScene = {
      sceneNumber: scenes.length + 1, sceneTitle: "New Scene", location: "TBD",
      timeOfDay: "Day", duration: "0:30", description: "Enter scene description...",
      visualComposition: "", cameraAngle: "Medium Shot", cameraMovement: "Static",
      charactersPresent: [], characterPositions: "", dialogue: "No dialogue",
      emotion: "Neutral", mood: "Peaceful", lighting: "Natural", colorPalette: "",
      soundscape: "", actionBeat: "", transitionTo: "Cut", directorNotes: "", framePrompt: ""
    };
    setScenes(prev => [...prev, newScene]);
    setSelectedScene(newScene);
    setEditingScene({ ...newScene });
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const ef = (k, v) => setEditingScene(p => ({ ...p, [k]: v }));

  return (
    <div style={styles.root}>
      <style>{globalStyles}</style>
      {/* ── HEADER ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <FilmIcon />
            <span style={styles.logoText}>FRAMEFORGE</span>
            <span style={styles.logoSub}>AI Storyboard Studio</span>
          </div>
        </div>
        <nav style={styles.nav}>
          {["input","board"].map(t => (
            <button key={t} style={{ ...styles.navBtn, ...(activeTab===t ? styles.navBtnActive : {}) }}
              onClick={() => setActiveTab(t)}>
              {t === "input" ? "✍ Story Input" : "🎬 Storyboard"}
            </button>
          ))}
        </nav>
        <div style={styles.headerRight}>
          {scenes.length > 0 && (
            <>
              <button style={styles.btnOutline} onClick={() => setView(v => v==="board"?"timeline":"board")}>
                {view === "board" ? "⟷ Timeline" : "⊞ Board"}
              </button>
              <button style={styles.btnGold} onClick={() => exportJSON(scenes, projectTitle)}>
                ↓ Export JSON
              </button>
            </>
          )}
        </div>
      </header>

      <div style={styles.body}>
        {/* ── LEFT PANEL (INPUT) ── */}
        {activeTab === "input" && (
          <div style={styles.inputPanel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Story Details</h2>
              <p style={styles.panelSub}>Fill in your story information for the AI to analyze</p>
            </div>
            <div style={styles.formScroll}>
              <FormField label="Story Title" value={form.title} onChange={v=>f("title",v)} placeholder="e.g. The Last Signal" />
              <FormSelect label="Genre" value={form.genre} options={GENRES} onChange={v=>f("genre",v)} />
              <FormField label="Characters" value={form.characters} onChange={v=>f("characters",v)}
                placeholder="e.g. Alex (30s, detective), Maya (20s, hacker)" multiline />
              <FormField label="Setting / Location" value={form.setting} onChange={v=>f("setting",v)}
                placeholder="e.g. Near-future Tokyo, underground bunker" />
              <FormField label="Time of Day" value={form.timeOfDay} onChange={v=>f("timeOfDay",v)}
                placeholder="e.g. Midnight, golden hour, overcast morning" />
              <FormSelect label="Camera Style" value={form.cameraStyle} options={CAMERA_SHOTS} onChange={v=>f("cameraStyle",v)} />
              <FormSelect label="Mood / Tone" value={form.mood} options={MOODS} onChange={v=>f("mood",v)} />
              <FormSelect label="Lighting Style" value={form.lighting} options={LIGHTING} onChange={v=>f("lighting",v)} />
              <div style={styles.divider} />
              <FormField label="Story / Script *" value={form.story} onChange={v=>f("story",v)}
                placeholder="Paste your full story, script, or scene description here…" multiline rows={10} required />
              <FormField label="Additional Dialogue" value={form.dialogue} onChange={v=>f("dialogue",v)}
                placeholder="Key dialogue lines or script excerpts…" multiline rows={4} />
              <FormField label="Special Notes" value={form.specialNotes} onChange={v=>f("specialNotes",v)}
                placeholder="Director's notes, references, visual inspirations…" multiline />
              {error && <div style={styles.error}>{error}</div>}
              <button style={{ ...styles.btnGold, width:"100%", fontSize:"16px", padding:"16px" }}
                onClick={handleGenerate} disabled={loading}>
                {loading ? <><Spinner /> Analyzing Story…</> : "⚡ Generate Storyboard"}
              </button>
            </div>
          </div>
        )}

        {/* ── CENTER: STORYBOARD ── */}
        {activeTab === "board" && (
          <div style={styles.boardPanel}>
            {scenes.length === 0 ? (
              <EmptyState onGo={() => setActiveTab("input")} loading={loading} />
            ) : (
              <>
                <div style={styles.boardHeader}>
                  <div>
                    <h2 style={styles.projectTitle}>{projectTitle}</h2>
                    <span style={styles.sceneCount}>{scenes.length} scenes generated</span>
                  </div>
                  <button style={styles.btnGhost} onClick={handleAddScene}>＋ Add Scene</button>
                </div>
                {view === "board" ? (
                  <div style={styles.boardGrid}>
                    {scenes.map((scene, i) => (
                      <SceneCard key={scene.sceneNumber} scene={scene} isSelected={selectedScene?.sceneNumber === scene.sceneNumber}
                        isDragOver={dragOverIdx === i}
                        onClick={() => { setSelectedScene(scene); setEditingScene(null); }}
                        onEdit={() => { setSelectedScene(scene); setEditingScene({ ...scene }); }}
                        onDelete={() => handleDelete(scene.sceneNumber)}
                        draggable onDragStart={() => handleDragStart(i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDrop={() => handleDrop(i)} />
                    ))}
                  </div>
                ) : (
                  <TimelineView scenes={scenes} selectedScene={selectedScene}
                    onSelect={(s) => { setSelectedScene(s); setEditingScene(null); }} />
                )}
              </>
            )}
          </div>
        )}

        {/* ── RIGHT PANEL (DETAIL / EDITOR) ── */}
        {activeTab === "board" && scenes.length > 0 && (
          <div style={styles.detailPanel}>
            {editingScene ? (
              <EditPanel scene={editingScene} onChange={ef} onSave={handleEditSave}
                onCancel={() => setEditingScene(null)} />
            ) : selectedScene ? (
              <DetailPanel scene={selectedScene} onEdit={() => setEditingScene({ ...selectedScene })}
                onDelete={() => handleDelete(selectedScene.sceneNumber)} />
            ) : (
              <div style={styles.detailEmpty}>
                <span style={{ fontSize:"48px" }}>🎬</span>
                <p style={{ color:"#8a7a5a", marginTop:"12px" }}>Select a scene to view details</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SCENE CARD ───────────────────────────────────────────────────────────────
function SceneCard({ scene, isSelected, isDragOver, onClick, onEdit, onDelete, ...drag }) {
  return (
    <div style={{ ...styles.sceneCard, ...(isSelected ? styles.sceneCardSelected : {}), ...(isDragOver ? styles.sceneCardDragOver : {}) }}
      onClick={onClick} {...drag}>
      <div style={styles.sceneCardHeader}>
        <span style={styles.sceneNum}>#{scene.sceneNumber}</span>
        <div style={styles.sceneCardActions} onClick={e => e.stopPropagation()}>
          <button style={styles.iconBtn} title="Edit" onClick={onEdit}>✎</button>
          <button style={{ ...styles.iconBtn, color:"#e74c3c" }} title="Delete" onClick={onDelete}>✕</button>
        </div>
      </div>
      <div style={styles.sceneFrame}>
        <div style={styles.sceneFrameInner}>
          <div style={styles.frameCross} />
          <div style={styles.frameCorners}>
            <span/><span/><span/><span/>
          </div>
          <p style={styles.frameDesc}>{scene.description?.substring(0, 90)}…</p>
          <div style={styles.frameBadge}>{scene.cameraAngle}</div>
        </div>
      </div>
      <div style={styles.sceneCardBody}>
        <h4 style={styles.sceneTitle}>{scene.sceneTitle}</h4>
        <div style={styles.sceneMeta}>
          <span style={{ ...styles.moodDot, background: moodColor(scene.mood) }} />
          <span style={styles.sceneMetaText}>{scene.mood}</span>
          <span style={styles.sceneMetaDivider}>·</span>
          <span style={styles.sceneMetaText}>⏱ {scene.duration}</span>
        </div>
        <div style={styles.sceneLocation}>📍 {scene.location} · {scene.timeOfDay}</div>
        {scene.dialogue && scene.dialogue !== "No dialogue" && (
          <div style={styles.sceneDialogue}>💬 "{scene.dialogue.substring(0,60)}{scene.dialogue.length>60?"…":""}"</div>
        )}
      </div>
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
function DetailPanel({ scene, onEdit, onDelete }) {
  const sections = [
    { icon:"🎥", label:"Camera", value:`${scene.cameraAngle} · ${scene.cameraMovement}` },
    { icon:"💡", label:"Lighting", value:scene.lighting },
    { icon:"🎨", label:"Color Palette", value:scene.colorPalette },
    { icon:"🎭", label:"Emotion", value:scene.emotion },
    { icon:"🌅", label:"Time of Day", value:scene.timeOfDay },
    { icon:"🔊", label:"Soundscape", value:scene.soundscape },
    { icon:"➡", label:"Transition", value:scene.transitionTo },
  ];
  return (
    <div style={styles.detailScroll}>
      <div style={styles.detailHeader}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={styles.detailSceneNum}>#{scene.sceneNumber}</span>
          <div>
            <h3 style={styles.detailTitle}>{scene.sceneTitle}</h3>
            <span style={styles.detailLocation}>📍 {scene.location}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <button style={styles.btnOutline} onClick={onEdit}>✎ Edit</button>
          <button style={{ ...styles.btnOutline, borderColor:"#e74c3c", color:"#e74c3c" }} onClick={onDelete}>✕</button>
        </div>
      </div>

      <div style={styles.detailMoodBar}>
        <span style={{ ...styles.moodPill, background: moodColor(scene.mood) + "33", border:`1px solid ${moodColor(scene.mood)}66`, color: moodColor(scene.mood) }}>
          {scene.mood}
        </span>
        <span style={styles.detailDuration}>⏱ {scene.duration}</span>
      </div>

      <Section title="Scene Description">
        <p style={styles.detailText}>{scene.description}</p>
      </Section>
      <Section title="Visual Composition">
        <p style={styles.detailText}>{scene.visualComposition}</p>
      </Section>
      {scene.charactersPresent?.length > 0 && (
        <Section title="Characters Present">
          <div style={styles.charList}>{scene.charactersPresent.map(c => <span key={c} style={styles.charTag}>{c}</span>)}</div>
          <p style={styles.detailTextSm}>{scene.characterPositions}</p>
        </Section>
      )}
      {scene.dialogue && scene.dialogue !== "No dialogue" && (
        <Section title="Dialogue">
          <div style={styles.dialogueBox}>"{scene.dialogue}"</div>
        </Section>
      )}
      <Section title="Scene Details">
        <div style={styles.detailGrid}>
          {sections.map(s => (
            <div key={s.label} style={styles.detailGridItem}>
              <span style={styles.detailGridIcon}>{s.icon}</span>
              <div><div style={styles.detailGridLabel}>{s.label}</div><div style={styles.detailGridValue}>{s.value}</div></div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Action Beat">
        <p style={styles.detailText}>{scene.actionBeat}</p>
      </Section>
      {scene.directorNotes && (
        <Section title="Director's Notes">
          <div style={styles.notesBox}>{scene.directorNotes}</div>
        </Section>
      )}
      {scene.framePrompt && (
        <Section title="AI Image Prompt">
          <div style={styles.promptBox}>{scene.framePrompt}</div>
        </Section>
      )}
    </div>
  );
}

// ─── EDIT PANEL ───────────────────────────────────────────────────────────────
function EditPanel({ scene, onChange, onSave, onCancel }) {
  return (
    <div style={styles.detailScroll}>
      <div style={{ ...styles.detailHeader, marginBottom:"16px" }}>
        <h3 style={styles.detailTitle}>✎ Edit Scene #{scene.sceneNumber}</h3>
        <div style={{ display:"flex", gap:"8px" }}>
          <button style={styles.btnGhost} onClick={onCancel}>Cancel</button>
          <button style={styles.btnGold} onClick={onSave}>Save</button>
        </div>
      </div>
      <FormField label="Scene Title" value={scene.sceneTitle} onChange={v=>onChange("sceneTitle",v)
export default function StoryboardApp() { ... }
