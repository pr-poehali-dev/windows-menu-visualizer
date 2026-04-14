
CREATE TABLE t_p50847085_windows_menu_visuali.templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p50847085_windows_menu_visuali.template_sections (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES t_p50847085_windows_menu_visuali.templates(id),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE t_p50847085_windows_menu_visuali.template_params (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES t_p50847085_windows_menu_visuali.template_sections(id),
  comment TEXT DEFAULT '',
  key TEXT NOT NULL,
  value TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);

INSERT INTO t_p50847085_windows_menu_visuali.templates (name) VALUES
  ('Конвертация архива в Postgres'),
  ('Тестирование архива Postgres'),
  ('Тестирование архива');
