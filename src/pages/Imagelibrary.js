import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// API INTEGRATION LAYER — swap these stubs for real endpoints
// ============================================================
const API_BASE = "/api/v1"; // ← change to your real base URL

export const api = {
  images: {
    list: (params) => fetchMock("GET", `${API_BASE}/images`, params),
    upload: (form) => fetchMock("POST", `${API_BASE}/images/upload`, form),
    update: (id, d) => fetchMock("PUT", `${API_BASE}/images/${id}`, d),
    delete: (id) => fetchMock("DEL", `${API_BASE}/images/${id}`),
    approve: (id) => fetchMock("PUT", `${API_BASE}/images/${id}/approve`),
    reject: (id) => fetchMock("PUT", `${API_BASE}/images/${id}/reject`),
    bulkTag: (ids, t) =>
      fetchMock("POST", `${API_BASE}/images/bulk-tag`, { ids, tags: t }),
  },
  tags: {
    list: () => fetchMock("GET", `${API_BASE}/tags`),
    create: (tag) => fetchMock("POST", `${API_BASE}/tags`, tag),
  },
};

// ── mock fetch — delete this block when wiring real API ──────
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchMock(method, url, payload) {
  await delay(350);
  console.log(`[MOCK] ${method} ${url}`, payload ?? "");
  return { ok: true, data: payload };
}

// ============================================================
// MOCK DATA
// ============================================================
const FOOD_IMAGES = [
  {
    id: "1",
    url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600",
    thumb: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300",
    name: "Jollof Rice Classic",
    tags: ["jollof rice", "rice", "nigerian"],
    synonyms: ["party rice", "jellof"],
    source: "manual",
    status: "approved",
    confidence: null,
    uploadedAt: "2024-12-01",
  },
  {
    id: "2",
    url: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600",
    thumb: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300",
    name: "Fried Rice Bowl",
    tags: ["fried rice", "rice", "chinese"],
    synonyms: ["egg fried rice"],
    source: "ai",
    status: "pending",
    confidence: 0.91,
    uploadedAt: "2025-01-15",
  },
  {
    id: "3",
    url: "https://images.unsplash.com/photo-1574484284002-952d92456975?w=600",
    thumb: "https://images.unsplash.com/photo-1574484284002-952d92456975?w=300",
    name: "Grilled Chicken",
    tags: ["chicken", "grilled", "protein"],
    synonyms: ["BBQ chicken"],
    source: "manual",
    status: "approved",
    confidence: null,
    uploadedAt: "2025-01-20",
  },
  {
    id: "4",
    url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600",
    thumb: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300",
    name: "Egusi Soup",
    tags: ["egusi", "soup", "nigerian"],
    synonyms: ["melon soup"],
    source: "ai",
    status: "rejected",
    confidence: 0.73,
    uploadedAt: "2025-02-01",
  },
  {
    id: "5",
    url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600",
    thumb: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300",
    name: "Pizza Margherita",
    tags: ["pizza", "italian", "cheese"],
    synonyms: ["margarita pizza"],
    source: "manual",
    status: "approved",
    confidence: null,
    uploadedAt: "2025-02-10",
  },
  {
    id: "6",
    url: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600",
    thumb: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=300",
    name: "Pasta Carbonara",
    tags: ["pasta", "italian", "egg"],
    synonyms: ["creamy pasta"],
    source: "ai",
    status: "pending",
    confidence: 0.88,
    uploadedAt: "2025-02-14",
  },
  {
    id: "7",
    url: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600",
    thumb: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=300",
    name: "Avocado Toast",
    tags: ["avocado", "toast", "breakfast"],
    synonyms: ["avo toast"],
    source: "manual",
    status: "approved",
    confidence: null,
    uploadedAt: "2025-02-20",
  },
  {
    id: "8",
    url: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600",
    thumb: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=300",
    name: "Garden Salad",
    tags: ["salad", "vegetables", "healthy"],
    synonyms: ["green salad", "toss salad"],
    source: "ai",
    status: "pending",
    confidence: 0.95,
    uploadedAt: "2025-03-01",
  },
  {
    id: "9",
    url: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600",
    thumb: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300",
    name: "Chocolate Cake",
    tags: ["cake", "dessert", "chocolate"],
    synonyms: ["choc cake", "dark cake"],
    source: "manual",
    status: "approved",
    confidence: null,
    uploadedAt: "2025-03-05",
  },
  {
    id: "10",
    url: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=600",
    thumb: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=300",
    name: "Burger Classic",
    tags: ["burger", "beef", "fast food"],
    synonyms: ["hamburger", "beef burger"],
    source: "ai",
    status: "pending",
    confidence: 0.82,
    uploadedAt: "2025-03-10",
  },
  {
    id: "11",
    url: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=600",
    thumb: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=300",
    name: "Suya Skewers",
    tags: ["suya", "beef", "nigerian", "grilled"],
    synonyms: ["nigerian suya", "street meat"],
    source: "manual",
    status: "approved",
    confidence: null,
    uploadedAt: "2025-03-15",
  },
  {
    id: "12",
    url: "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=600",
    thumb: "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=300",
    name: "Pancake Stack",
    tags: ["pancake", "breakfast", "sweet"],
    synonyms: ["flapjacks", "hotcakes"],
    source: "ai",
    status: "rejected",
    confidence: 0.67,
    uploadedAt: "2025-03-20",
  },
];

