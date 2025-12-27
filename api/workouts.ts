import { supabase } from '../lib/supabase';

export type WorkoutRow = {
  id: string;
  performed_at: string;
  notes: string | null;
  workout_exercises?: Array<{ id: string }>;
};

export async function listMyWorkouts(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('workouts')
    .select('id,performed_at,notes,workout_exercises(id)')
    .eq('user_id', userId)
    .order('performed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as WorkoutRow[];
}

export async function createWorkout(userId: string, performedAtISO: string, notes?: string | null) {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, performed_at: performedAtISO, notes: notes ?? null })
    .select('id')
    .single();

  if (error) throw error;
  return data as { id: string };
}

export async function addWorkoutExercise(workoutId: string, wgerId: number, sortOrder: number) {
  const { data, error } = await supabase
    .from('workout_exercises')
    .insert({ workout_id: workoutId, exercise_wger_id: wgerId, sort_order: sortOrder })
    .select('id')
    .single();

  if (error) throw error;
  return data as { id: string };
}

export async function addWorkoutSets(workoutExerciseId: string, sets: Array<{
  set_no: number;
  reps: number | null;
  weight: number | null;
  weight_unit?: string;
}>) {
  const payload = sets.map(s => ({
    workout_exercise_id: workoutExerciseId,
    set_no: s.set_no,
    reps: s.reps,
    weight: s.weight,
    weight_unit: s.weight_unit ?? 'kg',
  }));

  const { error } = await supabase.from('workout_sets').insert(payload);
  if (error) throw error;
}

import type { ExerciseCatalogRow } from './exercises';

export type WorkoutDetail = {
  id: string;
  performed_at: string;
  notes: string | null;
  exercises: Array<{
    id: string;
    sort_order: number;
    exercise_wger_id: number;
    exercise?: Pick<ExerciseCatalogRow, 'wger_id' | 'name' | 'category_name' | 'images'> | null;
    sets: Array<{
      id: string;
      set_no: number;
      reps: number | null;
      weight: number | null;
      weight_unit: string;
      rir?: number | null;
      rest_seconds?: number | null;
      notes?: string | null;
    }>;
  }>;
};

export async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetail> {
  const { data, error } = await supabase
    .from('workouts')
    .select(
      `
      id,
      performed_at,
      notes,
      workout_exercises (
        id,
        sort_order,
        exercise_wger_id,
        workout_sets (
          id,
          set_no,
          reps,
          weight,
          weight_unit,
          rir,
          rest_seconds,
          notes
        )
      )
    `,
    )
    .eq('id', workoutId)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Workout not found');

  const rawExercises = (data.workout_exercises ?? []) as any[];

  const wgerIds = Array.from(
    new Set(rawExercises.map(x => x.exercise_wger_id).filter(Boolean)),
  );

  let catalog: Array<any> = [];
  if (wgerIds.length) {
    const { data: exData, error: exErr } = await supabase
      .from('exercise_catalog')
      .select('wger_id,name,category_name,images')
      .in('wger_id', wgerIds);

    if (exErr) throw exErr;
    catalog = exData ?? [];
  }

  const byWgerId = new Map<number, any>();
  for (const ex of catalog) byWgerId.set(ex.wger_id, ex);

  const exercises = rawExercises
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(ex => ({
      id: ex.id as string,
      sort_order: ex.sort_order ?? 0,
      exercise_wger_id: ex.exercise_wger_id as number,
      exercise: byWgerId.get(ex.exercise_wger_id) ?? null,
      sets: (ex.workout_sets ?? [])
        .slice()
        .sort((s1: any, s2: any) => (s1.set_no ?? 0) - (s2.set_no ?? 0))
        .map((s: any) => ({
          id: s.id,
          set_no: s.set_no,
          reps: s.reps,
          weight: s.weight,
          weight_unit: s.weight_unit ?? 'kg',
          rir: s.rir ?? null,
          rest_seconds: s.rest_seconds ?? null,
          notes: s.notes ?? null,
        })),
    }));

  return {
    id: data.id,
    performed_at: data.performed_at,
    notes: data.notes ?? null,
    exercises,
  };
}

