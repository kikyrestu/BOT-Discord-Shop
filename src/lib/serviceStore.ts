import { pool } from './db';
import { Service } from '../config';

function rowToService(row: any): Service {
    return {
        id:        row.id,
        name:      row.name,
        color:     row.color,
        emoji:     row.emoji,
        title:     row.title,
        desc:      row.description,
        stack:     row.stack,
        features:  row.features,
        price:     row.price,
        eta:       row.eta,
        thumbnail: row.thumbnail,
    };
}

export async function getAllServices(): Promise<Service[]> {
    const { rows } = await pool.query('SELECT * FROM services ORDER BY id');
    return rows.map(rowToService);
}

export async function getService(id: string): Promise<Service | undefined> {
    const { rows } = await pool.query('SELECT * FROM services WHERE id = $1', [id]);
    return rows[0] ? rowToService(rows[0]) : undefined;
}

export async function updateService(
    id: string,
    patch: Partial<Omit<Service, 'id' | 'name' | 'emoji' | 'color'>>
): Promise<Service | null> {
    const updates: string[] = [];
    const values:  any[]    = [];
    let i = 1;

    if (patch.desc      !== undefined) { updates.push(`description = $${i++}`); values.push(patch.desc); }
    if (patch.price     !== undefined) { updates.push(`price = $${i++}`);       values.push(patch.price); }
    if (patch.eta       !== undefined) { updates.push(`eta = $${i++}`);         values.push(patch.eta); }
    if (patch.stack     !== undefined) { updates.push(`stack = $${i++}`);       values.push(JSON.stringify(patch.stack)); }
    if (patch.features  !== undefined) { updates.push(`features = $${i++}`);   values.push(JSON.stringify(patch.features)); }
    if (patch.thumbnail !== undefined) { updates.push(`thumbnail = $${i++}`);  values.push(patch.thumbnail); }

    if (updates.length === 0) return (await getService(id)) ?? null;

    values.push(id);
    const { rows } = await pool.query(
        `UPDATE services SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
        values
    );
    return rows[0] ? rowToService(rows[0]) : null;
}