const ALL_TAGS = [...new Set(FOOD_IMAGES.flatMap((i) => i.tags))].sort();

// ============================================================
// HELPERS
// ============================================================
const STATUS_META = {
  approved: { label: "Approved", color: "#22c55e", bg: "rgba(34,197,94,.15)" },
  pending: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,.15)" },
  rejected: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,.15)" },
};
const SOURCE_META = {
  ai: { label: "AI Generated", color: "#818cf8" },
  manual: { label: "Manual Upload", color: "#94a3b8" },
};

function ConfidenceBadge({ value }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "#22c55e" : pct >= 75 ? "#f59e0b" : "#ef4444";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        background: `${color}22`,
        padding: "2px 6px",
        borderRadius: 4,
        letterSpacing: ".05em",
      }}
    >
      {pct}% match
    </span>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ImageLibrary() {
  const [images, setImages] = useState(FOOD_IMAGES);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("all");
  const [filterSrc, setFilterSrc] = useState("all");
  const [filterStt, setFilterStt] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [hovered, setHovered] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'view'|'edit'|'upload', image? }
  const [toast, setToast] = useState(null);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showBulkBar, setShowBulkBar] = useState(false);
  const fileRef = useRef();

  // ── filtering ─────────────────────────────────────────────
  const filtered = images.filter((img) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      img.name.toLowerCase().includes(q) ||
      img.tags.some((t) => t.includes(q)) ||
      img.synonyms.some((s) => s.includes(q));
    const matchTag = filterTag === "all" || img.tags.includes(filterTag);
    const matchSrc = filterSrc === "all" || img.source === filterSrc;
    const matchStt = filterStt === "all" || img.status === filterStt;
    return matchSearch && matchTag && matchSrc && matchStt;
  });

  // ── notifications ─────────────────────────────────────────
  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── selection ─────────────────────────────────────────────
  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelected(new Set(filtered.map((i) => i.id)));
  const clearSelect = () => setSelected(new Set());

  // ── approve / reject ──────────────────────────────────────
  const setStatus = async (id, status) => {
    await api.images[status === "approved" ? "approve" : "reject"](id);
    setImages((imgs) => imgs.map((i) => (i.id === id ? { ...i, status } : i)));
    notify(`Image ${status}`, status === "approved" ? "success" : "error");
    setModal(null);
  };

  // ── bulk tag ──────────────────────────────────────────────
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
    notify(`Tags added to ${selected.size} images`);
    setBulkTagInput("");
    setSelected(new Set());
    setShowBulkBar(false);
  };

  // ── upload (mock) ─────────────────────────────────────────
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
      source: "manual",
      status: "pending",
      confidence: null,
      uploadedAt: new Date().toISOString().slice(0, 10),
    };
    await api.images.upload(new FormData());
    setImages((imgs) => [newImg, ...imgs]);
    notify("Image uploaded — add tags and approve");
    setModal({ mode: "edit", image: newImg });
  };

  // ── edit save ─────────────────────────────────────────────
  const saveEdit = async (updated) => {
    await api.images.update(updated.id, updated);
    setImages((imgs) => imgs.map((i) => (i.id === updated.id ? updated : i)));
    notify("Image updated");
    setModal(null);
  };

  // ── delete ────────────────────────────────────────────────
  const deleteImg = async (id) => {
    await api.images.delete(id);
    setImages((imgs) => imgs.filter((i) => i.id !== id));
    notify("Image deleted", "error");
    setModal(null);
  };

  const pendingCount = images.filter((i) => i.status === "pending").length;

  // ── stats ─────────────────────────────────────────────────
  const stats = {
    total: images.length,
    approved: images.filter((i) => i.status === "approved").length,
    pending: pendingCount,
    rejected: images.filter((i) => i.status === "rejected").length,
    ai: images.filter((i) => i.source === "ai").length,
  };

  return (
    <div style={styles.root}>
      {/* ── sidebar ── */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🍽</span>
          <span style={styles.logoText}>FoodLib</span>
        </div>

        <div style={styles.sideStats}>
          {[
            { label: "Total", val: stats.total, color: "#e2e8f0" },
            { label: "Approved", val: stats.approved, color: "#22c55e" },
            { label: "Pending", val: stats.pending, color: "#f59e0b" },
            { label: "Rejected", val: stats.rejected, color: "#ef4444" },
            { label: "AI-Gen", val: stats.ai, color: "#818cf8" },
          ].map(({ label, val, color }) => (
            <div key={label} style={styles.statRow}>
              <span style={{ ...styles.statDot, background: color }} />
              <span style={styles.statLabel}>{label}</span>
              <span style={{ ...styles.statVal, color }}>{val}</span>
            </div>
          ))}
        </div>

        <div style={styles.sideSection}>
          <p style={styles.sideHead}>FILTER BY TAG</p>
          <div style={styles.tagList}>
            {["all", ...ALL_TAGS].map((t) => (
              <button
                key={t}
                onClick={() => setFilterTag(t)}
                style={{
                  ...styles.tagBtn,
                  ...(filterTag === t ? styles.tagBtnActive : {}),
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.sideSection}>
          <p style={styles.sideHead}>SOURCE</p>
          {["all", "ai", "manual"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterSrc(s)}
              style={{
                ...styles.sideBtn,
                ...(filterSrc === s ? styles.sideBtnActive : {}),
              }}
            >
              {s === "all" ? "All Sources" : SOURCE_META[s].label}
            </button>
          ))}
        </div>

        <div style={styles.sideSection}>
          <p style={styles.sideHead}>STATUS</p>
          {["all", "approved", "pending", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStt(s)}
              style={{
                ...styles.sideBtn,
                ...(filterStt === s ? styles.sideBtnActive : {}),
              }}
            >
              {s === "all" ? "All Status" : STATUS_META[s].label}
              {s === "pending" && pendingCount > 0 && (
                <span style={styles.badge}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* ── main ── */}
      <main style={styles.main}>
        {/* header */}
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>Image Library</h1>
            <p style={styles.subtitle}>
              {filtered.length} image{filtered.length !== 1 ? "s" : ""} · smart
              food visual database
            </p>
          </div>
          <div style={styles.headerActions}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleUpload}
            />
            <button
              style={styles.uploadBtn}
              onClick={() => fileRef.current.click()}
            >
              ↑ Upload Image
            </button>
          </div>
        </header>

        {/* search bar */}
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>⌕</span>
          <input
            style={styles.searchInput}
            placeholder="Search by name, tag, or synonym…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button style={styles.clearBtn} onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>

        {/* bulk bar */}
        {selected.size > 0 && (
          <div style={styles.bulkBar}>
            <span style={styles.bulkCount}>{selected.size} selected</span>
            <button
              style={styles.bulkAction}
              onClick={() => setShowBulkBar((b) => !b)}
            >
              + Bulk Tag
            </button>
            <button
              style={{ ...styles.bulkAction, color: "#22c55e" }}
              onClick={async () => {
                for (const id of selected) await setStatus(id, "approved");
                clearSelect();
              }}
            >
              ✓ Approve All
            </button>
            <button
              style={{ ...styles.bulkAction, color: "#ef4444" }}
              onClick={async () => {
                for (const id of selected) await setStatus(id, "rejected");
                clearSelect();
              }}
            >
              ✕ Reject All
            </button>
            <button style={styles.bulkAction} onClick={clearSelect}>
              Clear
            </button>

            {showBulkBar && (
              <div style={styles.bulkTagRow}>
                <input
                  style={styles.bulkTagInput}
                  placeholder="tag1, tag2, tag3…"
                  value={bulkTagInput}
                  onChange={(e) => setBulkTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyBulkTag()}
                />
                <button style={styles.uploadBtn} onClick={applyBulkTag}>
                  Apply
                </button>
              </div>
            )}
          </div>
        )}

        {/* select all row */}
        <div style={styles.selectRow}>
          <button
            style={styles.selectAllBtn}
            onClick={selected.size ? clearSelect : selectAll}
          >
            {selected.size === filtered.length && filtered.length > 0
              ? "✓ Deselect All"
              : `Select All (${filtered.length})`}
          </button>
          <span style={styles.resultCount}>{filtered.length} results</span>
        </div>

        {/* grid */}
        {filtered.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>🔍</div>
            <p>No images match your search.</p>
          </div>
        ) : (
          <div style={styles.grid}>
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
                onApprove={() => setStatus(img.id, "approved")}
                onReject={() => setStatus(img.id, "rejected")}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── modal ── */}
      {modal && (
        <Modal
          mode={modal.mode}
          image={modal.image}
          allTags={ALL_TAGS}
          onClose={() => setModal(null)}
          onSave={saveEdit}
          onApprove={() => setStatus(modal.image.id, "approved")}
          onReject={() => setStatus(modal.image.id, "rejected")}
          onDelete={() => deleteImg(modal.image.id)}
        />
      )}

      {/* ── toast ── */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            background: toast.type === "error" ? "#ef4444" : "#22c55e",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ============================================================
// IMAGE CARD
// ============================================================
function ImageCard({
  img,
  isSelected,
  isHovered,
  onHover,
  onSelect,
  onView,
  onEdit,
  onApprove,
  onReject,
}) {
  const sm = STATUS_META[img.status];
  const src = SOURCE_META[img.source];

  return (
    <div
      style={{
        ...styles.card,
        outline: isSelected ? "2px solid #818cf8" : "2px solid transparent",
        transform: isHovered ? "translateY(-4px)" : "none",
      }}
      onMouseEnter={() => onHover(img.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onView}
    >
      {/* thumbnail */}
      <div style={styles.thumb}>
        <img
          src={img.thumb}
          alt={img.name}
          style={styles.thumbImg}
          loading="lazy"
        />

        {/* select checkbox */}
        <div
          style={{
            ...styles.checkWrap,
            opacity: isHovered || isSelected ? 1 : 0,
          }}
          onClick={(e) => onSelect(img.id, e)}
        >
          <div
            style={{
              ...styles.check,
              background: isSelected ? "#818cf8" : "rgba(0,0,0,.5)",
            }}
          >
            {isSelected && (
              <span style={{ color: "#fff", fontSize: 11, lineHeight: 1 }}>
                ✓
              </span>
            )}
          </div>
        </div>

        {/* hover overlay */}
        {isHovered && (
          <div style={styles.overlay}>
            <button
              style={styles.overlayBtn}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              ✎ Edit
            </button>
            {img.status === "pending" && (
              <>
                <button
                  style={{ ...styles.overlayBtn, color: "#22c55e" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove();
                  }}
                >
                  ✓ Approve
                </button>
                <button
                  style={{ ...styles.overlayBtn, color: "#ef4444" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject();
                  }}
                >
                  ✕ Reject
                </button>
              </>
            )}
          </div>
        )}

        {/* source badge */}
        <span style={{ ...styles.sourceBadge, color: src.color }}>
          {img.source === "ai" ? "⚡ AI" : "📷 Manual"}
        </span>
      </div>

      {/* card body */}
      <div style={styles.cardBody}>
        <div style={styles.cardTop}>
          <p style={styles.cardName}>{img.name}</p>
          <span
            style={{ ...styles.statusPill, color: sm.color, background: sm.bg }}
          >
            {sm.label}
          </span>
        </div>
        <div style={styles.cardTags}>
          {img.tags.slice(0, 3).map((t) => (
            <span key={t} style={styles.tagChip}>
              {t}
            </span>
          ))}
          {img.tags.length > 3 && (
            <span style={{ ...styles.tagChip, opacity: 0.6 }}>
              +{img.tags.length - 3}
            </span>
          )}
        </div>
        <div style={styles.cardBottom}>
          <ConfidenceBadge value={img.confidence} />
          <span style={styles.dateStr}>{img.uploadedAt}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL
// ============================================================
function Modal({
  mode,
  image,
  allTags,
  onClose,
  onSave,
  onApprove,
  onReject,
  onDelete,
}) {
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

  if (!form) return null;
  const sm = STATUS_META[form.status];

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
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        {/* modal header */}
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            {mode === "edit" ? "✎ Edit Image" : "🔍 Image Detail"}
          </h2>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.modalBody}>
          {/* preview */}
          <div style={styles.modalPreview}>
            <img src={form.url} alt={form.name} style={styles.modalImg} />
            <div style={styles.modalMeta}>
              <span
                style={{
                  ...styles.statusPill,
                  color: sm.color,
                  background: sm.bg,
                  fontSize: 12,
                }}
              >
                {sm.label}
              </span>
              <span
                style={{
                  ...styles.sourceBadge,
                  position: "static",
                  fontSize: 12,
                  color: SOURCE_META[form.source].color,
                }}
              >
                {SOURCE_META[form.source].label}
              </span>
              <ConfidenceBadge value={form.confidence} />
              <span style={styles.dateStr}>{form.uploadedAt}</span>
            </div>

            {form.status === "pending" && (
              <div style={styles.approvalRow}>
                <button style={styles.approveBtn} onClick={onApprove}>
                  ✓ Approve
                </button>
                <button style={styles.rejectBtn} onClick={onReject}>
                  ✕ Reject
                </button>
              </div>
            )}
          </div>

          {/* form */}
          <div style={styles.modalForm}>
            <label style={styles.label}>Image Name</label>
            <input
              style={styles.input}
              value={form.name}
              disabled={mode === "view"}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <label style={styles.label}>
              Tags <span style={styles.hint}>(comma-separated)</span>
            </label>
            <input
              style={styles.input}
              value={form._tagsInput}
              disabled={mode === "view"}
              placeholder="jollof rice, rice, nigerian"
              onChange={(e) => setForm({ ...form, _tagsInput: e.target.value })}
            />
            <div style={styles.chipRow}>
              {form._tagsInput
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => (
                  <span key={t} style={styles.tagChip}>
                    {t}
                  </span>
                ))}
            </div>

            <label style={styles.label}>
              Synonyms <span style={styles.hint}>(comma-separated)</span>
            </label>
            <input
              style={styles.input}
              value={form._synInput}
              disabled={mode === "view"}
              placeholder="party rice, jellof"
              onChange={(e) => setForm({ ...form, _synInput: e.target.value })}
            />

            <label style={styles.label}>Label Source</label>
            <div style={styles.radioRow}>
              {["ai", "manual"].map((s) => (
                <label key={s} style={styles.radioLabel}>
                  <input
                    type="radio"
                    disabled={mode === "view"}
                    checked={form.source === s}
                    onChange={() => setForm({ ...form, source: s })}
                    style={{ accentColor: "#818cf8" }}
                  />
                  {SOURCE_META[s].label}
                </label>
              ))}
            </div>

            {mode === "edit" && (
              <div style={styles.modalActions}>
                <button style={styles.saveBtn} onClick={handleSave}>
                  Save Changes
                </button>
                {confirmDel ? (
                  <button style={styles.rejectBtn} onClick={onDelete}>
                    Confirm Delete
                  </button>
                ) : (
                  <button
                    style={{ ...styles.rejectBtn, opacity: 0.7 }}
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

// ============================================================
// STYLES
// ============================================================
const styles = {
  root: {
    display: "flex",
    minHeight: "100vh",
    background: "#0a0c10",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    color: "#e2e8f0",
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: "#0f1117",
    borderRight: "1px solid #1e2330",
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
    color: "#fff",
  },

  sideStats: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "12px 0",
    borderTop: "1px solid #1e2330",
    borderBottom: "1px solid #1e2330",
  },
  statRow: { display: "flex", alignItems: "center", gap: 8 },
  statDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  statLabel: { flex: 1, fontSize: 12, color: "#94a3b8" },
  statVal: { fontSize: 13, fontWeight: 700 },

  sideSection: { display: "flex", flexDirection: "column", gap: 6 },
  sideHead: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: ".1em",
    color: "#475569",
    margin: "0 0 4px",
  },
  tagList: { display: "flex", flexWrap: "wrap", gap: 4 },
  tagBtn: {
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid #1e2330",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
  },
  tagBtnActive: {
    background: "#818cf8",
    border: "1px solid #818cf8",
    color: "#fff",
  },
  sideBtn: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sideBtnActive: { background: "#1e2330", color: "#e2e8f0" },
  badge: {
    background: "#f59e0b",
    color: "#000",
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 10,
    padding: "1px 6px",
    marginLeft: 4,
  },

  main: {
    flex: 1,
    padding: "24px 28px",
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
    color: "#f1f5f9",
  },
  subtitle: { margin: "4px 0 0", fontSize: 13, color: "#64748b" },
  headerActions: { display: "flex", gap: 10 },
  uploadBtn: {
    padding: "9px 18px",
    background: "#818cf8",
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
    color: "#475569",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    padding: "10px 40px 10px 40px",
    background: "#0f1117",
    border: "1px solid #1e2330",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  clearBtn: {
    position: "absolute",
    right: 12,
    background: "none",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 14,
  },

  bulkBar: {
    background: "#13151e",
    border: "1px solid #1e2330",
    borderRadius: 10,
    padding: "10px 14px",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  bulkCount: { fontWeight: 700, fontSize: 13, color: "#818cf8" },
  bulkAction: {
    fontSize: 12,
    fontWeight: 600,
    color: "#94a3b8",
    background: "#1e2330",
    border: "none",
    borderRadius: 6,
    padding: "5px 12px",
    cursor: "pointer",
  },
  bulkTagRow: { display: "flex", gap: 8, width: "100%", marginTop: 4 },
  bulkTagInput: {
    flex: 1,
    padding: "7px 12px",
    background: "#0a0c10",
    border: "1px solid #1e2330",
    borderRadius: 6,
    color: "#e2e8f0",
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
  resultCount: { fontSize: 12, color: "#475569" },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
    gap: 16,
  },
  empty: { textAlign: "center", padding: 60, color: "#475569" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },

  card: {
    background: "#0f1117",
    borderRadius: 12,
    overflow: "hidden",
    cursor: "pointer",
    transition: "transform .18s ease, outline .1s",
    outlineOffset: 2,
  },
  thumb: { position: "relative", aspectRatio: "4/3", overflow: "hidden" },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transition: "transform .25s ease",
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
    border: "2px solid rgba(255,255,255,.4)",
    transition: "background .15s",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,.65)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 2,
  },
  overlayBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: 6,
    padding: "6px 14px",
    cursor: "pointer",
  },
  sourceBadge: {
    position: "absolute",
    bottom: 7,
    right: 7,
    fontSize: 10,
    fontWeight: 700,
    background: "rgba(0,0,0,.7)",
    padding: "2px 6px",
    borderRadius: 4,
    zIndex: 2,
  },

  cardBody: {
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 6,
  },
  cardName: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: "#f1f5f9",
    lineHeight: 1.3,
    flex: 1,
  },
  statusPill: {
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 4,
    padding: "2px 6px",
    whiteSpace: "nowrap",
  },
  cardTags: { display: "flex", flexWrap: "wrap", gap: 4 },
  tagChip: {
    fontSize: 10,
    background: "#1e2330",
    color: "#94a3b8",
    borderRadius: 4,
    padding: "2px 6px",
  },
  cardBottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateStr: { fontSize: 10, color: "#475569" },

  // modal
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.75)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    background: "#0f1117",
    border: "1px solid #1e2330",
    borderRadius: 16,
    width: "100%",
    maxWidth: 860,
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 22px",
    borderBottom: "1px solid #1e2330",
  },
  modalTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: "#f1f5f9" },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
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
  modalImg: {
    width: "100%",
    borderRadius: 10,
    objectFit: "cover",
    aspectRatio: "4/3",
  },
  modalMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  approvalRow: { display: "flex", gap: 8, marginTop: 4 },
  approveBtn: {
    flex: 1,
    padding: "9px",
    background: "rgba(34,197,94,.15)",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,.3)",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  rejectBtn: {
    flex: 1,
    padding: "9px",
    background: "rgba(239,68,68,.1)",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,.3)",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },

  modalForm: { flex: 1, display: "flex", flexDirection: "column", gap: 10 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: ".08em",
  },
  hint: { fontWeight: 400, color: "#475569", letterSpacing: "normal" },
  input: {
    padding: "9px 12px",
    background: "#13151e",
    border: "1px solid #1e2330",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
  },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 4 },
  radioRow: { display: "flex", gap: 16 },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: "#94a3b8",
    cursor: "pointer",
  },
  modalActions: { display: "flex", gap: 10, marginTop: "auto", paddingTop: 10 },
  saveBtn: {
    flex: 1,
    padding: "10px",
    background: "#818cf8",
    color: "#fff",
    border: "none",
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
    boxShadow: "0 4px 20px rgba(0,0,0,.4)",
    animation: "fadeIn .2s",
  },
};
