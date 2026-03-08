import { pool } from './lib/db';

// In-memory cache, di-load dari DB saat startup
export let PROJECT_CAT_ID: string = '';

export async function loadProjectCatId(): Promise<void> {
    const { rows } = await pool.query(`SELECT value FROM bot_state WHERE key = 'project_cat_id'`);
    PROJECT_CAT_ID = rows[0]?.value ?? '';
}

export async function setProjectCatId(id: string): Promise<void> {
    PROJECT_CAT_ID = id;
    await pool.query(
        `INSERT INTO bot_state(key, value) VALUES('project_cat_id', $1)
         ON CONFLICT(key) DO UPDATE SET value = $1`,
        [id]
    );
}
