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
