import { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';

const TEMPLATES_URL = 'https://functions.poehali.dev/2f365c09-35a6-4325-a6e2-65c8da049559';

interface TemplateParam {
  id: number;
  comment: string;
  key: string;
  value: string;
}

interface TemplateSection {
  id: number;
  name: string;
  params: TemplateParam[];
}

interface Template {
  id: number;
  name: string;
  sections: TemplateSection[];
}

interface IniParam {
  id: string;
  key: string;
  value: string;
  comment: string;
}

interface IniSection {
  id: string;
  name: string;
  params: IniParam[];
}

type Tab = 'files' | 'editor' | 'preview';

const generateId = () => Math.random().toString(36).slice(2, 9);

function parseIni(content: string): IniSection[] {
  const sections: IniSection[] = [];
  let currentSection: IniSection | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = { id: generateId(), name: line.slice(1, -1), params: [] };
      sections.push(currentSection);
    } else if (line.startsWith(';') || line.startsWith('#')) {
      if (!currentSection) { currentSection = { id: generateId(), name: '', params: [] }; sections.push(currentSection); }
      currentSection.params.push({ id: generateId(), key: '', value: '', comment: line.slice(1).trim() });
    } else if (line.includes('=')) {
      if (!currentSection) { currentSection = { id: generateId(), name: '', params: [] }; sections.push(currentSection); }
      const eqIdx = line.indexOf('=');
      const k = line.slice(0, eqIdx).trim();
      const valRaw = line.slice(eqIdx + 1);
      const semiIdx = valRaw.indexOf(';');
      const value = semiIdx >= 0 ? valRaw.slice(0, semiIdx).trim() : valRaw.trim();
      const comment = semiIdx >= 0 ? valRaw.slice(semiIdx + 1).trim() : '';
      currentSection.params.push({ id: generateId(), key: k, value, comment });
    }
  }

  return sections.length > 0 ? sections : [{ id: generateId(), name: 'General', params: [] }];
}

