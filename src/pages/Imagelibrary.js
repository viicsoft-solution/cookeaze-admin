import { useState, useRef } from "react";

const API_BASE = "/api/v1";
export const api = {
  images: {
    list: (params) => fetchMock("GET", `${API_BASE}/images`, params),
    upload: (form) => fetchMock("POST", `${API_BASE}/images/upload`, form),
    update: (id, d) => fetchMock("PUT", `${API_BASE}/images/${id}`, d),
    delete: (id) => fetchMock("DEL", `${API_BASE}/images/${id}`),
    bulkTag: (ids, t) =>
      fetchMock("POST", `${API_BASE}/images/bulk-tag`, { ids, tags: t }),
    bulkDelete: (ids) =>
      fetchMock("POST", `${API_BASE}/images/bulk-delete`, { ids }),
  },
  tags: {
    list: () => fetchMock("GET", `${API_BASE}/tags`),
    create: (tag) => fetchMock("POST", `${API_BASE}/tags`, tag),
  },
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchMock(method, url, payload) {
  await delay(350);
  console.log(`[MOCK] ${method} ${url}`, payload ?? "");
  return { ok: true, data: payload };
}

const FOOD_IMAGES = [
  {
    id: "1",
    url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600",
    thumb: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300",
    name: "Jollof Rice Classic",
    tags: ["jollof rice", "rice", "nigerian"],
    synonyms: ["party rice", "jellof"],
    uploadedAt: "2024-12-01",
  },
  {
    id: "2",
    url: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600",
    thumb: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300",
    name: "Fried Rice Bowl",
    tags: ["fried rice", "rice", "chinese"],
    synonyms: ["egg fried rice"],
    uploadedAt: "2025-01-15",
  },
  {
    id: "3",
    url: "https://images.unsplash.com/photo-1574484284002-952d92456975?w=600",
    thumb: "https://images.unsplash.com/photo-1574484284002-952d92456975?w=300",
    name: "Grilled Chicken",
    tags: ["chicken", "grilled", "protein"],
    synonyms: ["BBQ chicken"],
    uploadedAt: "2025-01-20",
  },
  {
    id: "4",
    url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600",
    thumb: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300",
    name: "Egusi Soup",
    tags: ["egusi", "soup", "nigerian"],
    synonyms: ["melon soup"],
    uploadedAt: "2025-02-01",
  },
  {
    id: "5",
    url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600",
    thumb: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300",
    name: "Pizza Margherita",
    tags: ["pizza", "italian", "cheese"],
    synonyms: ["margarita pizza"],
    uploadedAt: "2025-02-10",
  },
  {
    id: "6",
    url: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600",
    thumb: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=300",
    name: "Pasta Carbonara",
    tags: ["pasta", "italian", "egg"],
    synonyms: ["creamy pasta"],
    uploadedAt: "2025-02-14",
  },
  {
    id: "7",
    url: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600",
    thumb: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=300",
    name: "Avocado Toast",
    tags: ["avocado", "toast", "breakfast"],
    synonyms: ["avo toast"],
    uploadedAt: "2025-02-20",
  },
  {
    id: "8",
    url: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600",
    thumb: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=300",
    name: "Garden Salad",
    tags: ["salad", "vegetables", "healthy"],
    synonyms: ["green salad", "toss salad"],
    uploadedAt: "2025-03-01",
  },
  {
    id: "9",
    url: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600",
    thumb: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300",
    name: "Chocolate Cake",
    tags: ["cake", "dessert", "chocolate"],
    synonyms: ["choc cake", "dark cake"],
    uploadedAt: "2025-03-05",
  },
  {
    id: "10",
    url: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=600",
    thumb: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=300",
    name: "Burger Classic",
    tags: ["burger", "beef", "fast food"],
    synonyms: ["hamburger", "beef burger"],
    uploadedAt: "2025-03-10",
  },
  {
    id: "11",
    url: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=600",
    thumb: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=300",
    name: "Suya Skewers",
    tags: ["suya", "beef", "nigerian", "grilled"],
    synonyms: ["nigerian suya", "street meat"],
    uploadedAt: "2025-03-15",
  },
  {
    id: "12",
    url: "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=600",
    thumb: "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=300",
    name: "Pancake Stack",
    tags: ["pancake", "breakfast", "sweet"],
    synonyms: ["flapjacks", "hotcakes"],
    uploadedAt: "2025-03-20",
  },
];

const ALL_TAGS = [...new Set(FOOD_IMAGES.flatMap((i) => i.tags))].sort();

export default function ImageLibrary() {
  const [images, setImages] = useState(FOOD_IMAGES);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [hovered, setHovered] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showBulkTag, setShowBulkTag] = useState(false);
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);
  const fileRef = useRef();

  const filtered = images.filter((img) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      img.name.toLowerCase().includes(q) ||
      img.tags.some((t) => t.includes(q)) ||
      img.synonyms.some((s) => s.includes(q));
    const matchTag = filterTag === "all" || img.tags.includes(filterTag);
    return matchSearch && matchTag;
  });

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelected(new Set(filtered.map((i) => i.id)));
  const clearSelect = () => {
    setSelected(new Set());
    setShowBulkTag(false);
    setConfirmBulkDel(false);
  };

  const applyBulkTag = async () => {
    if (!bulkTagInput.trim()) return;
    const newTags = bulkTagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await api.images.bulkTag([...selected], newTags);
    setImages((imgs) =>
      imgs.map((img) =>
        selected.has(img.id)
          ? { ...img, tags: [...new Set([...img.tags, ...newTags])] }
          : img,
      ),
    );
    notify(
      `Tags added to ${selected.size} image${selected.size !== 1 ? "s" : ""}`,
    );
    setBulkTagInput("");
    clearSelect();
  };

  const bulkDelete = async () => {
    const count = selected.size;
    await api.images.bulkDelete([...selected]);
    setImages((imgs) => imgs.filter((i) => !selected.has(i.id)));
    notify(`${count} image${count !== 1 ? "s" : ""} deleted`, "error");
    clearSelect();
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const newImg = {
      id: String(Date.now()),
      url: URL.createObjectURL(file),
      thumb: URL.createObjectURL(file),
      name: file.name.replace(/\.[^.]+$/, ""),
      tags: [],
      synonyms: [],
      uploadedAt: new Date().toISOString().slice(0, 10),
    };
    await api.images.upload(new FormData());
    setImages((imgs) => [newImg, ...imgs]);
    notify("Image uploaded — add tags to get started");
    setModal({ mode: "edit", image: newImg });
  };

  const saveEdit = async (updated) => {
    await api.images.update(updated.id, updated);
    setImages((imgs) => imgs.map((i) => (i.id === updated.id ? updated : i)));
    notify("Image updated");
    setModal(null);
  };

  const deleteImg = async (id) => {
    await api.images.delete(id);
    setImages((imgs) => imgs.filter((i) => i.id !== id));
    notify("Image deleted", "error");
    setModal(null);
  };

  return (
    <div style={s.root}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <span style={s.logoIcon}>🍽</span>
          <span style={s.logoText}>FoodLib</span>
        </div>
        <div style={s.sideStats}>
          <div style={s.statRow}>
            <span style={{ ...s.statDot, background: "#129575" }} />
            <span style={s.statLabel}>Total Images</span>
            <span style={{ ...s.statVal, color: "#6366f1" }}>
              {images.length}
            </span>
          </div>
        </div>
        <div style={s.sideSection}>
          <p style={s.sideHead}>FILTER BY TAG</p>
          <div style={s.tagList}>
            {["all", ...ALL_TAGS].map((t) => (
              <button
                key={t}
                onClick={() => setFilterTag(t)}
                style={{
                  ...s.tagBtn,
                  ...(filterTag === t ? s.tagBtnActive : {}),
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.h1}>Image Library</h1>
            <p style={s.subtitle}>
              {filtered.length} image{filtered.length !== 1 ? "s" : ""} ·
              manually uploaded
            </p>
          </div>
          <div style={s.headerActions}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleUpload}
            />
            <button style={s.uploadBtn} onClick={() => fileRef.current.click()}>
              ↑ Upload Image
            </button>
          </div>
        </header>

        <div style={s.searchWrap}>
          <span style={s.searchIcon}>⌕</span>
          <input
            style={s.searchInput}
            placeholder="Search by name, tag, or synonym…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button style={s.clearBtn} onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <div style={s.bulkBar}>
            <span style={s.bulkCount}>{selected.size} selected</span>
            <button
              style={s.bulkActionBtn}
              onClick={() => {
                setShowBulkTag((b) => !b);
                setConfirmBulkDel(false);
              }}
            >
              🏷 Tag
            </button>
            {!confirmBulkDel ? (
              <button
                style={{ ...s.bulkActionBtn, ...s.bulkDeleteBtn }}
                onClick={() => {
                  setConfirmBulkDel(true);
                  setShowBulkTag(false);
                }}
              >
                🗑 Delete
              </button>
            ) : (
              <div style={s.confirmRow}>
                <span style={s.confirmText}>
                  Delete {selected.size} image{selected.size !== 1 ? "s" : ""}?
                </span>
                <button
                  style={{ ...s.bulkActionBtn, ...s.bulkDeleteConfirm }}
                  onClick={bulkDelete}
                >
                  Yes, delete
                </button>
                <button
                  style={s.bulkActionBtn}
                  onClick={() => setConfirmBulkDel(false)}
                >
                  Cancel
                </button>
              </div>
            )}
            <button style={s.bulkClearBtn} onClick={clearSelect}>
              ✕ Clear
            </button>
            {showBulkTag && (
              <div style={s.bulkTagRow}>
                <input
                  style={s.bulkTagInput}
                  placeholder="tag1, tag2, tag3…"
                  value={bulkTagInput}
                  onChange={(e) => setBulkTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyBulkTag()}
                />
                <button style={s.uploadBtn} onClick={applyBulkTag}>
                  Apply
                </button>
              </div>
            )}
          </div>
        )}

        <div style={s.selectRow}>
          <button
            style={s.selectAllBtn}
            onClick={selected.size ? clearSelect : selectAll}
          >
            {selected.size === filtered.length && filtered.length > 0
              ? "✓ Deselect All"
              : `Select All (${filtered.length})`}
          </button>
          <span style={s.resultCount}>{filtered.length} results</span>
        </div>

        {filtered.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>🔍</div>
            <p>No images match your search.</p>
          </div>
        ) : (
          <div style={s.grid}>
            {filtered.map((img) => (
              <ImageCard
                key={img.id}
                img={img}
                isSelected={selected.has(img.id)}
                isHovered={hovered === img.id}
                onHover={setHovered}
                onSelect={toggleSelect}
                onView={() => setModal({ mode: "view", image: img })}
                onEdit={() => setModal({ mode: "edit", image: img })}
              />
            ))}
          </div>
        )}
      </main>

      {modal && (
        <Modal
          mode={modal.mode}
          image={modal.image}
          onClose={() => setModal(null)}
          onSave={saveEdit}
          onDelete={() => deleteImg(modal.image.id)}
        />
      )}
      {toast && (
        <div
          style={{
            ...s.toast,
            background: toast.type === "error" ? "#ef4444" : "#22c55e",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function ImageCard({
  img,
  isSelected,
  isHovered,
  onHover,
  onSelect,
  onView,
  onEdit,
}) {
  return (
    <div
      style={{
        ...s.card,
        outline: isSelected ? "2px solid #6366f1" : "2px solid transparent",
        transform: isHovered ? "translateY(-4px)" : "none",
      }}
      onMouseEnter={() => onHover(img.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onView}
    >
      <div style={s.thumb}>
        <img src={img.thumb} alt={img.name} style={s.thumbImg} loading="lazy" />
        <div
          style={{ ...s.checkWrap, opacity: isHovered || isSelected ? 1 : 0 }}
          onClick={(e) => onSelect(img.id, e)}
        >
          <div
            style={{
              ...s.check,
              background: isSelected ? "#129575" : "rgba(0,0,0,.25)",
            }}
          >
            {isSelected && (
              <span style={{ color: "#fff", fontSize: 11, lineHeight: 1 }}>
                ✓
              </span>
            )}
          </div>
        </div>
        {isHovered && (
          <div style={s.overlay}>
            <button
              style={s.overlayBtn}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              ✎ Edit
            </button>
          </div>
        )}
      </div>
      <div style={s.cardBody}>
        <p style={s.cardName}>{img.name}</p>
        <div style={s.cardTags}>
          {img.tags.slice(0, 3).map((t) => (
            <span key={t} style={s.tagChip}>
              {t}
            </span>
          ))}
          {img.tags.length > 3 && (
            <span style={{ ...s.tagChip, opacity: 0.6 }}>
              +{img.tags.length - 3}
            </span>
          )}
        </div>
        <span style={s.dateStr}>{img.uploadedAt}</span>
      </div>
    </div>
  );
}

function Modal({ mode, image, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(
    image
      ? {
          ...image,
          _tagsInput: image.tags.join(", "),
          _synInput: image.synonyms.join(", "),
        }
      : null,
  );
  const [confirmDel, setConfirmDel] = useState(false);
  const [imgHover, setImgHover] = useState(false);
  const imgInputRef = useRef();
  if (!form) return null;

  const handleImageReplace = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const newUrl = URL.createObjectURL(file);
    setForm((f) => ({ ...f, url: newUrl, thumb: newUrl }));
  };

  const handleSave = () => {
    onSave({
      ...form,
      tags: form._tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      synonyms: form._synInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>
            {mode === "edit" ? "✎ Edit Image" : "🔍 Image Detail"}
          </h2>
          <button style={s.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={s.modalBody}>
          <div style={s.modalPreview}>
            <div
              style={s.imgReplaceWrap}
              onMouseEnter={() => mode === "edit" && setImgHover(true)}
              onMouseLeave={() => setImgHover(false)}
              onClick={() => mode === "edit" && imgInputRef.current?.click()}
            >
              <img src={form.url} alt={form.name} style={s.modalImg} />
              {mode === "edit" && (
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleImageReplace}
                />
              )}
              {mode === "edit" && imgHover && (
                <div style={s.imgOverlay}>
                  <span style={s.imgOverlayText}>📷 Replace Image</span>
                </div>
              )}
            </div>
            <span style={s.dateStr}>{form.uploadedAt}</span>
          </div>
          <div style={s.modalForm}>
            <label style={s.label}>Image Name</label>
            <input
              style={s.input}
              value={form.name}
              disabled={mode === "view"}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <label style={s.label}>
              Tags <span style={s.hint}>(comma-separated)</span>
            </label>
            <input
              style={s.input}
              value={form._tagsInput}
              disabled={mode === "view"}
              placeholder="jollof rice, rice, nigerian"
              onChange={(e) => setForm({ ...form, _tagsInput: e.target.value })}
            />
            <div style={s.chipRow}>
              {form._tagsInput
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => (
                  <span key={t} style={s.tagChip}>
                    {t}
                  </span>
                ))}
            </div>
            <label style={s.label}>
              Synonyms <span style={s.hint}>(comma-separated)</span>
            </label>
            <input
              style={s.input}
              value={form._synInput}
              disabled={mode === "view"}
              placeholder="party rice, jellof"
              onChange={(e) => setForm({ ...form, _synInput: e.target.value })}
            />
            {mode === "edit" && (
              <div style={s.modalActions}>
                <button style={s.saveBtn} onClick={handleSave}>
                  Save Changes
                </button>
                {confirmDel ? (
                  <button style={s.deleteBtn} onClick={onDelete}>
                    Confirm Delete
                  </button>
                ) : (
                  <button
                    style={{ ...s.deleteBtn, opacity: 0.7 }}
                    onClick={() => setConfirmDel(true)}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  root: {
    display: "flex",
    flexDirection: "row-reverse", // 👈 add this
    minHeight: "100vh",
    background: "#f4f6fb",
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
    color: "#1e293b",
  },

  sidebar: {
    width: 220,
    boxSizing: "border-box",
    flexShrink: 0,
    background: "#fff",
    borderLeft: "1px solid #e2e8f0",
    borderRight: "none",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    overflowY: "auto",
  },
  logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  logoIcon: { fontSize: 26 },
  logoText: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-.03em",
    color: "#1e293b",
  },
  sideStats: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "12px 0",
    borderTop: "1px solid #e2e8f0",
    borderBottom: "1px solid #e2e8f0",
  },
  statRow: { display: "flex", alignItems: "center", gap: 8 },
  statDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  statLabel: { flex: 1, fontSize: 12, color: "#64748b" },
  statVal: { fontSize: 13, fontWeight: 700 },
  sideSection: { display: "flex", flexDirection: "column", gap: 6 },
  sideHead: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: ".1em",
    color: "#94a3b8",
    margin: "0 0 4px",
  },
  tagList: { display: "flex", flexWrap: "wrap", gap: 4 },
  tagBtn: {
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid #e2e8f0",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
  },
  tagBtnActive: {
    background: "#129575",
    border: "1px solid #129575",
    color: "#fff",
  },
  main: {
    flex: 1,
    padding: "24px 24px 24px 80px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 0,
  },
  
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  h1: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: "-.04em",
    color: "#0f172a",
  },
  subtitle: { margin: "4px 0 0", fontSize: 13, color: "#94a3b8" },
  headerActions: { display: "flex", gap: 10 },
  uploadBtn: {
    padding: "9px 18px",
    background: "#129575",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  searchWrap: { position: "relative", display: "flex", alignItems: "center" },
  searchIcon: {
    position: "absolute",
    left: 14,
    fontSize: 18,
    color: "#94a3b8",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    padding: "10px 40px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    color: "#1e293b",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  clearBtn: {
    position: "absolute",
    right: 12,
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 14,
  },
  bulkBar: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "10px 14px",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  bulkCount: { fontWeight: 700, fontSize: 13, color: "#6366f1" },
  bulkActionBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    padding: "5px 12px",
    cursor: "pointer",
  },
  bulkDeleteBtn: {
    color: "#ef4444",
    background: "#fef2f2",
    border: "1px solid #fecaca",
  },
  bulkDeleteConfirm: {
    color: "#fff",
    background: "#ef4444",
    border: "1px solid #ef4444",
  },
  bulkClearBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: "#94a3b8",
    background: "none",
    border: "none",
    cursor: "pointer",
    marginLeft: "auto",
  },
  confirmRow: { display: "flex", alignItems: "center", gap: 8 },
  confirmText: { fontSize: 12, color: "#ef4444", fontWeight: 600 },
  bulkTagRow: { display: "flex", gap: 8, width: "100%", marginTop: 4 },
  bulkTagInput: {
    flex: 1,
    padding: "7px 12px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    color: "#1e293b",
    fontSize: 13,
    outline: "none",
  },
  selectRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectAllBtn: {
    fontSize: 12,
    color: "#64748b",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  resultCount: { fontSize: 12, color: "#94a3b8" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
    gap: 16,
  },
  empty: { textAlign: "center", padding: 60, color: "#94a3b8" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  card: {
    background: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    cursor: "pointer",
    transition: "transform .18s ease, outline .1s",
    outlineOffset: 2,
    boxShadow: "0 1px 4px rgba(0,0,0,.07)",
  },
  thumb: { position: "relative", aspectRatio: "4/3", overflow: "hidden" },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  checkWrap: {
    position: "absolute",
    top: 8,
    left: 8,
    transition: "opacity .15s",
    zIndex: 3,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 5,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid rgba(255,255,255,.6)",
    transition: "background .15s",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  overlayBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
    background: "rgba(255,255,255,.15)",
    border: "1px solid rgba(255,255,255,.25)",
    borderRadius: 6,
    padding: "6px 14px",
    cursor: "pointer",
  },
  cardBody: {
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  cardName: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.3,
  },
  cardTags: { display: "flex", flexWrap: "wrap", gap: 4 },
  tagChip: {
    fontSize: 10,
    background: "#f1f5f9",
    color: "#64748b",
    borderRadius: 4,
    padding: "2px 6px",
  },
  dateStr: { fontSize: 10, color: "#cbd5e1" },
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.45)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    width: "100%",
    maxWidth: 860,
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 60px rgba(0,0,0,.15)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 22px",
    borderBottom: "1px solid #f1f5f9",
  },
  modalTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: 18,
    cursor: "pointer",
  },
  modalBody: {
    display: "flex",
    gap: 24,
    padding: 22,
    overflowY: "auto",
    flex: 1,
  },
  modalPreview: {
    width: 280,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  imgReplaceWrap: {
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
    cursor: "pointer",
  },
  imgOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  imgOverlayText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    padding: "8px 16px",
    background: "rgba(255,255,255,.15)",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.25)",
  },
  modalImg: {
    width: "100%",
    borderRadius: 10,
    objectFit: "cover",
    aspectRatio: "4/3",
    display: "block",
  },
  modalForm: { flex: 1, display: "flex", flexDirection: "column", gap: 10 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: ".08em",
  },
  hint: { fontWeight: 400, color: "#94a3b8", letterSpacing: "normal" },
  input: {
    padding: "9px 12px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    color: "#1e293b",
    fontSize: 13,
    outline: "none",
  },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 4 },
  modalActions: { display: "flex", gap: 10, marginTop: "auto", paddingTop: 10 },
  saveBtn: {
    flex: 1,
    padding: "10px",
    background: "#129575",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  deleteBtn: {
    flex: 1,
    padding: "10px",
    background: "#fef2f2",
    color: "#ef4444",
    border: "1px solid #fecaca",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  toast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    padding: "12px 20px",
    borderRadius: 10,
    zIndex: 200,
    boxShadow: "0 4px 20px rgba(0,0,0,.15)",
  },
};
