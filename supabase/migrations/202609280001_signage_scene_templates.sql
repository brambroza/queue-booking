-- Signage scene templates and light palettes.
--
-- Adds the ids the 2D scene templates use to the two CHECK constraints created in
-- 202609100001_signage_templates.sql. No column is added and no row is changed:
-- existing shops keep their template and theme.
--
-- Must run before a shop can SAVE one of the new templates or themes in
-- /portal/signage. Until then the save fails with a check violation; displaying
-- them through /display/[shopKey]?template=...&theme=... works without it.
--
-- Keep both lists identical to SIGNAGE_TEMPLATES / SIGNAGE_THEMES in
-- src/lib/signage/types.ts.

alter table if exists public.signage_settings drop constraint if exists signage_settings_template_check;
alter table if exists public.signage_settings add constraint signage_settings_template_check
  check (template in (
    'classic', 'spotlight', 'counter', 'board', 'minimal',
    'lane', 'timeline', 'route', 'floor', 'invite', 'flap'
  ));

alter table if exists public.signage_settings drop constraint if exists signage_settings_theme_check;
alter table if exists public.signage_settings add constraint signage_settings_theme_check
  check (theme in (
    'emerald', 'midnight', 'restaurant', 'clinic', 'meeting', 'nail', 'light',
    'day_navy', 'day_teal', 'day_brick', 'day_chili', 'day_indigo', 'day_court', 'day_rose', 'day_lime'
  ));

comment on column public.signage_settings.template is 'Signage layout template id (see src/lib/signage/types.ts). lane/timeline/route/floor/invite/flap are the 2D scene templates.';
