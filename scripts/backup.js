// scripts/backup.js
// Fetches rooms, bookings and settings from Supabase and writes a JSON file
// in the SAME format as the app's "Backup herunterladen" button, so it can
// be used directly with "Backup wiederherstellen" in the app.

const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variable.');
  process.exit(1);
}

function fetchTable(table) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    https.get(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Request to ${table} failed: ${res.statusCode} ${data}`));
          return;
        }
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Same field mapping as the app (mapRoomFromDb / mapBookingFromDb in index.html)
function mapRoom(r) {
  return { id: r.id, name: r.name, floor: r.floor, capacity: r.capacity, equipment: r.equipment, color: r.color, active: r.active, ruagOnly: r.ruag_only };
}
function mapBooking(b) {
  return { id: b.id, roomId: b.room_id, date: b.date, startTime: b.start_time, endTime: b.end_time, name: b.name, company: b.company, title: b.title, email: b.email, createdAt: b.created_at, seriesId: b.series_id };
}

(async () => {
  const [roomsRaw, bookingsRaw, settingsRaw] = await Promise.all([
    fetchTable('rooms'),
    fetchTable('bookings'),
    fetchTable('app_settings'),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'github-actions-nightly',
    rooms: roomsRaw.map(mapRoom),
    bookings: bookingsRaw.map(mapBooking),
    settings: (settingsRaw[0] && settingsRaw[0].data) || {},
  };

  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `backup-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));

  console.log(`Backup written: ${file}`);
  console.log(`Rooms: ${payload.rooms.length}, Bookings: ${payload.bookings.length}`);
})().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
