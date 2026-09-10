import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useDialog } from '../components/DialogProvider.jsx';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function blockDuration(start, end) {
  let s = timeToMinutes(start), e = timeToMinutes(end);
  if (e <= s) e += 24 * 60;
  return ((e - s) / 60).toFixed(1);
}

export default function RoutineTemplate() {
  const { confirm } = useDialog();
  const [template, setTemplate] = useState({});
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id, ... } block being edited
  const [addingDay, setAddingDay] = useState(null); // day index for adding new block
  const [addForm, setAddForm] = useState({ activity_id: '', start_time: '', end_time: '', notes: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [tmpl, acts] = await Promise.all([
      api.get('/routine/template'),
      api.get('/routine/activities')
    ]);
    setTemplate(tmpl);
    setActivities(acts);
    setLoading(false);
  }

  async function saveBlock(block) {
    await api.put(`/routine/template/${block.id}`, {
      activity_id: block.activity_id,
      start_time: block.start_time,
      end_time: block.end_time,
      notes: block.notes
    });
    setEditing(null);
    load();
  }

  async function deleteBlock(id) {
    if (!await confirm('Remove this block from the schedule?', { ledger: 'routine', danger: true })) return;
    await api.del(`/routine/template/${id}`);
    load();
  }

  async function addBlock() {
    if (!addForm.activity_id || !addForm.start_time || !addForm.end_time) return;
    await api.post('/routine/template', {
      day_of_week: addingDay,
      activity_id: Number(addForm.activity_id),
      start_time: addForm.start_time,
      end_time: addForm.end_time,
      notes: addForm.notes
    });
    setAddingDay(null);
    setAddForm({ activity_id: '', start_time: '', end_time: '', notes: '' });
    load();
  }

  if (loading) return <div className="empty-state">Loading routine…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Your weekly blueprint</div>
        <h1 className="page-title">My Routine</h1>
        <p className="page-sub">View and edit your weekly schedule. Click any block to change it, or add new blocks. Changes save automatically.</p>
      </div>

      <div className="routine-week-grid">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const blocks = template[day] || [];
          const totalH = blocks.reduce((s, b) => s + Number(blockDuration(b.start_time, b.end_time)), 0);
          return (
            <div className="routine-day-col" key={day}>
              <div className="routine-day-header">
                <span className="routine-day-name">{DAY_NAMES[day]}</span>
                <span className="routine-day-total">{totalH.toFixed(1)}h</span>
              </div>

              {blocks.map((block) => (
                editing?.id === block.id ? (
                  /* Inline edit form */
                  <div className="routine-block routine-block-editing" key={block.id}>
                    <select value={editing.activity_id}
                      onChange={(e) => setEditing({ ...editing, activity_id: Number(e.target.value) })}>
                      {activities.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input type="time" value={editing.start_time}
                        onChange={(e) => setEditing({ ...editing, start_time: e.target.value })} />
                      <input type="time" value={editing.end_time}
                        onChange={(e) => setEditing({ ...editing, end_time: e.target.value })} />
                    </div>
                    <input placeholder="Notes" value={editing.notes}
                      onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => saveBlock(editing)} style={{ flex: 1 }}>Save</button>
                      <button className="btn btn-sm" onClick={() => setEditing(null)}>✕</button>
                    </div>
                  </div>
                ) : (
                  <div className="routine-block" key={block.id}
                    style={{ '--block-color': block.activity_color, cursor: 'pointer' }}
                    onClick={() => setEditing({ ...block })}>
                    <div className="routine-block-time">{block.start_time}–{block.end_time}</div>
                    <div className="routine-block-label">
                      {block.activity_icon} {block.activity_name}
                    </div>
                    {block.notes && <div className="routine-block-notes">{block.notes}</div>}
                    <button className="routine-block-del" onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                      title="Remove block">✕</button>
                  </div>
                )
              ))}

              {addingDay === day ? (
                <div className="routine-block routine-block-editing">
                  <select value={addForm.activity_id}
                    onChange={(e) => setAddForm({ ...addForm, activity_id: e.target.value })}>
                    <option value="">Pick activity…</option>
                    {activities.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="time" value={addForm.start_time} placeholder="Start"
                      onChange={(e) => setAddForm({ ...addForm, start_time: e.target.value })} />
                    <input type="time" value={addForm.end_time} placeholder="End"
                      onChange={(e) => setAddForm({ ...addForm, end_time: e.target.value })} />
                  </div>
                  <input placeholder="Notes (optional)" value={addForm.notes}
                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm btn-primary" onClick={addBlock} style={{ flex: 1 }}>Add</button>
                    <button className="btn btn-sm" onClick={() => setAddingDay(null)}>✕</button>
                  </div>
                </div>
              ) : (
                <button className="routine-add-block-btn" onClick={() => setAddingDay(day)}>
                  + Add block
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
