import { useState } from "react";

const GENRES = ["Action","Drama","Comedy","Thriller","Horror","Sci-Fi","Fantasy","Romance","Documentary","Animation","Mystery","Adventure"];
const CAMERA_SHOTS = ["Extreme Wide Shot","Wide Shot","Medium Shot","Close-Up","Extreme Close-Up","Over the Shoulder","Point of View","Bird's Eye","Low Angle","Dutch Angle","Tracking Shot","Dolly Zoom"];
const MOODS = ["Tense","Melancholic","Joyful","Mysterious","Romantic","Suspenseful","Epic","Intimate","Chaotic","Peaceful","Ominous","Triumphant"];
const LIGHTING = ["Golden Hour","Blue Hour","High Key","Low Key","Chiaroscuro","Neon","Natural","Candlelight","Fluorescent","Backlit","Silhouette","Overcast"];

const SYSTEM_PROMPT = `You are a master film director and storyboard artist. Analyze the provided story and generate a comprehensive professional storyboard.

Break the story into individual scenes. For EACH scene return a JSON object with these exact fields:
- sceneNumber: integer
- sceneTitle: string
- location: string
- timeOfDay: string
- duration: string (e.g. "0:45")
- description: string (2-3 sentences)
- visualComposition: string
- cameraAngle: string
- cameraMovement: string
- charactersPresent: array of strings
- characterPositions: string
- dialogue: string (or "No dialogue")
- emotion: string
- mood: string
- lighting: string
- colorPalette: string
- soundscape: string
- actionBeat: string
- transitionTo: string
- directorNotes: string
- framePrompt: string

Return ONLY a valid JSON array. No markdown, no explanation. Analyze carefully and do not skip any important story moments.`;

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
  const map = {
    Tense:"#e74c3c", Melancholic:"#6c7ae0", Joyful:"#f1c40f",
    Mysterious:"#9b59b6", Romantic:"#e84393", Suspenseful:"#e67e22",
    Epic:"#c0392b", Intimate:"#27ae60", Chaotic:"#d35400",
    Peaceful:"#3498db", Ominous:"#2c3e50", Triumphant:"#f39c12"
  };
  return map[mood] || "#d4a017";
};

