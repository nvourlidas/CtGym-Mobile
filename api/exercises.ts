import { supabase } from '../lib/supabase';

export type ExerciseCatalogRow = {
  wger_id: number;
  name: string;
  category_name: string | null;
  equipment: Array<{ id: number; name: string }> | null;
  muscles: Array<{ id: number; name: string; role: 'primary' | 'secondary' }> | null;
  images: Array<{ id: number; url: string; is_main: boolean }> | null;
  videos: Array<{ id: number; url: string; is_main: boolean }> | null;
  instructions_html: string | null;
};

export async function searchExercises(q: string, limit = 30) {
  const query = q.trim();
  if (!query) return [];

  const { data, error } = await supabase
    .from('exercise_catalog')
    .select(
      'wger_id,name,category_name,equipment,muscles,images,videos,instructions_html',
    )
    .ilike('name', `%${query}%`)
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ExerciseCatalogRow[];
}


export async function getWgerCategories(): Promise<{ id: number; name: string }[]> {
  const { data, error } = await supabase
    .from('wger_exercise_categories')
    .select('id,name')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getWgerEquipment(): Promise<{ id: number; name: string }[]> {
  const { data, error } = await supabase
    .from('wger_equipment')
    .select('id,name')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}


export async function getExercisesByCategoryAndEquipment(params: {
  categoryId: number;
  equipmentId?: number | null; // null/undefined => all equipment
  q?: string;
  limit?: number;
}): Promise<ExerciseCatalogRow[]> {
  const { categoryId, equipmentId = null, q = '', limit = 60 } = params;

  // Base: από exercises με category_id
  // Αν equipmentId υπάρχει -> inner join στη wger_exercise_equipment
  let queryBuilder = supabase
    .from('wger_exercises')
    .select(
      `
    id,
    category_id,
    raw,
    wger_exercise_categories!inner(name),
    wger_exercise_equipment${equipmentId ? '!inner' : ''}(equipment_id),
    wger_exercise_translations!inner(
      name,
      description,
      language_id
    )
  `,
    )
    .eq('category_id', categoryId)
    .eq('wger_exercise_translations.language_id', 2); // ✅ ENGLISH ONLY


  if (equipmentId) {
    queryBuilder = queryBuilder.eq(
      'wger_exercise_equipment.equipment_id',
      equipmentId,
    );
  }


  // Name search:
  // ✅ Αν έχεις στήλη name στο wger_exercises, χρησιμοποίησε αυτή:
  // queryBuilder = q.trim() ? queryBuilder.ilike('name', `%${q.trim()}%`) : queryBuilder;

  // ✅ Αν ΔΕΝ έχεις στήλη name και είναι μέσα στο raw (π.χ. raw->>'name'):
  // PostgREST δεν υποστηρίζει πάντα json path ilike. Αν θες αυτό 100%, κάνε view (θα σου πω παρακάτω).
  // Για τώρα: κάνουμε search στον client (κάτω).

  const { data, error } = await queryBuilder.limit(limit);

  if (error) throw error;

const rows = (data ?? []).map((r: any) => {
  const t = Array.isArray(r.wger_exercise_translations)
    ? r.wger_exercise_translations[0]
    : null;

  return {
    wger_id: r.id,
    name: t?.name ?? '-', // ✅ guaranteed EN
    category_name: r.wger_exercise_categories?.name ?? null,
    equipment: pickEquipmentFromRaw(r.raw),
    muscles: pickMusclesFromRaw(r.raw),
    images: pickImagesFromRaw(r.raw),
    videos: pickVideosFromRaw(r.raw),
    instructions_html: t?.description ?? null,
  } satisfies ExerciseCatalogRow;
});



  // Client-side search fallback (αν name είναι μόνο στο raw):
  const qq = q.trim().toLowerCase();
  if (!qq) return rows;
  return rows.filter((x) => (x.name ?? '').toLowerCase().includes(qq));
}


function pickExerciseNameFromRaw(raw: any): string {
  const translations = Array.isArray(raw?.translations) ? raw.translations : [];
  const name = translations.find((t: any) => typeof t?.name === 'string' && t.name.trim())?.name;
  return (name?.trim() || '-');
}

function pickInstructionsHtmlFromRaw(raw: any): string | null {
  const translations = Array.isArray(raw?.translations) ? raw.translations : [];
  const desc = translations.find((t: any) => typeof t?.description === 'string')?.description;
  return typeof desc === 'string' && desc.trim() ? desc : null;
}

function pickImagesFromRaw(raw: any): Array<{ id: number; url: string; is_main: boolean }> | null {
  const imgs = Array.isArray(raw?.images) ? raw.images : [];
  const mapped = imgs
    .map((i: any, idx: number) => {
      const url = i?.url ?? i?.image ?? null;
      if (typeof url !== 'string' || !url) return null;
      return {
        id: Number.isFinite(i?.id) ? Number(i.id) : idx + 1, // ✅ ensure id exists
        url,
        is_main: Boolean(i?.is_main),
      };
    })
    .filter(Boolean) as Array<{ id: number; url: string; is_main: boolean }>;

  return mapped.length ? mapped : null;
}

function pickVideosFromRaw(raw: any): Array<{ id: number; url: string; is_main: boolean }> | null {
  const vids = Array.isArray(raw?.videos) ? raw.videos : [];
  const mapped = vids
    .map((v: any, idx: number) => {
      const url = v?.url ?? v?.video ?? null;
      if (typeof url !== 'string' || !url) return null;
      return {
        id: Number.isFinite(v?.id) ? Number(v.id) : idx + 1,
        url,
        is_main: Boolean(v?.is_main),
      };
    })
    .filter(Boolean) as Array<{ id: number; url: string; is_main: boolean }>;

  return mapped.length ? mapped : null;
}

function pickEquipmentFromRaw(raw: any): Array<{ id: number; name: string }> | null {
  const eq = Array.isArray(raw?.equipment) ? raw.equipment : [];
  const mapped = eq
    .map((e: any) => {
      const id = Number(e?.id);
      const name = e?.name;
      if (!Number.isFinite(id) || typeof name !== 'string') return null;
      return { id, name };
    })
    .filter(Boolean) as Array<{ id: number; name: string }>;
  return mapped.length ? mapped : null;
}

function pickMusclesFromRaw(
  raw: any,
): Array<{ id: number; name: string; role: 'primary' | 'secondary' }> | null {
  const prim = Array.isArray(raw?.muscles) ? raw.muscles : [];
  const sec = Array.isArray(raw?.muscles_secondary) ? raw.muscles_secondary : [];

  const mapOne = (m: any, role: 'primary' | 'secondary') => {
    const id = Number(m?.id);
    const name = m?.name;
    if (!Number.isFinite(id) || typeof name !== 'string') return null;
    return { id, name, role };
  };

  const out = [
    ...prim.map((m: any) => mapOne(m, 'primary')),
    ...sec.map((m: any) => mapOne(m, 'secondary')),
  ].filter(Boolean) as Array<{ id: number; name: string; role: 'primary' | 'secondary' }>;

  return out.length ? out : null;
}
