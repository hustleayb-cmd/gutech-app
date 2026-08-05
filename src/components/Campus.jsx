import { MapPinIcon, PhoneIcon, BookIcon, IdCardIcon, UserIcon, ChartIcon } from './Icons';

// Directory content — edit freely. Kept as plain data here since it changes
// rarely; move to a Supabase table (like announcements) if it needs to be
// editable without a redeploy.
const SERVICES = [
  { name: 'Registrar\'s Office', hint: 'Enrolment, transcripts, certificates', Icon: IdCardIcon },
  { name: 'Library', hint: 'Study spaces, books, databases', Icon: BookIcon },
  { name: 'Student Affairs', hint: 'Clubs, housing, general support', Icon: UserIcon },
  { name: 'Finance Office', hint: 'Tuition, fee payment, refunds', Icon: ChartIcon },
];

const MAP_QUERY = 'German University of Technology in Oman, Halban, Muscat';

export default function Campus() {
  return (
    <>
      <div className="annot">Campus</div>

      <div className="card campus-map-card">
        <div className="map-embed">
          <iframe
            title="GUtech campus location"
            src={`https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <h3 style={{ fontSize: 15 }}>GUtech Campus</h3>
            <div className="stamp badge-neutral" style={{ marginTop: 6 }}>Halban · Muscat, Oman</div>
          </div>
          <a
            className="ghost"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`}
            target="_blank" rel="noopener noreferrer"
          >
            <MapPinIcon size={14} /> Open in Maps
          </a>
        </div>
      </div>

      <div className="annot">Services directory</div>
      {SERVICES.map(s => (
        <div className="card service-row" key={s.name}>
          <span className="service-icon"><s.Icon size={20} /></span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15 }}>{s.name}</h3>
            <p style={{ marginTop: 4, fontSize: 13 }}>{s.hint}</p>
          </div>
        </div>
      ))}

      <div className="notice" style={{ marginTop: 4 }}>
        Contact details for each office are on the official GUtech website —
        this directory is a quick pointer, not a substitute for it.
      </div>
    </>
  );
}