const exportJSON = (scenes, title) => {
  const blob = new Blob([JSON.stringify({ title, scenes }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title || "storyboard"}.json`;
  a.click();
};

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
  const [view, setView] = useState("board");
  const [form, setForm] = useState({
    title: "", genre: "", characters: "", setting: "",
    timeOfDay: "", story: "", dialogue: "",
    cameraStyle: "", mood: "", lighting: "", specialNotes: ""
  });

  const handleGenerate = async () => {
    if (!form.story.trim()) { setError("Please enter your story or script."); return; }
    setLoading(true); setError(null); setScenes([]); setSelectedScene(null);
    const prompt = `STORY TITLE: ${form.title || "Untitled"}
GENRE: ${form.genre || "Drama"}
CHARACTERS: ${form.characters || "Not specified"}
SETTING: ${form.setting || "Not specified"}
TIME OF DAY: ${form.timeOfDay || "Varies"}
CAMERA STYLE: ${form.cameraStyle || "Cinematic"}
MOOD/TONE: ${form.mood || "Dramatic"}
LIGHTING: ${form.lighting || "Natural"}
SPECIAL NOTES: ${form.specialNotes || "None"}
STORY/SCRIPT:
${form.story}
DIALOGUE:
${form.dialogue || "See story above"}
Generate a complete detailed storyboard. Be thorough and cinematic.`;
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
      sceneNumber: scenes.length + 1, sceneTitle: "New Scene",
      location: "TBD", timeOfDay: "Day", duration: "0:30",
      description: "Enter scene description...", visualComposition: "",
      cameraAngle: "Medium Shot", cameraMovement: "Static",
      charactersPresent: [], characterPositions: "",
      dialogue: "No dialogue", emotion: "Neutral", mood: "Peaceful",
      lighting: "Natural", colorPalette: "", soundscape: "",
      actionBeat: "", transitionTo: "Cut", directorNotes: "", framePrompt: ""
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

      <header style={styles.header}>
        <div style={styles.logo}>
          <FilmIcon />
          <span style={styles.logoText}>FRAMEFORGE</span>
          <span style={styles.logoSub}>AI Storyboard Studio</span>
        </div>
        <nav style={styles.nav}>
          {["input", "board"].map(t => (
            <button key={t}
              style={{ ...styles.navBtn, ...(activeTab === t ? styles.navBtnActive : {}) }}
              onClick={() => setActiveTab(t)}>
              {t === "input" ? "Story Input" : "Storyboard"}
            </button>
          ))}
        </nav>
        <div style={styles.headerRight}>
          {scenes.length > 0 && (
            <>
              <button style={styles.btnOutline} onClick={() => setView(v => v === "board" ? "timeline" : "board")}>
                {view === "board" ? "Timeline" : "Board"}
              </button>
              <button style={styles.btnGold} onClick={() => exportJSON(scenes, projectTitle)}>
                Export JSON
              </button>
            </>
          )}
        </div>
      </header>

      <div style={styles.body}>
        {activeTab === "input" && (
          <div style={styles.inputPanel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Story Details</h2>
              <p style={styles.panelSub}>Fill in your story for the AI to analyze</p>
            </div>
            <div style={styles.formScroll}>
              <FormField label="Story Title" value={form.title} onChange={v => f("title", v)} placeholder="e.g. The Last Signal" />
              <FormSelect label="Genre" value={form.genre} options={GENRES} onChange={v => f("genre", v)} />
              <FormField label="Characters" value={form.characters} onChange={v => f("characters", v)} placeholder="e.g. Alex (30s, detective), Maya (20s, hacker)" multiline />
              <FormField label="Setting / Location" value={form.setting} onChange={v => f("setting", v)} placeholder="e.g. Near-future Tokyo" />
              <FormField label="Time of Day" value={form.timeOfDay} onChange={v => f("timeOfDay", v)} placeholder="e.g. Midnight, golden hour" />
              <FormSelect label="Camera Style" value={form.cameraStyle} options={CAMERA_SHOTS} onChange={v => f("cameraStyle", v)} />
              <FormSelect label="Mood / Tone" value={form.mood} options={MOODS} onChange={v => f("mood", v)} />
              <FormSelect label="Lighting Style" value={form.lighting} options={LIGHTING} onChange={v => f("lighting", v)} />
              <div style={styles.divider} />
              <FormField label="Story / Script *" value={form.story} onChange={v => f("story", v)}
                placeholder="Paste your full story or script here..." multiline rows={10} required />
              <FormField label="Additional Dialogue" value={form.dialogue} onChange={v => f("dialogue", v)}
                placeholder="Key dialogue lines..." multiline rows={4} />
              <FormField label="Special Notes" value={form.specialNotes} onChange={v => f("specialNotes", v)}
                placeholder="Director notes, references..." multiline />
              {error && <div style={styles.error}>{error}</div>}
              <button
                style={{ ...styles.btnGold, width: "100%", fontSize: "16px", padding: "16px" }}
                onClick={handleGenerate}
                disabled={loading}>
                {loading ? "Analyzing Story..." : "Generate Storyboard"}
              </button>
            </div>
          </div>
        )}

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
                  <button style={styles.btnGhost} onClick={handleAddScene}>+ Add Scene</button>
                </div>
                {view === "board" ? (
                  <div style={styles.boardGrid}>
                    {scenes.map((scene, i) => (
                      <SceneCard
                        key={scene.sceneNumber}
                        scene={scene}
                        isSelected={selectedScene?.sceneNumber === scene.sceneNumber}
                        isDragOver={dragOverIdx === i}
                        onClick={() => { setSelectedScene(scene); setEditingScene(null); }}
                        onEdit={() => { setSelectedScene(scene); setEditingScene({ ...scene }); }}
                        onDelete={() => handleDelete(scene.sceneNumber)}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDrop={() => handleDrop(i)}
                      />
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

        {activeTab === "board" && scenes.length > 0 && (
          <div style={styles.detailPanel}>
            {editingScene ? (
              <EditPanel scene={editingScene} onChange={ef}
                onSave={handleEditSave} onCancel={() => setEditingScene(null)} />
            ) : selectedScene ? (
              <DetailPanel scene={selectedScene}
                onEdit={() => setEditingScene({ ...selectedScene })}
                onDelete={() => handleDelete(selectedScene.sceneNumber)} />
            ) : (
              <div style={styles.detailEmpty}>
                <p style={{ color: "#8a7a5a" }}>Select a scene to view details</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SceneCard({ scene, isSelected, isDragOver, onClick, onEdit, onDelete, ...drag }) {
  return (
    <div
      style={{ ...styles.sceneCard, ...(isSelected ? styles.sceneCardSelected : {}), ...(isDragOver ? styles.sceneCardDragOver : {}) }}
      onClick={onClick} {...drag}>
      <div style={styles.sceneCardHeader}>
        <span style={styles.sceneNum}>#{scene.sceneNumber}</span>
        <div style={styles.sceneCardActions} onClick={e => e.stopPropagation()}>
          <button style={styles.iconBtn} onClick={onEdit}>Edit</button>
          <button style={{ ...styles.iconBtn, color: "#e74c3c" }} onClick={onDelete}>Delete</button>
        </div>
      </div>
      <div style={styles.sceneFrame}>
        <div style={styles.sceneFrameInner}>
          <p style={styles.frameDesc}>{scene.description?.substring(0, 90)}...</p>
          <div style={styles.frameBadge}>{scene.cameraAngle}</div>
        </div>
      </div>
      <div style={styles.sceneCardBody}>
        <h4 style={styles.sceneTitle}>{scene.sceneTitle}</h4>
        <div style={styles.sceneMeta}>
          <span style={{ ...styles.moodDot, background: moodColor(scene.mood) }} />
          <span style={styles.sceneMetaText}>{scene.mood}</span>
          <span style={styles.sceneMetaDivider}>·</span>
          <span style={styles.sceneMetaText}>{scene.duration}</span>
        </div>
        <div style={styles.sceneLocation}>{scene.location} · {scene.timeOfDay}</div>
        {scene.dialogue && scene.dialogue !== "No dialogue" && (
          <div style={styles.sceneDialogue}>"{scene.dialogue.substring(0, 60)}{scene.dialogue.length > 60 ? "..." : ""}"</div>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ scene, onEdit, onDelete }) {
  const details = [
    { label: "Camera", value: `${scene.cameraAngle} · ${scene.cameraMovement}` },
    { label: "Lighting", value: scene.lighting },
    { label: "Color Palette", value: scene.colorPalette },
    { label: "Emotion", value: scene.emotion },
    { label: "Time of Day", value: scene.timeOfDay },
    { label: "Soundscape", value: scene.soundscape },
    { label: "Transition", value: scene.transitionTo },
  ];
  return (
    <div style={styles.detailScroll}>
      <div style={styles.detailHeader}>
        <div>
          <span style={styles.detailSceneNum}>#{scene.sceneNumber}</span>
          <h3 style={styles.detailTitle}>{scene.sceneTitle}</h3>
          <span style={styles.detailLocation}>{scene.location}</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={styles.btnOutline} onClick={onEdit}>Edit</button>
          <button style={{ ...styles.btnOutline, borderColor: "#e74c3c", color: "#e74c3c" }} onClick={onDelete}>Delete</button>
        </div>
      </div>
      <div style={styles.detailMoodBar}>
        <span style={{ ...styles.moodPill, background: moodColor(scene.mood) + "33", border: `1px solid ${moodColor(scene.mood)}66`, color: moodColor(scene.mood) }}>
          {scene.mood}
        </span>
        <span style={styles.detailDuration}>{scene.duration}</span>
      </div>
      <Section title="Scene Description"><p style={styles.detailText}>{scene.description}</p></Section>
      <Section title="Visual Composition"><p style={styles.detailText}>{scene.visualComposition}</p></Section>
      {scene.charactersPresent?.length > 0 && (
        <Section title="Characters Present">
          <div style={styles.charList}>
            {scene.charactersPresent.map(c => <span key={c} style={styles.charTag}>{c}</span>)}
          </div>
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
          {details.map(d => (
            <div key={d.label} style={styles.detailGridItem}>
              <div>
                <div style={styles.detailGridLabel}>{d.label}</div>
                <div style={styles.detailGridValue}>{d.value}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Action Beat"><p style={styles.detailText}>{scene.actionBeat}</p></Section>
      {scene.directorNotes && (
        <Section title="Director Notes">
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

function EditPanel({ scene, onChange, onSave, onCancel }) {
  return (
    <div style={styles.detailScroll}>
      <div style={{ ...styles.detailHeader, marginBottom: "16px" }}>
        <h3 style={styles.detailTitle}>Edit Scene #{scene.sceneNumber}</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={styles.btnGhost} onClick={onCancel}>Cancel</button>
          <button style={styles.btnGold} onClick={onSave}>Save</button>
        </div>
      </div>
      <FormField label="Scene Title" value={scene.sceneTitle} onChange={v => onChange("sceneTitle", v)} />
      <FormField label="Location" value={scene.location} onChange={v => onChange("location", v)} />
      <FormField label="Time of Day" value={scene.timeOfDay} onChange={v => onChange("timeOfDay", v)} />
      <FormField label="Duration" value={scene.duration} onChange={v => onChange("duration", v)} />
      <FormField label="Description" value={scene.description} onChange={v => onChange("description", v)} multiline rows={3} />
      <FormField label="Visual Composition" value={scene.visualComposition} onChange={v => onChange("visualComposition", v)} multiline rows={2} />
      <FormSelect label="Camera Angle" value={scene.cameraAngle} options={CAMERA_SHOTS} onChange={v => onChange("cameraAngle", v)} />
      <FormField label="Camera Movement" value={scene.cameraMovement} onChange={v => onChange("cameraMovement", v)} />
      <FormSelect label="Mood" value={scene.mood} options={MOODS} onChange={v => onChange("mood", v)} />
      <FormSelect label="Lighting" value={scene.lighting} options={LIGHTING} onChange={v => onChange("lighting", v)} />
      <FormField label="Dialogue" value={scene.dialogue} onChange={v => onChange("dialogue", v)} multiline rows={2} />
      <FormField label="Action Beat" value={scene.actionBeat} onChange={v => onChange("actionBeat", v)} multiline />
      <FormField label="Director Notes" value={scene.directorNotes} onChange={v => onChange("directorNotes", v)} multiline />
      <FormField label="AI Image Prompt" value={scene.framePrompt} onChange={v => onChange("framePrompt", v)} multiline rows={3} />
    </div>
  );
}

function TimelineView({ scenes, selectedScene, onSelect }) {
  return (
    <div style={styles.timeline}>
      <div style={styles.timelineTrack} />
      <div style={styles.timelineScenes}>
        {scenes.map((scene) => (
          <div key={scene.sceneNumber} style={styles.timelineItem} onClick={() => onSelect(scene)}>
            <div style={{ ...styles.timelineDot, background: selectedScene?.sceneNumber === scene.sceneNumber ? "#d4a017" : moodColor(scene.mood) }} />
            <div style={{ ...styles.timelineCard, ...(selectedScene?.sceneNumber === scene.sceneNumber ? styles.timelineCardActive : {}) }}>
              <div style={styles.timelineNum}>#{scene.sceneNumber}</div>
              <div style={styles.timelineTitle}>{scene.sceneTitle}</div>
              <div style={styles.timelineMeta}>{scene.cameraAngle} · {scene.duration}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <h4 style={styles.sectionTitle}>{title}</h4>
      {children}
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, multiline, rows = 3, required }) {
  const base = { ...styles.input, ...(required ? styles.inputRequired : {}) };
  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>{label}{required && <span style={{ color: "#d4a017" }}> *</span>}</label>
      {multiline
        ? <textarea style={{ ...base, ...styles.textarea, minHeight: `${rows * 28}px` }}
            value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={base} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  );
}

function FormSelect({ label, value, options, onChange }) {
  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>{label}</label>
      <select style={{ ...styles.input, ...styles.select }} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function EmptyState({ onGo, loading }) {
  return (
    <div style={styles.emptyState}>
      <FilmIcon size={64} />
      <h3 style={styles.emptyTitle}>{loading ? "Analyzing your story..." : "No Storyboard Yet"}</h3>
      <p style={styles.emptySub}>
        {loading
          ? "The AI is breaking down scenes and crafting your storyboard."
          : "Enter your story details and let the AI generate a cinematic storyboard."}
      </p>
      {!loading && <button style={styles.btnGold} onClick={onGo}>Start Writing</button>}
    </div>
  );
}

function FilmIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#d4a017" strokeWidth="1.5">
      <rect x="2" y="2" width="20" height="20" rx="2.5" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="17" y1="7" x2="22" y2="7" />
      <line x1="2" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="22" y2="12" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  );
}

const C = {
  bg: "#0d0d0f", panel: "#13131a", card: "#1a1a24",
  border: "#2a2a3a", gold: "#d4a017", text: "#e8e0cc",
  textDim: "#8a7a5a", textMuted: "#4a4a5a", accent: "#6c7ae0"
};

const styles = {
  root: { background: C.bg, minHeight: "100vh", fontFamily: "'Georgia', serif", color: C.text, display: "flex", flexDirection: "column", overflow: "hidden", height: "100vh" },
  header: { background: C.panel, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: "60px", flexShrink: 0 },
  logo: { display: "flex", alignItems: "center", gap: "10px" },
  logoText: { fontSize: "20px", fontWeight: "700", letterSpacing: "4px", color: C.gold, fontFamily: "monospace" },
  logoSub: { fontSize: "10px", color: C.textDim, letterSpacing: "2px", textTransform: "uppercase" },
  nav: { display: "flex", gap: "4px" },
  navBtn: { background: "transparent", border: "none", color: C.textDim, padding: "8px 18px", cursor: "pointer", fontSize: "13px", borderRadius: "6px" },
  navBtnActive: { background: C.card, color: C.gold, borderBottom: `2px solid ${C.gold}` },
  headerRight: { display: "flex", gap: "10px", alignItems: "center" },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  inputPanel: { width: "340px", flexShrink: 0, background: C.panel, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" },
  panelHeader: { padding: "20px 24px 16px", borderBottom: `1px solid ${C.border}` },
  panelTitle: { margin: 0, fontSize: "16px", color: C.gold, fontWeight: "600" },
  panelSub: { margin: "4px 0 0", fontSize: "11px", color: C.textDim },
  formScroll: { flex: 1, overflowY: "auto", padding: "16px 20px 24px" },
  formGroup: { marginBottom: "14px" },
  label: { display: "block", fontSize: "11px", color: C.textDim, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "5px" },
  input: { width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: "6px", padding: "9px 12px", color: C.text, fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  inputRequired: { borderColor: C.textDim },
  textarea: { resize: "vertical", lineHeight: "1.5" },
  select: { cursor: "pointer" },
  divider: { borderTop: `1px solid ${C.border}`, margin: "18px 0" },
  error: { background: "#3a1010", border: "1px solid #e74c3c", borderRadius: "6px", padding: "10px 14px", fontSize: "12px", color: "#e74c3c", marginBottom: "14px" },
  boardPanel: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: C.bg },
  boardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 },
  projectTitle: { margin: 0, fontSize: "18px", color: C.gold },
  sceneCount: { fontSize: "12px", color: C.textDim },
  boardGrid: { flex: 1, overflowY: "auto", padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "16px", alignContent: "start" },
  sceneCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", cursor: "pointer", transition: "all 0.2s", overflow: "hidden", userSelect: "none" },
  sceneCardSelected: { border: `1px solid ${C.gold}`, boxShadow: `0 0 0 1px ${C.gold}33` },
  sceneCardDragOver: { border: `1px dashed ${C.gold}`, opacity: 0.7 },
  sceneCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px 6px" },
  sceneNum: { fontSize: "11px", color: C.gold, fontFamily: "monospace", letterSpacing: "1px" },
  sceneCardActions: { display: "flex", gap: "4px" },
  iconBtn: { background: "transparent", border: "none", color: C.textDim, cursor: "pointer", fontSize: "11px", padding: "2px 6px", borderRadius: "4px" },
  sceneFrame: { margin: "0 12px", borderRadius: "6px", overflow: "hidden", aspectRatio: "16/9", background: "#0a0a0f", border: `1px solid ${C.border}` },
  sceneFrameInner: { width: "100%", height: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", boxSizing: "border-box" },
  frameDesc: { fontSize: "9px", color: C.textDim, textAlign: "center", lineHeight: "1.4", margin: 0 },
  frameBadge: { position: "absolute", bottom: "5px", right: "6px", fontSize: "8px", background: `${C.gold}22`, border: `1px solid ${C.gold}44`, color: C.gold, padding: "2px 5px", borderRadius: "3px" },
  sceneCardBody: { padding: "10px 12px 12px" },
  sceneTitle: { margin: "0 0 6px", fontSize: "13px", color: C.text, fontWeight: "600" },
  sceneMeta: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" },
  moodDot: { width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0 },
  sceneMetaText: { fontSize: "10px", color: C.textDim },
  sceneMetaDivider: { color: C.textMuted },
  sceneLocation: { fontSize: "10px", color: C.textMuted, marginBottom: "4px" },
  sceneDialogue: { fontSize: "10px", color: C.textDim, fontStyle: "italic", borderLeft: `2px solid ${C.border}`, paddingLeft: "6px", lineHeight: "1.4" },
  detailPanel: { width: "320px", flexShrink: 0, background: C.panel, borderLeft: `1px solid ${C.border}`, overflow: "hidden" },
  detailScroll: { height: "100%", overflowY: "auto", padding: "20px" },
  detailEmpty: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" },
  detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" },
  detailSceneNum: { fontSize: "11px", color: C.gold, background: `${C.gold}18`, padding: "3px 8px", borderRadius: "4px" },
  detailTitle: { margin: "4px 0 2px", fontSize: "15px", color: C.text, fontWeight: "600" },
  detailLocation: { fontSize: "11px", color: C.textDim },
  detailMoodBar: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" },
  moodPill: { fontSize: "11px", padding: "3px 10px", borderRadius: "20px" },
  detailDuration: { fontSize: "11px", color: C.textDim },
  detailText: { fontSize: "12px", color: C.textDim, lineHeight: "1.7", margin: 0 },
  detailTextSm: { fontSize: "11px", color: C.textMuted, lineHeight: "1.6", margin: "6px 0 0" },
  section: { marginBottom: "18px" },
  sectionTitle: { fontSize: "10px", color: C.gold, letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 8px", paddingBottom: "5px", borderBottom: `1px solid ${C.border}` },
  charList: { display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "4px" },
  charTag: { fontSize: "10px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "4px", padding: "2px 7px", color: C.textDim },
  dialogueBox: { background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.gold}`, borderRadius: "4px", padding: "10px 12px", fontSize: "12px", color: C.text, fontStyle: "italic", lineHeight: "1.7" },
  detailGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  detailGridItem: { display: "flex", alignItems: "flex-start", gap: "7px", background: C.card, borderRadius: "6px", padding: "8px" },
  detailGridLabel: { fontSize: "9px", color: C.textMuted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "2px" },
  detailGridValue: { fontSize: "11px", color: C.textDim, lineHeight: "1.4" },
  notesBox: { background: "#1a1800", border: `1px solid ${C.gold}33`, borderRadius: "6px", padding: "10px 12px", fontSize: "12px", color: "#c4a840", lineHeight: "1.7", fontStyle: "italic" },
  promptBox: { background: "#0f1020", border: `1px solid ${C.accent}33`, borderRadius: "6px", padding: "10px 12px", fontSize: "11px", color: "#8888cc", lineHeight: "1.6", fontFamily: "monospace" },
  timeline: { flex: 1, overflowX: "auto", padding: "40px 24px", position: "relative" },
  timelineTrack: { position: "absolute", top: "66px", left: "24px", right: "24px", height: "2px", background: `linear-gradient(90deg, ${C.gold}, ${C.border})`, opacity: 0.4 },
  timelineScenes: { display: "flex", alignItems: "flex-start", minWidth: "max-content" },
  timelineItem: { display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" },
  timelineDot: { width: "12px", height: "12px", borderRadius: "50%", border: `2px solid ${C.bg}`, marginBottom: "12px", flexShrink: 0, zIndex: 1 },
  timelineCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "10px 14px", width: "160px", marginRight: "24px" },
  timelineCardActive: { border: `1px solid ${C.gold}`, background: `${C.gold}11` },
  timelineNum: { fontSize: "10px", color: C.gold, marginBottom: "4px" },
  timelineTitle: { fontSize: "12px", color: C.text, fontWeight: "600", marginBottom: "4px" },
  timelineMeta: { fontSize: "10px", color: C.textDim },
  emptyState: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px" },
  emptyTitle: { fontSize: "22px", color: C.text, margin: "20px 0 10px", fontWeight: "600" },
  emptySub: { fontSize: "14px", color: C.textDim, maxWidth: "380px", lineHeight: "1.6", marginBottom: "24px" },
  btnGold: { background: `linear-gradient(135deg, ${C.gold}, #b8860b)`, color: "#0a0a0f", border: "none", borderRadius: "7px", padding: "9px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", fontFamily: "inherit" },
  btnOutline: { background: "transparent", color: C.textDim, border: `1px solid ${C.border}`, borderRadius: "7px", padding: "7px 14px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { background: C.card, color: C.textDim, border: `1px solid ${C.border}`, borderRadius: "7px", padding: "7px 14px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" },
};

const globalStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #13131a; }
  ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 2px; }
  input, textarea, select { color-scheme: dark; }
  input:focus, textarea:focus, select:focus { border-color: #d4a017 !important; outline: none; }
  [draggable] { cursor: grab; }
  [draggable]:active { cursor: grabbing; }
`;
