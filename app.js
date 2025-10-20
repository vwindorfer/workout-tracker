// Use UMD globals from the scripts loaded in index.html
const { useEffect, useMemo, useState } = React;
const {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} = Recharts; // <- NOT window.Recharts

// ==========================
// iPhone Workout Tracker (PWA)
// - Add to Home Screen
// - Offline cache via tiny Service Worker
// - Local cache via localStorage
// - Optional cloud sync via Vercel + private GitHub repo
// ==========================

const API = "https://YOUR-VERCEL-APP.vercel.app"; // <-- replace after you deploy the backend

export default function App() {
  // PWA bootstrap
  useEffect(() => {
    const manifest = {
      name: "Workout Tracker",
      short_name: "Workouts",
      start_url: ".",
      display: "standalone",
      background_color: "#0f172a",
      theme_color: "#0ea5e9",
      icons: [
        { src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'><rect width='256' height='256' rx='56' fill='%230ea5e9'/><path d='M52 140h152M92 92v72M164 92v72' stroke='white' stroke-width='20' stroke-linecap='round'/></svg>", sizes: "256x256", type: "image/svg+xml" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = url;
    document.head.appendChild(link);

    const swCode = `self.addEventListener('install', e => {self.skipWaiting();});
self.addEventListener('activate', e => {clients.claim();});
self.addEventListener('fetch', e => {
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request);
      const c = await caches.open('wt-cache-v3');
      c.put(e.request, r.clone());
      return r;
    } catch {
      const m = await caches.match(e.request);
      if (m) return m;
      return new Response('Offline', { status: 503 });
    }
  })());
});`;
    if ("serviceWorker" in navigator) {
      const swBlob = new Blob([swCode], { type: "text/javascript" });
      const swUrl = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swUrl).catch(() => {});
    }

    return () => {
      document.head.removeChild(link);
      URL.revokeObjectURL(url);
    };
  }, []);

  // ------------------ Data model ------------------
  const [workoutTypes, setWorkoutTypes] = useLocalStorage(
    "wt_types",
    [
      { id: uid(), name: "Bench Press", muscleGroup: "Chest" },
      { id: uid(), name: "Lat Pulldown", muscleGroup: "Back" },
      { id: uid(), name: "Squat", muscleGroup: "Legs" },
      { id: uid(), name: "Deadlift", muscleGroup: "Back" },
      { id: uid(), name: "Overhead Press", muscleGroup: "Shoulders" },
    ]
  );

  const [workouts, setWorkouts] = useLocalStorage("wt_workouts", []);
  const [route, setRoute] = useState("home"); // "home"|"add"|"edit"|"list"|"types"|"dashboard"|"settings"
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);

  const lastWorkout = useMemo(
    () => (workouts.length ? [...workouts].sort((a,b)=>new Date(b.date)-new Date(a.date))[0] : null),
    [workouts]
  );

  function go(to) {
    setRoute(to);
    if (to !== "edit") setEditingWorkoutId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveWorkout(w) {
    setWorkouts(prev => {
      const exists = prev.find(x => x.id === w.id);
      return exists ? prev.map(x => x.id === w.id ? { ...w } : x) : [...prev, { ...w }];
    });
    go("home");
  }

  function deleteWorkout(id) {
    if (!confirm("Delete this workout?")) return;
    setWorkouts(prev => prev.filter(w => w.id !== id));
  }

  function addType(newType) { setWorkoutTypes(prev => [...prev, newType]); }
  function updateType(updated) { setWorkoutTypes(prev => prev.map(t => t.id === updated.id ? updated : t)); }
  function deleteType(id) {
    if (!confirm("Delete this exercise type? (won't remove past workouts)")) return;
    setWorkoutTypes(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-28">
      <TopBar onNavigate={go} />

      {route === "home" && (
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          <SectionCard>
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold">Home</h1>
              <div className="flex gap-2">
                <PrimaryButton onClick={() => go("add")}>Add New Workout</PrimaryButton>
                <SecondaryButton onClick={() => go("list")}>Last Workouts</SecondaryButton>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="text-lg font-medium mb-2">Last Workout</h2>
            {lastWorkout ? (
              <WorkoutSummary workout={lastWorkout} types={workoutTypes} onEdit={() => { setEditingWorkoutId(lastWorkout.id); setRoute("edit"); }} />
            ) : (
              <p className="text-slate-300">No workouts yet. Tap <span className="font-semibold">Add New Workout</span> to get started.</p>
            )}
          </SectionCard>

          <SectionCard>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">Dashboard</h2>
                <p className="text-slate-300 text-sm">See your progress and training volume over time.</p>
              </div>
              <div className="flex gap-2">
                <SecondaryButton onClick={() => go("dashboard")}>Open Dashboard</SecondaryButton>
                <SecondaryButton onClick={() => go("settings")}>Settings</SecondaryButton>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {route === "add" && (
        <AddEditWorkout
          key={"add"}
          types={workoutTypes}
          lastWorkout={lastWorkout}
          onCancel={() => go("home")}
          onSave={w => saveWorkout(w)}
        />
      )}

      {route === "edit" && editingWorkoutId && (
        <AddEditWorkout
          key={editingWorkoutId}
          types={workoutTypes}
          lastWorkout={lastWorkout}
          existing={workouts.find(w => w.id === editingWorkoutId) || null}
          onCancel={() => go("home")}
          onSave={w => saveWorkout(w)}
        />
      )}

      {route === "list" && (
        <WorkoutsTable
          workouts={workouts}
          types={workoutTypes}
          onEdit={id => { setEditingWorkoutId(id); setRoute("edit"); }}
          onDelete={id => deleteWorkout(id)}
        />
      )}

      {route === "types" && (
        <ManageTypes types={workoutTypes} onAdd={addType} onUpdate={updateType} onDelete={deleteType} onBack={() => go("home")} />
      )}

      {route === "dashboard" && (
        <Dashboard workouts={workouts} types={workoutTypes} onBack={() => go("home")} />
      )}

      {route === "settings" && (
        <Settings
          onBack={() => go("home")}
          workouts={workouts}
          workoutTypes={workoutTypes}
          setWorkouts={setWorkouts}
          setWorkoutTypes={setWorkoutTypes}
        />
      )}

      <BottomNav current={route} onNavigate={go} />
    </div>
  );
}

// ------------------ Components ------------------

function TopBar({ onNavigate }) {
  return (
    <div className="sticky top-0 z-30 backdrop-blur bg-slate-900/70 border-b border-slate-800">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500 text-slate-900 font-black">WT</span>
          <span className="font-semibold">Workout Tracker</span>
        </div>
        <div className="hidden sm:flex gap-2">
          <SecondaryButton onClick={() => onNavigate("home")}>Home</SecondaryButton>
          <SecondaryButton onClick={() => onNavigate("list")}>Workouts</SecondaryButton>
          <SecondaryButton onClick={() => onNavigate("dashboard")}>Dashboard</SecondaryButton>
          <SecondaryButton onClick={() => onNavigate("types")}>Types</SecondaryButton>
          <SecondaryButton onClick={() => onNavigate("settings")}>Settings</SecondaryButton>
        </div>
      </div>
    </div>
  );
}

function BottomNav({ current, onNavigate }) {
  const items = [
    { key: "home", label: "Home" },
    { key: "add", label: "Add" },
    { key: "list", label: "Workouts" },
    { key: "dashboard", label: "Dashboard" },
    { key: "settings", label: "Settings" },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-slate-900/90 border-t border-slate-800 backdrop-blur z-40">
      <div className="max-w-3xl mx-auto grid grid-cols-5">
        {items.map(it => (
          <button
            key={it.key}
            onClick={() => onNavigate(it.key)}
            className={`py-3 text-xs ${current === it.key ? "text-sky-400" : "text-slate-300"}`}
          >
            {it.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function SectionCard({ children }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 shadow">
      {children}
    </div>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button {...props} className="px-4 py-2 rounded-xl bg-sky-500 text-slate-900 font-semibold active:scale-[.98]">
      {children}
    </button>
  );
}
function SecondaryButton({ children, ...props }) {
  return (
    <button {...props} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-100 font-medium active:scale-[.98]">
      {children}
    </button>
  );
}
function GhostButton({ children, ...props }) {
  return (
    <button {...props} className="px-3 py-2 rounded-xl border border-slate-700 bg-transparent text-slate-200 active:scale-[.98]">
      {children}
    </button>
  );
}

// ——— Inputs (larger tap targets: fixes overlap on iOS)
function Input({ label, ...props }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-slate-300 leading-5">{label}</span>
      <input
        {...props}
        className="px-3 py-3 rounded-2xl bg-slate-800 border border-slate-700
                   focus:outline-none focus:ring-2 focus:ring-sky-500
                   text-base leading-6 min-h-[44px] w-full appearance-none"
      />
    </label>
  );
}
function Select({ label, children, ...props }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-slate-300 leading-5">{label}</span>
      <select
        {...props}
        className="px-3 py-3 rounded-2xl bg-slate-800 border border-slate-700
                   focus:outline-none focus:ring-2 focus:ring-sky-500
                   text-base leading-6 min-h-[44px] w-full appearance-none"
      >
        {children}
      </select>
    </label>
  );
}
function TextArea({ label, ...props }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-slate-300 leading-5">{label}</span>
      <textarea
        {...props}
        className="px-3 py-3 rounded-2xl bg-slate-800 border border-slate-700
                   focus:outline-none focus:ring-2 focus:ring-sky-500
                   text-base leading-6 min-h-[80px] w-full"
      />
    </label>
  );
}

// ------------- Home Summary -------------
function WorkoutSummary({ workout, types, onEdit }) {
  const items = workout.exercises.map(e => ({ ...e, name: types.find(t => t.id === e.typeId)?.name || "(deleted)" }));
  const totalVolume = items.reduce((acc, e) => acc + (e.weight * e.reps * e.sets), 0);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{new Date(workout.date).toLocaleString()}</p>
          <p className="text-slate-200">{items.length} exercise{items.length !== 1 ? "s" : ""} · Volume {Math.round(totalVolume)} kg</p>
        </div>
        <GhostButton onClick={onEdit}>Edit</GhostButton>
      </div>
      <div className="grid gap-2">
        {items.slice(0, 5).map(e => (
          <div key={e.id} className="flex items-center justify-between text-sm bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-700">
            <span className="truncate mr-2">{e.name}</span>
            <span>{e.sets}×{e.reps} @ {e.weight} kg</span>
          </div>
        ))}
        {items.length > 5 && <span className="text-xs text-slate-400">+{items.length - 5} more…</span>}
      </div>
      {workout.notes && <p className="text-slate-300 text-sm">Notes: {workout.notes}</p>}
    </div>
  );
}

// ------------- Add/Edit Workout -------------
function AddEditWorkout({ types, lastWorkout, existing = null, onCancel, onSave }) {
  const [date, setDate] = useState(existing ? isoLocal(existing.date) : isoLocal(new Date().toISOString()));
  const [notes, setNotes] = useState(existing?.notes || "");
  const [exercises, setExercises] = useState(existing?.exercises || [blankExercise(types)]);

  function addRow(templateFromLast = false) {
    if (templateFromLast && lastWorkout) {
      const copies = lastWorkout.exercises.map(e => ({ id: uid(), typeId: e.typeId, weight: e.weight, reps: e.reps, sets: e.sets }));
      setExercises(prev => [...prev, ...copies]);
    } else {
      setExercises(prev => [...prev, blankExercise(types)]);
    }
  }
  function removeRow(id) { setExercises(prev => prev.filter(x => x.id !== id)); }
  function updateRow(id, patch) { setExercises(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x)); }

  function handleSave() {
    if (!exercises.length) return alert("Add at least one exercise");
    const hasInvalid = exercises.some(e => !e.typeId || e.weight <= 0 || e.reps <= 0 || e.sets <= 0);
    if (hasInvalid) return alert("Please fill out all exercise fields with positive numbers.");
    const workout = { id: existing?.id || uid(), date: new Date(date).toISOString(), notes, exercises };
    onSave(workout);
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{existing ? "Edit Workout" : "Add New Workout"}</h1>
          <div className="flex gap-2">
            <PrimaryButton onClick={handleSave}>Save Workout</PrimaryButton>
            <SecondaryButton onClick={onCancel}>Cancel Workout</SecondaryButton>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="grid gap-3">
          <Input type="datetime-local" label="Date & Time" value={date} onChange={e => setDate(e.target.value)} />
          <TextArea label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Exercises</h2>
          <div className="flex gap-2">
            <GhostButton onClick={() => addRow(false)}>+ Add Row</GhostButton>
            <GhostButton onClick={() => addRow(true)} disabled={!lastWorkout}>Copy Last Workout</GhostButton>
          </div>
        </div>

        <div className="grid gap-3">
          {exercises.map(ex => (
            <div key={ex.id} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-start bg-slate-800/60 border border-slate-700 rounded-2xl p-3">
              <Select label="Type" value={ex.typeId} onChange={e => updateRow(ex.id, { typeId: e.target.value })}>
                <option value="" disabled>Select type…</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Input label="Weight (kg)" type="number" min={0} inputMode="decimal" value={ex.weight} onChange={e => updateRow(ex.id, { weight: toNumber(e.target.value) })} />
              <Input label="Reps" type="number" min={0} inputMode="numeric" value={ex.reps} onChange={e => updateRow(ex.id, { reps: toNumber(e.target.value) })} />
              <Input label="Sets" type="number" min={0} inputMode="numeric" value={ex.sets} onChange={e => updateRow(ex.id, { sets: toNumber(e.target.value) })} />
              <div className="flex justify-end sm:justify-start">
                <GhostButton onClick={() => removeRow(ex.id)}>Remove</GhostButton>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-medium mb-2">Last Workout</h2>
        {lastWorkout ? <WorkoutSummary workout={lastWorkout} types={types} onEdit={() => {}} /> : <p className="text-slate-300">No previous workout to show.</p>}
      </SectionCard>
    </div>
  );
}

// ------------- Workouts Table/List -------------
function WorkoutsTable({ workouts, types, onEdit, onDelete }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date_desc");

  const rows = useMemo(() => {
    const typed = workouts.map(w => ({
      ...w,
      totalVolume: w.exercises.reduce((acc, e) => acc + e.weight * e.reps * e.sets, 0),
      exercisesNamed: w.exercises.map(e => types.find(t => t.id === e.typeId)?.name || "(deleted)"),
    }));
    const filtered = query
      ? typed.filter(w => [new Date(w.date).toLocaleDateString(), w.notes || "", ...w.exercisesNamed].join(" ").toLowerCase().includes(query.toLowerCase()))
      : typed;
    const sorted = filtered.sort((a, b) => {
      switch (sort) {
        case "date_asc": return new Date(a.date) - new Date(b.date);
        case "volume_desc": return b.totalVolume - a.totalVolume;
        case "volume_asc": return a.totalVolume - b.totalVolume;
        default: return new Date(b.date) - new Date(a.date);
      }
    });
    return sorted;
  }, [workouts, types, query, sort]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Workouts</h1>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setSort(sort === "date_desc" ? "volume_desc" : "date_desc")}>
              Sort: {sort.replace("_", " ")}
            </SecondaryButton>
          </div>
        </div>
        <div className="mt-3 grid sm:flex gap-2">
          <input
            placeholder="Search by date, note, or exercise…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full px-3 py-3 rounded-2xl bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </SectionCard>

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-300">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Exercises</th>
                <th className="py-2">Volume (kg)</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {rows.map(w => (
                <tr key={w.id} className="align-top">
                  <td className="py-3 pr-4 whitespace-nowrap">{new Date(w.date).toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    <ul className="list-disc ml-5 space-y-1">
                      {w.exercises.map(e => (
                        <li key={e.id}>
                          {(types.find(t => t.id === e.typeId)?.name || "(deleted)")}: {e.sets}×{e.reps} @ {e.weight} kg
                        </li>
                      ))}
                    </ul>
                    {w.notes && <p className="text-slate-400 mt-2">Notes: {w.notes}</p>}
                  </td>
                  <td className="py-3 pr-4">{Math.round(w.totalVolume)}</td>
                  <td className="py-3 flex gap-2">
                    <GhostButton onClick={() => onEdit(w.id)}>Edit</GhostButton>
                    <GhostButton onClick={() => onDelete(w.id)}>Delete</GhostButton>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="py-6 text-slate-400" colSpan={4}>No workouts yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ------------- Manage Types -------------
function ManageTypes({ types, onAdd, onUpdate, onDelete, onBack }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");

  function add() {
    if (!name.trim()) return;
    onAdd({ id: uid(), name: name.trim(), muscleGroup: group.trim() });
    setName(""); setGroup("");
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Manage Types</h1>
          <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Bench Press" />
          <Input label="Muscle Group (optional)" value={group} onChange={e => setGroup(e.target.value)} placeholder="Chest" />
          <div className="flex items-end"><PrimaryButton onClick={add}>Add Type</PrimaryButton></div>
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-medium mb-3">Your Types</h2>
        <div className="grid gap-2">
          {types.map(t => <TypeRow key={t.id} t={t} onUpdate={onUpdate} onDelete={onDelete} />)}
          {!types.length && <p className="text-slate-300">No types yet.</p>}
        </div>
      </SectionCard>
    </div>
  );
}
function TypeRow({ t, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(t.name);
  const [group, setGroup] = useState(t.muscleGroup || "");
  function save() { onUpdate({ ...t, name: name.trim(), muscleGroup: group.trim() }); setEditing(false); }

  return (
    <div className="grid sm:grid-cols-5 gap-2 items-center bg-slate-800/60 border border-slate-700 rounded-xl p-3">
      {editing ? (
        <>
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} />
          <Input label="Group" value={group} onChange={e => setGroup(e.target.value)} />
          <div className="sm:col-span-2" />
          <div className="flex gap-2 justify-end">
            <PrimaryButton onClick={save}>Save</PrimaryButton>
            <SecondaryButton onClick={() => setEditing(false)}>Cancel</SecondaryButton>
          </div>
        </>
      ) : (
        <>
          <div className="sm:col-span-2">
            <div className="text-slate-50 font-medium">{t.name}</div>
            <div className="text-slate-400 text-sm">{t.muscleGroup || "—"}</div>
          </div>
          <div className="sm:col-span-2" />
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={() => setEditing(true)}>Edit</GhostButton>
            <GhostButton onClick={() => onDelete(t.id)}>Delete</GhostButton>
          </div>
        </>
      )}
    </div>
  );
}

// ------------- Dashboard -------------
function Dashboard({ workouts, types, onBack }) {
  const perDay   = useMemo(() => summarizeWorkouts(workouts), [workouts]);
  const perType  = useMemo(() => perTypeVolume(workouts, types), [workouts, types]);
  const prSeries = useMemo(() => prEstimateSeries(workouts, types), [workouts, types]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard>
          <h3 className="font-medium mb-2">Training Volume Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                <YAxis tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }} />
                <Legend />
                <Bar dataKey="volume" name="Volume (kg)" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard>
          <h3 className="font-medium mb-2">Top Volume by Exercise</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perType} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#cbd5e1' }} interval={0} angle={-20} height={60} />
                <YAxis tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }} />
                <Legend />
                <Bar dataKey="volume" name="Total Volume (kg)" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard>
          <h3 className="font-medium mb-2">Estimated 1RM (Epley)</h3>
          <p className="text-slate-300 text-sm mb-2">Shows the best estimated 1RM per session for selected staple lifts.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={prSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                <YAxis tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }} />
                <Legend />
                {Object.keys(sampleLiftKeys(types)).map((key) => (
                  <Line key={key} type="monotone" dataKey={key} name={key} dot={false} stroke={lineColorFor(key)} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard>
          <h3 className="font-medium mb-2">Sessions per Week</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionsPerWeek(workouts)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                <YAxis tick={{ fontSize: 12, fill: '#cbd5e1' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }} />
                <Legend />
                <Bar dataKey="sessions" name="Sessions" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ------------------ Data helpers ------------------
function lineColorFor(name) {
  const map = {
    'Bench Press': '#38bdf8',
    'Squat': '#22c55e',
    'Deadlift': '#ef4444',
    'Overhead Press': '#f59e0b',
  };
  return map[name] || '#a78bfa';
}
function summarizeWorkouts(workouts) {
  const map = new Map();
  for (const w of workouts) {
    const d = new Date(w.date);
    const key = d.toLocaleDateString();
    const vol = w.exercises.reduce((acc, e) => acc + e.weight * e.reps * e.sets, 0);
    map.set(key, (map.get(key) || 0) + vol);
  }
  return Array.from(map, ([date, volume]) => ({ date, volume })).sort((a, b) => new Date(a.date) - new Date(b.date));
}
function perTypeVolume(workouts, types) {
  const nameById = Object.fromEntries(types.map(t => [t.id, t.name]));
  const map = new Map();
  for (const w of workouts) for (const e of w.exercises) {
    const name = nameById[e.typeId] || "(deleted)";
    map.set(name, (map.get(name) || 0) + e.weight * e.reps * e.sets);
  }
  return Array.from(map, ([name, volume]) => ({ name, volume })).sort((a, b) => b.volume - a.volume).slice(0, 12);
}
function prEstimateSeries(workouts, types) {
  const keyNames = sampleLiftKeys(types);
  const rows = [];
  const byDate = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const w of byDate) {
    const row = { date: new Date(w.date).toLocaleDateString() };
    for (const [name, id] of Object.entries(keyNames)) {
      const best = w.exercises
        .filter(e => e.typeId === id)
        .map(e => e.weight * (1 + e.reps / 30))
        .reduce((m, v) => (v > m ? v : m), 0);
      if (best) row[name] = Math.round(best);
    }
    rows.push(row);
  }
  return rows;
}
function sampleLiftKeys(types) {
  const picks = {};
  for (const t of types) {
    const n = t.name.toLowerCase();
    if (!picks["Bench Press"] && n.includes("bench")) picks["Bench Press"] = t.id;
    if (!picks["Squat"] && n.includes("squat")) picks["Squat"] = t.id;
    if (!picks["Deadlift"] && n.includes("dead")) picks["Deadlift"] = t.id;
    if (!picks["Overhead Press"] && (n.includes("overhead") || (n.includes("shoulder") && n.includes("press")))) picks["Overhead Press"] = t.id;
  }
  const namesOnly = {};
  for (const [k, v] of Object.entries(picks)) namesOnly[k] = v;
  return namesOnly;
}
function sessionsPerWeek(workouts) {
  const map = new Map();
  for (const w of workouts) {
    const d = new Date(w.date);
    const y = d.getFullYear();
    const oneJan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
    const key = `${y}-W${String(week).padStart(2, "0")}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map, ([week, sessions]) => ({ week, sessions })).sort((a, b) => a.week.localeCompare(b.week));
}

// ------------------ Hooks & utils ------------------
function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initialValue; }
    catch { return initialValue; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState];
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function toNumber(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
function blankExercise(types) { return { id: uid(), typeId: types[0]?.id || "", weight: 0, reps: 0, sets: 0 }; }
function isoLocal(iso) {
  const d = new Date(iso); const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

// ------------------ Settings (Cloud Sync) ------------------
function Settings({ onBack, workouts, workoutTypes, setWorkouts, setWorkoutTypes }) {
  const [auth, setAuth] = useState({ ok: false, login: "" });
  useEffect(() => { checkAuth().then(setAuth); }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Settings</h1>
          <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        </div>
      </SectionCard>

      <SectionCard>
        {!auth.ok ? (
          <PrimaryButton onClick={() => (window.location.href = `${API}/api/login`)}>
            Sign in with GitHub
          </PrimaryButton>
        ) : (
          <>
            <p className="text-slate-300 mb-3">Signed in as <span className="font-semibold">{auth.login}</span></p>
            <div className="flex gap-2">
              <SecondaryButton onClick={() => cloudLoad(setWorkouts, setWorkoutTypes)}>Load from Cloud</SecondaryButton>
              <PrimaryButton onClick={() => cloudSync(workouts, workoutTypes)}>Sync to Cloud</PrimaryButton>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}

// Cloud helpers
async function checkAuth() {
  try {
    const res = await fetch(`${API}/api/me`, { credentials: "include" });
    return res.ok ? res.json() : { ok: false };
  } catch { return { ok: false }; }
}
async function cloudLoad(setWorkouts, setTypes) {
  const safe = async (file) => {
    const r = await fetch(`${API}/api/data?file=${file}`, { credentials: "include" });
    const j = await r.json();
    return j.ok ? JSON.parse(j.content || "[]") : [];
  };
  const [types, workouts] = await Promise.all([safe("types.json"), safe("workouts.json")]);
  setTypes(types); setWorkouts(workouts);
}
async function cloudSync(workouts, types) {
  const put = (file, content) => fetch(`${API}/api/data?file=${file}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  }).then(r => r.json());
  await put("types.json", JSON.stringify(types, null, 2));
  await put("workouts.json", JSON.stringify(workouts, null, 2));
  alert("Synced to Cloud ✅");
}

// ---- Mount the app into #root ----
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
