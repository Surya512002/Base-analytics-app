"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Camera, Loader2, Check, Globe, Twitter, Send, AlertCircle } from "lucide-react";
import type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";
import { updateCreatorProfile, uploadCreatorAvatar } from "@/lib/api/creator-client";
import { patchCreatorProfileCache } from "@/hooks/useCreatorProfile";
import { prepareTokenImage, revokePreviewUrl } from "@/lib/launchpad/image-upload";
import CreatorAvatar from "@/components/launchpad/CreatorAvatar";

interface EditProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  address: string;
  profile: CreatorProfile | null;
  onSaved: (nextProfile: CreatorProfile) => void;
  siweAuthenticated?: boolean;
  onSiweSignIn?: () => void | Promise<boolean | void>;
}

export default function EditProfileDrawer({
  open,
  onClose,
  address,
  profile,
  onSaved,
  siweAuthenticated = false,
  onSiweSignIn,
}: EditProfileDrawerProps) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
  }>({});

  // Sync state on open / profile change
  useEffect(() => {
    if (open) {
      setDisplayName(profile?.displayName ?? "");
      setBio(profile?.bio ?? "");
      setWebsite(profile?.website ?? "");
      setTwitter(profile?.twitter ?? "");
      setTelegram(profile?.telegram ?? "");
      setAvatarUrl(profile?.avatarUrl);
      setPreviewUrl(null);
      setError(null);
      setUploadError(null);
      setSuccess(false);
      setFieldErrors({});
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, profile]);

  // Clean up object URLs
  useEffect(() => {
    return () => revokePreviewUrl(previewUrl);
  }, [previewUrl]);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Handle avatar upload
  const handlePickImage = useCallback(async (file: File | null) => {
    if (!file) return;
    setUploadError(null);

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Image must be smaller than 2MB");
      return;
    }

    // Validate format
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp|gif)/)) {
      setUploadError("Only PNG, JPG, WebP, and GIF are supported");
      return;
    }

    setUploading(true);
    try {
      const prepared = await prepareTokenImage(file);
      revokePreviewUrl(previewUrl);
      setPreviewUrl(prepared.previewUrl);
      const uploaded = await uploadCreatorAvatar(prepared.blob);
      if (!uploaded) throw new Error("Upload failed. Try again.");
      setAvatarUrl(uploaded);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [previewUrl]);

  // Validate fields inline
  const validate = () => {
    const errors: typeof fieldErrors = {};

    if (website.trim()) {
      const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
      if (!urlPattern.test(website.trim())) {
        errors.website = "Enter a valid website URL (e.g. https://yoursite.com)";
      }
    }

    if (twitter.trim()) {
      const handle = twitter.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, "");
      if (!/^[\w]{1,15}$/.test(handle)) {
        errors.twitter = "Enter a valid X handle (up to 15 alphanumeric characters)";
      }
    }

    if (telegram.trim()) {
      const handle = telegram.trim().replace(/^@/, "").replace(/^https?:\/\/(t\.me|telegram\.me)\//, "");
      if (!/^[a-zA-Z0-9_]{5,32}$/.test(handle)) {
        errors.telegram = "Enter a valid Telegram handle (5-32 characters)";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!validate()) return;

    if (!siweAuthenticated && onSiweSignIn) {
      const ok = await onSiweSignIn();
      if (!ok) {
        setError("Sign in with your wallet to save your profile changes.");
        return;
      }
    }

    setSaving(true);
    try {
      const cleanTwitter = twitter.trim()
        ? twitter.trim().startsWith("http")
          ? twitter.trim()
          : `@${twitter.trim().replace(/^@/, "")}`
        : "";

      const cleanTelegram = telegram.trim()
        ? telegram.trim().startsWith("http")
          ? telegram.trim()
          : telegram.trim().replace(/^@/, "")
        : "";

      const result = await updateCreatorProfile(address, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarUrl,
        website: website.trim(),
        twitter: cleanTwitter,
        telegram: cleanTelegram,
      });

      if (!result.ok || !result.profile) {
        throw new Error(result.error ?? "Failed to save profile");
      }

      patchCreatorProfileCache(result.profile);
      onSaved(result.profile);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const currentAvatar = previewUrl || avatarUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--overlay)] backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-3)] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-subtle)] shrink-0">
          <div>
            <h2 id="edit-profile-title" className="text-lg font-black text-[var(--ink)]">
              Edit Creator Profile
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Update your public identity, bio, and social links.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {currentAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentAvatar}
                  alt="Profile Avatar"
                  className="w-20 h-20 rounded-2xl border-2 border-[var(--border-subtle)] object-cover shadow-sm"
                />
              ) : (
                <CreatorAvatar address={address} profile={profile} size="xl" ring />
              )}
              <label className="pop-pill absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-[#0052FF] text-white flex items-center justify-center cursor-pointer shadow-md transition">
                {uploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => void handlePickImage(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--ink)]">Profile Photo</p>
              <p className="text-[11px] text-[var(--ink-muted)]">
                PNG, JPG, WebP · Max 2MB
              </p>
              {uploadError && (
                <p className="text-[11px] font-bold text-red-500 mt-0.5">{uploadError}</p>
              )}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Display Name
              </label>
              <span className="text-[10px] text-[var(--ink-dim)] font-mono">
                {displayName.length} / 50
              </span>
            </div>
            <input
              type="text"
              value={displayName}
              maxLength={50}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Satoshi Nakamoto"
              className="w-full text-sm font-bold rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] px-3.5 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--brand-text)] transition"
            />
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Bio
              </label>
              <span className="text-[10px] text-[var(--ink-dim)] font-mono">
                {bio.length} / 280
              </span>
            </div>
            <textarea
              rows={3}
              value={bio}
              maxLength={280}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell onchain collectors about yourself, what you build, and your tokens."
              className="w-full text-sm rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3 text-[var(--ink)] outline-none focus:border-[var(--brand-text)] resize-none transition"
            />
          </div>

          {/* Social Links */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] block">
              Social Links
            </span>

            {/* Website */}
            <div>
              <div className="relative">
                <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                <input
                  type="text"
                  value={website}
                  onChange={(e) => {
                    setWebsite(e.target.value);
                    if (fieldErrors.website) setFieldErrors((prev) => ({ ...prev, website: undefined }));
                  }}
                  placeholder="Website URL (https://…)"
                  className="w-full text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] pl-9 pr-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--brand-text)] transition"
                />
              </div>
              {fieldErrors.website && (
                <p className="text-[11px] font-bold text-red-500 mt-1">{fieldErrors.website}</p>
              )}
            </div>

            {/* Twitter / X */}
            <div>
              <div className="relative">
                <Twitter size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                <input
                  type="text"
                  value={twitter}
                  onChange={(e) => {
                    setTwitter(e.target.value);
                    if (fieldErrors.twitter) setFieldErrors((prev) => ({ ...prev, twitter: undefined }));
                  }}
                  placeholder="X / Twitter handle (@yourhandle)"
                  className="w-full text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] pl-9 pr-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--brand-text)] transition"
                />
              </div>
              {fieldErrors.twitter && (
                <p className="text-[11px] font-bold text-red-500 mt-1">{fieldErrors.twitter}</p>
              )}
            </div>

            {/* Telegram */}
            <div>
              <div className="relative">
                <Send size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                <input
                  type="text"
                  value={telegram}
                  onChange={(e) => {
                    setTelegram(e.target.value);
                    if (fieldErrors.telegram) setFieldErrors((prev) => ({ ...prev, telegram: undefined }));
                  }}
                  placeholder="Telegram handle (username or t.me/…)"
                  className="w-full text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] pl-9 pr-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--brand-text)] transition"
                />
              </div>
              {fieldErrors.telegram && (
                <p className="text-[11px] font-bold text-red-500 mt-1">{fieldErrors.telegram}</p>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs font-bold text-red-600 dark:text-red-400">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={saving || uploading}
              className="w-full py-3.5 rounded-xl font-black text-sm bg-[#0052FF] text-white hover:bg-[#0047e0] disabled:opacity-50 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Changes…</span>
                </>
              ) : success ? (
                <>
                  <Check size={16} className="text-white" />
                  <span>Profile Saved!</span>
                </>
              ) : (
                <span>Save Profile</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
