// src/pages/CreatorsPage.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const API_BASE = "https://api.cookeaze.app/api";

const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    Accept: "application/json",
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});

export default function CreatorsPage() {
  const [activeTab, setActiveTab] = useState("creators");

  // === Creators State ===
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [creatorStatusFilter, setCreatorStatusFilter] = useState("active"); // "active" | "banned"

  // === Applications State ===
  const [apps, setApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appStatusFilter, setAppStatusFilter] = useState("pending");
  const [selectedApp, setSelectedApp] = useState(null);
  const [reviewAction, setReviewAction] = useState(""); // "approve" or "reject"
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [appMessage, setAppMessage] = useState("");

  // === My Application State ===
  const [myApp, setMyApp] = useState(null);
  const [myAppLoading, setMyAppLoading] = useState(false);
  const [myAppError, setMyAppError] = useState("");

  // === Ban/Unban State ===
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Creators (when tab is creators)
  useEffect(() => {
    if (activeTab !== "creators") return;

    let mounted = true;
    setLoading(true);
    
    const params = new URLSearchParams();
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (currentPage > 1) params.append("page", currentPage);
    if (creatorStatusFilter === "banned") params.append("is_banned", "true");

    axiosInstance.get(`/creators/?${params.toString()}`)
      .then((res) => {
        if (!mounted) return;
        const fetchedCreators = res.data?.data || [];
        const decoratedCreators = fetchedCreators.map(c => ({
          ...c,
          is_banned: c.is_banned !== undefined ? c.is_banned : (creatorStatusFilter === "banned")
        }));
        setCreators(decoratedCreators);
        const pagination = res.data?.pagination;
        if (pagination) setTotalPages(pagination.total_pages || 1);
        else setTotalPages(1);
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setMessage("Failed to load creators.");
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [debouncedSearch, currentPage, activeTab, creatorStatusFilter]);

  // Fetch Applications (when tab is applications)
  useEffect(() => {
    if (activeTab !== "applications") return;

    let mounted = true;
    setAppsLoading(true);
    
    axiosInstance.get(`/creator/apply/admin/?status=${appStatusFilter}`)
      .then((res) => {
        if (!mounted) return;
        setApps(res.data?.data || []);
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setAppMessage("Failed to load creator applications.");
      })
      .finally(() => mounted && setAppsLoading(false));

    return () => { mounted = false; };
  }, [appStatusFilter, activeTab]);

  // Fetch My Application Status (when tab is my_application)
  useEffect(() => {
    if (activeTab !== "my_application") return;

    let mounted = true;
    setMyAppLoading(true);
    setMyAppError("");
    
    axiosInstance.get(`/creator/apply/status/`)
      .then((res) => {
        if (!mounted) return;
        setMyApp(res.data?.data || null);
      })
      .catch((err) => {
        console.error(err);
        if (mounted) {
          // If error is 404, they just dont have an application yet
          if (err.response?.status === 404) {
             setMyApp(null);
          } else {
             setMyAppError("Failed to fetch application status.");
          }
        }
      })
      .finally(() => mounted && setMyAppLoading(false));

    return () => { mounted = false; };
  }, [activeTab]);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
  };

  const handleReviewSubmit = async () => {
    if (reviewAction === "reject" && !rejectionReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }
    
    setReviewLoading(true);
    const payload = { action: reviewAction };
    if (reviewAction === "reject") {
       payload.rejection_reason = rejectionReason;
    }

    try {
      await axiosInstance.patch(`/creator/apply/admin/${selectedApp.id}/`, payload);
      alert(`Application ${reviewAction}d successfully!`);
      // Update local state to remove or update the app
      setApps(prevApps => prevApps.filter(app => app.id !== selectedApp.id));
      setSelectedApp(null);
    } catch (error) {
      console.error(error);
      alert("Failed to submit review.");
    } finally {
      setReviewLoading(false);
    }
  };

  const openAppReview = async (appId) => {
    try {
       const res = await axiosInstance.get(`/creator/apply/admin/${appId}/`);
       setSelectedApp(res.data.data);
       setReviewAction("");
       setRejectionReason("");
    } catch (e) {
       console.error("Failed to fetch app details", e);
       alert("Failed to load full application details.");
    }
  };

  const renderBadge = (status) => {
     if (status === "approved") return <span className="badge bg-success">Approved</span>;
     if (status === "pending") return <span className="badge bg-warning text-dark">Pending</span>;
     if (status === "rejected") return <span className="badge bg-danger">Rejected</span>;
     return <span className="badge bg-secondary">{status}</span>;
  };

  // === Ban / Unban Handler ===
  const handleBanUnban = async (userId, action) => {
    if (action === "ban" && !banReason.trim()) {
      alert("Please provide a reason for banning this creator.");
      return;
    }
    setBanLoading(true);
    try {
      const payload = { action };
      if (action === "ban") payload.reason = banReason;
      await axiosInstance.post(`/users/${userId}/ban-creator/`, payload);
      alert(`Creator ${action === "ban" ? "banned" : "unbanned"} successfully!`);
      setBanTarget(null);
      setBanReason("");
      // Remove the creator from the current list since they'll move to the other filter
      setCreators(prev => prev.filter(c => c.id !== userId));
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || `Failed to ${action} creator.`;
      alert(msg);
    } finally {
      setBanLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h2 className="fw-bold mb-1">Creator Management</h2>
          <p className="text-muted mb-0">Manage platform recipe creators and applications.</p>
        </div>
      </div>

      <ul className="nav nav-pills mb-4 border-bottom pb-3">
        <li className="nav-item">
          <button 
            className={`nav-link fw-semibold rounded-pill px-4 ${activeTab === "creators" ? "active" : "text-muted"}`}
            onClick={() => setActiveTab("creators")}
          >
            Approved Creators
          </button>
        </li>
        <li className="nav-item ms-2">
          <button 
            className={`nav-link fw-semibold rounded-pill px-4 ${activeTab === "applications" ? "active" : "text-muted"}`}
            onClick={() => setActiveTab("applications")}
          >
            Applications
          </button>
        </li>
        <li className="nav-item ms-2">
          <button 
            className={`nav-link fw-semibold rounded-pill px-4 ${activeTab === "my_application" ? "active" : "text-muted"}`}
            onClick={() => setActiveTab("my_application")}
          >
            My Application
          </button>
        </li>
      </ul>

      {/* ===================== CREATORS TAB ===================== */}
      {activeTab === "creators" && (
        <>
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <h5 className="fw-bold mb-0">Platform Creators</h5>
            <div className="d-flex align-items-center gap-3">
              <div className="btn-group shadow-sm">
                <input type="radio" className="btn-check" name="creatorStatus" id="statusActive" autoComplete="off" checked={creatorStatusFilter === "active"} onChange={() => { setCreatorStatusFilter("active"); setCurrentPage(1); }} />
                <label className="btn btn-outline-primary btn-sm px-4" htmlFor="statusActive">Active</label>
                <input type="radio" className="btn-check" name="creatorStatus" id="statusBanned" autoComplete="off" checked={creatorStatusFilter === "banned"} onChange={() => { setCreatorStatusFilter("banned"); setCurrentPage(1); }} />
                <label className="btn btn-outline-danger btn-sm px-4" htmlFor="statusBanned">Banned</label>
              </div>
              <input
                type="text"
                placeholder="Search creators by name..."
                className="form-control form-control-sm"
                style={{ width: 220 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {message && <div className="alert alert-info py-2 small text-center">{message}</div>}

          <div className="table-responsive shadow-sm rounded bg-white">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted small text-uppercase">
                <tr>
                  <th className="py-3 px-4">Profile</th>
                  <th className="py-3">Name</th>
                  <th className="py-3">Bio</th>
                  <th className="py-3">Recipes</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-end px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status" />
                    </td>
                  </tr>
                ) : creators.length > 0 ? (
                  creators.map((c) => (
                    <tr key={c.id} className={c.is_banned ? "table-danger" : ""}>
                      <td className="px-4">
                        <img
                          src={c.profile_picture_url || "https://via.placeholder.com/45"}
                          alt={c.creator_name}
                          className="rounded-circle shadow-sm"
                          style={{ width: 45, height: 45, objectFit: "cover", opacity: c.is_banned ? 0.5 : 1 }}
                        />
                      </td>
                      <td className="fw-bold text-dark">{c.creator_name}</td>
                      <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.description}>
                        {c.description || <span className="text-muted fst-italic">No bio</span>}
                      </td>
                      <td><span className="badge bg-primary rounded-pill px-3">{c.total_recipes}</span></td>
                      <td>
                        {c.is_banned ? (
                          <span className="badge bg-danger rounded-pill px-3">Banned</span>
                        ) : (
                          <span className="badge bg-success rounded-pill px-3">Active</span>
                        )}
                      </td>
                      <td className="text-end px-4">
                        <div className="d-flex gap-2 justify-content-end">
                          <Link to={`/creators/${c.id}`} state={{ is_banned: c.is_banned }} className="btn btn-sm btn-outline-dark rounded-pill px-3">
                            View
                          </Link>
                          {c.is_banned ? (
                            <button
                              className="btn btn-sm btn-outline-success rounded-pill px-3"
                              onClick={() => handleBanUnban(c.id, "unban")}
                              disabled={banLoading}
                            >
                              Unban
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-danger rounded-pill px-3"
                              onClick={() => { setBanTarget(c); setBanReason(""); }}
                            >
                              Ban
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="text-center text-muted py-5">No creators found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="modern-pagination">
              <button
                className="pagination-btn prev-next"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Prev
              </button>

              <span className="text-muted fw-semibold px-3 small">
                Page {currentPage} of {totalPages}
              </span>

              <button
                className="pagination-btn prev-next"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* ===================== APPLICATIONS TAB ===================== */}
      {activeTab === "applications" && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold mb-0">Incoming Applications</h5>
            <div className="btn-group shadow-sm">
              <input type="radio" className="btn-check" name="btnradio" id="pending" autoComplete="off" checked={appStatusFilter === "pending"} onChange={() => setAppStatusFilter("pending")} />
              <label className="btn btn-outline-primary btn-sm px-4" htmlFor="pending">Pending</label>
              <input type="radio" className="btn-check" name="btnradio" id="approved" autoComplete="off" checked={appStatusFilter === "approved"} onChange={() => setAppStatusFilter("approved")} />
              <label className="btn btn-outline-primary btn-sm px-4" htmlFor="approved">Approved</label>
              <input type="radio" className="btn-check" name="btnradio" id="rejected" autoComplete="off" checked={appStatusFilter === "rejected"} onChange={() => setAppStatusFilter("rejected")} />
              <label className="btn btn-outline-primary btn-sm px-4" htmlFor="rejected">Rejected</label>
            </div>
          </div>

          {appMessage && <div className="alert alert-info py-2 small text-center">{appMessage}</div>}

          <div className="table-responsive shadow-sm rounded bg-white">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted small text-uppercase">
                <tr>
                  <th className="py-3 px-4">Brand/Prof. Name</th>
                  <th className="py-3">Applicant Name</th>
                  <th className="py-3">Email</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-end px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {appsLoading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status" />
                    </td>
                  </tr>
                ) : apps.length > 0 ? (
                  apps.map(app => (
                    <tr key={app.id}>
                      <td className="fw-bold px-4">{app.professional_name}</td>
                      <td>{app.user_full_name}</td>
                      <td>{app.user_email}</td>
                      <td>{renderBadge(app.status)}</td>
                      <td className="text-end px-4">
                        <button 
                          className="btn btn-sm btn-dark rounded-pill px-3"
                          onClick={() => openAppReview(app.id)}
                        >
                          Review &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" className="text-center text-muted py-5">No {appStatusFilter} applications found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===================== MY APPLICATION TAB ===================== */}
      {activeTab === "my_application" && (
        <div className="card border-0 shadow-sm rounded overflow-hidden">
           <div className="card-header bg-light border-0 py-3">
             <h5 className="fw-bold mb-0">My Creator Application</h5>
           </div>
           <div className="card-body p-4 p-md-5">
             {myAppLoading ? (
                <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
             ) : myAppError ? (
                <div className="alert alert-warning border-0 shadow-sm">{myAppError}</div>
             ) : myApp ? (
                <div className="row">
                   <div className="col-lg-4 text-center mb-4 border-end">
                      <img src={myApp.gov_id_images} alt="Gov ID" className="img-thumbnail rounded shadow-sm mb-3" style={{ maxHeight: 200, objectFit: "cover" }} />
                      <h4 className="fw-bold">{myApp.professional_name}</h4>
                      {renderBadge(myApp.status)}
                      <p className="text-muted small mt-2">Submitted on {new Date(myApp.created_at).toLocaleDateString()}</p>
                   </div>
                   <div className="col-lg-8 ps-lg-4">
                      <h6 className="fw-bold text-uppercase text-muted small">Bio</h6>
                      <p className="mb-4">{myApp.bio}</p>
                      
                      <div className="row mb-4">
                         <div className="col-sm-6">
                            <h6 className="fw-bold text-uppercase text-muted small">ID Type</h6>
                            <p>{myApp.gov_id_type_display}</p>
                         </div>
                         <div className="col-sm-6">
                            <h6 className="fw-bold text-uppercase text-muted small">Social Media</h6>
                            <a href={myApp.social_media} target="_blank" rel="noreferrer" className="text-decoration-none">View Profile</a>
                         </div>
                      </div>

                      <h6 className="fw-bold text-uppercase text-muted small">Primary Cuisines</h6>
                      <div className="mb-4">
                         {myApp.primary_cuisines?.map((c, i) => <span key={i} className="badge bg-light text-dark border me-1">{c}</span>)}
                      </div>

                      {myApp.status === "rejected" && myApp.rejection_reason && (
                         <div className="alert alert-danger bg-danger text-white border-0 shadow-sm rounded">
                           <strong>Rejection Reason:</strong>
                           <p className="mb-0 mt-1">{myApp.rejection_reason}</p>
                         </div>
                      )}
                      
                      {myApp.media_file && myApp.media_file.length > 0 && (
                         <div className="mt-4">
                           <h6 className="fw-bold text-uppercase text-muted small mb-3">Attached Media</h6>
                           <div className="d-flex gap-2">
                              {myApp.media_file.map((m, i) => (
                                 <img key={i} src={m} alt="Media attached" className="rounded shadow-sm" style={{ width: 100, height: 100, objectFit: "cover" }} />
                              ))}
                           </div>
                         </div>
                      )}
                   </div>
                </div>
             ) : (
                <div className="text-center py-5">
                   <h3 className="fw-bold text-muted mb-3">No Application Found</h3>
                   <p className="text-muted">You have not submitted a creator application yet.</p>
                   <button className="btn btn-primary rounded-pill px-4 mt-2">Apply Now (Coming Soon)</button>
                </div>
             )}
           </div>
        </div>
      )}

      {/* ===================== APPLICATION REVIEW MODAL ===================== */}
      {selectedApp && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg overflow-hidden">
              <div className="modal-header border-0 bg-light p-4">
                <div>
                   <h4 className="modal-title fw-bolder mb-1">Application: {selectedApp.professional_name}</h4>
                   <span className="text-muted d-block small">By {selectedApp.user_full_name} ({selectedApp.user_email})</span>
                </div>
                <button type="button" className="btn-close" onClick={() => setSelectedApp(null)}></button>
              </div>
              
              <div className="modal-body p-0">
                <div className="row g-0 h-100">
                   {/* Left Side: Details */}
                   <div className="col-lg-5 p-4 border-end bg-white">
                      <div className="d-flex justify-content-between align-items-center mb-4">
                         <h6 className="fw-bold text-uppercase pb-1 border-bottom border-2 border-dark mb-0 d-inline-block">Applicant Bio</h6>
                         {renderBadge(selectedApp.status)}
                      </div>
                      <p className="text-secondary lh-lg mb-4">{selectedApp.bio}</p>
                      
                      <div className="row mb-4">
                         <div className="col-6">
                            <span className="text-muted fw-bold small text-uppercase block">Social Links</span>
                            <div className="mt-1"><a href={selectedApp.social_media} target="_blank" rel="noreferrer" className="text-primary text-decoration-none">View Socials &nearr;</a></div>
                         </div>
                         <div className="col-6">
                            <span className="text-muted fw-bold small text-uppercase block">Identity Type</span>
                            <div className="mt-1 fw-semibold">{selectedApp.gov_id_type_display}</div>
                         </div>
                      </div>

                      <div className="mb-4">
                         <span className="text-muted fw-bold small text-uppercase block d-block mb-2">Primary Cuisines</span>
                         <div className="d-flex flex-wrap gap-1">
                            {selectedApp.primary_cuisines?.map((c, i) => (
                               <span key={i} className="badge bg-light text-dark border px-2 py-1">{c}</span>
                            ))}
                         </div>
                      </div>

                      {/* Display reviewer history if exist */}
                      {selectedApp.reviewed_by_email && (
                         <div className="mt-4 p-3 bg-light rounded small">
                           <span className="fw-bold">Reviewed by:</span> {selectedApp.reviewed_by_email}<br/>
                           <span className="fw-bold">On:</span> {new Date(selectedApp.reviewed_at).toLocaleString()}
                         </div>
                      )}
                      
                      {selectedApp.status === "rejected" && selectedApp.rejection_reason && (
                         <div className="mt-3 p-3 bg-danger bg-opacity-10 text-danger rounded border border-danger">
                           <strong>Reject Reason:</strong> <br/>{selectedApp.rejection_reason}
                         </div>
                      )}
                   </div>

                   {/* Right Side: Media & Action */}
                   <div className="col-lg-7 p-4 bg-light">
                      <h6 className="fw-bold text-uppercase pb-1 border-bottom border-2 border-dark mb-3 d-inline-block">Identity & Media</h6>
                      
                      <div className="row g-3 mb-4">
                         <div className="col-md-6">
                           <p className="small fw-semibold text-muted mb-2">Government ID</p>
                           <a href={selectedApp.gov_id_images} target="_blank" rel="noreferrer">
                             <img src={selectedApp.gov_id_images} alt="Gov ID" className="img-fluid rounded shadow-sm" style={{ height: 200, width: "100%", objectFit: "cover" }} />
                           </a>
                         </div>
                         <div className="col-md-6">
                           <p className="small fw-semibold text-muted mb-2">Portfolio / Samples</p>
                           {selectedApp.media_file?.length > 0 ? (
                               <div className="d-flex flex-column gap-2 overflow-auto" style={{ maxHeight: 200 }}>
                                 {selectedApp.media_file.map((media, i) => (
                                    <a href={media} target="_blank" rel="noreferrer" key={i}>
                                      <img src={media} alt="Sample" className="img-fluid rounded shadow-sm w-100" style={{ height: 120, objectFit: "cover" }} />
                                    </a>
                                 ))}
                               </div>
                           ) : (
                               <div className="p-4 border rounded text-center text-muted bg-white h-100 d-flex align-items-center justify-content-center border-dashed">No media</div>
                           )}
                         </div>
                      </div>

                      {/* Decision Panel (only if pending) */}
                      {selectedApp.status === "pending" && (
                         <div className="card border p-4 shadow-sm mt-auto position-sticky bottom-0">
                            <h6 className="fw-bold mb-3">Review Decision</h6>
                            
                            {!reviewAction && (
                               <div className="d-flex gap-3">
                                 <button className="btn btn-outline-success px-4 py-2 w-50" onClick={() => setReviewAction("approve")}>
                                    <i className="bi bi-check-circle me-2"></i> Approve Creator
                                 </button>
                                 <button className="btn btn-outline-danger px-4 py-2 w-50" onClick={() => setReviewAction("reject")}>
                                    <i className="bi bi-x-circle me-2"></i> Reject Creator
                                 </button>
                               </div>
                            )}

                            {reviewAction === "approve" && (
                               <div>
                                 <div className="alert alert-success fs-6">You are about to <strong>approve</strong> {selectedApp.professional_name}. They will officially become a platform creator.</div>
                                 <div className="d-flex gap-2">
                                     <button className="btn btn-success fw-bold w-75" onClick={handleReviewSubmit} disabled={reviewLoading}>
                                       {reviewLoading ? "Processing..." : "Confirm Approval"}
                                     </button>
                                     <button className="btn btn-light border" onClick={() => setReviewAction("")} disabled={reviewLoading}>Cancel</button>
                                 </div>
                               </div>
                            )}

                            {reviewAction === "reject" && (
                               <div>
                                 <label className="form-label fw-semibold text-danger">Reason for Rejection *</label>
                                 <textarea 
                                    className="form-control mb-3" 
                                    rows="3" 
                                    placeholder="Explain why this application was denied..." 
                                    value={rejectionReason} 
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                 ></textarea>
                                 <div className="d-flex gap-2">
                                     <button className="btn btn-danger fw-bold w-75" onClick={handleReviewSubmit} disabled={reviewLoading}>
                                       {reviewLoading ? "Processing..." : "Confirm Rejection"}
                                     </button>
                                     <button className="btn btn-light border" onClick={() => setReviewAction("")} disabled={reviewLoading}>Cancel</button>
                                 </div>
                               </div>
                            )}
                         </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== BAN CREATOR MODAL ===================== */}
      {banTarget && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-danger text-white border-0 py-3 px-4">
                <h5 className="modal-title fw-bold mb-0">
                  <span className="me-2">🚫</span> Ban Creator
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => { setBanTarget(null); setBanReason(""); }}
                  disabled={banLoading}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="d-flex align-items-center gap-3 mb-4 p-3 bg-light rounded">
                  <img
                    src={banTarget.profile_picture_url || "https://via.placeholder.com/50"}
                    alt={banTarget.creator_name}
                    className="rounded-circle shadow-sm"
                    style={{ width: 50, height: 50, objectFit: "cover" }}
                  />
                  <div>
                    <h6 className="fw-bold mb-0">{banTarget.creator_name}</h6>
                    <small className="text-muted">{banTarget.total_recipes} recipes will be hidden</small>
                  </div>
                </div>

                <div className="alert alert-warning border-0 shadow-sm small mb-3">
                  <strong>⚠️ Warning:</strong> Banning this creator will hide all their recipes from the platform. This action can be reversed by unbanning.
                </div>

                <label className="form-label fw-semibold">Reason for Ban <span className="text-danger">*</span></label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Explain why this creator is being banned..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  disabled={banLoading}
                ></textarea>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-0">
                <button
                  className="btn btn-light border px-4"
                  onClick={() => { setBanTarget(null); setBanReason(""); }}
                  disabled={banLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger fw-bold px-4"
                  onClick={() => handleBanUnban(banTarget.id, "ban")}
                  disabled={banLoading || !banReason.trim()}
                >
                  {banLoading ? (
                    <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Banning...</>
                  ) : (
                    "Confirm Ban"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
