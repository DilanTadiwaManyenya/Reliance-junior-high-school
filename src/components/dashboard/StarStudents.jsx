import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import Avatar from '../ui/Avatar'; // adjust import path if Avatar exists elsewhere

export default function StarStudents({ limit = 5 }) {
  const { supabase } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status')
        .order('date', { ascending: false });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // aggregate attendance per student
      const counts = {};
      data.forEach(row => {
        const id = row.student_id;
        if (!counts[id]) counts[id] = { present: 0, total: 0 };
        counts[id].total += 1;
        if (row.status === 'present') counts[id].present += 1;
      });
      const list = Object.entries(counts)
        .map(([id, { present, total }]) => ({
          id,
          attendance: Math.round((present / total) * 100),
        }))
        .sort((a, b) => b.attendance - a.attendance)
        .slice(0, limit);

      const ids = list.map(s => s.id);
      const { data: studentsData, error: stuErr } = await supabase
        .from('students')
        .select('id, full_name, class_level, class_stream')
        .in('id', ids);
      if (stuErr) {
        setError(stuErr.message);
        setLoading(false);
        return;
      }
      const enriched = list.map(item => {
        const detail = studentsData.find(s => s.id === item.id) || {};
        return { ...item, ...detail };
      });
      setStudents(enriched);
      setLoading(false);
    };
    load();
  }, [supabase]);

  if (loading) return <p className="muted">Loading top attendance…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <section className="dashboard-card star-students">
      <h2>Top Attendance</h2>
      <ul className="star-students-list">
        {students.map(s => (
          <li key={s.id} className="star-student-item">
            <Avatar name={s.full_name} />
            <div className="info">
              <strong>{s.full_name}</strong>
              <small>{s.class_level} {s.class_stream}</small>
            </div>
            <span className="attendance">{s.attendance}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
