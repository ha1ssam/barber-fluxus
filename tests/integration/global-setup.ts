import { execSync } from 'node:child_process';

// Aplica as migrações (não apaga nada). Cada teste cria a própria loja, então os dados não se misturam.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL || 'postgresql://fluxus:fluxus@localhost:5432/fluxus_test';
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
}
