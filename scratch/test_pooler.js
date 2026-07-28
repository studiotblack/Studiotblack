const postgres = require('postgres');

async function testConnection(url, name) {
  console.log(`\n--- Testando ${name} ---`);
  try {
    const sql = postgres(url, { ssl: 'require', connect_timeout: 5 });
    const res = await sql`SELECT NOW()`;
    console.log(`✅ CONECTADO COM SUCESSO! (${name})`, res);
    await sql.end();
    return true;
  } catch (err) {
    console.error(`❌ ERRO (${name}):`, err.message || err);
    return false;
  }
}

async function run() {
  const password = "Studiotblack2026";
  const proj = "cygnvvkagssqxmnbupld";

  const urls = [
    { name: "Direct db.cygnvvkagssqxmnbupld.supabase.co:5432", url: `postgresql://postgres:${password}@db.${proj}.supabase.co:5432/postgres` },
    { name: "Pooler Session postgres.cygnvvkagssqxmnbupld (6543 sa-east-1)", url: `postgresql://postgres.${proj}:${password}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres` },
    { name: "Pooler Session postgres (6543 sa-east-1)", url: `postgresql://postgres:${password}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres` },
    { name: "Pooler Session postgres (5432 sa-east-1)", url: `postgresql://postgres:${password}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres` },
    { name: "Pooler Transaction postgres.cygnvvkagssqxmnbupld (5432 db.cygnvvkagssqxmnbupld.supabase.co)", url: `postgresql://postgres.${proj}:${password}@db.${proj}.supabase.co:5432/postgres` },
    { name: "Pooler Transaction postgres.cygnvvkagssqxmnbupld (6543 db.cygnvvkagssqxmnbupld.supabase.co)", url: `postgresql://postgres.${proj}:${password}@db.${proj}.supabase.co:6543/postgres` },
    { name: "Pooler us-east-1 postgres.cygnvvkagssqxmnbupld (6543)", url: `postgresql://postgres.${proj}:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres` },
    { name: "Pooler us-east-2 postgres.cygnvvkagssqxmnbupld (6543)", url: `postgresql://postgres.${proj}:${password}@aws-0-us-east-2.pooler.supabase.com:6543/postgres` },
  ];

  for (const item of urls) {
    const ok = await testConnection(item.url, item.name);
    if (ok) {
      console.log("\n🎯 ENCONTRADO O LINK CORRETO:", item.url);
      break;
    }
  }
  process.exit(0);
}

run();
