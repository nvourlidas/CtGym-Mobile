// app/api/templates.ts
import { supabase } from '../lib/supabase';

export type AssignedTemplateRow = {
  assignment_id: string;
  template_id: string;
  status: string | null;
  message: string | null;
  assigned_at: string | null;

  template: {
    id: string;
    name: string | null;
    notes: string | null;
    created_at: string;
    coach_id: string | null;
  } | null;
};

type ExerciseCatalogMini = {
  wger_id: number;
  name: string | null;
  images?: Array<{ url?: string | null; is_main?: boolean | null }> | null;
};

export type TemplateDetail = {
  id: string;
  name: string | null;
  notes: string | null;
  created_at: string;
  coach_id: string | null;

  exercises: Array<{
    id: string;
    exercise_wger_id: number;
    sort_order: number;
    exercise: ExerciseCatalogMini | null;
    sets: Array<{
      id: string;
      set_no: number;
      reps: number | null;
      weight: number | null;
      weight_unit: string | null;
    }>;
  }>;
};

export async function listAssignedTemplates(opts: {
  tenantId: string;
  memberId: string;
  limit?: number;
}): Promise<AssignedTemplateRow[]> {
  const { tenantId, memberId, limit = 60 } = opts;

  const { data, error } = await supabase
    .from('workout_template_assignments')
    .select(
      `
      id,
      template_id,
      status,
      message,
      created_at,
      template:workout_templates (
        id,
        name,
        notes,
        created_at,
        coach_id
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    assignment_id: r.id,
    template_id: r.template_id,
    status: r.status ?? null,
    message: r.message ?? null,
    assigned_at: r.created_at ?? null,
    template: r.template ?? null,
  }));
}

export async function getTemplateDetail(opts: {
  tenantId: string;
  templateId: string;
}): Promise<TemplateDetail> {
  const { tenantId, templateId } = opts;

  // 1) Header
  const { data: header, error: hErr } = await supabase
    .from('workout_templates')
    .select('id,name,notes,created_at,coach_id')
    .eq('tenant_id', tenantId)
    .eq('id', templateId)
    .single();

  if (hErr) throw hErr;

  // 2) Exercises + sets (NO join to exercise_catalog)
  const { data: exRows, error: exErr } = await supabase
    .from('workout_template_exercises')
    .select(
      `
      id,
      template_id,
      exercise_wger_id,
      sort_order,
      sets:workout_template_sets (
        id,
        set_no,
        reps,
        weight,
        weight_unit
      )
    `,
    )
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true });

  if (exErr) throw exErr;

  const raw = (exRows ?? []) as any[];

  // 3) Fetch catalog rows manually (because exercise_catalog is a VIEW)
  const wgerIds = Array.from(new Set(raw.map((x) => x.exercise_wger_id).filter(Boolean)));

  let catalog: ExerciseCatalogMini[] = [];
  if (wgerIds.length) {
    const { data: exData, error: catErr } = await supabase
      .from('exercise_catalog')
      .select('wger_id,name,images')
      .in('wger_id', wgerIds);

    if (catErr) throw catErr;
    catalog = (exData ?? []) as any;
  }

  const byWgerId = new Map<number, ExerciseCatalogMini>();
  for (const ex of catalog) byWgerId.set(Number(ex.wger_id), ex);

  return {
    id: header.id,
    name: header.name ?? null,
    notes: header.notes ?? null,
    created_at: header.created_at,
    coach_id: header.coach_id ?? null,
    exercises: raw.map((x: any) => ({
      id: x.id,
      exercise_wger_id: Number(x.exercise_wger_id),
      sort_order: x.sort_order ?? 0,
      exercise: byWgerId.get(Number(x.exercise_wger_id)) ?? null,
      sets: (x.sets ?? [])
        .slice()
        .sort((a: any, b: any) => (a.set_no ?? 0) - (b.set_no ?? 0))
        .map((s: any) => ({
          id: s.id,
          set_no: s.set_no,
          reps: s.reps ?? null,
          weight: s.weight ?? null,
          weight_unit: s.weight_unit ?? null,
        })),
    })),
  };
}
