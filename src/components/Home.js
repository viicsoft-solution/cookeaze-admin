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
  Eye,
  EyeOff,
} from "lucide-react";

import cloudinaryService from "./cloudinaryService";

const HomeSectionAdmin = () => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newSection, setNewSection] = useState({
    type: "recipe_grid",
    title: "",
    order: 0,
    items: [],
  });
  const [filterType, setFilterType] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [editingItemIndex, setEditingItemIndex] = useState(null);

  // Alert state
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("");

  // Item form state
  const [newItem, setNewItem] = useState({
    item_type: "recipe",
    item_id: "",
    card_color: "#FF5733",
    image_url: "",
    link_url: "",
  });
  const [showItemForm, setShowItemForm] = useState(false);

  // Edit item form state
  const [editItem, setEditItem] = useState({
    item_type: "recipe",
    item_id: "",
    card_color: "#FF5733",
    image_url: "",
    link_url: "",
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

  // Cloudinary upload states (create + edit)
  const [newBannerFile, setNewBannerFile] = useState(null);
  const [editBannerFile, setEditBannerFile] = useState(null);
  const [uploadingNewBanner, setUploadingNewBanner] = useState(false);
  const [uploadingEditBanner, setUploadingEditBanner] = useState(false);

  const API_BASE = "https://api.cookeaze.app/api/home-sections";
  const RECIPES_API = "https://api.cookeaze.app/api/recipes/";
  const THEMES_API = "https://api.cookeaze.app/api/themes-recipes/";

  const sectionTypes = [
    "hero_carousel",
    "themed_recipe_grid",
    "recipe_grid",
    "graphic_banner",
    "creator_spotlight",
    "exclusive_recipes",
  ];

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
        editRecipesSearch,
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
        (item) => item.id === parseInt(newItem.item_id),
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
        (item) => item.id === parseInt(editItem.item_id),
      );
      setEditItemPreview(selected || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editItem.item_id, editAvailableItems]);

  const showAlert = (message, type) => {
    setAlertMessage(message);
    setAlertType(type);
  };

  const isGraphicBanner = (type) => type === "graphic_banner";

  const hexToArgbInt = (hex) => {
    if (!hex) return parseInt("FFFF5733", 16);
    hex = String(hex).replace("#", "").replace(/^0x/i, "");
    if (hex.length === 6) hex = "FF" + hex;
    return parseInt(hex, 16);
  };

  const normalizeCardColorToInt = (value) => {
    if (value === null || value === undefined || value === "")
      return hexToArgbInt("#FF5733");
    if (typeof value === "number" && !isNaN(value)) return value;
    if (typeof value === "string") {
      if (/^-?\d+$/.test(value)) return parseInt(value, 10);
      return hexToArgbInt(value);
    }
    return hexToArgbInt("#FF5733");
  };

  // ✅ Returns null for null/undefined/0 so callers can hide the swatch
  const argbIntToHex = (argbInt) => {
    if (argbInt === null || argbInt === undefined || argbInt === 0) return null;
    const safeNum = normalizeCardColorToInt(argbInt);
    if (isNaN(safeNum)) return null;
    const hex = (safeNum >>> 0).toString(16).padStart(8, "0");
    return "#" + hex.slice(2);
  };

  // ✅ Always returns a number for the API payload — never null/undefined.
  //    Uses 0 as "no color" sentinel so the backend never wipes a stored
  //    color when only order/title changes.
  const safeCardColorInt = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number" && !isNaN(value)) return value;
    return normalizeCardColorToInt(value);
  };

  // Upload helpers
  const uploadNewBannerToCloudinary = async () => {
    if (!newBannerFile) {
      showAlert("Please choose a file first", "warning");
      return;
    }
    try {
      setUploadingNewBanner(true);
      const url = await cloudinaryService.uploadFile(newBannerFile, {
        folder: "cookeaze_uploads",
      });
      setNewItem((prev) => ({ ...prev, image_url: url }));
      showAlert("Banner uploaded successfully", "success");
    } catch (e) {
      console.error(e);
      showAlert("Banner upload failed", "danger");
    } finally {
      setUploadingNewBanner(false);
    }
  };

  const uploadEditBannerToCloudinary = async () => {
    if (!editBannerFile) {
      showAlert("Please choose a file first", "warning");
      return;
    }
    try {
      setUploadingEditBanner(true);
      const url = await cloudinaryService.uploadFile(editBannerFile, {
        folder: "cookeaze_uploads",
      });
      setEditItem((prev) => ({ ...prev, image_url: url }));
      showAlert("Banner uploaded successfully", "success");
    } catch (e) {
      console.error(e);
      showAlert("Banner upload failed", "danger");
    } finally {
      setUploadingEditBanner(false);
    }
  };

  // Fetch sections (active + disabled)
  const fetchSections = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const [activeRes, disabledRes] = await Promise.all([
        fetch(`${API_BASE}/`, { headers: { accept: "application/json" } }),
        fetch(`${API_BASE}/disabled/`, {
          headers: {
            accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }),
      ]);

      const activeData = await activeRes.json();
      const disabledData = await disabledRes.json();

      const activeSections = activeData.isSuccessful ? (activeData.data || []) : [];
      const disabledSections = disabledData.isSuccessful
        ? (disabledData.data || []).map((s) => ({ ...s, is_active: false }))
        : [];

      if (activeData.isSuccessful || disabledData.isSuccessful) {
        setSections([...activeSections, ...disabledSections]);
      } else {
        showAlert("Failed to fetch sections", "danger");
      }
    } catch (error) {
      console.error("Error fetching sections:", error);
      showAlert("Failed to fetch sections", "danger");
    } finally {
      setLoading(false);
    }
  };

  // Fetch available items (create)
  const fetchAvailableItems = async (itemType, page = 1, search = "") => {
    try {
      setLoadingItems(true);

      if (itemType === "recipe") {
        let apiUrl = newSection.type === "exclusive_recipes" 
          ? `https://api.cookeaze.app/api/recipes/exclusive/?page=${page}` 
          : `${RECIPES_API}?page=${page}`;
        if (search) apiUrl += `&search=${encodeURIComponent(search)}`;

        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });
        const data = await response.json();

        if (data.isSuccessful) {
          setAvailableItems(data.data.results || []);
          const totalCount = data.data.count;
          const itemsPerPage = data.data.results?.length || 10;
          setRecipesTotalPages(Math.ceil(totalCount / itemsPerPage));
        } else {
          showAlert(`Failed to fetch ${itemType}s`, "warning");
          setAvailableItems([]);
        }
      } else if (itemType === "user") {
        let apiUrl = `https://api.cookeaze.app/api/creators/?page=${page}`;
        if (search) apiUrl += `&search=${encodeURIComponent(search)}`;

        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });
        const data = await response.json();

        if (data.isSuccessful) {
          setAvailableItems(data.data || []);
          const pagination = data.pagination;
          setRecipesTotalPages(pagination?.total_pages || 1);
        } else {
          showAlert(`Failed to fetch creators`, "warning");
          setAvailableItems([]);
        }
      } else {
        const response = await fetch(THEMES_API, {
          headers: { accept: "application/json" },
        });
        const data = await response.json();

        if (data.isSuccessful) setAvailableItems(data.data.results || []);
        else {
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

  // Fetch available items (edit)
  const fetchEditAvailableItems = async (itemType, page = 1, search = "") => {
    try {
      setLoadingEditItems(true);

      if (itemType === "recipe") {
        let apiUrl = editFormData.type === "exclusive_recipes" 
          ? `https://api.cookeaze.app/api/recipes/exclusive/?page=${page}` 
          : `${RECIPES_API}?page=${page}`;
        if (search) apiUrl += `&search=${encodeURIComponent(search)}`;

        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });
        const data = await response.json();

        if (data.isSuccessful) {
          setEditAvailableItems(data.data.results || []);
          const totalCount = data.data.count;
          const itemsPerPage = data.data.results?.length || 10;
          setEditRecipesTotalPages(Math.ceil(totalCount / itemsPerPage));
        } else {
          showAlert(`Failed to fetch ${itemType}s`, "warning");
          setEditAvailableItems([]);
        }
      } else if (itemType === "user") {
        let apiUrl = `https://api.cookeaze.app/api/creators/?page=${page}`;
        if (search) apiUrl += `&search=${encodeURIComponent(search)}`;

        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });
        const data = await response.json();

        if (data.isSuccessful) {
          setEditAvailableItems(data.data || []);
          const pagination = data.pagination;
          setEditRecipesTotalPages(pagination?.total_pages || 1);
        } else {
          showAlert(`Failed to fetch creators`, "warning");
          setEditAvailableItems([]);
        }
      } else {
        const response = await fetch(THEMES_API, {
          headers: { accept: "application/json" },
        });
        const data = await response.json();

        if (data.isSuccessful) setEditAvailableItems(data.data.results || []);
        else {
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

  const handleRecipesSearch = () => {
    setRecipesSearch(recipesSearchInput);
    setRecipesPage(1);
  };

  const handleEditRecipesSearch = () => {
    setEditRecipesSearch(editRecipesSearchInput);
    setEditRecipesPage(1);
  };

  const openSelectModal = () => {
    setShowSelectModal(true);
    setRecipesPage(1);
    setRecipesSearch("");
    setRecipesSearchInput("");
  };

  const openEditSelectModal = () => {
    setShowEditSelectModal(true);
    setEditRecipesPage(1);
    setEditRecipesSearch("");
    setEditRecipesSearchInput("");
  };

  const selectItemFromModal = (item) => {
    setNewItem({ ...newItem, item_id: item.id.toString() });
    setSelectedItemPreview(item);
    setShowSelectModal(false);
  };

  const selectEditItemFromModal = (item) => {
    setEditItem({ ...editItem, item_id: item.id.toString() });
    setEditItemPreview(item);
    setShowEditSelectModal(false);
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
        title: newSection.title || "",
        type: newSection.type,
        order: parseInt(newSection.order) || 0,
        items: newSection.items.map((item) => {
          const mappedItem = {
            item_type: item.item_type || "recipe",
            // ✅ Always send card_color as a number — never omit it
            card_color: safeCardColorInt(item.card_color),
          };
          if (item.item_id) mappedItem.item_id = parseInt(item.item_id);
          if (item.image_url) mappedItem.image_url = item.image_url;
          if (item.link_url) mappedItem.link_url = item.link_url;
          return mappedItem;
        }),
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
        setNewItem({
          item_type: "recipe",
          item_id: "",
          card_color: "#FF5733",
          image_url: "",
          link_url: "",
        });
        setShowItemForm(false);
        setSelectedItemPreview(null);
        setRecipesPage(1);
        setRecipesSearch("");
        setRecipesSearchInput("");
        setNewBannerFile(null);
        setUploadingNewBanner(false);
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
        title: editFormData.title || "",
        type: editFormData.type,
        order: parseInt(editFormData.order) || 0,
        // ✅ Always send card_color as a number so the backend never wipes
        //    a stored color when only the order/title changes.
        //    safeCardColorInt returns 0 for null (meaning "no color").
        items: (editFormData.items || []).map((item) => {
          const mappedItem = {
            item_type: item.item_type || "recipe",
            card_color: safeCardColorInt(item.card_color),
          };
          if (item.item_id) mappedItem.item_id = parseInt(item.item_id);
          if (item.image_url) mappedItem.image_url = item.image_url;
          if (item.link_url) mappedItem.link_url = item.link_url;
          return mappedItem;
        }),
      };

      // Process buffered deletions first
      if (deletedItemIds.length > 0) {
        await Promise.all(
          deletedItemIds.map((sid) =>
            fetch(`${API_BASE}/${id}/remove-item/`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                accept: "application/json",
              },
              body: JSON.stringify({ section_item_id: sid }),
            }),
          ),
        );
      }

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
        setEditingItemIndex(null);
        setShowEditItemForm(false);
        setDeletedItemIds([]);
        setEditRecipesPage(1);
        setEditRecipesSearch("");
        setEditRecipesSearchInput("");
        setEditBannerFile(null);
        setUploadingEditBanner(false);
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

  // Toggle visibility
  const toggleVisibility = async (id, currentStatus) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/${id}/toggle-visibility/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      const data = await response.json();

      if (data.isSuccessful) {
        await fetchSections();
        showAlert(data.message || `Section is now ${!currentStatus ? 'visible' : 'hidden'}.`, "success");
      } else {
        showAlert(data.message || "Failed to toggle visibility", "danger");
      }
    } catch (error) {
      console.error("Error toggling visibility:", error);
      showAlert("Failed to toggle visibility", "danger");
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

  // Add item to section (create)
  const addItemToSection = () => {
    const isGraphicBannerSection = isGraphicBanner(newSection.type);

    if (isGraphicBannerSection) {
      if (newItem.item_id) {
        if (!newItem.image_url) {
          showAlert("Please upload/select an image first", "warning");
          return;
        }
      } else {
        if (!newItem.image_url || !newItem.link_url) {
          showAlert("Please provide both image and link URL", "warning");
          return;
        }
      }
    } else {
      if (!newItem.item_id) {
        showAlert("Please select an item", "warning");
        return;
      }
    }

    const item = {
      item_type: newItem.item_type,
      card_color: hexToArgbInt(newItem.card_color),
    };

    if (newItem.item_id) item.item_id = parseInt(newItem.item_id);

    if (isGraphicBannerSection) {
      if (newItem.image_url) item.image_url = newItem.image_url;
      if (newItem.link_url) item.link_url = newItem.link_url;
    }

    setNewSection((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));

    setNewItem({
      item_type: "recipe",
      item_id: "",
      card_color: "#FF5733",
      image_url: "",
      link_url: "",
    });
    setNewBannerFile(null);
    setUploadingNewBanner(false);
    setShowItemForm(false);
    setSelectedItemPreview(null);
    showAlert("Item added to section", "success");
  };

  // Add/update item in edit section
  const addItemToEditSection = () => {
    const isGraphicBannerSection = isGraphicBanner(editFormData.type);

    if (isGraphicBannerSection) {
      if (editItem.item_id) {
        if (!editItem.image_url) {
          showAlert("Please upload/select an image first", "warning");
          return;
        }
      } else {
        if (!editItem.image_url || !editItem.link_url) {
          showAlert("Please provide both image and link URL", "warning");
          return;
        }
      }
    } else {
      if (!editItem.item_id) {
        showAlert("Please select an item", "warning");
        return;
      }
    }

    const item = {
      item_type: editItem.item_type,
      card_color: hexToArgbInt(editItem.card_color),
    };

    if (editItem.item_id) item.item_id = parseInt(editItem.item_id);

    if (isGraphicBannerSection) {
      if (editItem.image_url) item.image_url = editItem.image_url;
      if (editItem.link_url) item.link_url = editItem.link_url;
    }

    if (
      editFormData.items &&
      editingItemIndex !== null &&
      editFormData.items[editingItemIndex]
    ) {
      if (editFormData.items[editingItemIndex].section_item_id) {
        item.section_item_id =
          editFormData.items[editingItemIndex].section_item_id;
      }
    }

    setEditFormData((prev) => {
      const prevItems = prev.items || [];

      if (editingItemIndex !== null) {
        const updated = [...prevItems];
        if (updated[editingItemIndex].section_item_id) {
          item.section_item_id = updated[editingItemIndex].section_item_id;
        }
        updated[editingItemIndex] = item;
        return { ...prev, items: updated };
      }

      return { ...prev, items: [...prevItems, item] };
    });

    setEditItem({
      item_type: "recipe",
      item_id: "",
      card_color: "#FF5733",
      image_url: "",
      link_url: "",
    });
    setEditBannerFile(null);
    setUploadingEditBanner(false);
    setShowEditItemForm(false);
    setEditItemPreview(null);
    setEditingItemIndex(null);

    showAlert(
      editingItemIndex !== null ? "Item updated" : "Item added to section",
      "success",
    );
  };

  const removeItemFromSection = (indexToRemove) => {
    setNewSection((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== indexToRemove),
    }));
  };

  const removeItemFromEditSection = async (indexToRemove) => {
    const itemToRemove = editFormData.items[indexToRemove];

    if (itemToRemove && itemToRemove.section_item_id) {
      setDeletedItemIds((prev) => [...prev, itemToRemove.section_item_id]);
    }

    setEditFormData((prev) => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== indexToRemove),
    }));

    if (editingItemIndex === indexToRemove) {
      setEditingItemIndex(null);
      setShowEditItemForm(false);
      setEditItemPreview(null);
      setEditItem({
        item_type: "recipe",
        item_id: "",
        card_color: "#FF5733",
        image_url: "",
        link_url: "",
      });
    }
  };

  const filteredSections = sections.filter((section) => {
    const matchesType = filterType === "all" || section.type === filterType;
    const matchesSearch = section.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
      
    let matchesVisibility = true;
    if (visibilityFilter === "visible") {
      matchesVisibility = section.is_active === true;
    } else if (visibilityFilter === "hidden") {
      matchesVisibility = section.is_active === false;
    }

    return matchesType && matchesSearch && matchesVisibility;
  });

  return (
    <div className="min-vh-100 bg-light p-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="container-fluid" style={{ maxWidth: "1400px" }}>
        {/* Header */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end mb-4 border-bottom pb-3">
          <div>
            <h1 className="h2 fw-bold text-dark mb-1">Home Section Manager</h1>
            <p className="text-secondary mb-0">
              Manage and organize your application's home page sections
            </p>
          </div>
          <div className="mt-3 mt-md-0">
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn btn-primary d-flex align-items-center gap-2 shadow-sm fw-medium"
            >
              {showForm ? <X size={18} /> : <Plus size={18} />} 
              {showForm ? "Cancel Creation" : "Create New Section"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-4">
            <div className="card border-0 shadow-sm rounded-3 bg-white p-3 border-start border-4 border-primary h-100">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted small text-uppercase mb-1 fw-bold">Total Sections</p>
                  <h3 className="mb-0 fw-bold text-dark">{filteredSections.length}</h3>
                </div>
                <div className="bg-primary bg-opacity-10 p-3 rounded-3 text-primary">
                  <Search size={24} />
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card border-0 shadow-sm rounded-3 bg-white p-3 border-start border-4 border-success h-100">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted small text-uppercase mb-1 fw-bold">Total Items</p>
                  <h3 className="mb-0 fw-bold text-dark">
                    {filteredSections.reduce((sum, s) => sum + (s.items?.length || 0), 0)}
                  </h3>
                </div>
                <div className="bg-success bg-opacity-10 p-3 rounded-3 text-success">
                  <Plus size={24} />
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card border-0 shadow-sm rounded-3 bg-white p-3 border-start border-4 border-info h-100">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted small text-uppercase mb-1 fw-bold">Section Types</p>
                  <h3 className="mb-0 fw-bold text-dark">{new Set(filteredSections.map((s) => s.type)).size}</h3>
                </div>
                <div className="bg-info bg-opacity-10 p-3 rounded-3 text-info">
                  <Eye size={24} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alert */}
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
        <div className="card border-0 shadow-sm rounded-3 bg-white mb-4">
          <div className="card-body p-3 p-md-4">
            <div className="row g-3 align-items-center">
              <div className="col-12 col-md-4">
                <div className="input-group shadow-sm">
                  <span className="input-group-text bg-white border-end-0 text-muted">
                    <Search size={18} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search sections..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-control border-start-0 ps-0"
                  />
                </div>
              </div>

              <div className="col-12 col-md-4">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="form-select shadow-sm"
                >
                  <option value="all">All Types</option>
                  {sectionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-4">
                <select
                  value={visibilityFilter}
                  onChange={(e) => setVisibilityFilter(e.target.value)}
                  className="form-select shadow-sm"
                >
                  <option value="all">All Visibility</option>
                  <option value="visible">Visible Only</option>
                  <option value="hidden">Hidden Only</option>
                </select>
              </div>
            </div>
            {loading && <div className="mt-3 text-primary small fw-medium d-flex align-items-center"><span className="spinner-border spinner-border-sm me-2"></span>Loading data...</div>}
          </div>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="card border-0 shadow-sm rounded-3 p-4 mb-4 bg-white border-top border-4 border-primary">
            <h4 className="fw-bold mb-4 text-dark">Create New Section</h4>

            <div className="row g-3 mb-4">
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
                  onChange={(e) => {
                    const newType = e.target.value;
                    setNewSection({ ...newSection, type: newType });
                    if (newType === "creator_spotlight") {
                      setNewItem(prev => ({ ...prev, item_type: "user", item_id: "" }));
                      setSelectedItemPreview(null);
                    } else if (newType === "exclusive_recipes") {
                      setNewItem(prev => ({ ...prev, item_type: "recipe", item_id: "" }));
                      setSelectedItemPreview(null);
                    } else if (newItem.item_type === "user") {
                      setNewItem(prev => ({ ...prev, item_type: "recipe", item_id: "" }));
                      setSelectedItemPreview(null);
                    }
                  }}
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

            {/* Items */}
            <div className="mb-4">
              <h6 className="fw-bold mb-3">
                Items ({newSection.items.length})
              </h6>

              {newSection.items.length > 0 && (
                <div className="mb-3">
                  {newSection.items.map((item, idx) => {
                    const swatchColor = argbIntToHex(item.card_color);
                    return (
                      <div
                        key={`${item.item_id ?? "noid"}-${item.card_color}-${idx}`}
                        className="card mb-2 p-3 d-flex flex-row justify-content-between align-items-center"
                      >
                        <div className="d-flex align-items-center gap-3">
                          {swatchColor && (
                            <div
                              style={{
                                width: "30px",
                                height: "30px",
                                backgroundColor: swatchColor,
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                              }}
                            />
                          )}
                          <div>
                            <small className="text-muted d-block">
                              Type: <strong>{item.item_type}</strong>
                              {item.item_id && (
                                <>
                                  {" "}
                                  | ID: <strong>{item.item_id}</strong>
                                </>
                              )}
                              {item.card_color !== null &&
                                item.card_color !== undefined &&
                                item.card_color !== 0 && (
                                  <>
                                    {" "}
                                    | Color: <strong>{item.card_color}</strong>
                                  </>
                                )}
                            </small>

                            {item.image_url && (
                              <small className="text-muted d-block">
                                Image:{" "}
                                <strong>
                                  {item.image_url.slice(0, 50)}...
                                </strong>
                              </small>
                            )}

                            {item.link_url && (
                              <small className="text-muted d-block">
                                Link:{" "}
                                <strong>{item.link_url.slice(0, 50)}...</strong>
                              </small>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => removeItemFromSection(idx)}
                          className="btn btn-sm btn-outline-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
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
                        disabled={newSection.type === "creator_spotlight" || newSection.type === "exclusive_recipes"}
                      >
                        {newSection.type === "creator_spotlight" ? (
                          <option value="user">User</option>
                        ) : newSection.type === "exclusive_recipes" ? (
                          <option value="recipe">Recipe</option>
                        ) : (
                          <>
                            <option value="recipe">Recipe</option>
                            <option value="theme">Theme</option>
                          </>
                        )}
                      </select>
                    </div>

                    {isGraphicBanner(newSection.type) && (
                      <div className="col-12">
                        <label className="form-label small">Banner Image</label>
                        <div className="d-flex gap-2 flex-wrap">
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="form-control form-control-sm"
                            onChange={(e) =>
                              setNewBannerFile(e.target.files?.[0] || null)
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={uploadNewBannerToCloudinary}
                            disabled={uploadingNewBanner || !newBannerFile}
                          >
                            {uploadingNewBanner ? "Uploading..." : "Upload"}
                          </button>
                        </div>

                        {newItem.image_url && (
                          <small className="text-muted d-block mt-2">
                            Uploaded:{" "}
                            <strong>{newItem.image_url.slice(0, 60)}...</strong>
                          </small>
                        )}
                      </div>
                    )}

                    <div className="col-12 col-md-4">
                      <label className="form-label small">
                        {isGraphicBanner(newSection.type)
                          ? "Select Item (Optional)"
                          : "Select Item"}
                      </label>
                      <button
                        onClick={openSelectModal}
                        className="btn btn-sm btn-outline-primary w-100 text-start"
                      >
                        {newItem.item_id
                          ? `${selectedItemPreview?.name || selectedItemPreview?.themeName || selectedItemPreview?.creator_name || "Selected"}`
                          : `Browse ${newItem.item_type}s...`}
                      </button>
                    </div>

                    {isGraphicBanner(newSection.type) && (
                      <div className="col-12">
                        <label className="form-label small">
                          Link URL{" "}
                          {!newItem.item_id &&
                            "(Required for non-recipe items)"}
                        </label>
                        <input
                          type="text"
                          placeholder="Enter link URL"
                          value={newItem.link_url}
                          onChange={(e) =>
                            setNewItem({ ...newItem, link_url: e.target.value })
                          }
                          className="form-control form-control-sm"
                        />
                      </div>
                    )}

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

                  {/* Preview */}
                  {selectedItemPreview && (
                    <div className="mt-3 p-3 border rounded bg-white">
                      <h6 className="small fw-bold mb-2">Preview:</h6>
                      <div className="d-flex align-items-start gap-3">
                        {(selectedItemPreview.image_url || selectedItemPreview.profile_picture_url) && (
                          <img
                            src={selectedItemPreview.image_url || selectedItemPreview.profile_picture_url}
                            alt={
                              selectedItemPreview.name ||
                              selectedItemPreview.themeName ||
                              selectedItemPreview.creator_name
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
                              selectedItemPreview.themeName ||
                              selectedItemPreview.creator_name}
                          </p>
                          <p className="mb-1 small text-muted">
                            ID: {selectedItemPreview.id}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="d-flex gap-2 mt-3">
                    <button
                      onClick={addItemToSection}
                      className="btn btn-sm btn-primary"
                      disabled={
                        isGraphicBanner(newSection.type)
                          ? !newItem.image_url ||
                            (!newItem.item_id && !newItem.link_url)
                          : !newItem.item_id
                      }
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
                          image_url: "",
                          link_url: "",
                        });
                        setSelectedItemPreview(null);
                        setNewBannerFile(null);
                        setUploadingNewBanner(false);
                      }}
                      className="btn btn-sm btn-secondary"
                    >
                      <X size={16} className="me-1" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNewItem({
                      item_type: newSection.type === "creator_spotlight" ? "user" : "recipe",
                      item_id: "",
                      card_color: "#FF5733",
                      image_url: "",
                      link_url: "",
                    });
                    setShowItemForm(true);
                  }}
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
                    image_url: "",
                    link_url: "",
                  });
                  setSelectedItemPreview(null);
                  setNewBannerFile(null);
                  setUploadingNewBanner(false);
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
            <div className="card border-0 shadow-sm rounded-3 p-5 text-center bg-white">
              <div className="text-muted mb-3"><Search size={40} opacity={0.5} /></div>
              <h5 className="text-dark fw-bold">No sections found</h5>
              <p className="text-secondary mb-0">Create a new section or adjust your search filters.</p>
            </div>
          ) : (
            filteredSections.map((section) => (
              <div key={section.id} className="card mb-3 border-0 shadow-sm rounded-3">
                {/* Section Header */}
                <div
                  className="card-header bg-white border-bottom-0 p-3 p-md-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3"
                  onClick={() =>
                    setExpandedId(expandedId === section.id ? null : section.id)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <div className="d-flex align-items-center gap-3 flex-grow-1">
                    <button className="btn btn-sm btn-light rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "36px", height: "36px" }}>
                      {expandedId === section.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <div>
                      <h5 className="mb-1 fw-bold text-dark">{section.title}</h5>
                      <div className="d-flex gap-2 flex-wrap">
                        <span className="badge bg-primary px-3 py-2 rounded-pill fw-medium">{section.type}</span>
                        <span className="badge bg-secondary px-3 py-2 rounded-pill fw-medium">Order: {section.order}</span>
                        <span className="badge bg-info px-3 py-2 rounded-pill fw-medium">{section.items?.length || 0} items</span>
                        {!section.is_active && <span className="badge bg-warning text-dark px-3 py-2 rounded-pill fw-medium">Hidden</span>}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVisibility(section.id, section.is_active);
                      }}
                      className="btn btn-outline-secondary btn-sm"
                      title={section.is_active ? "Hide Section" : "Show Section"}
                    >
                      {section.is_active ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();

                        setEditingId(section.id);
                        setEditingItemIndex(null);
                        setDeletedItemIds([]);
                        setShowEditItemForm(false);
                        setEditItemPreview(null);

                        const editableItems =
                          section.items?.map((it) => {
                            const cColor =
                              it.card_color !== undefined
                                ? it.card_color
                                : it.cardColor;
                            const mappedItem = {
                              item_type: it.item?.themeName
                                ? "theme"
                                : it.itemType || "recipe",
                              // ✅ Use 0 instead of null so safeCardColorInt
                              //    always sends a number in the PUT payload,
                              //    preventing the backend from wiping stored colors.
                              card_color:
                                cColor !== null && cColor !== undefined
                                  ? typeof cColor === "number"
                                    ? cColor
                                    : normalizeCardColorToInt(cColor)
                                  : 0,
                            };

                            if (it.sectionItemId) {
                              mappedItem.section_item_id = it.sectionItemId;
                            }

                            if (it.item?.id) mappedItem.item_id = it.item.id;
                            else if (typeof it.itemId === "number")
                              mappedItem.item_id = it.itemId;

                            if (it.imageUrl) mappedItem.image_url = it.imageUrl;

                            if (it.linkUrl) mappedItem.link_url = it.linkUrl;
                            else if (it.link_url)
                              mappedItem.link_url = it.link_url;

                            return mappedItem;
                          }) || [];

                        setEditFormData({ ...section, items: editableItems });
                        setEditBannerFile(null);
                        setUploadingEditBanner(false);
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
                          onChange={(e) => {
                            const newType = e.target.value;
                            setEditFormData({ ...editFormData, type: newType });
                            if (newType === "creator_spotlight") {
                              setEditItem(prev => ({ ...prev, item_type: "user", item_id: "" }));
                              setEditItemPreview(null);
                            } else if (newType === "exclusive_recipes") {
                              setEditItem(prev => ({ ...prev, item_type: "recipe", item_id: "" }));
                              setEditItemPreview(null);
                            } else if (editItem.item_type === "user") {
                              setEditItem(prev => ({ ...prev, item_type: "recipe", item_id: "" }));
                              setEditItemPreview(null);
                            }
                          }}
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

                    {/* Edit Items */}
                    <div className="mb-3">
                      <h6 className="fw-bold mb-3">
                        Items ({editFormData.items?.length || 0})
                      </h6>

                      {editFormData.items && editFormData.items.length > 0 && (
                        <div className="mb-3">
                          {editFormData.items.map((item, idx) => {
                            let originalItem = null;
                            if (section.items && section.items.length > 0) {
                              const found = section.items.find((original) => {
                                if (
                                  item.section_item_id &&
                                  original.sectionItemId
                                ) {
                                  return (
                                    original.sectionItemId ===
                                    item.section_item_id
                                  );
                                }
                                if (item.item_id && original.item?.id) {
                                  return original.item.id === item.item_id;
                                }
                                return false;
                              });
                              if (found) originalItem = found.item;
                            }

                            const displayName =
                              originalItem?.name ??
                              originalItem?.themeName ??
                              originalItem?.creator_name ??
                              item.item_name ??
                              "Unknown";

                            const swatchColor = argbIntToHex(item.card_color);

                            return (
                              <div
                                key={`${item.section_item_id ?? item.item_id ?? "noid"}-${idx}`}
                                className="card mb-2 p-3 d-flex flex-row justify-content-between align-items-center"
                              >
                                <div className="d-flex align-items-center gap-3">
                                  {swatchColor && (
                                    <div
                                      style={{
                                        width: "30px",
                                        height: "30px",
                                        backgroundColor: swatchColor,
                                        border: "1px solid #ddd",
                                        borderRadius: "4px",
                                      }}
                                    />
                                  )}
                                  <div>
                                    <small className="text-muted d-block">
                                      Type: <strong>{item.item_type}</strong>
                                      {item.item_id && (
                                        <>
                                          {" "}
                                          | ID: <strong>{item.item_id}</strong>
                                        </>
                                      )}
                                      {item.card_color !== null &&
                                        item.card_color !== undefined &&
                                        item.card_color !== 0 && (
                                          <>
                                            {" "}
                                            | Color:{" "}
                                            <strong>{item.card_color}</strong>
                                          </>
                                        )}
                                    </small>

                                    {item.item_id && (
                                      <small className="text-muted d-block">
                                        Name: <strong>{displayName}</strong>
                                      </small>
                                    )}

                                    {item.image_url && (
                                      <small className="text-muted d-block">
                                        Image:{" "}
                                        <strong>
                                          {item.image_url.slice(0, 40)}...
                                        </strong>
                                      </small>
                                    )}

                                    {item.link_url && (
                                      <small className="text-muted d-block">
                                        Link:{" "}
                                        <strong>
                                          {item.link_url.slice(0, 40)}...
                                        </strong>
                                      </small>
                                    )}
                                  </div>
                                </div>

                                <div className="d-flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingItemIndex(idx);
                                      setEditItem({
                                        item_type: editFormData.type === "creator_spotlight" ? "user" : (item.item_type || "recipe"),
                                        item_id: item.item_id?.toString() || "",
                                        card_color: swatchColor || "#FF5733",
                                        image_url: item.image_url || "",
                                        link_url: item.link_url || "",
                                      });
                                      setEditItemPreview(originalItem || null);
                                      setShowEditItemForm(true);
                                    }}
                                    className="btn btn-sm btn-outline-primary"
                                    title="Edit item"
                                  >
                                    <Edit2 size={16} />
                                  </button>

                                  <button
                                    onClick={() =>
                                      removeItemFromEditSection(idx)
                                    }
                                    className="btn btn-sm btn-outline-danger"
                                    title="Delete item"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
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
                                disabled={editFormData.type === "creator_spotlight" || editFormData.type === "exclusive_recipes"}
                              >
                                {editFormData.type === "creator_spotlight" ? (
                                  <option value="user">User</option>
                                ) : editFormData.type === "exclusive_recipes" ? (
                                  <option value="recipe">Recipe</option>
                                ) : (
                                  <>
                                    <option value="recipe">Recipe</option>
                                    <option value="theme">Theme</option>
                                  </>
                                )}
                              </select>
                            </div>

                            {isGraphicBanner(editFormData.type) && (
                              <div className="col-12">
                                <label className="form-label small">
                                  Banner Image
                                </label>
                                <div className="d-flex gap-2 flex-wrap">
                                  <input
                                    type="file"
                                    accept="image/*,video/*"
                                    className="form-control form-control-sm"
                                    onChange={(e) =>
                                      setEditBannerFile(
                                        e.target.files?.[0] || null,
                                      )
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={uploadEditBannerToCloudinary}
                                    disabled={
                                      uploadingEditBanner || !editBannerFile
                                    }
                                  >
                                    {uploadingEditBanner
                                      ? "Uploading..."
                                      : "Upload"}
                                  </button>
                                </div>

                                {editItem.image_url && (
                                  <small className="text-muted d-block mt-2">
                                    Uploaded:{" "}
                                    <strong>
                                      {editItem.image_url.slice(0, 60)}...
                                    </strong>
                                  </small>
                                )}
                              </div>
                            )}

                            <div className="col-12 col-md-4">
                              <label className="form-label small">
                                {isGraphicBanner(editFormData.type)
                                  ? "Select Item (Optional)"
                                  : "Select Item"}
                              </label>
                              <button
                                onClick={openEditSelectModal}
                                className="btn btn-sm btn-outline-primary w-100 text-start"
                              >
                                {editItem.item_id
                                  ? `${editItemPreview?.name || editItemPreview?.themeName || editItemPreview?.creator_name || "Selected"}`
                                  : `Browse ${editItem.item_type}s...`}
                              </button>
                            </div>

                            {isGraphicBanner(editFormData.type) && (
                              <div className="col-12">
                                <label className="form-label small">
                                  Link URL{" "}
                                  {!editItem.item_id &&
                                    "(Required for non-recipe items)"}
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter link URL"
                                  value={editItem.link_url}
                                  onChange={(e) =>
                                    setEditItem({
                                      ...editItem,
                                      link_url: e.target.value,
                                    })
                                  }
                                  className="form-control form-control-sm"
                                />
                              </div>
                            )}

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
                                {(editItemPreview.image_url || editItemPreview.profile_picture_url) && (
                                  <img
                                    src={editItemPreview.image_url || editItemPreview.profile_picture_url}
                                    alt={
                                      editItemPreview.name ||
                                      editItemPreview.themeName ||
                                      editItemPreview.creator_name
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
                                      editItemPreview.themeName ||
                                      editItemPreview.creator_name}
                                  </p>
                                  {editItemPreview.id && (
                                    <p className="mb-1 small text-muted">
                                      ID: {editItemPreview.id}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="d-flex gap-2 mt-3">
                            <button
                              onClick={addItemToEditSection}
                              className="btn btn-sm btn-primary"
                              disabled={
                                isGraphicBanner(editFormData.type)
                                  ? !editItem.image_url ||
                                    (!editItem.item_id && !editItem.link_url)
                                  : !editItem.item_id
                              }
                            >
                              <Save size={16} className="me-1" />{" "}
                              {editingItemIndex !== null
                                ? "Save Item"
                                : "Add Item"}
                            </button>

                            <button
                              onClick={() => {
                                setShowEditItemForm(false);
                                setEditingItemIndex(null);
                                setEditItem({
                                  item_type: "recipe",
                                  item_id: "",
                                  card_color: "#FF5733",
                                  image_url: "",
                                  link_url: "",
                                });
                                setEditItemPreview(null);
                                setEditBannerFile(null);
                                setUploadingEditBanner(false);
                              }}
                              className="btn btn-sm btn-secondary"
                            >
                              <X size={16} className="me-1" /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setShowEditItemForm(true);
                            setEditingItemIndex(null);
                            setEditItem({
                              item_type: editFormData.type === "creator_spotlight" ? "user" : "recipe",
                              item_id: "",
                              card_color: "#FF5733",
                              image_url: "",
                              link_url: "",
                            });
                            setEditItemPreview(null);
                          }}
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
                          setDeletedItemIds([]);
                          setShowEditItemForm(false);
                          setEditingItemIndex(null);
                          setEditItem({
                            item_type: "recipe",
                            item_id: "",
                            card_color: "#FF5733",
                            image_url: "",
                            link_url: "",
                          });
                          setEditItemPreview(null);
                          setEditRecipesPage(1);
                          setEditRecipesSearch("");
                          setEditRecipesSearchInput("");
                          setEditBannerFile(null);
                          setUploadingEditBanner(false);
                        }}
                        className="btn btn-secondary d-flex align-items-center gap-2"
                      >
                        <X size={18} /> Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded Items */}
                {expandedId === section.id && (
                  <div className="card-body bg-light">
                    <h6>Items ({section.items?.length || 0})</h6>
                    {!section.items || section.items.length === 0 ? (
                      <p className="text-secondary small">
                        No items in this section
                      </p>
                    ) : (
                      section.items.map((item, idx) => {
                        const rawColor =
                          item.card_color !== undefined
                            ? item.card_color
                            : item.cardColor;
                        const swatchColor = argbIntToHex(rawColor);
                        return (
                          <div
                            key={`${item.sectionItemId ?? "sid"}-${item.item?.id ?? "iid"}-${idx}`}
                            className="card mb-2"
                          >
                            <div className="card-body d-flex justify-content-between align-items-start p-3">
                              <div className="d-flex align-items-center gap-3">
                                {(item.item?.image_url || item.item?.profile_picture_url) && (
                                  <img
                                    src={item.item.image_url || item.item.profile_picture_url}
                                    alt={item.item.name || item.item.themeName || item.item.creator_name}
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
                                {swatchColor && (
                                  <div
                                    style={{
                                      width: "30px",
                                      height: "30px",
                                      backgroundColor: swatchColor,
                                      border: "1px solid #ddd",
                                      borderRadius: "4px",
                                    }}
                                  />
                                )}
                                <div>
                                  <p className="mb-1 fw-bold">
                                    {item.item?.name ||
                                      item.item?.themeName ||
                                      item.item?.creator_name ||
                                      "Item #" + item.sectionItemId}
                                  </p>
                                  {item.item?.id && (
                                    <p className="mb-0 small text-secondary">
                                      ID: {item.item.id}
                                    </p>
                                  )}
                                  <p className="mb-0 small text-muted">
                                    Section Item ID: {item.sectionItemId}
                                  </p>
                                  {item.imageUrl && (
                                    <p className="mb-0 small text-muted">
                                      Image: {item.imageUrl.slice(0, 50)}...
                                    </p>
                                  )}
                                  {(item.linkUrl || item.link_url) && (
                                    <p className="mb-0 small text-muted">
                                      Link:{" "}
                                      {(item.linkUrl || item.link_url).slice(
                                        0,
                                        50,
                                      )}
                                      ...
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="badge bg-success">Active</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* End Stats (moved to top) */}

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
                                {(item.image_url || item.profile_picture_url) && (
                                  <img
                                    src={item.image_url || item.profile_picture_url}
                                    alt={item.name || item.themeName || item.creator_name}
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
                                    {item.name || item.themeName || item.creator_name}
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
                            Math.min(recipesTotalPages, prev + 1),
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

        {/* Edit Modal */}
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
                                {(item.image_url || item.profile_picture_url) && (
                                  <img
                                    src={item.image_url || item.profile_picture_url}
                                    alt={item.name || item.themeName || item.creator_name}
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
                                    {item.name || item.themeName || item.creator_name}
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
                              Math.min(editRecipesTotalPages, prev + 1),
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
//njj