import { useState, useRef } from 'react';
import Icon from '@/components/ui/icon';

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
        lines.push(`${param.key}=${param.value}${param.comment ? ` ; ${param.comment}` : ''}`);
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
                  {['key', 'value', '; comment', ''].map((h, i) => (
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
                  {currentSection.params.map(param => (
                    <div
                      key={param.id}
                      className="grid grid-cols-[1fr_1fr_1fr_32px] px-4 border-b border-border/40 hover:bg-muted/20 group transition-colors"
                    >
                      <input
                        value={param.key}
                        onChange={e => updateParam(currentSection.id, param.id, 'key', e.target.value)}
                        placeholder="key"
                        className="bg-transparent text-sm text-foreground py-2 pr-3 focus:outline-none placeholder:text-muted-foreground/30 w-full"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      />
                      <input
                        value={param.value}
                        onChange={e => updateParam(currentSection.id, param.id, 'value', e.target.value)}
                        placeholder="value"
                        className="bg-transparent text-sm text-primary py-2 px-3 border-l border-border/50 focus:outline-none placeholder:text-muted-foreground/30 w-full"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      />
                      <input
                        value={param.comment}
                        onChange={e => updateParam(currentSection.id, param.id, 'comment', e.target.value)}
                        placeholder="комментарий"
                        className="bg-transparent text-xs text-muted-foreground py-2 px-3 border-l border-border/50 focus:outline-none placeholder:text-muted-foreground/25 w-full"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      />
                      <button
                        onClick={() => removeParam(currentSection.id, param.id)}
                        className="flex items-center justify-center text-transparent group-hover:text-muted-foreground hover:!text-destructive transition-all"
                      >
                        <Icon name="Trash2" size={12} />
                      </button>
                    </div>
                  ))}
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