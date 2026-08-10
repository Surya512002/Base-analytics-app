"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Loader2, Save } from "lucide-react";
import type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";
import { isCreatorProfileComplete } from "@/lib/launchpad/creator-profile-types";
import { updateCreatorProfile, uploadCreatorAvatar } from "@/lib/api/creator-client";
import { patchCreatorProfileCache } from "@/hooks/useCreatorProfile";
import { prepareTokenImage, revokePreviewUrl } from "@/lib/launchpad/image-upload";
import CreatorAvatar from "@/components/launchpad/CreatorAvatar";

export default function CreatorProfileForm({
  address,
  profile,
  onSaved,
  variant = "settings",
  siweAuthenticated = false,
  onSiweSignIn,
}: {
  address: string;
  profile: CreatorProfile | null;
  onSaved: (profile: CreatorProfile) => void;
  variant?: "setup" | "settings";
  siweAuthenticated?: boolean;
  onSiweSignIn?: () => void | Promise<boolean | void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setBio(profile?.bio ?? "");
    setWebsite(profile?.website ?? "");
    setTwitter(profile?.twitter ?? "");
    setTelegram(profile?.telegram ?? "");
    setAvatarUrl(profile?.avatarUrl);
  }, [profile]);

  useEffect(() => {
    return () => revokePreviewUrl(previewUrl);
  }, [previewUrl]);

  const onPickImage = useCallback(async (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const prepared = await prepareTokenImage(file);
      revokePreviewUrl(previewUrl);
      setPreviewUrl(prepared.previewUrl);
      const url = await uploadCreatorAvatar(prepared.blob);
      if (!url) throw new Error("Upload failed");
      setAvatarUrl(url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [previewUrl]);

  const onSave = useCallback(async () => {
    setError(null);
    if (!siweAuthenticated && onSiweSignIn) {
      const ok = await onSiweSignIn();
      // Require an explicit successful boolean; header may return void after signing.
      if (ok === false) {
        setError("Sign in with your wallet to save your profile.");
        return;
      }
      // void / undefined: continue — parent may have signed; save API will reject if not SIWE.
    }
    if (!displayName.trim() && !avatarUrl && !bio.trim()) {
      setError("Add a display name or profile photo to create your profile.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateCreatorProfile(address, {
        displayName,
        bio,
        avatarUrl,
        website,
        twitter,
        telegram,
      });
      if (!result.ok || !result.profile) {
        setError(result.error ?? "Save failed");
        return;
      }
      patchCreatorProfileCache(result.profile);
      onSaved(result.profile);
    } finally {
      setSaving(false);
    }
  }, [address, displayName, bio, avatarUrl, website, twitter, telegram, onSaved, siweAuthenticated, onSiweSignIn]);

  const isSetup = variant === "setup" && !isCreatorProfileComplete(profile);
  const shownAvatar = previewUrl || avatarUrl;

  return (
    <div
      className={
        variant === "settings"
          ? ""
          : `rounded-2xl border bg-[var(--surface)] ${
              isSetup
                ? "border-[var(--brand)]/35 bg-[var(--brand-soft)]/20 p-5 sm:p-6"
                : "border-[var(--border-subtle)] p-4"
            }`
      }
    >
      {isSetup && (
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-dark)]">
            Create your creator profile
          </p>
          <h2 className="mt-1 text-lg font-bold text-[var(--ink)]">
            Add your photo, name, and bio
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Your profile appears on every token you launch and on the creator page traders visit.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="relative">
            {shownAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shownAvatar}
                alt=""
                className="h-24 w-24 rounded-2xl border-2 border-[var(--border-subtle)] object-cover sm:h-28 sm:w-28"
              />
            ) : (
              <CreatorAvatar address={address} profile={profile} size="hero" ring />
            )}
            <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm hover:border-[var(--brand)]">
              {uploading ? (
                <Loader2 size={16} className="animate-spin text-[var(--brand)]" />
              ) : (
                <Camera size={16} className="text-[var(--ink-muted)]" />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <p className="text-center text-[10px] text-[var(--ink-dim)]">PNG, JPG, WebP · max 2MB</p>
          {uploadError && (
            <p className="max-w-[140px] text-center text-[10px] font-medium text-rose-600">
              {uploadError}
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-[var(--ink-muted)]">
              Display name <span className="text-rose-500">*</span>
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
              maxLength={50}
              placeholder="Surya Prakash"
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5 text-base text-[var(--ink)] sm:text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--ink-muted)]">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              maxLength={280}
              rows={2}
              placeholder="Builder on Base · B20 launches · swap fee revenue to creators"
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5 text-base text-[var(--ink)] sm:text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[11px] font-semibold text-[var(--ink-muted)]">Website</label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-base text-[var(--ink)] sm:text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--ink-muted)]">X / Twitter</label>
              <input
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="@handle or URL"
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-base text-[var(--ink)] sm:text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--ink-muted)]">Telegram</label>
              <input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="t.me/…"
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-base text-[var(--ink)] sm:text-sm"
              />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

          <button
            type="button"
            disabled={saving || uploading}
            onClick={() => void onSave()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-dark)] disabled:opacity-50 sm:w-auto touch-manipulation"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {isSetup ? "Create profile" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
