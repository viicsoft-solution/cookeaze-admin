// src/components/HomeSectionAdmin.js
import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const HomeSectionAdmin = () => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [newSection, setNewSection] = useState({
    type: "recipe_grid",
    title: "",
    order: 0,
    items: [],
  });
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // Alert state
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("");

  // Item form state
  const [newItem, setNewItem] = useState({
    item_type: "recipe",
    item_id: "",
    card_color: "#FF5733",
  });
  const [showItemForm, setShowItemForm] = useState(false);

  // Edit item form state
  const [editItem, setEditItem] = useState({
    item_type: "recipe",
    item_id: "",
    card_color: "#FF5733",
  });
  const [showEditItemForm, setShowEditItemForm] = useState(false);

  // Modal state
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [showEditSelectModal, setShowEditSelectModal] = useState(false);

  // Available items based on type
  const [availableItems, setAvailableItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Available items for edit mode
  const [editAvailableItems, setEditAvailableItems] = useState([]);
  const [loadingEditItems, setLoadingEditItems] = useState(false);

  // Selected item preview
  const [selectedItemPreview, setSelectedItemPreview] = useState(null);
  const [editItemPreview, setEditItemPreview] = useState(null);

  // Pagination state for create mode
  const [recipesPage, setRecipesPage] = useState(1);
  const [recipesTotalPages, setRecipesTotalPages] = useState(1);
  const [recipesSearch, setRecipesSearch] = useState("");
  const [recipesSearchInput, setRecipesSearchInput] = useState("");

  // Pagination state for edit mode
  const [editRecipesPage, setEditRecipesPage] = useState(1);
  const [editRecipesTotalPages, setEditRecipesTotalPages] = useState(1);
  const [editRecipesSearch, setEditRecipesSearch] = useState("");
  const [editRecipesSearchInput, setEditRecipesSearchInput] = useState("");

  const API_BASE = "https://api.cookeaze.app/api/home-sections";
  const RECIPES_API = "https://api.cookeaze.app/api/recipes/";
  const THEMES_API = "https://api.cookeaze.app/api/themes-recipes/";

  const sectionTypes = ["hero_carousel", "themed_recipe_grid", "recipe_grid"];

  // Fetch sections on mount
  useEffect(() => {
    fetchSections();
  }, []);

  // Clear alerts after timeout
  useEffect(() => {
    let t;
    if (alertMessage) {
      t = setTimeout(() => {
        setAlertMessage("");
        setAlertType("");
      }, 4000);
    }
    return () => clearTimeout(t);
  }, [alertMessage]);

  // Fetch available items when modal opens or page/search changes (for create)
  useEffect(() => {
    if (showSelectModal && newItem.item_type) {
      fetchAvailableItems(newItem.item_type, recipesPage, recipesSearch);
    }
  }, [newItem.item_type, showSelectModal, recipesPage, recipesSearch]);

  // Fetch available items when modal opens or page/search changes (for edit)
  useEffect(() => {
    if (showEditSelectModal && editItem.item_type) {
      fetchEditAvailableItems(
        editItem.item_type,
        editRecipesPage,
        editRecipesSearch
      );
    }
  }, [
    editItem.item_type,
    showEditSelectModal,
    editRecipesPage,
    editRecipesSearch,
  ]);

  // Update preview when item_id changes (for create)
  useEffect(() => {
    if (newItem.item_id && availableItems.length > 0) {
      const selected = availableItems.find(
        (item) => item.id === parseInt(newItem.item_id)
      );
      setSelectedItemPreview(selected || null);
    } else {
      setSelectedItemPreview(null);
    }
  }, [newItem.item_id, availableItems]);

  // Update preview when item_id changes (for edit)
  useEffect(() => {
    if (editItem.item_id && editAvailableItems.length > 0) {
      const selected = editAvailableItems.find(
        (item) => item.id === parseInt(editItem.item_id)
      );
      setEditItemPreview(selected || null);
    } else {
      setEditItemPreview(null);
    }
  }, [editItem.item_id, editAvailableItems]);

  const showAlert = (message, type) => {
    setAlertMessage(message);
    setAlertType(type);
  };

  // Fetch sections from API
  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/`, {
        headers: { accept: "application/json" },
      });
      const data = await response.json();

      if (data.isSuccessful) {
        setSections(data.data || []);
      } else {
        showAlert(data.message || "Failed to fetch sections", "danger");
      }
    } catch (error) {
      console.error("Error fetching sections:", error);
      showAlert("Failed to fetch sections", "danger");
    } finally {
      setLoading(false);
    }
  };

  // Fetch available items based on type (for create)
  const fetchAvailableItems = async (itemType, page = 1, search = "") => {
    try {
      setLoadingItems(true);

      if (itemType === "recipe") {
        let apiUrl = `${RECIPES_API}?page=${page}`;
        if (search) {
          apiUrl += `&search=${encodeURIComponent(search)}`;
        }

        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });
        const data = await response.json();

        if (data.isSuccessful) {
          setAvailableItems(data.data.results || []);
          const totalCount = data.data.count;
          const itemsPerPage = data.data.results?.length || 10;
          const calculatedTotalPages = Math.ceil(totalCount / itemsPerPage);
          setRecipesTotalPages(calculatedTotalPages);
        } else {
          showAlert(`Failed to fetch ${itemType}s`, "warning");
          setAvailableItems([]);
        }
      } else {
        const response = await fetch(THEMES_API, {
          headers: { accept: "application/json" },
        });
        const data = await response.json();

        if (data.isSuccessful) {
          setAvailableItems(data.data.results || []);
        } else {
          showAlert(`Failed to fetch ${itemType}s`, "warning");
          setAvailableItems([]);
        }
      }
    } catch (error) {
      console.error(`Error fetching ${itemType}s:`, error);
      showAlert(`Failed to fetch ${itemType}s`, "danger");
      setAvailableItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Fetch available items based on type (for edit)
  const fetchEditAvailableItems = async (itemType, page = 1, search = "") => {
    try {
      setLoadingEditItems(true);

      if (itemType === "recipe") {
        let apiUrl = `${RECIPES_API}?page=${page}`;
        if (search) {
          apiUrl += `&search=${encodeURIComponent(search)}`;
        }

        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });
        const data = await response.json();

        if (data.isSuccessful) {
          setEditAvailableItems(data.data.results || []);
          const totalCount = data.data.count;
          const itemsPerPage = data.data.results?.length || 10;
          const calculatedTotalPages = Math.ceil(totalCount / itemsPerPage);
          setEditRecipesTotalPages(calculatedTotalPages);
        } else {
          showAlert(`Failed to fetch ${itemType}s`, "warning");
          setEditAvailableItems([]);
        }
      } else {
        const response = await fetch(THEMES_API, {
          headers: { accept: "application/json" },
        });
        const data = await response.json();

        if (data.isSuccessful) {
          setEditAvailableItems(data.data.results || []);
        } else {
          showAlert(`Failed to fetch ${itemType}s`, "warning");
          setEditAvailableItems([]);
        }
      }
    } catch (error) {
      console.error(`Error fetching ${itemType}s:`, error);
      showAlert(`Failed to fetch ${itemType}s`, "danger");
      setEditAvailableItems([]);
    } finally {
      setLoadingEditItems(false);
    }
  };

  // Handle search for create mode
  const handleRecipesSearch = () => {
    setRecipesSearch(recipesSearchInput);
    setRecipesPage(1);
  };

  // Handle search for edit mode
  const handleEditRecipesSearch = () => {
    setEditRecipesSearch(editRecipesSearchInput);
    setEditRecipesPage(1);
  };

  // Open select modal (create mode)
  const openSelectModal = () => {
    setShowSelectModal(true);
    setRecipesPage(1);
    setRecipesSearch("");
    setRecipesSearchInput("");
  };

  // Open select modal (edit mode)
  const openEditSelectModal = () => {
    setShowEditSelectModal(true);
    setEditRecipesPage(1);
    setEditRecipesSearch("");
    setEditRecipesSearchInput("");
  };

  // Select item from modal (create mode)
  const selectItemFromModal = (item) => {
    setNewItem({ ...newItem, item_id: item.id.toString() });
    setSelectedItemPreview(item);
    setShowSelectModal(false);
  };

  // Select item from modal (edit mode)
  const selectEditItemFromModal = (item) => {
    setEditItem({ ...editItem, item_id: item.id.toString() });
    setEditItemPreview(item);
    setShowEditSelectModal(false);
  };

  // Convert hex color to 10-digit integer (ARGB format)
  const hexToArgbInt = (hex) => {
    hex = hex.replace("#", "");
    if (hex.length === 6) {
      hex = "FF" + hex;
    }
    return parseInt(hex, 16);
  };

  // Convert ARGB integer to hex color
  const argbIntToHex = (argbInt) => {
    const hex = argbInt.toString(16).padStart(8, "0");
    return "#" + hex.slice(2);
  };

  // Create new section
  const createSection = async () => {
    if (!newSection.title.trim()) {
      showAlert("Please enter a section title", "warning");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        title: newSection.title,
        type: newSection.type,
        order: parseInt(newSection.order),
        items: newSection.items,
      };

      const response = await fetch(`${API_BASE}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.isSuccessful) {
        await fetchSections();
        setNewSection({
          title: "",
          type: "hero_carousel",
          order: 0,
          items: [],
        });
        setShowForm(false);
        setNewItem({ item_type: "recipe", item_id: "", card_color: "#FF5733" });
        setShowItemForm(false);
        setSelectedItemPreview(null);
        setRecipesPage(1);
        setRecipesSearch("");
        setRecipesSearchInput("");
        showAlert("Section created successfully", "success");
      } else {
        showAlert(data.message || "Failed to create section", "danger");
      }
    } catch (error) {
      console.error("Error creating section:", error);
      showAlert("Failed to create section", "danger");
    } finally {
      setLoading(false);
    }
  };

  // Update section
  const updateSection = async (id) => {
    if (!editFormData.title?.trim()) {
      showAlert("Please enter a section title", "warning");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        title: editFormData.title,
        type: editFormData.type,
        order: parseInt(editFormData.order),
        items: editFormData.items || [],
      };

      const response = await fetch(`${API_BASE}/${id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.isSuccessful) {
        await fetchSections();
        setEditingId(null);
        setEditFormData({});
        setEditRecipesPage(1);
        setEditRecipesSearch("");
        setEditRecipesSearchInput("");
        showAlert("Section updated successfully", "success");
      } else {
        showAlert(data.message || "Failed to update section", "danger");
      }
    } catch (error) {
      console.error("Error updating section:", error);
      showAlert("Failed to update section", "danger");
    } finally {
      setLoading(false);
    }
  };

  // Delete section
  const deleteSection = (id) => {
    setSelectedId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/${selectedId}/`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });

      if (response.ok) {
        await fetchSections();
        showAlert("Section deleted successfully", "success");
      } else {
        showAlert("Failed to delete section", "danger");
      }
    } catch (error) {
      console.error("Error deleting section:", error);
      showAlert("Failed to delete section", "danger");
    } finally {
      setLoading(false);
      setShowConfirm(false);
      setSelectedId(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirm(false);
    setSelectedId(null);
  };

  // Add item to section (create mode)
  const addItemToSection = () => {
    if (!newItem.item_id) {
      showAlert("Please select an item", "warning");
      return;
    }

    const item = {
      item_type: newItem.item_type,
      item_id: parseInt(newItem.item_id),
      card_color: hexToArgbInt(newItem.card_color),
    };

    setNewSection({
      ...newSection,
      items: [...newSection.items, item],
    });

    setNewItem({ item_type: "recipe", item_id: "", card_color: "#FF5733" });
    setShowItemForm(false);
    setSelectedItemPreview(null);
    showAlert("Item added to section", "success");
  };

  // Add item to section (edit mode)
  const addItemToEditSection = () => {
    if (!editItem.item_id) {
      showAlert("Please select an item", "warning");
      return;
    }

    const item = {
      item_type: editItem.item_type,
      item_id: parseInt(editItem.item_id),
      card_color: hexToArgbInt(editItem.card_color),
    };

    setEditFormData({
      ...editFormData,
      items: [...(editFormData.items || []), item],
    });

    setEditItem({ item_type: "recipe", item_id: "", card_color: "#FF5733" });
    setShowEditItemForm(false);
    setEditItemPreview(null);
    showAlert("Item added to section", "success");
  };

  // Remove item from section (create mode)
  const removeItemFromSection = (index) => {
    setNewSection({
      ...newSection,
      items: newSection.items.filter((_, i) => i !== index),
    });
  };

  // Remove item from section (edit mode)
  const removeItemFromEditSection = (index) => {
    setEditFormData({
      ...editFormData,
      items: editFormData.items.filter((_, i) => i !== index),
    });
  };

  // Filter sections
  const filteredSections = sections.filter((section) => {
    const matchesType = filterType === "all" || section.type === filterType;
    const matchesSearch = section.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="min-vh-100 bg-light p-4">
      <div className="container">
        {/* Header */}
        <div className="mb-5">
          <h1 className="display-4 fw-bold mb-2">Home Section Manager</h1>
          <p className="text-secondary">
            Manage and organize your application's home page sections
          </p>
        </div>

        {/* Alert Message */}
        {alertMessage && (
          <div
            className={`alert alert-${alertType} alert-dismissible fade show`}
            role="alert"
          >
            {alertMessage}
            <button
              type="button"
              className="btn-close"
              onClick={() => setAlertMessage("")}
            ></button>
          </div>
        )}

        {/* Controls */}
        <div className="card p-4 mb-4 shadow-sm">
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-4">
              <input
                type="text"
                placeholder="Search sections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-control"
              />
            </div>
            <div className="col-12 col-md-4">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="form-select"
              >
                <option value="all">All Types</option>
                {sectionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-4 d-grid">
              <button
                onClick={() => setShowForm(true)}
                className="btn btn-success d-flex align-items-center justify-content-center gap-2"
              >
                <Plus size={20} /> Create Section
              </button>
            </div>
          </div>
          {loading && <p className="text-secondary">Loading...</p>}
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="card border-start border-4 border-success p-4 mb-4 shadow-sm">
            <h3 className="h5 fw-bold mb-3">Create New Section</h3>

            <div className="row g-3 mb-3">
              <div className="col-12 col-md-4">
                <input
                  type="text"
                  placeholder="Section Title"
                  value={newSection.title}
                  onChange={(e) =>
                    setNewSection({ ...newSection, title: e.target.value })
                  }
                  className="form-control"
                />
              </div>
              <div className="col-12 col-md-4">
                <select
                  value={newSection.type}
                  onChange={(e) =>
                    setNewSection({ ...newSection, type: e.target.value })
                  }
                  className="form-select"
                >
                  {sectionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <input
                  type="number"
                  placeholder="Order"
                  value={newSection.order}
                  onChange={(e) =>
                    setNewSection({
                      ...newSection,
                      order: parseInt(e.target.value) || 0,
                    })
                  }
                  className="form-control"
                />
              </div>
            </div>

            {/* Items Section */}
            <div className="mb-4">
              <h6 className="fw-bold mb-3">
                Items ({newSection.items.length})
              </h6>
              {newSection.items.length > 0 && (
                <div className="mb-3">
                  {newSection.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="card mb-2 p-3 d-flex flex-row justify-content-between align-items-center"
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            backgroundColor: argbIntToHex(item.card_color),
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                          }}
                        ></div>
                        <small className="text-muted">
                          Type: <strong>{item.item_type}</strong> | ID:{" "}
                          <strong>{item.item_id}</strong> | Color:{" "}
                          <strong>{item.card_color}</strong>
                        </small>
                      </div>
                      <button
                        onClick={() => removeItemFromSection(idx)}
                        className="btn btn-sm btn-outline-danger"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showItemForm ? (
                <div className="card p-3 bg-light mb-3">
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-4">
                      <label className="form-label small">Item Type</label>
                      <select
                        value={newItem.item_type}
                        onChange={(e) => {
                          setNewItem({
                            ...newItem,
                            item_type: e.target.value,
                            item_id: "",
                          });
                          setSelectedItemPreview(null);
                        }}
                        className="form-select form-select-sm"
                      >
                        <option value="recipe">Recipe</option>
                        <option value="theme">Theme</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small">Select Item</label>
                      <button
                        onClick={openSelectModal}
                        className="btn btn-sm btn-outline-primary w-100 text-start"
                      >
                        {newItem.item_id
                          ? `${
                              selectedItemPreview?.name ||
                              selectedItemPreview?.themeName
                            }`
                          : `Browse ${newItem.item_type}s...`}
                      </button>
                    </div>

                    <div className="col-12 col-md-2">
                      <label className="form-label small">Card Color</label>
                      <input
                        type="color"
                        value={newItem.card_color}
                        onChange={(e) =>
                          setNewItem({ ...newItem, card_color: e.target.value })
                        }
                        className="form-control form-control-color form-control-sm"
                      />
                    </div>
                    <div className="col-12 col-md-2 d-flex align-items-end">
                      <small className="text-muted">
                        {hexToArgbInt(newItem.card_color)}
                      </small>
                    </div>
                  </div>

                  {/* Item Preview */}
                  {selectedItemPreview && (
                    <div className="mt-3 p-3 border rounded bg-white">
                      <h6 className="small fw-bold mb-2">Preview:</h6>
                      <div className="d-flex align-items-start gap-3">
                        {selectedItemPreview.image_url && (
                          <img
                            src={selectedItemPreview.image_url}
                            alt={
                              selectedItemPreview.name ||
                              selectedItemPreview.themeName
                            }
                            style={{
                              width: "100px",
                              height: "100px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              border: "2px solid #ddd",
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        )}
                        <div className="flex-grow-1">
                          <p className="mb-1 fw-bold">
                            {selectedItemPreview.name ||
                              selectedItemPreview.themeName}
                          </p>
                          <p className="mb-1 small text-muted">
                            ID: {selectedItemPreview.id}
                          </p>
                          {selectedItemPreview.description && (
                            <p
                              className="mb-0 small text-secondary"
                              style={{ maxHeight: "60px", overflow: "hidden" }}
                            >
                              {selectedItemPreview.description.slice(0, 100)}...
                            </p>
                          )}
                          {selectedItemPreview.color && (
                            <div className="d-flex align-items-center gap-2 mt-2">
                              <small className="text-muted">Theme Color:</small>
                              <div
                                style={{
                                  width: "20px",
                                  height: "20px",
                                  backgroundColor: argbIntToHex(
                                    selectedItemPreview.color
                                  ),
                                  border: "1px solid #ddd",
                                  borderRadius: "4px",
                                }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="d-flex gap-2 mt-3">
                    <button
                      onClick={addItemToSection}
                      className="btn btn-sm btn-primary"
                      disabled={!newItem.item_id}
                    >
                      <Save size={16} className="me-1" /> Add Item
                    </button>
                    <button
                      onClick={() => {
                        setShowItemForm(false);
                        setNewItem({
                          item_type: "recipe",
                          item_id: "",
                          card_color: "#FF5733",
                        });
                        setSelectedItemPreview(null);
                      }}
                      className="btn btn-sm btn-secondary"
                    >
                      <X size={16} className="me-1" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowItemForm(true)}
                  className="btn btn-sm btn-outline-primary mb-3"
                >
                  <Plus size={16} className="me-1" /> Add Item
                </button>
              )}
            </div>

            <div className="d-flex gap-2">
              <button
                onClick={createSection}
                className="btn btn-success d-flex align-items-center gap-2"
                disabled={loading}
              >
                <Save size={18} /> {loading ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setNewSection({
                    type: "recipe_grid",
                    title: "",
                    order: 0,
                    items: [],
                  });
                  setShowItemForm(false);
                  setNewItem({
                    item_type: "recipe",
                    item_id: "",
                    card_color: "#FF5733",
                  });
                  setSelectedItemPreview(null);
                }}
                className="btn btn-secondary d-flex align-items-center gap-2"
              >
                <X size={18} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Sections List */}
        <div className="mb-4">
          {filteredSections.length === 0 ? (
            <div className="card p-4 text-center">
              <p className="text-secondary mb-0">
                No sections found. Create one to get started!
              </p>
            </div>
          ) : (
            filteredSections.map((section) => (
              <div key={section.id} className="card mb-3 shadow-sm">
                {/* Section Header */}
                <div
                  className="card-header d-flex justify-content-between align-items-center"
                  onClick={() =>
                    setExpandedId(expandedId === section.id ? null : section.id)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <div className="d-flex align-items-center gap-3 flex-grow-1">
                    <button className="btn btn-sm btn-light p-0">
                      {expandedId === section.id ? (
                        <ChevronUp />
                      ) : (
                        <ChevronDown />
                      )}
                    </button>
                    <div>
                      <h5 className="mb-1">{section.title}</h5>
                      <div className="d-flex gap-2 flex-wrap">
                        <span className="badge bg-primary">{section.type}</span>
                        <span className="badge bg-secondary">
                          Order: {section.order}
                        </span>
                        <span className="badge bg-secondary">
                          {section.items?.length || 0} items
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(section.id);
                        const editableItems =
                          section.items?.map((item) => ({
                            item_type: item.item?.themeName
                              ? "theme"
                              : "recipe",
                            item_id: item.item?.id,
                            card_color: item.cardColor || 0,
                          })) || [];

                        setEditFormData({
                          ...section,
                          items: editableItems,
                        });
                      }}
                      className="btn btn-outline-primary btn-sm"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSection(section.id);
                      }}
                      className="btn btn-outline-danger btn-sm"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Edit Form */}
                {editingId === section.id && (
                  <div className="card-body bg-light">
                    <h6>Edit Section</h6>
                    <div className="row g-3 mb-3">
                      <div className="col-12 col-md-4">
                        <input
                          type="text"
                          placeholder="Section Title"
                          value={editFormData.title || ""}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              title: e.target.value,
                            })
                          }
                          className="form-control"
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <select
                          value={editFormData.type || ""}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              type: e.target.value,
                            })
                          }
                          className="form-select"
                        >
                          {sectionTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <input
                          type="number"
                          placeholder="Order"
                          value={editFormData.order || 0}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              order: parseInt(e.target.value),
                            })
                          }
                          className="form-control"
                        />
                      </div>
                    </div>

                    {/* Edit Items Section */}
                    <div className="mb-3">
                      <h6 className="fw-bold mb-3">
                        Items ({editFormData.items?.length || 0})
                      </h6>
                      {editFormData.items && editFormData.items.length > 0 && (
                        <div className="mb-3">
                          {editFormData.items.map((item, idx) => {
                            // try to read the original item object from the section (safe access)
                            const originalItem =
                              section.items && section.items[idx]
                                ? section.items[idx].item
                                : null;
                            const displayName =
                              originalItem?.name ??
                              originalItem?.themeName ??
                              item.item_name ??
                              "Unknown";

                            return (
                              <div
                                key={idx}
                                className="card mb-2 p-3 d-flex flex-row justify-content-between align-items-center"
                              >
                                <div className="d-flex align-items-center gap-3">
                                  <div
                                    style={{
                                      width: "30px",
                                      height: "30px",
                                      backgroundColor: argbIntToHex(
                                        item.card_color
                                      ),
                                      border: "1px solid #ddd",
                                      borderRadius: "4px",
                                    }}
                                  ></div>

                                  <div>
                                    <small className="text-muted d-block">
                                      Type: <strong>{item.item_type}</strong> |
                                      ID: <strong>{item.item_id}</strong> |
                                      Color: <strong>{item.card_color}</strong>
                                    </small>

                                    {/* New: show the item name */}
                                    <small className="text-muted d-block">
                                      Name: <strong>{displayName}</strong>
                                    </small>
                                  </div>
                                </div>

                                <button
                                  onClick={() => removeItemFromEditSection(idx)}
                                  className="btn btn-sm btn-outline-danger"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {showEditItemForm ? (
                        <div className="card p-3 bg-light mb-3">
                          <div className="row g-3 mb-3">
                            <div className="col-12 col-md-4">
                              <label className="form-label small">
                                Item Type
                              </label>
                              <select
                                value={editItem.item_type}
                                onChange={(e) => {
                                  setEditItem({
                                    ...editItem,
                                    item_type: e.target.value,
                                    item_id: "",
                                  });
                                  setEditItemPreview(null);
                                }}
                                className="form-select form-select-sm"
                              >
                                <option value="recipe">Recipe</option>
                                <option value="theme">Theme</option>
                              </select>
                            </div>

                            <div className="col-12 col-md-4">
                              <label className="form-label small">
                                Select Item
                              </label>
                              <button
                                onClick={openEditSelectModal}
                                className="btn btn-sm btn-outline-primary w-100 text-start"
                              >
                                {editItem.item_id
                                  ? `${
                                      editItemPreview?.name ||
                                      editItemPreview?.themeName
                                    }`
                                  : `Browse ${editItem.item_type}s...`}
                              </button>
                            </div>

                            <div className="col-12 col-md-2">
                              <label className="form-label small">
                                Card Color
                              </label>
                              <input
                                type="color"
                                value={editItem.card_color}
                                onChange={(e) =>
                                  setEditItem({
                                    ...editItem,
                                    card_color: e.target.value,
                                  })
                                }
                                className="form-control form-control-color form-control-sm"
                              />
                            </div>
                            <div className="col-12 col-md-2 d-flex align-items-end">
                              <small className="text-muted">
                                {hexToArgbInt(editItem.card_color)}
                              </small>
                            </div>
                          </div>

                          {/* Edit Item Preview */}
                          {editItemPreview && (
                            <div className="mt-3 p-3 border rounded bg-white">
                              <h6 className="small fw-bold mb-2">Preview:</h6>
                              <div className="d-flex align-items-start gap-3">
                                {editItemPreview.image_url && (
                                  <img
                                    src={editItemPreview.image_url}
                                    alt={
                                      editItemPreview.name ||
                                      editItemPreview.themeName
                                    }
                                    style={{
                                      width: "100px",
                                      height: "100px",
                                      objectFit: "cover",
                                      borderRadius: "8px",
                                      border: "2px solid #ddd",
                                    }}
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                  />
                                )}
                                <div className="flex-grow-1">
                                  <p className="mb-1 fw-bold">
                                    {editItemPreview.name ||
                                      editItemPreview.themeName}
                                  </p>
                                  <p className="mb-1 small text-muted">
                                    ID: {editItemPreview.id}
                                  </p>
                                  {editItemPreview.description && (
                                    <p
                                      className="mb-0 small text-secondary"
                                      style={{
                                        maxHeight: "60px",
                                        overflow: "hidden",
                                      }}
                                    >
                                      {editItemPreview.description.slice(
                                        0,
                                        100
                                      )}
                                      ...
                                    </p>
                                  )}
                                  {editItemPreview.color && (
                                    <div className="d-flex align-items-center gap-2 mt-2">
                                      <small className="text-muted">
                                        Theme Color:
                                      </small>
                                      <div
                                        style={{
                                          width: "20px",
                                          height: "20px",
                                          backgroundColor: argbIntToHex(
                                            editItemPreview.color
                                          ),
                                          border: "1px solid #ddd",
                                          borderRadius: "4px",
                                        }}
                                      ></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="d-flex gap-2 mt-3">
                            <button
                              onClick={addItemToEditSection}
                              className="btn btn-sm btn-primary"
                              disabled={!editItem.item_id}
                            >
                              <Save size={16} className="me-1" /> Add Item
                            </button>
                            <button
                              onClick={() => {
                                setShowEditItemForm(false);
                                setEditItem({
                                  item_type: "recipe",
                                  item_id: "",
                                  card_color: "#FF5733",
                                });
                                setEditItemPreview(null);
                              }}
                              className="btn btn-sm btn-secondary"
                            >
                              <X size={16} className="me-1" /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowEditItemForm(true)}
                          className="btn btn-sm btn-outline-primary mb-3"
                        >
                          <Plus size={16} className="me-1" /> Add Item
                        </button>
                      )}
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        onClick={() => updateSection(section.id)}
                        className="btn btn-primary d-flex align-items-center gap-2"
                        disabled={loading}
                      >
                        <Save size={18} />{" "}
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditFormData({});
                          setShowEditItemForm(false);
                          setEditItem({
                            item_type: "recipe",
                            item_id: "",
                            card_color: "#FF5733",
                          });
                          setEditItemPreview(null);
                          setEditRecipesPage(1);
                          setEditRecipesSearch("");
                          setEditRecipesSearchInput("");
                        }}
                        className="btn btn-secondary d-flex align-items-center gap-2"
                      >
                        <X size={18} /> Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Section Items */}
                {expandedId === section.id && (
                  <div className="card-body bg-light">
                    <h6>Items ({section.items?.length || 0})</h6>
                    {!section.items || section.items.length === 0 ? (
                      <p className="text-secondary small">
                        No items in this section
                      </p>
                    ) : (
                      section.items.map((item, idx) => (
                        <div key={idx} className="card mb-2">
                          <div className="card-body d-flex justify-content-between align-items-start p-3">
                            <div className="d-flex align-items-center gap-3">
                              {item.item?.image_url && (
                                <img
                                  src={item.item.image_url}
                                  alt={item.item.name || item.item.themeName}
                                  style={{
                                    width: "60px",
                                    height: "60px",
                                    objectFit: "cover",
                                    borderRadius: "6px",
                                    border: "1px solid #ddd",
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              )}
                              {item.cardColor && (
                                <div
                                  style={{
                                    width: "30px",
                                    height: "30px",
                                    backgroundColor: argbIntToHex(
                                      item.cardColor
                                    ),
                                    border: "1px solid #ddd",
                                    borderRadius: "4px",
                                  }}
                                ></div>
                              )}
                              <div>
                                <p className="mb-1 fw-bold">
                                  {item.item?.name ||
                                    item.item?.themeName ||
                                    "Item #" + item.sectionItemId}
                                </p>
                                <p className="mb-0 small text-secondary">
                                  ID: {item.item?.id}
                                </p>
                                <p className="mb-0 small text-muted">
                                  Section Item ID: {item.sectionItemId}
                                </p>
                              </div>
                            </div>
                            <span className="badge bg-success">Active</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Stats */}
        <div className="row g-3 mt-4">
          <div className="col-12 col-md-4">
            <div className="card text-center p-3">
              <p className="text-secondary small mb-1">Total Sections</p>
              <h4>{filteredSections.length}</h4>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card text-center p-3">
              <p className="text-secondary small mb-1">Total Items</p>
              <h4>
                {filteredSections.reduce(
                  (sum, s) => sum + (s.items?.length || 0),
                  0
                )}
              </h4>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card text-center p-3">
              <p className="text-secondary small mb-1">Section Types</p>
              <h4>{new Set(filteredSections.map((s) => s.type)).size}</h4>
            </div>
          </div>
        </div>

        {/* Select Item Modal (Create Mode) */}
        {showSelectModal && (
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Select {newItem.item_type === "recipe" ? "Recipe" : "Theme"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowSelectModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {/* Search Bar */}
                  {newItem.item_type === "recipe" && (
                    <div className="mb-3">
                      <div className="input-group">
                        <input
                          type="text"
                          placeholder="Search by name..."
                          value={recipesSearchInput}
                          onChange={(e) =>
                            setRecipesSearchInput(e.target.value)
                          }
                          onKeyPress={(e) => {
                            if (e.key === "Enter") handleRecipesSearch();
                          }}
                          className="form-control"
                        />
                        <button
                          onClick={handleRecipesSearch}
                          className="btn btn-primary"
                          type="button"
                        >
                          <Search size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Items List */}
                  {loadingItems ? (
                    <div className="text-center py-5">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : availableItems.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      No {newItem.item_type}s found
                    </div>
                  ) : (
                    <div className="row g-3">
                      {availableItems.map((item) => (
                        <div key={item.id} className="col-12">
                          <div
                            className="card cursor-pointer"
                            onClick={() => selectItemFromModal(item)}
                            style={{
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.02)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 8px rgba(0,0,0,0.15)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          >
                            <div className="card-body">
                              <div className="d-flex align-items-center gap-3">
                                {item.image_url && (
                                  <img
                                    src={item.image_url}
                                    alt={item.name || item.themeName}
                                    style={{
                                      width: "80px",
                                      height: "80px",
                                      objectFit: "cover",
                                      borderRadius: "8px",
                                      flexShrink: 0,
                                    }}
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                  />
                                )}
                                <div className="flex-grow-1">
                                  <h6 className="mb-1">
                                    {item.name || item.themeName}
                                  </h6>
                                  <p className="mb-0 small text-muted">
                                    ID: {item.id}
                                  </p>
                                  {item.description && (
                                    <p className="mb-0 small text-secondary mt-1">
                                      {item.description.slice(0, 100)}
                                      {item.description.length > 100 && "..."}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {newItem.item_type === "recipe" && recipesTotalPages > 1 && (
                    <div className="d-flex justify-content-center align-items-center gap-3 mt-4">
                      <button
                        onClick={() =>
                          setRecipesPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={recipesPage === 1}
                        className="btn btn-outline-secondary"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span>
                        Page {recipesPage} of {recipesTotalPages}
                      </span>
                      <button
                        onClick={() =>
                          setRecipesPage((prev) =>
                            Math.min(recipesTotalPages, prev + 1)
                          )
                        }
                        disabled={recipesPage === recipesTotalPages}
                        className="btn btn-outline-secondary"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowSelectModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Select Item Modal (Edit Mode) */}
        {showEditSelectModal && (
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Select{" "}
                    {editItem.item_type === "recipe" ? "Recipe" : "Theme"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowEditSelectModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {/* Search Bar */}
                  {editItem.item_type === "recipe" && (
                    <div className="mb-3">
                      <div className="input-group">
                        <input
                          type="text"
                          placeholder="Search by name..."
                          value={editRecipesSearchInput}
                          onChange={(e) =>
                            setEditRecipesSearchInput(e.target.value)
                          }
                          onKeyPress={(e) => {
                            if (e.key === "Enter") handleEditRecipesSearch();
                          }}
                          className="form-control"
                        />
                        <button
                          onClick={handleEditRecipesSearch}
                          className="btn btn-primary"
                          type="button"
                        >
                          <Search size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Items List */}
                  {loadingEditItems ? (
                    <div className="text-center py-5">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : editAvailableItems.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      No {editItem.item_type}s found
                    </div>
                  ) : (
                    <div className="row g-3">
                      {editAvailableItems.map((item) => (
                        <div key={item.id} className="col-12">
                          <div
                            className="card cursor-pointer"
                            onClick={() => selectEditItemFromModal(item)}
                            style={{
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.02)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 8px rgba(0,0,0,0.15)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          >
                            <div className="card-body">
                              <div className="d-flex align-items-center gap-3">
                                {item.image_url && (
                                  <img
                                    src={item.image_url}
                                    alt={item.name || item.themeName}
                                    style={{
                                      width: "80px",
                                      height: "80px",
                                      objectFit: "cover",
                                      borderRadius: "8px",
                                      flexShrink: 0,
                                    }}
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                  />
                                )}
                                <div className="flex-grow-1">
                                  <h6 className="mb-1">
                                    {item.name || item.themeName}
                                  </h6>
                                  <p className="mb-0 small text-muted">
                                    ID: {item.id}
                                  </p>
                                  {item.description && (
                                    <p className="mb-0 small text-secondary mt-1">
                                      {item.description.slice(0, 100)}
                                      {item.description.length > 100 && "..."}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {editItem.item_type === "recipe" &&
                    editRecipesTotalPages > 1 && (
                      <div className="d-flex justify-content-center align-items-center gap-3 mt-4">
                        <button
                          onClick={() =>
                            setEditRecipesPage((prev) => Math.max(1, prev - 1))
                          }
                          disabled={editRecipesPage === 1}
                          className="btn btn-outline-secondary"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span>
                          Page {editRecipesPage} of {editRecipesTotalPages}
                        </span>
                        <button
                          onClick={() =>
                            setEditRecipesPage((prev) =>
                              Math.min(editRecipesTotalPages, prev + 1)
                            )
                          }
                          disabled={editRecipesPage === editRecipesTotalPages}
                          className="btn btn-outline-secondary"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowEditSelectModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete Modal */}
        {showConfirm && (
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Confirm Deletion</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={cancelDelete}
                  ></button>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to delete this section?</p>
                </div>
                <div className="modal-footer">
                  <button
                    onClick={confirmDelete}
                    disabled={loading}
                    className="btn btn-danger"
                  >
                    {loading ? "Deleting..." : "Yes, Delete"}
                  </button>
                  <button
                    onClick={cancelDelete}
                    disabled={loading}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeSectionAdmin;