function serializeIni(sections: IniSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    if (section.name) lines.push(`[${section.name}]`);
    for (const param of section.params) {
      if (!param.key && param.comment) {
        lines.push(`; ${param.comment}`);
      } else if (param.key) {
        lines.push(`${param.key}=${param.value}${param.comment ? ` ;${param.comment}` : ';'}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export default function Index() {
  const [tab, setTab] = useState<Tab>('editor');
  const [sections, setSections] = useState<IniSection[]>([
    {
      id: generateId(), name: 'General', params: [
        { id: generateId(), key: 'version', value: '1.0', comment: 'версия конфигурации' },
        { id: generateId(), key: 'debug', value: 'false', comment: '' },
      ]
    }
  ]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileName, setFileName] = useState<string>('config.ini');
  const [activeSection, setActiveSection] = useState<string>(sections[0].id);
  const [notification, setNotification] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);
  const [savingTemplate, setSavingTemplate] = useState<number | null>(null);
  const [localTemplates, setLocalTemplates] = useState<Record<number, TemplateSection[]>>({});

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch(TEMPLATES_URL);
      const data: Template[] = await res.json();
      setTemplates(data);
      const local: Record<number, TemplateSection[]> = {};
      data.forEach(t => { local[t.id] = t.sections; });
      setLocalTemplates(local);
    } catch {
      notify('Ошибка загрузки шаблонов', 'err');
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const saveTemplate = async (templateId: number) => {
    setSavingTemplate(templateId);
    try {
      await fetch(TEMPLATES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, sections: localTemplates[templateId] ?? [] }),
      });
      notify('Шаблон сохранён');
    } catch {
      notify('Ошибка сохранения', 'err');
    } finally {
      setSavingTemplate(null);
    }
  };

  const applyTemplate = (templateId: number) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;
    const newSections: IniSection[] = (localTemplates[templateId] ?? []).map(s => ({
      id: generateId(),
      name: s.name,
      params: s.params.map(p => ({ id: generateId(), key: p.key, value: p.value, comment: p.comment })),
    }));
    if (newSections.length === 0) newSections.push({ id: generateId(), name: 'General', params: [] });
    setSections(newSections);
    setActiveSection(newSections[0].id);
    setTab('editor');
    notify(`Шаблон применён: ${tmpl.name}`);
  };

  const updateLocalSection = (templateId: number, secIdx: number, field: 'name', value: string) => {
    setLocalTemplates(prev => {
      const secs = [...(prev[templateId] ?? [])];
      secs[secIdx] = { ...secs[secIdx], [field]: value };
      return { ...prev, [templateId]: secs };
    });
  };

  const updateLocalParam = (templateId: number, secIdx: number, paramIdx: number, field: keyof TemplateParam, value: string) => {
    setLocalTemplates(prev => {
      const secs = [...(prev[templateId] ?? [])];
      const params = [...secs[secIdx].params];
      params[paramIdx] = { ...params[paramIdx], [field]: value };
      secs[secIdx] = { ...secs[secIdx], params };
      return { ...prev, [templateId]: secs };
    });
  };

  const addLocalSection = (templateId: number) => {
    setLocalTemplates(prev => ({
      ...prev,
      [templateId]: [...(prev[templateId] ?? []), { id: 0, name: 'NewSection', params: [] }],
    }));
  };

  const removeLocalSection = (templateId: number, secIdx: number) => {
    setLocalTemplates(prev => {
      const secs = [...(prev[templateId] ?? [])];
      secs.splice(secIdx, 1);
      return { ...prev, [templateId]: secs };
    });
  };

  const addLocalParam = (templateId: number, secIdx: number) => {
    setLocalTemplates(prev => {
      const secs = [...(prev[templateId] ?? [])];
      const params = [...secs[secIdx].params, { id: 0, comment: '', key: '', value: '' }];
      secs[secIdx] = { ...secs[secIdx], params };
      return { ...prev, [templateId]: secs };
    });
  };

  const removeLocalParam = (templateId: number, secIdx: number, paramIdx: number) => {
    setLocalTemplates(prev => {
      const secs = [...(prev[templateId] ?? [])];
      const params = [...secs[secIdx].params];
      params.splice(paramIdx, 1);
      secs[secIdx] = { ...secs[secIdx], params };
      return { ...prev, [templateId]: secs };
    });
  };

  const notify = (text: string, type: 'ok' | 'err' = 'ok') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const iniContent = serializeIni(sections);

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file.name);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseIni(text);
      setSections(parsed);
      setActiveSection(parsed[0]?.id ?? '');
      setTab('editor');
      notify(`Загружен: ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const f = files[0] as File & { webkitRelativePath?: string };
    const path = f.webkitRelativePath?.split('/')[0] || 'папка выбрана';
    notify(`Папка: ${path}`);
    e.target.value = '';
  };

  const handleSave = () => {
    const blob = new Blob([iniContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'config.ini';
    a.click();
    URL.revokeObjectURL(url);
    notify(`Сохранено: ${fileName}`);
  };

  const addSection = () => {
    const s: IniSection = { id: generateId(), name: 'NewSection', params: [] };
    setSections(prev => [...prev, s]);
    setActiveSection(s.id);
  };

  const removeSection = (id: string) => {
    setSections(prev => {
      const next = prev.filter(s => s.id !== id);
      if (activeSection === id) setActiveSection(next[0]?.id ?? '');
      return next;
    });
  };

  const updateSectionName = (id: string, name: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  const addParam = (sectionId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, params: [...s.params, { id: generateId(), key: '', value: '', comment: '' }] }
        : s
    ));
  };

  const removeParam = (sectionId: string, paramId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, params: s.params.filter(p => p.id !== paramId) } : s
    ));
  };

  const updateParam = (sectionId: string, paramId: string, field: keyof IniParam, value: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, params: s.params.map(p => p.id === paramId ? { ...p, [field]: value } : p) }
        : s
    ));
  };

  const currentSection = sections.find(s => s.id === activeSection) ?? sections[0];

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'files', label: 'Файлы', icon: 'FolderOpen' },
    { id: 'editor', label: 'Редактор', icon: 'Settings2' },
    { id: 'preview', label: 'Превью', icon: 'Eye' },
  ];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-primary text-xs font-semibold tracking-widest uppercase" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>.ini</span>
          <span className="text-muted-foreground text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>/</span>
          <span className="text-foreground text-sm font-medium">{fileName}</span>
          {selectedFile && (
            <span className="text-xs text-muted-foreground border border-border px-2 py-0.5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>загружен</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {notification && (
            <div
              className={`animate-fade-in text-xs px-3 py-1 border ${notification.type === 'ok' ? 'border-primary text-primary' : 'border-destructive text-destructive'}`}
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {notification.text}
            </div>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <Icon name="Download" size={13} />
            Сохранить
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="flex border-b border-border shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">

        {/* FILES TAB */}
        {tab === 'files' && (
          <div className="h-full p-6 overflow-y-auto scrollbar-thin animate-fade-in">
            <div className="max-w-md space-y-3">

              <div className="border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  <Icon name="FileText" size={12} />
                  Загрузить файл
                </div>
                <p className="text-xs text-muted-foreground">Открыть существующий .ini для редактирования</p>
                <input ref={fileInputRef} type="file" accept=".ini,.cfg,.conf,.txt" onChange={handleFileLoad} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border border-border text-xs hover:border-primary hover:text-primary transition-colors"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  <Icon name="Upload" size={13} />
                  Выбрать файл
                </button>
                {selectedFile && (
                  <div className="flex items-center gap-2 text-xs text-primary" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    <Icon name="Check" size={12} /> {selectedFile}
                  </div>
                )}
              </div>

              <div className="border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  <Icon name="FolderOpen" size={12} />
                  Папка для сохранения
                </div>
                <p className="text-xs text-muted-foreground">Укажите папку, куда сохранится файл</p>
                <input ref={folderInputRef} type="file" onChange={handleFolderSelect} className="hidden" />
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border border-border text-xs hover:border-primary hover:text-primary transition-colors"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  <Icon name="Folder" size={13} />
                  Выбрать папку
                </button>
              </div>

              <div className="border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  <Icon name="Pencil" size={12} />
                  Имя файла
                </div>
                <input
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  placeholder="config.ini"
                  className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </div>

              {/* TEMPLATES BLOCK */}
              <div className="border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    <Icon name="LayoutTemplate" size={12} />
                    Шаблоны
                  </div>
                  {templatesLoading && <span className="text-xs text-muted-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>загрузка...</span>}
                </div>
                <p className="text-xs text-muted-foreground">Выберите готовый шаблон и настройте его перед применением</p>

                <div className="space-y-2">
                  {templates.map(tmpl => {
                    const isOpen = expandedTemplate === tmpl.id;
                    const secs = localTemplates[tmpl.id] ?? [];
                    return (
                      <div key={tmpl.id} className="border border-border">
                        {/* Template header */}
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors">
                          <button
                            onClick={() => setExpandedTemplate(isOpen ? null : tmpl.id)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={12} className="text-muted-foreground shrink-0" />
                            <span className="text-xs text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{tmpl.name}</span>
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => saveTemplate(tmpl.id)}
                              disabled={savingTemplate === tmpl.id}
                              title="Сохранить шаблон"
                              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground border border-border hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
                              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                              <Icon name="Save" size={11} />
                              {savingTemplate === tmpl.id ? '...' : 'сохранить'}
                            </button>
                            <button
                              onClick={() => applyTemplate(tmpl.id)}
                              title="Применить шаблон в редактор"
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                              <Icon name="Play" size={11} />
                              применить
                            </button>
                          </div>
                        </div>

                        {/* Expanded editor */}
                        {isOpen && (
                          <div className="border-t border-border">
                            {secs.map((sec, secIdx) => (
                              <div key={secIdx} className="border-b border-border/50 last:border-b-0">
                                {/* Section name */}
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/20">
                                  <span className="text-muted-foreground text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>[</span>
                                  <input
                                    value={sec.name}
                                    onChange={e => updateLocalSection(tmpl.id, secIdx, 'name', e.target.value)}
                                    className="flex-1 bg-transparent text-xs text-foreground focus:outline-none"
                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                  />
                                  <span className="text-muted-foreground text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>]</span>
                                  <button onClick={() => removeLocalSection(tmpl.id, secIdx)} className="text-muted-foreground hover:text-destructive transition-colors">
                                    <Icon name="X" size={11} />
                                  </button>
                                </div>
                                {/* Column headers */}
                                <div className="grid grid-cols-[1fr_1fr_1fr_24px] px-3 py-1 border-b border-border/30">
                                  {['; comment', 'key', 'value', ''].map((h, i) => (
                                    <span key={i} className="text-xs text-muted-foreground/60" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{h}</span>
                                  ))}
                                </div>
                                {/* Params */}
                                {sec.params.map((param, paramIdx) => (
                                  <div key={paramIdx} className="grid grid-cols-[1fr_1fr_1fr_24px] px-3 border-b border-border/20 last:border-b-0 hover:bg-muted/10 group">
                                    <input
                                      value={param.comment}
                                      onChange={e => updateLocalParam(tmpl.id, secIdx, paramIdx, 'comment', e.target.value)}
                                      placeholder="комментарий"
                                      className="bg-transparent text-xs text-muted-foreground py-1.5 pr-2 focus:outline-none placeholder:text-muted-foreground/25 w-full"
                                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                    />
                                    <input
                                      value={param.key}
                                      onChange={e => updateLocalParam(tmpl.id, secIdx, paramIdx, 'key', e.target.value)}
                                      placeholder="key"
                                      className="bg-transparent text-xs text-foreground py-1.5 px-2 border-l border-border/30 focus:outline-none placeholder:text-muted-foreground/30 w-full"
                                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                    />
                                    <input
                                      value={param.value}
                                      onChange={e => updateLocalParam(tmpl.id, secIdx, paramIdx, 'value', e.target.value)}
                                      placeholder="value"
                                      className="bg-transparent text-xs text-primary py-1.5 px-2 border-l border-border/30 focus:outline-none placeholder:text-muted-foreground/30 w-full"
                                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                    />
                                    <button
                                      onClick={() => removeLocalParam(tmpl.id, secIdx, paramIdx)}
                                      className="flex items-center justify-center text-transparent group-hover:text-muted-foreground hover:!text-destructive transition-all"
                                    >
                                      <Icon name="Trash2" size={10} />
                                    </button>
                                  </div>
                                ))}
                                {/* Add param */}
                                <button
                                  onClick={() => addLocalParam(tmpl.id, secIdx)}
                                  className="w-full flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                >
                                  <Icon name="Plus" size={10} /> добавить параметр
                                </button>
                              </div>
                            ))}
                            {/* Add section */}
                            <button
                              onClick={() => addLocalSection(tmpl.id)}
                              className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-primary border-t border-border/30 transition-colors"
                              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                              <Icon name="Plus" size={10} /> добавить секцию
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* EDITOR TAB */}
        {tab === 'editor' && (
          <div className="h-full flex overflow-hidden animate-fade-in">
            {/* Sections sidebar */}
            <div className="w-44 border-r border-border flex flex-col shrink-0">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <span className="text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Секции</span>
                <button onClick={addSection} className="text-muted-foreground hover:text-primary transition-colors">
                  <Icon name="Plus" size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {sections.map(s => (
                  <div
                    key={s.id}
                    className={`group flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors ${
                      activeSection === s.id
                        ? 'bg-muted text-foreground border-l-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-l-2 border-transparent'
                    }`}
                    onClick={() => setActiveSection(s.id)}
                  >
                    <span className="text-xs truncate" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{s.name || '(без имени)'}</span>
                    <button
                      onClick={e => { e.stopPropagation(); removeSection(s.id); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-1 shrink-0"
                    >
                      <Icon name="X" size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Params area */}
            {currentSection && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Section name */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
                  <span className="text-muted-foreground text-sm" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>[</span>
                  <input
                    value={currentSection.name}
                    onChange={e => updateSectionName(currentSection.id, e.target.value)}
                    className="bg-transparent text-sm text-foreground focus:outline-none flex-1 min-w-0"
                    placeholder="SectionName"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  />
                  <span className="text-muted-foreground text-sm" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>]</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {currentSection.params.length} params
                  </span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_1fr_1fr_32px] px-4 py-2 border-b border-border shrink-0">
                  {['; comment', 'key', 'value', ''].map((h, i) => (
                    <span key={i} className="text-xs text-muted-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{h}</span>
                  ))}
                </div>

                {/* Params list */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  {currentSection.params.length === 0 && (
                    <div className="px-4 py-10 text-center text-xs text-muted-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      нет параметров
                    </div>
                  )}
                  {currentSection.params.map(param => {
                    const isUncPath = param.value.startsWith('\\\\');
                    return (
                    <div
                      key={param.id}
                      className="grid grid-cols-[1fr_1fr_1fr_32px] px-4 border-b border-border/40 hover:bg-muted/20 group transition-colors"
                    >
                      <input
                        value={param.comment}
                        onChange={e => updateParam(currentSection.id, param.id, 'comment', e.target.value)}
                        placeholder="комментарий"
                        className="bg-transparent text-xs text-muted-foreground py-2 pr-3 focus:outline-none placeholder:text-muted-foreground/25 w-full"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      />
                      <input
                        value={param.key}
                        onChange={e => updateParam(currentSection.id, param.id, 'key', e.target.value)}
                        placeholder="key"
                        className="bg-transparent text-sm text-foreground py-2 px-3 border-l border-border/50 focus:outline-none placeholder:text-muted-foreground/30 w-full"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      />
                      <div className="flex items-center border-l border-border/50 px-3 gap-1.5 min-w-0">
                        <input
                          value={param.value}
                          onChange={e => updateParam(currentSection.id, param.id, 'value', e.target.value)}
                          placeholder="value"
                          className="bg-transparent text-sm text-primary py-2 focus:outline-none placeholder:text-muted-foreground/30 w-full min-w-0"
                          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        />
                        {isUncPath && (
                          <button
                            title={`Открыть в проводнике: ${param.value}`}
                            onClick={() => {
                              const path = param.value.replace(/\\/g, '/');
                              window.open(`file://${path}`, '_blank');
                            }}
                            className="shrink-0 flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Icon name="FolderOpen" size={13} />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => removeParam(currentSection.id, param.id)}
                        className="flex items-center justify-center text-transparent group-hover:text-muted-foreground hover:!text-destructive transition-all"
                      >
                        <Icon name="Trash2" size={12} />
                      </button>
                    </div>
                    );
                  })}
                </div>

                {/* Add param */}
                <div className="border-t border-border px-4 py-2.5 shrink-0">
                  <button
                    onClick={() => addParam(currentSection.id)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    <Icon name="Plus" size={12} />
                    добавить параметр
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PREVIEW TAB */}
        {tab === 'preview' && (
          <div className="h-full flex flex-col overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
              <span className="text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {fileName}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(iniContent); notify('Скопировано'); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                <Icon name="Copy" size={12} />
                копировать
              </button>
            </div>
            <pre className="flex-1 overflow-auto scrollbar-thin p-5 text-sm leading-relaxed whitespace-pre" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {iniContent.split('\n').map((line, i) => {
                if (line.startsWith('[')) {
                  return <span key={i} className="block text-primary font-semibold">{line}{'\n'}</span>;
                } else if (line.startsWith(';') || line.startsWith('#')) {
                  return <span key={i} className="block text-muted-foreground">{line}{'\n'}</span>;
                } else if (line.includes('=')) {
                  const eqIdx = line.indexOf('=');
                  const k = line.slice(0, eqIdx);
                  const rest = line.slice(eqIdx + 1);
                  return (
                    <span key={i} className="block">
                      <span className="text-foreground">{k}</span>
                      <span className="text-muted-foreground">=</span>
                      <span className="text-primary">{rest}</span>
                      {'\n'}
                    </span>
                  );
                }
                return <span key={i} className="block text-muted-foreground/20">{line || ' '}{'\n'}</span>;
              })}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}