const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
envContent.split('\n').forEach((l) => {
  const [k, ...v] = l.trim().split('=');
  if (k && v.length) process.env[k] = v.join('=');
});

async function check() {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID,
      client_secret: process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_SECRET,
      refresh_token: process.env.EXPO_PUBLIC_GOOGLE_DRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const { access_token } = await tokenRes.json();

  // List items in Foto Struk (ID: 1Z1yk_WbZ9uUm-uxic9iApDJMFEsawiFK)
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?q='1Z1yk_WbZ9uUm-uxic9iApDJMFEsawiFK'+in+parents+and+trashed=false&fields=files(id,name,mimeType)",
    { headers: { Authorization: 'Bearer ' + access_token } }
  );
  const data = await res.json();
  console.log('\n📂 Isi folder Foto Struk:');
  console.table(data.files);

  const yearFolder = data.files.find((f) => f.name === '2026');
  if (yearFolder) {
    const res2 = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${yearFolder.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)`,
      { headers: { Authorization: 'Bearer ' + access_token } }
    );
    const data2 = await res2.json();
    console.log('\n📂 Isi folder 2026:');
    console.table(data2.files);

    const monthFolder = data2.files.find((f) => f.name.includes('September'));
    if (monthFolder) {
      const res3 = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${monthFolder.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)`,
        { headers: { Authorization: 'Bearer ' + access_token } }
      );
      const data3 = await res3.json();
      console.log(`\n📂 Isi folder ${monthFolder.name}:`);
      console.table(data3.files);

      for (const dayFolder of data3.files) {
        const res4 = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${dayFolder.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&pageSize=50`,
          { headers: { Authorization: 'Bearer ' + access_token } }
        );
        const data4 = await res4.json();
        console.log(`\n📄 File di dalam ${dayFolder.name} (${data4.files.length} file):`);
        console.table(data4.files.map((f) => ({ name: f.name, id: f.id })));
      }
    }
  }
}

check().catch(console.error);
